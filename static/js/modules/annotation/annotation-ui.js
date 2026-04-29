/**
 * 标注界面模块
 * 处理标注界面的UI交互
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { init as initReviewList, browse } from '../review/review-list.js';
import { selectVideo, init as initAnnotationFrame } from './annotation-frame.js';
import { init as initAnnotationCanvas } from './annotation-canvas.js';
import { init as initAnnotationSidebar } from './annotation-sidebar.js';
import { init as initAnnotationSave } from './annotation-save.js';
import { init as initAnnotationState, addNewObject, initAnnotationState as clearCurrentFrame } from './annotation-state.js';
import { init as initKeyboardShortcuts } from './keyboard-shortcuts.js';
import { init as initAutoAnnotate } from './auto-annotate.js';
import { init as initDrawMode } from './draw-mode.js';
import { init as initManualDraw } from './manual-draw.js';
import { redrawAll } from './annotation-canvas.js';
import { renderSidebar } from './annotation-sidebar.js';

// 防止重复初始化的标志
let isInitialized = false;

// 事件处理函数引用（用于移除监听器）
let addObjectBtnHandler = null;
let backBtnHandler = null;
let resetBtnHandler = null;

/**
 * 初始化标注界面模块
 */
export function init() {
    console.log('[annotation-ui] Initializing...');
    
    // 防止重复初始化
    if (isInitialized) {
        console.log('[annotation-ui] Already initialized, skipping...');
        // 已初始化，只需刷新数据
        setTimeout(() => {
            browse('');
        }, 50);
        return;
    }
    
    // 初始化所有标注子模块（重要：按顺序初始化）
    initAnnotationState();      // 状态管理
    initDrawMode();             // 绘制模式管理
    initManualDraw();           // 手动绘制功能
    initAnnotationCanvas();      // Canvas初始化
    initAnnotationFrame();       // 帧导航和DOM元素
    initAnnotationSidebar();     // 侧边栏
    initAnnotationSave();        // 保存功能
    initAutoAnnotate();          // 自动标注
    initKeyboardShortcuts();     // 键盘快捷键
    
    setupAnnotationUI();
    setupEventListeners();
    
    // 初始化审核列表模块（用于浏览功能）
    initReviewList();
    
    isInitialized = true;
    
    console.log('[annotation-ui] Calling browse for annotate mode...');
    // 使用 setTimeout 确保 DOM 已就绪
    setTimeout(() => {
        browse('');
    }, 50);
}

/**
 * 设置标注界面
 */
function setupAnnotationUI() {
    console.log('[annotation-ui] Setting up annotation UI...');
    
    // 定义事件处理函数
    backBtnHandler = () => {
        returnToList();
    };
    
    addObjectBtnHandler = () => {
        console.log('[annotation-ui] Add object button clicked');
        addNewObject();
    };
    
    resetBtnHandler = () => {
        console.log('[annotation-ui] Reset button clicked - clearing current frame');
        clearCurrentFrame();
        redrawAll();
        renderSidebar();
        showToast('已清空当前帧标注', 'info');
    };
    
    // 设置返回按钮（先移除旧监听器）
    const backBtn = document.getElementById('back-to-list-btn');
    if (backBtn) {
        backBtn.removeEventListener('click', backBtnHandler);
        backBtn.addEventListener('click', backBtnHandler);
    }
    
    // 设置添加新实例按钮（先移除旧监听器）
    const addObjectBtn = document.getElementById('add-object-btn');
    if (addObjectBtn) {
        addObjectBtn.removeEventListener('click', addObjectBtnHandler);
        addObjectBtn.addEventListener('click', addObjectBtnHandler);
    }
    
    // 设置清空按钮（先移除旧监听器）
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.removeEventListener('click', resetBtnHandler);
        resetBtn.addEventListener('click', resetBtnHandler);
    }
    
    // 其他UI初始化...
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 监听任务选择事件
    eventBus.on('annotation:select-task', handleTaskSelection);
    
    console.log('[annotation-ui] Event listeners set up');
}

/**
 * 处理任务选择
 */
async function handleTaskSelection(taskData) {
    console.log('[annotation-ui] Task selected:', taskData);
    
    try {
        // 先通过事件触发模式切换（避免循环依赖）
        eventBus.emit('ui:switch-mode', 'annotate');
        
        // 等待一小段时间让模式切换完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 然后加载任务
        await selectVideo(
            taskData.path,
            taskData.totalFrames || 0,
            taskData.type || 'image'
        );
    } catch (error) {
        console.error('[annotation-ui] Failed to load task:', error);
        showToast(`加载任务失败: ${error.message}`, 'error');
    }
}

/**
 * 返回列表
 */
function returnToList() {
    console.log('[annotation-ui] Returning to list...');
    
    // 隐藏标注界面
    const annotationUI = document.getElementById('annotation-ui');
    const videoSelection = document.getElementById('video-selection');
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    
    if (annotationUI) {
        annotationUI.classList.add('hidden');
    }
    
    if (videoSelection) {
        videoSelection.classList.remove('hidden');
    }
    
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
    
    // 判断返回路径：审核模式返回图像列表，标注模式返回任务列表
    const appMode = appState.getState('appMode');
    const reviewContext = appState.getState('reviewContext');
    const returnPath = (appMode === 'review' && reviewContext?.basePath) ? reviewContext.basePath : '';
    
    // 重新加载列表
    browse(returnPath);
    
    const returnMessage = appMode === 'review' ? '已返回图像列表' : '已返回任务列表';
    showToast(returnMessage, 'info');
}

export default {
    init
};
