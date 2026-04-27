/**
 * 审核界面模块
 * 处理审核界面的UI交互
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { initAnnotationState, loadAnnotationFromData, setActiveObject, addNewObject } from '../annotation/annotation-state.js';
import { redrawAll, setImageDimensions } from '../annotation/annotation-canvas.js';
import { renderSidebar } from '../annotation/annotation-sidebar.js';
import { setEditingFilePath } from '../annotation/annotation-frame.js';
import { init as initReviewList, browse } from './review-list.js';

// 防止重复初始化的标志
let isInitialized = false;

// 事件处理函数引用（用于移除监听器）
let modifyBtnHandler = null;
let cancelModifyBtnHandler = null;
let backBtnHandler = null;

// 审核上下文
let reviewContext = {
    basePath: '',
    fileList: [],
    currentIndex: -1,
    currentPage: 1,
    pageSize: 60,
    totalImages: 0
};

// DOM元素
let displayImage = null;
let modifyBtn = null;
let cancelModifyBtn = null;
let resetBtn = null;
let saveSuccessBtn = null;
let addObjectBtn = null;
let deleteBtn = null;
let autoAnnotateBtn = null;
let canvas = null;
let skipFramesInput = null;
let prevFrameBtn = null;
let nextFrameBtn = null;

// 任务跳帧设置
let taskSkipFrames = {};
let currentTaskSkipFrames = 1;

/**
 * 初始化审核界面模块
 */
export function init() {
    console.log('[review-ui] Initializing...');
    
    // 防止重复初始化
    if (isInitialized) {
        console.log('[review-ui] Already initialized, skipping...');
        // 已初始化，只需刷新数据
        setTimeout(() => {
            browse('');
        }, 50);
        return;
    }
    
    // 获取DOM元素
    displayImage = document.getElementById('display-image');
    modifyBtn = document.getElementById('modify-btn');
    cancelModifyBtn = document.getElementById('cancel-modify-btn');
    resetBtn = document.getElementById('reset-btn');
    saveSuccessBtn = document.getElementById('save-success-btn');
    addObjectBtn = document.getElementById('add-object-btn');
    deleteBtn = document.getElementById('delete-btn');
    autoAnnotateBtn = document.getElementById('auto-annotate-btn');
    canvas = document.getElementById('point-canvas');
    skipFramesInput = document.getElementById('skip-frames');
    prevFrameBtn = document.getElementById('prev-frame-btn');
    nextFrameBtn = document.getElementById('next-frame-btn');
    
    setupReviewUI();
    setupReviewEvents();
    
    // 初始化审核列表模块
    initReviewList();
    
    isInitialized = true;
    
    console.log('[review-ui] Calling browse for review mode...');
    // 使用 setTimeout 确保 DOM 已就绪
    setTimeout(() => {
        browse('');
    }, 50);
}

/**
 * 设置审核界面
 */
function setupReviewUI() {
    // 订阅审核相关事件
    eventBus.on('review:next-frame', handleReviewNextFrame);
    eventBus.on('review:prev-frame', handleReviewPrevFrame);
    eventBus.on('review:update-counter', updateReviewCounter);
    eventBus.on('review:annotation-cleared', handleAnnotationCleared);
}

/**
 * 设置审核事件
 */
function setupReviewEvents() {
    // 定义事件处理函数
    modifyBtnHandler = enterModifyMode;
    cancelModifyBtnHandler = exitModifyMode;
    backBtnHandler = returnToReviewList;
    
    // 移除旧监听器并添加新监听器
    if (modifyBtn) {
        modifyBtn.removeEventListener('click', modifyBtnHandler);
        modifyBtn.addEventListener('click', modifyBtnHandler);
    }
    
    if (cancelModifyBtn) {
        cancelModifyBtn.removeEventListener('click', cancelModifyBtnHandler);
        cancelModifyBtn.addEventListener('click', cancelModifyBtnHandler);
    }
    
    // 设置返回列表按钮
    const backBtn = document.getElementById('back-to-list-btn');
    if (backBtn) {
        backBtn.removeEventListener('click', backBtnHandler);
        backBtn.addEventListener('click', backBtnHandler);
    }
}

/**
 * 启动审核会话
 * 从 app.js:3599 迁移
 */
export function startReviewSession(startIndex, basePath, fileList, paginationState) {
    // 保存当前任务的间隔帧数设置
    if (reviewContext.basePath && skipFramesInput) {
        taskSkipFrames[reviewContext.basePath] = parseInt(skipFramesInput.value) || 1;
    }
    
    // 更新审核上下文
    reviewContext.basePath = basePath;
    reviewContext.fileList = fileList;
    reviewContext.currentPage = paginationState.currentPage;
    reviewContext.pageSize = paginationState.pageSize;
    reviewContext.totalImages = paginationState.totalItems;
    reviewContext.currentIndex = startIndex;
    
    // 同步到全局状态，供其他模块（如annotation-ui）访问
    appState.setState('reviewContext', {
        basePath: reviewContext.basePath,
        currentPage: reviewContext.currentPage,
        pageSize: reviewContext.pageSize,
        totalImages: reviewContext.totalImages
    });
    
    // 恢复审核任务的间隔帧数设置
    if (taskSkipFrames[reviewContext.basePath]) {
        skipFramesInput.value = taskSkipFrames[reviewContext.basePath];
        currentTaskSkipFrames = taskSkipFrames[reviewContext.basePath];
    } else {
        skipFramesInput.value = 1;
        currentTaskSkipFrames = 1;
        taskSkipFrames[reviewContext.basePath] = 1;
    }
    
    // 显示审核UI
    showAnnotationUI('review');
    
    // 加载第一张图片
    loadReviewedImage();
}

/**
 * 加载审核图片
 * 从 app.js:3625 迁移
 */
export async function loadReviewedImage() {
    if (reviewContext.currentIndex < 0 || reviewContext.currentIndex >= reviewContext.fileList.length) {
        showToast(reviewContext.currentIndex < 0 ? "已经是第一张了" : "已经是最后一张了");
        reviewContext.currentIndex = Math.max(0, Math.min(reviewContext.currentIndex, reviewContext.fileList.length - 1));
        return;
    }
    
    const currentFile = reviewContext.fileList[reviewContext.currentIndex];
    
    // 设置编辑文件路径
    setEditingFilePath(currentFile.relative_path);
    
    try {
        const response = await fetch(`/api/get_annotation?path=${encodeURIComponent(currentFile.relative_path)}`);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to fetch annotation data');
        }
        
        const data = await response.json();
        
        // 设置当前项目
        if (data.project) {
            appState.setState('currentProject', data.project);
            eventBus.emit(EVENTS.PROJECT_SELECTED, data.project);
        }
        
        // 暂存标注数据，等图片加载后再处理
        const annotationsToLoad = data.annotations;
        
        // 设置图像源
        if (displayImage) {
            displayImage.src = currentFile.web_path;
            
            displayImage.onload = () => {
                // 设置图像尺寸到canvas模块，确保标注坐标映射正确
                const pointCanvas = document.getElementById('point-canvas');
                if (pointCanvas && displayImage.naturalWidth && displayImage.naturalHeight) {
                    // 先调整 canvas 尺寸到容器实际大小（与标注模式保持一致）
                    const container = displayImage.parentElement;
                    if (container) {
                        pointCanvas.width = container.offsetWidth;
                        pointCanvas.height = container.offsetHeight;
                    }
                    setImageDimensions({
                        width: pointCanvas.width,
                        height: pointCanvas.height,
                        naturalWidth: displayImage.naturalWidth,
                        naturalHeight: displayImage.naturalHeight,
                        ratio: 1
                    });
                }
                
                // 加载标注数据
                loadAnnotationsForReview(annotationsToLoad);
                
                // 更新帧计数器
                updateReviewCounter();
                
                // 重绘
                redrawAll();
            };
        }
        
    } catch (error) {
        console.error("Error loading annotation for review:", error);
        showToast(`加载标注失败: ${error.message}`, 'error');
    }
}

/**
 * 为审核加载标注数据
 */
function loadAnnotationsForReview(annotations) {
    const labels = appState.getState('labels') || [];
    
    if (!annotations || annotations.length === 0) {
        initAnnotationState();
        renderSidebar();
        return;
    }
    
    const objectsData = annotations.map((ann, index) => ({
        id: index + 1,
        classId: ann.classId,
        color: getColorForLabel(ann.classId, labels),
        points: [],
        maskData: ann.maskData,
        boxData: calculateBoxData(ann.maskData),
        isVisible: true
    }));
    
    loadAnnotationFromData({ objects: objectsData });
    
    if (objectsData.length > 0) {
        setActiveObject(0);
    } else {
        addNewObject();
    }
    
    renderSidebar();
}

/**
 * 获取标签颜色
 */
function getColorForLabel(classId, labels) {
    const COLORS = ['#FF3838', '#FF9D38', '#3877FF', '#38FFFF', '#8B38FF', '#FF38F5'];
    
    if (Array.isArray(labels) && labels.length > 0) {
        const selectedLabel = labels.find(label => label.id === classId);
        if (selectedLabel && selectedLabel.color) {
            return selectedLabel.color;
        }
    }
    
    return COLORS[classId % COLORS.length];
}

/**
 * 计算边界框
 */
function calculateBoxData(maskData) {
    if (!maskData || maskData.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    maskData[0].forEach(p => {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
    });
    
    return [minX, minY, maxX, maxY];
}

/**
 * 进入修改模式
 * 从 app.js:6624 迁移
 */
function enterModifyMode() {
    if (!modifyBtn || !cancelModifyBtn) return;
    
    modifyBtn.classList.add('hidden');
    cancelModifyBtn.classList.remove('hidden');
    
    [resetBtn, saveSuccessBtn, addObjectBtn].forEach(el => {
        if (el) el.style.display = '';
    });
    
    if (canvas) {
        canvas.style.pointerEvents = 'auto';
    }
    
    showToast("修改模式已启用，您可以开始编辑了");
}

/**
 * 退出修改模式
 * 从 app.js:6632 迁移
 */
function exitModifyMode() {
    if (!modifyBtn || !cancelModifyBtn) return;
    
    cancelModifyBtn.classList.add('hidden');
    modifyBtn.classList.remove('hidden');
    
    [resetBtn, saveSuccessBtn, addObjectBtn].forEach(el => {
        if (el) el.style.display = 'none';
    });
    
    if (canvas) {
        canvas.style.pointerEvents = 'none';
    }
    
    // 重新加载当前图片以恢复原始状态
    loadReviewedImage();
    
    showToast("已退出修改模式");
}

/**
 * 返回审核任务列表
 */
function returnToReviewList() {
    console.log('[review-ui] Returning to review list...');
    
    const videoSelection = document.getElementById('video-selection');
    const annotationUI = document.getElementById('annotation-ui');
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    
    // 隐藏标注界面，显示列表
    if (annotationUI) annotationUI.classList.add('hidden');
    if (videoSelection) videoSelection.classList.remove('hidden');
    
    // 恢复侧边栏显示
    if (mainSidebar) mainSidebar.classList.remove('hidden');
    if (mainContentArea) mainContentArea.classList.remove('full-width');
    
    // 根据侧边栏的折叠状态来决定是否显示折叠按钮
    if (sidebarCollapsedHeader && mainSidebar) {
        const isSidebarCollapsed = mainSidebar.classList.contains('sidebar-collapsed');
        if (isSidebarCollapsed) {
            // 侧边栏是折叠的，显示展开按钮
            sidebarCollapsedHeader.classList.remove('hidden');
        } else {
            // 侧边栏是展开的，隐藏展开按钮
            sidebarCollapsedHeader.classList.add('hidden');
        }
    }
    
    // 保存当前basePath用于返回
    const returnPath = reviewContext.basePath || '';
    
    // 清除审核上下文
    reviewContext.basePath = '';
    reviewContext.fileList = [];
    reviewContext.currentIndex = -1;
    
    // 同步清除全局状态
    appState.setState('reviewContext', {
        basePath: '',
        currentPage: 1,
        pageSize: 60,
        totalImages: 0
    });
    
    // 重新加载审核任务列表（返回到图像列表）
    browse(returnPath);
    
    showToast('已返回图像列表', 'info');
}

/**
 * 显示标注UI（审核模式）
 * 从 app.js:5140 迁移
 */
function showAnnotationUI(mode) {
    const videoSelection = document.getElementById('video-selection');
    const annotationUI = document.getElementById('annotation-ui');
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    
    if (videoSelection) videoSelection.classList.add('hidden');
    if (annotationUI) annotationUI.classList.remove('hidden');
    
    [prevFrameBtn, nextFrameBtn, skipFramesInput].forEach(el => {
        if (el) el.disabled = false;
    });
    
    // 隐藏侧边栏
    if (mainSidebar) mainSidebar.classList.add('hidden');
    if (mainContentArea) mainContentArea.classList.add('full-width');
    if (sidebarCollapsedHeader) sidebarCollapsedHeader.classList.add('hidden');
    
    if (mode === 'review') {
        // 审核模式UI设置
        if (modifyBtn) modifyBtn.classList.remove('hidden');
        if (cancelModifyBtn) cancelModifyBtn.classList.add('hidden');
        if (deleteBtn) deleteBtn.classList.remove('hidden');
        
        [resetBtn, saveSuccessBtn, addObjectBtn].forEach(el => {
            if (el) el.style.display = 'none';
        });
        
        if (autoAnnotateBtn) autoAnnotateBtn.style.display = 'none';
        if (canvas) canvas.style.pointerEvents = 'none';
    }
}

/**
 * 更新审核计数器
 */
function updateReviewCounter() {
    const frameCounter = document.getElementById('frame-counter');
    if (!frameCounter) return;
    
    const globalIndex = (reviewContext.currentPage - 1) * reviewContext.pageSize + reviewContext.currentIndex + 1;
    frameCounter.textContent = `${globalIndex} / ${reviewContext.totalImages}`;
}

/**
 * 处理审核模式下一帧
 */
function handleReviewNextFrame(skip) {
    const currentGlobalIndex = (reviewContext.currentPage - 1) * reviewContext.pageSize + reviewContext.currentIndex;
    const nextGlobalIndex = currentGlobalIndex + skip;
    
    if (nextGlobalIndex >= reviewContext.totalImages) {
        showToast("已经是最后一张了");
        return;
    }
    
    // 计算下一张图片在哪个分页
    const nextPage = Math.floor(nextGlobalIndex / reviewContext.pageSize) + 1;
    const nextIndexInPage = nextGlobalIndex % reviewContext.pageSize;
    
    if (nextPage !== reviewContext.currentPage) {
        // 需要切换分页
        eventBus.emit('review:change-page', { page: nextPage, index: nextIndexInPage });
    } else {
        // 在当前页直接跳转
        reviewContext.currentIndex += skip;
        loadReviewedImage();
    }
}

/**
 * 处理审核模式上一帧
 */
function handleReviewPrevFrame(skip) {
    const currentGlobalIndex = (reviewContext.currentPage - 1) * reviewContext.pageSize + reviewContext.currentIndex;
    const prevGlobalIndex = currentGlobalIndex - skip;
    
    if (prevGlobalIndex < 0) {
        showToast("已经是第一张了");
        return;
    }
    
    // 计算上一张图片在哪个分页
    const prevPage = Math.floor(prevGlobalIndex / reviewContext.pageSize) + 1;
    const prevIndexInPage = prevGlobalIndex % reviewContext.pageSize;
    
    if (prevPage !== reviewContext.currentPage) {
        // 需要切换分页
        eventBus.emit('review:change-page', { page: prevPage, index: prevIndexInPage });
    } else {
        // 在当前页直接跳转
        reviewContext.currentIndex -= skip;
        loadReviewedImage();
    }
}

/**
 * 处理标注清空后的操作
 */
function handleAnnotationCleared() {
    // 从文件列表中移除当前文件
    reviewContext.fileList.splice(reviewContext.currentIndex, 1);
    
    if (reviewContext.fileList.length === 0) {
        // 没有更多文件，返回列表
        eventBus.emit('ui:show-list');
        showToast("所有标注已处理完成");
    } else {
        // 加载下一张图片
        if (reviewContext.currentIndex >= reviewContext.fileList.length) {
            reviewContext.currentIndex = reviewContext.fileList.length - 1;
        }
        loadReviewedImage();
    }
}

/**
 * 获取审核上下文
 */
export function getReviewContext() {
    return reviewContext;
}

export default {
    init,
    startReviewSession,
    loadReviewedImage,
    getReviewContext
};
