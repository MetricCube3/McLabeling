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
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Depends
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/models", tags=["models"])

# 模型存储路径
MODELS_DIR = "data/models"
TRAIN_DIR = "data/training"
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

# 全局变量：当前应用的模型
active_model = None

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
    model_name: str = Form(...)
):
    """上传YOLO模型文件"""
    try:
        # 验证文件类型
        if not file.filename.endswith('.pt'):
            raise HTTPException(status_code=400, detail="只支持.pt格式的模型文件")
        
        # 创建安全的文件名
        safe_name = f"{model_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pt"
        file_path = os.path.join(MODELS_DIR, safe_name)
        
        # 保存文件
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = os.path.getsize(file_path)
        
        logger.info(f"Model uploaded: {safe_name}, size: {file_size} bytes")
        
        return JSONResponse({
            "success": True,
            "message": "模型上传成功",
            "model": {
                "name": safe_name,
                "original_name": file.filename,
                "size": file_size,
                "upload_time": datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to upload model: {e}")
        raise HTTPException(status_code=500, detail=f"模型上传失败: {str(e)}")


@router.get("/list")
async def list_models():
    """获取已上传的模型列表"""
    try:
        models = []
        if os.path.exists(MODELS_DIR):
            for filename in os.listdir(MODELS_DIR):
                if filename.endswith('.pt'):
                    file_path = os.path.join(MODELS_DIR, filename)
                    file_stat = os.stat(file_path)
                    models.append({
                        "name": filename,
                        "size": file_stat.st_size,
                        "modified_time": datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                    })
        
        return JSONResponse({
            "success": True,
            "models": sorted(models, key=lambda x: x['modified_time'], reverse=True)
        })
        
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail=f"获取模型列表失败: {str(e)}")


@router.delete("/{model_name}")
async def delete_model(model_name: str):
    """删除模型文件"""
    try:
        file_path = os.path.join(MODELS_DIR, model_name)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="模型文件不存在")
        
        os.remove(file_path)
        
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


def run_training(config: TrainConfig):
    """后台运行训练任务
    
    Args:
        config: 训练配置
    """
    from database import SessionLocal
    
    global training_status
    
    # 在后台任务中创建独立的数据库会话
    db = SessionLocal()
    
    try:
        training_status["is_training"] = True
        training_status["current_epoch"] = 0
        training_status["total_epochs"] = config.epochs
        training_status["progress"] = 0
        training_status["log"] = []
        
        # 训练输出目录（使用绝对路径）
        output_dir = os.path.join(TRAIN_DIR, f"{config.project_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        output_dir = os.path.abspath(output_dir)  # 转换为绝对路径
        os.makedirs(output_dir, exist_ok=True)
        
        # 自动准备训练数据集（根据任务类型选择不同的标签目录）
        training_status["log"].append(f"正在准备训练数据集（任务类型: {config.task_type}）...")
        data_yaml_path, message = prepare_training_dataset(config.project_name, output_dir, config.task_type, db)
        training_status["log"].append(message)
        
        if data_yaml_path is None:
            training_status["is_training"] = False
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
            "name=train",
            "amp=False",  # 禁用AMP检查，避免下载测试模型
            "workers=2"  # 使用2个DataLoader进程，平衡性能和资源占用
        ]
        
        training_status["log"].append(f"开始训练: {' '.join(cmd)}")

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True
        )
        
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
        
        if process.returncode == 0:
            training_status["log"].append("训练完成！")
            training_status["progress"] = 100
        else:
            training_status["log"].append(f"训练失败，返回码: {process.returncode}")
            logger.error(f"Training failed with return code: {process.returncode}")
        
    except Exception as e:
        logger.error(f"Training error: {e}")
        training_status["log"].append(f"训练错误: {str(e)}")
    
    finally:
        training_status["is_training"] = False
        db.close()  # 关闭数据库会话


@router.post("/train")
async def start_training(config: TrainConfig, background_tasks: BackgroundTasks):
    """开始训练模型"""
    global training_status
    
    if training_status["is_training"]:
        raise HTTPException(status_code=400, detail="当前已有训练任务在进行中")
    
    try:
        # 在后台启动训练（会话在后台任务中创建）
        background_tasks.add_task(run_training, config)
        
        return JSONResponse({
            "success": True,
            "message": "训练任务已启动"
        })
        
    except Exception as e:
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
async def stop_training():
    """停止训练任务"""
    global training_status
    
    if not training_status["is_training"]:
        raise HTTPException(status_code=400, detail="当前没有训练任务在进行中")

    training_status["log"].append("用户请求停止训练")
    training_status["is_training"] = False
    
    return JSONResponse({
        "success": True,
        "message": "训练已停止"
    })


@router.get("/train/history")
async def get_train_history():
    """获取训练历史记录"""
    try:
        history = []
        
        if os.path.exists(TRAIN_DIR):
            for dir_name in os.listdir(TRAIN_DIR):
                dir_path = os.path.join(TRAIN_DIR, dir_name)
                if os.path.isdir(dir_path):
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
                            "has_best_model": has_best_model
                        })
        
        return JSONResponse({
            "success": True,
            "history": sorted(history, key=lambda x: x['time'], reverse=True)
        })
        
    except Exception as e:
        logger.error(f"Failed to get training history: {e}")
        raise HTTPException(status_code=500, detail=f"获取训练历史失败: {str(e)}")


@router.post("/set_active")
async def set_active_model(model_name: str = Form(...)):
    """设置应用到自动标注的模型"""
    global active_model
    
    try:
        model_path = os.path.join(MODELS_DIR, model_name)
        
        if not os.path.exists(model_path):
            raise HTTPException(status_code=404, detail="模型文件不存在")
        
        active_model = model_name
        logger.info(f"Active model set to: {model_name}")
        
        return JSONResponse({
            "success": True,
            "message": f"已应用模型: {model_name}",
            "active_model": active_model
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set active model: {e}")
        raise HTTPException(status_code=500, detail=f"设置应用模型失败: {str(e)}")


@router.get("/active")
async def get_active_model():
    """获取当前应用的模型"""
    return JSONResponse({
        "success": True,
        "active_model": active_model
    })


@router.post("/auto_annotate")
async def auto_annotate(request: AutoAnnotateRequest, db: Session = Depends(get_db)):
    """使用应用的模型进行自动标注（通过标签名匹配）"""
    global active_model
    
    try:
        if not active_model:
            raise HTTPException(status_code=400, detail="请先设置应用的模型")
        
        model_path = os.path.join(MODELS_DIR, active_model)
        if not os.path.exists(model_path):
            raise HTTPException(status_code=404, detail="应用的模型文件不存在")
        
        # 获取项目标签体系
        project_name = request.project_name
        if not project_name:
            raise HTTPException(status_code=400, detail="缺少项目名称")
        
        project_obj = db.query(Project).filter(Project.name == project_name).first()
        if not project_obj:
            raise HTTPException(status_code=404, detail=f"项目不存在: {project_name}")
        
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
                iou=0.45,   # NMS IOU阈值
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
                            logger.warning(f"Model class '{model_class_name_str}' not found in project labels, skipping")
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
                            "bbox": bbox,      # 边界框
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
                            logger.warning(f"Model class '{model_class_name_str}' not found in project labels, skipping")
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
                            {"x": bbox["x1"], "y": bbox["y2"]}   # 左下
                        ]
                        
                        annotations.append({
                            "id": i,
                            "label_id": project_label_id,  # 使用项目标签ID
                            "label_name": model_class_name_str,  # 添加标签名便于调试
                            "points": points,  # 矩形框的4个角点
                            "bbox": bbox,      # 边界框
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
async def save_trained_model(train_path: str = Form(...)):
    """从训练结果中保存best.pt到模型列表"""
    try:
        # 找到best.pt
        best_model_path = os.path.join(train_path, 'weights', 'best.pt')
        if not os.path.exists(best_model_path):
            raise HTTPException(status_code=404, detail="找不到best.pt模型文件")
        
        # 生成新模型名称
        train_name = os.path.basename(os.path.dirname(train_path))
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        new_model_name = f"trained_{train_name}_{timestamp}.pt"
        new_model_path = os.path.join(MODELS_DIR, new_model_name)
        
        # 复制模型文件
        shutil.copy2(best_model_path, new_model_path)
        
        logger.info(f"Trained model saved: {new_model_name}")
        
        return JSONResponse({
            "success": True,
            "message": f"模型已保存: {new_model_name}",
            "model_name": new_model_name
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
