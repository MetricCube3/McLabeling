"""
统计信息更新工具
提供更新任务统计信息的函数
"""
import os
import sys
import json
import re
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from models import AnnotationTask
from utils import VIDEO_DIR, IMAGE_DIR, SUCCESS_DIR
import logging

logger = logging.getLogger(__name__)


def update_task_stats(db: Session, task_path: str, task_type: str, project_name: str) -> dict:
    """
    更新任务的统计信息到数据库
    
    Args:
        db: 数据库会话
        task_path: 任务路径
        task_type: 任务类型 ('video' 或 'image')
        project_name: 项目名称
    
    Returns:
        dict: 统计信息字典
    """
    stats = calculate_task_stats(task_path, task_type, project_name)
    
    # 查找或创建任务记录
    task = db.query(AnnotationTask).filter(AnnotationTask.task_path == task_path).first()
    
    if not task:
        # 如果任务不存在，创建一个新的
        task = AnnotationTask(
            task_path=task_path,
            project_name=project_name,
            total_images=stats['total_images'],
            annotated_images=stats['annotated_images'],
            total_labels=stats['total_labels'],
            label_counts=stats['label_counts'],
            last_annotated_frame=stats['last_annotated_frame'],
            stats_updated_at=datetime.utcnow()
        )
        db.add(task)
    else:
        # 更新现有任务的统计信息
        task.total_images = stats['total_images']
        task.annotated_images = stats['annotated_images']
        task.total_labels = stats['total_labels']
        task.label_counts = stats['label_counts']
        task.last_annotated_frame = stats['last_annotated_frame']
        task.stats_updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(task)
        logger.info(f"Updated stats for task: {task_path}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update stats for task {task_path}: {e}")
        raise
    
    return stats


def calculate_task_stats(task_path: str, task_type: str, project_name: str) -> dict:
    """
    计算任务的统计信息（扫描文件系统）
    
    Args:
        task_path: 任务路径
        task_type: 任务类型
        project_name: 项目名称
    
    Returns:
        dict: 统计信息
    """
    stats = {
        'total_images': 0,
        'annotated_images': 0,
        'total_labels': 0,
        'label_counts': {},
        'last_annotated_frame': -1
    }
    
    if task_type == 'video':
        video_filename = os.path.splitext(os.path.basename(task_path))[0]
        
        # 检查extracted目录
        extracted_dir = os.path.join(VIDEO_DIR, project_name, video_filename, 'extracted')
        if os.path.exists(extracted_dir):
            stats['total_images'] = len([f for f in os.listdir(extracted_dir)
                                        if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        
        # 如果没有抽帧图片，使用视频帧数
        if stats['total_images'] == 0:
            video_abs_path = os.path.join(VIDEO_DIR, task_path)
            if os.path.exists(video_abs_path):
                try:
                    import cv2
                    cap = cv2.VideoCapture(video_abs_path)
                    stats['total_images'] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    cap.release()
                except:
                    pass
        
        # 统计已标注信息
        annotation_dir = os.path.join(SUCCESS_DIR, project_name, video_filename)
        stats = _scan_annotation_dir(annotation_dir, stats, is_video=True)
    
    else:  # image task
        task_abs_path = os.path.join(IMAGE_DIR, task_path)
        if os.path.isdir(task_abs_path):
            for root, _, filenames in os.walk(task_abs_path):
                for filename in filenames:
                    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                        stats['total_images'] += 1
        
        # 统计已标注信息
        task_name = os.path.basename(task_path)
        annotation_dir = os.path.join(SUCCESS_DIR, project_name, task_name)
        stats = _scan_annotation_dir(annotation_dir, stats, is_video=False)
    
    return stats


def _scan_annotation_dir(annotation_dir: str, stats: dict, is_video: bool) -> dict:
    """
    扫描标注目录，更新统计信息
    
    Args:
        annotation_dir: 标注目录路径
        stats: 统计信息字典
        is_video: 是否为视频任务
    
    Returns:
        dict: 更新后的统计信息
    """
    if not os.path.exists(annotation_dir):
        return stats
    
    # 统计已标注图片
    images_dir = os.path.join(annotation_dir, 'images')
    if os.path.exists(images_dir):
        stats['annotated_images'] = len([f for f in os.listdir(images_dir)
                                         if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    
    # 统计标签
    labels_dir = os.path.join(annotation_dir, 'labels')
    if os.path.exists(labels_dir):
        max_index = -1
        for label_file in os.listdir(labels_dir):
            if label_file.endswith('.txt'):
                label_path = os.path.join(labels_dir, label_file)
                try:
                    # 统计标签
                    with open(label_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for line in lines:
                            line = line.strip()
                            if line:
                                parts = line.split()
                                if len(parts) > 0:
                                    class_id = parts[0]
                                    stats['label_counts'][class_id] = stats['label_counts'].get(class_id, 0) + 1
                                    stats['total_labels'] += 1
                    
                    # 解析帧/图片索引
                    if is_video:
                        match = re.search(r'_frame_(\d+)\.txt$', label_file) or \
                               re.search(r'frame_(\d+)\.txt$', label_file)
                    else:
                        match = re.search(r'_img_(\d+)\.txt$', label_file)
                    
                    if match:
                        index = int(match.group(1))
                        if index > max_index:
                            max_index = index
                except Exception as e:
                    logger.warning(f"Failed to read label file {label_path}: {e}")
        
        stats['last_annotated_frame'] = max_index
    
    return stats


def get_task_stats_from_db(db: Session, task_path: str) -> dict:
    """
    从数据库获取任务的统计信息
    
    Args:
        db: 数据库会话
        task_path: 任务路径
    
    Returns:
        dict: 统计信息，如果不存在返回None
    """
    task = db.query(AnnotationTask).filter(AnnotationTask.task_path == task_path).first()
    
    if not task:
        return None
    
    # 处理label_counts字段（可能是字符串或字典）
    label_counts = task.label_counts or {}
    if isinstance(label_counts, str):
        try:
            label_counts = json.loads(label_counts)
        except (json.JSONDecodeError, ValueError):
            label_counts = {}
    elif not isinstance(label_counts, dict):
        label_counts = {}
    
    return {
        'total_images': task.total_images or 0,
        'annotated_images': task.annotated_images or 0,
        'total_labels': task.total_labels or 0,
        'label_counts': label_counts,
        'last_annotated_frame': task.last_annotated_frame or -1,
        'stats_updated_at': task.stats_updated_at
    }


def batch_update_all_stats(db: Session):
    """
    批量更新所有任务的统计信息
    用于初始化或定期更新
    
    Args:
        db: 数据库会话
    """
    tasks = db.query(AnnotationTask).all()
    
    updated_count = 0
    failed_count = 0
    
    print(f"开始更新 {len(tasks)} 个任务的统计信息...")
    
    for task in tasks:
        try:
            # 判断任务类型
            task_type = 'video' if task.task_path.endswith(('.mp4', '.avi', '.mov', '.mkv')) else 'image'
            
            # 更新统计信息
            update_task_stats(db, task.task_path, task_type, task.project_name or 'default')
            updated_count += 1
            
            if updated_count % 10 == 0:
                print(f"  已更新 {updated_count}/{len(tasks)} 个任务...")
        
        except Exception as e:
            logger.error(f"Failed to update stats for task {task.task_path}: {e}")
            failed_count += 1
    
    print(f"\n✅ 更新完成: {updated_count} 成功, {failed_count} 失败")


if __name__ == "__main__":
    """命令行工具：批量更新所有任务的统计信息"""
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    from database import SessionLocal
    
    print("=" * 80)
    print("批量更新任务统计信息")
    print("=" * 80)
    
    db = SessionLocal()
    try:
        batch_update_all_stats(db)
    finally:
        db.close()
    
    print("=" * 80)
