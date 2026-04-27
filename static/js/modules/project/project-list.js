/**
 * 项目列表模块
 * 处理项目列表的加载和显示
 * 从 app.js 迁移而来
 */

import { API_ENDPOINTS } from '../../core/config.js';
import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { apiGet, apiDelete } from '../../utils/api.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm } from '../../utils/modal.js';
import * as projectCreate from './project-create.js';
import { setupTaskStatsModalEvents } from './project-list-events.js';

/**
 * 初始化项目列表模块
 */
export async function init() {
    console.log('[project-list] Initializing project list module');
    
    try {
        // 初始化项目创建模块
        console.log('[project-list] Calling project-create init');
        await projectCreate.init();
        console.log('[project-list] Project-create init completed');
        
        // 加载项目列表
        console.log('[project-list] Loading projects');
        await loadProjects();
        console.log('[project-list] Projects loaded');
    } catch (error) {
        console.error('[project-list] Error during initialization:', error);
    }
}

/**
 * 加载项目列表
 * 从 app.js:465 迁移
 */
export async function loadProjects() {
    const currentUser = appState.getState('currentUser');
    const userRoles = appState.getState('userRoles');
    
    if (!Array.isArray(userRoles) || !userRoles.includes('admin')) return;
    
    try {
        const response = await fetch(`/api/admin/projects?user=${currentUser}`);
        const data = await response.json();
        
        if (response.ok) {
            const projects = data.projects || {};
            appState.setState('projects', projects);
            renderProjectList(projects);
        } else {
            throw new Error(data.error || '获取项目列表失败');
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
        showToast(`加载项目失败: ${error.message}`, 'error');
    }
}

/**
 * 渲染项目列表
 * 从 app.js:484 迁移
 */
export function renderProjectList(projects) {
    const projectListContainer = document.getElementById('project-list-container');
    const projectCount = document.getElementById('project-count');
    
    if (!projectListContainer) return;
    
    // 清空现有内容
    projectListContainer.innerHTML = '';
    
    const projectEntries = Object.entries(projects);
    projectCount.textContent = `共 ${projectEntries.length} 个项目`;
    
    if (projectEntries.length === 0) {
        projectListContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <h3>暂无项目</h3>
            </div>
        `;
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'project-management-table';
    
    // 表头
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>📛 项目名称</th>
            <th>📅 创建时间</th>
            <th>🏷️ 标签数量</th>
            <th>📊 任务统计</th>
            <th>⚡ 操作</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // 表体
    const tbody = document.createElement('tbody');
    
    projectEntries.forEach(([projectName, projectData]) => {
        const labelCount = projectData.labels ? projectData.labels.length : 0;
        const annotationTasks = projectData.tasks?.annotation?.length || 0;
        const reviewTasks = projectData.tasks?.review?.length || 0;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="project-name-cell">
                <span class="project-icon">📁</span>
                ${projectName}
            </td>
            <td class="project-time-cell">${projectData.created_time}</td>
            <td class="project-labels-cell">
                ${labelCount}
            </td>
            <td class="project-stats-cell">
                <button class="project-action-btn stats-btn" data-project="${projectName}" title="可导出项目标注数据">
                    <span class="btn-icon">👀</span>
                    查看统计
                </button>
            </td>
            <td class="project-actions-cell">
                <button class="project-action-btn delete" data-project="${projectName}">
                    <span class="btn-icon">🗑️</span>
                    删除
                </button>
            </td>
        `;
        
        // 添加事件监听
        const statsBtn = row.querySelector('.stats-btn');
        const deleteBtn = row.querySelector('.delete');
        
        statsBtn.addEventListener('click', () => {
            showProjectTaskStats(projectName);
        });
        
        deleteBtn.addEventListener('click', () => {
            deleteProject(projectName);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    projectListContainer.appendChild(table);
}

/**
 * 显示项目任务统计
 * 从 app.js:570 迁移
 */
export async function showProjectTaskStats(projectName) {
    const currentUser = appState.getState('currentUser');
    
    try {
        const response = await fetch(`/api/admin/project_task_stats?user=${currentUser}&project=${encodeURIComponent(projectName)}`);
        const data = await response.json();
        
        if (response.ok) {
            showTaskStatsModal(data);
        } else {
            throw new Error(data.error || '获取任务统计失败');
        }
    } catch (error) {
        console.error('Failed to load project task stats:', error);
        showToast(`加载任务统计失败: ${error.message}`, 'error');
    }
}

/**
 * 显示任务统计模态框
 * 从 app.legacy.js:586 迁移
 */
function showTaskStatsModal(statsData) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay task-stats-modal';

    const { project_name, project_labels, annotation_tasks, total_stats } = statsData;

    // 确保total_stats有默认值
    const safeStats = {
        total_tasks: 0,
        total_images: 0,
        total_labeled: 0,
        progress: 0,
        label_counts: {},
        status_counts: {
            in_progress: 0,
            completed: 0
        },
        ...total_stats
    };

    // 确保annotation_tasks是数组
    const safeTasks = Array.isArray(annotation_tasks) ? annotation_tasks : [];

    // 生成任务列表HTML
    const taskListHTML = generateTaskListHTML(safeTasks);

    // 生成汇总统计HTML
    const summaryHTML = generateSummaryHTML(safeStats);

    // 生成标签统计HTML
    const labelStatsHTML = generateLabelStatsHTML(safeStats.labeled_counts || safeStats.label_counts || {}, project_labels, project_name);

    modal.innerHTML = `
        <div class="modal-dialog task-stats-dialog">
            <button class="close-modal-btn" title="关闭">&times;</button>
            <div class="modal-header">
                <h3>📊 项目任务统计 - ${project_name}</h3>
                <p class="stats-notice">💡 提示：显示该项目的所有标注任务</p>
            </div>
            <div class="modal-body">
                <!-- 汇总统计 -->
                <div class="stats-summary-section">
                    <h4>📈 项目总览</h4>
                    ${summaryHTML}
                </div>

                <!-- 标签统计 -->
                <div class="label-stats-section">
                    <h4>🏷️ 标签分布</h4>
                    ${labelStatsHTML}
                </div>

                <!-- 任务列表 -->
                <div class="task-list-section">
                    <div class="section-header">
                        <h4>📋 任务详情 (${safeTasks.length})</h4>
                        <div class="task-filters">
                            <label>
                                <input type="checkbox" id="select-all-tasks" class="select-all-checkbox">
                                全选
                            </label>
                            <button id="aggregate-selected-btn" class="btn-secondary btn-sm" ${safeTasks.length === 0 ? 'disabled' : ''}>
                                <span class="btn-icon">📊</span>
                                汇总选中任务
                            </button>
                        </div>
                    </div>
                    ${taskListHTML}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 添加事件监听器
    setupTaskStatsModalEvents(modal, safeTasks, project_name);
}

/**
 * 生成任务列表HTML
 */
function generateTaskListHTML(annotationTasks) {
    if (annotationTasks.length === 0) {
        return `
            <div class="no-tasks-message">
                <p>📭 该项目暂无标注任务</p>
                <p class="no-tasks-hint">请先为项目分配标注任务</p>
            </div>
        `;
    }

    return `
        <div class="task-stats-container">
            <div class="task-stats-grid">
                ${annotationTasks.map(task => generateTaskCardHTML(task)).join('')}
            </div>
        </div>
    `;
}

/**
 * 生成单个任务卡片HTML
 */
function generateTaskCardHTML(task) {
    // 处理任务状态
    let statusClass, statusText;
    if (task.status === 'completed') {
        statusClass = 'completed';
        statusText = '已完成';
    } else if (task.status === 'unassigned') {
        statusClass = 'unassigned';
        statusText = '未分配';
    } else {
        statusClass = 'in-progress';
        statusText = '进行中';
    }
    
    // 从task.stats对象中读取统计数据
    const stats = task.stats || {};
    const totalImages = stats.total_images || 0;
    const annotatedImages = stats.annotated_images || 0;
    const completionRate = stats.completion_rate || 0;

    return `
        <div class="task-stat-card ${statusClass}" data-task-path="${task.path}" data-task-type="${task.type}">
            <div class="task-card-header">
                <label class="task-select-label">
                    <input type="checkbox" class="task-select-checkbox" data-task-path="${task.path}">
                    <span class="checkmark"></span>
                </label>
                <div class="task-info">
                    <div class="task-name">${task.name}</div>
                    <div class="task-meta">
                        <span class="task-assignee">👤 ${task.assignee || '未分配'}</span>
                        <span class="task-status ${statusClass}">${statusText}</span>
                    </div>
                </div>
            </div>
            <div class="task-card-stats">
                <div class="stat-item">
                    <span class="stat-label">图片数</span>
                    <span class="stat-value">${totalImages}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">已标注</span>
                    <span class="stat-value">${annotatedImages}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">进度</span>
                    <span class="stat-value">${completionRate}%</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * 生成汇总统计HTML
 */
function generateSummaryHTML(totalStats) {
    const stats = {
        total_tasks: 0,
        total_images: 0,
        total_labeled: 0,
        total_annotated_images: 0,
        total_labels: 0,
        overall_completion_rate: 0,
        progress: 0,
        status_counts: {
            in_progress: 0,
            completed: 0
        },
        ...totalStats
    };

    if (!stats.status_counts) {
        stats.status_counts = { in_progress: 0, completed: 0 };
    }

    return `
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-icon">📋</div>
                <div class="summary-content">
                    <div class="summary-value">${stats.total_tasks || 0}</div>
                    <div class="summary-label">总任务数</div>
                </div>
            </div>
            <div class="summary-item">
                <div class="summary-icon">🖼️</div>
                <div class="summary-content">
                    <div class="summary-value">${stats.total_images || 0}</div>
                    <div class="summary-label">总图片数</div>
                </div>
            </div>
            <div class="summary-item">
                <div class="summary-icon">✅</div>
                <div class="summary-content">
                    <div class="summary-value">${stats.total_labeled || stats.total_annotated_images || 0}</div>
                    <div class="summary-label">已标注图片</div>
                </div>
            </div>
            <div class="summary-item">
                <div class="summary-icon">🏷️</div>
                <div class="summary-content">
                    <div class="summary-value">${stats.total_labels || 0}</div>
                    <div class="summary-label">总标签数</div>
                </div>
            </div>
            <div class="summary-item">
                <div class="summary-icon">📈</div>
                <div class="summary-content">
                    <div class="summary-value">${stats.progress || stats.overall_completion_rate || 0}%</div>
                    <div class="summary-label">完成率</div>
                </div>
            </div>
            <div class="summary-item">
                <div class="summary-icon">⚡</div>
                <div class="summary-content">
                    <div class="summary-value">${(stats.status_counts && stats.status_counts.in_progress) || 0}</div>
                    <div class="summary-label">进行中</div>
                </div>
            </div>
            <div class="summary-item">
                <div class="summary-icon">🎉</div>
                <div class="summary-content">
                    <div class="summary-value">${(stats.status_counts && stats.status_counts.completed) || 0}</div>
                    <div class="summary-label">已完成</div>
                </div>
            </div>
            <div class="summary-item">
                <div class="summary-icon">📦</div>
                <div class="summary-content">
                    <div class="summary-value">${(stats.status_counts && stats.status_counts.unassigned) || 0}</div>
                    <div class="summary-label">未分配</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 生成标签统计HTML
 */
function generateLabelStatsHTML(labelCounts, projectLabels, projectName) {
    // 如果没有项目标签定义
    if (!projectLabels || projectLabels.length === 0) {
        return '<div class="no-labels-message">该项目暂未定义标签</div>';
    }

    // 计算总标签数（用于百分比计算）
    const totalLabels = Object.values(labelCounts).reduce((sum, count) => sum + count, 0);

    // 构建标签数组，包含所有项目标签（即使数量为0）
    const labelStats = projectLabels.map(label => {
        const labelName = label.name || `标签${label.id}`;
        // 使用标签ID作为类别
        const labelCategory = `ID: ${label.id}`;
        const count = labelCounts[labelName] || 0;
        return {
            id: label.id,
            name: labelName,
            category: labelCategory,
            count: count,
            color: label.color || '#00bcd4'
        };
    });

    // 按数量排序（数量多的在前）
    const sortedLabels = labelStats.sort((a, b) => b.count - a.count);

    return `
        <div class="label-stats-grid">
            ${sortedLabels.map(label => {
                const percentage = totalLabels > 0 ? ((label.count / totalLabels) * 100).toFixed(1) : 0;
                const countClass = label.count === 0 ? 'zero-count' : '';
                return `
                <div class="label-stat-item ${countClass}">
                    <div class="label-info">
                        <div class="label-header">
                            <span class="label-name" title="${label.name}">${label.name}</span>
                            <span class="label-category" title="${label.category}">(${label.category})</span>
                        </div>
                        <span class="label-count">${label.count}</span>
                    </div>
                    <div class="label-bar-container">
                        <div class="label-bar" style="width: ${percentage}%; background-color: ${label.color}"></div>
                    </div>
                    <div class="label-percentage">${percentage}%</div>
                </div>
                `;
            }).join('')}
        </div>
    `;
}


/**
 * 删除项目
 * 从 app.js:1323 迁移
 */
export async function deleteProject(projectName) {
    const currentUser = appState.getState('currentUser');
    
    const result = await showConfirm(
        `确定要删除项目 '${projectName}' 吗？`,
        [
            '🏷️ 删除项目的标签体系',
            '🚨 删除项目相关的任务和标注数据',
            '⚠️ 此操作不可逆！'
        ],
        '删除项目'
    );
    
    if (!result) return;
    
    try {
        // 显示删除中的状态
        const deleteBtn = document.querySelector(`.project-action-btn.delete[data-project="${projectName}"]`);
        if (deleteBtn) {
            const originalText = deleteBtn.innerHTML;
            deleteBtn.innerHTML = '<span class="btn-icon">⏳</span>删除中...';
            deleteBtn.disabled = true;
        }
        
        const response = await fetch(`/api/admin/delete_project?user=${currentUser}&project_name=${encodeURIComponent(projectName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(data.message, 'success');
            
            // 触发项目删除事件
            eventBus.emit(EVENTS.PROJECT_DELETED, { projectName });
            
            // 刷新项目列表
            await loadProjects();
        } else {
            throw new Error(data.error || '删除项目失败');
        }
    } catch (error) {
        console.error('Failed to delete project:', error);
        showToast(`删除项目失败: ${error.message}`, 'error');
        
        // 恢复按钮状态
        const deleteBtn = document.querySelector(`.project-action-btn.delete[data-project="${projectName}"]`);
        if (deleteBtn) {
            deleteBtn.innerHTML = '<span class="btn-icon">🗑️</span>删除';
            deleteBtn.disabled = false;
        }
    }
}

export default {
    init,
    loadProjects,
    renderProjectList,
    deleteProject
};
