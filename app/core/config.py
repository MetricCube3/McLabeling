"""
应用配置
统一管理路径配置和环境变量
"""
import os

# 数据库配置
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./mclabeling.db')

# 数据目录配置
DATA_DIR = 'data'
VIDEO_DIR = os.path.join(DATA_DIR, 'videos')
EXTRACTION_INFO_DIR = os.path.join(DATA_DIR, 'extraction_info')
IMAGE_DIR = os.path.join(DATA_DIR, 'images')
IMAGE_ZIP_DIR = os.path.join(DATA_DIR, 'image_zips')
ANNOTATED_DIR = os.path.join(DATA_DIR, 'annotated')
SUCCESS_DIR = os.path.join(ANNOTATED_DIR, 'success')
REVIEW_DIR = os.path.join(ANNOTATED_DIR, 'review')

# 静态文件配置
STATIC_DIR = 'static'
COVERS_DIR = os.path.join(STATIC_DIR, 'covers')
TEMP_DIR = os.path.join(STATIC_DIR, 'temp')


def init_directories():
    """初始化所有必要的目录"""
    os.makedirs(VIDEO_DIR, exist_ok=True)
    os.makedirs(EXTRACTION_INFO_DIR, exist_ok=True)
    os.makedirs(IMAGE_DIR, exist_ok=True)
    os.makedirs(IMAGE_ZIP_DIR, exist_ok=True)
    os.makedirs(SUCCESS_DIR, exist_ok=True)
    os.makedirs(REVIEW_DIR, exist_ok=True)
    os.makedirs(COVERS_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)
