"""
视频管理路由
处理视频上传、抽帧、浏览等功能
"""
import os
import shutil
import cv2
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.models.models import AnnotationTask, ExtractionInfo
from app.core.dependencies import is_admin
from app.utils.utils import (
    check_video_has_annotations,
    load_extraction_info,
    perform_frame_extraction,
    VIDEO_DIR, SUCCESS_DIR, REVIEW_DIR
)
from werkzeug.utils import secure_filename
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class ExtractionInfoRequest(BaseModel):
    user: str
    video_path: str


class ExtractFramesRequest(BaseModel):
    user: str
    video_path: str
    frames_per_second: Optional[int] = 5
    target_fps: Optional[float] = 1.0


class ClearAnnotationsRequest(BaseModel):
    user: str
    video_path: str


@router.get("/video/extraction_info")
def get_extraction_info_endpoint(
        user: str = Query(...),
        video_path: str = Query(...),
        db: Session = Depends(get_db)
):
    """获取视频的抽帧信息"""
    if not user:
        raise HTTPException(status_code=401, detail="用户未指定")

    if not video_path:
        raise HTTPException(status_code=400, detail="视频路径不能为空")

    # 查询标注任务
    annotation_tasks = {}
    tasks = db.query(AnnotationTask).all()
    for task in tasks:
        annotation_tasks[task.task_path] = {
            'project': task.project_name,
            'assignee': task.assignee,
            'status': task.status
        }

    # 检查是否有标注数据
    has_annotations = check_video_has_annotations(video_path, annotation_tasks)

    # 获取抽帧信息（从数据库）
    extraction_info = load_extraction_info(video_path, db)

    return {
        "has_annotations": has_annotations,
        "extraction_info": extraction_info
    }


@router.post("/video/extract_frames")
def extract_frames_endpoint(
        request: ExtractFramesRequest,
        db: Session = Depends(get_db)
):
    """执行视频抽帧"""
    if not request.user:
        raise HTTPException(status_code=401, detail="用户未指定")

    if not request.video_path:
        raise HTTPException(status_code=400, detail="视频路径不能为空")

    # 查询标注任务
    annotation_tasks = {}
    tasks = db.query(AnnotationTask).all()
    for task in tasks:
        annotation_tasks[task.task_path] = {
            'project': task.project_name,
            'assignee': task.assignee,
            'status': task.status
        }

    # 检查是否有标注数据
    if check_video_has_annotations(request.video_path, annotation_tasks):
        raise HTTPException(
            status_code=400,
            detail="该视频已有标注数据，请先清空标注数据后重新抽帧"
        )

    # 验证视频文件是否存在
    video_abs_path = os.path.join(VIDEO_DIR, request.video_path)
    if not os.path.exists(video_abs_path):
        raise HTTPException(status_code=404, detail="视频文件不存在")

    # 抽帧前先清空上一次的抽帧图片
    extracted_abs_path = os.path.join(VIDEO_DIR, os.path.splitext(request.video_path)[0])
    if os.path.exists(extracted_abs_path):
        shutil.rmtree(extracted_abs_path)

    try:
        # 获取项目名称
        if request.video_path in annotation_tasks:
            project_name = annotation_tasks[request.video_path].get('project', 'default')
        else:
            # 如果任务不存在（未分配的任务），从 video_path 中提取项目名
            # video_path 格式通常是: "project_name/video_name.mp4"
            if '/' in request.video_path:
                project_name = request.video_path.split('/')[0]
                logger.info(
                    f"Extracted project_name '{project_name}' from video_path '{request.video_path}' for extraction")
            else:
                # 如果路径中没有 '/'，使用 default
                project_name = 'default'
                logger.warning(f"No project found in video_path '{request.video_path}', using 'default' for extraction")

        # 执行抽帧（传递db参数，自动保存到数据库）
        result = perform_frame_extraction(
            request.video_path,
            video_abs_path,
            request.target_fps,
            request.user,
            project_name,
            db=db
        )

        return result

    except Exception as e:
        logger.error(f"抽帧失败: {e}")
        raise HTTPException(status_code=500, detail=f"抽帧失败: {str(e)}")


@router.post("/video/clear_annotations")
def clear_video_annotations_endpoint(
        request: ClearAnnotationsRequest,
        db: Session = Depends(get_db)
):
    """清空视频的标注数据"""
    if not request.user:
        raise HTTPException(status_code=401, detail="用户未指定")

    if not request.video_path:
        raise HTTPException(status_code=400, detail="视频路径不能为空")

    try:
        # 获取项目信息
        task = db.query(AnnotationTask).filter(
            AnnotationTask.task_path == request.video_path
        ).first()

        project_name = 'default'
        if task:
            project_name = task.project_name or 'default'

        # 删除标注数据
        task_name = os.path.splitext(os.path.basename(request.video_path))[0]
        annotation_dirs = [
            os.path.join(SUCCESS_DIR, project_name, task_name),
            os.path.join(REVIEW_DIR, project_name, task_name)
        ]

        deleted_count = 0
        for annotation_dir in annotation_dirs:
            if os.path.exists(annotation_dir):
                shutil.rmtree(annotation_dir)
                deleted_count += 1
                logger.info(f"Deleted annotation directory: {annotation_dir}")

        # 更新数据库统计信息（清空标注数据）
        if task:
            try:
                # 重置标注相关统计，但保留 total_images
                task.annotated_images = 0
                task.total_labels = 0
                task.label_counts = {}  # 字典类型，不是字符串
                task.last_annotated_frame = -1
                task.stats_updated_at = datetime.now()

                db.commit()
                db.refresh(task)
                logger.info(f"Task stats reset after clearing annotations: {request.video_path}")
            except Exception as e:
                logger.warning(f"Failed to update task stats after clearing: {e}")
                # 不影响清空操作的成功

        return {
            "message": f"成功清空标注数据，删除了 {deleted_count} 个标注目录",
            "cleared": deleted_count > 0
        }

    except Exception as e:
        logger.error(f"清空标注数据失败: {e}")
        raise HTTPException(status_code=500, detail=f"清空标注数据失败: {str(e)}")


@router.get("/video/frame_count")
def get_video_frame_count_endpoint(
        user: str = Query(...),
        video_path: str = Query(...),
        db: Session = Depends(get_db)
):
    """获取视频抽帧后的图片数量"""
    if not user:
        raise HTTPException(status_code=401, detail="用户未指定")

    if not video_path:
        raise HTTPException(status_code=400, detail="视频路径不能为空")

    # 获取抽帧信息（从数据库）
    extraction_info = load_extraction_info(video_path, db)

    if extraction_info and 'extracted_frame_count' in extraction_info:
        frame_count = extraction_info['extracted_frame_count']
    else:
        # 如果没有抽帧信息，返回原始视频帧数
        import cv2
        video_abs_path = os.path.join(VIDEO_DIR, video_path)
        if os.path.exists(video_abs_path):
            try:
                cap = cv2.VideoCapture(video_abs_path)
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                cap.release()
            except:
                frame_count = 0
        else:
            frame_count = 0

    return {"frame_count": frame_count}

