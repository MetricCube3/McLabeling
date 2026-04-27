/**
 * 任务分配模块
 * 处理任务的分配和管理
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';

// 分配状态标志
let isAssigning = false;

// 防止重复初始化
let isInitialized = false;

/**
 * 初始化任务分配模块
 */
export async function init() {
    const userRoles = appState.getState('userRoles');
    
    // 只有管理员可以访问任务分配
    if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
        showToast('需要管理员权限访问任务分配');
        return;
    }
    
    if (isInitialized) {
        console.log('[task-assignment] Already initialized, skipping...');
        // 重新加载数据
        await loadAssignmentData();
        return;
    }
    
    console.log('[task-assignment] Initializing task assignment module');
    
    // 加载任务分配数据
    await loadAssignmentData();
    
    // 设置事件监听器
    setupTaskAssignmentEvents();
    
    isInitialized = true;
    console.log('[task-assignment] Initialization complete');
}

/**
 * 加载任务分配数据
 * 从 app.js:3824 迁移
 */
export async function loadAssignmentData(projectFilter = '') {
    const currentUser = appState.getState('currentUser');
    const userRoles = appState.getState('userRoles');
    
    // 确保 userRoles 是有效数组
    if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
        return;
    }
    
    try {
        let url = `/api/admin/assignment_data?user=${currentUser}`;
        if (projectFilter) {
            url += `&project=${encodeURIComponent(projectFilter)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load assignment data');
        
        // 填充视频池
        populateVideoPool(data.video_pool);
        
        // 填充审核池
        populateReviewPool(data.completed_annotations);
        
        // 填充用户下拉框
        populateUserSelects(data.users);
        
        // 更新计数
        updateTaskCounts(data.video_pool, data.completed_annotations);
        
    } catch (error) {
        showToast(`加载分配数据失败: ${error.message}`, 'error');
    }
}

/**
 * 填充视频/图片任务池
 */
function populateVideoPool(videoPool) {
    const videoPoolSelect = document.getElementById('video-pool-select');
    if (!videoPoolSelect) return;
    
    videoPoolSelect.innerHTML = '';
    if (videoPool && videoPool.length > 0) {
        videoPool.forEach(videoPath => {
            const option = document.createElement('option');
            option.value = videoPath;
            
            // 从路径中提取项目信息
            let projectName = '默认项目';
            if (videoPath.includes('/')) {
                projectName = videoPath.split('/')[0];
            }
            
            // 根据路径判断是视频还是图片任务
            if (videoPath.includes('images_')) {
                option.textContent = `🖼️ ${videoPath} [${projectName}]`;
            } else {
                option.textContent = `🎬 ${videoPath} [${projectName}]`;
            }
            
            videoPoolSelect.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "暂无待分配任务";
        option.disabled = true;
        videoPoolSelect.appendChild(option);
    }
}

/**
 * 填充审核任务池
 */
function populateReviewPool(completedAnnotations) {
    const reviewPoolSelect = document.getElementById('review-pool-select');
    if (!reviewPoolSelect) return;
    
    reviewPoolSelect.innerHTML = '';
    if (completedAnnotations && completedAnnotations.length > 0) {
        completedAnnotations.forEach(task => {
            const option = document.createElement('option');
            option.value = task.path;
            // 后端已经返回格式化的名称：任务名 [项目名]
            option.textContent = task.name;
            reviewPoolSelect.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "暂无待审核任务";
        option.disabled = true;
        reviewPoolSelect.appendChild(option);
    }
}

/**
 * 填充用户下拉框
 */
function populateUserSelects(users) {
    const annotatorSelect = document.getElementById('annotator-select');
    const reviewerSelect = document.getElementById('reviewer-select');
    
    const annotators = [], reviewers = [];
    Object.entries(users).forEach(([username, userData]) => {
        // 确保userData.roles是有效数组
        if (!userData.roles || !Array.isArray(userData.roles)) {
            console.warn(`用户 ${username} 的roles字段无效:`, userData.roles);
            return;
        }
        if (userData.roles.includes('annotator')) {
            annotators.push(username);
        }
        if (userData.roles.includes('reviewer')) {
            reviewers.push(username);
        }
    });
    
    if (annotatorSelect) {
        annotatorSelect.innerHTML = '<option value="">请选择标注员</option>' +
            annotators.map(u => `<option value="${u}">${u}</option>`).join('');
    }
    
    if (reviewerSelect) {
        reviewerSelect.innerHTML = '<option value="">请选择审核员</option>' +
            reviewers.map(u => `<option value="${u}">${u}</option>`).join('');
    }
}

/**
 * 更新任务计数
 */
function updateTaskCounts(videoPool, completedAnnotations) {
    const videoPoolCount = document.getElementById('video-pool-count');
    const reviewPoolCount = document.getElementById('review-pool-count');
    
    if (videoPoolCount) {
        videoPoolCount.textContent = `${videoPool ? videoPool.length : 0} 个任务`;
    }
    
    if (reviewPoolCount) {
        reviewPoolCount.textContent = `${completedAnnotations ? completedAnnotations.length : 0} 个任务`;
    }
}

/**
 * 设置任务分配事件
 * 从 app.js:4230 迁移
 */
function setupTaskAssignmentEvents() {
    const assignAnnotationBtn = document.getElementById('assign-annotation-btn');
    const assignReviewBtn = document.getElementById('assign-review-btn');
    const videoPoolSelect = document.getElementById('video-pool-select');
    const reviewPoolSelect = document.getElementById('review-pool-select');
    
    if (!assignAnnotationBtn || !assignReviewBtn) return;
    
    // 先移除之前可能绑定的事件监听器
    assignAnnotationBtn.removeEventListener('click', handleAssignAnnotation);
    assignReviewBtn.removeEventListener('click', handleAssignReview);
    
    // 标注任务分配按钮
    assignAnnotationBtn.addEventListener('click', handleAssignAnnotation);
    
    // 审核任务分配按钮
    assignReviewBtn.addEventListener('click', handleAssignReview);
    
    // 为任务池添加点击空白取消选择功能
    if (videoPoolSelect) {
        setupPoolClickToDeselect(videoPoolSelect);
    }
    if (reviewPoolSelect) {
        setupPoolClickToDeselect(reviewPoolSelect);
    }
}

/**
 * 设置任务池点击空白取消选择
 */
function setupPoolClickToDeselect(selectElement) {
    selectElement.addEventListener('mousedown', (e) => {
        // 如果点击的不是option元素（即点击空白区域）
        if (e.target === selectElement) {
            // 取消所有选择
            selectElement.selectedIndex = -1;
            // 清除所有option的选中状态
            Array.from(selectElement.options).forEach(option => {
                option.selected = false;
            });
        }
    });
}

/**
 * 处理标注任务分配
 */
function handleAssignAnnotation() {
    handleAssignTask('annotation');
}

/**
 * 处理审核任务分配
 */
function handleAssignReview() {
    handleAssignTask('review');
}

/**
 * 处理任务分配
 * 从 app.js:3913 迁移
 */
export async function handleAssignTask(taskType) {
    const currentUser = appState.getState('currentUser');
    
    // 防止重复点击
    if (isAssigning) {
        showToast('正在处理分配请求，请稍候...');
        return;
    }
    
    const videoPoolSelect = document.getElementById('video-pool-select');
    const reviewPoolSelect = document.getElementById('review-pool-select');
    const annotatorSelect = document.getElementById('annotator-select');
    const reviewerSelect = document.getElementById('reviewer-select');
    const assignAnnotationBtn = document.getElementById('assign-annotation-btn');
    const assignReviewBtn = document.getElementById('assign-review-btn');
    
    const itemsSelect = taskType === 'annotation' ? videoPoolSelect : reviewPoolSelect;
    const userSelect = taskType === 'annotation' ? annotatorSelect : reviewerSelect;
    
    const selectedItems = Array.from(itemsSelect.selectedOptions).map(opt => opt.value);
    const selectedAssignee = userSelect.value;
    
    if (selectedItems.length === 0) {
        showToast(`请至少选择一个要分配的${taskType === 'annotation' ? '视频' : '任务'}`);
        return;
    }
    if (!selectedAssignee) {
        showToast(`请选择一个${taskType === 'annotation' ? '标注员' : '审核员'}`);
        return;
    }
    
    try {
        // 设置正在分配标志
        isAssigning = true;
        
        // 禁用按钮防止重复点击
        if (taskType === 'annotation') {
            if (assignAnnotationBtn) {
                assignAnnotationBtn.disabled = true;
                assignAnnotationBtn.textContent = '分配中...';
            }
        } else {
            if (assignReviewBtn) {
                assignReviewBtn.disabled = true;
                assignReviewBtn.textContent = '分配中...';
            }
        }
        
        const response = await fetch(`/api/admin/assign_task?user=${currentUser}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_type: taskType,
                items: selectedItems,
                assignee: selectedAssignee
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '分配失败');
        
        showToast(data.message);
        
        // 刷新列表
        await loadAssignmentData();
        
        // 清空选择
        itemsSelect.selectedIndex = -1;
        userSelect.selectedIndex = 0;
        
        // 触发任务分配事件
        eventBus.emit(EVENTS.TASK_ASSIGNED, { taskType, assignee: selectedAssignee, items: selectedItems });
        
    } catch (error) {
        showToast(`分配失败: ${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        isAssigning = false;
        if (taskType === 'annotation') {
            if (assignAnnotationBtn) {
                assignAnnotationBtn.disabled = false;
                assignAnnotationBtn.textContent = '➡️ 分配选中任务';
            }
        } else {
            if (assignReviewBtn) {
                assignReviewBtn.disabled = false;
                assignReviewBtn.textContent = '➡️ 分配选中任务';
            }
        }
    }
}

export default {
    init,
    loadAssignmentData,
    handleAssignTask
};
