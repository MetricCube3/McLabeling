"""
通用依赖和工具函数
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from .database import get_db
from app.models.models import User
from typing import Optional


def get_current_user(username: Optional[str], db: Session = Depends(get_db)) -> Optional[User]:
    """
    获取当前用户
    这是一个简化的认证方式，实际生产环境应使用JWT或其他认证机制
    """
    if not username:
        return None
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User '{username}' not found"
        )
    return user


def get_user_roles(username: str, db: Session = Depends(get_db)) -> list:
    """获取用户角色"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return []
    return user.roles or []


def is_admin(username: str, db: Session = Depends(get_db)) -> bool:
    """检查用户是否是管理员"""
    roles = get_user_roles(username, db)
    return 'admin' in roles


def require_admin(username: Optional[str], db: Session = Depends(get_db)):
    """要求管理员权限的依赖"""
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    if not is_admin(username, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return username


def has_role(username: str, role: str, db: Session = Depends(get_db)) -> bool:
    """检查用户是否有特定角色"""
    roles = get_user_roles(username, db)
    return role in roles
