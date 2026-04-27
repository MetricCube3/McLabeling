"""
数据库模型定义
使用SQLAlchemy ORM定义所有数据库表
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    """用户表"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    roles = Column(JSON, nullable=False, default=lambda: [])  # 存储角色列表，如 ['admin', 'annotator']
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    assigned_annotation_tasks = relationship("AnnotationTask", back_populates="assignee_user", foreign_keys="AnnotationTask.assignee")
    assigned_review_tasks = relationship("ReviewTask", back_populates="assignee_user", foreign_keys="ReviewTask.assignee")


class Project(Base):
    """项目表"""
    __tablename__ = 'projects'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    labels = Column(JSON, default=list)  # 存储标签列表
    created_by = Column(String(100), nullable=True)  # 创建者
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    annotation_tasks = relationship("AnnotationTask", back_populates="project_rel")
    review_tasks = relationship("ReviewTask", back_populates="project_rel")


class VideoPool(Base):
    """视频池表 - 存储所有可分配的视频/图片任务"""
    __tablename__ = 'video_pool'
    
    id = Column(Integer, primary_key=True, index=True)
    path = Column(String(500), unique=True, index=True, nullable=False)  # 相对路径
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=True)
    is_video = Column(Boolean, default=True)  # True表示视频，False表示图片集
    added_at = Column(DateTime, default=datetime.utcnow)


class AnnotationTask(Base):
    """标注任务表"""
    __tablename__ = 'annotation_tasks'
    
    id = Column(Integer, primary_key=True, index=True)
    task_path = Column(String(500), unique=True, index=True, nullable=False)  # 任务路径，唯一标识
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=True)
    project_name = Column(String(100), nullable=True)  # 冗余字段，便于查询
    assignee = Column(String(50), ForeignKey('users.username'), nullable=True)
    status = Column(String(20), default='in_progress')  # in_progress, completed
    
    # 统计信息字段（缓存）
    total_images = Column(Integer, default=0)  # 图片总数
    annotated_images = Column(Integer, default=0)  # 已标注图片数
    total_labels = Column(Integer, default=0)  # 标签总数
    label_counts = Column(JSON, default=dict)  # 各类别标签数 {"0": 10, "1": 5}
    last_annotated_frame = Column(Integer, default=-1)  # 最后标注的帧索引
    stats_updated_at = Column(DateTime, nullable=True)  # 统计信息最后更新时间
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    assignee_user = relationship("User", back_populates="assigned_annotation_tasks", foreign_keys=[assignee])
    project_rel = relationship("Project", back_populates="annotation_tasks")


class ReviewTask(Base):
    """审核任务表"""
    __tablename__ = 'review_tasks'
    
    id = Column(Integer, primary_key=True, index=True)
    task_path = Column(String(500), unique=True, index=True, nullable=False)  # 任务路径，如 "success/project_name/video_name"
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=True)
    project_name = Column(String(100), nullable=True)  # 冗余字段，便于查询
    assignee = Column(String(50), ForeignKey('users.username'), nullable=True)
    status = Column(String(20), default='in_progress')  # in_progress, completed
    annotation_task_id = Column(Integer, ForeignKey('annotation_tasks.id'), nullable=True)  # 关联到标注任务
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    assignee_user = relationship("User", back_populates="assigned_review_tasks", foreign_keys=[assignee])
    project_rel = relationship("Project", back_populates="review_tasks")
    annotation_task = relationship("AnnotationTask", foreign_keys=[annotation_task_id])  # 关联标注任务


class ExtractionInfo(Base):
    """视频抽帧信息表 - 优化版"""
    __tablename__ = 'extraction_info'
    
    id = Column(Integer, primary_key=True, index=True)
    video_path = Column(String(500), unique=True, index=True, nullable=False)  # 视频相对路径
    
    # FPS信息
    original_fps = Column(Float, nullable=True)  # 原始视频FPS（浮点数）
    target_fps = Column(Float, nullable=True)  # 目标抽帧FPS（浮点数）
    extraction_interval = Column(Integer, nullable=True)  # 抽帧间隔
    
    # 帧数信息
    original_frame_count = Column(Integer, nullable=True)  # 原始视频总帧数
    extracted_frame_count = Column(Integer, nullable=True)  # 实际抽取的帧数
    
    # 路径信息
    extracted_dir = Column(String(500), nullable=True)  # 抽帧图片目录（绝对路径）
    relative_extracted_dir = Column(String(500), nullable=True)  # 相对路径
    
    # 元信息
    extracted_by = Column(String(50), nullable=True)  # 抽帧操作用户
    extraction_time = Column(String(50), nullable=True)  # 抽帧时间（字符串格式）
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
