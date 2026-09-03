"""
模型管理路由
处理YOLO模型上传、训练和管理功能
"""
import os
import shutil
import json
import subprocess
import logging
import random
import yaml
import signal
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Depends
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Project, ModelRecord, ProjectActiveModel, TrainingRun
from app.utils.locate_anything_worker import LocateAnythingModelManager
from PIL import Image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/models", tags=["models"])

# 模型存储路径
MODELS_DIR = "data/models"
TRAIN_DIR = "data/training"
BASE_MODEL_GROUP = "基础模型"
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(TRAIN_DIR, exist_ok=True)

# 训练状态管理
training_status = {
    "is_training": False,
    "current_epoch": 0,
    "total_epochs": 0,
    "progress": 0,
    "log": []
}
training_process = None
training_process_lock = threading.RLock()
training_stop_event = threading.Event()


def resolve_training_device():
    """根据环境变量确定 YOLO 训练设备，并在 GPU 模式下验证 CUDA。"""
    configured_device = os.getenv("TRAIN_DEVICE", "gpu").strip().lower()

    if configured_device == "cpu":
        return "cpu", "CPU"

    if configured_device != "gpu":
        raise RuntimeError(
            f"TRAIN_DEVICE 配置无效: {configured_device or '<空>'}，仅支持 gpu 或 cpu"
        )

    try:
        import torch
    except ImportError as exc:
        raise RuntimeError(
            "TRAIN_DEVICE=gpu，但无法导入 PyTorch，请检查服务器镜像中的 PyTorch 安装"
        ) from exc

    if torch.version.cuda is None:
        raise RuntimeError(
            "TRAIN_DEVICE=gpu，但当前安装的是不支持 CUDA 的 PyTorch 版本"
        )

    visible_devices = os.getenv("CUDA_VISIBLE_DEVICES")
    if visible_devices is not None and visible_devices.strip() in {"", "-1"}:
        raise RuntimeError(
            "TRAIN_DEVICE=gpu，但 CUDA_VISIBLE_DEVICES 未配置可用 GPU"
        )

    try:
        torch.cuda.init()
        cuda_available = torch.cuda.is_available()
        device_count = torch.cuda.device_count()
    except Exception as exc:
        raise RuntimeError(
            f"TRAIN_DEVICE=gpu，但 CUDA 初始化失败: {exc}"
        ) from exc

    if not cuda_available or device_count < 1:
        raise RuntimeError(
            "TRAIN_DEVICE=gpu，但 PyTorch 检测不到可用 CUDA 设备；"
            "请检查 NVIDIA 驱动、容器 GPU 映射及 CUDA/PyTorch 版本兼容性"
        )

    try:
        device_name = torch.cuda.get_device_name(0)
    except Exception as exc:
        raise RuntimeError(
            f"TRAIN_DEVICE=gpu，CUDA 可用但无法读取 GPU 0: {exc}"
        ) from exc

    return "0", f"GPU 0 ({device_name})"


def upsert_model_record(db, filename, project=None, source_type='uploaded',
                        display_name=None, original_name=None, file_size=0):
    record = db.query(ModelRecord).filter(ModelRecord.filename == filename).first()
    if record is None:
        record = ModelRecord(filename=filename)
        db.add(record)
    record.display_name = display_name or filename
    record.original_name = original_name
    record.project_id = project.id if project else None
    record.project_name = project.name if project else None
    record.source_type = source_type
    record.file_size = file_size
    db.commit()
    return record


class TrainConfig(BaseModel):
    project_name: str
    base_model: str
    task_type: str = "segment"  # "detect" 或 "segment"
    epochs: int = 100
    batch: int = 16
    lr: float = 0.01
    imgsz: int = 640


class AutoAnnotateRequest(BaseModel):
    image_path: str
    project_name: str


@router.post("/upload")
async def upload_model(
        file: UploadFile = File(...),
        model_name: str = Form(...),
        project_name: Optional[str] = Form(None),
        db: Session = Depends(get_db)
):
    """上传YOLO模型文件"""
    try:
        # 验证文件类型
        if not file.filename.endswith('.pt'):
            raise HTTPException(status_code=400, detail="只支持.pt格式的模型文件")

        # 创建安全的文件名
        project = db.query(Project).filter(Project.name == project_name).first() if project_name else None
        if project_name and not project:
            raise HTTPException(status_code=404, detail="所选项目不存在")

        safe_name = f"{model_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pt"
        file_path = os.path.join(MODELS_DIR, safe_name)

        # 保存文件
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(file_path)
        upsert_model_record(
            db, safe_name, project=project, source_type='uploaded',
            display_name=model_name, original_name=file.filename, file_size=file_size
        )

        logger.info(f"Model uploaded: {safe_name}, size: {file_size} bytes")

        return JSONResponse({
            "success": True,
            "message": "模型上传成功",
            "model": {
                "name": safe_name,
                "original_name": file.filename,
                "size": file_size,
                "upload_time": datetime.now().isoformat(),
                "group": project_name or BASE_MODEL_GROUP
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload model: {e}")
        raise HTTPException(status_code=500, detail=f"模型上传失败: {str(e)}")


@router.get("/list")
async def list_models(db: Session = Depends(get_db)):
    """获取已上传的模型列表"""
    try:
        models = []
        records = {record.filename: record for record in db.query(ModelRecord).all()}
        if os.path.exists(MODELS_DIR):
            for filename in os.listdir(MODELS_DIR):
                if filename.endswith('.pt'):
                    file_path = os.path.join(MODELS_DIR, filename)
                    file_stat = os.stat(file_path)
                    record = records.get(filename)
                    if record is None:
                        # 兼容已有模型文件：首次列表查询时自动登记为基础模型。
                        record = upsert_model_record(db, filename, file_size=file_stat.st_size)
                    models.append({
                        "name": filename,
                        "size": file_stat.st_size,
                        "modified_time": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                        "group": record.project_name or BASE_MODEL_GROUP,
                        "project_name": record.project_name,
                        "source_type": record.source_type
                    })

        return JSONResponse({
            "success": True,
            "models": sorted(models, key=lambda x: x['modified_time'], reverse=True),
            "groups": [BASE_MODEL_GROUP] + [
                project.name for project in db.query(Project).order_by(Project.name).all()
            ]
        })

    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail=f"获取模型列表失败: {str(e)}")


@router.get("/download/{model_name}")
async def download_model(model_name: str):
    """下载模型列表中的模型文件。"""
    if os.path.basename(model_name) != model_name or not model_name.lower().endswith('.pt'):
        raise HTTPException(status_code=400, detail="模型文件名无效")

    models_root = os.path.abspath(MODELS_DIR)
    file_path = os.path.abspath(os.path.join(models_root, model_name))
    if os.path.commonpath([models_root, file_path]) != models_root:
        raise HTTPException(status_code=400, detail="模型文件路径无效")
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="模型文件不存在")

    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=model_name
    )


@router.delete("/{model_name}")
async def delete_model(model_name: str, db: Session = Depends(get_db)):
    """删除模型文件"""
    try:
        file_path = os.path.join(MODELS_DIR, model_name)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="模型文件不存在")

        os.remove(file_path)
        record = db.query(ModelRecord).filter(ModelRecord.filename == model_name).first()
        if record:
            db.query(ProjectActiveModel).filter(
                ProjectActiveModel.model_id == record.id
            ).delete(synchronize_session=False)
            db.delete(record)
            db.commit()

        logger.info(f"Model deleted: {model_name}")

        return JSONResponse({
            "success": True,
            "message": "模型删除成功"
        })

    except Exception as e:
        logger.error(f"Failed to delete model: {e}")
        raise HTTPException(status_code=500, detail=f"删除模型失败: {str(e)}")


def prepare_training_dataset(project_name: str, output_dir: str, task_type: str = "segment", db: Session = None):
    """从项目的已标注数据中准备训练数据集，分为80%训练和20%验证

    Args:
        project_name: 项目名称
        output_dir: 输出目录
        task_type: 任务类型，"detect"使用labels_bbox目录，"segment"使用labels目录
        db: 数据库会话，用于查询项目标签
    """
    # 项目数据目录
    project_data_dir = os.path.join("data/annotated/success", project_name)

    if not os.path.exists(project_data_dir):
        return None, f"错误: 项目数据目录不存在: {project_data_dir}"

    # 从数据库获取项目标签体系
    if db is None:
        return None, "错误: 缺少数据库会话"

    project_obj = db.query(Project).filter(Project.name == project_name).first()
    if not project_obj:
        return None, f"错误: 项目不存在: {project_name}"

    if not project_obj.labels:
        return None, f"错误: 项目 '{project_name}' 没有配置标签体系"

    # 从数据库标签构建映射 {id: name}
    label_mapping = {}
    for label in project_obj.labels:
        label_id = label.get('id')
        label_name = label.get('name')
        if label_id is not None and label_name:
            label_mapping[label_id] = label_name

    if not label_mapping:
        return None, "错误: 标签体系为空或格式错误"

    # 根据任务类型选择标签目录
    # 分割模型使用 labels 目录，检测模型使用 labels_bbox 目录
    label_dir_name = 'labels_bbox' if task_type == 'detect' else 'labels'

    # 收集所有已标注的图片和标注文件
    all_images = []
    for task_dir in os.listdir(project_data_dir):
        task_path = os.path.join(project_data_dir, task_dir)
        if os.path.isdir(task_path) and task_dir not in ['labels.txt', 'dataset_info.json']:
            images_dir = os.path.join(task_path, 'images')
            labels_dir = os.path.join(task_path, label_dir_name)

            if os.path.exists(images_dir) and os.path.exists(labels_dir):
                for img_file in os.listdir(images_dir):
                    if img_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                        img_path = os.path.join(images_dir, img_file)
                        label_file = os.path.splitext(img_file)[0] + '.txt'
                        label_path = os.path.join(labels_dir, label_file)

                        if os.path.exists(label_path):
                            all_images.append((img_path, label_path))

    if not all_images:
        return None, "错误: 没有找到已标注的数据"

    # 随机打乱数据
    random.shuffle(all_images)

    # 分割为80%训练和20%验证
    split_idx = int(len(all_images) * 0.8)
    train_data = all_images[:split_idx]
    val_data = all_images[split_idx:]

    # 创建训练数据集目录结构
    dataset_dir = os.path.join(output_dir, 'dataset')
    train_images_dir = os.path.join(dataset_dir, 'images', 'train')
    train_labels_dir = os.path.join(dataset_dir, 'labels', 'train')
    val_images_dir = os.path.join(dataset_dir, 'images', 'val')
    val_labels_dir = os.path.join(dataset_dir, 'labels', 'val')

    for d in [train_images_dir, train_labels_dir, val_images_dir, val_labels_dir]:
        os.makedirs(d, exist_ok=True)

    # 复制训练数据
    for img_path, label_path in train_data:
        img_name = os.path.basename(img_path)
        label_name = os.path.basename(label_path)
        shutil.copy2(img_path, os.path.join(train_images_dir, img_name))
        shutil.copy2(label_path, os.path.join(train_labels_dir, label_name))

    # 复制验证数据
    for img_path, label_path in val_data:
        img_name = os.path.basename(img_path)
        label_name = os.path.basename(label_path)
        shutil.copy2(img_path, os.path.join(val_images_dir, img_name))
        shutil.copy2(label_path, os.path.join(val_labels_dir, label_name))

    # 在dataset目录下生成labels.txt
    labels_txt_path = os.path.join(dataset_dir, 'labels.txt')
    with open(labels_txt_path, 'w', encoding='utf-8') as f:
        for label_id in sorted(label_mapping.keys()):
            f.write(f"{label_id} {label_mapping[label_id]}\n")

    # 创建dataset.yaml
    # 使用label_mapping保持原始ID，不用enumerate重新索引
    yaml_data = {
        'path': os.path.abspath(dataset_dir),
        'train': 'images/train',
        'val': 'images/val',
        'names': label_mapping  # 直接使用 {id: name} 映射
    }

    yaml_path = os.path.join(dataset_dir, 'dataset.yaml')
    with open(yaml_path, 'w', encoding='utf-8') as f:
        yaml.dump(yaml_data, f, allow_unicode=True)

    return yaml_path, f"数据集准备完成: 训练{len(train_data)}个, 验证{len(val_data)}个"


def run_training(config: TrainConfig, training_device: str, training_device_label: str):
    """后台运行训练任务

    Args:
        config: 训练配置
        training_device: 传给 YOLO 的设备参数
        training_device_label: 用于页面日志显示的设备名称
    """
    from app.core.database import SessionLocal

    global training_status, training_process

    # 在后台任务中创建独立的数据库会话
    db = SessionLocal()

    try:
        # 训练输出目录（使用绝对路径）
        output_dir = os.path.join(TRAIN_DIR, f"{config.project_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        output_dir = os.path.abspath(output_dir)  # 转换为绝对路径
        os.makedirs(output_dir, exist_ok=True)
        project = db.query(Project).filter(Project.name == config.project_name).first()
        training_run = db.query(TrainingRun).filter(TrainingRun.output_dir == output_dir).first()
        if training_run is None:
            training_run = TrainingRun(output_dir=output_dir, project_name=config.project_name)
            db.add(training_run)
        training_run.project_id = project.id if project else None
        training_run.project_name = config.project_name
        training_run.base_model = config.base_model
        db.commit()

        # 自动准备训练数据集（根据任务类型选择不同的标签目录）
        training_status["log"].append(f"正在准备训练数据集（任务类型: {config.task_type}）...")
        data_yaml_path, message = prepare_training_dataset(config.project_name, output_dir, config.task_type, db)
        training_status["log"].append(message)

        if data_yaml_path is None:
            return

        if training_stop_event.is_set():
            training_status["log"].append("训练已在数据准备完成后停止")
            return

        # 准备模型路径（使用绝对路径）
        model_path = os.path.join(MODELS_DIR, config.base_model)
        if not os.path.exists(model_path):
            training_status["log"].append(f"错误: 模型文件不存在: {config.base_model}")
            training_status["is_training"] = False
            return

        # 转换为绝对路径，确保YOLO能正确找到模型
        model_abs_path = os.path.abspath(model_path)
        training_status["log"].append(f"模型路径: {model_abs_path}")
        training_status["log"].append(f"训练输出目录: {output_dir}")
        training_status["log"].append(f"训练设备: {training_device_label}")

        # 构建训练命令（根据任务类型选择detect或segment）
        task_command = config.task_type if config.task_type in ["detect", "segment"] else "segment"
        cmd = [
            "yolo", task_command, "train",
            f"model={model_abs_path}",
            f"data={data_yaml_path}",
            f"epochs={config.epochs}",
            f"batch={config.batch}",
            f"lr0={config.lr}",
            f"imgsz={config.imgsz}",
            f"project={output_dir}",
            f"device={training_device}",
            "name=train",
            "amp=False",  # 禁用AMP检查，避免下载测试模型
            "workers=2"  # 使用2个DataLoader进程，平衡性能和资源占用
        ]

        training_status["log"].append(f"开始训练: {' '.join(cmd)}")

        popen_kwargs = {
            "stdout": subprocess.PIPE,
            "stderr": subprocess.STDOUT,
            "universal_newlines": True
        }
        if os.name == "nt":
            # 独立进程组便于连同 YOLO 的 DataLoader 子进程一起停止。
            popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            popen_kwargs["start_new_session"] = True

        process = subprocess.Popen(cmd, **popen_kwargs)
        with training_process_lock:
            training_process = process

        # 停止请求可能恰好发生在创建进程之前。
        if training_stop_event.is_set():
            terminate_training_process(process)

        # 读取训练输出
        for line in process.stdout:
            line = line.strip()
            if line:
                training_status["log"].append(line)
                # 尝试解析epoch进度
                if "Epoch" in line:
                    try:
                        parts = line.split()
                        for i, part in enumerate(parts):
                            if part == "Epoch" and i + 1 < len(parts):
                                epoch_info = parts[i + 1].split('/')
                                if len(epoch_info) == 2:
                                    training_status["current_epoch"] = int(epoch_info[0])
                                    training_status["progress"] = int(
                                        (training_status["current_epoch"] / training_status["total_epochs"]) * 100
                                    )
                    except:
                        pass

        process.wait()

        if training_stop_event.is_set():
            training_status["log"].append("训练已停止")
        elif process.returncode == 0:
            training_status["log"].append("训练完成！")
            training_status["progress"] = 100
        else:
            training_status["log"].append(f"训练失败，返回码: {process.returncode}")
            logger.error(f"Training failed with return code: {process.returncode}")

    except Exception as e:
        logger.error(f"Training error: {e}")
        training_status["log"].append(f"训练错误: {str(e)}")

    finally:
        with training_process_lock:
            if training_process is locals().get("process"):
                training_process = None
        training_status["is_training"] = False
        db.close()  # 关闭数据库会话


def terminate_training_process(process):
    """终止训练主进程及其创建的所有子进程。"""
    if process is None or process.poll() is not None:
        return

    try:
        if os.name == "nt":
            # terminate() 只会结束 yolo 主进程，taskkill /T 才会处理 workers 子进程。
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
                check=False
            )
        else:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)

        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                process.kill()
            else:
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            process.wait(timeout=5)
    except (ProcessLookupError, OSError, subprocess.SubprocessError) as exc:
        logger.warning(f"Failed to terminate training process tree cleanly: {exc}")
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)


@router.post("/train")
async def start_training(config: TrainConfig, background_tasks: BackgroundTasks):
    """开始训练模型"""
    global training_status

    if training_status["is_training"]:
        raise HTTPException(status_code=400, detail="当前已有训练任务在进行中")

    try:
        training_device, training_device_label = resolve_training_device()
    except RuntimeError as exc:
        logger.error(f"Training device validation failed: {exc}")
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        # 在加入后台队列前立即占用训练状态，避免重复启动以及停止请求竞态。
        training_stop_event.clear()
        training_status["is_training"] = True
        training_status["current_epoch"] = 0
        training_status["total_epochs"] = config.epochs
        training_status["progress"] = 0
        training_status["log"] = []

        # 在后台启动训练（会话在后台任务中创建）
        background_tasks.add_task(
            run_training, config, training_device, training_device_label
        )

        return JSONResponse({
            "success": True,
            "message": "训练任务已启动"
        })

    except Exception as e:
        training_status["is_training"] = False
        logger.error(f"Failed to start training: {e}")
        raise HTTPException(status_code=500, detail=f"启动训练失败: {str(e)}")


@router.get("/train/status")
async def get_training_status():
    """获取训练状态"""
    return JSONResponse({
        "success": True,
        "status": training_status
    })


@router.post("/train/stop")
def stop_training():
    """停止训练任务"""
    global training_status

    if not training_status["is_training"]:
        raise HTTPException(status_code=400, detail="当前没有训练任务在进行中")

    training_status["log"].append("用户请求停止训练")
    training_stop_event.set()

    with training_process_lock:
        process = training_process

    if process is not None:
        terminate_training_process(process)

    # is_training 由后台任务的 finally 在真正退出后清除，避免停止与重新启动
    # 紧邻发生时，旧任务读取到被新任务清除的 stop_event 后继续运行。

    return JSONResponse({
        "success": True,
        "message": "训练已停止"
    })


@router.get("/train/history")
async def get_train_history(db: Session = Depends(get_db)):
    """获取训练历史记录"""
    try:
        history = []
        training_runs = {
            os.path.normcase(os.path.abspath(run.output_dir)): run
            for run in db.query(TrainingRun).all()
        }

        if os.path.exists(TRAIN_DIR):
            for dir_name in os.listdir(TRAIN_DIR):
                dir_path = os.path.join(TRAIN_DIR, dir_name)
                if os.path.isdir(dir_path):
                    project_name = dir_name.rsplit('_', 2)[0]
                    training_run = training_runs.get(os.path.normcase(os.path.abspath(dir_path)))
                    if training_run:
                        project_name = training_run.project_name

                    # 查找训练结果
                    train_path = os.path.join(dir_path, "train")
                    weights_path = os.path.join(train_path, "weights", "best.pt")
                    has_best_model = os.path.exists(weights_path)

                    if os.path.exists(train_path):
                        stat = os.stat(train_path)
                        history.append({
                            "name": dir_name,
                            "time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            "size": os.path.getsize(weights_path) if has_best_model else 0,
                            "path": weights_path if has_best_model else "",
                            "train_path": train_path,
                            "project_name": project_name,
                            "has_best_model": has_best_model
                        })

        return JSONResponse({
            "success": True,
            "history": sorted(history, key=lambda x: x['time'], reverse=True)
        })

    except Exception as e:
        logger.error(f"Failed to get training history: {e}")
        raise HTTPException(status_code=500, detail=f"获取训练历史失败: {str(e)}")


@router.get("/train/download/{train_dir}")
async def download_trained_model(train_dir: str):
    """下载已完成训练任务生成的 best.pt。"""
    if os.path.basename(train_dir) != train_dir:
        raise HTTPException(status_code=400, detail="训练记录名称无效")

    training_root = os.path.abspath(TRAIN_DIR)
    weights_path = os.path.abspath(
        os.path.join(training_root, train_dir, "train", "weights", "best.pt")
    )
    if os.path.commonpath([training_root, weights_path]) != training_root:
        raise HTTPException(status_code=400, detail="训练模型路径无效")
    if not os.path.isfile(weights_path):
        raise HTTPException(status_code=404, detail="训练模型尚未生成")

    return FileResponse(
        weights_path,
        media_type="application/octet-stream",
        filename=f"{train_dir}_best.pt"
    )


@router.post("/set_active")
async def set_active_model(
        model_name: str = Form(...),
        db: Session = Depends(get_db)
):
    """设置应用到自动标注的模型"""
    try:
        model_path = os.path.join(MODELS_DIR, model_name)

        if not os.path.exists(model_path):
            raise HTTPException(status_code=404, detail="模型文件不存在")

        model_record = db.query(ModelRecord).filter(ModelRecord.filename == model_name).first()
        if not model_record:
            model_record = upsert_model_record(
                db, model_name, file_size=os.path.getsize(model_path)
            )

        if not model_record.project_id:
            raise HTTPException(status_code=400, detail="基础模型不能应用到自动标注")

        project = db.query(Project).filter(Project.id == model_record.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="模型所属项目不存在")

        application = db.query(ProjectActiveModel).filter(
            ProjectActiveModel.project_id == project.id
        ).first()
        if application is None:
            application = ProjectActiveModel(
                project_id=project.id,
                model_id=model_record.id
            )
            db.add(application)
        else:
            application.model_id = model_record.id
        db.commit()

        logger.info(f"Active model for project '{project.name}' set to: {model_name}")

        return JSONResponse({
            "success": True,
            "message": f"已将模型 {model_name} 应用到项目 {project.name}",
            "project_name": project.name,
            "active_model": model_name
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set active model: {e}")
        raise HTTPException(status_code=500, detail=f"设置应用模型失败: {str(e)}")


@router.get("/active")
async def get_active_model(
        project_name: Optional[str] = None,
        db: Session = Depends(get_db)
):
    """获取当前应用的模型"""
    applications = db.query(ProjectActiveModel).join(
        Project, ProjectActiveModel.project_id == Project.id
    ).join(
        ModelRecord, ProjectActiveModel.model_id == ModelRecord.id
    ).all()
    active_models = {
        item.project_rel.name: item.model_rel.filename
        for item in applications
        if item.project_rel and item.model_rel
    }

    return JSONResponse({
        "success": True,
        "project_name": project_name,
        "active_model": active_models.get(project_name) if project_name else None,
        "active_models": active_models
    })


@router.post("/auto_annotate")
async def auto_annotate(request: AutoAnnotateRequest, db: Session = Depends(get_db)):
    """使用应用的模型进行自动标注（通过标签名匹配）"""
    try:
        # 获取项目标签体系
        project_name = request.project_name
        if not project_name:
            raise HTTPException(status_code=400, detail="缺少项目名称")

        project_obj = db.query(Project).filter(Project.name == project_name).first()
        if not project_obj:
            raise HTTPException(status_code=404, detail=f"项目不存在: {project_name}")

        application = db.query(ProjectActiveModel).filter(
            ProjectActiveModel.project_id == project_obj.id
        ).first()
        if not application or not application.model_rel:
            raise HTTPException(
                status_code=400,
                detail=f"项目 '{project_name}' 还未应用自动标注模型"
            )

        active_model = application.model_rel.filename
        model_path = os.path.join(MODELS_DIR, active_model)
        if not os.path.exists(model_path):
            raise HTTPException(status_code=404, detail="项目应用的模型文件不存在")

        project_labels = project_obj.labels or []
        if not project_labels:
            raise HTTPException(status_code=400, detail=f"项目 '{project_name}' 没有配置标签")

        # 构建项目标签名称到ID的映射 {label_name: label_id}
        # 统一转换为字符串进行匹配
        project_label_name_to_id = {str(label['name']): label['id'] for label in project_labels}
        logger.info(f"Project '{project_name}' labels: {project_label_name_to_id}")

        # 解析图片路径 - 处理从API返回的URL路径
        # 可能的格式：
        # 1. /static/temp/frame_xxx.jpg (临时文件)
        # 2. /data/videos/test/video1/extracted/frame_0000.jpg (抽帧文件)
        # 3. /static/extracted/... (其他静态文件)
        image_path = request.image_path

        # 根据不同的路径前缀处理
        if image_path.startswith('/static/'):
            # 移除 /static/ 前缀，得到相对于static目录的路径
            relative_path = image_path[8:]  # 移除 '/static/'
            actual_image_path = os.path.join('static', relative_path)
        elif image_path.startswith('/data/videos/'):
            # 移除 /data/videos/ 前缀，得到相对于VIDEO_DIR的路径
            relative_path = image_path[13:]  # 移除 '/data/videos/'
            actual_image_path = os.path.join('data', 'videos', relative_path)
        elif image_path.startswith('/api/videos/frame'):
            # 如果是API路径，无法直接处理，需要返回错误
            raise HTTPException(status_code=400, detail="无法处理API路径，请使用静态文件路径")
        else:
            # 假设是相对路径
            actual_image_path = image_path.lstrip('/')

        # 验证图片文件存在
        if not os.path.exists(actual_image_path):
            logger.error(f"Image file not found: {actual_image_path} (original: {image_path})")
            raise HTTPException(status_code=404, detail=f"图片文件不存在: {actual_image_path}")

        # 使用YOLO模型进行推理
        try:
            from ultralytics import YOLO
            model = YOLO(model_path)

            # 获取模型的类别名称映射 {class_id: class_name}
            model_names = model.names  # YOLO模型的names属性
            logger.info(f"Model '{active_model}' classes: {model_names}")
            logger.info(f"Auto annotating: {actual_image_path} with model: {active_model}")

            # 执行推理
            results = model.predict(
                source=actual_image_path,
                conf=0.25,  # 置信度阈值
                iou=0.45,  # NMS IOU阈值
                verbose=False
            )

            # 解析结果
            annotations = []
            model_type = "detection"  # 默认检测模型

            if results and len(results) > 0:
                result = results[0]

                # 获取图像尺寸
                img_height, img_width = result.orig_shape

                # 检查是否有分割掩码（分割模型）
                if hasattr(result, 'masks') and result.masks is not None:
                    # 分割模型：返回多边形和边界框
                    model_type = "segmentation"
                    masks = result.masks.xy  # 获取多边形坐标
                    classes = result.boxes.cls.cpu().numpy()
                    confidences = result.boxes.conf.cpu().numpy()
                    boxes_xyxy = result.boxes.xyxy.cpu().numpy()  # 获取边界框

                    for i, (mask, cls, conf, box) in enumerate(zip(masks, classes, confidences, boxes_xyxy)):
                        # 通过标签名匹配获取项目标签ID
                        model_class_id = int(cls)
                        model_class_name = model_names.get(model_class_id, None)

                        if model_class_name is None:
                            logger.warning(f"Model class {model_class_id} not found in model.names")
                            continue

                        # 统一转换为字符串进行精确匹配
                        model_class_name_str = str(model_class_name)

                        # 在项目标签中查找匹配的名称
                        project_label_id = project_label_name_to_id.get(model_class_name_str, None)
                        if project_label_id is None:
                            logger.warning(
                                f"Model class '{model_class_name_str}' not found in project labels, skipping")
                            continue

                        # 将坐标转换为相对坐标（0-1之间）
                        points = []
                        for point in mask:
                            x, y = point
                            points.append({
                                "x": float(x / img_width),
                                "y": float(y / img_height)
                            })

                        # 计算边界框（归一化）
                        x1, y1, x2, y2 = box
                        bbox = {
                            "x1": float(x1 / img_width),
                            "y1": float(y1 / img_height),
                            "x2": float(x2 / img_width),
                            "y2": float(y2 / img_height)
                        }

                        annotations.append({
                            "id": i,
                            "label_id": project_label_id,  # 使用项目标签ID
                            "label_name": model_class_name_str,  # 添加标签名便于调试
                            "points": points,  # 多边形点
                            "bbox": bbox,  # 边界框
                            "confidence": float(conf),
                            "type": "segmentation"
                        })
                else:
                    # 检测模型：只返回边界框
                    model_type = "detection"
                    classes = result.boxes.cls.cpu().numpy()
                    confidences = result.boxes.conf.cpu().numpy()
                    boxes_xyxy = result.boxes.xyxy.cpu().numpy()

                    for i, (cls, conf, box) in enumerate(zip(classes, confidences, boxes_xyxy)):
                        # 通过标签名匹配获取项目标签ID
                        model_class_id = int(cls)
                        model_class_name = model_names.get(model_class_id, None)

                        if model_class_name is None:
                            logger.warning(f"Model class {model_class_id} not found in model.names")
                            continue

                        # 统一转换为字符串进行精确匹配
                        model_class_name_str = str(model_class_name)

                        # 在项目标签中查找匹配的名称
                        project_label_id = project_label_name_to_id.get(model_class_name_str, None)
                        if project_label_id is None:
                            logger.warning(
                                f"Model class '{model_class_name_str}' not found in project labels, skipping")
                            continue

                        # 边界框坐标（归一化）
                        x1, y1, x2, y2 = box
                        bbox = {
                            "x1": float(x1 / img_width),
                            "y1": float(y1 / img_height),
                            "x2": float(x2 / img_width),
                            "y2": float(y2 / img_height)
                        }

                        # 为检测模型生成矩形框的多边形点（用于保存分割标注文件）
                        points = [
                            {"x": bbox["x1"], "y": bbox["y1"]},  # 左上
                            {"x": bbox["x2"], "y": bbox["y1"]},  # 右上
                            {"x": bbox["x2"], "y": bbox["y2"]},  # 右下
                            {"x": bbox["x1"], "y": bbox["y2"]}  # 左下
                        ]

                        annotations.append({
                            "id": i,
                            "label_id": project_label_id,  # 使用项目标签ID
                            "label_name": model_class_name_str,  # 添加标签名便于调试
                            "points": points,  # 矩形框的4个角点
                            "bbox": bbox,  # 边界框
                            "confidence": float(conf),
                            "type": "detection"
                        })

            return JSONResponse({
                "success": True,
                "annotations": annotations,
                "model_used": active_model,
                "model_type": model_type
            })

        except ImportError:
            raise HTTPException(status_code=500, detail="Ultralytics YOLO库未安装")
        except Exception as e:
            logger.error(f"Model prediction error: {e}")
            raise HTTPException(status_code=500, detail=f"模型推理失败: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auto annotation failed: {e}")
        raise HTTPException(status_code=500, detail=f"自动标注失败: {str(e)}")


@router.post("/train/save-model")
async def save_trained_model(train_path: str = Form(...), db: Session = Depends(get_db)):
    """从训练结果中保存best.pt到模型列表"""
    try:
        # 找到best.pt
        best_model_path = os.path.join(train_path, 'weights', 'best.pt')
        if not os.path.exists(best_model_path):
            raise HTTPException(status_code=404, detail="找不到best.pt模型文件")

        # 生成新模型名称
        train_name = os.path.basename(os.path.dirname(train_path))
        project_name = train_name.rsplit('_', 2)[0]
        output_dir = os.path.abspath(os.path.dirname(train_path))
        training_run = db.query(TrainingRun).filter(TrainingRun.output_dir == output_dir).first()
        if training_run:
            project_name = training_run.project_name
        project = db.query(Project).filter(Project.name == project_name).first()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        new_model_name = f"trained_{train_name}_{timestamp}.pt"
        new_model_path = os.path.join(MODELS_DIR, new_model_name)

        # 复制模型文件
        shutil.copy2(best_model_path, new_model_path)
        upsert_model_record(
            db, new_model_name, project=project, source_type='trained',
            display_name=f"trained_{train_name}", original_name='best.pt',
            file_size=os.path.getsize(new_model_path)
        )

        logger.info(f"Trained model saved: {new_model_name}")

        return JSONResponse({
            "success": True,
            "message": f"模型已保存: {new_model_name}",
            "model_name": new_model_name,
            "group": project_name
        })

    except Exception as e:
        logger.error(f"Failed to save trained model: {e}")
        raise HTTPException(status_code=500, detail=f"保存模型失败: {str(e)}")


@router.get("/train/results")
async def get_training_results(train_path: str):
    """获取训练结果图片列表"""
    try:
        if not os.path.exists(train_path):
            raise HTTPException(status_code=404, detail="训练目录不存在")

        # 查找所有图片文件
        # train_path格式: /app/data/training/动物识别_20260416_072717/train
        # 需要获取父目录名: 动物识别_20260416_072717
        train_dir_name = os.path.basename(os.path.dirname(train_path))

        image_files = []
        for file in os.listdir(train_path):
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_files.append({
                    "name": file,
                    "url": f"/api/models/file/{train_dir_name}/{file}"
                })

        # 按文件名排序
        image_files.sort(key=lambda x: x['name'])

        return JSONResponse({
            "success": True,
            "images": image_files,
            "train_path": train_path
        })

    except Exception as e:
        logger.error(f"Failed to get training results: {e}")
        raise HTTPException(status_code=500, detail=f"获取训练结果失败: {str(e)}")


@router.get("/file/{train_dir}/{filename}")
async def get_training_file(train_dir: str, filename: str):
    """获取训练结果文件（图片等）"""
    try:
        # 构建文件路径
        file_path = os.path.join(TRAIN_DIR, train_dir, "train", filename)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件不存在")

        return FileResponse(file_path)

    except Exception as e:
        logger.error(f"Failed to get training file: {e}")
        raise HTTPException(status_code=500, detail=f"获取文件失败: {str(e)}")


# ====== LocateAnything 自动标注功能 ======

def find_label_id_by_name(label_name: str, project_labels: list) -> Optional[int]:
    """
    通过标签名称查找对应的标签 ID
    
    由于 LocateAnything 的输入就是项目标签名称列表，
    理论上返回的标签也应该在这个列表中，只需直接查找即可。
    
    Args:
        label_name: 标签名称
        project_labels: 项目标签列表 [{"id": 0, "name": "person", ...}, ...]
    
    Returns:
        标签ID，如果未找到则返回 None
    """
    label_name_lower = label_name.lower().strip()
    
    # 精确匹配（不区分大小写）
    for label in project_labels:
        if label['name'].lower().strip() == label_name_lower:
            return label['id']
    
    # 如果未找到，说明 LocateAnything 返回了我们未输入的标签（理论上不应该发生）
    logger.warning(f"Label '{label_name}' not found in project labels. This should not happen.")
    return None


@router.post("/auto_annotate_locate")
async def auto_annotate_locate(request: AutoAnnotateRequest, db: Session = Depends(get_db)):
    """
    使用 LocateAnything 模型进行自动标注
    
    LocateAnything 是多模态视觉定位模型，直接接受标签名称作为输入提示，
    无需预训练，适合开放域和长尾类别检测。
    
    工作流程：
    1. 从项目标签体系获取所有标签名称
    2. 将标签名称作为提示词输入 LocateAnything
    3. 解析模型输出的边界框和标签
    4. 将结果转换为平台标注格式
    """
    try:
        # 验证请求参数
        if not request.image_path:
            raise HTTPException(status_code=400, detail="缺少图片路径")
        
        if not request.project_name:
            raise HTTPException(status_code=400, detail="缺少项目名称")
        
        # 获取项目标签体系
        project_obj = db.query(Project).filter(Project.name == request.project_name).first()
        if not project_obj:
            raise HTTPException(status_code=404, detail=f"项目不存在: {request.project_name}")
        
        project_labels = project_obj.labels or []
        if not project_labels:
            raise HTTPException(status_code=400, detail=f"项目 '{request.project_name}' 没有配置标签")
        
        # 提取所有标签名称
        label_names = [label['name'] for label in project_labels if 'name' in label]
        if not label_names:
            raise HTTPException(status_code=400, detail="项目标签名称为空")
        
        logger.info(f"LocateAnything: Detecting objects with labels: {label_names}")
        
        # 解析图片路径
        image_path = request.image_path
        
        # 处理不同格式的路径
        if image_path.startswith('/static/'):
            relative_path = image_path[8:]
            actual_image_path = os.path.join('static', relative_path)
        elif image_path.startswith('/data/videos/'):
            relative_path = image_path[13:]
            actual_image_path = os.path.join('data', 'videos', relative_path)
        elif image_path.startswith('/api/videos/frame'):
            raise HTTPException(status_code=400, detail="无法处理API路径，请使用静态文件路径")
        else:
            actual_image_path = image_path.lstrip('/')
        
        # 验证图片文件存在
        if not os.path.exists(actual_image_path):
            logger.error(f"Image file not found: {actual_image_path} (original: {image_path})")
            raise HTTPException(status_code=404, detail=f"图片文件不存在: {actual_image_path}")
        
        # 加载图片
        try:
            image = Image.open(actual_image_path).convert("RGB")
            img_width, img_height = image.size
            logger.info(f"Image loaded: {actual_image_path}, size: {img_width}x{img_height}")
        except Exception as e:
            logger.error(f"Failed to load image: {e}")
            raise HTTPException(status_code=500, detail=f"无法加载图片: {str(e)}")
        
        # 获取 LocateAnything Worker
        try:
            worker = LocateAnythingModelManager.get_worker()
        except Exception as e:
            logger.error(f"Failed to load LocateAnything worker: {e}")
            raise HTTPException(status_code=503, detail=f"LocateAnything 模型加载失败: {str(e)}")
        
        # 执行检测
        try:
            result = worker.detect(image, label_names)
            detected_boxes = result.get("boxes", [])
            logger.info(f"LocateAnything detected {len(detected_boxes)} objects")
        except Exception as e:
            logger.error(f"LocateAnything detection failed: {e}")
            raise HTTPException(status_code=500, detail=f"LocateAnything 检测失败: {str(e)}")
        
        # 转换为平台标注格式
        annotations = []
        
        for i, box in enumerate(detected_boxes):
            # 查找标签对应的 ID
            # 因为输入给 LocateAnything 的就是项目标签名称，返回的标签理论上也在其中
            detected_label = box.get("label", "")
            project_label_id = find_label_id_by_name(detected_label, project_labels)
            
            if project_label_id is None:
                # 跳过未找到的标签（理论上不应该发生，可能是模型返回了额外的标签）
                logger.warning(f"Skipping label not in project: {detected_label}")
                continue
            
            # 归一化坐标
            x1_norm = box["x1"] / img_width
            y1_norm = box["y1"] / img_height
            x2_norm = box["x2"] / img_width
            y2_norm = box["y2"] / img_height
            
            # 生成矩形框的4个角点（用于兼容平台的多边形格式）
            points = [
                {"x": x1_norm, "y": y1_norm},  # 左上
                {"x": x2_norm, "y": y1_norm},  # 右上
                {"x": x2_norm, "y": y2_norm},  # 右下
                {"x": x1_norm, "y": y2_norm}   # 左下
            ]
            
            # 边界框
            bbox = {
                "x1": x1_norm,
                "y1": y1_norm,
                "x2": x2_norm,
                "y2": y2_norm
            }
            
            annotations.append({
                "id": i,
                "label_id": project_label_id,
                "label_name": detected_label,
                "points": points,
                "bbox": bbox,
                "confidence": 1.0,  # LocateAnything 不返回置信度
                "type": "detection"
            })
        
        return JSONResponse({
            "success": True,
            "annotations": annotations,
            "model_used": "LocateAnything-3B",
            "model_type": "detection",
            "total_detected": len(detected_boxes),
            "matched_count": len(annotations)
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LocateAnything auto annotation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"自动标注失败: {str(e)}")


@router.get("/locate/status")
async def get_locate_status():
    """获取 LocateAnything 模型状态（只读，不触发加载）"""
    worker = LocateAnythingModelManager._worker
    if worker is not None:
        return JSONResponse({
            "success": True,
            "status": "available",
            "model_name": worker.model_name,
            "device": worker.device
        })
    return JSONResponse({
        "success": True,
        "status": "unloaded"
    })


@router.post("/locate/unload")
async def unload_locate_model():
    """卸载 LocateAnything 模型以释放显存"""
    try:
        LocateAnythingModelManager.unload()
        
        return JSONResponse({
            "success": True,
            "message": "LocateAnything 模型已卸载"
        })
    except Exception as e:
        logger.error(f"Failed to unload LocateAnything model: {e}")
        raise HTTPException(status_code=500, detail=f"卸载模型失败: {str(e)}")

