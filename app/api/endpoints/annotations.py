"""
标注管理路由
处理标注数据的保存、读取、删除等功能
"""
import os
import json
import shutil
import re
from urllib.parse import unquote
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.core.database import get_db
from app.models.models import AnnotationTask, ReviewTask
from app.utils.utils import VIDEO_DIR, IMAGE_DIR, SUCCESS_DIR, REVIEW_DIR, TEMP_DIR, ANNOTATED_DIR
import logging
import cv2

router = APIRouter()
logger = logging.getLogger(__name__)


class SaveAnnotationRequest(BaseModel):
    status: str  # success, review
    objects: List[Dict[str, Any]]
    frameUrl: str  # 匹配前端
    videoPath: Optional[str] = None  # 可选，审核模式下可能为null
    imageWidth: int  # 匹配前端
    imageHeight: int  # 匹配前端
    frameIndex: Optional[int] = None  # 可选，用于视频帧
    overwrite_path: Optional[str] = None  # 可选，覆盖路径
    totalFrames: Optional[int] = None  # 可选，总帧数（前端传递）
    isExtractedFrame: Optional[bool] = None  # 可选，是否抽帧图片（前端传递）


class DeleteAnnotationRequest(BaseModel):
    user: str
    path: str


@router.post("/save")
def save_yolo_annotation(request: SaveAnnotationRequest, db: Session = Depends(get_db)):
    """保存YOLO格式标注（优化版，参照app.py）"""
    try:
        # 验证必需参数
        if not all([request.status, request.objects is not None, request.frameUrl,
                    request.imageWidth, request.imageHeight]):
            raise HTTPException(status_code=400, detail="缺少必需参数")

        frame_url = request.frameUrl
        image_width = request.imageWidth
        image_height = request.imageHeight

        # 处理审核模式：videoPath为null，从overwrite_path提取信息
        if request.overwrite_path and not request.videoPath:
            # overwrite_path格式: success/project_name/task_name/images/image_file.jpg
            parts = request.overwrite_path.split('/')
            if len(parts) >= 3:
                project_name = parts[1]
                task_name = parts[2]
                # 尝试从数据库查找对应的任务
                task = db.query(AnnotationTask).filter(
                    AnnotationTask.project_name == project_name
                ).all()
                video_path = None
                for t in task:
                    task_basename = os.path.splitext(os.path.basename(t.task_path))[0]
                    task_basename_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', task_basename)
                    if task_basename_safe == task_name or task_basename == task_name:
                        video_path = t.task_path
                        break
                if not video_path:
                    # 如果找不到，使用task_name作为临时路径
                    video_path = f"{project_name}/{task_name}"
            else:
                raise HTTPException(status_code=400, detail="无效的overwrite_path格式")
        else:
            video_path = request.videoPath
            if not video_path:
                raise HTTPException(status_code=400, detail="videoPath和overwrite_path不能同时为空")

        # 检测任务类型
        is_video_task = os.path.exists(os.path.join(VIDEO_DIR, video_path)) if video_path else False
        is_image_task = os.path.isdir(os.path.join(IMAGE_DIR, video_path)) if video_path else False

        # 审核模式下，即使找不到原始任务文件也允许继续（直接操作已标注的文件）
        if not (is_video_task or is_image_task) and not request.overwrite_path:
            logger.error(f"Task not found: {video_path}")
            raise HTTPException(status_code=404, detail="任务不存在")

        # 检查是否是抽帧图片
        is_extracted_frame = '/extracted/' in frame_url
        logger.info(f"Saving annotation: task={video_path}, extracted={is_extracted_frame}, frame_url={frame_url}")

        # 获取项目名称（如果不是审核模式或审核模式但未从overwrite_path提取）
        if not (request.overwrite_path and not request.videoPath):
            # 首先尝试从数据库获取
            task = db.query(AnnotationTask).filter(AnnotationTask.task_path == video_path).first()
            if task and task.project_name:
                project_name = task.project_name
            else:
                # 如果任务不存在，从 video_path 中提取项目名
                # video_path 格式通常是: "project_name/task_name" 或 "project_name/task_name.mp4"
                if '/' in video_path:
                    project_name = video_path.split('/')[0]
                    logger.info(f"Extracted project_name '{project_name}' from video_path '{video_path}'")
                else:
                    # 如果路径中没有 '/'，使用 default
                    project_name = 'default'
                    logger.warning(f"No project found in video_path '{video_path}', using 'default'")
        # 如果是审核模式，project_name已在上面从overwrite_path中提取

        # 处理覆盖保存（审核模式）
        if request.overwrite_path:
            image_to_overwrite = os.path.join(ANNOTATED_DIR, request.overwrite_path)
            video_specific_dir = os.path.dirname(os.path.dirname(image_to_overwrite))
            images_dir = os.path.join(video_specific_dir, 'images')
            labels_dir = os.path.join(video_specific_dir, 'labels')
            labels_bbox_dir = os.path.join(video_specific_dir, 'labels_bbox')
            output_basename = os.path.splitext(os.path.basename(image_to_overwrite))[0]
        else:
            # 新文件保存逻辑
            base_target_dir = SUCCESS_DIR if request.status == 'success' else REVIEW_DIR

            if is_video_task:
                task_filename = os.path.splitext(os.path.basename(video_path))[0]
            else:
                task_filename = os.path.basename(video_path)

            # 创建包含项目名称的目录
            video_specific_dir = os.path.join(base_target_dir, project_name, task_filename)
            images_dir = os.path.join(video_specific_dir, 'images')
            labels_dir = os.path.join(video_specific_dir, 'labels')
            labels_bbox_dir = os.path.join(video_specific_dir, 'labels_bbox')
            os.makedirs(images_dir, exist_ok=True)
            os.makedirs(labels_dir, exist_ok=True)
            os.makedirs(labels_bbox_dir, exist_ok=True)

            # 解析输出文件名 - 支持多种格式
            if is_video_task:
                # 优先使用前端传递的帧索引
                if request.frameIndex is not None:
                    video_filename_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', task_filename)
                    output_basename = f"{video_filename_safe}_frame_{request.frameIndex}"
                else:
                    # 回退到从文件名提取
                    if is_extracted_frame:
                        # 抽帧图片：文件名格式为 frame_000001.jpg
                        match = re.search(r'frame_(\d+)\.jpg', os.path.basename(frame_url))
                        if match:
                            frame_index = int(match.group(1))
                            video_filename_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', task_filename)
                            output_basename = f"{video_filename_safe}_frame_{frame_index}"
                        else:
                            raise HTTPException(status_code=400, detail="无法从抽帧图片文件名中确定帧索引")
                    else:
                        # 原始视频帧：文件名格式为 {task_name}_frame_{index}.jpg
                        original_frame_name_match = re.search(r'(_frame_\d+)', os.path.basename(frame_url))
                        if not original_frame_name_match:
                            raise HTTPException(status_code=400, detail="无法从文件名中确定帧索引")
                        video_filename_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', task_filename)
                        output_basename = f"{video_filename_safe}{original_frame_name_match.group(1)}"
            else:
                # 图片任务：统一使用 taskname_img_index 格式
                match = re.search(r'(.+)_img_(\d+)', os.path.basename(frame_url))
                if match:
                    output_basename = match.group(0).replace('.jpg', '')
                else:
                    task_name_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', task_filename)
                    index_match = re.search(r'img_(\d+)', frame_url)
                    if index_match:
                        image_index = index_match.group(1)
                        output_basename = f"{task_name_safe}_img_{image_index}"
                    else:
                        raise HTTPException(status_code=400, detail="无法从文件名中确定图片索引")

        # 通用保存逻辑，对frame_url进行URL解码（处理中文路径）
        source_frame_path = unquote(frame_url.lstrip('/'))
        target_image_path = os.path.join(images_dir, f"{output_basename}.jpg")
        label_filepath = os.path.join(labels_dir, f"{output_basename}.txt")
        label_bbox_filepath = os.path.join(labels_bbox_dir, f"{output_basename}.txt")

        # 过滤有效对象（必须有maskData）
        valid_objects = [obj for obj in request.objects if obj.get('maskData')]

        if len(valid_objects) == 0:
            # 无标注对象，删除相关文件
            deleted_files = []

            if os.path.exists(label_filepath):
                os.remove(label_filepath)
                deleted_files.append("分割标注文件")

            if os.path.exists(label_bbox_filepath):
                os.remove(label_bbox_filepath)
                deleted_files.append("边界框标注文件")

            # 关键修改：对于抽帧图片，不删除原始图片
            if os.path.exists(target_image_path):
                if is_extracted_frame:
                    # 检查目标图片是否在标注目录中
                    if target_image_path.startswith(SUCCESS_DIR) or target_image_path.startswith(REVIEW_DIR):
                        os.remove(target_image_path)
                        deleted_files.append("标注目录中的图片副本")
                else:
                    os.remove(target_image_path)
                    deleted_files.append("图片文件")

            # 对于抽帧图片，不删除源文件
            if not request.overwrite_path and os.path.exists(source_frame_path) and not is_extracted_frame:
                if source_frame_path.startswith('static/temp/'):
                    os.remove(source_frame_path)
                    deleted_files.append("临时文件")

            message = "图像未标注，并清空已有标注缓存" if deleted_files else "图像未标注"
        else:
            # 有标注对象
            if not request.overwrite_path:
                if is_extracted_frame:
                    # 抽帧图片：复制图片到标注目录，不删除原始抽帧图片
                    if not os.path.exists(target_image_path):
                        shutil.copy2(source_frame_path, target_image_path)
                else:
                    # 非抽帧图片：移动临时图片到标注目录
                    if os.path.exists(source_frame_path):
                        shutil.move(source_frame_path, target_image_path)
            elif request.overwrite_path and not os.path.exists(target_image_path):
                # 覆盖模式但目标图片不存在
                if is_extracted_frame:
                    shutil.copy2(source_frame_path, target_image_path)
                else:
                    if os.path.exists(source_frame_path):
                        shutil.move(source_frame_path, target_image_path)

            # 保存分割标注（多边形格式）
            with open(label_filepath, 'w', encoding='utf-8') as f:
                for obj in valid_objects:
                    class_id = obj.get('classId', 0)
                    for polygon in obj['maskData']:
                        if not polygon:
                            continue
                        normalized_coords = []
                        for x, y in polygon:
                            norm_x = x / image_width
                            norm_y = y / image_height
                            # 确保在[0,1]范围内
                            norm_x = max(0.0, min(1.0, norm_x))
                            norm_y = max(0.0, min(1.0, norm_y))
                            normalized_coords.extend([f"{norm_x:.6f}", f"{norm_y:.6f}"])
                        if normalized_coords:
                            f.write(f"{class_id} {' '.join(normalized_coords)}\n")

            # 保存边界框标注（YOLO格式）
            with open(label_bbox_filepath, 'w', encoding='utf-8') as f_bbox:
                for obj in valid_objects:
                    class_id = obj.get('classId', 0)
                    box_data = obj.get('boxData')

                    if box_data and len(box_data) == 4:
                        # 提取边界框坐标 [x1, y1, x2, y2]
                        x1, y1, x2, y2 = box_data

                        # 计算边界框中心点坐标
                        center_x = (x1 + x2) / 2.0
                        center_y = (y1 + y2) / 2.0

                        # 计算边界框宽度和高度
                        width = x2 - x1
                        height = y2 - y1

                        # 归一化坐标
                        center_x_norm = center_x / image_width
                        center_y_norm = center_y / image_height
                        width_norm = width / image_width
                        height_norm = height / image_height

                        # 确保归一化坐标在[0,1]范围内
                        center_x_norm = max(0.0, min(1.0, center_x_norm))
                        center_y_norm = max(0.0, min(1.0, center_y_norm))
                        width_norm = max(0.0, min(1.0, width_norm))
                        height_norm = max(0.0, min(1.0, height_norm))

                        # 写入YOLO格式的边界框标注
                        f_bbox.write(
                            f"{class_id} {center_x_norm:.6f} {center_y_norm:.6f} {width_norm:.6f} {height_norm:.6f}\n")

            message = "标注覆盖保存成功" if request.overwrite_path else "标注保存成功"

        # 更新任务统计信息到数据库（异步更新，提升保存性能）
        try:
            task_type = 'video' if is_video_task else 'image'
            update_task_stats(db, video_path, task_type, project_name)
            logger.info(f"Updated stats for task: {video_path}")
        except Exception as e:
            # 统计更新失败不影响保存操作
            logger.warning(f"Failed to update stats for task {video_path}: {e}")

        logger.info(f"Annotation saved: {output_basename}, objects: {len(valid_objects)}")
        return {"message": message}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save annotation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"保存标注失败: {str(e)}")


def update_task_stats(db: Session, task_path: str, task_type: str, project_name: str):
    """更新任务的统计信息到数据库"""
    from datetime import datetime

    try:
        stats = _calculate_stats(task_path, task_type, project_name)

        # 查找或创建任务记录
        task = db.query(AnnotationTask).filter(AnnotationTask.task_path == task_path).first()

        if not task:
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

            # 注意：不从video_pool中删除
            # 保留在待标注池中，等待管理员重新分配用户后再删除
            logger.info(f"Created task record for {task_path}, keeping in video_pool for reassignment")
        else:
            task.total_images = stats['total_images']
            task.annotated_images = stats['annotated_images']
            task.total_labels = stats['total_labels']
            task.label_counts = stats['label_counts']
            task.last_annotated_frame = stats['last_annotated_frame']
            task.stats_updated_at = datetime.utcnow()

        db.commit()
        db.refresh(task)
        return stats
    except Exception as e:
        db.rollback()
        logger.warning(f"Failed to update stats: {e}")
        return None


def _calculate_stats(task_path: str, task_type: str, project_name: str) -> dict:
    """计算任务统计信息（内部函数）"""
    stats = {
        'total_images': 0,
        'annotated_images': 0,
        'total_labels': 0,
        'label_counts': {},
        'last_annotated_frame': -1
    }

    # ===== 计算总图片数 =====
    if task_type == 'video':
        video_filename = os.path.splitext(os.path.basename(task_path))[0]
        # 优先从抽帧目录获取总帧数
        extracted_dir = os.path.join(VIDEO_DIR, project_name, video_filename, 'extracted')
        if os.path.exists(extracted_dir):
            stats['total_images'] = len([f for f in os.listdir(extracted_dir)
                                         if f.lower().endswith(('.jpg', '.jpeg', '.png'))])

        # 如果抽帧目录不存在或为空，从视频文件读取帧数
        if stats['total_images'] == 0:
            video_abs_path = os.path.join(VIDEO_DIR, task_path)
            if os.path.exists(video_abs_path):
                try:
                    import cv2
                    cap = cv2.VideoCapture(video_abs_path)
                    stats['total_images'] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    cap.release()
                except Exception as e:
                    logger.warning(f"Failed to get video frame count: {e}")

        annotation_dir = os.path.join(SUCCESS_DIR, project_name, video_filename)
    else:
        # 图片任务：统计任务目录下的所有图片
        task_abs_path = os.path.join(IMAGE_DIR, task_path)
        if os.path.isdir(task_abs_path):
            for root, _, filenames in os.walk(task_abs_path):
                for filename in filenames:
                    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                        stats['total_images'] += 1

        task_name = os.path.basename(task_path)
        annotation_dir = os.path.join(SUCCESS_DIR, project_name, task_name)

    # ===== 计算已标注数据 =====
    if os.path.exists(annotation_dir):
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

                        # 解析索引
                        if task_type == 'video':
                            match = re.search(r'_frame_(\d+)\.txt$', label_file) or \
                                    re.search(r'frame_(\d+)\.txt$', label_file)
                        else:
                            match = re.search(r'_img_(\d+)\.txt$', label_file)

                        if match:
                            index = int(match.group(1))
                            if index > max_index:
                                max_index = index
                    except:
                        pass

            stats['last_annotated_frame'] = max_index

    return stats


@router.get("/get_annotation")
def get_annotation(path: str = Query(...), db: Session = Depends(get_db)):
    """获取标注数据 - 用于审核页面"""
    if not path:
        raise HTTPException(status_code=400, detail="路径不能为空")

    try:
        # 路径格式: success/project_name/task_name/images/image_name.jpg
        image_path_on_disk = os.path.abspath(os.path.join(ANNOTATED_DIR, path))

        # 安全检查
        if not image_path_on_disk.startswith(os.path.abspath(ANNOTATED_DIR)):
            raise HTTPException(status_code=403, detail="访问被拒绝")

        if not os.path.exists(image_path_on_disk):
            raise HTTPException(status_code=404, detail="标注图片不存在")

        # 从路径中提取项目信息
        path_parts = path.split('/')
        project_name = None
        if len(path_parts) >= 3:  # success/project_name/task_name/images/...
            project_name = path_parts[1]  # 项目名称在第二个位置

        # 构建标注文件路径
        label_path_on_disk = image_path_on_disk.replace('/images/', '/labels/').replace('\\images\\', '\\labels\\')
        label_path_on_disk = os.path.splitext(label_path_on_disk)[0] + '.txt'

        if not os.path.exists(label_path_on_disk):
            raise HTTPException(status_code=404, detail="标注文件不存在")

        # 读取图片尺寸
        try:
            img = cv2.imread(image_path_on_disk)
            if img is None:
                raise HTTPException(status_code=500, detail="无法读取图片")
            height, width = img.shape[:2]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"无法读取图片尺寸: {str(e)}")

        # 读取标注数据（归一化坐标转像素坐标）
        annotations = []
        try:
            with open(label_path_on_disk, 'r', encoding='utf-8') as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) < 3:
                        continue

                    class_id = int(parts[0])
                    coords = [float(c) for c in parts[1:]]

                    # 归一化坐标转像素坐标
                    pixel_coords = []
                    for i in range(0, len(coords), 2):
                        if i + 1 < len(coords):
                            x = coords[i] * width
                            y = coords[i + 1] * height
                            pixel_coords.append([x, y])

                    annotations.append({
                        "classId": class_id,
                        "maskData": [pixel_coords]
                    })
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"解析标注文件失败: {str(e)}")

        # 从文件名提取帧索引和任务信息
        filename = os.path.basename(path)

        # 支持两种文件名格式
        match_video = re.match(r'(.+)_frame_(\d+)\.(jpg|jpeg|png)', filename, re.IGNORECASE)
        match_image = re.match(r'(.+)_img_(\d+)\.(jpg|jpeg|png)', filename, re.IGNORECASE)

        frame_index = 0
        original_task_path = None
        original_total_frames = 0
        task_type = 'video'

        if match_video:
            original_task_name_safe = match_video.group(1)
            frame_index = int(match_video.group(2))
            task_type = 'video'

            # 查找原始视频任务路径
            if project_name:
                # 在数据库中查找任务
                tasks = db.query(AnnotationTask).filter(
                    AnnotationTask.project_name == project_name
                ).all()

                for task in tasks:
                    task_name_no_ext = os.path.splitext(os.path.basename(task.task_path))[0]
                    if re.sub(r'[^a-zA-Z0-9_.-]', '_', task_name_no_ext) == original_task_name_safe:
                        original_task_path = task.task_path
                        original_total_frames = task.total_images or 0
                        break

        elif match_image:
            original_task_name_safe = match_image.group(1)
            frame_index = int(match_image.group(2))
            task_type = 'image'

        # 返回数据（与app.py格式一致）
        return {
            "annotations": annotations,  # 前端期望的字段名
            "project": project_name,
            "frameIndex": frame_index,
            "originalVideoPath": original_task_path,
            "totalFrames": original_total_frames,
            "taskType": task_type
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get annotation: {e}")
        raise HTTPException(status_code=500, detail=f"获取标注失败: {str(e)}")


@router.post("/delete_annotation")
def delete_annotation(request: DeleteAnnotationRequest, db: Session = Depends(get_db)):
    """删除标注"""
    try:
        if not request.user:
            raise HTTPException(status_code=401, detail="用户未指定")

        if not request.path:
            raise HTTPException(status_code=400, detail="路径不能为空")

        # 解析路径
        parts = request.path.split('/')
        if len(parts) < 5:
            raise HTTPException(status_code=400, detail="路径格式不正确")

        status_dir = parts[0]
        project_name = parts[1]
        task_name = parts[2]
        image_filename = parts[-1]

        # 构建文件路径
        if status_dir == 'success':
            base_dir = SUCCESS_DIR
        elif status_dir == 'review':
            base_dir = REVIEW_DIR
        else:
            raise HTTPException(status_code=400, detail="无效的状态目录")

        # 删除图片和标注文件
        image_path = os.path.join(base_dir, project_name, task_name, 'images', image_filename)
        label_filename = os.path.splitext(image_filename)[0] + '.txt'
        label_path = os.path.join(base_dir, project_name, task_name, 'labels', label_filename)
        label_bbox_path = os.path.join(base_dir, project_name, task_name, 'labels_bbox', label_filename)

        deleted = []
        if os.path.exists(image_path):
            os.remove(image_path)
            deleted.append("图片")

        if os.path.exists(label_path):
            os.remove(label_path)
            deleted.append("分割标注")

        if os.path.exists(label_bbox_path):
            os.remove(label_bbox_path)
            deleted.append("边界框标注")

        # 更新原始标注任务的统计信息
        try:
            # 从文件名反推原始任务路径
            # 文件名格式: {task_name}_frame_{index}.jpg 或 {task_name}_img_{index}.jpg
            match_video = re.match(r'(.+)_frame_\d+\.(jpg|jpeg|png)', image_filename, re.IGNORECASE)
            match_image = re.match(r'(.+)_img_\d+\.(jpg|jpeg|png)', image_filename, re.IGNORECASE)

            if match_video or match_image:
                task_name_safe = match_video.group(1) if match_video else match_image.group(1)
                task_type = 'video' if match_video else 'image'

                # 在数据库中查找对应的标注任务
                tasks = db.query(AnnotationTask).filter(
                    AnnotationTask.project_name == project_name
                ).all()

                for ann_task in tasks:
                    original_task_name = os.path.splitext(os.path.basename(ann_task.task_path))[0]
                    original_task_name_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', original_task_name)

                    if original_task_name_safe == task_name_safe:
                        # 找到对应的标注任务，更新统计信息
                        update_task_stats(db, ann_task.task_path, task_type, project_name)
                        logger.info(f"Updated stats for task {ann_task.task_path} after deletion")
                        break
        except Exception as e:
            # 统计更新失败不影响删除操作
            logger.warning(f"Failed to update stats after deletion: {e}")

        logger.info(f"Deleted annotation: {image_filename}, files: {deleted}")
        return {"message": f"标注删除成功: {', '.join(deleted)}"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete annotation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除标注失败: {str(e)}")

