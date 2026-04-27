"""
数据库配置和连接管理
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models.models import Base

# 数据库配置
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./mclabeling.db')

# 创建数据库引擎
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith('sqlite') else {},
    echo=False  # 设置为True可以看到SQL日志
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """初始化数据库，创建所有表并创建默认管理员"""
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")
    
    # 自动创建默认管理员账户
    db = SessionLocal()
    try:
        create_default_admin(db)
    finally:
        db.close()


def get_db():
    """
    获取数据库会话的依赖注入函数
    用于FastAPI的Depends
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_default_admin(db: Session):
    """创建默认管理员账户"""
    from app.models.models import User
    
    admin = db.query(User).filter(User.username == 'admin').first()
    if not admin:
        admin = User(
            username='admin',
            password='admin',  # 注意：生产环境使用密码哈希
            roles=['admin']
        )
        db.add(admin)
        db.commit()
        print("Default admin user created (username: admin, password: admin)")
    else:
        print("Admin user already exists")
