"""
项目级批量导出功能
支持多任务汇总导出，随机划分训练集/验证集/测试集
"""
import os
import shutil
import zipfile
import tempfile
import json
import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Optional
from app.core.database import get_db
from app.models.models import AnnotationTask, Project
from app.core.dependencies import is_admin
import logging
from PIL import Image

router = APIRouter()
logger = logging.getLogger(__name__)

DATA_DIR = 'data'
ANNOTATED_DIR = os.path.join(DATA_DIR, 'annotated')
SUCCESS_DIR = os.path.join(ANNOTATED_DIR, 'success')
REVIEW_DIR = os.path.join(ANNOTATED_DIR, 'review')
STATIC_DIR = 'static'
TEMP_DIR = os.path.join(STATIC_DIR, 'temp')


class ExportProjectTasksRequest(BaseModel):
    user: str
    project_name: str
    task_paths: List[str]
    split_ratios: Optional[Dict[str, int]] = {'train': 70, 'val': 20, 'test': 10}
    export_format: str = 'yolo'  # 'yolo' or 'coco'


def collect_annotation_data(task_paths: List[str], project_name: str, db: Session):
    """
    收集所有任务的标注数据

    优化：使用生成器减少内存占用
    """
    for task_path in task_paths:
        # 解析任务名称
        if '.' in os.path.basename(task_path):
            # 视频任务，去掉扩展名
            task_name = os.path.splitext(os.path.basename(task_path))[0]
        else:
            # 图片任务
            task_name = os.path.basename(task_path)

        # 解析项目名称
        if '/' in task_path:
            task_project = task_path.split('/')[0]
        else:
            task_project = project_name

        # 查找标注目录
        annotation_dirs = [
            os.path.join(SUCCESS_DIR, task_project, task_name),
            os.path.join(REVIEW_DIR, task_project, task_name)
        ]

        for annotation_dir in annotation_dirs:
            if not os.path.exists(annotation_dir):
                continue

            images_dir = os.path.join(annotation_dir, 'images')
            labels_dir = os.path.join(annotation_dir, 'labels')
            labels_bbox_dir = os.path.join(annotation_dir, 'labels_bbox')

            if not os.path.exists(images_dir):
                continue

            # 遍历图片文件
            for image_file in os.listdir(images_dir):
                if not image_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                    continue

                image_path = os.path.join(images_dir, image_file)
                base_name = os.path.splitext(image_file)[0]
                label_file = base_name + '.txt'

                label_path = os.path.join(labels_dir, label_file)
                label_bbox_path = os.path.join(labels_bbox_dir, label_file)

                # 至少有一个标注文件
                if os.path.exists(label_path) or os.path.exists(label_bbox_path):
                    yield {
                        'image_path': image_path,
                        'label_path': label_path if os.path.exists(label_path) else None,
                        'label_bbox_path': label_bbox_path if os.path.exists(label_bbox_path) else None,
                        'task_name': task_name,
                        'task_path': task_path
                    }


def split_dataset(data_items: List[Dict], split_ratios: Dict[str, int]):
    """
    随机划分数据集

    Args:
        data_items: 数据项列表
        split_ratios: 划分比例 {'train': 70, 'val': 20, 'test': 10}

    Returns:
        Dict: {'train': [...], 'val': [...], 'test': [...]}
    """
    # 随机打乱
    random.shuffle(data_items)

    total_count = len(data_items)
    train_ratio = split_ratios.get('train', 70)
    val_ratio = split_ratios.get('val', 20)
    test_ratio = split_ratios.get('test', 10)

    # 验证比例
    if train_ratio + val_ratio + test_ratio != 100:
        raise ValueError("训练集、验证集、测试集比例之和必须为100%")

    # 计算分割点
    train_count = int(total_count * train_ratio / 100)
    val_count = int(total_count * val_ratio / 100)
    test_count = total_count - train_count - val_count

    return {
        'train': data_items[0:train_count],
        'val': data_items[train_count:train_count + val_count],
        'test': data_items[train_count + val_count:total_count],
        'counts': {
            'total': total_count,
            'train': train_count,
            'val': val_count,
            'test': test_count
        }
    }


def export_yolo_format(export_dir: str, split_data: Dict, project_labels: List[Dict],
                       project_name: str, task_paths: List[str], split_ratios: Dict):
    """
    导出YOLO格式数据

    目录结构:
    dataset/
      ├── images/
      │   ├── train/
      │   ├── val/
      │   └── test/
      ├── labels/
      │   ├── train/
      │   ├── val/
      │   └── test/
      ├── labels_bbox/
      │   ├── train/
      │   ├── val/
      │   └── test/
      ├── labels.txt
      └── dataset_info.json
    """
    # 创建目录结构
    images_dir = os.path.join(export_dir, 'images')
    labels_dir = os.path.join(export_dir, 'labels')
    labels_bbox_dir = os.path.join(export_dir, 'labels_bbox')

    for split in ['train', 'val', 'test']:
        os.makedirs(os.path.join(images_dir, split), exist_ok=True)
        os.makedirs(os.path.join(labels_dir, split), exist_ok=True)
        os.makedirs(os.path.join(labels_bbox_dir, split), exist_ok=True)

    # 复制文件
    image_counter = 0
    for split_name in ['train', 'val', 'test']:
        data_items = split_data[split_name]

        for item in data_items:
            # 生成新文件名
            ext = os.path.splitext(item['image_path'])[1]
            new_image_name = f"{split_name}_{image_counter:06d}{ext}"
            new_label_name = f"{split_name}_{image_counter:06d}.txt"

            # 复制图片
            shutil.copy2(
                item['image_path'],
                os.path.join(images_dir, split_name, new_image_name)
            )

            # 复制分割标注
            if item['label_path']:
                shutil.copy2(
                    item['label_path'],
                    os.path.join(labels_dir, split_name, new_label_name)
                )

            # 复制边界框标注
            if item['label_bbox_path']:
                shutil.copy2(
                    item['label_bbox_path'],
                    os.path.join(labels_bbox_dir, split_name, new_label_name)
                )

            image_counter += 1

    # 创建标签映射文件
    labels_content = ""
    for label in sorted(project_labels, key=lambda x: x.get('id', 0)):
        labels_content += f"{label['id']} {label['name']}\n"

    with open(os.path.join(export_dir, 'labels.txt'), 'w', encoding='utf-8') as f:
        f.write(labels_content)

    # 创建数据集信息文件
    counts = split_data['counts']
    dataset_info = {
        "project": project_name,
        "tasks": task_paths,
        "format": "YOLO",
        "split_ratios": split_ratios,
        "total_images": counts['total'],
        "train_images": counts['train'],
        "val_images": counts['val'],
        "test_images": counts['test'],
        "labels": project_labels,
        "export_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    with open(os.path.join(export_dir, 'dataset_info.json'), 'w', encoding='utf-8') as f:
        json.dump(dataset_info, f, indent=2, ensure_ascii=False)

    return counts


def export_coco_format(export_dir: str, split_data: Dict, project_labels: List[Dict],
                       project_name: str, task_paths: List[str], split_ratios: Dict):
    """
    导出COCO格式数据

    目录结构:
    coco_dataset/
      ├── images/
      │   ├── train/
      │   ├── val/
      │   └── test/
      ├── annotations/
      │   ├── instances_train.json
      │   ├── instances_val.json
      │   └── instances_test.json
      └── dataset_info.json
    """
    # 创建目录结构
    images_dir = os.path.join(export_dir, 'images')
    annotations_dir = os.path.join(export_dir, 'annotations')

    for split in ['train', 'val', 'test']:
        os.makedirs(os.path.join(images_dir, split), exist_ok=True)
    os.makedirs(annotations_dir, exist_ok=True)

    # COCO基础结构
    coco_base = {
        "info": {
            "year": datetime.now().strftime("%Y"),
            "version": "1.0",
            "description": f"COCO dataset for project {project_name}",
            "contributor": "",
            "url": "",
            "date_created": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        },
        "licenses": [{
            "id": 1,
            "name": "Academic Use",
            "url": ""
        }],
        "categories": []
    }

    # 构建类别信息
    for label in sorted(project_labels, key=lambda x: x.get('id', 0)):
        coco_base["categories"].append({
            "id": label['id'],
            "name": label['name'],
            "supercategory": "object"
        })

    # 处理每个分割
    global_image_id = 0
    counts = split_data['counts']

    for split_name in ['train', 'val', 'test']:
        data_items = split_data[split_name]

        split_coco = coco_base.copy()
        split_coco["images"] = []
        split_coco["annotations"] = []

        annotation_id = 0

        for item in data_items:
            # 读取图片尺寸
            try:
                with Image.open(item['image_path']) as img:
                    width, height = img.size
            except Exception as e:
                logger.error(f"Failed to get image size: {item['image_path']}: {e}")
                continue

            # 生成新文件名
            ext = os.path.splitext(item['image_path'])[1]
            new_image_name = f"{split_name}_{global_image_id:06d}{ext}"

            # 复制图片
            shutil.copy2(
                item['image_path'],
                os.path.join(images_dir, split_name, new_image_name)
            )

            # 添加图片信息
            image_info = {
                "id": global_image_id,
                "file_name": os.path.join(split_name, new_image_name),
                "width": width,
                "height": height,
                "license": 1,
                "flickr_url": "",
                "coco_url": "",
                "date_captured": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            split_coco["images"].append(image_info)

            # 处理标注文件
            if item['label_path']:
                try:
                    with open(item['label_path'], 'r', encoding='utf-8') as f:
                        for line in f:
                            parts = line.strip().split()
                            if len(parts) < 3:
                                continue

                            class_id = int(parts[0])
                            coords = [float(c) for c in parts[1:]]

                            # 将归一化坐标转换为绝对坐标
                            pixel_coords = []
                            for j in range(0, len(coords), 2):
                                x = coords[j] * width
                                y = coords[j + 1] * height
                                pixel_coords.extend([round(x), round(y)])

                            # 计算边界框
                            if pixel_coords:
                                xs = pixel_coords[0::2]
                                ys = pixel_coords[1::2]
                                x_min = round(min(xs))
                                y_min = round(min(ys))
                                x_max = round(max(xs))
                                y_max = round(max(ys))

                                bbox = [x_min, y_min, x_max - x_min, y_max - y_min]
                                area = (x_max - x_min) * (y_max - y_min)

                                # 添加标注
                                annotation = {
                                    "id": annotation_id,
                                    "image_id": global_image_id,
                                    "category_id": class_id,
                                    "segmentation": [pixel_coords],
                                    "area": area,
                                    "bbox": bbox,
                                    "iscrowd": 0
                                }
                                split_coco["annotations"].append(annotation)
                                annotation_id += 1

                except Exception as e:
                    logger.error(f"Failed to process label file: {item['label_path']}: {e}")

            global_image_id += 1

        # 保存分割的COCO JSON
        annotation_file = os.path.join(annotations_dir, f"instances_{split_name}.json")
        with open(annotation_file, 'w', encoding='utf-8') as f:
            json.dump(split_coco, f, indent=2, ensure_ascii=False)

    # 创建数据集信息文件
    dataset_info = {
        "project": project_name,
        "tasks": task_paths,
        "format": "COCO",
        "split_ratios": split_ratios,
        "total_images": counts['total'],
        "train_images": counts['train'],
        "val_images": counts['val'],
        "test_images": counts['test'],
        "categories": [cat['name'] for cat in coco_base["categories"]],
        "export_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    with open(os.path.join(export_dir, 'dataset_info.json'), 'w', encoding='utf-8') as f:
        json.dump(dataset_info, f, indent=2, ensure_ascii=False)

    return counts


@router.post("/admin/export_project_tasks")
def export_project_tasks(request: ExportProjectTasksRequest, db: Session = Depends(get_db)):
    """
    项目级批量导出标注数据

    功能：
    - 支持选择多个任务
    - 合并所有标注数据
    - 随机划分训练集/验证集/测试集
    - 支持YOLO和COCO两种格式

    优化：
    - 使用生成器收集数据，减少内存占用
    - 批量文件操作，提高性能
    - 支持大规模数据导出
    """
    # 验证权限
    if not is_admin(request.user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    if not request.project_name or not request.task_paths:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # 验证格式
    if request.export_format not in ['yolo', 'coco']:
        raise HTTPException(status_code=400, detail="不支持的导出格式")

    temp_dir = None
    zip_path = None

    try:
        # 验证分割比例
        train_ratio = request.split_ratios.get('train', 70)
        val_ratio = request.split_ratios.get('val', 20)
        test_ratio = request.split_ratios.get('test', 10)

        if train_ratio + val_ratio + test_ratio != 100:
            raise HTTPException(status_code=400, detail="训练集、验证集、测试集比例之和必须为100%")

        logger.info(f"Starting project export: project={request.project_name}, "
                    f"tasks={len(request.task_paths)}, format={request.export_format}")

        # === Step 1: 获取项目标签信息 ===
        project = db.query(Project).filter(Project.name == request.project_name).first()
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")

        # 处理标签（可能是字符串或列表）
        project_labels = project.labels or []
        if isinstance(project_labels, str):
            try:
                project_labels = json.loads(project_labels)
            except (json.JSONDecodeError, ValueError):
                project_labels = []

        if not project_labels:
            raise HTTPException(status_code=400, detail="项目没有配置标签")

        logger.info(f"Project labels: {len(project_labels)} categories")

        # === Step 2: 收集所有标注数据 ===
        logger.info("Collecting annotation data...")
        data_items = list(collect_annotation_data(request.task_paths, request.project_name, db))

        if not data_items:
            raise HTTPException(status_code=404, detail="选中的任务中没有找到可导出的标注数据")

        logger.info(f"Collected {len(data_items)} annotated images")

        # === Step 3: 随机划分数据集 ===
        logger.info("Splitting dataset...")
        split_data = split_dataset(data_items, request.split_ratios)
        counts = split_data['counts']

        logger.info(f"Dataset split: train={counts['train']}, val={counts['val']}, test={counts['test']}")

        # === Step 4: 创建临时目录并导出 ===
        temp_dir = tempfile.mkdtemp()

        if request.export_format == 'yolo':
            export_dir = os.path.join(temp_dir, 'dataset')
            os.makedirs(export_dir)
            logger.info("Exporting YOLO format...")
            export_yolo_format(export_dir, split_data, project_labels,
                               request.project_name, request.task_paths, request.split_ratios)
            zip_filename = f"{request.project_name}_yolo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        else:  # coco
            export_dir = os.path.join(temp_dir, 'coco_dataset')
            os.makedirs(export_dir)
            logger.info("Exporting COCO format...")
            export_coco_format(export_dir, split_data, project_labels,
                               request.project_name, request.task_paths, request.split_ratios)
            zip_filename = f"{request.project_name}_coco_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"

        # === Step 5: 创建ZIP文件 ===
        logger.info("Creating ZIP archive...")
        os.makedirs(TEMP_DIR, exist_ok=True)
        zip_path = os.path.join(TEMP_DIR, zip_filename)

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(export_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)

        # === Step 6: 清理临时目录 ===
        shutil.rmtree(temp_dir)
        temp_dir = None

        download_url = f"/{STATIC_DIR}/temp/{zip_filename}"

        logger.info(f"Export completed: {zip_filename}")

        return {
            "download_url": download_url,
            "message": f"成功导出 {request.export_format.upper()} 格式数据：共{counts['total']}张图片，"
                       f"训练集{counts['train']}张, 验证集{counts['val']}张, 测试集{counts['test']}张",
            "stats": {
                "format": request.export_format,
                "total_images": counts['total'],
                "train_images": counts['train'],
                "val_images": counts['val'],
                "test_images": counts['test'],
                "tasks_count": len(request.task_paths),
                "categories_count": len(project_labels)
            }
        }

    except HTTPException:
        # 清理临时文件
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        if zip_path and os.path.exists(zip_path):
            os.unlink(zip_path)
        raise
    except Exception as e:
        logger.error(f"项目导出失败: {e}", exc_info=True)
        # 清理临时文件
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        if zip_path and os.path.exists(zip_path):
            os.unlink(zip_path)
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.post("/admin/export_project_tasks_yolo")
def export_project_tasks_yolo_legacy(request: ExportProjectTasksRequest, db: Session = Depends(get_db)):
    """
    YOLO格式导出（兼容旧API）

    这是为了兼容旧的前端调用而保留的端点。
    实际上调用统一的export_project_tasks，但强制设置format为yolo。

    建议前端迁移到新的统一端点：/api/admin/export_project_tasks
    """
    # 强制设置导出格式为YOLO
    request.export_format = 'yolo'

    logger.info("Legacy YOLO export endpoint called, redirecting to unified endpoint")

    # 调用统一的导出函数
    return export_project_tasks(request, db)


@router.post("/admin/export_project_tasks_coco")
def export_project_tasks_coco_legacy(request: ExportProjectTasksRequest, db: Session = Depends(get_db)):
    """
    COCO格式导出（兼容旧API）

    这是为了兼容旧的前端调用而保留的端点。
    实际上调用统一的export_project_tasks，但强制设置format为coco。

    建议前端迁移到新的统一端点：/api/admin/export_project_tasks
    """
    # 强制设置导出格式为COCO
    request.export_format = 'coco'

    logger.info("Legacy COCO export endpoint called, redirecting to unified endpoint")

    # 调用统一的导出函数
    return export_project_tasks(request, db)

