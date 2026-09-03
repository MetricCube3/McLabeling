"""
FastAPI 主应用
"""
import os
import hashlib
import logging
import sys
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import init_db, get_db, create_default_admin
from app.core.config import init_directories, DATA_DIR, VIDEO_DIR, IMAGE_DIR, ANNOTATED_DIR, STATIC_DIR
from sqlalchemy.orm import Session

# 导入路由
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.projects import router as project_router
from app.api.endpoints.users import router as user_router
from app.api.endpoints.tasks import router as task_router
from app.api.endpoints.videos import router as video_router
from app.api.endpoints.annotations import router as annotation_router
from app.api.endpoints.admin import router as admin_router
from app.api.endpoints.segment import router as segment_router
from app.api.endpoints.browse import router as browse_router
from app.api.endpoints.model import router as model_router
from app.api.endpoints.admin_export import router as admin_export_router
from app.api.endpoints.admin_project_export import router as admin_project_export_router

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def calculate_static_version(static_dir: str) -> str:
    """根据前端文件内容生成稳定版本号，内容变化时静态 URL 自动变化。"""
    digest = hashlib.sha256()

    for root, dirnames, filenames in os.walk(static_dir):
        dirnames.sort()
        for filename in sorted(filenames):
            file_path = os.path.join(root, filename)
            relative_path = os.path.relpath(file_path, static_dir).replace(os.sep, "/")
            digest.update(relative_path.encode("utf-8"))
            with open(file_path, "rb") as asset_file:
                for chunk in iter(lambda: asset_file.read(1024 * 1024), b""):
                    digest.update(chunk)

    return digest.hexdigest()[:12]

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

# 每次前端文件内容变化时都会生成新的静态资源路径。
STATIC_VERSION = calculate_static_version(STATIC_DIR)
VERSIONED_STATIC_PREFIX = f"/static/{STATIC_VERSION}"


@app.middleware("http")
async def prevent_stale_frontend_cache(request: Request, call_next):
    """入口页面不缓存；带内容指纹的资源可安全长期缓存。"""
    response = await call_next(request)
    request_path = request.url.path

    if request_path == "/":
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    elif request_path.startswith(f"{VERSIONED_STATIC_PREFIX}/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif request_path.startswith("/static/"):
        # 兼容接口返回的封面和临时图片等未版本化静态地址。
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

    return response


# 初始化目录
init_directories()

# 版本化路径必须先于兼容路径挂载，确保模块相对导入和 CSS @import 都带版本号。
app.mount(VERSIONED_STATIC_PREFIX, StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static_legacy")
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
