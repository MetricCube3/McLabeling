"""
AI分割路由
处理SAM模型的图像分割功能
"""
import os
import random
import logging
import numpy as np
import cv2
from urllib.parse import unquote
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ultralytics import SAM

router = APIRouter()
logger = logging.getLogger(__name__)


# --- 多模型加载 ---
class ModelManager:
    def __init__(self):
        self.models = []
        self.model_count = int(os.getenv('MODEL_INSTANCES', '1'))  # 从环境变量获取模型实例数量，默认为1
        self.load_models()
    
    def load_models(self):
        """加载多个模型实例"""
        try:
            for i in range(self.model_count):
                model = SAM("sam2.1_l.pt")
                self.models.append(model)
                logger.info(f"model instance {i + 1} loaded successfully.")
            
            logger.info(f"Total {len(self.models)} model instances loaded.")
        
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            # 如果加载失败，至少确保有一个模型实例
            if not self.models:
                try:
                    model = SAM("sam2.1_l.pt")
                    self.models.append(model)
                    logger.info("Fallback: Single model loaded successfully.")
                except Exception as fallback_error:
                    logger.error(f"Fallback model loading failed: {fallback_error}")
    
    def get_random_model(self):
        """随机获取一个模型实例"""
        if not self.models:
            raise Exception("No models available")
        return random.choice(self.models)
    
    def get_model_count(self):
        """获取当前可用的模型实例数量"""
        return len(self.models)


# 初始化模型管理器
model_manager = ModelManager()


class SegmentRequest(BaseModel):
    frameUrl: str  # 帧图片URL，如 /data/videos/pp/v1/extracted/frame_000010.jpg
    points: List[List[List[float]]]  # [[[x, y], [x, y]], [[x, y]]] - 支持多点组
    labels: List[List[int]]  # [[1, 1, 0], [1]] - 每个点组对应的标签列表（二维数组）
    imageWidth: Optional[int] = None  # 可选，用于验证
    imageHeight: Optional[int] = None  # 可选，用于验证


class Point(BaseModel):
    x: float
    y: float
    label: int


@router.get("/model/status")
def get_model_status():
    """获取模型实例状态"""
    return {
        "model_count": model_manager.get_model_count(),
        "model_instances": model_manager.get_model_count(),
        "status": "healthy" if model_manager.get_model_count() > 0 else "unavailable"
    }


@router.post("/segment")
def segment_image(request: SegmentRequest):
    """执行图像分割（优化版，参照app.py）"""
    try:
        # 随机获取一个模型实例
        try:
            model = model_manager.get_random_model()
        except Exception as e:
            logger.error(f"No available SAM model: {e}")
            raise HTTPException(status_code=503, detail="SAM模型不可用")
        
        # 验证参数
        if not request.frameUrl:
            raise HTTPException(status_code=400, detail="frameUrl是必需的")
        
        if not request.points:
            raise HTTPException(status_code=400, detail="未提供点坐标")
        
        # 将frameUrl转换为服务器路径，并进行URL解码（处理中文路径）
        server_path = unquote(request.frameUrl.lstrip('/'))
        
        # 检查文件是否存在
        if not os.path.exists(server_path):
            logger.error(f"Image file not found: {server_path}")
            raise HTTPException(status_code=404, detail=f"图片文件不存在: {server_path}")
        
        # 读取图像获取实际尺寸
        img = cv2.imread(server_path)
        if img is None:
            logger.error(f"Could not read image: {server_path}")
            raise HTTPException(status_code=500, detail="无法读取图片")
        
        img_height, img_width = img.shape[:2]
        logger.info(f"Image loaded: {server_path}, size: {img_width}x{img_height}")
        
        # 验证点坐标是否在图像范围内
        valid_points = []
        valid_labels = []
        
        for idx, point_group in enumerate(request.points):
            valid_group = []
            valid_label_group = []
            
            # 获取对应的标签组
            label_group = request.labels[idx] if idx < len(request.labels) else []
            
            for point_idx, point in enumerate(point_group):
                x, y = point[0], point[1]
                # 检查坐标是否在图像范围内
                if 0 <= x < img_width and 0 <= y < img_height:
                    valid_group.append([x, y])
                    # 添加对应的标签
                    if point_idx < len(label_group):
                        valid_label_group.append(label_group[point_idx])
                else:
                    logger.warning(f"Point ({x}, {y}) is outside image bounds ({img_width}x{img_height})")
            
            if valid_group:  # 只添加非空的点组
                valid_points.append(valid_group)
                # SAM需要的是每个点组的标签列表
                valid_labels.append(valid_label_group if valid_label_group else [1] * len(valid_group))
        
        if not valid_points:
            logger.warning("All points are outside image bounds")
            raise HTTPException(status_code=400, detail="所有点都超出图像边界")
        
        logger.info(f"Valid points: {len(valid_points)} groups, labels: {valid_labels}")
        
        # 执行分割
        results = model(
            server_path,
            points=valid_points,
            labels=valid_labels,
            verbose=False
        )
        
        # 处理结果
        if not results or len(results) == 0:
            logger.warning("No segmentation results")
            return {"masks": [], "boxes": []}
        
        result = results[0]
        
        # 检查是否有mask
        if result.masks is None or len(result.masks) == 0:
            logger.warning("No masks in segmentation results")
            return {"masks": [], "boxes": []}
        
        # 提取mask多边形坐标（与app.py一致）
        masks_data = [mask.tolist() for mask in result.masks.xy]
        
        # 提取边界框
        boxes_data = []
        if result.boxes is not None:
            boxes_data = [box.tolist() for box in result.boxes.xyxy]
        
        logger.info(f"Segmentation successful: {len(masks_data)} masks, {len(boxes_data)} boxes")
        
        return {
            "masks": masks_data,
            "boxes": boxes_data
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"分割失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"分割处理失败: {str(e)}")
