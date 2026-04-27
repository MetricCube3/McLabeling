"""
任务管理路由
"""
import os
import cv2
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict
from app.core.database import get_db
from app.models.models import AnnotationTask, ReviewTask, VideoPool, Project, User, ExtractionInfo
from app.core.dependencies import is_admin
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# 目录常量
DATA_DIR = 'data'
VIDEO_DIR = os.path.join(DATA_DIR, 'videos')
IMAGE_DIR = os.path.join(DATA_DIR, 'images')


class TaskStatusRequest(BaseModel):
    user: str
    task_type: str  # annotation, review
    task_path: str
    status: str  # in_progress, completed


class TaskAssignRequest(BaseModel):
    task_type: str  # annotation, review
    items: List[str]  # 任务路径列表
    assignee: str  # 分配给谁


class TaskReassignRequest(BaseModel):
    user: str  # 管理员用户
    task_path: str
    task_type: str  # annotation, review
    new_assignee: str


def calculate_task_total_images(task_path: str, db: Session) -> int:
    """
    计算任务的总图片数

    对于视频任务：
    1. 优先从ExtractionInfo读取extracted_frame_count
    2. 如果没有抽帧信息，则从视频文件读取总帧数

    对于图片任务：
    1. 统计图片目录中的图片文件数量

    Args:
        task_path: 任务路径，格式如 "project_name/video_name.mp4" 或 "project_name/images_task1"
        db: 数据库会话

    Returns:
        int: 总图片数
    """
    try:
        # 判断是视频任务还是图片任务
        is_video = task_path.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))

        if is_video:
            # 视频任务：优先从ExtractionInfo读取
            extraction_info = db.query(ExtractionInfo).filter(
                ExtractionInfo.video_path == task_path
            ).first()

            if extraction_info and extraction_info.extracted_frame_count:
                # 有抽帧信息，使用抽取的帧数
                logger.info(f"Using extracted frame count from DB: {extraction_info.extracted_frame_count}")
                return extraction_info.extracted_frame_count

            # 没有抽帧信息，尝试从抽帧目录统计
            # 抽帧目录格式：data/videos/project_name/video_name/
            video_name = os.path.splitext(os.path.basename(task_path))[0]
            project_name = task_path.split('/')[0] if '/' in task_path else 'default'
            extracted_dir = os.path.join(VIDEO_DIR, project_name, video_name)

            if os.path.exists(extracted_dir) and os.path.isdir(extracted_dir):
                # 统计抽帧目录中的图片数量
                image_files = [f for f in os.listdir(extracted_dir)
                               if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp'))]
                image_count = len(image_files)
                if image_count > 0:
                    logger.info(f"Counted {image_count} extracted frames from directory")
                    return image_count

            # 最后尝试读取视频文件获取总帧数
            video_path = os.path.join(VIDEO_DIR, task_path)
            if os.path.exists(video_path):
                try:
                    cap = cv2.VideoCapture(video_path)
                    if cap.isOpened():
                        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                        cap.release()
                        if frame_count > 0:
                            logger.info(f"Read video frame count: {frame_count}")
                            return frame_count
                except Exception as e:
                    logger.warning(f"Failed to read video {video_path}: {e}")

        else:
            # 图片任务：统计图片目录中的文件数
            image_task_dir = os.path.join(IMAGE_DIR, task_path)
            if os.path.exists(image_task_dir) and os.path.isdir(image_task_dir):
                # 递归统计所有图片文件
                image_count = 0
                for root, _, files in os.walk(image_task_dir):
                    for file in files:
                        if file.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.tiff')):
                            image_count += 1

                if image_count > 0:
                    logger.info(f"Counted {image_count} images in directory")
                    return image_count

        # 如果都失败了，返回0
        logger.warning(f"Could not determine total images for task: {task_path}")
        return 0

    except Exception as e:
        logger.error(f"Error calculating total images for {task_path}: {e}", exc_info=True)
        return 0


@router.post("/task/status")
def set_task_status(request: TaskStatusRequest, db: Session = Depends(get_db)):
    """设置任务状态"""
    if not all([request.user, request.task_type, request.task_path, request.status]):
        raise HTTPException(status_code=400, detail="Missing parameters")

    # 定义状态到中文的映射
    status_mapping = {
        'in_progress': {
            'annotation': '标注中',
            'review': '审核中'
        },
        'completed': {
            'annotation': '标注完成',
            'review': '审核完成'
        }
    }

    def get_status_in_chinese(task_type, status):
        return status_mapping.get(status, {}).get(task_type, status)

    # 根据任务类型查询任务
    if request.task_type == 'annotation':
        task = db.query(AnnotationTask).filter(
            AnnotationTask.task_path == request.task_path
        ).first()
    elif request.task_type == 'review':
        task = db.query(ReviewTask).filter(
            ReviewTask.task_path == request.task_path
        ).first()
    else:
        raise HTTPException(status_code=400, detail=f"Invalid task type: {request.task_type}")

    if not task:
        raise HTTPException(
            status_code=404,
            detail=f"Task '{request.task_path}' not found in type '{request.task_type}'"
        )

    current_status = task.status

    # 检查用户是否存在
    user = db.query(User).filter(User.username == request.user).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # 管理员可以随时改变状态
    user_is_admin = is_admin(request.user, db)
    if user_is_admin:
        task.status = request.status
        db.commit()
        chinese_status = get_status_in_chinese(request.task_type, request.status)
        return {"message": f"任务状态更新为: {chinese_status}"}

    # 非管理员用户的规则
    if request.status == 'in_progress':
        raise HTTPException(status_code=403, detail="只有管理员可以重新打开任务")

    if request.status == 'completed' and current_status == 'completed':
        raise HTTPException(status_code=400, detail="任务已经完成")

    task.status = request.status
    db.commit()
    chinese_status = get_status_in_chinese(request.task_type, request.status)

    return {"message": f"任务状态更新为: {chinese_status}"}


@router.get("/admin/assignment_data")
def get_assignment_data(user: str = Query(...), db: Session = Depends(get_db)):
    """获取任务分配数据"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    # 获取视频池
    video_pool = db.query(VideoPool).all()
    pool_items = [item.path for item in video_pool]

    # 获取所有用户（包含roles信息）
    users = db.query(User).all()
    user_dict = {}
    for u in users:
        user_dict[u.username] = {
            'roles': u.roles if u.roles is not None else []
        }

    # 获取标注任务
    annotation_tasks = db.query(AnnotationTask).all()
    annotation_data = {}
    for task in annotation_tasks:
        annotation_data[task.task_path] = {
            'assignee': task.assignee,
            'status': task.status,
            'project': task.project_name
        }

    # 获取审核任务
    review_tasks = db.query(ReviewTask).all()
    review_data = {}
    for task in review_tasks:
        review_data[task.task_path] = {
            'assignee': task.assignee,
            'status': task.status,
            'project': task.project_name
        }

    # 获取已完成的标注任务（可分配给审核）
    # 排除已经分配了审核任务的
    completed_annotation_tasks = db.query(AnnotationTask).filter(
        AnnotationTask.status == 'completed'
    ).all()

    # 获取所有审核任务的task_path（用于过滤）
    existing_review_paths = set([rt.task_path for rt in review_tasks])

    completed_list = []
    for task in completed_annotation_tasks:
        # 检查是否已经有对应的审核任务
        # 审核任务路径格式：success/project_name/task_name
        task_name = task.task_path.split('/')[-1] if '/' in task.task_path else task.task_path
        task_name = os.path.splitext(task_name)[0]  # 移除扩展名
        review_task_path = f"success/{task.project_name or 'default'}/{task_name}"

        # 只显示还没有审核任务的已完成标注
        if review_task_path not in existing_review_paths:
            project_name = task.project_name or 'default'
            display_name = f"{task_name} [{project_name}]"  # 任务名 [项目名]
            completed_list.append({
                'path': task.task_path,  # 保持原始标注任务路径
                'name': display_name,  # 显示格式：任务名 [项目名]
                'task_name': task_name,  # 保留纯任务名
                'project': project_name,
                'annotation_task_id': task.id  # 添加标注任务ID，便于关联
            })

    return {
        "video_pool": pool_items,
        "users": user_dict,
        "completed_annotations": completed_list,
        "tasks": {
            "annotation": annotation_data,
            "review": review_data
        }
    }


@router.post("/admin/assign_task")
def assign_task(
        request: TaskAssignRequest,
        user: str = Query(...),
        db: Session = Depends(get_db)
):
    """分配任务（与app.py保持一致）"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    if not request.items or not request.assignee:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # 检查用户是否存在
    assignee = db.query(User).filter(User.username == request.assignee).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="分配的用户不存在")

    assigned_count = 0

    # 性能优化：批量查询标注任务（仅审核任务需要）
    annotation_tasks_dict = {}
    if request.task_type == 'review':
        annotation_tasks = db.query(AnnotationTask).filter(
            AnnotationTask.task_path.in_(request.items)
        ).all()
        annotation_tasks_dict = {task.task_path: task for task in annotation_tasks}

    for item_path in request.items:
        # 解析项目名称
        project_name = None

        if request.task_type == 'annotation':
            # 标注任务：从任务路径中提取项目名称
            if '/' in item_path:
                project_name = item_path.split('/')[0]
            else:
                project_name = 'default'
        else:
            # 审核任务：从路径中提取项目名称，格式为 "success/project_name/task_name"
            path_parts = item_path.split('/')
            if len(path_parts) >= 2 and path_parts[0] == 'success':
                project_name = path_parts[1]
            else:
                project_name = 'default'

        # 检查项目是否存在
        if project_name and project_name != 'default':
            project = db.query(Project).filter(Project.name == project_name).first()
            if not project:
                logger.warning(f"Project {project_name} not found for task {item_path}, skipping assignment")
                continue

        # 根据任务类型分配
        if request.task_type == 'annotation':
            # 检查是否已经存在相同的任务路径
            existing_task = db.query(AnnotationTask).filter(
                AnnotationTask.task_path == item_path
            ).first()

            if existing_task:
                # 更新现有任务的分配者和状态
                existing_task.assignee = request.assignee
                existing_task.status = 'in_progress'

                # 更新项目名（特别是从 'default' 更新为正确的项目名）
                if project_name and (existing_task.project_name != project_name):
                    logger.info(
                        f"Updating project_name for task {item_path}: '{existing_task.project_name}' -> '{project_name}'")
                    existing_task.project_name = project_name

                # 如果total_images为0，尝试重新计算
                if existing_task.total_images == 0:
                    total_images = calculate_task_total_images(item_path, db)
                    if total_images > 0:
                        existing_task.total_images = total_images
                        logger.info(f"Updated total_images for existing task {item_path}: {total_images}")
            else:
                # 计算任务的总图片数
                total_images = calculate_task_total_images(item_path, db)

                # 创建新任务，包含项目信息和总图片数
                new_task = AnnotationTask(
                    task_path=item_path,
                    project_name=project_name,
                    assignee=request.assignee,
                    status='in_progress',
                    total_images=total_images,
                    annotated_images=0,
                    total_labels=0
                )
                db.add(new_task)
                logger.info(f"Created new task {item_path} with total_images={total_images}")

            # 如果是分配标注任务，需从video_pool中移除
            pool_item = db.query(VideoPool).filter(VideoPool.path == item_path).first()
            if pool_item:
                db.delete(pool_item)
                logger.info(f"Removed {item_path} from video_pool")

            assigned_count += 1

        elif request.task_type == 'review':
            # 审核任务分配逻辑
            # item_path 是标注任务的路径，需要转换为审核任务路径

            # 1. 从预查询的字典中获取标注任务（性能优化）
            annotation_task = annotation_tasks_dict.get(item_path)

            if not annotation_task:
                logger.warning(f"Annotation task not found: {item_path}")
                continue

            # 确保使用正确的项目名称
            project_name = annotation_task.project_name or 'default'

            # 2. 构建审核任务路径：success/project_name/task_name
            task_name = item_path.split('/')[-1] if '/' in item_path else item_path
            task_name = os.path.splitext(task_name)[0]  # 移除扩展名
            review_task_path = f"success/{project_name}/{task_name}"

            # 3. 检查是否已经存在审核任务
            existing_task = db.query(ReviewTask).filter(
                ReviewTask.task_path == review_task_path
            ).first()

            if existing_task:
                # 更新现有任务的分配者和状态
                existing_task.assignee = request.assignee
                existing_task.status = 'in_progress'
                existing_task.project_name = project_name
                # 关联到标注任务
                if not existing_task.annotation_task_id:
                    existing_task.annotation_task_id = annotation_task.id
                logger.info(f"Updated review task: {review_task_path} -> {request.assignee}")
            else:
                # 创建新审核任务
                new_task = ReviewTask(
                    task_path=review_task_path,
                    project_name=project_name,
                    assignee=request.assignee,
                    status='in_progress',
                    annotation_task_id=annotation_task.id  # 关联到标注任务
                )
                db.add(new_task)
                logger.info(f"Created review task: {review_task_path} -> {request.assignee}")

            assigned_count += 1

    db.commit()

    if assigned_count == 0:
        raise HTTPException(status_code=400, detail="没有成功分配任何任务，请检查项目配置")

    logger.info(f"User {user} assigned {assigned_count} tasks to {request.assignee}")

    return {
        "message": f"{assigned_count} 个任务成功分配到用户: {request.assignee}"
    }


@router.post("/admin/task/reassign")
def reassign_task(request: TaskReassignRequest, db: Session = Depends(get_db)):
    """重新分配任务（支持未分配的任务直接分配）"""
    if not is_admin(request.user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    if not all([request.task_path, request.task_type, request.new_assignee]):
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # 检查新分配的用户是否存在
    new_user = db.query(User).filter(User.username == request.new_assignee).first()
    if not new_user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 根据任务类型查找并更新任务
    if request.task_type == 'annotation':
        task = db.query(AnnotationTask).filter(
            AnnotationTask.task_path == request.task_path
        ).first()

        if task:
            # 任务已存在，更新分配
            old_assignee = task.assignee
            task.assignee = request.new_assignee
            task.status = 'in_progress'

            # 修复：如果项目名是 'default' 但可以从路径中提取正确的项目名，则更新
            if task.project_name == 'default' and '/' in request.task_path:
                extracted_project = request.task_path.split('/')[0]
                # 验证提取的项目名是否存在
                project = db.query(Project).filter(Project.name == extracted_project).first()
                if project:
                    task.project_name = extracted_project
                    logger.info(
                        f"Updated project_name from 'default' to '{extracted_project}' for task {request.task_path}")

            # 如果total_images为0，尝试重新计算
            if task.total_images == 0:
                total_images = calculate_task_total_images(request.task_path, db)
                if total_images > 0:
                    task.total_images = total_images
                    logger.info(f"Updated total_images for task {request.task_path}: {total_images}")

            # 重新分配时，从video_pool中删除（如果存在）
            # 这样可以处理管理员标注后重新分配的场景
            pool_item = db.query(VideoPool).filter(VideoPool.path == request.task_path).first()
            if pool_item:
                db.delete(pool_item)
                logger.info(f"Removed task {request.task_path} from video_pool after reassignment")

            logger.info(f"Task {request.task_path} reassigned from {old_assignee} to {request.new_assignee}")
        else:
            # 任务不存在，可能是未分配的任务（在video_pool中）
            # 检查是否在video_pool中
            pool_item = db.query(VideoPool).filter(VideoPool.path == request.task_path).first()

            if not pool_item:
                raise HTTPException(status_code=404, detail="任务不存在（既不在已分配任务中，也不在待分配任务池中）")

            # 解析项目名称
            project_name = None
            if '/' in request.task_path:
                project_name = request.task_path.split('/')[0]
            else:
                project_name = 'default'

            # 检查项目是否存在
            if project_name and project_name != 'default':
                project = db.query(Project).filter(Project.name == project_name).first()
                if not project:
                    logger.warning(f"Project {project_name} not found for task {request.task_path}")
                    project_name = 'default'

            # 计算任务的总图片数
            total_images = calculate_task_total_images(request.task_path, db)

            # 创建新的标注任务
            new_task = AnnotationTask(
                task_path=request.task_path,
                project_name=project_name,
                assignee=request.new_assignee,
                status='in_progress',
                total_images=total_images,
                annotated_images=0,
                total_labels=0
            )
            db.add(new_task)

            # 从video_pool中删除
            db.delete(pool_item)

            logger.info(
                f"Task {request.task_path} assigned to {request.new_assignee} (from video_pool) with total_images={total_images}")

    elif request.task_type == 'review':
        task = db.query(ReviewTask).filter(
            ReviewTask.task_path == request.task_path
        ).first()

        if not task:
            raise HTTPException(status_code=404, detail="审核任务不存在")

        # 更新审核任务分配
        old_assignee = task.assignee
        task.assignee = request.new_assignee
        task.status = 'in_progress'
        logger.info(f"Review task {request.task_path} reassigned from {old_assignee} to {request.new_assignee}")

    else:
        raise HTTPException(status_code=400, detail="无效的任务类型")

    db.commit()

    return {
        "message": f"任务已重新分配给 {request.new_assignee}"
    }

