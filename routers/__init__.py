"""
路由模块初始化
导出所有路由
"""
from .auth import router as auth_router
from .project import router as project_router
from .user import router as user_router
from .task import router as task_router
from .video import router as video_router
from .annotation import router as annotation_router
from .admin import router as admin_router
from .segment import router as segment_router
from .browse import router as browse_router
from .model import router as model_router

__all__ = [
    'auth_router',
    'project_router',
    'user_router',
    'task_router',
    'video_router',
    'annotation_router',
    'admin_router',
    'segment_router',
    'browse_router',
    'model_router'
]
