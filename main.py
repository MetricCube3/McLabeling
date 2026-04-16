"""
FastAPI 主应用
"""
import os
import logging
import sys
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from database import init_db, get_db, create_default_admin
from sqlalchemy.orm import Session

# 导入路由
from routers import (
    auth_router,
    project_router,
    user_router,
    task_router,
    video_router,
    annotation_router,
    admin_router,
    segment_router,
    browse_router,
    model_router
)
from routers.admin_export import router as admin_export_router
from routers.admin_project_export import router as admin_project_export_router

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="mclabeling API",
    description="视频/图片标注系统 - FastAPI",
    version="2.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 路径定义 ---
DATA_DIR = 'data'
VIDEO_DIR = os.path.join(DATA_DIR, 'videos')
EXTRACTION_INFO_DIR = os.path.join(DATA_DIR, 'extraction_info')
IMAGE_DIR = os.path.join(DATA_DIR, 'images')
IMAGE_ZIP_DIR = os.path.join(DATA_DIR, 'image_zips')
ANNOTATED_DIR = os.path.join(DATA_DIR, 'annotated')
SUCCESS_DIR = os.path.join(ANNOTATED_DIR, 'success')
REVIEW_DIR = os.path.join(ANNOTATED_DIR, 'review')
STATIC_DIR = 'static'
COVERS_DIR = os.path.join(STATIC_DIR, 'covers')
TEMP_DIR = os.path.join(STATIC_DIR, 'temp')

# --- 创建目录 ---
os.makedirs(VIDEO_DIR, exist_ok=True)
os.makedirs(EXTRACTION_INFO_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)
os.makedirs(IMAGE_ZIP_DIR, exist_ok=True)
os.makedirs(SUCCESS_DIR, exist_ok=True)
os.makedirs(REVIEW_DIR, exist_ok=True)
os.makedirs(COVERS_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# 挂载静态文件
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/data/videos", StaticFiles(directory=VIDEO_DIR), name="video_data")
app.mount("/data/images", StaticFiles(directory=IMAGE_DIR), name="image_data")
app.mount("/data/annotated", StaticFiles(directory=ANNOTATED_DIR), name="annotated_data")

# 模板配置
templates = Jinja2Templates(directory="templates")

# 注册路由
app.include_router(auth_router, prefix="/api", tags=["认证"])
app.include_router(project_router, prefix="/api", tags=["项目管理"])
app.include_router(user_router, prefix="/api", tags=["用户管理"])
app.include_router(task_router, prefix="/api", tags=["任务管理"])
app.include_router(video_router, prefix="/api", tags=["视频管理"])
app.include_router(annotation_router, prefix="/api", tags=["标注管理"])
app.include_router(admin_router, prefix="/api/admin", tags=["管理员功能"])
app.include_router(admin_export_router, prefix="/api/admin", tags=["管理员导出"])
app.include_router(admin_project_export_router, prefix="/api", tags=["项目批量导出"])
app.include_router(model_router, tags=["模型管理"])
app.include_router(segment_router, prefix="/api", tags=["AI分割"])
app.include_router(browse_router, prefix="/api", tags=["浏览功能"])


@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    logger.info("=" * 70)
    logger.info("mclabeling Application Starting")
    logger.info("=" * 70)
    
    # 初始化数据库
    logger.info("Initializing database...")
    init_db()
    
    logger.info("=" * 70)
    logger.info("✅ Application started successfully")
    logger.info("=" * 70)


@app.get("/")
async def read_root(request: Request):
    """首页"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', '3000'))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
