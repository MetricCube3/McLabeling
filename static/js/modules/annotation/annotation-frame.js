/**
 * 标注帧导航模块
 * 处理图像加载、帧切换、任务浏览
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { initAnnotationState, loadAnnotationFromData, clearAnnotationState } from './annotation-state.js';
import { redrawAll, setImageDimensions } from './annotation-canvas.js';
import { renderSidebar } from './annotation-sidebar.js';
import { loadLabels } from '../label/label-manager.js';

// 帧导航状态
let currentVideoPath = null;
let currentFrameIndex = 0;
let totalFrames = 0;
let taskSkipFrames = {}; // 记录每个任务的间隔帧数
let currentTaskSkipFrames = 1;
let editingFilePath = null;

// DOM元素
let displayImage = null;
let canvas = null;
let ctx = null;
let frameCounter = null;
let skipFramesInput = null;
let prevFrameBtn = null;
let nextFrameBtn = null;
let videoList = null;

/**
 * 初始化帧导航模块
 */
export function init() {
    // 获取DOM元素
    displayImage = document.getElementById('display-image');
    canvas = document.getElementById('point-canvas');
    ctx = canvas ? canvas.getContext('2d') : null;
    frameCounter = document.getElementById('frame-counter');
    skipFramesInput = document.getElementById('skip-frames');
    prevFrameBtn = document.getElementById('prev-frame-btn');
    nextFrameBtn = document.getElementById('next-frame-btn');
    videoList = document.getElementById('video-list');
    
    // 设置事件监听
    setupFrameNavigation();
    
    // 添加窗口调整大小监听器
    let resizeTimeout;
    window.addEventListener('resize', () => {
        // 使用防抖避免频繁调整
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (displayImage && displayImage.src && canvas) {
                setupCanvasAndRedraw();
            }
        }, 150);
    });
}

/**
 * 设置帧导航事件
 */
function setupFrameNavigation() {
    if (nextFrameBtn) {
        nextFrameBtn.addEventListener('click', handleNextFrame);
    }
    
    if (prevFrameBtn) {
        prevFrameBtn.addEventListener('click', handlePrevFrame);
    }
    
    if (frameCounter) {
        frameCounter.addEventListener('click', makeFrameCounterEditable);
    }
}

/**
 * 处理下一帧
 */
function handleNextFrame() {
    const skip = parseInt(skipFramesInput?.value, 10) || 1;
    const appMode = appState.getState('appMode');
    
    // 更新当前任务的间隔帧数
    if (appMode === 'annotate' && currentVideoPath) {
        taskSkipFrames[currentVideoPath] = skip;
        currentTaskSkipFrames = skip;
    }
    
    if (appMode === 'review') {
        // 审核模式的帧导航逻辑
        handleReviewNextFrame(skip);
    } else {
        // 标注模式的帧导航
        loadFrame(currentFrameIndex + skip);
    }
}

/**
 * 处理上一帧
 */
function handlePrevFrame() {
    const skip = parseInt(skipFramesInput?.value, 10) || 1;
    const appMode = appState.getState('appMode');
    
    // 更新当前任务的间隔帧数
    if (appMode === 'annotate' && currentVideoPath) {
        taskSkipFrames[currentVideoPath] = skip;
        currentTaskSkipFrames = skip;
    }
    
    if (appMode === 'review') {
        // 审核模式的帧导航逻辑
        handleReviewPrevFrame(skip);
    } else {
        // 标注模式的帧导航
        loadFrame(currentFrameIndex - skip);
    }
}

/**
 * 审核模式下一帧（占位，实际实现在review模块）
 */
function handleReviewNextFrame(skip) {
    eventBus.emit('review:next-frame', skip);
}

/**
 * 审核模式上一帧（占位，实际实现在review模块）
 */
function handleReviewPrevFrame(skip) {
    eventBus.emit('review:prev-frame', skip);
}

/**
 * 加载指定帧
 * 从 app.js:3407 迁移
 */
export async function loadFrame(index, forceLoad = false) {
    if (!currentVideoPath || index < 0 || (totalFrames > 0 && index >= totalFrames)) {
        return;
    }
    
    if (!forceLoad && currentFrameIndex === index && displayImage?.src) {
        return;
    }
    
    try {
        editingFilePath = null;
        const url = `/api/videos/frame?video_path=${encodeURIComponent(currentVideoPath)}&frame_index=${index}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 1. 准备数据
        totalFrames = data.totalFrames;
        currentFrameIndex = index;
        updateFrameCounter();
        
        // 2. 清除当前显示
        if (displayImage) {
            displayImage.src = '';
        }
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // 3. 加载标注数据或初始化新状态
        if (data.hasAnnotation && data.annotations && data.annotations.length > 0) {
            // 存在标注，加载标注数据
            initAnnotationStateWithData(data.annotations);
        } else {
            // 没有标注，初始化空状态
            initAnnotationState();
        }
        
        // 4. 设置图像源触发onload
        if (displayImage) {
            displayImage.src = data.frameUrl;
            
            displayImage.onload = () => {
                setupCanvasAndRedraw();
                // 如果有标注数据，重新绘制
                if (data.hasAnnotation && data.annotations && data.annotations.length > 0) {
                    redrawAll();
                }
            };
        }
        
        // 触发帧变化事件
        eventBus.emit(EVENTS.ANNOTATION_FRAME_CHANGED, {
            videoPath: currentVideoPath,
            frameIndex: currentFrameIndex,
            totalFrames: totalFrames
        });
        
    } catch (error) {
        console.error(`加载第 ${index + 1} 帧失败:`, error);
        showToast(`加载第 ${index + 1} 帧失败`, 'error');
    }
}

/**
 * 使用标注数据初始化状态
 * 从 app.js:3458 迁移
 */
function initAnnotationStateWithData(annotations) {
    const labels = appState.getState('labels') || [];
    
    // 转换服务器数据为标注状态格式
    const objectsData = annotations.map((ann, index) => ({
        id: index + 1,
        classId: ann.classId,
        color: getColorForLabel(ann.classId, labels),
        points: [],
        maskData: ann.maskData,
        boxData: calculateBoxData(ann.maskData),
        isVisible: true
    }));
    
    // 使用annotation-state模块的加载功能
    loadAnnotationFromData({ objects: objectsData });
    
    // 渲染侧边栏
    renderSidebar();
    
    // 确保标注被绘制
    setTimeout(() => {
        redrawAll();
    }, 100);
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
 * 计算边界框数据
 */
function calculateBoxData(maskData) {
    if (!maskData || maskData.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    maskData[0].forEach(p => {
        const x = Array.isArray(p) ? p[0] : p.x;
        const y = Array.isArray(p) ? p[1] : p.y;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    });
    
    return [minX, minY, maxX, maxY];
}

/**
 * 设置Canvas并重绘
 */
function setupCanvasAndRedraw() {
    if (!displayImage || !canvas) return;
    
    // 使用图像容器的实际尺寸作为Canvas尺寸
    const container = displayImage.parentElement;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    // 设置Canvas尺寸以覆盖整个容器
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    // 计算图像在Canvas中的实际显示区域
    const displayRect = getImageDisplayRect();
    
    // 计算图像尺寸信息
    const imageDimensions = {
        width: containerWidth,
        height: containerHeight,
        naturalWidth: displayImage.naturalWidth,
        naturalHeight: displayImage.naturalHeight,
        // 使用实际显示宽度计算缩放比例
        ratio: displayImage.naturalWidth / displayRect.width
    };
    
    // 设置图像尺寸到canvas模块
    setImageDimensions(imageDimensions);
    
    // 重绘所有内容
    redrawAll();
}

/**
 * 获取图像显示区域（简化版，实际在canvas模块中）
 */
function getImageDisplayRect() {
    if (!displayImage || !canvas) {
        return { x: 0, y: 0, width: canvas?.width || 0, height: canvas?.height || 0 };
    }
    
    const containerAspect = canvas.width / canvas.height;
    const imageAspect = displayImage.naturalWidth / displayImage.naturalHeight;
    
    let displayWidth, displayHeight, displayX, displayY;
    
    if (imageAspect > containerAspect) {
        // 图像更宽，以宽度为准
        displayWidth = canvas.width;
        displayHeight = canvas.width / imageAspect;
        displayX = 0;
        displayY = (canvas.height - displayHeight) / 2;
    } else {
        // 图像更高，以高度为准
        displayHeight = canvas.height;
        displayWidth = canvas.height * imageAspect;
        displayX = (canvas.width - displayWidth) / 2;
        displayY = 0;
    }
    
    return { 
        x: displayX, 
        y: displayY, 
        width: displayWidth, 
        height: displayHeight 
    };
}

/**
 * 更新帧计数器
 */
function updateFrameCounter() {
    if (!frameCounter) return;
    
    const appMode = appState.getState('appMode');
    
    if (appMode === 'review') {
        // 审核模式由review模块处理
        eventBus.emit('review:update-counter');
    } else {
        // 标注模式
        frameCounter.textContent = `${currentFrameIndex + 1} / ${totalFrames}`;
    }
}

/**
 * 使帧计数器可编辑（跳转到指定帧）
 */
function makeFrameCounterEditable() {
    if (!frameCounter) return;
    
    const currentText = frameCounter.textContent;
    const currentFrameNum = currentFrameIndex + 1;
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = 'number';
    input.min = 1;
    input.max = totalFrames;
    input.value = currentFrameNum;
    input.className = 'frame-jump-input';
    
    // 替换文本为输入框
    frameCounter.innerHTML = '';
    frameCounter.appendChild(input);
    input.focus();
    input.select();
    
    // 处理跳转
    const handleJump = () => {
        const targetFrame = parseInt(input.value, 10);
        
        if (isNaN(targetFrame) || targetFrame < 1 || targetFrame > totalFrames) {
            showToast(`请输入 1-${totalFrames} 之间的帧号`, 'error');
            frameCounter.textContent = currentText;
            return;
        }
        
        // 跳转到目标帧
        loadFrame(targetFrame - 1);
        frameCounter.textContent = currentText;
    };
    
    // Enter键跳转
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleJump();
        } else if (e.key === 'Escape') {
            frameCounter.textContent = currentText;
        }
    });
    
    // 失去焦点时恢复
    input.addEventListener('blur', () => {
        frameCounter.textContent = currentText;
    });
}

/**
 * 选择视频/任务
 * 从 app.js:3503 迁移
 */
export async function selectVideo(videoPath, initialTotalFrames, taskType = 'video') {
    const currentUser = appState.getState('currentUser');
    
    // 保存当前任务的间隔帧数设置
    if (currentVideoPath && skipFramesInput) {
        taskSkipFrames[currentVideoPath] = parseInt(skipFramesInput.value) || 1;
    }
    
    // 清除审核模式的上下文（防止状态残留）
    appState.setState('reviewContext', {
        basePath: '',
        currentPage: 1,
        pageSize: 60,
        totalImages: 0
    });
    
    // 立即清除当前显示的图像和标注
    if (displayImage) {
        displayImage.src = '';
    }
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    initAnnotationState();
    
    editingFilePath = null;
    currentVideoPath = videoPath;
    currentFrameIndex = 0;
    totalFrames = initialTotalFrames || 0;
    
    try {
        // 从任务列表中获取项目信息
        let taskProject = null;
        const taskListResponse = await fetch(`/api/browse?user=${currentUser}`);
        const taskListData = await taskListResponse.json();
        
        if (taskListResponse.ok) {
            const allTasks = [...(taskListData.files || []), ...(taskListData.directories || [])];
            const currentTask = allTasks.find(task => task.path === videoPath);
            if (currentTask && currentTask.project) {
                taskProject = currentTask.project;
                appState.setState('currentProject', taskProject);
                eventBus.emit(EVENTS.PROJECT_SELECTED, taskProject);
            }
        }
        
        // 加载项目标签
        await loadLabels();
        
        // 检查视频抽帧信息
        let startFrameIndex = 0;
        if (taskType === 'video') {
            const extractionInfoResponse = await fetch(`/api/video/extraction_info?user=${currentUser}&video_path=${encodeURIComponent(videoPath)}`);
            const extractionInfoData = await extractionInfoResponse.json();
            
            if (extractionInfoResponse.ok && extractionInfoData.extraction_info) {
                const extractedCount = extractionInfoData.extraction_info.extracted_frame_count || 0;
                if (extractedCount > 0) {
                    totalFrames = extractedCount;
                }
            }
        }
        
        // 获取最后标注的帧（自动定位）
        const lastAnnotatedFrameResponse = await fetch(`/api/task/last_annotated_frame?user=${currentUser}&task_path=${encodeURIComponent(videoPath)}`);
        const lastAnnotatedFrameData = await lastAnnotatedFrameResponse.json();
        
        if (lastAnnotatedFrameResponse.ok && lastAnnotatedFrameData.last_frame_index >= 0) {
            startFrameIndex = lastAnnotatedFrameData.last_frame_index;
        }
        
        // 切换到标注UI
        showAnnotationUI();
        
        // 恢复该任务之前的间隔帧数设置
        if (skipFramesInput) {
            const savedSkipFrames = taskSkipFrames[videoPath] || 1;
            skipFramesInput.value = savedSkipFrames;
            currentTaskSkipFrames = savedSkipFrames;
        }
        
        // 确保起始帧索引不超过总帧数
        if (totalFrames > 0 && startFrameIndex >= totalFrames) {
            startFrameIndex = Math.max(0, totalFrames - 1);
        }
        
        // 加载起始帧
        await loadFrame(startFrameIndex, true);
        
    } catch (error) {
        console.error('选择视频失败:', error);
        showToast('加载任务失败', 'error');
        
        // 出错时尝试加载第一帧
        showAnnotationUI();
        if (skipFramesInput) {
            skipFramesInput.value = 1;
            currentTaskSkipFrames = 1;
        }
        await loadFrame(0, true);
    }
}

/**
 * 显示标注UI
 */
function showAnnotationUI() {
    const videoSelection = document.getElementById('video-selection');
    const annotationUI = document.getElementById('annotation-ui');
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    
    // 隐藏任务列表
    if (videoSelection) {
        videoSelection.classList.add('hidden');
    }
    
    // 显示标注界面
    if (annotationUI) {
        annotationUI.classList.remove('hidden');
    }
    
    // 隐藏侧边栏，扩大内容区域
    if (mainSidebar) mainSidebar.classList.add('hidden');
    if (mainContentArea) mainContentArea.classList.add('full-width');
    if (sidebarCollapsedHeader) sidebarCollapsedHeader.classList.add('hidden');
    
    // 启用帧导航按钮
    if (prevFrameBtn) prevFrameBtn.disabled = false;
    if (nextFrameBtn) nextFrameBtn.disabled = false;
    if (skipFramesInput) skipFramesInput.disabled = false;
    
    // 恢复标注模式按钮显示，隐藏审核模式按钮
    const resetBtn = document.getElementById('reset-btn');
    const saveSuccessBtn = document.getElementById('save-success-btn');
    const addObjectBtn = document.getElementById('add-object-btn');
    const autoAnnotateBtn = document.getElementById('auto-annotate-btn');
    const modifyBtn = document.getElementById('modify-btn');
    const cancelModifyBtn = document.getElementById('cancel-modify-btn');
    
    [resetBtn, saveSuccessBtn, addObjectBtn, autoAnnotateBtn].forEach(el => {
        if (el) el.style.display = '';
    });
    
    if (modifyBtn) modifyBtn.classList.add('hidden');
    if (cancelModifyBtn) cancelModifyBtn.classList.add('hidden');
    
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) deleteBtn.classList.add('hidden');
    
    // 恢复 canvas 点击事件（审核模式会禁用，标注模式需要启用）
    const canvas = document.getElementById('point-canvas');
    if (canvas) canvas.style.pointerEvents = 'auto';
    
    console.log('[annotation-frame] Annotation UI shown, sidebar hidden');
}

/**
 * 获取当前帧信息
 */
export function getCurrentFrameInfo() {
    return {
        videoPath: currentVideoPath,
        frameIndex: currentFrameIndex,
        totalFrames: totalFrames,
        editingFilePath: editingFilePath
    };
}

/**
 * 设置编辑文件路径（用于审核模式）
 */
export function setEditingFilePath(path) {
    editingFilePath = path;
}

/**
 * 获取编辑文件路径
 */
export function getEditingFilePath() {
    return editingFilePath;
}

/**
 * 设置当前视频路径
 */
export function setCurrentVideoPath(path) {
    currentVideoPath = path;
}

/**
 * 获取当前视频路径
 */
export function getCurrentVideoPath() {
    return currentVideoPath;
}

export {
    setupCanvasAndRedraw
};

export default {
    init,
    loadFrame,
    selectVideo,
    getCurrentFrameInfo,
    setEditingFilePath,
    getEditingFilePath,
    setCurrentVideoPath,
    getCurrentVideoPath
};
