/**
 * 项目任务统计模态框事件处理
 * 处理任务选择、汇总和导出功能
 */

import { appState } from '../../core/state.js';
import { showToast } from '../../utils/toast.js';

/**
 * 设置任务统计模态框事件
 */
export function setupTaskStatsModalEvents(modal, annotationTasks, projectName) {
    const closeModal = () => document.body.removeChild(modal);
    const selectAllCheckbox = modal.querySelector('#select-all-tasks');
    const aggregateBtn = modal.querySelector('#aggregate-selected-btn');
    const taskCheckboxes = modal.querySelectorAll('.task-select-checkbox');

    // 关闭按钮事件
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    
    const closeStatsBtn = modal.querySelector('#close-stats-modal');
    if (closeStatsBtn) {
        closeStatsBtn.addEventListener('click', closeModal);
    }

    if (selectAllCheckbox && aggregateBtn) {
        // 全选/取消全选
        selectAllCheckbox.addEventListener('change', (e) => {
            taskCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });

        // 汇总选中任务
        aggregateBtn.addEventListener('click', () => {
            const selectedTasks = Array.from(taskCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => {
                    const taskPath = cb.dataset.taskPath;
                    return annotationTasks.find(task => task.path === taskPath);
                })
                .filter(task => task);

            if (selectedTasks.length === 0) {
                showToast('请至少选择一个任务进行汇总', 'warning');
                return;
            }

            showAggregateStats(selectedTasks, projectName);
        });
    }

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // ESC键关闭
    const handleEscKey = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscKey);
        }
    };
    document.addEventListener('keydown', handleEscKey);
}

/**
 * 显示汇总统计
 */
async function showAggregateStats(selectedTasks, projectName) {
    // 计算汇总统计
    const aggregateStats = {
        total_tasks: selectedTasks.length,
        total_images: 0,
        total_annotated_images: 0,
        total_labels: 0,
        label_counts: {},
        status_counts: {
            "in_progress": 0,
            "completed": 0,
            "unassigned": 0
        }
    };

    // 收集所有标签信息
    const allLabelCounts = {};
    const taskPaths = [];

    selectedTasks.forEach(task => {
        const stats = task.stats || {};
        aggregateStats.total_images += stats.total_images || 0;
        aggregateStats.total_annotated_images += stats.annotated_images || 0;
        aggregateStats.total_labels += stats.total_labels || 0;

        // 统计任务状态
        const status = task.status || 'in_progress';
        if (aggregateStats.status_counts[status] !== undefined) {
            aggregateStats.status_counts[status] = aggregateStats.status_counts[status] + 1;
        }

        // 收集任务路径
        taskPaths.push(task.path);

        // 合并标签统计
        const labelCounts = stats.label_counts || {};
        Object.entries(labelCounts).forEach(([labelName, count]) => {
            allLabelCounts[labelName] = (allLabelCounts[labelName] || 0) + count;
        });
    });

    aggregateStats.label_counts = allLabelCounts;

    // 计算完成率
    const completionRate = aggregateStats.total_images > 0
        ? Math.round((aggregateStats.total_annotated_images / aggregateStats.total_images) * 100 * 10) / 10
        : 0;

    // 获取项目标签信息
    const currentUser = appState.getState('currentUser');
    let projectLabels = [];
    try {
        const response = await fetch(`/api/admin/project_task_stats?user=${currentUser}&project=${projectName}`);
        if (response.ok) {
            const data = await response.json();
            projectLabels = data.project_labels || [];
        }
    } catch (error) {
        console.error('Failed to fetch project labels:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay aggregate-stats-modal';

    // 生成标签汇总分布HTML
    const labelAggregateHTML = generateLabelAggregateHTML(aggregateStats.label_counts, aggregateStats.total_labels, projectLabels);

    modal.innerHTML = `
        <div class="modal-dialog aggregate-stats-dialog">
            <button class="close-modal-btn" title="关闭">&times;</button>
            <div class="modal-header">
                <h3>📊 选中任务汇总统计</h3>
                <p class="stats-notice">💡 已选中 ${selectedTasks.length} 个任务</p>
            </div>
            <div class="modal-body">
                <div class="aggregate-summary">
                    <h4>选中 ${selectedTasks.length} 个任务的汇总结果</h4>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <div class="summary-icon">📋</div>
                            <div class="summary-content">
                                <div class="summary-value">${aggregateStats.total_tasks}</div>
                                <div class="summary-label">总任务数</div>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">🖼️</div>
                            <div class="summary-content">
                                <div class="summary-value">${aggregateStats.total_images}</div>
                                <div class="summary-label">总图片数</div>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">✅</div>
                            <div class="summary-content">
                                <div class="summary-value">${aggregateStats.total_annotated_images}</div>
                                <div class="summary-label">已标注图片</div>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">🏷️</div>
                            <div class="summary-content">
                                <div class="summary-value">${aggregateStats.total_labels}</div>
                                <div class="summary-label">总标签数</div>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">📈</div>
                            <div class="summary-content">
                                <div class="summary-value">${completionRate}%</div>
                                <div class="summary-label">完成率</div>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">⚡</div>
                            <div class="summary-content">
                                <div class="summary-value">${aggregateStats.status_counts.in_progress}</div>
                                <div class="summary-label">进行中</div>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">🎉</div>
                            <div class="summary-content">
                                <div class="summary-value">${aggregateStats.status_counts.completed}</div>
                                <div class="summary-label">已完成</div>
                            </div>
                        </div>
                    </div>
                </div>

                ${Object.keys(aggregateStats.label_counts).length > 0 ? `
                <div class="aggregate-labels-section">
                    <h4>🏷️ 标签分布汇总</h4>
                    ${labelAggregateHTML}
                </div>
                ` : ''}

                <!-- 导出功能 -->
                <div class="export-section">
                    <h5>📤 导出标注数据</h5>
                    <div class="export-controls">
                        <!-- 数据集划分比例 -->
                        <div class="export-config-group">
                            <label class="section-label">数据集划分比例</label>
                            <div class="ratio-controls">
                                <div class="ratio-inputs-horizontal">
                                    <div class="ratio-group-horizontal">
                                        <label for="train-ratio">训练集</label>
                                        <div class="ratio-input-wrapper">
                                            <input type="number" id="train-ratio" class="ratio-input" value="70" min="0" max="100">
                                            <span class="ratio-unit">%</span>
                                        </div>
                                    </div>
                                    <div class="ratio-group-horizontal">
                                        <label for="val-ratio">验证集</label>
                                        <div class="ratio-input-wrapper">
                                            <input type="number" id="val-ratio" class="ratio-input" value="20" min="0" max="100">
                                            <span class="ratio-unit">%</span>
                                        </div>
                                    </div>
                                    <div class="ratio-group-horizontal">
                                        <label for="test-ratio">测试集</label>
                                        <div class="ratio-input-wrapper">
                                            <input type="number" id="test-ratio" class="ratio-input" value="10" min="0" max="100">
                                            <span class="ratio-unit">%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="ratio-summary-horizontal">
                                    <span class="ratio-total-label">比例总和：</span>
                                    <span id="ratio-total" class="ratio-total-value">100</span>
                                    <span class="ratio-unit">%</span>
                                </div>
                            </div>
                        </div>

                        <!-- 选择导出格式 -->
                        <div class="export-config-group">
                            <label class="section-label">选择导出格式</label>
                            <div class="format-select-wrapper">
                                <select id="export-format-select" class="format-select">
                                    <option value="yolo">YOLO格式 (分割+bbox)</option>
                                    <option value="coco">COCO格式 (标准JSON格式)</option>
                                </select>
                                <div class="select-arrow">▼</div>
                            </div>
                        </div>

                        <!-- 开始导出 -->
                        <div class="export-action-group">                                
                            <button id="export-dataset-btn" class="btn-primary export-action-btn">
                                <span class="btn-icon">🚀</span>
                                开始导出
                            </button>
                        </div>
                    </div>
                </div>                        
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 设置比例输入事件
    setupRatioInputs(modal);

    // 设置导出按钮事件
    setupExportButton(modal, taskPaths, projectName, aggregateStats);

    // 关闭事件
    const closeAggregateModal = () => document.body.removeChild(modal);
    modal.querySelector('.close-modal-btn').addEventListener('click', closeAggregateModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAggregateModal();
    });

    // ESC键关闭
    const handleEscKey = (e) => {
        if (e.key === 'Escape') {
            closeAggregateModal();
            document.removeEventListener('keydown', handleEscKey);
        }
    };
    document.addEventListener('keydown', handleEscKey);
}

/**
 * 生成标签汇总分布HTML（参考项目统计页面样式）
 */
function generateLabelAggregateHTML(labelCounts, totalLabels, projectLabels = []) {
    const labels = Object.entries(labelCounts);

    if (labels.length === 0) {
        return '<div class="no-labels-message">暂无标签数据</div>';
    }

    // 创建标签名称到标签对象的映射
    const labelMap = {};
    projectLabels.forEach(label => {
        const labelName = label.name || `标签${label.id}`;
        labelMap[labelName] = label;
    });

    // 按数量排序
    const sortedLabels = labels.sort((a, b) => b[1] - a[1]);
    const total = sortedLabels.reduce((sum, [_, count]) => sum + count, 0);

    return `
        <div class="label-stats-grid">
            ${sortedLabels.map(([labelName, count]) => {
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                const label = labelMap[labelName] || {};
                const labelId = label.id !== undefined ? label.id : '';
                const labelCategory = labelId !== '' ? `ID: ${labelId}` : '';
                const labelColor = label.color || '#00bcd4';
                
                return `
                <div class="label-stat-item">
                    <div class="label-info">
                        <div class="label-header">
                            <span class="label-name" title="${labelName}">${labelName}</span>
                            ${labelCategory ? `<span class="label-category" title="${labelCategory}">(${labelCategory})</span>` : ''}
                        </div>
                        <span class="label-count">${count}</span>
                    </div>
                    <div class="label-bar-container">
                        <div class="label-bar" style="width: ${percentage}%; background-color: ${labelColor}"></div>
                    </div>
                    <div class="label-percentage">${percentage}%</div>
                </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * 设置比例输入事件
 */
function setupRatioInputs(modal) {
    const trainInput = modal.querySelector('#train-ratio');
    const valInput = modal.querySelector('#val-ratio');
    const testInput = modal.querySelector('#test-ratio');
    const totalDisplay = modal.querySelector('#ratio-total');

    const updateTotal = () => {
        const train = parseInt(trainInput.value) || 0;
        const val = parseInt(valInput.value) || 0;
        const test = parseInt(testInput.value) || 0;
        const total = train + val + test;
        
        totalDisplay.textContent = total;
        
        // 如果总和不是100，显示警告颜色
        if (total !== 100) {
            totalDisplay.style.color = '#e74c3c';
        } else {
            totalDisplay.style.color = '#27ae60';
        }
    };

    [trainInput, valInput, testInput].forEach(input => {
        input.addEventListener('input', updateTotal);
        input.addEventListener('change', updateTotal);
    });

    // 初始更新
    updateTotal();
}

/**
 * 设置导出按钮事件
 */
function setupExportButton(modal, taskPaths, projectName, stats) {
    const exportBtn = modal.querySelector('#export-dataset-btn');
    const currentUser = appState.getState('currentUser');

    exportBtn.addEventListener('click', async () => {
        const trainRatio = parseInt(modal.querySelector('#train-ratio').value) || 0;
        const valRatio = parseInt(modal.querySelector('#val-ratio').value) || 0;
        const testRatio = parseInt(modal.querySelector('#test-ratio').value) || 0;
        const exportFormat = modal.querySelector('#export-format-select').value;

        // 验证比例
        if (trainRatio + valRatio + testRatio !== 100) {
            showToast('训练集、验证集、测试集比例之和必须为100%', 'error');
            return;
        }

        if (stats.total_images === 0) {
            showToast('选中的任务中没有可导出的标注数据', 'warning');
            return;
        }

        try {
            // 禁用按钮并显示加载状态
            exportBtn.disabled = true;

            let endpoint, payload;

            if (exportFormat === 'coco') {
                endpoint = '/api/admin/export_project_tasks_coco';
                exportBtn.innerHTML = '<span class="btn-icon">⏳</span>正在导出COCO格式...';
            } else {
                endpoint = '/api/admin/export_project_tasks';
                exportBtn.innerHTML = '<span class="btn-icon">⏳</span>正在导出YOLO格式...';
            }

            payload = {
                user: currentUser,
                project_name: projectName,
                task_paths: taskPaths,
                split_ratios: {
                    train: trainRatio,
                    val: valRatio,
                    test: testRatio
                }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');

                // 触发下载
                const downloadLink = document.createElement('a');
                downloadLink.href = data.download_url;

                // 根据格式生成不同的文件名
                let filename;
                if (exportFormat === 'coco') {
                    filename = `project_${projectName}_coco_export.zip`;
                } else {
                    filename = `project_${projectName}_yolo_export.zip`;
                }

                downloadLink.download = filename;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            } else {
                throw new Error(data.error || '导出失败');
            }

            // 恢复按钮
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<span class="btn-icon">🚀</span>开始导出';

        } catch (error) {
            console.error('Export failed:', error);
            showToast(`导出失败: ${error.message}`, 'error');
            
            // 恢复按钮
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<span class="btn-icon">🚀</span>开始导出';
        }
    });
}
