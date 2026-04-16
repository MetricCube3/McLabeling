/**
 * 模型管理模块
 * 处理YOLO模型上传、训练和管理
 */

// 初始化模型管理功能
function initModelManagement() {
    // 获取全局函数引用
    const switchMode = window.switchMode || function() { console.error('switchMode not available'); };
    const showToast = window.showToast || function() { console.error('showToast not available'); };
    
    const modelManagementModeBtn = document.getElementById('model-management-mode-btn');
    const modelManagementUI = document.getElementById('model-management-ui');
    const uploadModelBtn = document.getElementById('upload-model-btn');
    const modelUploadInput = document.getElementById('model-upload-input');
    const modelNameInput = document.getElementById('model-name-input');
    const startTrainBtn = document.getElementById('start-train-btn');
    const stopTrainBtn = document.getElementById('stop-train-btn');
    const trainProjectSelect = document.getElementById('train-project-select');

    let trainingInterval = null;


    // 模型管理模式按钮点击
    if (modelManagementModeBtn) {
        modelManagementModeBtn.addEventListener('click', () => {
            window.switchMode('model_management');
        });
    } else {
        console.error('[Model Management] Button not found!');
    }

    // 上传模型按钮
    if (uploadModelBtn) {
        uploadModelBtn.addEventListener('click', async () => {
            const file = modelUploadInput.files[0];
            const modelName = modelNameInput.value.trim();

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
            statusDiv.textContent = '正在上传...';
            uploadModelBtn.disabled = true;

            try {
                const response = await fetch('/api/models/upload', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showToast('模型上传成功', 'success');
                    statusDiv.textContent = '上传完成';
                    modelNameInput.value = '';
                    modelUploadInput.value = '';
                    loadUploadedModels();
                    loadModelsToTrainSelect();
                } else {
                    throw new Error(data.detail || '上传失败');
                }
            } catch (error) {
                showToast(`上传失败: ${error.message}`, 'error');
                statusDiv.textContent = '上传失败';
            } finally {
                uploadModelBtn.disabled = false;
            }
        });
    }

    // 开始训练按钮
    if (startTrainBtn) {
        startTrainBtn.addEventListener('click', async () => {
            const projectName = trainProjectSelect.value;
            const baseModel = document.getElementById('base-model-select').value;
            const taskType = document.getElementById('task-type-select').value;
            const epochs = parseInt(document.getElementById('train-epochs').value);
            const batch = parseInt(document.getElementById('train-batch').value);
            const lr = parseFloat(document.getElementById('train-lr').value);
            const imgsz = parseInt(document.getElementById('train-imgsz').value);

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
                    startTrainBtn.classList.add('hidden');
                    stopTrainBtn.classList.remove('hidden');
                    document.getElementById('train-log-section').classList.remove('hidden');
                    startTrainingProgressMonitor();
                } else {
                    throw new Error(data.detail || '启动训练失败');
                }
            } catch (error) {
                showToast(`启动训练失败: ${error.message}`, 'error');
            }
        });
    }

    // 停止训练按钮
    if (stopTrainBtn) {
        stopTrainBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/models/train/stop', {
                    method: 'POST'
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showToast('训练已停止', 'success');
                    stopTrainingProgressMonitor();
                    startTrainBtn.classList.remove('hidden');
                    stopTrainBtn.classList.add('hidden');
                } else {
                    throw new Error(data.detail || '停止训练失败');
                }
            } catch (error) {
                showToast(`停止训练失败: ${error.message}`, 'error');
            }
        });
    }

    // 加载已上传的模型列表
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
                                ${!isActive ? `<button class="btn-primary btn-small" onclick="setActiveModel('${model.name}')">应用</button>` : ''}
                                <button class="btn-danger btn-small" onclick="deleteModel('${model.name}')">删除</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }
    
    // 设置应用模型
    window.setActiveModel = async function(modelName) {
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
            } else {
                throw new Error(data.detail || '应用模型失败');
            }
        } catch (error) {
            showToast(`应用模型失败: ${error.message}`, 'error');
        }
    };

    // 加载模型列表到训练模型选择框
    async function loadModelsToTrainSelect() {
        try {
            const response = await fetch('/api/models/list');
            const data = await response.json();

            if (response.ok && data.success) {
                const baseModelSelect = document.getElementById('base-model-select');
                
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

    // 加载训练历史
    async function loadTrainHistory() {
        try {
            const response = await fetch('/api/models/train/history');
            const data = await response.json();

            if (response.ok && data.success) {
                const historyList = document.getElementById('train-history-list');
                
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
                                <button class="btn-small btn-primary" onclick="saveTrainedModel('${item.train_path}')">
                                    <span class="btn-icon">💾</span>
                                    保存模型
                                </button>
                            ` : ''}
                            <button class="btn-small btn-secondary" onclick="viewTrainingResults('${item.train_path}')">
                                <span class="btn-icon">📊</span>
                                查看效果图
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load training history:', error);
        }
    }

    // 监控训练日志
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
                        
                        // 检查用户是否在查看底部（距离底部小于50px视为在底部）
                        const isTrainLogAtBottom = trainLog.scrollHeight - trainLog.scrollTop - trainLog.clientHeight < 50;
                        const isFullscreenLogAtBottom = fullscreenLog.scrollHeight - fullscreenLog.scrollTop - fullscreenLog.clientHeight < 50;
                        
                        // 更新两个日志显示区域
                        trainLog.innerHTML = logHTML;
                        fullscreenLog.innerHTML = logHTML;
                        
                        // 只在用户位于底部时自动滚动
                        if (isTrainLogAtBottom) {
                            trainLog.scrollTop = trainLog.scrollHeight;
                        }
                        if (isFullscreenLogAtBottom) {
                            fullscreenLog.scrollTop = fullscreenLog.scrollHeight;
                        }
                    }

                    // 如果训练完成或停止
                    if (!status.is_training) {
                        stopTrainingProgressMonitor();
                        startTrainBtn.classList.remove('hidden');
                        stopTrainBtn.classList.add('hidden');
                        loadTrainHistory();
                        // 重新加载模型列表，因为训练可能生成了新模型
                        loadUploadedModels();
                        loadModelsToTrainSelect();
                    }
                }
            } catch (error) {
                console.error('Failed to get training status:', error);
            }
        }, 2000); // 每2秒更新一次
    }

    function stopTrainingProgressMonitor() {
        if (trainingInterval) {
            clearInterval(trainingInterval);
            trainingInterval = null;
        }
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    // 格式化日期时间
    function formatDateTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN');
    }

    // 删除模型（全局函数）
    window.deleteModel = async function(modelName) {
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
            } else {
                throw new Error(data.detail || '删除失败');
            }
        } catch (error) {
            showToast(`删除失败: ${error.message}`, 'error');
        }
    };

    // 全屏日志功能
    const expandLogBtn = document.getElementById('expand-log-btn');
    const fullscreenLogModal = document.getElementById('fullscreen-log-modal');
    const closeFullscreenLogBtn = document.getElementById('close-fullscreen-log-btn');
    
    if (expandLogBtn) {
        expandLogBtn.addEventListener('click', () => {
            // 显示全屏模态框
            fullscreenLogModal.classList.remove('hidden');
            
            // 同步日志内容
            const trainLog = document.getElementById('train-log');
            const fullscreenLog = document.getElementById('fullscreen-train-log');
            fullscreenLog.innerHTML = trainLog.innerHTML;
            fullscreenLog.scrollTop = fullscreenLog.scrollHeight;
        });
    }
    
    if (closeFullscreenLogBtn) {
        closeFullscreenLogBtn.addEventListener('click', () => {
            fullscreenLogModal.classList.add('hidden');
        });
    }
    
    // 点击背景关闭模态框
    if (fullscreenLogModal) {
        fullscreenLogModal.addEventListener('click', (e) => {
            if (e.target === fullscreenLogModal) {
                fullscreenLogModal.classList.add('hidden');
            }
        });
    }

    // 训练结果模态框关闭事件
    const resultsModal = document.getElementById('training-results-modal');
    const closeResultsBtn = document.getElementById('close-results-modal-btn');
    
    if (closeResultsBtn) {
        closeResultsBtn.addEventListener('click', () => {
            resultsModal.classList.add('hidden');
        });
    }
    
    if (resultsModal) {
        resultsModal.addEventListener('click', (e) => {
            if (e.target === resultsModal) {
                resultsModal.classList.add('hidden');
            }
        });
    }

    // 保存训练好的模型到模型列表
    window.saveTrainedModel = async function(trainPath) {
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
                // 重新加载模型列表
                loadUploadedModels();
                loadModelsToTrainSelect();
            } else {
                throw new Error(data.detail || '保存模型失败');
            }
        } catch (error) {
            showToast(`保存模型失败: ${error.message}`, 'error');
        }
    };
    
    // 查看训练效果图
    window.viewTrainingResults = async function(trainPath) {
        try {
            const response = await fetch(`/api/models/train/results?train_path=${encodeURIComponent(trainPath)}`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                const modal = document.getElementById('training-results-modal');
                const imageGrid = document.getElementById('training-results-grid');
                
                if (data.images.length === 0) {
                    imageGrid.innerHTML = '<p class="empty-message">暂无训练效果图</p>';
                } else {
                    imageGrid.innerHTML = data.images.map(img => `
                        <div class="result-image-item">
                            <h4>${img.name}</h4>
                            <img src="${img.url}" alt="${img.name}">
                        </div>
                    `).join('');
                }
                
                modal.classList.remove('hidden');
            } else {
                throw new Error(data.detail || '获取训练结果失败');
            }
        } catch (error) {
            showToast(`获取训练结果失败: ${error.message}`, 'error');
        }
    };

    // 加载模型管理UI
    window.loadModelManagementUI = async function() {
        
        // 只有管理员可以访问模型管理
        if (!Array.isArray(window.userRoles) || !window.userRoles.includes('admin')) {
            showToast('需要管理员权限访问模型管理');
            switchMode('annotate');
            return;
        }


        // 加载项目列表到训练项目选择框
        try {
            // 使用正确的API路由获取项目列表
            const response = await fetch(`/api/admin/projects?user=${encodeURIComponent(window.currentUser || '')}`);
            const data = await response.json();
            
            if (response.ok && data.projects) {
                // 项目数据是对象格式，需要转换为数组
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
    };
}

// 页面加载完成后初始化
// 使用setTimeout确保在app.js初始化并暴露全局函数后再执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initModelManagement, 0);
    });
} else {
    setTimeout(initModelManagement, 0);
}
