"""
浏览路由
处理视频和标注数据的浏览功能
"""
import os
import json
import cv2
import shutil
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import AnnotationTask, ReviewTask, ExtractionInfo, User
from dependencies import has_role, is_admin
from utils import (
    VIDEO_DIR, IMAGE_DIR, SUCCESS_DIR, REVIEW_DIR, TEMP_DIR, ANNOTATED_DIR,
    load_extraction_info
)
from werkzeug.utils import secure_filename
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# 封面目录
STATIC_DIR = 'static'
COVERS_DIR = os.path.join(STATIC_DIR, 'covers')
os.makedirs(COVERS_DIR, exist_ok=True)


@router.get("/browse")
def browse_videos(
    user: str = Query(...),
    status: str = Query('all'),
    user_filter: str = Query(''),
    project_filter: str = Query(''),
    page: int = Query(1),
    page_size: int = Query(12),
    db: Session = Depends(get_db)
):
    """浏览视频和图片任务"""
    if not user:
        raise HTTPException(status_code=401, detail="User not specified")
    
    # 检查权限
    if not has_role(user, 'annotator', db) and not is_admin(user, db):
        raise HTTPException(status_code=403, detail="Access denied. Annotator role required.")
    
    # 获取标注任务信息（按创建时间排序）
    annotation_tasks = {}
    tasks = db.query(AnnotationTask).order_by(AnnotationTask.created_at.desc()).all()
    for task in tasks:
        annotation_tasks[task.task_path] = {
            'assignee': task.assignee,
            'status': task.status,
            'project': task.project_name,
            'created_at': task.created_at.isoformat() if task.created_at else None
        }
    
    files = []
    user_is_admin = is_admin(user, db)
    
    if user_is_admin:
        # ===== 管理员：扫描VIDEO_DIR和IMAGE_DIR下的所有任务 =====
        
        # 1. 扫描视频文件
        if os.path.exists(VIDEO_DIR):
            for root, _, filenames in os.walk(VIDEO_DIR):
                for filename in filenames:
                    if not filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                        continue
                    
                    video_abs_path = os.path.join(root, filename)
                    video_rel_path = os.path.relpath(video_abs_path, VIDEO_DIR).replace(os.sep, '/')
                    
                    # 从数据库获取任务信息（如果存在）
                    task_info = annotation_tasks.get(video_rel_path, {})
                    task_status = task_info.get('status', 'in_progress')
                    assignee = task_info.get('assignee', '')
                    project_name = task_info.get('project', os.path.dirname(video_rel_path) or 'default')
                    created_at = task_info.get('created_at', '')
                    
                    # 应用筛选条件
                    if status != 'all' and task_status != status:
                        continue
                    # 用户筛选（包括"未分配"）
                    if user_filter:
                        if user_filter == 'unassigned':
                            if assignee:  # 如果有分配者，则跳过
                                continue
                        elif assignee != user_filter:
                            continue
                    # 项目筛选
                    if project_filter and project_name != project_filter:
                        continue
                    
                    # 获取视频帧数
                    try:
                        cap = cv2.VideoCapture(video_abs_path)
                        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                        cap.release()
                    except:
                        frame_count = 0
                    
                    # 获取统计信息（优先从数据库读取缓存）
                    stats = get_annotation_stats(video_rel_path, 'video', project_name, db)
                    
                    # 生成封面URL
                    cover_url = get_video_cover_url(video_abs_path, video_rel_path)
                    
                    files.append({
                        'path': video_rel_path,
                        'name': filename,
                        'project': project_name,
                        'assignee': assignee,
                        'status': task_status,
                        'type': 'video',
                        'coverUrl': cover_url,
                        'totalFrames': frame_count,
                        'totalImages': stats['total_images'],
                        'annotatedImages': stats['annotated_images'],
                        'totalLabels': stats['total_labels'],
                        'labelCounts': stats.get('label_counts', {}),
                        'progress': round(stats['annotated_images'] / stats['total_images'] * 100, 1) if stats['total_images'] > 0 else 0,
                        'created_at': created_at
                    })
        
        # 2. 扫描图片任务
        if os.path.exists(IMAGE_DIR):
            for project_dir in os.listdir(IMAGE_DIR):
                project_path = os.path.join(IMAGE_DIR, project_dir)
                if not os.path.isdir(project_path):
                    continue
                
                for task_dir in os.listdir(project_path):
                    task_abs_path = os.path.join(project_path, task_dir)
                    if not (os.path.isdir(task_abs_path) and task_dir.startswith('images_')):
                        continue
                    
                    # 计算图片数量
                    image_count = 0
                    first_image_path = None
                    for root, _, filenames in os.walk(task_abs_path):
                        for filename in filenames:
                            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                                image_count += 1
                                if first_image_path is None:
                                    first_image_path = os.path.join(root, filename)
                    
                    if image_count == 0:
                        continue
                    
                    task_rel_path = os.path.join(project_dir, task_dir).replace(os.sep, '/')
                    
                    # 从数据库获取任务信息（如果存在）
                    task_info = annotation_tasks.get(task_rel_path, {})
                    task_status = task_info.get('status', 'in_progress')
                    assignee = task_info.get('assignee', '')
                    project_name = task_info.get('project', project_dir)
                    created_at = task_info.get('created_at', '')
                    
                    # 应用筛选条件
                    if status != 'all' and task_status != status:
                        continue
                    # 用户筛选（包括"未分配"）
                    if user_filter:
                        if user_filter == 'unassigned':
                            if assignee:  # 如果有分配者，则跳过
                                continue
                        elif assignee != user_filter:
                            continue
                    # 项目筛选
                    if project_filter and project_name != project_filter:
                        continue
                    
                    # 获取统计信息（优先从数据库读取缓存）
                    stats = get_annotation_stats(task_rel_path, 'image', project_name, db)
                    
                    # 生成封面URL
                    cover_url = get_image_cover_url(first_image_path, task_rel_path) if first_image_path else None
                    
                    files.append({
                        'path': task_rel_path,
                        'name': f"{task_dir} ({image_count}张图片)",
                        'project': project_name,
                        'assignee': assignee,
                        'status': task_status,
                        'type': 'image',
                        'coverUrl': cover_url,
                        'totalFrames': image_count,
                        'totalImages': stats['total_images'],
                        'annotatedImages': stats['annotated_images'],
                        'totalLabels': stats['total_labels'],
                        'labelCounts': stats.get('label_counts', {}),
                        'progress': round(stats['annotated_images'] / stats['total_images'] * 100, 1) if stats['total_images'] > 0 else 0,
                        'created_at': created_at,
                        'imageList': [
                            {
                                'url': f"/data/images/{task_rel_path}/{filename}",
                                'name': filename
                            } for filename in os.listdir(os.path.join(IMAGE_DIR, project_dir, task_dir))
                        ]
                    })
    
    else:
        # ===== 普通用户：只能看到分配给自己的任务 =====
        user_tasks = {k: v for k, v in annotation_tasks.items() if v.get('assignee') == user}
        
        for task_rel_path, task_info in user_tasks.items():
            task_status = task_info.get('status', 'in_progress')
            project_name = task_info.get('project', 'default')
            created_at = task_info.get('created_at', '')
            
            # 应用状态筛选
            if status != 'all' and task_status != status:
                continue
            
            # 应用项目筛选
            if project_filter and project_name != project_filter:
                continue
            
            # 判断是视频任务还是图片任务
            video_abs_path = os.path.join(VIDEO_DIR, task_rel_path)
            
            if os.path.exists(video_abs_path) and video_abs_path.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                # 视频任务
                try:
                    cap = cv2.VideoCapture(video_abs_path)
                    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    cap.release()
                except:
                    frame_count = 0
                
                stats = get_annotation_stats(task_rel_path, 'video', project_name, db)
                cover_url = get_video_cover_url(video_abs_path, task_rel_path)
                
                files.append({
                    'path': task_rel_path,
                    'name': os.path.basename(task_rel_path),
                    'project': project_name,
                    'assignee': user,
                    'status': task_status,
                    'type': 'video',
                    'coverUrl': cover_url,
                    'totalFrames': frame_count,
                    'totalImages': stats['total_images'],
                    'annotatedImages': stats['annotated_images'],
                    'totalLabels': stats['total_labels'],
                    'labelCounts': stats.get('label_counts', {}),
                    'progress': round(stats['annotated_images'] / stats['total_images'] * 100, 1) if stats['total_images'] > 0 else 0,
                    'created_at': created_at
                })
            else:
                # 图片任务
                task_abs_path = os.path.join(IMAGE_DIR, task_rel_path)
                if os.path.isdir(task_abs_path):
                    image_count = 0
                    first_image_path = None
                    for root, _, filenames in os.walk(task_abs_path):
                        for filename in filenames:
                            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                                image_count += 1
                                if first_image_path is None:
                                    first_image_path = os.path.join(root, filename)
                    
                    if image_count > 0:
                        stats = get_annotation_stats(task_rel_path, 'image', project_name, db)
                        cover_url = get_image_cover_url(first_image_path, task_rel_path) if first_image_path else None
                        
                        files.append({
                            'path': task_rel_path,
                            'name': f"{os.path.basename(task_rel_path)} ({image_count}张图片)",
                            'project': project_name,
                            'assignee': user,
                            'status': task_status,
                            'type': 'image',
                            'coverUrl': cover_url,
                            'totalFrames': image_count,
                            'totalImages': stats['total_images'],
                            'annotatedImages': stats['annotated_images'],
                            'totalLabels': stats['total_labels'],
                            'labelCounts': stats.get('label_counts', {}),
                            'progress': round(stats['annotated_images'] / stats['total_images'] * 100, 1) if stats['total_images'] > 0 else 0,
                            'created_at': created_at
                        })
    
    # 排序和分页（按创建时间倒序，最新的在前）
    files.sort(key=lambda x: x.get('created_at', '') or '', reverse=True)
    total_items = len(files)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_files = files[start_idx:end_idx]
    
    return {
        "current_path": "",
        "directories": [],
        "files": paginated_files,
        "total_count": total_items,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_items + page_size - 1) // page_size
    }


@router.get("/browse_annotated")
def browse_annotated(
    user: str = Query(...),
    path: str = Query(''),
    status: str = Query('all'),  # 状态筛选: all, in_progress, completed
    user_filter: str = Query(''),  # 用户筛选
    project_filter: str = Query(''),  # 项目筛选
    page: int = Query(1),
    page_size: int = Query(50),
    db: Session = Depends(get_db)
):
    """浏览已标注的数据（支持状态和用户筛选）"""
    if not user:
        raise HTTPException(status_code=401, detail="用户未指定")
    
    # 如果提供了path，浏览该目录的标注图片
    if path:
        # 路径格式: success/project_name/task_name
        # 审核任务的图片始终从success目录获取，因为审核时修改和删除需要覆盖原标注
        search_dir = os.path.abspath(os.path.join(ANNOTATED_DIR, path))
        
        # 安全检查
        if not search_dir.startswith(os.path.abspath(ANNOTATED_DIR)):
            raise HTTPException(status_code=403, detail="访问被拒绝")
        
        if not os.path.isdir(search_dir):
            raise HTTPException(status_code=404, detail="目录不存在")
        
        # 检查是否有images和labels子目录
        items = os.listdir(search_dir)
        if 'images' not in items or 'labels' not in items:
            return {
                "current_path": path.replace(os.sep, '/'),
                "directories": [],
                "files": None,
                "images": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }
        
        # 获取所有图片
        image_dir_path = os.path.join(search_dir, 'images')
        all_images = []
        
        for image_file in sorted(os.listdir(image_dir_path)):
            if image_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                # 构建web访问路径
                full_web_path = f"/data/annotated/{path}/images/{image_file}".replace('//', '/')
                relative_path_for_api = f"{path}/images/{image_file}".replace('//', '/')
                
                all_images.append({
                    "name": image_file,
                    "web_path": full_web_path,
                    "relative_path": relative_path_for_api,
                    "path": relative_path_for_api,  # 兼容旧字段
                    "url": full_web_path  # 兼容旧字段
                })
        
        # 分页
        total_items = len(all_images)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_images = all_images[start_idx:end_idx]
        
        return {
            "current_path": path.replace(os.sep, '/'),
            "directories": [],
            "files": paginated_images,  # app.js期望在files字段
            "images": paginated_images,  # 同时提供images字段以兼容
            "total": total_items,
            "total_count": total_items,  # 兼容字段
            "page": page,
            "page_size": page_size,
            "total_pages": (total_items + page_size - 1) // page_size if total_items > 0 else 0
        }
    
    # 如果没有path，列出审核任务
    else:
        # 检查用户权限：管理员或审核员
        user_obj = db.query(User).filter(User.username == user).first()
        if not user_obj:
            raise HTTPException(status_code=403, detail="用户不存在")
        
        user_roles = user_obj.roles if isinstance(user_obj.roles, list) else []
        is_admin = 'admin' in user_roles
        is_reviewer = 'reviewer' in user_roles
        
        if not is_admin and not is_reviewer:
            raise HTTPException(status_code=403, detail="需要管理员或审核员权限")
        
        # 查询审核任务（按创建时间排序）
        review_tasks = {}
        if is_admin:
            # 管理员可以看到所有审核任务
            tasks = db.query(ReviewTask).order_by(ReviewTask.created_at.desc()).all()
        else:
            # 审核员只能看到分配给自己的任务
            tasks = db.query(ReviewTask).filter(ReviewTask.assignee == user).order_by(ReviewTask.created_at.desc()).all()
        
        for task in tasks:
            review_tasks[task.task_path] = {
                'assignee': task.assignee,
                'status': task.status,
                'project': task.project_name,
                'created_at': task.created_at.isoformat() if task.created_at else None
            }
        
        directories = []
        for task_path, task_info in review_tasks.items():
            # === 应用筛选条件 ===
            task_status = task_info.get('status', 'in_progress')
            task_assignee = task_info.get('assignee', '')
            
            # 状态筛选
            if status != 'all' and task_status != status:
                continue
            
            # 用户筛选（包括"未分配"）
            if user_filter:
                if user_filter == 'unassigned':
                    if task_assignee:  # 如果有分配者，则跳过
                        continue
                elif task_assignee != user_filter:
                    continue
            
            # 项目筛选（需要先获取项目名）
            task_project = task_info.get('project', '')
            if project_filter and task_project != project_filter:
                continue
            # ===筛选结束 ===
            
            # 检查任务目录是否存在（优先检查SUCCESS_DIR，因为路径是success/project/task）
            task_dir = os.path.join(ANNOTATED_DIR, task_path)
            if not os.path.isdir(task_dir):
                # 如果SUCCESS_DIR中不存在，尝试REVIEW_DIR
                parts = task_path.split('/')
                if len(parts) >= 3 and parts[0] == 'success':
                    # 转换为review目录路径
                    review_path = f"review/{parts[1]}/{parts[2]}"
                    task_dir = os.path.join(ANNOTATED_DIR, review_path)
            
            if os.path.isdir(task_dir):
                # 统计图片数量
                images_dir = os.path.join(task_dir, 'images')
                image_count = 0
                if os.path.exists(images_dir):
                    image_count = len([f for f in os.listdir(images_dir) 
                                      if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
                
                # 从路径中提取显示名称
                parts = task_path.split('/')
                if len(parts) >= 3 and parts[0] == 'success':
                    display_name = f"{parts[2]} [{parts[1]}]"  # 任务名称 [项目名称]
                    project_name = parts[1]
                    task_name = parts[2]
                else:
                    task_name = os.path.basename(task_path)
                    project_name = task_info.get('project', 'default')
                    display_name = f"{task_name} [{project_name}]"  # 任务名称 [项目名称]
                
                directories.append({
                    'name': display_name,
                    'path': task_path,
                    'project': project_name,
                    'task_name': task_name,
                    'status': task_info.get('status', 'in_progress'),
                    'assignee': task_info.get('assignee', ''),
                    'image_count': image_count,
                    'created_at': task_info.get('created_at', '')
                })
        
        # 排序和分页（按创建时间倒序，最新的在前）
        directories.sort(key=lambda x: x.get('created_at', '') or '', reverse=True)
        total_items = len(directories)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_directories = directories[start_idx:end_idx]
        
        return {
            "current_path": "",
            "directories": paginated_directories,
            "files": None,
            "total_count": total_items,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_items + page_size - 1) // page_size
        }


def check_annotation(task_path: str, index: int, image_width: int, image_height: int, 
                     is_video: bool = True, db: Session = None):
    """检查是否存在标注 - 支持项目化目录结构"""
    has_annotation = False
    annotation_data = []
    
    # 构建任务名称
    if is_video:
        task_name = os.path.splitext(os.path.basename(task_path))[0]
        # 支持两种文件名格式
        annotation_filenames = [
            f"{re.sub(r'[^a-zA-Z0-9_.-]', '_', task_name)}_frame_{index}.txt",  # 标准格式
            f"frame_{index:06d}.txt"  # 抽帧格式
        ]
    else:
        task_name = os.path.basename(task_path)
        annotation_filenames = [f"{re.sub(r'[^a-zA-Z0-9_.-]', '_', task_name)}_img_{index}.txt"]
    
    # 确定项目名称
    project_name = 'default'
    if db:
        task = db.query(AnnotationTask).filter(AnnotationTask.task_path == task_path).first()
        if task and task.project_name:
            project_name = task.project_name
    
    # 如果从路径中提取
    if '/' in task_path:
        project_name = task_path.split('/')[0]
    
    # 检查标注目录 - 项目化目录结构
    possible_annotation_dirs = [
        os.path.join(SUCCESS_DIR, project_name, task_name),
        os.path.join(REVIEW_DIR, project_name, task_name),
    ]
    
    for annotation_dir in possible_annotation_dirs:
        labels_dir = os.path.join(annotation_dir, 'labels')
        
        # 尝试所有可能的文件名
        for annotation_filename in annotation_filenames:
            label_path = os.path.join(labels_dir, annotation_filename)
            
            if os.path.exists(label_path):
                has_annotation = True
                # 读取标注数据
                try:
                    annotations = []
                    with open(label_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            parts = line.strip().split()
                            if len(parts) < 3:
                                continue
                            class_id = int(parts[0])
                            coords = [float(c) for c in parts[1:]]
                            pixel_coords = []
                            for i in range(0, len(coords), 2):
                                x = coords[i] * image_width
                                y = coords[i + 1] * image_height
                                pixel_coords.append([x, y])
                            annotations.append({
                                "classId": class_id,
                                "maskData": [pixel_coords]
                            })
                    annotation_data = annotations
                    break  # 找到标注文件后跳出循环
                except Exception as e:
                    logger.error(f"Failed to read annotation file {label_path}: {e}")
        
        if has_annotation:
            break
    
    return has_annotation, annotation_data


def get_video_frame(video_abs_path: str, relative_video_path: str, frame_index: int, db: Session):
    """获取视频帧 - 优先从 extracted 目录加载"""
    logger.info(f"Getting frame for video: {video_abs_path}, relative: {relative_video_path}, index: {frame_index}")
    
    if not os.path.exists(video_abs_path):
        logger.error(f"Video file not found: {video_abs_path}")
        raise HTTPException(status_code=404, detail="视频文件不存在")
    
    # 检查是否有抽帧图片（优先从数据库加载）
    extraction_info = load_extraction_info(relative_video_path, db=db)
    logger.info(f"Extraction info: {extraction_info}")
    
    if extraction_info and 'extracted_dir' in extraction_info:
        extracted_dir = extraction_info['extracted_dir']
        logger.info(f"Extracted directory: {extracted_dir}")
        
        if os.path.exists(extracted_dir):
            # 从 extracted 目录加载图片
            frame_files = sorted([f for f in os.listdir(extracted_dir)
                                  if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
            logger.info(f"Found {len(frame_files)} extracted frames")
            
            if 0 <= frame_index < len(frame_files):
                frame_filename = frame_files[frame_index]
                frame_path = os.path.join(extracted_dir, frame_filename)
                
                # 检查图片文件是否存在
                if not os.path.exists(frame_path):
                    logger.error(f"Extracted frame file not found: {frame_path}")
                    raise HTTPException(status_code=404, detail=f"帧 {frame_index} 在抽帧目录中不存在")
                
                logger.info(f"Using extracted frame: {frame_path}")
                
                # 构建web访问路径
                rel_frame_path = os.path.relpath(frame_path, VIDEO_DIR)
                web_path = f"/data/videos/{rel_frame_path}".replace(os.sep, '/')
                logger.info(f"Web path: {web_path}")
                
                # 读取图片获取尺寸
                img = cv2.imread(frame_path)
                if img is None:
                    logger.error(f"Could not read frame image: {frame_path}")
                    raise HTTPException(status_code=500, detail="无法读取帧图片")
                
                height, width = img.shape[:2]
                
                # 检查标注
                has_annotation, annotation_data = check_annotation(
                    relative_video_path, frame_index, width, height, is_video=True, db=db
                )
                
                return {
                    "frameUrl": web_path,
                    "totalFrames": len(frame_files),
                    "hasAnnotation": has_annotation,
                    "annotations": annotation_data if has_annotation else [],
                    "type": "video",
                    "from_extracted": True
                }
            else:
                logger.warning(f"Frame index {frame_index} out of range (0-{len(frame_files) - 1})")
        else:
            logger.warning(f"Extracted directory does not exist: {extracted_dir}")
    else:
        logger.info("No extraction info found, using original video")
    
    # 如果没有抽帧图片或索引超出范围，fallback 到原来的视频帧提取
    cap = cv2.VideoCapture(video_abs_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if not (0 <= frame_index < total_frames):
        cap.release()
        raise HTTPException(status_code=400, detail="帧索引超出范围")
    
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        raise HTTPException(status_code=500, detail="无法读取该帧")
    
    # 保存临时帧
    video_filename_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', os.path.splitext(os.path.basename(relative_video_path))[0])
    frame_filename = f"{video_filename_safe}_frame_{frame_index}.jpg"
    frame_path_on_disk = os.path.join(TEMP_DIR, frame_filename)
    cv2.imwrite(frame_path_on_disk, frame)
    
    frame_url_for_web = f"/{STATIC_DIR}/temp/{frame_filename}"
    
    # 检查标注
    has_annotation, annotation_data = check_annotation(
        relative_video_path, frame_index, frame.shape[1], frame.shape[0], is_video=True, db=db
    )
    
    return {
        "frameUrl": frame_url_for_web,
        "totalFrames": total_frames,
        "hasAnnotation": has_annotation,
        "annotations": annotation_data if has_annotation else [],
        "type": "video",
        "from_extracted": False
    }


def get_image_frame(image_task_path: str, relative_task_path: str, image_index: int, db: Session):
    """获取图片任务中的图片"""
    logger.info(f"Getting image frame for: {image_task_path}, index: {image_index}")
    
    # 获取所有图片文件
    image_files = []
    for root, _, filenames in os.walk(image_task_path):
        for filename in filenames:
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                rel_path = os.path.relpath(os.path.join(root, filename), image_task_path)
                image_files.append(rel_path.replace(os.sep, '/'))
    
    image_files.sort()
    total_images = len(image_files)
    
    logger.info(f"Found {total_images} images")
    
    if not (0 <= image_index < total_images):
        raise HTTPException(status_code=400, detail="图片索引超出范围")
    
    # 获取指定图片
    image_rel_path = image_files[image_index]
    image_abs_path = os.path.join(image_task_path, image_rel_path)
    
    if not os.path.exists(image_abs_path):
        raise HTTPException(status_code=404, detail="图片不存在")
    
    try:
        # 读取图片
        img = cv2.imread(image_abs_path)
        if img is None:
            raise HTTPException(status_code=500, detail="无法读取图片")
        
        # 使用统一的文件名格式：taskname_img_index.jpg
        task_name_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', os.path.basename(relative_task_path))
        frame_filename = f"{task_name_safe}_img_{image_index}.jpg"
        frame_path_on_disk = os.path.join(TEMP_DIR, frame_filename)
        cv2.imwrite(frame_path_on_disk, img)
        
        frame_url_for_web = f"/{STATIC_DIR}/temp/{frame_filename}"
        
        # 检查标注
        has_annotation, annotation_data = check_annotation(
            relative_task_path, image_index, img.shape[1], img.shape[0], is_video=False, db=db
        )
        
        return {
            "frameUrl": frame_url_for_web,
            "totalFrames": total_images,
            "hasAnnotation": has_annotation,
            "annotations": annotation_data if has_annotation else [],
            "type": "image"
        }
    
    except Exception as e:
        logger.error(f"Failed to process image {image_abs_path}: {e}")
        raise HTTPException(status_code=500, detail=f"处理图片失败: {str(e)}")


@router.get("/videos/frame")
def get_frame(
    video_path: str = Query(...),
    frame_index: int = Query(...),
    db: Session = Depends(get_db)
):
    """获取视频或图片任务的指定帧（优化版，参照app.py）"""
    if not video_path or frame_index is None:
        raise HTTPException(status_code=400, detail="缺少参数")
    
    logger.info(f"Getting frame for: {video_path}, index: {frame_index}")
    
    # 检查是视频任务还是图片任务
    video_abs_path = os.path.join(VIDEO_DIR, video_path)
    image_task_path = os.path.join(IMAGE_DIR, video_path)
    
    if os.path.exists(video_abs_path):
        # 视频任务处理
        return get_video_frame(video_abs_path, video_path, frame_index, db)
    elif os.path.isdir(image_task_path):
        # 图片任务处理
        return get_image_frame(image_task_path, video_path, frame_index, db)
    else:
        raise HTTPException(status_code=404, detail="任务不存在")


@router.get("/task/last_annotated_frame")
def get_last_annotated_frame(
    user: str = Query(...),
    task_path: str = Query(...),
    db: Session = Depends(get_db)
):
    """获取最后标注的帧索引 - 优化版（支持所有格式）"""
    if not user or not task_path:
        raise HTTPException(status_code=400, detail="缺少参数")
    
    # 获取任务信息
    task = db.query(AnnotationTask).filter(AnnotationTask.task_path == task_path).first()
    
    project_name = 'default'
    if task:
        project_name = task.project_name or 'default'
    
    # 判断任务类型
    video_abs_path = os.path.join(VIDEO_DIR, task_path)
    image_abs_path = os.path.join(IMAGE_DIR, task_path)
    
    is_video_task = os.path.exists(video_abs_path) and not os.path.isdir(video_abs_path)
    is_image_task = os.path.isdir(image_abs_path)
    
    task_name = os.path.splitext(os.path.basename(task_path))[0]
    
    # 检查标注目录
    annotation_dir = os.path.join(SUCCESS_DIR, project_name, task_name)
    labels_dir = os.path.join(annotation_dir, 'labels')
    
    max_frame_index = -1
    
    if os.path.exists(labels_dir):
        for filename in os.listdir(labels_dir):
            if not filename.endswith('.txt'):
                continue
            
            # 尝试多种格式匹配
            match = None
            
            if is_video_task:
                # 视频任务格式
                # 格式1: {task_name}_frame_{index}.txt
                # 格式2: frame_{index:06d}.txt
                # 格式3: frame_{index}.txt
                match = re.search(r'_frame_(\d+)\.txt$', filename) or \
                       re.search(r'frame_(\d+)\.txt$', filename)
            elif is_image_task:
                # 图片任务格式
                # 格式: {task_name}_img_{index}.txt
                match = re.search(r'_img_(\d+)\.txt$', filename)
            
            if match:
                frame_index = int(match.group(1))
                max_frame_index = max(max_frame_index, frame_index)
    
    return {
        "last_frame_index": max_frame_index,
        "has_annotations": max_frame_index >= 0,
        "task_type": "video" if is_video_task else ("image" if is_image_task else "unknown")
    }


def get_video_cover_url(video_abs_path: str, video_rel_path: str) -> str:
    """生成视频封面URL，如果不存在则自动生成"""
    # 生成封面文件名
    cover_filename = f"{os.path.splitext(video_rel_path.replace(os.sep, '_').replace('/', '_'))[0]}.jpg"
    cover_path = os.path.join(COVERS_DIR, cover_filename)
    
    # 如果封面不存在，则生成
    if not os.path.exists(cover_path):
        try:
            if os.path.exists(video_abs_path):
                cap = cv2.VideoCapture(video_abs_path)
                ret, frame = cap.read()
                if ret:
                    cv2.imwrite(cover_path, frame)
                    logger.info(f"Generated cover for video: {video_rel_path}")
                cap.release()
            else:
                logger.warning(f"Video file not found: {video_abs_path}")
                return "/static/default_cover.jpg"
        except Exception as e:
            logger.error(f"Failed to generate cover for {video_abs_path}: {e}")
            return "/static/default_cover.jpg"
    
    return f"/static/covers/{cover_filename}"


def get_image_cover_url(first_image_abs_path: str, task_rel_path: str) -> str:
    """生成图片任务封面URL，如果不存在则自动生成"""
    # 生成封面文件名
    cover_filename = f"{task_rel_path.replace(os.sep, '_').replace('/', '_')}.jpg"
    cover_path = os.path.join(COVERS_DIR, cover_filename)
    
    # 如果封面不存在，则生成
    if not os.path.exists(cover_path):
        try:
            if first_image_abs_path and os.path.exists(first_image_abs_path):
                # 复制第一张图片作为封面
                shutil.copy2(first_image_abs_path, cover_path)
                logger.info(f"Generated cover for image task: {task_rel_path}")
            else:
                logger.warning(f"First image not found: {first_image_abs_path}")
                return "/static/default_cover.jpg"
        except Exception as e:
            logger.error(f"Failed to generate cover for {first_image_abs_path}: {e}")
            return "/static/default_cover.jpg"
    
    return f"/static/covers/{cover_filename}"


def get_task_stats_from_db(db: Session, task_path: str) -> dict:
    """从数据库获取任务的统计信息"""
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


def calculate_task_stats(task_path: str, task_type: str, project_name: str) -> dict:
    """计算任务的统计信息（扫描文件系统）"""
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
                    cap = cv2.VideoCapture(video_abs_path)
                    stats['total_images'] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    cap.release()
                except:
                    pass
        
        # 统计已标注信息
        annotation_dir = os.path.join(SUCCESS_DIR, project_name, video_filename)
        stats = _scan_annotation_dir_browse(annotation_dir, stats, is_video=True)
    
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
        stats = _scan_annotation_dir_browse(annotation_dir, stats, is_video=False)
    
    return stats


def _scan_annotation_dir_browse(annotation_dir: str, stats: dict, is_video: bool) -> dict:
    """扫描标注目录，更新统计信息"""
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


def get_annotation_stats(task_path: str, task_type: str, project_name: str, db: Session = None) -> dict:
    """
    获取任务的标注统计信息 - 优化版（优先从数据库读取）
    
    Args:
        task_path: 任务路径
        task_type: 任务类型
        project_name: 项目名称
        db: 数据库会话（可选，如果提供则尝试从数据库读取）
    
    Returns:
        dict: 统计信息
    """
    # 如果提供了数据库会话，尝试从数据库读取缓存的统计信息
    if db:
        cached_stats = get_task_stats_from_db(db, task_path)
        if cached_stats and cached_stats.get('stats_updated_at'):
            # 如果有缓存且不为空，直接返回（提升性能）
            return cached_stats
    
    # 如果没有缓存或数据库会话未提供，则扫描文件系统计算
    stats = calculate_task_stats(task_path, task_type, project_name)
    return stats


def get_annotation_stats_legacy(task_path: str, task_type: str, project_name: str) -> dict:
    """获取任务的标注统计信息 - 旧版实现（扫描文件系统）"""
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
                    cap = cv2.VideoCapture(video_abs_path)
                    stats['total_images'] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    cap.release()
                except:
                    pass
        
        # 统计已标注图片
        annotation_dir = os.path.join(SUCCESS_DIR, project_name, video_filename)
        if os.path.exists(annotation_dir):
            images_dir = os.path.join(annotation_dir, 'images')
            if os.path.exists(images_dir):
                stats['annotated_images'] = len([f for f in os.listdir(images_dir)
                                                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
            
            labels_dir = os.path.join(annotation_dir, 'labels')
            if os.path.exists(labels_dir):
                # 统计标签数量并获取最后标注帧
                max_frame_index = -1
                for label_file in os.listdir(labels_dir):
                    if label_file.endswith('.txt'):
                        label_path = os.path.join(labels_dir, label_file)
                        try:
                            # 正确统计标签：读取每一行，解析class_id
                            with open(label_path, 'r', encoding='utf-8') as f:
                                lines = f.readlines()
                                for line in lines:
                                    line = line.strip()
                                    if line:  # 跳过空行
                                        parts = line.split()
                                        if len(parts) > 0:
                                            class_id = parts[0]
                                            stats['label_counts'][class_id] = stats['label_counts'].get(class_id, 0) + 1
                                            stats['total_labels'] += 1
                            
                            # 解析帧索引（支持两种格式）
                            match = re.search(r'_frame_(\d+)\.txt$', label_file) or \
                                   re.search(r'frame_(\d+)\.txt$', label_file)
                            if match:
                                frame_index = int(match.group(1))
                                if frame_index > max_frame_index:
                                    max_frame_index = frame_index
                        except Exception as e:
                            logger.warning(f"Failed to read label file {label_path}: {e}")
                
                stats['last_annotated_frame'] = max_frame_index
    
    else:  # image task
        task_abs_path = os.path.join(IMAGE_DIR, task_path)
        if os.path.isdir(task_abs_path):
            for root, _, filenames in os.walk(task_abs_path):
                for filename in filenames:
                    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                        stats['total_images'] += 1
        
        # 统计已标注图片
        task_name = os.path.basename(task_path)
        annotation_dir = os.path.join(SUCCESS_DIR, project_name, task_name)
        if os.path.exists(annotation_dir):
            images_dir = os.path.join(annotation_dir, 'images')
            if os.path.exists(images_dir):
                stats['annotated_images'] = len([f for f in os.listdir(images_dir)
                                                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
            
            labels_dir = os.path.join(annotation_dir, 'labels')
            if os.path.exists(labels_dir):
                # 统计标签数量并获取最后标注帧（图片任务）
                max_img_index = -1
                for label_file in os.listdir(labels_dir):
                    if label_file.endswith('.txt'):
                        label_path = os.path.join(labels_dir, label_file)
                        try:
                            # 正确统计标签：读取每一行，解析class_id
                            with open(label_path, 'r', encoding='utf-8') as f:
                                lines = f.readlines()
                                for line in lines:
                                    line = line.strip()
                                    if line:  # 跳过空行
                                        parts = line.split()
                                        if len(parts) > 0:
                                            class_id = parts[0]
                                            stats['label_counts'][class_id] = stats['label_counts'].get(class_id, 0) + 1
                                            stats['total_labels'] += 1
                            
                            # 解析图片索引
                            match = re.search(r'_img_(\d+)\.txt$', label_file)
                            if match:
                                img_index = int(match.group(1))
                                if img_index > max_img_index:
                                    max_img_index = img_index
                        except Exception as e:
                            logger.warning(f"Failed to read label file {label_path}: {e}")
                
                stats['last_annotated_frame'] = max_img_index
    
    return stats
