"""
工具函数集合
"""
import os
import cv2
import json
import shutil
import logging
from datetime import datetime
from werkzeug.utils import secure_filename
from PIL import Image

logger = logging.getLogger(__name__)

# 路径配置
DATA_DIR = 'data'
VIDEO_DIR = os.path.join(DATA_DIR, 'videos')
EXTRACTION_INFO_DIR = os.path.join(DATA_DIR, 'extraction_info')
IMAGE_DIR = os.path.join(DATA_DIR, 'images')
IMAGE_ZIP_DIR = os.path.join(DATA_DIR, 'image_zips')
ANNOTATED_DIR = os.path.join(DATA_DIR, 'annotated')
SUCCESS_DIR = os.path.join(ANNOTATED_DIR, 'success')
REVIEW_DIR = os.path.join(ANNOTATED_DIR, 'review')
STATIC_DIR = 'static'
COVERS_DIR = os.path.join(STATIC_DIR, 'covers')
TEMP_DIR = os.path.join(STATIC_DIR, 'temp')


def get_video_cover(video_path, relative_video_path):
    """生成视频封面"""
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return None
        
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            return None
        
        # 生成封面文件名
        cover_filename = f"{secure_filename(relative_video_path)}.jpg"
        cover_path = os.path.join(COVERS_DIR, cover_filename)
        
        # 保存封面
        cv2.imwrite(cover_path, frame)
        
        return f"/{STATIC_DIR}/covers/{cover_filename}"
    
    except Exception as e:
        logger.error(f"Failed to generate cover for {video_path}: {e}")
        return None


def check_video_has_annotations(video_path, annotation_tasks):
    """检查视频是否有标注数据"""
    project_name = 'default'
    if video_path in annotation_tasks:
        project_name = annotation_tasks[video_path].get('project', 'default')
    
    task_name = os.path.splitext(os.path.basename(video_path))[0]
    annotation_dirs = [
        os.path.join(SUCCESS_DIR, project_name, task_name),
        os.path.join(REVIEW_DIR, project_name, task_name)
    ]
    
    for annotation_dir in annotation_dirs:
        if os.path.exists(annotation_dir):
            # 检查是否有标注文件
            labels_dir = os.path.join(annotation_dir, 'labels')
            if os.path.exists(labels_dir) and any(f.endswith('.txt') for f in os.listdir(labels_dir)):
                return True
            # 检查是否有图片文件
            images_dir = os.path.join(annotation_dir, 'images')
            if os.path.exists(images_dir) and any(
                f.lower().endswith(('.jpg', '.jpeg', '.png')) for f in os.listdir(images_dir)
            ):
                return True
    
    return False


def load_extraction_info(video_path, db):
    """从数据库加载抽帧信息"""
    if db is None:
        logger.error("Database session is required")
        return None
    
    try:
        from models import ExtractionInfo
        extraction_info = db.query(ExtractionInfo).filter(
            ExtractionInfo.video_path == video_path
        ).first()
        
        if extraction_info:
            # 转换为字典格式
            return {
                'video_path': extraction_info.video_path,
                'original_fps': extraction_info.original_fps,
                'target_fps': extraction_info.target_fps,
                'extraction_interval': extraction_info.extraction_interval,
                'original_frame_count': extraction_info.original_frame_count,
                'extracted_frame_count': extraction_info.extracted_frame_count,
                'extracted_dir': extraction_info.extracted_dir,
                'relative_extracted_dir': extraction_info.relative_extracted_dir,
                'extracted_by': extraction_info.extracted_by,
                'extraction_time': extraction_info.extraction_time
            }
    except Exception as e:
        logger.error(f"Failed to load extraction info from database: {e}")
    
    return None


def save_extraction_info(video_path, info, db):
    """保存抽帧信息到数据库"""
    if db is None:
        logger.error("Database session is required")
        return False
    
    try:
        from models import ExtractionInfo
        
        # 检查是否已存在
        existing = db.query(ExtractionInfo).filter(
            ExtractionInfo.video_path == video_path
        ).first()
        
        if existing:
            # 更新现有记录
            existing.original_fps = info.get('original_fps')
            existing.target_fps = info.get('target_fps')
            existing.extraction_interval = info.get('extraction_interval')
            existing.original_frame_count = info.get('original_frame_count')
            existing.extracted_frame_count = info.get('extracted_frame_count')
            existing.extracted_dir = info.get('extracted_dir')
            existing.relative_extracted_dir = info.get('relative_extracted_dir')
            existing.extracted_by = info.get('extracted_by')
            existing.extraction_time = info.get('extraction_time')
        else:
            # 创建新记录
            extraction_info = ExtractionInfo(
                video_path=video_path,
                original_fps=info.get('original_fps'),
                target_fps=info.get('target_fps'),
                extraction_interval=info.get('extraction_interval'),
                original_frame_count=info.get('original_frame_count'),
                extracted_frame_count=info.get('extracted_frame_count'),
                extracted_dir=info.get('extracted_dir'),
                relative_extracted_dir=info.get('relative_extracted_dir'),
                extracted_by=info.get('extracted_by'),
                extraction_time=info.get('extraction_time')
            )
            db.add(extraction_info)
        
        db.commit()
        return True
    except Exception as e:
        logger.error(f"Failed to save extraction info to database: {e}")
        db.rollback()
        return False


def perform_frame_extraction(video_path, video_abs_path, target_fps, username, project_name='default', db=None):
    """执行视频抽帧"""
    # 创建 extracted 目录
    video_filename = os.path.splitext(os.path.basename(video_path))[0]
    extracted_dir = os.path.join(VIDEO_DIR, project_name, video_filename, 'extracted')
    os.makedirs(extracted_dir, exist_ok=True)
    
    # 打开视频文件
    cap = cv2.VideoCapture(video_abs_path)
    if not cap.isOpened():
        raise Exception("无法打开视频文件")
    
    # 获取视频信息
    original_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # 计算抽帧间隔
    extraction_interval = int(original_fps / target_fps)
    if extraction_interval < 1:
        extraction_interval = 1
    
    # 计算预期的总帧数
    expected_frames = total_frames // extraction_interval
    
    # 执行抽帧
    extracted_count = 0
    frame_index = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # 按间隔抽帧
        if frame_index % extraction_interval == 0:
            # 保存图片到 extracted 目录
            frame_filename = f"frame_{extracted_count:06d}.jpg"
            frame_path = os.path.join(extracted_dir, frame_filename)
            cv2.imwrite(frame_path, frame)
            extracted_count += 1
            
            # 每处理10帧记录一次进度
            if extracted_count % 10 == 0:
                progress = (frame_index / total_frames) * 100
                logger.info(f"抽帧进度: {progress:.1f}% ({extracted_count}/{expected_frames})")
        
        frame_index += 1
    
    cap.release()
    
    # 保存抽帧信息
    extraction_info = {
        "video_path": video_path,
        "original_fps": original_fps,
        "target_fps": target_fps,
        "extraction_interval": extraction_interval,
        "original_frame_count": total_frames,
        "extracted_frame_count": extracted_count,
        "extraction_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "extracted_by": username,
        "extracted_dir": extracted_dir,
        "relative_extracted_dir": os.path.relpath(extracted_dir, VIDEO_DIR).replace(os.sep, '/')
    }
    
    # 保存到数据库
    if db:
        save_extraction_info(video_path, extraction_info, db)
        logger.info(f"Extraction info saved to database: {video_path}")
        
        # 更新任务统计信息（抽帧后重置标注数据）
        try:
            from models import AnnotationTask
            task = db.query(AnnotationTask).filter(AnnotationTask.task_path == video_path).first()
            
            if task:
                # 重置统计信息（抽帧会清空所有标注数据）
                task.total_images = extracted_count  # 更新为新的抽帧数量
                task.annotated_images = 0  # 重置已标注数
                task.total_labels = 0  # 重置标签总数
                task.label_counts = {}  # 重置标签计数（字典类型）
                task.last_annotated_frame = -1  # 重置最后标注帧
                task.stats_updated_at = datetime.now()
                
                db.commit()
                db.refresh(task)
                logger.info(f"Task stats updated after extraction: {video_path}, total_images={extracted_count}")
            else:
                logger.warning(f"Task not found in database: {video_path}")
        except Exception as e:
            logger.warning(f"Failed to update task stats after extraction: {e}")
            # 不影响抽帧操作的成功
    
    return {
        "message": f"抽帧完成！共抽取 {extracted_count} 张图片",
        "extracted_count": extracted_count,
        "extracted_dir": extracted_dir,
        "extraction_info": extraction_info
    }


def extract_zip_and_get_images(zip_path, extract_dir):
    """解压zip文件并返回图片列表"""
    import zipfile
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # 获取所有图片文件
        image_files = []
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.gif')):
                    image_files.append(os.path.join(root, file))
        
        return image_files
    
    except Exception as e:
        logger.error(f"Failed to extract zip file: {e}")
        return []


def format_file_size(size_bytes):
    """格式化文件大小"""
    if size_bytes == 0:
        return "0 B"
    
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    unit_index = 0
    size = float(size_bytes)
    
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    
    return f"{size:.2f} {units[unit_index]}"
