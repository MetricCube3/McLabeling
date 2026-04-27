"""
管理员功能路由
处理数据集管理、文件上传等管理员操作
"""
import os
import shutil
import re
import zipfile
import glob
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from app.core.database import get_db
from app.models.models import VideoPool, Project, AnnotationTask, ReviewTask, ExtractionInfo
from app.core.dependencies import is_admin
from app.utils.utils import extract_zip_and_get_images, format_file_size
from werkzeug.utils import secure_filename
import logging
import tempfile
import json

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


@router.get("/dataset_stats")
def get_dataset_stats(
        user: str = Query(...),
        project: Optional[str] = Query(None),
        db: Session = Depends(get_db)
):
    """获取数据集统计信息"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    try:
        video_count = 0
        image_task_count = 0

        # 统计视频文件
        if project:
            # 统计特定项目的视频
            project_video_dir = os.path.join(VIDEO_DIR, project)
            if os.path.exists(project_video_dir):
                for root, _, files in os.walk(project_video_dir):
                    for file in files:
                        if file.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                            video_count += 1
        else:
            # 统计所有视频
            if os.path.exists(VIDEO_DIR):
                for root, _, files in os.walk(VIDEO_DIR):
                    for file in files:
                        if file.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                            video_count += 1

        # 统计图片任务（优化性能：只检查目录中是否有图片，不递归）
        if project:
            # 统计特定项目的图片任务
            project_image_dir = os.path.join(IMAGE_DIR, project)
            if os.path.exists(project_image_dir):
                for item in os.listdir(project_image_dir):
                    item_path = os.path.join(project_image_dir, item)
                    if os.path.isdir(item_path):
                        # 快速检查：只看顶层是否有图片文件
                        try:
                            files = os.listdir(item_path)
                            has_images = any(
                                f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff'))
                                for f in files[:100]  # 只检查前100个文件，避免性能问题
                            )
                            if has_images:
                                image_task_count += 1
                        except (PermissionError, OSError):
                            continue
        else:
            # 统计所有图片任务
            if os.path.exists(IMAGE_DIR):
                for project_dir in os.listdir(IMAGE_DIR):
                    project_path = os.path.join(IMAGE_DIR, project_dir)
                    if os.path.isdir(project_path):
                        for item in os.listdir(project_path):
                            item_path = os.path.join(project_path, item)
                            if os.path.isdir(item_path):
                                # 快速检查：只看顶层是否有图片文件
                                try:
                                    files = os.listdir(item_path)
                                    has_images = any(
                                        f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff'))
                                        for f in files[:100]  # 只检查前100个文件
                                    )
                                    if has_images:
                                        image_task_count += 1
                                except (PermissionError, OSError):
                                    continue

        total_datasets = video_count + image_task_count

        logger.info(f"Dataset stats: videos={video_count}, images={image_task_count}, total={total_datasets}")

        return {
            "video_count": video_count,
            "image_task_count": image_task_count,
            "total_datasets": total_datasets
        }

    except Exception as e:
        logger.error(f"获取统计信息失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")


@router.get("/datasets")
def get_datasets(
        user: str = Query(...),
        project: Optional[str] = Query(None),
        db: Session = Depends(get_db)
):
    """获取数据集列表（包括视频和图片任务）"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    try:
        datasets = []

        # 1. 获取视频文件
        if project:
            # 获取特定项目的视频
            project_video_dir = os.path.join(VIDEO_DIR, project)
            if os.path.exists(project_video_dir):
                for root, _, files in os.walk(project_video_dir):
                    for file in files:
                        if file.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                            file_path = os.path.join(root, file)
                            rel_path = os.path.relpath(file_path, VIDEO_DIR).replace(os.sep, '/')

                            mtime = os.path.getmtime(file_path)
                            upload_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M')
                            file_size = format_file_size(os.path.getsize(file_path))

                            datasets.append({
                                "name": file,
                                "path": rel_path,
                                "type": "video",
                                "upload_time": upload_time,
                                "file_size": file_size,
                                "project": project
                            })
        else:
            # 获取所有视频（按项目分组）
            if os.path.exists(VIDEO_DIR):
                for project_dir in os.listdir(VIDEO_DIR):
                    project_path = os.path.join(VIDEO_DIR, project_dir)
                    if os.path.isdir(project_path):
                        for root, _, files in os.walk(project_path):
                            for file in files:
                                if file.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                                    file_path = os.path.join(root, file)
                                    rel_path = os.path.relpath(file_path, VIDEO_DIR).replace(os.sep, '/')

                                    mtime = os.path.getmtime(file_path)
                                    upload_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M')
                                    file_size = format_file_size(os.path.getsize(file_path))

                                    datasets.append({
                                        "name": file,
                                        "path": rel_path,
                                        "type": "video",
                                        "upload_time": upload_time,
                                        "file_size": file_size,
                                        "project": project_dir
                                    })

        # 2. 获取图片任务
        if project:
            # 获取特定项目的图片任务
            project_image_dir = os.path.join(IMAGE_DIR, project)
            if os.path.exists(project_image_dir):
                for item in os.listdir(project_image_dir):
                    item_path = os.path.join(project_image_dir, item)
                    if os.path.isdir(item_path) and item.startswith('images_'):
                        mtime = os.path.getmtime(item_path)
                        upload_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M')

                        image_count = 0
                        for root, _, files in os.walk(item_path):
                            for file in files:
                                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                                    image_count += 1

                        datasets.append({
                            "name": f"{item}",
                            "path": os.path.join(project, item).replace(os.sep, '/'),
                            "type": "image",
                            "upload_time": upload_time,
                            "image_count": image_count,
                            "project": project
                        })
        else:
            # 获取所有图片任务（按项目分组）
            if os.path.exists(IMAGE_DIR):
                for project_dir in os.listdir(IMAGE_DIR):
                    project_path = os.path.join(IMAGE_DIR, project_dir)
                    if os.path.isdir(project_path):
                        for item in os.listdir(project_path):
                            item_path = os.path.join(project_path, item)
                            if os.path.isdir(item_path) and item.startswith('images_'):
                                mtime = os.path.getmtime(item_path)
                                upload_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M')

                                image_count = 0
                                for root, _, files in os.walk(item_path):
                                    for file in files:
                                        if file.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                                            image_count += 1

                                datasets.append({
                                    "name": f"{item}",
                                    "path": os.path.join(project_dir, item).replace(os.sep, '/'),
                                    "type": "image",
                                    "upload_time": upload_time,
                                    "image_count": image_count,
                                    "project": project_dir
                                })

        # 按上传时间排序（最新的在前）
        datasets.sort(key=lambda x: x['upload_time'], reverse=True)

        logger.info(f"Found {len(datasets)} datasets")
        return {"datasets": datasets}

    except Exception as e:
        logger.error(f"获取数据集列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取数据集列表失败: {str(e)}")


@router.post("/upload_images")
async def admin_upload_images(
        request: Request,
        db: Session = Depends(get_db)
):
    """上传图片ZIP文件（支持'images[]'字段名）"""
    try:
        # 解析multipart/form-data
        form = await request.form()

        # 获取表单字段
        user = form.get('user')
        project = form.get('project')

        if not user:
            raise HTTPException(status_code=400, detail="缺少user参数")

        if not is_admin(user, db):
            raise HTTPException(status_code=403, detail="需要管理员权限")

        if not project:
            raise HTTPException(status_code=400, detail="请选择项目")

        # 检查项目是否存在
        project_obj = db.query(Project).filter(Project.name == project).first()
        if not project_obj:
            raise HTTPException(status_code=404, detail="项目不存在")

        # 获取上传的文件（支持'images[]'字段名）
        uploaded_files = form.getlist('images[]')
        if not uploaded_files:
            raise HTTPException(status_code=400, detail="没有选择文件")

        # 只处理zip文件
        zip_files = [f for f in uploaded_files if hasattr(f, 'filename') and f.filename.lower().endswith('.zip')]
        if not zip_files:
            raise HTTPException(status_code=400, detail="没有选择zip文件")

        # 找到当前最大图片任务索引
        project_image_dir = os.path.join(IMAGE_DIR, project)
        os.makedirs(project_image_dir, exist_ok=True)

        max_task_index = 0
        task_pattern = re.compile(r'images_(\d+)')
        if os.path.exists(project_image_dir):
            for item in os.listdir(project_image_dir):
                match = task_pattern.match(item)
                if match:
                    max_task_index = max(max_task_index, int(match.group(1)))

        uploaded_tasks = []
        current_task_index = max_task_index + 1

        for zip_file in zip_files:
            # 保存zip文件
            zip_filename = secure_filename(zip_file.filename)
            project_zip_dir = os.path.join(IMAGE_ZIP_DIR, project)
            os.makedirs(project_zip_dir, exist_ok=True)
            zip_save_path = os.path.join(project_zip_dir, zip_filename)

            # 保存上传的文件
            content = await zip_file.read()
            with open(zip_save_path, 'wb') as f:
                f.write(content)

            # 创建解压目录
            task_dir_name = f"images_{current_task_index}"
            extract_dir = os.path.join(project_image_dir, task_dir_name)
            os.makedirs(extract_dir, exist_ok=True)

            # 解压并获取图片列表
            image_files = extract_zip_and_get_images(zip_save_path, extract_dir)

            if not image_files:
                logger.warning(f"No images found in zip file {zip_filename}")
                # 解压失败或无图片，不删除压缩包以便排查问题
                continue

            # 解压成功，删除原始压缩包以节省存储空间
            try:
                os.remove(zip_save_path)
                logger.info(f"Successfully extracted and removed zip file: {zip_filename}")
            except Exception as e:
                logger.warning(f"Failed to remove zip file {zip_filename}: {e}")
                # 删除失败不影响主流程，继续执行

            # 创建任务路径
            task_path = os.path.join(project, task_dir_name).replace(os.sep, '/')

            # 添加到视频池
            existing_pool_item = db.query(VideoPool).filter(VideoPool.path == task_path).first()
            if not existing_pool_item:
                pool_item = VideoPool(
                    path=task_path,
                    project_id=project_obj.id,
                    is_video=False
                )
                db.add(pool_item)

            uploaded_tasks.append({
                'task_name': task_dir_name,
                'image_count': len(image_files),
                'path': task_path,
                'project': project
            })

            current_task_index += 1

        db.commit()
        logger.info(f"Successfully uploaded {len(uploaded_tasks)} image tasks to project {project}")

        return {
            "message": f"成功上传 {len(uploaded_tasks)} 个图片任务到项目 {project}",
            "uploaded_tasks": uploaded_tasks
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload images failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.post("/upload")
async def admin_upload_videos(
        request: Request,
        db: Session = Depends(get_db)
):
    """上传视频文件（支持'videos[]'字段名）"""
    try:
        # 解析multipart/form-data
        form = await request.form()

        # 获取表单字段
        user = form.get('user')
        project = form.get('project')

        if not user:
            raise HTTPException(status_code=400, detail="缺少user参数")

        if not is_admin(user, db):
            raise HTTPException(status_code=403, detail="需要管理员权限")

        if not project:
            raise HTTPException(status_code=400, detail="请选择项目")

        # 检查项目是否存在
        project_obj = db.query(Project).filter(Project.name == project).first()
        if not project_obj:
            raise HTTPException(status_code=404, detail="项目不存在")

        # 获取上传的文件（支持'videos[]'字段名）
        uploaded_files_form = form.getlist('videos[]')
        if not uploaded_files_form:
            raise HTTPException(status_code=400, detail="没有选择文件")

        # 找到当前最大视频索引（与app.py保持一致）
        max_video_index = 0
        video_pattern = re.compile(r'video(\d+)\.')
        for root, _, files in os.walk(VIDEO_DIR):
            for file in files:
                match = video_pattern.search(file)
                if match:
                    max_video_index = max(max_video_index, int(match.group(1)))

        # 创建项目视频目录
        project_video_dir = os.path.join(VIDEO_DIR, project)
        os.makedirs(project_video_dir, exist_ok=True)

        uploaded_files = []
        current_video_index = max_video_index + 1

        for video_file in uploaded_files_form:
            if hasattr(video_file, 'filename') and video_file.filename:
                # 使用video{index}命名（与app.py保持一致）
                _, extension = os.path.splitext(video_file.filename)
                new_filename = f"video{current_video_index}{extension}"
                file_path = os.path.join(project_video_dir, new_filename)

                # 保存文件
                content = await video_file.read()
                with open(file_path, 'wb') as f:
                    f.write(content)

                # 添加到视频池
                relative_path = os.path.join(project, new_filename).replace(os.sep, '/')
                existing_pool_item = db.query(VideoPool).filter(VideoPool.path == relative_path).first()
                if not existing_pool_item:
                    pool_item = VideoPool(
                        path=relative_path,
                        project_id=project_obj.id,
                        is_video=True
                    )
                    db.add(pool_item)

                uploaded_files.append(new_filename)
                current_video_index += 1

        db.commit()
        logger.info(f"Successfully uploaded {len(uploaded_files)} videos to project {project}")

        return {
            "message": f"成功上传 {len(uploaded_files)} 个视频到项目 {project}",
            "uploaded_files": uploaded_files
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload videos failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


def get_project_task_stats(project_name: str, db: Session):
    """
    获取项目任务统计信息（内部函数 - 优化版）

    从数据库读取统计信息，不遍历文件系统
    """
    try:
        project = db.query(Project).filter(Project.name == project_name).first()
        if not project:
            return None

        # 从数据库查询该项目的所有任务
        annotation_tasks = db.query(AnnotationTask).filter(
            AnnotationTask.project_name == project_name
        ).all()

        review_tasks = db.query(ReviewTask).filter(
            ReviewTask.project_name == project_name
        ).all()

        # 获取已分配任务的路径集合，用于过滤VideoPool
        assigned_task_paths = {task.task_path for task in annotation_tasks}

        # 查询未分配任务，排除已在AnnotationTask中的任务
        all_unassigned = db.query(VideoPool).filter(
            VideoPool.path.like(f"{project_name}/%")
        ).all()

        unassigned_tasks = [
            task for task in all_unassigned
            if task.path not in assigned_task_paths
        ]

        # 统计信息
        total_images = 0
        total_annotated = 0
        total_labels = 0

        for task in annotation_tasks:
            total_images += task.total_images or 0
            total_annotated += task.annotated_images or 0
            total_labels += task.total_labels or 0

        # 统计任务状态
        completed_tasks = len([t for t in annotation_tasks if t.status == 'completed'])
        in_progress_tasks = len([t for t in annotation_tasks if t.status == 'in_progress'])

        stats = {
            'total_images': total_images,
            'total_annotated': total_annotated,
            'total_labels': total_labels,
            'annotated_tasks': completed_tasks,
            'reviewed_tasks': len(review_tasks),
            'total_tasks': len(annotation_tasks) + len(unassigned_tasks),  # 包含未分配任务
            'in_progress_tasks': in_progress_tasks,
            'completion_rate': round((total_annotated / total_images * 100) if total_images > 0 else 0, 1)
        }

        return stats

    except Exception as e:
        logger.error(f"Failed to get project task stats: {e}")
        return None


@router.post("/delete_dataset")
async def delete_dataset(
        request: Request,
        db: Session = Depends(get_db)
):
    """
    删除数据集及所有相关数据（优化版）

    删除内容：
    1. 原始数据（视频文件或图片目录）
    2. 封面图片
    3. 切帧后的数据
    4. 标注数据（SUCCESS_DIR和REVIEW_DIR）
    5. 原始zip文件（图片数据集）
    6. 临时文件（TEMP_DIR）
    7. extraction_info文件
    8. 数据库记录（VideoPool, AnnotationTask, ReviewTask, ExtractionInfo）

    优化：
    - 批量数据库查询
    - 更精确的文件匹配
    - 容错处理
    - 详细删除报告
    """
    deleted_items = {
        'files': [],
        'directories': [],
        'db_records': []
    }
    errors = []

    try:
        # 解析请求数据
        data = await request.json()
        user = data.get('user')
        path = data.get('path')
        dataset_type = data.get('type')

        if not user:
            raise HTTPException(status_code=400, detail="缺少user参数")

        if not is_admin(user, db):
            raise HTTPException(status_code=403, detail="需要管理员权限")

        if not path or not dataset_type:
            raise HTTPException(status_code=400, detail="缺少path或type参数")

        logger.info(f"Deleting dataset: path={path}, type={dataset_type}, user={user}")

        # 辅助函数：安全删除文件
        def safe_remove_file(file_path, description):
            try:
                if os.path.exists(file_path):
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

        # 解析路径信息
        project_name = os.path.dirname(path) or 'default'
        file_or_dir_name = os.path.basename(path)
        base_name = os.path.splitext(file_or_dir_name)[0]

        if dataset_type == 'video':
            # ===== 删除视频文件及相关数据 =====

            # 1. 删除原始视频文件
            video_path = os.path.join(VIDEO_DIR, path)
            safe_remove_file(video_path, "视频文件")

            # 2. 删除封面图片
            cover_filename = f"{os.path.splitext(path.replace(os.sep, '_'))[0]}.jpg"
            cover_path = os.path.join(COVERS_DIR, cover_filename)
            safe_remove_file(cover_path, "封面图片")

            # 3. 删除切帧后的数据
            extracted_dir = os.path.join(VIDEO_DIR, project_name, base_name)
            safe_remove_dir(extracted_dir, "切帧数据")

            # 4. 删除SUCCESS_DIR中的标注数据
            success_annotation_dir = os.path.join(SUCCESS_DIR, project_name, base_name)
            safe_remove_dir(success_annotation_dir, "SUCCESS标注数据")

            # 5. 删除REVIEW_DIR中的标注数据
            review_annotation_dir = os.path.join(REVIEW_DIR, project_name, base_name)
            safe_remove_dir(review_annotation_dir, "REVIEW标注数据")

            # 6. 删除TEMP_DIR中的临时文件（如有）
            temp_pattern = os.path.join(TEMP_DIR, f"*{base_name}*")
            for temp_file in glob.glob(temp_pattern):
                safe_remove_file(temp_file, "临时文件")

            # 7. 删除extraction_info相关文件（更精确的匹配）
            if os.path.exists(EXTRACTION_INFO_DIR):
                # 构建精确的extraction_info文件名模式
                info_patterns = [
                    os.path.join(EXTRACTION_INFO_DIR, f"{project_name}_{base_name}.json"),
                    os.path.join(EXTRACTION_INFO_DIR, f"{path.replace(os.sep, '_')}.json"),
                    os.path.join(EXTRACTION_INFO_DIR, project_name, f"{base_name}.json")
                ]
                for pattern in info_patterns:
                    if '*' in pattern:
                        for info_path in glob.glob(pattern):
                            if os.path.isfile(info_path):
                                safe_remove_file(info_path, "extraction_info")
                            elif os.path.isdir(info_path):
                                safe_remove_dir(info_path, "extraction_info目录")
                    else:
                        safe_remove_file(pattern, "extraction_info")

            # 8. 批量删除数据库记录（性能优化）
            review_task_path = f"success/{project_name}/{base_name}"

            # 批量查询所有相关记录
            video_pool_item = db.query(VideoPool).filter(VideoPool.path == path).first()
            annotation_task = db.query(AnnotationTask).filter(AnnotationTask.task_path == path).first()
            review_task = db.query(ReviewTask).filter(ReviewTask.task_path == review_task_path).first()
            extraction_info = db.query(ExtractionInfo).filter(ExtractionInfo.video_path == path).first()

            # 批量删除
            if video_pool_item:
                db.delete(video_pool_item)
                deleted_items['db_records'].append(f"VideoPool: {path}")
                logger.info(f"Deleted VideoPool record: {path}")

            if annotation_task:
                db.delete(annotation_task)
                deleted_items['db_records'].append(f"AnnotationTask: {path}")
                logger.info(f"Deleted AnnotationTask record: {path}")

            if review_task:
                db.delete(review_task)
                deleted_items['db_records'].append(f"ReviewTask: {review_task_path}")
                logger.info(f"Deleted ReviewTask record: {review_task_path}")

            if extraction_info:
                db.delete(extraction_info)
                deleted_items['db_records'].append(f"ExtractionInfo: {path}")
                logger.info(f"Deleted ExtractionInfo record: {path}")

        elif dataset_type == 'image':
            # ===== 删除图片任务及相关数据 =====

            # 1. 删除原始图片任务目录
            task_path = os.path.join(IMAGE_DIR, path)
            safe_remove_dir(task_path, "图片任务目录")

            # 2. 删除原始zip文件（重要！之前缺失）
            zip_dir = os.path.join(IMAGE_ZIP_DIR, project_name)
            if os.path.exists(zip_dir):
                # 查找与任务相关的zip文件
                for zip_file in os.listdir(zip_dir):
                    # 匹配包含任务名称的zip文件
                    if base_name in zip_file and zip_file.endswith('.zip'):
                        zip_path = os.path.join(zip_dir, zip_file)
                        safe_remove_file(zip_path, "原始ZIP文件")

                # 如果zip目录为空，删除目录
                try:
                    if os.path.exists(zip_dir) and not os.listdir(zip_dir):
                        os.rmdir(zip_dir)
                        deleted_items['directories'].append(zip_dir)
                        logger.info(f"Deleted empty zip directory: {zip_dir}")
                except Exception as e:
                    logger.warning(f"Failed to delete empty zip dir {zip_dir}: {e}")

            # 3. 删除SUCCESS_DIR中的标注数据
            success_annotation_dir = os.path.join(SUCCESS_DIR, project_name, base_name)
            safe_remove_dir(success_annotation_dir, "SUCCESS标注数据")

            # 4. 删除REVIEW_DIR中的标注数据
            review_annotation_dir = os.path.join(REVIEW_DIR, project_name, base_name)
            safe_remove_dir(review_annotation_dir, "REVIEW标注数据")

            # 5. 删除TEMP_DIR中的临时文件（如有）
            temp_pattern = os.path.join(TEMP_DIR, f"*{base_name}*")
            for temp_file in glob.glob(temp_pattern):
                safe_remove_file(temp_file, "临时文件")

            # 6. 批量删除数据库记录（性能优化）
            review_task_path = f"success/{project_name}/{base_name}"

            # 批量查询
            video_pool_item = db.query(VideoPool).filter(VideoPool.path == path).first()
            annotation_task = db.query(AnnotationTask).filter(AnnotationTask.task_path == path).first()
            review_task = db.query(ReviewTask).filter(ReviewTask.task_path == review_task_path).first()

            # 批量删除
            if video_pool_item:
                db.delete(video_pool_item)
                deleted_items['db_records'].append(f"VideoPool: {path}")
                logger.info(f"Deleted VideoPool record: {path}")

            if annotation_task:
                db.delete(annotation_task)
                deleted_items['db_records'].append(f"AnnotationTask: {path}")
                logger.info(f"Deleted AnnotationTask record: {path}")

            if review_task:
                db.delete(review_task)
                deleted_items['db_records'].append(f"ReviewTask: {review_task_path}")
                logger.info(f"Deleted ReviewTask record: {review_task_path}")

        else:
            raise HTTPException(status_code=400, detail=f"不支持的数据集类型: {dataset_type}")

        # 提交所有数据库更改
        db.commit()

        # 生成删除报告
        summary = {
            "message": "数据集删除完成",
            "deleted_path": path,
            "type": dataset_type,
            "deleted_files_count": len(deleted_items['files']),
            "deleted_dirs_count": len(deleted_items['directories']),
            "deleted_db_records_count": len(deleted_items['db_records']),
            "errors_count": len(errors)
        }

        if errors:
            summary['warnings'] = errors
            logger.warning(f"Dataset deleted with {len(errors)} errors: {path}")
        else:
            logger.info(f"Successfully deleted dataset completely: {path}")

        # 如果需要详细报告（调试用）
        if logger.level <= logging.DEBUG:
            summary['details'] = deleted_items

        return summary

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Delete dataset failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除数据集失败: {str(e)}")

