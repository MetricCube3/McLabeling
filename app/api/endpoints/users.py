"""
用户管理路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.models.models import User
from app.core.dependencies import require_admin, is_admin
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class UserManageRequest(BaseModel):
    admin_user: str
    action: str  # add_update, delete
    username: str
    roles: Optional[List[str]] = []
    password: Optional[str] = None


@router.get("/admin/users")
def admin_get_users(user: str = Query(...), db: Session = Depends(get_db)):
    """获取所有用户"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    users = db.query(User).all()
    users_data = {}

    for u in users:
        users_data[u.username] = {
            "roles": u.roles or [],
            "password": u.password
        }

    return users_data


@router.get("/admin/annotators")
def admin_get_annotators(user: str = Query(...), db: Session = Depends(get_db)):
    """获取所有标注员用户（用于任务分配）"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    users = db.query(User).all()
    annotators = []

    for u in users:
        roles = u.roles or []
        # 只返回有annotator角色的用户
        if 'annotator' in roles:
            annotators.append({
                "username": u.username,
                "roles": roles
            })

    logger.info(f"Found {len(annotators)} annotators")
    return annotators


@router.get("/admin/task/users")
def get_task_users(
        user: str = Query(...),
        task_type: str = Query(...),
        db: Session = Depends(get_db)
):
    """获取可用于任务分配的用户列表（根据任务类型）"""
    if not is_admin(user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    if not task_type:
        raise HTTPException(status_code=400, detail="缺少任务类型参数")

    all_users = db.query(User).all()
    users = []

    # 根据任务类型筛选用户
    for u in all_users:
        roles = u.roles or []
        if task_type == 'annotation' and 'annotator' in roles:
            users.append(u.username)
        elif task_type == 'review' and 'reviewer' in roles:
            users.append(u.username)

    logger.info(f"Found {len(users)} users for task_type={task_type}")
    return {"users": users}


@router.post("/admin/user")
def admin_manage_user(request: UserManageRequest, db: Session = Depends(get_db)):
    """管理用户"""
    if not is_admin(request.admin_user, db):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    if not request.username:
        raise HTTPException(status_code=400, detail="用户名不能为空")

    if request.action == 'add_update':
        # 不允许给非admin用户分配admin角色
        roles = request.roles or []
        if 'admin' in roles and request.username != 'admin':
            roles = [r for r in roles if r != 'admin']

        # 查找或创建用户
        user = db.query(User).filter(User.username == request.username).first()

        if user:
            # 更新现有用户
            user.roles = roles
            if request.password:
                user.password = request.password
            message = f"用户 {request.username} 已更新"
        else:
            # 创建新用户
            if not request.password:
                raise HTTPException(status_code=400, detail="新用户必须提供密码")

            user = User(
                username=request.username,
                password=request.password,
                roles=roles
            )
            db.add(user)
            message = f"用户 {request.username} 已创建"

        db.commit()
        return {"message": message}

    elif request.action == 'delete':
        if request.username == 'admin':
            raise HTTPException(status_code=400, detail="不能删除主管理员账户")

        user = db.query(User).filter(User.username == request.username).first()
        if user:
            db.delete(user)
            db.commit()
            return {"message": f"用户 '{request.username}' 已删除"}
        else:
            raise HTTPException(status_code=404, detail="用户不存在")

    else:
        raise HTTPException(status_code=400, detail="无效的操作")

