/**
 * 模型管理模块骨架
 * 说明：实际的模型管理功能已在 model-management.js 中实现
 * 这个文件提供了一个统一的接口封装，方便未来重构
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { apiGet, apiPost, apiDelete, apiUpload } from '../../utils/api.js';
import { showToast } from '../../utils/toast.js';

/**
 * 初始化模型管理模块
 */
export function init() {
    // 如果需要从旧模块迁移，在这里初始化
    // 目前模型管理功能在 model-management.js 中
}

/**
 * 获取模型列表
 * API: /api/models/list
 */
export async function getModelList() {
    try {
        const data = await apiGet('/api/models/list');
        if (data.success) {
            return data.models || [];
        }
        throw new Error(data.detail || '获取模型列表失败');
    } catch (error) {
        console.error('Get model list failed:', error);
        throw error;
    }
}

/**
 * 获取当前激活的模型
 * API: /api/models/active
 */
export async function getActiveModel() {
    try {
        const data = await apiGet('/api/models/active');
        return data.active_model || null;
    } catch (error) {
        console.error('Get active model failed:', error);
        return null;
    }
}

/**
 * 上传模型文件
 * API: /api/models/upload
 * @param {File} file - 模型文件(.pt)
 * @param {string} modelName - 模型名称
 * @param {Function} onProgress - 进度回调
 */
export async function uploadModel(file, modelName, onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model_name', modelName);
    
    try {
        const data = await apiUpload('/api/models/upload', formData, onProgress);
        
        if (data.success) {
            showToast('模型上传成功', 'success');
            eventBus.emit(EVENTS.MODEL_UPLOADED, { modelName });
            return data;
        }
        throw new Error(data.detail || '上传失败');
    } catch (error) {
        console.error('Upload model failed:', error);
        throw error;
    }
}

/**
 * 删除模型
 * API: /api/models/{model_name}
 * @param {string} modelName - 模型名称
 */
export async function deleteModel(modelName) {
    try {
        const data = await apiDelete(`/api/models/${encodeURIComponent(modelName)}`);
        
        if (data.success) {
            showToast('模型删除成功', 'success');
            eventBus.emit(EVENTS.MODEL_DELETED, { modelName });
            return data;
        }
        throw new Error(data.detail || '删除失败');
    } catch (error) {
        console.error('Delete model failed:', error);
        throw error;
    }
}

/**
 * 设置激活模型
 * API: /api/models/set_active
 * @param {string} modelName - 模型名称
 */
export async function setActiveModel(modelName) {
    const formData = new FormData();
    formData.append('model_name', modelName);
    
    try {
        const data = await apiPost('/api/models/set_active', formData);
        
        if (data.success) {
            showToast(`已应用模型: ${modelName}`, 'success');
            eventBus.emit(EVENTS.MODEL_ACTIVATED, { modelName });
            return data;
        }
        throw new Error(data.detail || '应用模型失败');
    } catch (error) {
        console.error('Set active model failed:', error);
        throw error;
    }
}

/**
 * 开始训练
 * API: /api/models/train
 * @param {Object} config - 训练配置
 */
export async function startTraining(config) {
    try {
        const data = await apiPost('/api/models/train', config);
        
        if (data.success) {
            showToast('训练任务已启动', 'success');
            eventBus.emit(EVENTS.MODEL_TRAIN_STARTED, config);
            return data;
        }
        throw new Error(data.detail || '启动训练失败');
    } catch (error) {
        console.error('Start training failed:', error);
        throw error;
    }
}

/**
 * 停止训练
 * API: /api/models/train/stop
 */
export async function stopTraining() {
    try {
        const data = await apiPost('/api/models/train/stop');
        
        if (data.success) {
            showToast('训练已停止', 'success');
            return data;
        }
        throw new Error(data.detail || '停止训练失败');
    } catch (error) {
        console.error('Stop training failed:', error);
        throw error;
    }
}

/**
 * 获取训练状态
 * API: /api/models/train/status
 */
export async function getTrainingStatus() {
    try {
        const data = await apiGet('/api/models/train/status');
        if (data.success) {
            return data.status;
        }
        throw new Error(data.detail || '获取训练状态失败');
    } catch (error) {
        console.error('Get training status failed:', error);
        throw error;
    }
}

/**
 * 获取训练历史
 * API: /api/models/train/history
 */
export async function getTrainingHistory() {
    try {
        const data = await apiGet('/api/models/train/history');
        if (data.success) {
            return data.history || [];
        }
        throw new Error(data.detail || '获取训练历史失败');
    } catch (error) {
        console.error('Get training history failed:', error);
        throw error;
    }
}

/**
 * 保存训练好的模型
 * API: /api/models/train/save-model
 * @param {string} trainPath - 训练路径
 */
export async function saveTrainedModel(trainPath) {
    const formData = new FormData();
    formData.append('train_path', trainPath);
    
    try {
        const data = await apiPost('/api/models/train/save-model', formData);
        
        if (data.success) {
            showToast(data.message || '模型保存成功', 'success');
            return data;
        }
        throw new Error(data.detail || '保存模型失败');
    } catch (error) {
        console.error('Save trained model failed:', error);
        throw error;
    }
}

/**
 * 查看训练结果
 * API: /api/models/train/results
 * @param {string} trainPath - 训练路径
 */
export async function getTrainingResults(trainPath) {
    try {
        const data = await apiGet(`/api/models/train/results?train_path=${encodeURIComponent(trainPath)}`);
        
        if (data.success) {
            return data.images || [];
        }
        throw new Error(data.detail || '获取训练结果失败');
    } catch (error) {
        console.error('Get training results failed:', error);
        throw error;
    }
}

export default {
    init,
    getModelList,
    getActiveModel,
    uploadModel,
    deleteModel,
    setActiveModel,
    startTraining,
    stopTraining,
    getTrainingStatus,
    getTrainingHistory,
    saveTrainedModel,
    getTrainingResults
};
