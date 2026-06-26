"""
LocateAnything Worker
封装 nvidia/LocateAnything-3B 模型的推理功能
用于多模态视觉定位和目标检测

本模块使用官方 NVlabs/Eagle 仓库的 LocateAnything Worker 作为后端
"""
import gc
import re
import os
import sys
import logging
import torch
from PIL import Image
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ====== 模型路径配置 ======
# 本地模型路径（如果模型已下载到本地，修改此路径）
# 示例：LOCAL_MODEL_PATH = "data/models/LocateAnything-3B"
# 如果为 None，则使用 HuggingFace 模型名称
LOCAL_MODEL_PATH = os.environ.get("LOCATE_ANYTHING_MODEL_PATH", "data/models/LocateAnything-3B")

# 默认 HuggingFace 模型名称（当本地路径不存在时使用）
DEFAULT_HF_MODEL = "nvidia/LocateAnything-3B"

# 导入官方 Worker（从本地复制的文件）
try:
    from app.utils.official_locateanything_worker import LocateAnythingWorker as OfficialLocateAnythingWorker
    OFFICIAL_WORKER_AVAILABLE = True
    logger.info("Official LocateAnything Worker loaded successfully")
except ImportError as e:
    OFFICIAL_WORKER_AVAILABLE = False
    logger.error(f"Failed to import official LocateAnything Worker: {e}")
    logger.error("Please ensure official_locateanything_worker.py exists in app/utils/")


class LocateAnythingWorker:
    """
    LocateAnything 模型工作器（官方实现包装器）
    
    使用 NVlabs/Eagle 仓库的官方 Worker，提供统一接口
    """
    
    def __init__(self, model_name: str = "nvidia/LocateAnything-3B", device: Optional[str] = None):
        """
        初始化 LocateAnything Worker
        
        Args:
            model_name: 模型名称或路径
            device: 设备（cuda/cpu），None 则自动选择
        """
        if not OFFICIAL_WORKER_AVAILABLE:
            raise RuntimeError(
                "Official LocateAnything Worker not available. "
                f"Please ensure Eagle/Embodied code is in: {EAGLE_EMBODIED_PATH}"
            )
        
        self.model_name = model_name
        self.device = device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        
        # 使用官方 Worker
        logger.info(f"Initializing official LocateAnything Worker: {model_name}")
        logger.info(f"Device: {self.device}")
        
        # 根据设备选择 dtype
        dtype = torch.bfloat16 if self.device == "cuda" else torch.float32
        
        self.worker = OfficialLocateAnythingWorker(
            model_path=model_name,
            device=self.device,
            dtype=dtype,
            use_batch_runtime=False  # 简单模式，不使用批处理运行时
        )
        
        logger.info("Official LocateAnything Worker initialized successfully")
    
    
    def detect(self, image: Image.Image, labels: List[str]) -> Dict[str, Any]:
        """
        使用 LocateAnything 进行目标检测
        
        Args:
            image: PIL Image 对象
            labels: 待检测的标签列表，如 ["person", "car", "bicycle"]
        
        Returns:
            {
                "answer": str,  # 模型原始输出
                "boxes": List[Dict]  # 解析后的边界框列表
            }
        """
        try:
            if not labels:
                return {"answer": "", "boxes": []}

            # 记录原始尺寸，用于坐标映射回原图
            orig_w, orig_h = image.width, image.height
            # 推理前缩放，防止高分辨率视频帧 OOM
            image_for_infer = self._limit_image_size(image)
            if image_for_infer is not image:
                logger.debug(f"Image resized from {orig_w}x{orig_h} to {image_for_infer.width}x{image_for_infer.height} for inference")

            # 调用官方 Worker 的 detect 方法
            result = self.worker.detect(
                image=image_for_infer,
                categories=labels,
                generation_mode="hybrid",  # 混合模式（MTP + NTP）
                max_new_tokens=2048,
                temperature=0.0,  # 贪婪解码，确保确定性输出
                verbose=False
            )

            # [0, 1000] 是相对坐标，用原始尺寸转换即可映射回原图，无需额外缩放块
            answer = result.get("answer", "")
            boxes = self._parse_boxes(answer, orig_w, orig_h)

            return {
                "answer": answer,
                "boxes": boxes
            }

        except Exception as e:
            logger.error(f"LocateAnything detection failed: {e}")
            raise
        finally:
            # 每次推理后释放 CUDA 缓存，防止批量标注时显存累积
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()
    
    def ground_multi(self, image: Image.Image, phrase: str) -> Dict[str, Any]:
        """
        短语定位（Phrase Grounding）
        
        Args:
            image: PIL Image 对象
            phrase: 描述短语，如 "people wearing red shirts"
        
        Returns:
            {
                "answer": str,
                "boxes": List[Dict]
            }
        """
        try:
            orig_w, orig_h = image.width, image.height
            image_for_infer = self._limit_image_size(image)
            if image_for_infer is not image:
                logger.debug(f"Image resized from {orig_w}x{orig_h} to {image_for_infer.width}x{image_for_infer.height} for inference")

            # 调用官方 Worker 的 ground_multi 方法
            result = self.worker.ground_multi(
                image=image_for_infer,
                phrase=phrase,
                generation_mode="hybrid",
                max_new_tokens=2048,
                temperature=0.0,
                verbose=False
            )

            answer = result.get("answer", "")
            boxes = self._parse_boxes(answer, orig_w, orig_h)

            return {
                "answer": answer,
                "boxes": boxes
            }

        except Exception as e:
            logger.error(f"LocateAnything grounding failed: {e}")
            raise
        finally:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()
    
    @staticmethod
    def _limit_image_size(image: Image.Image, max_size: int = 1344) -> Image.Image:
        """\u9650制图片最大边长，防止高分辨率图片导致 OOM。\n        1344px 是 LocateAnything-3B 推荐输入上限（可根据显存调整）。\n        [0, 1000] 输出为相对坐标，缩放图的推理结果与原图坐标系一致。"""
        w, h = image.size
        if max(w, h) > max_size:
            scale = max_size / max(w, h)
            new_w, new_h = int(w * scale), int(h * scale)
            return image.resize((new_w, new_h), Image.LANCZOS)
        return image

    def _parse_boxes(self, answer: str, image_width: int, image_height: int) -> List[Dict]:
        """
        解析 LocateAnything 输出中的边界框
        
        实际输出格式: <ref>label</ref><box><x1><y1><x2><y2></box><box><x1><y1><x2><y2></box>...
        即一个 <ref> 后面可跟多个 <box>，直到下一个 <ref>
        坐标范围: [0, 1000]
        
        Args:
            answer: 模型输出文本
            image_width: 图像宽度
            image_height: 图像高度
        
        Returns:
            List[Dict]: 边界框列表，每个元素包含 label, x1, y1, x2, y2
        """
        boxes = []
        
        try:
            # 顺序扫描：遇到 <ref> 更新当前标签，遇到 <box> 使用当前标签
            # 支持: <ref>person</ref><box><196><83><441><817></box><box><417><175><618><831></box>
            token_pattern = r'<ref>(.*?)</ref>|<box><(\d+)><(\d+)><(\d+)><(\d+)></box>'
            current_label = "object"
            
            for match in re.finditer(token_pattern, answer):
                if match.group(1) is not None:
                    # <ref>label</ref> — 更新当前标签
                    current_label = match.group(1).strip()
                else:
                    # <box><x1><y1><x2><y2></box> — 使用当前标签创建框
                    x1 = int(match.group(2)) / 1000.0 * image_width
                    y1 = int(match.group(3)) / 1000.0 * image_height
                    x2 = int(match.group(4)) / 1000.0 * image_width
                    y2 = int(match.group(5)) / 1000.0 * image_height
                    boxes.append({
                        "label": current_label,
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2
                    })
        
        except Exception as e:
            logger.error(f"Failed to parse boxes from answer: {e}")
            logger.debug(f"Answer content: {answer}")
        
        return boxes
    
    def detect_batch(self, image_label_pairs: List) -> List[Dict[str, Any]]:
        """
        批量检测
        
        Args:
            image_label_pairs: [(image1, labels1), (image2, labels2), ...]
        
        Returns:
            List of detection results
        """
        try:
            # 调用官方 Worker 的 detect_batch 方法
            results = self.worker.detect_batch(
                requests=image_label_pairs,
                generation_mode="hybrid",
                max_new_tokens=2048,
                temperature=0.0,
                verbose=False
            )
            
            # 解析每个结果
            parsed_results = []
            for i, result in enumerate(results):
                answer = result.get("answer", "")
                image, labels = image_label_pairs[i]
                boxes = self._parse_boxes(answer, image.width, image.height)
                
                parsed_results.append({
                    "answer": answer,
                    "boxes": boxes
                })
            
            return parsed_results
            
        except Exception as e:
            logger.error(f"Batch detection failed: {e}")
            # 降级到逐个处理
            logger.info("Falling back to sequential processing")
            results = []
            for image, labels in image_label_pairs:
                result = self.detect(image, labels)
                results.append(result)
            return results
    
    def unload_model(self):
        """卸载模型以释放显存"""
        if hasattr(self, 'worker') and self.worker is not None:
            # 删除官方 worker 实例
            del self.worker
            self.worker = None
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info("LocateAnything model unloaded")


class LocateAnythingModelManager:
    """LocateAnything 模型管理器（单例模式）"""
    
    _instance = None
    _worker = None
    
    @classmethod
    def get_worker(cls, model_name: str = None) -> LocateAnythingWorker:
        """
        获取或创建 LocateAnything Worker 实例
        
        Args:
            model_name: 模型路径或名称。如果为 None，则按以下顺序选择：
                1. 检查 LOCAL_MODEL_PATH 是否存在
                2. 如果不存在，使用 DEFAULT_HF_MODEL
        
        Returns:
            LocateAnythingWorker 实例
        """
        if cls._worker is None:
            # 如果未指定 model_name，则使用配置的路径
            if model_name is None:
                if os.path.exists(LOCAL_MODEL_PATH):
                    model_name = LOCAL_MODEL_PATH
                    logger.info(f"Using local model path: {LOCAL_MODEL_PATH}")
                else:
                    model_name = DEFAULT_HF_MODEL
                    logger.warning(f"Local model path not found: {LOCAL_MODEL_PATH}")
                    logger.warning(f"Will use HuggingFace model: {DEFAULT_HF_MODEL}")
            
            logger.info("Initializing LocateAnything worker...")
            cls._worker = LocateAnythingWorker(model_name)
        return cls._worker
    
    @classmethod
    def unload(cls):
        """卸载模型"""
        if cls._worker is not None:
            cls._worker.unload_model()
            cls._worker = None
