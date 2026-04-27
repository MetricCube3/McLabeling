/**
 * 模型管理模块（重构版）
 * 处理YOLO模型上传、训练和管理
 * 从 model_management.js 迁移并优化
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';

// DOM元素
let uploadModelBtn = null;
let modelUploadInput = null;
let modelNameInput = null;
let startTrainBtn = null;
let stopTrainBtn = null;
let trainProjectSelect = null;
let expandLogBtn = null;
let fullscreenLogModal = null;
let closeFullscreenLogBtn = null;
let resultsModal = null;
let closeResultsBtn = null;

// 训练监控
let trainingInterval = null;

/**
 * 初始化模型管理模块
 */
export function init() {
    // 获取DOM元素
    uploadModelBtn = document.getElementById('upload-model-btn');
    modelUploadInput = document.getElementById('model-upload-input');
    modelNameInput = document.getElementById('model-name-input');
    startTrainBtn = document.getElementById('start-train-btn');
    stopTrainBtn = document.getElementById('stop-train-btn');
    trainProjectSelect = document.getElementById('train-project-select');
    expandLogBtn = document.getElementById('expand-log-btn');
    fullscreenLogModal = document.getElementById('fullscreen-log-modal');
    closeFullscreenLogBtn = document.getElementById('close-fullscreen-log-btn');
    resultsModal = document.getElementById('training-results-modal');
    closeResultsBtn = document.getElementById('close-results-modal-btn');
    
    setupEventListeners();
    
    // 订阅事件
    eventBus.on('model:load-ui', loadModelManagementUI);
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
    // 上传模型
    if (uploadModelBtn) {
        uploadModelBtn.addEventListener('click', handleUploadModel);
    }
    
    // 训练控制
    if (startTrainBtn) {
        startTrainBtn.addEventListener('click', handleStartTraining);
    }
    
    if (stopTrainBtn) {
        stopTrainBtn.addEventListener('click', handleStopTraining);
    }
    
    // 全屏日志
    if (expandLogBtn) {
        expandLogBtn.addEventListener('click', handleExpandLog);
    }
    
    if (closeFullscreenLogBtn) {
        closeFullscreenLogBtn.addEventListener('click', () => {
            if (fullscreenLogModal) fullscreenLogModal.classList.add('hidden');
        });
    }
    
    if (fullscreenLogModal) {
        fullscreenLogModal.addEventListener('click', (e) => {
            if (e.target === fullscreenLogModal) {
                fullscreenLogModal.classList.add('hidden');
            }
        });
    }
    
    // 训练结果模态框
    if (closeResultsBtn) {
        closeResultsBtn.addEventListener('click', () => {
            if (resultsModal) resultsModal.classList.add('hidden');
        });
    }
    
    if (resultsModal) {
        resultsModal.addEventListener('click', (e) => {
            if (e.target === resultsModal) {
                resultsModal.classList.add('hidden');
            }
        });
    }
}

/**
 * 处理模型上传
 */
async function handleUploadModel() {
    const file = modelUploadInput?.files[0];
    const modelName = modelNameInput?.value.trim();
    
    if (!file) {
        showToast('请选择模型文件', 'error');
        return;
    }
    
    if (!modelName) {
        showToast('请输入模型名称', 'error');
        return;
    }
    
    if (!file.name.endsWith('.pt')) {
        showToast('只支持.pt格式的模型文件', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model_name', modelName);
    
    const statusDiv = document.getElementById('model-upload-status');
    if (statusDiv) statusDiv.textContent = '正在上传...';
    if (uploadModelBtn) uploadModelBtn.disabled = true;
    
    try {
        const response = await fetch('/api/models/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('模型上传成功', 'success');
            if (statusDiv) statusDiv.textContent = '上传完成';
            if (modelNameInput) modelNameInput.value = '';
            if (modelUploadInput) modelUploadInput.value = '';
            
            loadUploadedModels();
            loadModelsToTrainSelect();
            
            eventBus.emit('model:uploaded', { modelName });
        } else {
            throw new Error(data.detail || '上传失败');
        }
    } catch (error) {
        showToast(`上传失败: ${error.message}`, 'error');
        if (statusDiv) statusDiv.textContent = '上传失败';
    } finally {
        if (uploadModelBtn) uploadModelBtn.disabled = false;
    }
}

/**
 * 处理开始训练
 */
async function handleStartTraining() {
    const projectName = trainProjectSelect?.value;
    const baseModel = document.getElementById('base-model-select')?.value;
    const taskType = document.getElementById('task-type-select')?.value;
    const epochs = parseInt(document.getElementById('train-epochs')?.value || '100');
    const batch = parseInt(document.getElementById('train-batch')?.value || '16');
    const lr = parseFloat(document.getElementById('train-lr')?.value || '0.01');
    const imgsz = parseInt(document.getElementById('train-imgsz')?.value || '640');
    
    if (!projectName) {
        showToast('请选择训练数据集项目', 'error');
        return;
    }
    
    if (!baseModel) {
        showToast('请选择训练模型', 'error');
        return;
    }
    
    const config = {
        project_name: projectName,
        base_model: baseModel,
        task_type: taskType,
        epochs: epochs,
        batch: batch,
        lr: lr,
        imgsz: imgsz
    };
    
    try {
        const response = await fetch('/api/models/train', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('训练任务已启动', 'success');
            if (startTrainBtn) startTrainBtn.classList.add('hidden');
            if (stopTrainBtn) stopTrainBtn.classList.remove('hidden');
            
            const trainLogSection = document.getElementById('train-log-section');
            if (trainLogSection) trainLogSection.classList.remove('hidden');
            
            startTrainingProgressMonitor();
            eventBus.emit('model:training-started', config);
        } else {
            throw new Error(data.detail || '启动训练失败');
        }
    } catch (error) {
        showToast(`启动训练失败: ${error.message}`, 'error');
    }
}

/**
 * 处理停止训练
 */
async function handleStopTraining() {
    try {
        const response = await fetch('/api/models/train/stop', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('训练已停止', 'success');
            stopTrainingProgressMonitor();
            if (startTrainBtn) startTrainBtn.classList.remove('hidden');
            if (stopTrainBtn) stopTrainBtn.classList.add('hidden');
            
            eventBus.emit('model:training-stopped');
        } else {
            throw new Error(data.detail || '停止训练失败');
        }
    } catch (error) {
        showToast(`停止训练失败: ${error.message}`, 'error');
    }
}

/**
 * 处理展开日志
 */
function handleExpandLog() {
    if (!fullscreenLogModal) return;
    
    fullscreenLogModal.classList.remove('hidden');
    
    // 同步日志内容
    const trainLog = document.getElementById('train-log');
    const fullscreenLog = document.getElementById('fullscreen-train-log');
    if (trainLog && fullscreenLog) {
        fullscreenLog.innerHTML = trainLog.innerHTML;
        fullscreenLog.scrollTop = fullscreenLog.scrollHeight;
    }
}

/**
 * 加载已上传的模型列表
 */
async function loadUploadedModels() {
    try {
        const [modelsResponse, activeResponse] = await Promise.all([
            fetch('/api/models/list'),
            fetch('/api/models/active')
        ]);
        
        const modelsData = await modelsResponse.json();
        const activeData = await activeResponse.json();
        
        const activeModel = activeData.active_model;
        
        // 更新当前应用模型显示
        const activeModelName = document.getElementById('active-model-name');
        if (activeModelName) {
            activeModelName.textContent = activeModel || '未设置';
            activeModelName.className = activeModel ? 'active-model-name active' : 'active-model-name';
        }
        
        if (modelsResponse.ok && modelsData.success) {
            const modelsList = document.getElementById('uploaded-models-list');
            
            if (!modelsList) return;
            
            if (modelsData.models.length === 0) {
                modelsList.innerHTML = '<p class="empty-message">暂无模型</p>';
                return;
            }
            
            modelsList.innerHTML = modelsData.models.map(model => {
                const isActive = model.name === activeModel;
                return `
                    <div class="model-item ${isActive ? 'active-model-item' : ''}">
                        <div class="model-info">
                            <span class="model-name">📦 ${model.name} ${isActive ? '<span class="badge-active">已应用</span>' : ''}</span>
                            <span class="model-size">${formatFileSize(model.size)}</span>
                            <span class="model-time">${formatDateTime(model.modified_time)}</span>
                        </div>
                        <div class="model-actions">
                            ${!isActive ? `<button class="btn-primary btn-small" data-model-name="${model.name}" data-action="set-active">应用</button>` : ''}
                            <button class="btn-danger btn-small" data-model-name="${model.name}" data-action="delete">删除</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            // 绑定模型操作事件
            bindModelActions(modelsList);
            
            eventBus.emit('model:list-loaded', { models: modelsData.models, activeModel });
        }
    } catch (error) {
        console.error('Failed to load models:', error);
    }
}

/**
 * 绑定模型操作事件
 */
function bindModelActions(container) {
    container.querySelectorAll('[data-action="set-active"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modelName = btn.getAttribute('data-model-name');
            setActiveModel(modelName);
        });
    });
    
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modelName = btn.getAttribute('data-model-name');
            deleteModel(modelName);
        });
    });
}

/**
 * 设置应用模型
 */
export async function setActiveModel(modelName) {
    try {
        const formData = new FormData();
        formData.append('model_name', modelName);
        
        const response = await fetch('/api/models/set_active', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast(`已应用模型: ${modelName}`, 'success');
            loadUploadedModels();
            eventBus.emit('model:active-changed', { modelName });
        } else {
            throw new Error(data.detail || '应用模型失败');
        }
    } catch (error) {
        showToast(`应用模型失败: ${error.message}`, 'error');
    }
}

/**
 * 删除模型
 */
export async function deleteModel(modelName) {
    if (!confirm(`确定要删除模型 "${modelName}" 吗？`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/models/${encodeURIComponent(modelName)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('模型删除成功', 'success');
            loadUploadedModels();
            loadModelsToTrainSelect();
            eventBus.emit('model:deleted', { modelName });
        } else {
            throw new Error(data.detail || '删除失败');
        }
    } catch (error) {
        showToast(`删除失败: ${error.message}`, 'error');
    }
}

/**
 * 加载模型列表到训练模型选择框
 */
async function loadModelsToTrainSelect() {
    try {
        const response = await fetch('/api/models/list');
        const data = await response.json();
        
        if (response.ok && data.success) {
            const baseModelSelect = document.getElementById('base-model-select');
            
            if (!baseModelSelect) return;
            
            if (data.models.length === 0) {
                baseModelSelect.innerHTML = '<option value="">暂无可用模型，请先上传</option>';
                return;
            }
            
            baseModelSelect.innerHTML = '<option value="">请选择模型</option>' +
                data.models.map(model => 
                    `<option value="${model.name}">${model.name}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Failed to load models to select:', error);
    }
}

/**
 * 加载训练历史
 */
async function loadTrainHistory() {
    try {
        const response = await fetch('/api/models/train/history');
        const data = await response.json();
        
        if (response.ok && data.success) {
            const historyList = document.getElementById('train-history-list');
            
            if (!historyList) return;
            
            if (data.history.length === 0) {
                historyList.innerHTML = '<p class="empty-message">暂无训练历史</p>';
                return;
            }
            
            historyList.innerHTML = data.history.map(item => `
                <div class="history-item">
                    <div class="history-info">
                        <span class="history-name">🎯 ${item.name}</span>
                        <span class="history-time">${formatDateTime(item.time)}</span>
                        <span class="history-size">${formatFileSize(item.size)}</span>
                    </div>
                    <div class="history-actions">
                        ${item.has_best_model ? `
                            <button class="btn-small btn-primary" data-train-path="${item.train_path}" data-action="save-model">
                                <span class="btn-icon">💾</span>
                                保存模型
                            </button>
                        ` : ''}
                        <button class="btn-small btn-secondary" data-train-path="${item.train_path}" data-action="view-results">
                            <span class="btn-icon">📊</span>
                            查看效果图
                        </button>
                    </div>
                </div>
            `).join('');
            
            // 绑定历史操作事件
            bindHistoryActions(historyList);
        }
    } catch (error) {
        console.error('Failed to load training history:', error);
    }
}

/**
 * 绑定训练历史操作事件
 */
function bindHistoryActions(container) {
    container.querySelectorAll('[data-action="save-model"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const trainPath = btn.getAttribute('data-train-path');
            saveTrainedModel(trainPath);
        });
    });
    
    container.querySelectorAll('[data-action="view-results"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const trainPath = btn.getAttribute('data-train-path');
            viewTrainingResults(trainPath);
        });
    });
}

/**
 * 保存训练好的模型
 */
export async function saveTrainedModel(trainPath) {
    try {
        const formData = new FormData();
        formData.append('train_path', trainPath);
        
        const response = await fetch('/api/models/train/save-model', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast(data.message, 'success');
            loadUploadedModels();
            loadModelsToTrainSelect();
            eventBus.emit('model:saved', { trainPath });
        } else {
            throw new Error(data.detail || '保存模型失败');
        }
    } catch (error) {
        showToast(`保存模型失败: ${error.message}`, 'error');
    }
}

/**
 * 查看训练效果图
 */
export async function viewTrainingResults(trainPath) {
    try {
        const response = await fetch(`/api/models/train/results?train_path=${encodeURIComponent(trainPath)}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            const imageGrid = document.getElementById('training-results-grid');
            
            if (!imageGrid || !resultsModal) return;
            
            if (data.images.length === 0) {
                imageGrid.innerHTML = '<p class="empty-message">暂无训练效果图</p>';
            } else {
                imageGrid.innerHTML = data.images.map(img => `
                    <div class="result-image-item" data-image-url="${img.url}" data-image-name="${img.name}">
                        <h4>${img.name}</h4>
                        <img src="${img.url}" alt="${img.name}">
                    </div>
                `).join('');
                
                // 绑定点击图片放大事件
                imageGrid.querySelectorAll('.result-image-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const url = item.getAttribute('data-image-url');
                        const name = item.getAttribute('data-image-name');
                        showImageLightbox(url, name);
                    });
                });
            }
            
            resultsModal.classList.remove('hidden');
        } else {
            throw new Error(data.detail || '获取训练结果失败');
        }
    } catch (error) {
        showToast(`获取训练结果失败: ${error.message}`, 'error');
    }
}

/**
 * 显示图片灯箱（大图查看）
 */
function showImageLightbox(imageUrl, imageName) {
    // 移除已存在的灯箱
    let existing = document.getElementById('image-lightbox');
    if (existing) existing.remove();
    
    const lightbox = document.createElement('div');
    lightbox.id = 'image-lightbox';
    lightbox.className = 'image-lightbox-modal';
    lightbox.innerHTML = `
        <button class="image-lightbox-close">&times;</button>
        <div class="image-lightbox-content">
            <img class="image-lightbox-img" src="${imageUrl}" alt="${imageName}">
            <div class="image-lightbox-caption">${imageName}</div>
        </div>
    `;
    
    document.body.appendChild(lightbox);
    
    // 关闭事件
    const closeBtn = lightbox.querySelector('.image-lightbox-close');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideImageLightbox();
    });
    lightbox.addEventListener('click', () => hideImageLightbox());
    
    // ESC键关闭
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            hideImageLightbox();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * 隐藏图片灯箱
 */
function hideImageLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox) {
        lightbox.remove();
    }
}

/**
 * 启动训练进度监控
 */
function startTrainingProgressMonitor() {
    if (trainingInterval) {
        clearInterval(trainingInterval);
    }
    
    trainingInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/models/train/status');
            const data = await response.json();
            
            if (response.ok && data.success) {
                const status = data.status;
                
                // 更新日志
                const trainLog = document.getElementById('train-log');
                const fullscreenLog = document.getElementById('fullscreen-train-log');
                
                if (status.log.length > 0) {
                    const logHTML = status.log.map(line => 
                        `<div class="log-line">${line}</div>`
                    ).join('');
                    
                    // 检查用户是否在查看底部
                    const isTrainLogAtBottom = trainLog && (trainLog.scrollHeight - trainLog.scrollTop - trainLog.clientHeight < 50);
                    const isFullscreenLogAtBottom = fullscreenLog && (fullscreenLog.scrollHeight - fullscreenLog.scrollTop - fullscreenLog.clientHeight < 50);
                    
                    // 更新两个日志显示区域
                    if (trainLog) trainLog.innerHTML = logHTML;
                    if (fullscreenLog) fullscreenLog.innerHTML = logHTML;
                    
                    // 只在用户位于底部时自动滚动
                    if (isTrainLogAtBottom && trainLog) {
                        trainLog.scrollTop = trainLog.scrollHeight;
                    }
                    if (isFullscreenLogAtBottom && fullscreenLog) {
                        fullscreenLog.scrollTop = fullscreenLog.scrollHeight;
                    }
                }
                
                // 如果训练完成或停止
                if (!status.is_training) {
                    stopTrainingProgressMonitor();
                    if (startTrainBtn) startTrainBtn.classList.remove('hidden');
                    if (stopTrainBtn) stopTrainBtn.classList.add('hidden');
                    loadTrainHistory();
                    loadUploadedModels();
                    loadModelsToTrainSelect();
                    eventBus.emit('model:training-completed');
                }
            }
        } catch (error) {
            console.error('Failed to get training status:', error);
        }
    }, 2000); // 每2秒更新一次
}

/**
 * 停止训练进度监控
 */
function stopTrainingProgressMonitor() {
    if (trainingInterval) {
        clearInterval(trainingInterval);
        trainingInterval = null;
    }
}

/**
 * 加载模型管理UI
 */
export async function loadModelManagementUI() {
    const userRoles = appState.getState('userRoles');
    const currentUser = appState.getState('currentUser');
    
    // 只有管理员可以访问模型管理
    if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
        showToast('需要管理员权限访问模型管理');
        eventBus.emit('ui:switch-mode', 'annotate');
        return;
    }
    
    // 加载项目列表到训练项目选择框
    try {
        const response = await fetch(`/api/admin/projects?user=${encodeURIComponent(currentUser || '')}`);
        const data = await response.json();
        
        if (response.ok && data.projects && trainProjectSelect) {
            const projectNames = Object.keys(data.projects);
            trainProjectSelect.innerHTML = '<option value="">请选择项目</option>' +
                projectNames.map(projectName => 
                    `<option value="${projectName}">${projectName}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
    
    // 加载已上传的模型和训练历史
    loadUploadedModels();
    loadModelsToTrainSelect();
    loadTrainHistory();
    
    eventBus.emit('model:ui-loaded');
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * 格式化日期时间
 */
function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN');
}

export default {
    init,
    loadModelManagementUI,
    setActiveModel,
    deleteModel,
    saveTrainedModel,
    viewTrainingResults
};
