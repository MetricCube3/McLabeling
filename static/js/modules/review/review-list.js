/**
 * 审核列表和分页模块
 * 处理审核任务浏览、分页
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { startReviewSession } from './review-ui.js';

// 分页状态
let taskPaginationState = {
    currentPage: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1
};

let reviewImagePaginationState = {
    currentPage: 1,
    pageSize: 60,
    totalItems: 0,
    totalPages: 1
};

// 筛选状态
let filterState = {
    status: 'all',
    user: '',
    project: ''
};

// DOM元素
let videoList = null;
let breadcrumb = null;
let taskPaginationTop = null;
let taskPaginationBottom = null;
let reviewImagePaginationTop = null;
let reviewImagePaginationBottom = null;

/**
 * 初始化审核列表模块
 */
export function init() {
    console.log('[review-list] Initializing...');
    
    // 获取DOM元素
    videoList = document.getElementById('video-list');
    breadcrumb = document.getElementById('breadcrumb');
    
    // Debug: 检查元素是否存在
    if (!videoList) {
        console.error('[review-list] video-list element not found!');
        return;
    }
    
    const videoSelection = document.getElementById('video-selection');
    if (!videoSelection) {
        console.error('[review-list] video-selection element not found!');
        return;
    }
    
    // 创建分页控件容器（如果不存在）
    if (!document.getElementById('task-pagination-top')) {
        taskPaginationTop = document.createElement('div');
        taskPaginationTop.id = 'task-pagination-top';
        taskPaginationTop.className = 'task-pagination-container';
        videoSelection.insertBefore(taskPaginationTop, videoList);
        console.log('[review-list] Created task-pagination-top');
    } else {
        taskPaginationTop = document.getElementById('task-pagination-top');
    }
    
    if (!document.getElementById('task-pagination-bottom')) {
        taskPaginationBottom = document.createElement('div');
        taskPaginationBottom.id = 'task-pagination-bottom';
        taskPaginationBottom.className = 'task-pagination-container';
        videoSelection.appendChild(taskPaginationBottom);
        console.log('[review-list] Created task-pagination-bottom');
    } else {
        taskPaginationBottom = document.getElementById('task-pagination-bottom');
    }
    
    // 创建审核图片分页控件容器（如果不存在）
    if (!document.getElementById('review-image-pagination-top')) {
        reviewImagePaginationTop = document.createElement('div');
        reviewImagePaginationTop.id = 'review-image-pagination-top';
        reviewImagePaginationTop.className = 'review-image-pagination-container hidden';
        videoSelection.insertBefore(reviewImagePaginationTop, videoList);
        console.log('[review-list] Created review-image-pagination-top');
    } else {
        reviewImagePaginationTop = document.getElementById('review-image-pagination-top');
    }
    
    if (!document.getElementById('review-image-pagination-bottom')) {
        reviewImagePaginationBottom = document.createElement('div');
        reviewImagePaginationBottom.id = 'review-image-pagination-bottom';
        reviewImagePaginationBottom.className = 'review-image-pagination-container hidden';
        videoSelection.appendChild(reviewImagePaginationBottom);
        console.log('[review-list] Created review-image-pagination-bottom');
    } else {
        reviewImagePaginationBottom = document.getElementById('review-image-pagination-bottom');
    }
    
    // 订阅事件
    eventBus.on('review:change-page', handleChangePage);
    
    console.log('[review-list] Initialization complete');
}

/**
 * 浏览审核任务/图片
 * 从 app.js:2569 迁移
 * @param {string} path - 目录路径
 */
export async function browse(path = '') {
    const currentUser = appState.getState('currentUser');
    const userRoles = appState.getState('userRoles');
    const appMode = appState.getState('appMode');
    
    console.log('[review-list] Browse called');
    
    if (!currentUser) {
        showToast("请先登录");
        return;
    }
    
    let endpoint;
    if (appMode === 'annotate') {
        if (!Array.isArray(userRoles) || (!userRoles.includes('annotator') && !userRoles.includes('admin'))) {
            if (videoList) videoList.innerHTML = '<p>您没有标注权限。</p>';
            return;
        }
        endpoint = `/api/browse?user=${currentUser}`;
    } else { // review mode
        if (!Array.isArray(userRoles) || (!userRoles.includes('reviewer') && !userRoles.includes('admin'))) {
            if (videoList) videoList.innerHTML = '<p>您没有审核权限。</p>';
            return;
        }
        endpoint = `/api/browse_annotated?user=${currentUser}`;
    }
    
    // 添加筛选参数
    endpoint += `&status=${filterState.status}`;
    if (filterState.user) {
        endpoint += `&user_filter=${encodeURIComponent(filterState.user)}`;
    }
    if (filterState.project) {
        endpoint += `&project_filter=${encodeURIComponent(filterState.project)}`;
    }
    
    // 添加分页参数
    if (appMode === 'review' && path) {
        // 审核任务内部的图片列表分页 - 使用60张每页
        endpoint += `&page=${reviewImagePaginationState.currentPage}&page_size=${reviewImagePaginationState.pageSize}`;
    } else {
        // 任务列表分页 - 使用20张每页
        endpoint += `&page=${taskPaginationState.currentPage}&page_size=${taskPaginationState.pageSize}`;
    }
    
    try {
        const response = await fetch(`${endpoint}&path=${encodeURIComponent(path)}`);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to browse directory');
        }
        const data = await response.json();
        
        // 更新分页状态
        if (appMode === 'review' && path) {
            // 审核任务内部的图片列表
            reviewImagePaginationState.totalItems = data.total_count || 0;
            reviewImagePaginationState.totalPages = Math.ceil(reviewImagePaginationState.totalItems / reviewImagePaginationState.pageSize);
            
            // 确保分页状态正确
            if (reviewImagePaginationState.currentPage > reviewImagePaginationState.totalPages) {
                reviewImagePaginationState.currentPage = Math.max(1, reviewImagePaginationState.totalPages);
            }
            
            updateReviewImagePaginationControls();
            
            // 隐藏任务级别的分页控件和筛选框，显示图片级别的分页控件
            hideTaskLevelControls();
            showReviewImageLevelControls();
        } else {
            // 任务列表
            taskPaginationState.totalItems = data.total_count || 0;
            taskPaginationState.totalPages = Math.ceil(taskPaginationState.totalItems / taskPaginationState.pageSize);
            
            // 确保分页状态正确
            if (taskPaginationState.currentPage > taskPaginationState.totalPages) {
                taskPaginationState.currentPage = Math.max(1, taskPaginationState.totalPages);
            }
            
            updateTaskPaginationControls();
            
            // 显示任务级别的分页控件和筛选框，隐藏图片级别的分页控件
            showTaskLevelControls();
            hideReviewImageLevelControls();
        }
        
        // 处理面包屑导航
        if (appMode === 'review') {
            if (path) {
                if (breadcrumb) {
                    breadcrumb.style.display = '';
                    breadcrumb.innerHTML = `
                        <button class="back-breadcrumb-btn" id="back-to-root">
                            <span class="btn-icon">←</span>
                            返回任务列表
                        </button>
                        <span class="breadcrumb-separator">/</span>
                        <span class="current-folder">${path.split('/').pop()}</span>
                    `;
                    document.getElementById('back-to-root').addEventListener('click', () => {
                        // 返回时重置图片分页（控件显示由browse统一处理）
                        reviewImagePaginationState.currentPage = 1;
                        browse('');
                    });
                }
            } else {
                if (breadcrumb) breadcrumb.style.display = 'none';
            }
        } else {
            if (breadcrumb) breadcrumb.style.display = 'none';
        }
        
        // 只在任务级别显示筛选控件
        if (appMode === 'review' && path) {
            // 审核任务内部隐藏筛选控件
            hideFilterControls();
        } else {
            // 任务级别显示筛选控件
            await renderFilterControls(data.total_count || 0).catch(err => {
                console.error('[review-list] Failed to render filter controls:', err);
            });
        }
        
        if (videoList) videoList.innerHTML = '';
        
        let hasTasks = false;
        
        if (appMode === 'annotate') {
            // 移除审核图片网格类名（防止从审核模式切换过来时保留该样式）
            if (videoList) {
                videoList.classList.remove('review-images-grid');
            }
            
            // 显示所有任务文件夹（包括目录和文件）
            console.log(`[review-list] Annotate mode: found ${data.directories.length} directories and ${data.files.length} files`);
            
            if (data.directories && data.directories.length > 0) {
                hasTasks = true;
                console.log('[review-list] Rendering', data.directories.length, 'directories');
                console.log('[review-list] Sample task data:', data.directories[0]);
                
                data.directories.forEach(video => {
                    const videoItem = document.createElement('div');
                    videoItem.className = 'video-item task-folder';
                    
                    // 获取统计信息（兼容多种字段名，确保显示正确）
                    const isVideo = video.type === 'video';
                    
                    // 对于视频任务，如果未抽帧（字段不存在或为0/null/undefined），图片总数设置为0
                    let totalImages = video.totalImages ?? video.total_images ?? video.totalFrames ?? video.total_frames ?? 0;
                    if (isVideo) {
                        totalImages = parseInt(totalImages) || 0;  // 确保视频未抽帧时显示0
                    }
                    
                    const annotatedImages = video.annotatedImages ?? video.annotated_images ?? 0;
                    const totalLabels = video.totalLabels ?? video.total_labels ?? 0;
                    const labelCounts = video.labelCounts || video.label_counts || {};
                    
                    console.log(`[review-list] Task: ${video.name}, totalImages: ${totalImages}, type: ${video.type}, isVideo: ${isVideo}`);
                    
                    // 计算进度
                    const progressPercent = video.progress || (totalImages > 0 ? Math.round((annotatedImages / totalImages) * 100) : 0);
                    
                    // 任务类型图标
                    const itemIcon = video.type === 'video' ? '🎬' : '🖼️';
                    
                    // 分配者信息
                    const assigneeInfo = video.assignee ? 
                        `<div class="item-assignee">标注员: ${video.assignee}</div>` : 
                        `<div class="item-assignee unassigned">未分配</div>`;
                    
                    // 项目信息
                    const projectInfo = video.project ? 
                        `<div class="item-project">项目: ${video.project}</div>` : 
                        '';
                    
                    // 抽帧按钮（仅视频任务）
                    const extractFramesBtn = video.type === 'video' ? 
                        `<button class="extract-frames-btn" data-video-path="${video.path}">🎞️ 抽帧</button>` : 
                        '';
                    
                    // 封面图URL（支持多种字段名）
                    const coverUrl = video.coverUrl || video.cover_url || video.thumbnail || '';
                    
                    // 状态切换按钮
                    let actionButtonHTML = '';
                    if (video.status === 'completed') {
                        actionButtonHTML = `<button class="reopen-btn completed-status" data-task-path="${video.path}" title="点击重新打开任务">✓ 标注完成</button>`;
                    } else {
                        actionButtonHTML = `<button class="complete-btn in-progress-status" data-task-path="${video.path}" title="点击标记为完成">⏸ 标注中</button>`;
                    }
                    
                    videoItem.className = `video-item task-folder status-${video.status || 'in_progress'}`;
                    
                    videoItem.innerHTML = `
                        <div class="item-icon">${itemIcon}</div>
                        ${coverUrl ? `<img src="${coverUrl}" alt="${video.name} cover" class="video-item-cover" onerror="this.style.display='none'" loading="lazy">` : '<div class="cover-placeholder"></div>'}
                        ${extractFramesBtn}
                        <div class="item-name">${video.name}</div>
                        
                        <div class="item-stats">
                            <div class="stat-row">
                                <span class="stat-value">${totalImages}</span>
                                <span class="stat-label">图片总数</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-value">${annotatedImages}</span>
                                <span class="stat-label">已标注</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-value clickable-label-count" 
                                      data-task-path="${video.path}"
                                      data-task-project="${video.project || 'default'}"
                                      data-label-counts='${JSON.stringify(labelCounts)}'>
                                    ${totalLabels}
                                </span>
                                <span class="stat-label">标签总数</span>
                            </div>
                        </div>
                        
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progressPercent}%"></div>
                            </div>
                            <div class="progress-text">${progressPercent}%</div>
                        </div>
                        
                        <div class="item-info-row">
                            ${video.assignee ? `标注员: ${video.assignee}` : '<span style="color: #e74c3c; font-style: italic;">未分配</span>'}${video.project ? ` • 项目: ${video.project}` : ''}
                        </div>
                        
                        ${actionButtonHTML}
                        ${(Array.isArray(userRoles) && userRoles.includes('admin')) ? createTaskMenuButton(video.path, 'annotation', video.name) : ''}
                    `;
                    
                    console.log(`[review-list] Rendered task card for: ${video.name}`);
                    
                    // 点击封面或名称打开任务
                    const coverElement = videoItem.querySelector('.video-item-cover');
                    const nameElement = videoItem.querySelector('.item-name');
                    
                    const handleTaskClick = async () => {
                        // 视频任务需要先检查是否已抽帧
                        if (video.type === 'video') {
                            const hasExtracted = await checkVideoExtracted(video.path);
                            if (!hasExtracted) {
                                showExtractRequiredNotice();
                                return;
                            }
                        }
                        eventBus.emit('annotation:select-task', {
                            path: video.path,
                            name: video.name,
                            totalFrames: totalImages,
                            type: video.type
                        });
                    };
                    
                    if (coverElement) coverElement.addEventListener('click', handleTaskClick);
                    if (nameElement) nameElement.addEventListener('click', handleTaskClick);
                    
                    // 抽帧按钮点击事件
                    const extractBtn = videoItem.querySelector('.extract-frames-btn');
                    if (extractBtn) {
                        extractBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            showFrameExtractionModal(video.path);
                        });
                    }
                    
                    // 标签总数点击事件
                    const labelCountElement = videoItem.querySelector('.clickable-label-count');
                    if (labelCountElement) {
                        labelCountElement.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const labelCounts = JSON.parse(e.target.dataset.labelCounts || '{}');
                            const taskPath = e.target.dataset.taskPath;
                            const taskProject = e.target.dataset.taskProject;
                            showLabelDetailsModal(labelCounts, taskPath, taskProject);
                        });
                    }
                    
                    // 状态切换按钮事件
                    const completeBtn = videoItem.querySelector('.complete-btn');
                    if (completeBtn) {
                        completeBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            markTaskAsComplete('annotation', video.path, 'completed');
                        });
                    }
                    
                    const reopenBtn = videoItem.querySelector('.reopen-btn');
                    if (reopenBtn) {
                        reopenBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            markTaskAsComplete('annotation', video.path, 'in_progress');
                        });
                    }
                    
                    if (videoList) videoList.appendChild(videoItem);
                });
            } else if (data.files && data.files.length > 0) {
                // 移除审核图片网格类名
                if (videoList) {
                    videoList.classList.remove('review-images-grid');
                }
                
                // 检查文件类型，如果是任务文件则渲染为任务卡片
                const firstFile = data.files[0];
                const hasTaskProperties = firstFile && (
                    firstFile.totalImages !== undefined || 
                    firstFile.total_images !== undefined ||
                    firstFile.annotatedImages !== undefined ||
                    firstFile.annotated_images !== undefined
                );
                
                if (hasTaskProperties) {
                    // 作为任务卡片渲染
                    console.log('[review-list] Files are tasks, rendering as task cards');
                    data.files.forEach(video => {
                        const videoItem = document.createElement('div');
                        videoItem.className = 'video-item task-folder';
                        
                        // 任务类型
                        const isVideo = video.type === 'video' || video.name.toLowerCase().includes('video') || video.name.endsWith('.mp4');
                        const itemIcon = isVideo ? '🎬' : '🖼️';
                        
                        // 获取统计信息（兼容多种字段名，确保显示正确）
                        // 对于视频任务，如果未抽帧（字段不存在或为0/null/undefined），图片总数设置为0
                        let taskTotalImages = video.totalImages ?? video.total_images ?? video.totalFrames ?? video.total_frames ?? 0;
                        if (isVideo) {
                            taskTotalImages = parseInt(taskTotalImages) || 0;  // 确保视频未抽帧时显示0
                        }
                        
                        const taskAnnotatedImages = video.annotatedImages ?? video.annotated_images ?? 0;
                        const taskTotalLabels = video.totalLabels ?? video.total_labels ?? 0;
                        const taskLabelCounts = video.labelCounts || video.label_counts || {};
                        
                        // 计算进度
                        const taskProgressPercent = video.progress || (taskTotalImages > 0 ? Math.round((taskAnnotatedImages / taskTotalImages) * 100) : 0);
                        
                        const taskAssigneeInfo = video.assignee ? 
                            `<div class="item-assignee">标注员: ${video.assignee}</div>` : 
                            `<div class="item-assignee unassigned">未分配</div>`;
                        
                        const taskProjectInfo = video.project ? 
                            `<div class="item-project">项目: ${video.project}</div>` : 
                            '';
                        
                        const taskExtractFramesBtn = isVideo ? 
                            `<button class="extract-frames-btn" data-video-path="${video.path}">🎞️ 抽帧</button>` : 
                            '';
                        
                        const taskCoverUrl = video.coverUrl || video.cover_url || video.thumbnail || '';
                        
                        // 状态切换按钮
                        let taskActionButtonHTML = '';
                        if (video.status === 'completed') {
                            taskActionButtonHTML = `<button class="reopen-btn completed-status" data-task-path="${video.path}" title="点击重新打开任务">✓ 标注完成</button>`;
                        } else {
                            taskActionButtonHTML = `<button class="complete-btn in-progress-status" data-task-path="${video.path}" title="点击标记为完成">⏸ 标注中</button>`;
                        }
                        
                        videoItem.className = `video-item task-folder status-${video.status || 'in_progress'}`;
                        
                        videoItem.innerHTML = `
                            <div class="item-icon">${itemIcon}</div>
                            ${taskCoverUrl ? `<img src="${taskCoverUrl}" alt="${video.name} cover" class="video-item-cover" onerror="this.style.display='none'" loading="lazy">` : '<div class="cover-placeholder"></div>'}
                            ${taskExtractFramesBtn}
                            <div class="item-name">${video.name}</div>
                            
                            <div class="item-stats">
                                <div class="stat-row">
                                    <span class="stat-value">${taskTotalImages}</span>
                                    <span class="stat-label">图片总数</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-value">${taskAnnotatedImages}</span>
                                    <span class="stat-label">已标注</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-value clickable-label-count" 
                                          data-task-path="${video.path}"
                                          data-task-project="${video.project || 'default'}"
                                          data-label-counts='${JSON.stringify(taskLabelCounts)}'>
                                        ${taskTotalLabels}
                                    </span>
                                    <span class="stat-label">标签总数</span>
                                </div>
                            </div>
                            
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${taskProgressPercent}%"></div>
                                </div>
                                <div class="progress-text">${taskProgressPercent}%</div>
                            </div>
                            
                            <div class="item-info-row">
                                ${video.assignee ? `标注员: ${video.assignee}` : '<span style="color: #e74c3c; font-style: italic;">未分配</span>'}${video.project ? ` • 项目: ${video.project}` : ''}
                            </div>
                            
                            ${taskActionButtonHTML}
                            ${(Array.isArray(userRoles) && userRoles.includes('admin')) ? createTaskMenuButton(video.path, 'annotation', video.name) : ''}
                        `;
                        
                        const coverElement = videoItem.querySelector('.video-item-cover, .cover-placeholder');
                        const nameElement = videoItem.querySelector('.item-name');
                        
                        const handleTaskClick = async () => {
                            if (isVideo) {
                                const hasExtracted = await checkVideoExtracted(video.path);
                                if (!hasExtracted) {
                                    showExtractRequiredNotice();
                                    return;
                                }
                            }
                            eventBus.emit('annotation:select-task', {
                                path: video.path,
                                name: video.name,
                                totalFrames: taskTotalImages,
                                type: isVideo ? 'video' : 'image'
                            });
                        };
                        
                        if (coverElement) coverElement.addEventListener('click', handleTaskClick);
                        if (nameElement) nameElement.addEventListener('click', handleTaskClick);
                        
                        const extractBtn = videoItem.querySelector('.extract-frames-btn');
                        if (extractBtn) {
                            extractBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                showFrameExtractionModal(video.path);
                            });
                        }
                        
                        // 标签总数点击事件
                        const taskLabelCountElement = videoItem.querySelector('.clickable-label-count');
                        if (taskLabelCountElement) {
                            taskLabelCountElement.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const clickedLabelCounts = JSON.parse(e.target.dataset.labelCounts || '{}');
                                const clickedTaskPath = e.target.dataset.taskPath;
                                const clickedTaskProject = e.target.dataset.taskProject;
                                showLabelDetailsModal(clickedLabelCounts, clickedTaskPath, clickedTaskProject);
                            });
                        }
                        
                        // 状态切换按钮事件
                        const completeBtn = videoItem.querySelector('.complete-btn');
                        if (completeBtn) {
                            completeBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                markTaskAsComplete('annotation', video.path, 'completed');
                            });
                        }
                        
                        const reopenBtn = videoItem.querySelector('.reopen-btn');
                        if (reopenBtn) {
                            reopenBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                markTaskAsComplete('annotation', video.path, 'in_progress');
                            });
                        }
                        
                        if (videoList) videoList.appendChild(videoItem);
                    });
                } else {
                    // 作为图片列表渲染（简单模式）
                    console.log('[review-list] Files are images, rendering as simple list');
                    data.files.forEach((file, index) => {
                        const item = document.createElement('div');
                        item.className = 'video-item file-item';
                        item.innerHTML = `
                            <div class="folder-icon">🖼️</div>
                            <div class="item-name">${file.name}</div>
                        `;
                        item.addEventListener('click', () => {
                            eventBus.emit('annotation:select-file', { file, index, path });
                        });
                        if (videoList) videoList.appendChild(item);
                    });
                }
            } else {
                // 没有任务 - 显示空状态提示
                console.log('No tasks found, showing empty state');
                console.log('videoList element:', videoList);
                console.log('videoList parent:', videoList?.parentElement);
                console.log('videoList visible:', videoList?.offsetParent !== null);
                
                if (videoList) {
                    const emptyStateHTML = `
                        <div class="no-tasks-message" style="
                            text-align: center;
                            padding: 60px 20px;
                            color: #666;
                            background: #f9f9f9;
                            border-radius: 8px;
                            margin: 20px;
                        ">
                            <div style="font-size: 48px; margin-bottom: 20px;">📭</div>
                            <p style="font-size: 18px; margin-bottom: 10px; color: #333; font-weight: bold;">暂无标注任务</p>
                            <p style="font-size: 14px; color: #999;">
                                ${Array.isArray(appState.getState('userRoles')) && appState.getState('userRoles').includes('admin') 
                                    ? '请先在项目管理中创建项目并上传数据' 
                                    : '等待管理员分配标注任务后，任务将出现在这里'}
                            </p>
                        </div>
                    `;
                    videoList.innerHTML = emptyStateHTML;
                    console.log('Empty state HTML set, innerHTML length:', videoList.innerHTML.length);
                    console.log('video-selection display:', document.getElementById('video-selection')?.style.display);
                    console.log('video-selection classList:', document.getElementById('video-selection')?.classList.toString());
                } else {
                    console.error('videoList is null!');
                }
            }
        } else if (appMode === 'review') {
            if (data.files) {
                // 在具体任务文件夹中 - 显示图片列表（60张每页）
                // 添加审核图片网格类名
                if (videoList) {
                    videoList.classList.add('review-images-grid');
                }
                
                if (data.files.length === 0) {
                    if (videoList) {
                        videoList.innerHTML = `
                            <div class="no-tasks-message">
                                <p>📭 当前任务中没有图片</p>
                                <p class="no-tasks-hint">该任务可能尚未完成标注或图片已被处理</p>
                            </div>
                        `;
                    }
                } else {
                    hasTasks = true;
                    
                    // 显示当前页的图片
                    data.files.forEach((file, index) => {
                        const globalIndex = (reviewImagePaginationState.currentPage - 1) * reviewImagePaginationState.pageSize + index;
                        const item = document.createElement('div');
                        item.className = 'video-item review-image-item';
                        item.innerHTML = `
                            <div class="folder-icon">🖼️</div>
                            <div class="item-name">${file.name}</div>
                            <div class="image-index">图片 ${globalIndex + 1} / ${reviewImagePaginationState.totalItems}</div>
                        `;
                        item.addEventListener('click', () => {
                            // 启动审核会话，从当前图片开始
                            startReviewSession(index, path, data.files, reviewImagePaginationState);
                        });
                        if (videoList) videoList.appendChild(item);
                    });
                }
            } else if (data.directories) {
                // 在根目录 - 显示审核任务文件夹列表（20个每页）
                // 移除审核图片网格类名
                if (videoList) {
                    videoList.classList.remove('review-images-grid');
                }
                
                if (data.directories.length === 0) {
                    if (videoList) {
                        videoList.innerHTML = `
                            <div class="no-tasks-message">
                                <p>📭 暂无待审核任务</p>
                                <p class="no-tasks-hint">等待标注人员完成标注后，任务将出现在这里</p>
                            </div>
                        `;
                    }
                } else {
                    hasTasks = true;
                    
                    // 渲染审核任务卡片
                    data.directories.forEach(dir => {
                        const reviewItem = document.createElement('div');
                        // 使用独立的CSS类名区别于标注任务
                        reviewItem.className = `review-task-card status-${dir.status || 'in_progress'}`;
                        
                        // 状态切换按钮（参考标注任务样式）
                        let actionButtonHTML = '';
                        if (dir.status === 'completed') {
                            actionButtonHTML = `<button class="review-complete-btn completed-status" data-task-path="${dir.path}" title="点击重新打开审核">✓ 审核完成</button>`;
                        } else {
                            actionButtonHTML = `<button class="review-complete-btn in-progress-status" data-task-path="${dir.path}" title="点击标记为已完成">⏸ 审核中</button>`;
                        }
                        
                        reviewItem.innerHTML = `
                            <div class="review-folder-icon">📁</div>
                            <div class="review-task-name">${dir.task_name || dir.name}</div>
                            <div class="review-task-meta">
                                <span class="${dir.assignee ? '' : 'unassigned'}">审核员: ${dir.assignee || '未分配'}</span>
                                <span class="meta-separator">•</span>
                                <span>项目: ${dir.project || 'default'}</span>
                            </div>
                            ${actionButtonHTML}
                            ${(Array.isArray(userRoles) && userRoles.includes('admin')) ? createTaskMenuButton(dir.path, 'review', dir.task_name || dir.name) : ''}
                        `;
                        
                        // 点击卡片进入任务
                        reviewItem.addEventListener('click', (e) => {
                            // 如果点击的是按钮，不触发卡片点击
                            if (e.target.classList.contains('review-complete-btn')) {
                                return;
                            }
                            // 重置图片分页到第一页
                            reviewImagePaginationState.currentPage = 1;
                            browse(dir.path);
                        });
                        
                        // 状态切换按钮事件
                        const statusBtn = reviewItem.querySelector('.review-complete-btn');
                        if (statusBtn) {
                            statusBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const newStatus = dir.status === 'completed' ? 'in_progress' : 'completed';
                                markTaskAsComplete('review', dir.path, newStatus);
                            });
                        }
                        
                        if (videoList) videoList.appendChild(reviewItem);
                    });
                }
            }
        }
        
        // 绑定任务菜单按钮事件（管理员功能）
        setupTaskMenuListeners();
        
    } catch (error) {
        console.error('Browse failed:', error);
        showToast('加载列表失败: ' + error.message, 'error');
    }
}

/**
 * 更新任务分页控件
 * 从 app.js:2967 迁移
 */
function updateTaskPaginationControls() {
    if (!taskPaginationBottom) return;
    
    // 隐藏顶部分页控件
    if (taskPaginationTop) {
        taskPaginationTop.style.display = 'none';
    }
    
    const updateControls = (container) => {
        container.innerHTML = '';
        
        // 始终显示分页控件，即使只有一页
        const paginationHTML = `
            <div class="pagination-controls task-pagination">
                <button class="pagination-btn first-page" ${taskPaginationState.currentPage === 1 ? 'disabled' : ''}>
                    <span class="btn-icon">«</span>
                </button>
                <button class="pagination-btn prev-page" ${taskPaginationState.currentPage === 1 ? 'disabled' : ''}>
                    <span class="btn-icon">‹</span>
                </button>
                <span class="pagination-info">
                    第 <span class="current-page">${taskPaginationState.currentPage}</span> 页，共 <span class="total-pages">${taskPaginationState.totalPages}</span> 页
                </span>
                <button class="pagination-btn next-page" ${taskPaginationState.currentPage === taskPaginationState.totalPages ? 'disabled' : ''}>
                    <span class="btn-icon">›</span>
                </button>
                <button class="pagination-btn last-page" ${taskPaginationState.currentPage === taskPaginationState.totalPages ? 'disabled' : ''}>
                    <span class="btn-icon">»</span>
                </button>
            </div>
        `;
        
        container.innerHTML = paginationHTML;
        
        // 添加事件监听
        container.querySelector('.first-page').addEventListener('click', () => {
            taskPaginationState.currentPage = 1;
            browse('');
        });
        
        container.querySelector('.prev-page').addEventListener('click', () => {
            if (taskPaginationState.currentPage > 1) {
                taskPaginationState.currentPage--;
                browse('');
            }
        });
        
        container.querySelector('.next-page').addEventListener('click', () => {
            if (taskPaginationState.currentPage < taskPaginationState.totalPages) {
                taskPaginationState.currentPage++;
                browse('');
            }
        });
        
        container.querySelector('.last-page').addEventListener('click', () => {
            taskPaginationState.currentPage = taskPaginationState.totalPages;
            browse('');
        });
    };
    
    // 只更新底部分页控件
    updateControls(taskPaginationBottom);
}

/**
 * 更新审核图片分页控件
 * 从 app.js:3037 迁移
 */
function updateReviewImagePaginationControls() {
    if (!reviewImagePaginationTop || !reviewImagePaginationBottom) return;
    
    const updateControls = (container) => {
        container.innerHTML = '';
        
        if (reviewImagePaginationState.totalPages <= 1) return;
        
        const paginationHTML = `
            <div class="pagination-controls review-image-pagination">
                <button class="pagination-btn first-page" ${reviewImagePaginationState.currentPage === 1 ? 'disabled' : ''}>
                    <span class="btn-icon">«</span>
                </button>
                <button class="pagination-btn prev-page" ${reviewImagePaginationState.currentPage === 1 ? 'disabled' : ''}>
                    <span class="btn-icon">‹</span>
                </button>
                <span class="pagination-info">
                    第 <span class="current-page">${reviewImagePaginationState.currentPage}</span> 页，共 <span class="total-pages">${reviewImagePaginationState.totalPages}</span> 页
                    <span class="image-count">（${reviewImagePaginationState.totalItems} 张图片）</span>
                </span>
                <button class="pagination-btn next-page" ${reviewImagePaginationState.currentPage === reviewImagePaginationState.totalPages ? 'disabled' : ''}>
                    <span class="btn-icon">›</span>
                </button>
                <button class="pagination-btn last-page" ${reviewImagePaginationState.currentPage === reviewImagePaginationState.totalPages ? 'disabled' : ''}>
                    <span class="btn-icon">»</span>
                </button>
            </div>
        `;
        
        container.innerHTML = paginationHTML;
        
        // 添加事件监听
        const basePath = appState.getState('reviewContext')?.basePath || '';
        
        container.querySelector('.first-page').addEventListener('click', () => {
            reviewImagePaginationState.currentPage = 1;
            browse(basePath);
        });
        
        container.querySelector('.prev-page').addEventListener('click', () => {
            if (reviewImagePaginationState.currentPage > 1) {
                reviewImagePaginationState.currentPage--;
                browse(basePath);
            }
        });
        
        container.querySelector('.next-page').addEventListener('click', () => {
            if (reviewImagePaginationState.currentPage < reviewImagePaginationState.totalPages) {
                reviewImagePaginationState.currentPage++;
                browse(basePath);
            }
        });
        
        container.querySelector('.last-page').addEventListener('click', () => {
            reviewImagePaginationState.currentPage = reviewImagePaginationState.totalPages;
            browse(basePath);
        });
    };
    
    updateControls(reviewImagePaginationTop);
    updateControls(reviewImagePaginationBottom);
}


/**
 * 显示任务级别控件
 */
function showTaskLevelControls() {
    if (taskPaginationTop) taskPaginationTop.classList.remove('hidden');
    if (taskPaginationBottom) taskPaginationBottom.classList.remove('hidden');
}

/**
 * 隐藏任务级别控件
 */
function hideTaskLevelControls() {
    if (taskPaginationTop) taskPaginationTop.classList.add('hidden');
    if (taskPaginationBottom) taskPaginationBottom.classList.add('hidden');
}

/**
 * 显示审核图片级别控件
 */
function showReviewImageLevelControls() {
    if (reviewImagePaginationTop) reviewImagePaginationTop.classList.remove('hidden');
    if (reviewImagePaginationBottom) reviewImagePaginationBottom.classList.remove('hidden');
}

/**
 * 隐藏审核图片级别控件
 */
function hideReviewImageLevelControls() {
    if (reviewImagePaginationTop) reviewImagePaginationTop.classList.add('hidden');
    if (reviewImagePaginationBottom) reviewImagePaginationBottom.classList.add('hidden');
}

/**
 * 渲染筛选控件
 */
async function renderFilterControls(totalCount) {
    const appMode = appState.getState('appMode');
    const userRoles = appState.getState('userRoles');
    const currentUser = appState.getState('currentUser');
    const isAdmin = Array.isArray(userRoles) && userRoles.includes('admin');

    const container = document.getElementById('filter-controls-container');
    if (!container) return;

    // 状态选项
    const statusOptions = appMode === 'annotate' ? [
        { value: 'all', label: '全部' },
        { value: 'in_progress', label: '标注中' },
        { value: 'completed', label: '已完成' }
    ] : [
        { value: 'all', label: '全部' },
        { value: 'in_progress', label: '审核中' },
        { value: 'completed', label: '已完成' }
    ];

    let html = '<div class="filter-controls">';

    // 状态筛选（所有用户都显示）
    html += `
        <div class="filter-group" style="display: inline-flex; flex-direction: row; align-items: center;">
            <label for="status-filter" style="display: inline-block; margin-right: 4px;">状态</label>
            <select id="status-filter" class="filter-select">
                ${statusOptions.map(option =>
                    `<option value="${option.value}" ${filterState.status === option.value ? 'selected' : ''}>${option.label}</option>`
                ).join('')}
            </select>
        </div>
    `;

    // 管理员额外显示用户和项目筛选
    if (isAdmin) {
        // 用户筛选
        let usernames = [];
        try {
            const response = await fetch(`/api/admin/users?user=${encodeURIComponent(currentUser)}`);
            if (response.ok) {
                const data = await response.json();
                if (data && typeof data === 'object') {
                    usernames = Object.keys(data).filter(name => name !== 'admin');
                }
            }
        } catch (error) {
            console.error('[review-list] Failed to load users:', error);
        }

        html += `
            <div class="filter-group" style="display: inline-flex; flex-direction: row; align-items: center;">
                <label for="user-filter" style="display: inline-block; margin-right: 4px;">用户</label>
                <select id="user-filter" class="filter-select">
                    <option value="">全部</option>
                    ${usernames.map(name =>
                        `<option value="${name}" ${filterState.user === name ? 'selected' : ''}>${name}</option>`
                    ).join('')}
                </select>
            </div>
        `;

        // 项目筛选
        let projectNames = [];
        try {
            const response = await fetch(`/api/admin/projects?user=${encodeURIComponent(currentUser)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.projects && typeof data.projects === 'object') {
                    projectNames = Object.keys(data.projects);
                }
            }
        } catch (error) {
            console.error('[review-list] Failed to load projects:', error);
        }

        html += `
            <div class="filter-group" style="display: inline-flex; flex-direction: row; align-items: center;">
                <label for="project-filter" style="display: inline-block; margin-right: 4px;">项目</label>
                <select id="project-filter" class="filter-select">
                    <option value="">全部</option>
                    ${projectNames.map(name =>
                        `<option value="${name}" ${filterState.project === name ? 'selected' : ''}>${name}</option>`
                    ).join('')}
                </select>
            </div>
        `;
    }

    html += `<div class="filter-stats">共 ${totalCount} 个任务</div></div>`;
    container.innerHTML = html;
    // 确保筛选控件可见
    container.classList.remove('hidden');
    container.style.display = ''; // 清除可能存在的内联样式

    // 绑定事件
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            filterState.status = e.target.value;
            taskPaginationState.currentPage = 1;
            browse('');
        });
    }

    if (isAdmin) {
        const userFilter = document.getElementById('user-filter');
        if (userFilter) {
            userFilter.addEventListener('change', (e) => {
                filterState.user = e.target.value;
                taskPaginationState.currentPage = 1;
                browse('');
            });
        }

        const projectFilter = document.getElementById('project-filter');
        if (projectFilter) {
            projectFilter.addEventListener('change', (e) => {
                filterState.project = e.target.value;
                taskPaginationState.currentPage = 1;
                browse('');
            });
        }
    }
}

/**
 * 隐藏筛选控件
 */
function hideFilterControls() {
    const container = document.getElementById('filter-controls-container');
    if (container) {
        container.classList.add('hidden');
        container.style.display = ''; // 清除内联样式
    }
}

/**
 * 显示筛选控件
 */
function showFilterControls() {
    const container = document.getElementById('filter-controls-container');
    if (container) {
        container.classList.remove('hidden');
        container.style.display = ''; // 清除内联样式
    }
}

/**
 * 处理分页切换请求
 */
function handleChangePage({ page, index }) {
    const basePath = appState.getState('reviewContext')?.basePath || '';
    reviewImagePaginationState.currentPage = page;
    
    browse(basePath).then(() => {
        // 分页加载完成后，启动审核会话
        setTimeout(() => {
            startReviewSession(index, basePath, null, reviewImagePaginationState);
        }, 100);
    });
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * 获取分页状态
 */
export function getPaginationState() {
    return {
        task: taskPaginationState,
        reviewImage: reviewImagePaginationState
    };
}


/**
 * 检查视频是否已抽帧
 */
async function checkVideoExtracted(videoPath) {
    const currentUser = appState.getState('currentUser');
    try {
        const response = await fetch(`/api/video/extraction_info?user=${currentUser}&video_path=${encodeURIComponent(videoPath)}`);
        const data = await response.json();
        
        if (response.ok && data.extraction_info) {
            const extractedCount = data.extraction_info.extracted_frame_count || 0;
            return extractedCount > 0;
        }
        return false;
    } catch (error) {
        console.error('[review-list] Check extraction failed:', error);
        return true; // 出错时允许打开
    }
}

/**
 * 显示需要抽帧的提示
 */
function showExtractRequiredNotice() {
    // 创建提示遮罩
    const noticeDiv = document.createElement('div');
    noticeDiv.className = 'modal-overlay extract-notice-overlay';
    noticeDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    noticeDiv.innerHTML = `
        <div class="modal-dialog extract-notice-dialog" style="max-width: 500px; width: 90%; position: relative; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <button class="close-modal-btn" title="关闭">×</button>
            <div class="modal-header" style="padding: 24px 24px 20px; border-bottom: 1px solid #e9ecef; text-align: center;">
                <div style="font-size: 64px; margin-bottom: 12px;">⚠️</div>
                <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: #333;">请先抽帧后再标注</h3>
            </div>
            <div class="modal-body" style="padding: 24px; text-align: center;">
                <p style="margin: 0 0 24px 0; font-size: 15px; color: #666; line-height: 1.6;">
                    该视频任务尚未抽帧。<br>
                    请点击任务卡片上的 <strong style="color: var(--primary-color);">🎞️ 抽帧</strong> 按钮进行抽帧操作。
                </p>
                <button id="extract-notice-confirm" style="
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    padding: 12px 32px;
                    border-radius: 6px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0, 188, 212, 0.3);
                ">我知道了</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(noticeDiv);
    
    // 点击确认、关闭按钮或遮罩关闭
    const confirmBtn = noticeDiv.querySelector('#extract-notice-confirm');
    const closeBtn = noticeDiv.querySelector('.close-modal-btn');
    const closeNotice = () => {
        document.body.removeChild(noticeDiv);
    };
    
    confirmBtn.addEventListener('click', closeNotice);
    closeBtn.addEventListener('click', closeNotice);
    noticeDiv.addEventListener('click', (e) => {
        if (e.target === noticeDiv) {
            closeNotice();
        }
    });
    
    // 添加按钮悬停效果
    confirmBtn.addEventListener('mouseenter', () => {
        confirmBtn.style.transform = 'translateY(-2px)';
        confirmBtn.style.boxShadow = '0 4px 12px rgba(0, 188, 212, 0.4)';
    });
    confirmBtn.addEventListener('mouseleave', () => {
        confirmBtn.style.transform = 'translateY(0)';
        confirmBtn.style.boxShadow = '0 2px 8px rgba(0, 188, 212, 0.3)';
    });
    
}

/**
 * 显示抽帧模态框
 */
let currentExtractionVideoPath = null;
let frameExtractionModal = null;

async function showFrameExtractionModal(videoPath) {
    currentExtractionVideoPath = videoPath;
    const currentUser = appState.getState('currentUser');
    
    try {
        // 获取抽帧信息
        const response = await fetch(`/api/video/extraction_info?user=${currentUser}&video_path=${encodeURIComponent(videoPath)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '获取抽帧信息失败');
        }
        
        // 创建模态框
        createFrameExtractionModal(data);
        
    } catch (error) {
        showToast(`获取抽帧信息失败: ${error.message}`, 'error');
    }
}

/**
 * 创建抽帧模态框
 */
function createFrameExtractionModal(extractionData) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay frame-extraction-modal';
    modal.style.zIndex = '10000';
    
    const hasAnnotations = extractionData.has_annotations;
    const extractionInfo = extractionData.extraction_info;
    
    modal.innerHTML = `
        <div class="modal-dialog frame-extraction-dialog" style="max-width: 700px; width: 90%; position: relative;">
            <button class="close-modal-btn" title="关闭">×</button>
            <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e9ecef;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">🎞️ 视频抽帧</h3>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #666;">视频信息</h4>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
                        <div style="margin-bottom: 8px;">
                            <strong>视频路径:</strong> <span style="font-family: monospace; font-size: 13px;">${currentExtractionVideoPath}</span>
                        </div>
                        ${extractionInfo ? `
                            <div style="margin-bottom: 8px;">
                                <strong>上次抽帧:</strong> <span>${extractionInfo.extraction_time || '未知'}</span>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>抽帧参数:</strong> <span>${extractionInfo.target_fps} 帧/秒</span>
                            </div>
                            <div>
                                <strong>抽帧数量:</strong> <span style="color: var(--primary-color); font-weight: 600;">${extractionInfo.extracted_frame_count} 张图片</span>
                            </div>
                        ` : `
                            <div style="color: #e74c3c; font-weight: 500;">
                                ⚠️ 状态: 未抽帧
                            </div>
                        `}
                    </div>
                </div>
                
                ${hasAnnotations ? `
                    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
                        <div style="display: flex; gap: 12px;">
                            <div style="font-size: 24px;">⚠️</div>
                            <div style="flex: 1;">
                                <h5 style="margin: 0 0 8px 0; color: #856404;">该视频已有标注数据</h5>
                                <p style="margin: 0 0 12px 0; color: #856404; font-size: 13px;">如需重新抽帧，请先清空标注数据</p>
                                <button id="clear-annotations-btn" style="background: #ffc107; color: #000; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                    🗑️ 清空标注数据
                                </button>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="extraction-settings-section">
                        <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #666;">抽帧参数设置</h4>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500;">目标帧率 (帧/秒):</label>
                            <input type="number" id="target-fps" value="1" min="0.1" max="30" step="0.1" 
                                   style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                            <div style="margin-top: 6px; font-size: 12px; color: #999;">
                                可设置小数，比如：0.1 帧/秒 = 每 10 秒取 1 帧
                            </div>
                        </div>
                    </div>
                    
                    <div class="extraction-progress-section hidden">
                        <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #666;">抽帧进度</h4>
                        <div style="margin-bottom: 12px;">
                            <div style="background: #e9ecef; height: 8px; border-radius: 4px; overflow: hidden;">
                                <div id="extraction-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary-color), #0097a7); transition: width 0.3s;"></div>
                            </div>
                            <div id="extraction-progress-text" style="text-align: center; margin-top: 6px; font-weight: 600;">0%</div>
                        </div>
                        <div id="extraction-details" style="font-size: 13px; color: #666;"></div>
                    </div>
                    
                    <div class="extraction-result-section hidden">
                        <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #666;">抽帧结果</h4>
                        <div id="extraction-result"></div>
                    </div>
                `}
            </div>
            <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e9ecef; display: flex; justify-content: flex-end; gap: 12px;">
                ${hasAnnotations ? '' : `
                    <button id="cancel-extraction-btn" class="btn-secondary">取消</button>
                    <button id="start-extraction-btn" class="btn-primary">🚀 开始抽帧</button>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    frameExtractionModal = modal;
    
    // 设置事件
    setupFrameExtractionModalEvents(hasAnnotations);
}

/**
 * 设置抽帧模态框事件
 */
function setupFrameExtractionModalEvents(hasAnnotations) {
    const closeModal = () => {
        if (frameExtractionModal) {
            frameExtractionModal.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(frameExtractionModal);
                frameExtractionModal = null;
                currentExtractionVideoPath = null;
            }, 200);
        }
    };
    
    const closeBtn = frameExtractionModal.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', closeModal);
    
    if (hasAnnotations) {
        frameExtractionModal.querySelector('#clear-annotations-btn').addEventListener('click', clearVideoAnnotations);
    } else {
        frameExtractionModal.querySelector('#start-extraction-btn').addEventListener('click', startFrameExtraction);
        frameExtractionModal.querySelector('#cancel-extraction-btn').addEventListener('click', closeModal);
    }
    
    frameExtractionModal.addEventListener('click', (e) => {
        if (e.target === frameExtractionModal) closeModal();
    });
}

/**
 * 清空视频标注数据
 */
async function clearVideoAnnotations() {
    if (!currentExtractionVideoPath) return;
    
    if (!confirm('确定要清空该视频的所有标注数据吗？此操作不可恢复！')) {
        return;
    }
    
    const currentUser = appState.getState('currentUser');
    
    try {
        const response = await fetch('/api/video/clear_annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: currentUser,
                video_path: currentExtractionVideoPath
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('标注数据已清空', 'success');
            // 关闭当前模态框
            if (frameExtractionModal) {
                document.body.removeChild(frameExtractionModal);
                frameExtractionModal = null;
            }
            // 重新打开抽帧模态框
            setTimeout(() => showFrameExtractionModal(currentExtractionVideoPath), 500);
        } else {
            throw new Error(data.error || '清空标注数据失败');
        }
    } catch (error) {
        showToast(`清空失败: ${error.message}`, 'error');
    }
}

/**
 * 开始抽帧
 */
async function startFrameExtraction() {
    if (!currentExtractionVideoPath) return;
    
    const currentUser = appState.getState('currentUser');
    const targetFps = parseFloat(frameExtractionModal.querySelector('#target-fps').value) || 1;
    const startBtn = frameExtractionModal.querySelector('#start-extraction-btn');
    const cancelBtn = frameExtractionModal.querySelector('#cancel-extraction-btn');
    
    // 禁用按钮
    startBtn.disabled = true;
    cancelBtn.disabled = true;
    startBtn.innerHTML = '⏳ 抽帧中...';
    
    // 显示进度区域
    frameExtractionModal.querySelector('.extraction-settings-section').classList.add('hidden');
    frameExtractionModal.querySelector('.extraction-progress-section').classList.remove('hidden');
    
    try {
        const response = await fetch('/api/video/extract_frames', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: currentUser,
                video_path: currentExtractionVideoPath,
                target_fps: targetFps
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showExtractionResult(data);
            updateTaskFrameCount(currentExtractionVideoPath, data.extracted_count);
        } else {
            throw new Error(data.error || '抽帧失败');
        }
    } catch (error) {
        showToast(`抽帧失败: ${error.message}`, 'error');
        resetExtractionUI();
    }
}

/**
 * 显示抽帧结果
 */
function showExtractionResult(result) {
    if (!frameExtractionModal) return;
    
    // 更新进度为100%
    frameExtractionModal.querySelector('#extraction-progress-bar').style.width = '100%';
    frameExtractionModal.querySelector('#extraction-progress-text').textContent = '100%';
    
    // 隐藏进度区域
    frameExtractionModal.querySelector('.extraction-progress-section').classList.add('hidden');
    
    // 显示结果
    const resultSection = frameExtractionModal.querySelector('.extraction-result-section');
    resultSection.classList.remove('hidden');
    resultSection.querySelector('#extraction-result').innerHTML = `
        <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 20px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
            <div style="color: #155724; font-size: 16px; font-weight: 600; margin-bottom: 8px;">${result.message || '抽帧完成'}</div>
            <div style="color: #155724; font-size: 14px;">成功提取 <strong style="font-size: 18px; color: #28a745;">${result.extracted_count}</strong> 张图片</div>
        </div>
    `;
    
    // 更新底部按钮
    const footer = frameExtractionModal.querySelector('.modal-footer');
    footer.innerHTML = `
        <button id="close-result-btn" class="btn-secondary">关闭</button>
        <button id="refresh-task-btn" class="btn-secondary">刷新列表</button>
        <button id="start-annotate-btn" class="btn-primary">开始标注</button>
    `;
    
    footer.querySelector('#close-result-btn').addEventListener('click', () => {
        if (frameExtractionModal) {
            frameExtractionModal.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(frameExtractionModal);
                frameExtractionModal = null;
                currentExtractionVideoPath = null;
            }, 200);
        }
    });
    
    footer.querySelector('#refresh-task-btn').addEventListener('click', () => {
        if (frameExtractionModal) {
            frameExtractionModal.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(frameExtractionModal);
                frameExtractionModal = null;
            }, 200);
        }
        setTimeout(() => {
            browse('');
            showToast('任务列表已刷新');
        }, 300);
    });
    
    footer.querySelector('#start-annotate-btn').addEventListener('click', () => {
        if (frameExtractionModal) {
            frameExtractionModal.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(frameExtractionModal);
                frameExtractionModal = null;
            }, 200);
        }
        setTimeout(() => {
            // 触发选择任务事件，开始标注
            eventBus.emit('annotation:select-task', {
                path: currentExtractionVideoPath,
                name: currentExtractionVideoPath.split('/').pop(),
                totalFrames: result.extracted_count,
                type: 'video'
            });
        }, 300);
    });
}

/**
 * 重置抽帧UI
 */
function resetExtractionUI() {
    if (!frameExtractionModal) return;
    
    const startBtn = frameExtractionModal.querySelector('#start-extraction-btn');
    const cancelBtn = frameExtractionModal.querySelector('#cancel-extraction-btn');
    
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '🚀 开始抽帧';
    }
    if (cancelBtn) {
        cancelBtn.disabled = false;
    }
    
    frameExtractionModal.querySelector('.extraction-progress-section').classList.add('hidden');
    frameExtractionModal.querySelector('.extraction-settings-section').classList.remove('hidden');
}

/**
 * 更新任务卡片中的帧数显示
 */
function updateTaskFrameCount(videoPath, newFrameCount) {
    const videoItems = document.querySelectorAll('.video-item');
    videoItems.forEach(item => {
        const nameElement = item.querySelector('.item-name');
        if (nameElement && nameElement.textContent.includes(videoPath.split('/').pop())) {
            // 更新图片总数
            const totalImagesElement = item.querySelector('.stat-row:first-child .stat-value');
            if (totalImagesElement) {
                totalImagesElement.textContent = newFrameCount;
            }
            
            // 更新进度条
            const annotatedElement = item.querySelector('.stat-row:nth-child(2) .stat-value');
            const annotatedImages = parseInt(annotatedElement?.textContent) || 0;
            const progressPercent = newFrameCount > 0 ? Math.round((annotatedImages / newFrameCount) * 100) : 0;
            
            const progressFill = item.querySelector('.progress-fill');
            const progressText = item.querySelector('.progress-text');
            if (progressFill) progressFill.style.width = `${progressPercent}%`;
            if (progressText) progressText.textContent = `${progressPercent}%`;
        }
    });
}

/**
 * 显示标签详情模态框
 */
async function showLabelDetailsModal(labelCounts, taskPath, projectName = 'default') {
    const currentUser = appState.getState('currentUser');
    
    // 加载项目特定的标签名称映射
    let labelNames = {};
    try {
        const response = await fetch(`/api/labels?user=${currentUser}&project=${encodeURIComponent(projectName)}`);
        const data = await response.json();
        if (response.ok) {
            data.labels.forEach(label => {
                labelNames[label.id] = label.name;
            });
        }
    } catch (error) {
        console.error('[review-list] Failed to load labels:', error);
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    // 生成标签列表HTML
    let labelsHTML = '';
    let hasLabels = false;

    if (Object.keys(labelCounts).length > 0) {
        hasLabels = true;
        const sortedLabels = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]);
        const maxCount = Math.max(...Object.values(labelCounts));

        labelsHTML = sortedLabels.map(([classId, count], index) => {
            const labelName = labelNames[classId] || `标签 ${classId}`;
            const displayName = `${labelName}`;
            const percentage = Math.round((count / maxCount) * 100);
            const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e'];
            const color = colors[index % colors.length];
            return `
                <tr style="border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseenter="this.style.background='#fafafa';" onmouseleave="this.style.background='transparent';">
                    <td style="padding: 10px 12px; font-size: 14px; color: #333;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>
                        ${displayName}
                        <span style="color: #999; font-size: 11px; font-family: monospace; margin-left: 6px;">ID: ${classId}</span>
                    </td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: ${color}; font-size: 14px; white-space: nowrap;">${count}</td>
                    <td style="padding: 10px 12px; width: 120px;">
                        <div style="background: #e9ecef; border-radius: 4px; height: 6px; overflow: hidden;">
                            <div style="background: ${color}; height: 100%; width: ${percentage}%;"></div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        labelsHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无标注数据</div>';
    }

    modal.style.zIndex = '10000';

    modal.innerHTML = `
        <div class="modal-dialog label-details-modal" style="max-width: 560px; width: 90%; position: relative;">
            <button class="close-modal-btn" title="关闭">×</button>
            <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e9ecef;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #333;">📊 标签统计详情</h3>
            </div>
            <div class="modal-body" style="padding: 0 24px 24px;">
                <div style="max-height: 450px; overflow-y: auto;">
                    ${hasLabels ? `
                    <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
                        <thead>
                            <tr style="border-bottom: 1px solid #e9ecef; font-size: 12px; color: #999; text-transform: uppercase;">
                                <th style="padding: 10px 12px; text-align: left; font-weight: 500;">标签名称</th>
                                <th style="padding: 10px 12px; text-align: right; font-weight: 500;">数量</th>
                                <th style="padding: 10px 12px; width: 120px; font-weight: 500;"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${labelsHTML}
                        </tbody>
                    </table>
                    ` : labelsHTML}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 关闭事件
    const closeModal = () => {
        modal.classList.add('fade-out');
        setTimeout(() => modal.remove(), 200);
    };
    
    const closeBtn = modal.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // 添加淡入动画
    requestAnimationFrame(() => modal.classList.add('fade-in'));
}

/**
 * 标记任务完成/重新打开
 */
async function markTaskAsComplete(taskType, taskPath, status) {
    const currentUser = appState.getState('currentUser');
    
    try {
        const response = await fetch('/api/task/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: currentUser,
                task_type: taskType,
                task_path: taskPath,
                status: status
            }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            const errorMsg = data.detail || data.error || '更新任务状态失败';
            throw new Error(errorMsg);
        }
        
        showToast(data.message || '任务状态已更新', 'success');
        
        // 刷新列表
        browse('');
        
    } catch (error) {
        console.error('[review-list] Error updating task status:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 创建任务菜单按钮（管理员功能）
 * 参考旧版 app.legacy.js:createTaskMenuButton
 */
function createTaskMenuButton(taskPath, taskType, taskName) {
    const userRoles = appState.getState('userRoles');
    if (!Array.isArray(userRoles) || !userRoles.includes('admin')) return '';

    return `
        <div class="task-menu-container">
            <button class="task-menu-btn" data-task-path="${taskPath}" data-task-type="${taskType}" data-task-name="${taskName}">
                ⋮
            </button>
        </div>
    `;
}

/**
 * 绑定任务菜单按钮事件
 * 参考旧版 app.legacy.js:setupTaskMenuListeners
 */
function setupTaskMenuListeners() {
    document.querySelectorAll('.task-menu-btn').forEach(btn => {
        // 避免重复绑定
        if (btn.dataset.menuListenerBound === 'true') return;
        btn.dataset.menuListenerBound = 'true';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskPath = e.target.dataset.taskPath;
            const taskType = e.target.dataset.taskType;
            const taskName = e.target.dataset.taskName;

            showReassignModal(taskPath, taskType, taskName);
        });
    });
}

/**
 * 显示重新分配弹窗
 * 参考旧版 app.legacy.js:showReassignModal
 */
async function showReassignModal(taskPath, taskType, taskName) {
    const currentUser = appState.getState('currentUser');

    let users = [];
    try {
        const response = await fetch(`/api/admin/task/users?user=${currentUser}&task_type=${taskType}`);
        const data = await response.json();
        if (response.ok) {
            users = data.users;
        } else {
            throw new Error(data.error || '获取用户列表失败');
        }
    } catch (error) {
        showToast(`获取用户列表失败: ${error.message}`, 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-dialog reassign-modal" style="border-radius: 16px;">
            <div class="modal-header">
                <h3>重新分配任务</h3>
                <button class="close-modal-btn" title="关闭">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px; color: #4b5563; line-height: 1.5;">任务: <strong style="color: #1f2937;">${taskName}</strong></p>
                <div class="form-group">
                    <label for="user-select">选择${taskType === 'annotation' ? '标注员' : '审核员'}:</label>
                    <select id="user-select" class="form-select">
                        <option value="">请选择用户</option>
                        ${users.map(user => `<option value="${user}">${user}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button id="confirm-reassign-btn" class="btn-primary">确认分配</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        if (modal.parentNode) {
            document.body.removeChild(modal);
        }
    };

    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);

    modal.querySelector('#confirm-reassign-btn').addEventListener('click', async () => {
        const selectedUser = modal.querySelector('#user-select').value;
        if (!selectedUser) {
            showToast('请选择用户');
            return;
        }

        try {
            const response = await fetch('/api/admin/task/reassign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: currentUser,
                    task_path: taskPath,
                    task_type: taskType,
                    new_assignee: selectedUser
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message);
                closeModal();
                browse('');
            } else {
                throw new Error(data.error || '重新分配失败');
            }
        } catch (error) {
            showToast(`重新分配失败: ${error.message}`, 'error');
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    const handleEscKey = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscKey);
        }
    };
    document.addEventListener('keydown', handleEscKey);
}

/**
 * 获取筛选状态
 */
export function getFilterState() {
    return filterState;
}

export default {
    init,
    browse,
    getPaginationState,
    getFilterState
};
