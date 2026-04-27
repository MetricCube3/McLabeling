/**
 * 全局配置文件
 * 统一管理应用的配置信息、API路径、常量等
 */

// API基础路径
export const API_BASE_URL = '/api';

// API端点配置
export const API_ENDPOINTS = {
    // 认证相关
    auth: {
        login: `${API_BASE_URL}/login`,
        logout: `${API_BASE_URL}/logout`,
        checkAuth: `${API_BASE_URL}/check-auth`
    },
    
    // 项目管理
    project: {
        list: `${API_BASE_URL}/admin/projects`,
        create: `${API_BASE_URL}/admin/projects`,
        delete: (projectName) => `${API_BASE_URL}/admin/projects/${projectName}`,
        stats: `${API_BASE_URL}/admin/project_task_stats`
    },
    
    // 标签管理
    label: {
        list: `${API_BASE_URL}/labels`,
        add: `${API_BASE_URL}/labels`,
        update: (labelId) => `${API_BASE_URL}/labels/${labelId}`,
        delete: (labelId) => `${API_BASE_URL}/labels/${labelId}`
    },
    
    // 数据集管理
    dataset: {
        list: `${API_BASE_URL}/browse`,
        uploadVideo: `${API_BASE_URL}/upload-video`,
        uploadImage: `${API_BASE_URL}/upload-images`
    },
    
    // 任务管理
    task: {
        list: `${API_BASE_URL}/tasks`,
        assign: `${API_BASE_URL}/admin/assign-task`,
        unassign: `${API_BASE_URL}/admin/unassign-task`
    },
    
    // 标注相关
    annotation: {
        get: `${API_BASE_URL}/annotations`,
        save: `${API_BASE_URL}/annotations`,
        autoAnnotate: `${API_BASE_URL}/segment`
    },
    
    // 模型管理
    model: {
        list: `${API_BASE_URL}/models/list`,
        active: `${API_BASE_URL}/models/active`,
        upload: `${API_BASE_URL}/models/upload`,
        delete: (modelName) => `${API_BASE_URL}/models/${modelName}`,
        setActive: `${API_BASE_URL}/models/set_active`,
        train: `${API_BASE_URL}/models/train`,
        trainStop: `${API_BASE_URL}/models/train/stop`,
        trainStatus: `${API_BASE_URL}/models/train/status`,
        trainHistory: `${API_BASE_URL}/models/train/history`,
        saveModel: `${API_BASE_URL}/models/train/save-model`,
        trainResults: `${API_BASE_URL}/models/train/results`
    },
    
    // 数据导出
    export: {
        task: `${API_BASE_URL}/task/export`,
        taskCOCO: `${API_BASE_URL}/task/export_coco`,
        projectTasks: `${API_BASE_URL}/admin/export_project_tasks`,
        projectTasksYOLO: `${API_BASE_URL}/admin/export_project_tasks_yolo`,
        projectTasksCOCO: `${API_BASE_URL}/admin/export_project_tasks_coco`
    }
};

// 应用常量
export const APP_CONSTANTS = {
    // 应用模式
    MODES: {
        LOGIN: 'login',
        ANNOTATE: 'annotate',
        REVIEW: 'review',
        ADMIN: 'admin',
        PROJECT_MANAGEMENT: 'project_management',
        LABEL_MANAGEMENT: 'label_management',
        DATASET_MANAGEMENT: 'dataset_management',
        TASK_ASSIGNMENT: 'task_assignment',
        MODEL_MANAGEMENT: 'model_management'
    },
    
    // 用户角色
    ROLES: {
        ADMIN: 'admin',
        ANNOTATOR: 'annotator',
        REVIEWER: 'reviewer'
    },
    
    // 任务状态
    TASK_STATUS: {
        UNASSIGNED: 'unassigned',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        REVIEWING: 'reviewing'
    },
    
    // 标注颜色
    ANNOTATION_COLORS: ['#FF3838', '#FF9D38', '#3877FF', '#38FFFF', '#8B38FF', '#FF38F5'],
    
    // 分页配置
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 10,
        DATASET_PAGE_SIZE: 10,
        TASK_PAGE_SIZE: 20,
        REVIEW_PAGE_SIZE: 60
    },
    
    // Toast消息持续时间（毫秒）
    TOAST_DURATION: 3000,
    
    // 支持的视频格式
    SUPPORTED_VIDEO_FORMATS: ['mp4', 'mov', 'avi'],
    
    // 支持的图片格式
    SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'bmp']
};

// 本地存储键名
export const STORAGE_KEYS = {
    USER: 'current_user',
    TOKEN: 'auth_token',
    TASK_SKIP_FRAMES: 'task_skip_frames'
};

// 开发环境配置
export const isDevelopment = () => {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

// 调试模式
export const DEBUG = isDevelopment();

// 日志输出
export const log = (...args) => {
    if (DEBUG) {
        console.log('[App]', ...args);
    }
};

export const logError = (...args) => {
    console.error('[App Error]', ...args);
};

export default {
    API_BASE_URL,
    API_ENDPOINTS,
    APP_CONSTANTS,
    STORAGE_KEYS,
    isDevelopment,
    DEBUG,
    log,
    logError
};
