"""
管理员导出功能路由
"""
import os
import shutil
import re
import zipfile
import tempfile
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import AnnotationTask, Project
from dependencies import is_admin
import logging
from PIL import Image

router = APIRouter()
logger = logging.getLogger(__name__)

DATA_DIR = 'data'
VIDEO_DIR = os.path.join(DATA_DIR, 'videos')
IMAGE_DIR = os.path.join(DATA_DIR, 'images')
ANNOTATED_DIR = os.path.join(DATA_DIR, 'annotated')
SUCCESS_DIR = os.path.join(ANNOTATED_DIR, 'success')
REVIEW_DIR = os.path.join(ANNOTATED_DIR, 'review')
STATIC_DIR = 'static'
TEMP_DIR = os.path.join(STATIC_DIR, 'temp')


class ExportTaskRequest(BaseModel):
    user: str
    task_path: str
    export_type: str = 'all'  # 'all', 'segmentation', 'bbox'


@router.post("/task/export")
def export_task(request: ExportTaskRequest, db: Session = Depends(get_db)):
    """
    导出任务数据 - 优化版本
    
    支持:
    - 项目化目录结构
    - 多种导出类型（全部/分割/边界框）
    - 性能优化（使用生成器、批量压缩）
    - 并发安全
    """
    if not is_admin(request.user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    
    if not request.task_path:
        raise HTTPException(status_code=400, detail="缺少任务路径")
    
    zip_filename = None
    
    try:
        # === Step 1: 确定项目名称和任务名称 ===
        project_name = 'default'
        task_name = None
        
        # 检查是否是审核任务（路径格式：success/project_name/task_name）
        if request.task_path.startswith('success/') or request.task_path.startswith('review/'):
            path_parts = request.task_path.split('/')
            if len(path_parts) >= 3:
                project_name = path_parts[1]
                task_name = path_parts[2]
        else:
            # 标注任务：从数据库获取项目信息
            task = db.query(AnnotationTask).filter(
                AnnotationTask.task_path == request.task_path
            ).first()
            
            if task and task.project_name:
                project_name = task.project_name
                # 提取任务名称
                if '/' in request.task_path:
                    task_name = os.path.basename(request.task_path)
                else:
                    task_name = request.task_path
            else:
                # 尝试从路径中提取
                if '/' in request.task_path:
                    project_name = request.task_path.split('/')[0]
                    task_name = os.path.basename(request.task_path)
                else:
                    task_name = request.task_path
        
        if not task_name:
            raise HTTPException(status_code=400, detail="无法确定任务名称")
        
        logger.info(f"Exporting task: project={project_name}, task={task_name}, type={request.export_type}")
        
        # === Step 2: 获取项目标签信息 ===
        labels = []
        project = db.query(Project).filter(Project.name == project_name).first()
        if project and project.labels:
            try:
                import json
                labels = json.loads(project.labels) if isinstance(project.labels, str) else project.labels
            except:
                labels = []
        
        # === Step 3: 创建临时zip文件 ===
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        zip_filename = temp_zip.name
        temp_zip.close()
        
        # === Step 4: 查找标注目录 ===
        # 处理任务名称可能包含特殊字符的情况
        task_name_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', task_name)
        
        # 构建目录列表并去重（避免task_name和task_name_safe相同时重复）
        annotated_dirs = list(set([
            os.path.join(SUCCESS_DIR, project_name, task_name),
            os.path.join(SUCCESS_DIR, project_name, task_name_safe),
            os.path.join(REVIEW_DIR, project_name, task_name),
            os.path.join(REVIEW_DIR, project_name, task_name_safe)
        ]))
        
        has_annotated_data = False
        files_added = 0
        
        # === Step 5: 压缩文件（优化：使用ZIP_DEFLATED压缩） ===
        with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for annotated_dir in annotated_dirs:
                if not os.path.exists(annotated_dir):
                    continue
                
                has_annotated_data = True
                logger.info(f"Processing directory: {annotated_dir}")
                
                # 添加images目录（所有导出类型都包含图像）
                images_dir = os.path.join(annotated_dir, 'images')
                if os.path.exists(images_dir):
                    files_added += _add_directory_to_zip(
                        zipf, images_dir, annotated_dir, 
                        extensions=('.jpg', '.jpeg', '.png')
                    )
                
                # 根据导出类型添加相应的标签目录
                if request.export_type in ['segmentation', 'all']:
                    # 添加labels目录（分割标注）
                    labels_dir = os.path.join(annotated_dir, 'labels')
                    if os.path.exists(labels_dir):
                        files_added += _add_directory_to_zip(
                            zipf, labels_dir, annotated_dir,
                            extensions=('.txt',)
                        )
                
                if request.export_type in ['bbox', 'all']:
                    # 添加labels_bbox目录（边界框标注）
                    labels_bbox_dir = os.path.join(annotated_dir, 'labels_bbox')
                    if os.path.exists(labels_bbox_dir):
                        files_added += _add_directory_to_zip(
                            zipf, labels_bbox_dir, annotated_dir,
                            extensions=('.txt',)
                        )
            
            # === Step 6: 添加标签信息文件（labels.txt） ===
            if labels:
                labels_content = ""
                for label in sorted(labels, key=lambda x: x.get('id', 0)):
                    labels_content += f"{label.get('id', 0)} {label.get('name', 'unknown')}\n"
                zipf.writestr('labels.txt', labels_content)
                files_added += 1
            else:
                zipf.writestr('labels.txt', "# No labels found for this project\n")
                files_added += 1
            
            # === Step 7: 如果没有找到标注文件，尝试查找原始文件 ===
            if not has_annotated_data:
                logger.warning("No annotation data found, trying to find original files")
                
                # 检查是否是视频任务
                video_path = os.path.join(VIDEO_DIR, request.task_path)
                if os.path.exists(video_path):
                    zipf.write(video_path, os.path.basename(video_path))
                    files_added += 1
                
                # 检查是否是图片任务
                image_task_path = os.path.join(IMAGE_DIR, request.task_path)
                if os.path.isdir(image_task_path):
                    files_added += _add_directory_to_zip(
                        zipf, image_task_path, os.path.dirname(image_task_path),
                        extensions=('.png', '.jpg', '.jpeg'),
                        arcname_prefix='images'
                    )
        
        # === Step 8: 检查zip文件是否为空 ===
        if files_added == 0:
            if os.path.exists(zip_filename):
                os.unlink(zip_filename)
            raise HTTPException(status_code=404, detail="没有找到可导出的文件")
        
        logger.info(f"Export completed: {files_added} files added to zip")
        
        # === Step 9: 生成下载文件名并移动到TEMP目录 ===
        safe_task_name = re.sub(r'[^a-zA-Z0-9_]', '_', task_name)
        
        # 根据导出类型生成文件名
        if request.export_type == 'segmentation':
            download_filename = f"{safe_task_name}_segmentation_export.zip"
        elif request.export_type == 'bbox':
            download_filename = f"{safe_task_name}_bbox_export.zip"
        else:  # all
            download_filename = f"{safe_task_name}_complete_export.zip"
        
        download_path = os.path.join(TEMP_DIR, download_filename)
        
        # 移动文件到临时目录供下载
        os.makedirs(TEMP_DIR, exist_ok=True)
        shutil.move(zip_filename, download_path)
        
        download_url = f"/{STATIC_DIR}/temp/{download_filename}"
        
        # 根据导出类型生成消息
        if request.export_type == 'segmentation':
            message = "分割数据导出文件已生成"
        elif request.export_type == 'bbox':
            message = "BBox数据导出文件已生成"
        else:
            message = "完整数据导出文件已生成"
        
        return {
            "download_url": download_url,
            "message": message,
            "project": project_name,
            "task": task_name,
            "label_count": len(labels),
            "files_count": files_added
        }
    
    except HTTPException:
        # 清理临时文件
        if zip_filename and os.path.exists(zip_filename):
            os.unlink(zip_filename)
        raise
    except Exception as e:
        logger.error(f"导出任务失败: {e}", exc_info=True)
        # 清理临时文件
        if zip_filename and os.path.exists(zip_filename):
            os.unlink(zip_filename)
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


def _add_directory_to_zip(zipf, source_dir, base_dir, extensions=None, arcname_prefix=None):
    """
    将目录添加到zip文件（优化版：使用生成器）
    
    Args:
        zipf: ZipFile对象
        source_dir: 源目录
        base_dir: 基础目录（用于计算相对路径）
        extensions: 允许的文件扩展名元组
        arcname_prefix: 在zip中的前缀路径
    
    Returns:
        添加的文件数量
    """
    files_added = 0
    
    for root, _, files in os.walk(source_dir):
        for file in files:
            # 过滤文件扩展名
            if extensions and not file.lower().endswith(extensions):
                continue
            
            file_path = os.path.join(root, file)
            
            # 计算在zip中的路径
            rel_path = os.path.relpath(file_path, base_dir)
            
            if arcname_prefix:
                arcname = os.path.join(arcname_prefix, os.path.relpath(file_path, source_dir))
            else:
                arcname = rel_path
            
            # 添加文件到zip
            zipf.write(file_path, arcname)
            files_added += 1
    
    return files_added


@router.post("/task/export_coco")
def export_task_coco(request: ExportTaskRequest, db: Session = Depends(get_db)):
    """
    导出任务数据为COCO格式
    
    COCO格式说明:
    - images/: 图片文件
    - annotations/instances.json: COCO格式标注
    
    支持:
    - 项目化目录结构
    - 自动转换归一化坐标到像素坐标
    - 生成边界框和分割多边形
    """
    if not is_admin(request.user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    
    if not request.task_path:
        raise HTTPException(status_code=400, detail="缺少任务路径")
    
    zip_filename = None
    
    try:
        # === Step 1: 确定项目名称和任务名称 ===
        project_name = 'default'
        task_name = None
        
        # 检查是否是审核任务
        if request.task_path.startswith('success/') or request.task_path.startswith('review/'):
            path_parts = request.task_path.split('/')
            if len(path_parts) >= 3:
                project_name = path_parts[1]
                task_name = path_parts[2]
        else:
            # 标注任务：从数据库获取项目信息
            task = db.query(AnnotationTask).filter(
                AnnotationTask.task_path == request.task_path
            ).first()
            
            if task and task.project_name:
                project_name = task.project_name
                if '/' in request.task_path:
                    task_name = os.path.basename(request.task_path)
                else:
                    task_name = request.task_path
            else:
                if '/' in request.task_path:
                    project_name = request.task_path.split('/')[0]
                    task_name = os.path.basename(request.task_path)
                else:
                    task_name = request.task_path
        
        if not task_name:
            raise HTTPException(status_code=400, detail="无法确定任务名称")
        
        logger.info(f"Exporting COCO format: project={project_name}, task={task_name}")
        
        # === Step 2: 创建临时zip文件 ===
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        zip_filename = temp_zip.name
        temp_zip.close()
        
        # === Step 3: 初始化COCO数据结构 ===
        coco_data = {
            "info": {
                "year": datetime.now().strftime("%Y"),
                "version": "1.0",
                "description": f"COCO dataset for {task_name} (Project: {project_name})",
                "date_created": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            },
            "licenses": [{"name": "Academic Use"}],
            "images": [],
            "annotations": [],
            "categories": []
        }
        
        # === Step 4: 加载项目标签信息 ===
        labels = []
        project = db.query(Project).filter(Project.name == project_name).first()
        if project and project.labels:
            try:
                labels = json.loads(project.labels) if isinstance(project.labels, str) else project.labels
            except:
                labels = []
        
        # 构建类别映射
        category_id_map = {}
        for idx, label in enumerate(labels):
            category_id_map[label.get('id', 0)] = idx
            coco_data["categories"].append({
                "id": idx,
                "name": label.get('name', 'unknown')
            })
        
        # === Step 5: 查找标注目录 ===
        task_name_safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', task_name)
        
        annotated_dirs = list(set([
            os.path.join(SUCCESS_DIR, project_name, task_name),
            os.path.join(SUCCESS_DIR, project_name, task_name_safe),
            os.path.join(REVIEW_DIR, project_name, task_name),
            os.path.join(REVIEW_DIR, project_name, task_name_safe)
        ]))
        
        has_annotated_data = False
        annotation_id = 0
        image_id = 0
        
        # === Step 6: 处理标注数据 ===
        with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for annotated_dir in annotated_dirs:
                if not os.path.exists(annotated_dir):
                    continue
                
                has_annotated_data = True
                logger.info(f"Processing COCO directory: {annotated_dir}")
                
                # 处理images目录
                images_dir = os.path.join(annotated_dir, 'images')
                labels_dir = os.path.join(annotated_dir, 'labels')
                
                if not os.path.exists(images_dir):
                    continue
                
                for root, _, files in os.walk(images_dir):
                    for file in files:
                        if not file.lower().endswith(('.jpg', '.jpeg', '.png')):
                            continue
                        
                        file_path = os.path.join(root, file)
                        
                        # 获取图片尺寸
                        try:
                            with Image.open(file_path) as img:
                                width, height = img.size
                        except Exception as e:
                            logger.error(f"Failed to get image size for {file_path}: {e}")
                            continue
                        
                        # 添加到COCO images列表
                        coco_data["images"].append({
                            "id": image_id,
                            "file_name": file,
                            "width": width,
                            "height": height
                        })
                        
                        # 将图片添加到zip的images目录
                        rel_path = os.path.relpath(file_path, annotated_dir)
                        zipf.write(file_path, rel_path)
                        
                        # 处理对应的标注文件
                        label_file = os.path.splitext(file)[0] + '.txt'
                        label_path = os.path.join(labels_dir, label_file)
                        
                        if os.path.exists(label_path):
                            try:
                                with open(label_path, 'r', encoding='utf-8') as f:
                                    for line in f:
                                        parts = line.strip().split()
                                        if len(parts) < 3:
                                            continue
                                        
                                        class_id = int(parts[0])
                                        coords = [float(c) for c in parts[1:]]
                                        
                                        # 将归一化坐标转换为绝对坐标
                                        pixel_coords = []
                                        for i in range(0, len(coords), 2):
                                            if i + 1 < len(coords):
                                                x = coords[i] * width
                                                y = coords[i + 1] * height
                                                pixel_coords.extend([round(x, 2), round(y, 2)])
                                        
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
                                            
                                            # 添加到COCO annotations列表
                                            coco_data["annotations"].append({
                                                "id": annotation_id,
                                                "image_id": image_id,
                                                "category_id": category_id_map.get(class_id, class_id),
                                                "area": area,
                                                "bbox": bbox,
                                                "segmentation": [pixel_coords],
                                                "iscrowd": 0
                                            })
                                            
                                            annotation_id += 1
                            except Exception as e:
                                logger.error(f"Failed to process label file {label_path}: {e}")
                        
                        image_id += 1
            
            # === Step 7: 如果没有找到标注数据 ===
            if not has_annotated_data:
                raise HTTPException(status_code=404, detail="没有找到可导出的COCO数据")
            
            # === Step 8: 写入COCO JSON ===
            coco_json = json.dumps(coco_data, indent=2, ensure_ascii=False)
            zipf.writestr('annotations/instances.json', coco_json)
        
        # === Step 9: 检查zip文件 ===
        with zipfile.ZipFile(zip_filename, 'r') as zipf:
            file_list = zipf.namelist()
            if len(file_list) == 0:
                raise HTTPException(status_code=404, detail="没有找到可导出的文件")
        
        logger.info(f"COCO export completed: {len(coco_data['images'])} images, {len(coco_data['annotations'])} annotations")
        
        # === Step 10: 移动到TEMP目录 ===
        safe_task_name = re.sub(r'[^a-zA-Z0-9_]', '_', task_name)
        download_filename = f"{safe_task_name}_coco_export.zip"
        download_path = os.path.join(TEMP_DIR, download_filename)
        
        os.makedirs(TEMP_DIR, exist_ok=True)
        shutil.move(zip_filename, download_path)
        
        download_url = f"/{STATIC_DIR}/temp/{download_filename}"
        
        return {
            "download_url": download_url,
            "message": "COCO格式数据导出文件已生成",
            "project": project_name,
            "task": task_name,
            "images_count": len(coco_data["images"]),
            "annotations_count": len(coco_data["annotations"]),
            "categories_count": len(coco_data["categories"])
        }
    
    except HTTPException:
        # 清理临时文件
        if zip_filename and os.path.exists(zip_filename):
            os.unlink(zip_filename)
        raise
    except Exception as e:
        logger.error(f"COCO导出任务失败: {e}", exc_info=True)
        # 清理临时文件
        if zip_filename and os.path.exists(zip_filename):
            os.unlink(zip_filename)
        raise HTTPException(status_code=500, detail=f"COCO导出失败: {str(e)}")
