"""
项目管理路由
"""
import os
import json
import glob
import shutil
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.models.models import Project, User, AnnotationTask, ReviewTask, VideoPool, ExtractionInfo
from app.core.dependencies import require_admin, is_admin, get_user_roles
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

DATA_DIR = 'data'
VIDEO_DIR = os.path.join(DATA_DIR, 'videos')
IMAGE_DIR = os.path.join(DATA_DIR, 'images')
IMAGE_ZIP_DIR = os.path.join(DATA_DIR, 'image_zips')
ANNOTATED_DIR = os.path.join(DATA_DIR, 'annotated')
SUCCESS_DIR = os.path.join(ANNOTATED_DIR, 'success')
REVIEW_DIR = os.path.join(ANNOTATED_DIR, 'review')
STATIC_DIR = 'static'
COVERS_DIR = os.path.join(STATIC_DIR, 'covers')
TEMP_DIR = os.path.join(STATIC_DIR, 'temp')
EXTRACTION_INFO_DIR = os.path.join(DATA_DIR, 'extraction_info')


class Label(BaseModel):
    id: int
    name: str
    color: str


class ProjectCreate(BaseModel):
    project_name: str
    description: Optional[str] = ""
    labels: List[Label] = []


class ProjectResponse(BaseModel):
    name: str
    description: str
    labels: List[dict]
    created_at: str


class LabelManageRequest(BaseModel):
    user: str
    project: str  # 前端发送的是"project"，不是"project_name"
    action: str  # add, edit(前端), delete
    label: Optional[dict] = None


@router.get("/admin/projects")
def get_projects(user: str = Query(...), db: Session = Depends(get_db)):
    """获取所有项目列表"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    projects = db.query(Project).all()
    result = {}
    for project in projects:
        # 格式化创建时间
        created_time = project.created_at.strftime('%Y-%m-%d %H:%M:%S') if project.created_at else '未知'

        result[project.name] = {
            "description": project.description,
            "labels": project.labels or [],
            "created_by": project.created_by or "未知",
            "created_time": created_time
        }

    return {"projects": result}


@router.post("/admin/create_project")
def create_project(
        request: ProjectCreate,
        user: str = Query(...),
        db: Session = Depends(get_db)
):
    """创建新项目"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    # 检查项目名是否已存在
    existing_project = db.query(Project).filter(
        Project.name == request.project_name
    ).first()

    if existing_project:
        raise HTTPException(status_code=400, detail="项目名称已存在")

    # 创建项目
    project = Project(
        name=request.project_name,
        description=request.description,
        labels=[label.dict() for label in request.labels],
        created_by=user
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    # 创建项目目录结构（只创建必要的目录，不创建labels.json）
    project_dir = os.path.join(DATA_DIR, 'projects', request.project_name)
    os.makedirs(project_dir, exist_ok=True)
    os.makedirs(os.path.join(project_dir, 'videos'), exist_ok=True)
    os.makedirs(os.path.join(project_dir, 'images'), exist_ok=True)

    logger.info(f"Project '{request.project_name}' created by user '{user}' with {len(request.labels)} labels")

    return {
        "message": f"项目 '{request.project_name}' 创建成功",
        "project": {
            "name": project.name,
            "description": project.description,
            "labels": project.labels
        }
    }


@router.get("/admin/project_labels")
def get_project_labels(
        user: str = Query(...),
        project_name: str = Query(...),
        db: Session = Depends(get_db)
):
    """获取项目标签"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    if not project_name:
        raise HTTPException(status_code=400, detail="项目名称不能为空")

    project = db.query(Project).filter(Project.name == project_name).first()

    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    return {"labels": project.labels or []}


@router.post("/admin/project_labels")
def manage_project_labels(
        request: LabelManageRequest,
        db: Session = Depends(get_db)
):
    """管理项目标签（兼容前端请求格式）"""
    # user从请求体中获取
    user = request.user
    project_name = request.project

    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    project = db.query(Project).filter(Project.name == project_name).first()

    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    labels = project.labels or []

    if request.action == 'add':
        # 添加新标签
        new_id = max([label['id'] for label in labels], default=-1) + 1
        new_label = {
            'id': new_id,
            'name': request.label.get('name'),
            'color': request.label.get('color', '#FF6B6B')  # 默认颜色
        }
        labels.append(new_label)
        logger.info(f"Added label '{new_label['name']}' to project '{project_name}'")

    elif request.action == 'edit':  # 前端发送的是'edit'，不是'update'
        # 编辑标签
        label_id = request.label.get('id')
        label_name = request.label.get('name')
        found = False
        for i, label in enumerate(labels):
            if label['id'] == label_id:
                labels[i]['name'] = label_name
                # 保留颜色
                if 'color' in request.label:
                    labels[i]['color'] = request.label['color']
                found = True
                logger.info(f"Edited label id={label_id} in project '{project_name}'")
                break
        if not found:
            raise HTTPException(status_code=404, detail="标签不存在")

    elif request.action == 'delete':
        # 删除标签
        label_id = request.label.get('id')
        original_count = len(labels)
        labels = [label for label in labels if label['id'] != label_id]
        if len(labels) == original_count:
            raise HTTPException(status_code=404, detail="标签不存在")
        logger.info(f"Deleted label id={label_id} from project '{project_name}'")

    else:
        raise HTTPException(status_code=400, detail="无效操作")

    # 更新数据库（只使用数据库存储，不使用文件）
    project.labels = labels
    # 重要：标记JSON字段已修改，否则SQLAlchemy可能不会检测到变化
    flag_modified(project, 'labels')
    db.commit()

    logger.info(f"Project '{project_name}' labels updated in database, total labels: {len(labels)}")

    action_text = {'add': '添加', 'edit': '编辑', 'delete': '删除'}.get(request.action, request.action)
    return {"message": f"标签{action_text}成功", "labels": labels}


@router.post("/admin/delete_project")
def delete_project(
        project_name: str = Query(...),
        user: str = Query(...),
        db: Session = Depends(get_db)
):
    """
    删除项目及所有相关数据（完整版）

    删除内容：
    1. 视频文件和目录（VIDEO_DIR/project_name）
    2. 图片任务和目录（IMAGE_DIR/project_name）
    3. 视频抽帧数据（在视频目录下）
    4. 标注数据（SUCCESS_DIR和REVIEW_DIR下的项目目录）
    5. 原始ZIP文件（IMAGE_ZIP_DIR/project_name）
    6. 封面图片（项目相关的所有封面）
    7. 临时文件（TEMP_DIR中项目相关文件）
    8. extraction_info文件（项目相关的所有抽帧信息）
    9. 数据库记录（Project, VideoPool, AnnotationTask, ReviewTask, ExtractionInfo）
    """
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    # 查找项目
    project = db.query(Project).filter(Project.name == project_name).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 统计删除信息
    deleted_items = {
        'files': [],
        'directories': [],
        'db_records': []
    }
    errors = []

    # 辅助函数：安全删除文件
    def safe_remove_file(file_path, description):
        try:
            if os.path.exists(file_path) and os.path.isfile(file_path):
                os.remove(file_path)
                deleted_items['files'].append(file_path)
                logger.info(f"Deleted {description}: {file_path}")
                return True
        except Exception as e:
            errors.append(f"删除{description}失败 ({file_path}): {str(e)}")
            logger.warning(f"Failed to delete {description} {file_path}: {e}")
        return False

    # 辅助函数：安全删除目录
    def safe_remove_dir(dir_path, description):
        try:
            if os.path.exists(dir_path) and os.path.isdir(dir_path):
                shutil.rmtree(dir_path)
                deleted_items['directories'].append(dir_path)
                logger.info(f"Deleted {description}: {dir_path}")
                return True
        except Exception as e:
            errors.append(f"删除{description}失败 ({dir_path}): {str(e)}")
            logger.warning(f"Failed to delete {description} {dir_path}: {e}")
        return False

    try:
        # ===== 1. 删除视频文件和相关数据 =====
        video_project_dir = os.path.join(VIDEO_DIR, project_name)
        if os.path.exists(video_project_dir):
            # 遍历项目下的所有视频
            for item in os.listdir(video_project_dir):
                item_path = os.path.join(video_project_dir, item)

                # 删除视频文件
                if os.path.isfile(item_path) and item.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                    # 删除封面图片
                    video_name = os.path.splitext(item)[0]
                    cover_filename = f"{project_name}_{video_name}.jpg"
                    cover_path = os.path.join(COVERS_DIR, cover_filename)
                    safe_remove_file(cover_path, "封面图片")

                    # 删除视频文件
                    safe_remove_file(item_path, "视频文件")

                # 删除抽帧后的图像目录（与视频同名的目录）
                elif os.path.isdir(item_path):
                    safe_remove_dir(item_path, "抽帧数据")

            # 删除项目视频目录
            safe_remove_dir(video_project_dir, "项目视频目录")

        # ===== 2. 删除图片任务和相关数据 =====
        image_project_dir = os.path.join(IMAGE_DIR, project_name)
        if os.path.exists(image_project_dir):
            safe_remove_dir(image_project_dir, "项目图片目录")

        # ===== 3. 删除原始ZIP文件 =====
        zip_project_dir = os.path.join(IMAGE_ZIP_DIR, project_name)
        if os.path.exists(zip_project_dir):
            safe_remove_dir(zip_project_dir, "原始ZIP目录")

        # ===== 4. 删除标注数据 =====
        # SUCCESS目录
        success_project_dir = os.path.join(SUCCESS_DIR, project_name)
        if os.path.exists(success_project_dir):
            safe_remove_dir(success_project_dir, "SUCCESS标注目录")

        # REVIEW目录
        review_project_dir = os.path.join(REVIEW_DIR, project_name)
        if os.path.exists(review_project_dir):
            safe_remove_dir(review_project_dir, "REVIEW标注目录")

        # ===== 5. 删除临时文件 =====
        if os.path.exists(TEMP_DIR):
            temp_pattern = os.path.join(TEMP_DIR, f"*{project_name}*")
            for temp_file in glob.glob(temp_pattern):
                safe_remove_file(temp_file, "临时文件")

        # ===== 6. 删除extraction_info文件 =====
        if os.path.exists(EXTRACTION_INFO_DIR):
            # 删除项目相关的所有extraction_info文件
            info_patterns = [
                os.path.join(EXTRACTION_INFO_DIR, f"{project_name}_*.json"),
                os.path.join(EXTRACTION_INFO_DIR, f"{project_name}*.json"),
                os.path.join(EXTRACTION_INFO_DIR, project_name)
            ]
            for pattern in info_patterns:
                if '*' in pattern:
                    for info_path in glob.glob(pattern):
                        if os.path.isfile(info_path):
                            safe_remove_file(info_path, "extraction_info")
                        elif os.path.isdir(info_path):
                            safe_remove_dir(info_path, "extraction_info目录")
                else:
                    if os.path.isfile(pattern):
                        safe_remove_file(pattern, "extraction_info")
                    elif os.path.isdir(pattern):
                        safe_remove_dir(pattern, "extraction_info目录")

        # ===== 7. 删除封面图片（通过项目名匹配） =====
        if os.path.exists(COVERS_DIR):
            cover_pattern = os.path.join(COVERS_DIR, f"{project_name}_*.jpg")
            for cover_file in glob.glob(cover_pattern):
                safe_remove_file(cover_file, "封面图片")

        # ===== 8. 删除项目配置目录 =====
        project_config_dir = os.path.join(DATA_DIR, 'projects', project_name)
        if os.path.exists(project_config_dir):
            safe_remove_dir(project_config_dir, "项目配置目录")

        # ===== 9. 批量删除数据库记录 =====
        # 批量查询所有相关记录
        video_pool_items = db.query(VideoPool).filter(VideoPool.path.like(f"{project_name}/%")).all()
        annotation_tasks = db.query(AnnotationTask).filter(AnnotationTask.project_name == project_name).all()
        review_tasks = db.query(ReviewTask).filter(ReviewTask.project_name == project_name).all()
        extraction_infos = db.query(ExtractionInfo).filter(ExtractionInfo.video_path.like(f"{project_name}/%")).all()

        # 批量删除
        for item in video_pool_items:
            db.delete(item)
            deleted_items['db_records'].append(f"VideoPool: {item.path}")

        for task in annotation_tasks:
            db.delete(task)
            deleted_items['db_records'].append(f"AnnotationTask: {task.task_path}")

        for task in review_tasks:
            db.delete(task)
            deleted_items['db_records'].append(f"ReviewTask: {task.task_path}")

        for info in extraction_infos:
            db.delete(info)
            deleted_items['db_records'].append(f"ExtractionInfo: {info.video_path}")

        # 删除项目本身
        db.delete(project)
        deleted_items['db_records'].append(f"Project: {project_name}")

        # 提交所有数据库更改
        db.commit()

        # 生成删除报告
        summary = {
            "message": f"项目 '{project_name}' 删除完成",
            "project_name": project_name,
            "deleted_files_count": len(deleted_items['files']),
            "deleted_dirs_count": len(deleted_items['directories']),
            "deleted_db_records_count": len(deleted_items['db_records']),
            "errors_count": len(errors)
        }

        if errors:
            summary['warnings'] = errors
            logger.warning(f"Project '{project_name}' deleted with {len(errors)} errors")
        else:
            logger.info(f"Project '{project_name}' completely deleted by user '{user}'")

        # 调试模式下返回详细信息
        if logger.level <= logging.DEBUG:
            summary['details'] = deleted_items

        return summary

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Delete project failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除项目失败: {str(e)}")


@router.get("/admin/project_task_stats")
def get_project_task_stats(
        user: str = Query(...),
        project: str = Query(...),
        db: Session = Depends(get_db)
):
    """
    获取项目的任务统计信息（优化版）

    直接从数据库读取统计信息，不遍历文件系统，提高性能
    使用AnnotationTask表中的缓存字段：total_images, annotated_images, total_labels, label_counts
    """
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    try:
        # 获取项目信息
        project_obj = db.query(Project).filter(Project.name == project).first()
        if not project_obj:
            raise HTTPException(status_code=404, detail="项目不存在")

        # 获取项目标签
        project_labels = project_obj.labels or []

        # 构建标签ID到名称的映射
        label_id_to_name = {}
        label_name_to_id = {}
        for label in project_labels:
            label_id = str(label.get('id'))
            label_name = label.get('name', f'标签{label_id}')
            label_id_to_name[label_id] = label_name
            label_name_to_id[label_name] = label_id

        # 获取该项目的所有标注任务（按创建时间倒序排序）
        annotation_tasks = db.query(AnnotationTask).filter(
            AnnotationTask.project_name == project
        ).order_by(AnnotationTask.created_at.desc()).all()

        # 获取已分配任务的路径集合，用于过滤
        assigned_task_paths = {task.task_path for task in annotation_tasks}

        # 获取该项目的未分配任务（从VideoPool查询），排除已在AnnotationTask中的任务
        all_unassigned = db.query(VideoPool).filter(
            VideoPool.path.like(f"{project}/%")
        ).order_by(VideoPool.added_at.desc()).all()

        # 过滤掉已经在AnnotationTask中存在的任务（避免重复计数）
        unassigned_tasks = [
            task for task in all_unassigned
            if task.path not in assigned_task_paths
        ]

        # 初始化统计变量
        task_list = []
        total_images = 0
        total_annotated = 0
        total_labels_count = 0
        label_counts = {}  # 按标签名称统计
        status_counts = {
            'in_progress': 0,
            'completed': 0,
            'unassigned': 0  # 添加未分配状态
        }

        # 遍历任务，从数据库读取统计信息
        for task in annotation_tasks:
            # 直接从数据库读取缓存的统计信息
            task_total_images = task.total_images or 0
            task_annotated = task.annotated_images or 0
            task_total_labels = task.total_labels or 0

            # 对于视频任务，检查是否已抽帧，未抽帧的视频任务图片数按0计算
            if task.task_path.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                # 是视频任务，检查extracted目录是否存在且有图片
                video_filename = os.path.splitext(os.path.basename(task.task_path))[0]
                extracted_dir = os.path.join(VIDEO_DIR, project, video_filename, 'extracted')

                if not os.path.exists(extracted_dir):
                    # 没有extracted目录，说明未抽帧，图片数按0计算
                    task_total_images = 0
                else:
                    # 有extracted目录，检查是否有图片文件
                    extracted_images = [f for f in os.listdir(extracted_dir)
                                        if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
                    if len(extracted_images) == 0:
                        # extracted目录为空，图片数按0计算
                        task_total_images = 0

            # 处理label_counts字段（可能是字符串或字典）
            task_label_counts = task.label_counts or {}
            if isinstance(task_label_counts, str):
                # 如果是字符串，解析为字典
                try:
                    task_label_counts = json.loads(task_label_counts)
                except (json.JSONDecodeError, ValueError) as e:
                    logger.warning(f"Failed to parse label_counts for task {task.task_path}: {e}")
                    task_label_counts = {}
            elif not isinstance(task_label_counts, dict):
                # 如果既不是字符串也不是字典，设为空字典
                logger.warning(f"Unexpected type for label_counts in task {task.task_path}: {type(task_label_counts)}")
                task_label_counts = {}

            task_status = task.status or 'in_progress'

            # 累加总计
            total_images += task_total_images
            total_annotated += task_annotated
            total_labels_count += task_total_labels

            # 统计任务状态
            if task_status in status_counts:
                status_counts[task_status] += 1
            else:
                status_counts[task_status] = 1

            # 合并标签统计（将label_id转为标签名称）
            task_label_display = {}
            for label_id, count in task_label_counts.items():
                label_name = label_id_to_name.get(str(label_id), f'标签{label_id}')
                task_label_display[label_name] = count
                # 累加到总计
                label_counts[label_name] = label_counts.get(label_name, 0) + count

            # 计算任务完成率
            task_progress = round((task_annotated / task_total_images * 100) if task_total_images > 0 else 0, 1)

            # 获取任务名称（从 task_path 提取）
            # task_path 格式: "project_name/video_name.mp4" 或 "project_name/images_task1"
            task_name = os.path.basename(task.task_path)
            # 如果是视频，去掉扩展名
            if task_name.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                task_name = os.path.splitext(task_name)[0]

            # 构建任务信息
            task_info = {
                'name': task_name,  # 任务名称
                'path': task.task_path,  # 任务路径
                'type': 'annotation',
                'assignee': task.assignee or '未分配',
                'status': task_status,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'stats': {
                    'total_images': task_total_images,
                    'annotated_images': task_annotated,
                    'total_labels': task_total_labels,
                    'label_counts': task_label_display,
                    'completion_rate': task_progress
                }
            }

            task_list.append(task_info)

        # 处理未分配的任务（从VideoPool）
        for unassigned in unassigned_tasks:
            # 获取任务名称
            task_name = os.path.basename(unassigned.path)
            if task_name.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                task_name = os.path.splitext(task_name)[0]
                is_video = True
            else:
                is_video = False

            # 计算未分配任务的图片数
            unassigned_total_images = 0
            if is_video:
                # 视频任务，检查是否抽帧
                video_filename = os.path.splitext(os.path.basename(unassigned.path))[0]
                extracted_dir = os.path.join(VIDEO_DIR, project, video_filename, 'extracted')

                if os.path.exists(extracted_dir):
                    extracted_images = [f for f in os.listdir(extracted_dir)
                                        if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
                    unassigned_total_images = len(extracted_images)
            else:
                # 图片任务，计算图片数
                task_abs_path = os.path.join(IMAGE_DIR, unassigned.path)
                if os.path.isdir(task_abs_path):
                    for root, _, filenames in os.walk(task_abs_path):
                        for filename in filenames:
                            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                                unassigned_total_images += 1

            # 累加到总图片数
            total_images += unassigned_total_images

            # 未分配任务状态计数
            status_counts['unassigned'] += 1

            # 构建未分配任务信息
            unassigned_task_info = {
                'name': task_name,
                'path': unassigned.path,
                'type': 'annotation',
                'assignee': '未分配',
                'status': 'unassigned',
                'created_at': unassigned.added_at.isoformat() if unassigned.added_at else None,
                'stats': {
                    'total_images': unassigned_total_images,
                    'annotated_images': 0,
                    'total_labels': 0,
                    'label_counts': {},
                    'completion_rate': 0
                }
            }

            task_list.append(unassigned_task_info)

        # 计算总体完成率
        overall_progress = round((total_annotated / total_images * 100) if total_images > 0 else 0, 1)

        # 构建返回结果
        result = {
            "project_name": project,
            "project_labels": project_labels,
            "annotation_tasks": task_list,
            "total_stats": {
                "total_tasks": len(annotation_tasks) + len(unassigned_tasks),  # 包含未分配任务
                "total_images": total_images,
                "total_annotated_images": total_annotated,
                "total_labels": total_labels_count,
                "overall_completion_rate": overall_progress,
                "label_counts": label_counts,
                "status_counts": status_counts
            }
        }

        logger.info(
            f"Project stats for '{project}': {len(annotation_tasks)} tasks, {total_images} images, {total_annotated} annotated")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project task stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取项目统计失败: {str(e)}")


@router.get("/labels")
def get_labels(
        user: Optional[str] = Query(None),
        project: Optional[str] = Query(None),
        db: Session = Depends(get_db)
):
    """获取用户有权限的标签"""
    try:
        # 如果指定了项目，返回该项目的标签
        if project:
            project_obj = db.query(Project).filter(Project.name == project).first()
            if project_obj:
                labels = project_obj.labels or []
                # 为每个标签添加项目信息
                for label in labels:
                    label['project'] = project
                return {"labels": labels}
            return {"labels": []}

        # 如果没有指定项目，返回用户有权限的所有项目的标签
        if not user:
            return {"labels": []}

        user_roles = get_user_roles(user, db)

        # 如果是管理员，返回所有项目的标签
        if 'admin' in user_roles:
            projects = db.query(Project).all()
            all_labels = []
            for proj in projects:
                for label in (proj.labels or []):
                    label_with_project = label.copy()
                    label_with_project['project'] = proj.name
                    all_labels.append(label_with_project)
            return {"labels": all_labels}

        # 普通用户：获取用户有权限的项目
        user_projects = get_user_projects(user, db)
        all_labels = []

        for project_name in user_projects:
            project_obj = db.query(Project).filter(Project.name == project_name).first()
            if project_obj:
                for label in (project_obj.labels or []):
                    label_with_project = label.copy()
                    label_with_project['project'] = project_name
                    all_labels.append(label_with_project)

        return {"labels": all_labels}

    except Exception as e:
        logger.error(f"Error loading labels: {e}")
        return {"labels": []}


@router.get("/user/projects")
def get_user_projects_endpoint(user: str = Query(...), db: Session = Depends(get_db)):
    """获取用户有权限的项目列表"""
    try:
        user_projects = get_user_projects(user, db)
        return {"projects": user_projects}
    except Exception as e:
        logger.error(f"Failed to get user projects: {e}")
        raise HTTPException(status_code=500, detail=f"获取用户项目失败: {str(e)}")


def get_user_projects(username: str, db: Session) -> list:
    """获取用户有权限的项目列表"""
    user_projects = set()

    # 检查标注任务
    annotation_tasks = db.query(AnnotationTask).filter(
        AnnotationTask.assignee == username
    ).all()
    for task in annotation_tasks:
        if task.project_name:
            user_projects.add(task.project_name)

    # 检查审核任务
    review_tasks = db.query(ReviewTask).filter(
        ReviewTask.assignee == username
    ).all()
    for task in review_tasks:
        if task.project_name:
            user_projects.add(task.project_name)

    return list(user_projects)

