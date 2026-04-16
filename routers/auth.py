"""
认证相关路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import User

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    username: str
    roles: list


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """用户登录"""
    user = db.query(User).filter(User.username == request.username).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    
    # 简单的密码验证（实际生产环境应使用密码哈希）
    if user.password != request.password:
        raise HTTPException(status_code=401, detail="密码错误")
    
    # 确保roles始终是列表类型
    roles = user.roles if user.roles is not None else []
    if not isinstance(roles, list):
        roles = []
    
    return LoginResponse(
        username=user.username,
        roles=roles
    )
