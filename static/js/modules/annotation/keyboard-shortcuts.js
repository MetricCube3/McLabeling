/**
 * 快捷键模块
 * 处理全局键盘快捷键
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { showToast } from '../../utils/toast.js';
import { addNewObject } from './annotation-state.js';
import { getCurrentDrawMode, DRAW_MODE } from './draw-mode.js';
import { cancelDrawing, isDrawing } from './manual-draw.js';

// 防止重复初始化的标志
let isInitialized = false;

// DOM元素
let prevFrameBtn = null;
let nextFrameBtn = null;
let saveSuccessBtn = null;
let resetBtn = null;
let backToListBtn = null;
let annotationUI = null;

/**
 * 快捷键映射配置
 */
const SHORTCUTS = {
    PREV_FRAME: ['ArrowLeft', 'a', 'A'],
    NEXT_FRAME: ['ArrowRight', 'd', 'D'],
    SAVE: ['s', 'S'],
    SAVE_CTRL: 's',  // Ctrl+S
    RESET: ['r', 'R'],
    RESET_CTRL: 'r',  // Ctrl+R
    BACK: ['Escape'],
    ADD_OBJECT: ['x', 'X']  // 添加新标注
};

/**
 * 初始化快捷键模块
 */
export function init() {
    console.log('[keyboard-shortcuts] Initializing...');
    
    // 防止重复初始化
    if (isInitialized) {
        console.log('[keyboard-shortcuts] Already initialized, skipping...');
        return;
    }
    
    // 获取DOM元素
    prevFrameBtn = document.getElementById('prev-frame-btn');
    nextFrameBtn = document.getElementById('next-frame-btn');
    saveSuccessBtn = document.getElementById('save-success-btn');
    resetBtn = document.getElementById('reset-btn');
    backToListBtn = document.getElementById('back-to-list-btn');
    annotationUI = document.getElementById('annotation-ui');
    
    // 注册全局快捷键监听
    setupGlobalShortcuts();
    
    isInitialized = true;
    console.log('[keyboard-shortcuts] Initialization complete');
}

/**
 * 设置全局快捷键
 * 从 app.js:6647 迁移
 */
function setupGlobalShortcuts() {
    // 移除旧的监听器并添加新的（防止重复绑定）
    document.removeEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleKeyDown);
    console.log('[keyboard-shortcuts] Global shortcuts registered');
}

/**
 * 处理键盘按下事件
 */
function handleKeyDown(e) {
    const appMode = appState.getState('appMode');
    
    // 只在标注或审核模式下启用快捷键
    if (appMode !== 'annotate' && appMode !== 'review') {
        return;
    }
    
    // 如果正在输入文本（input、textarea、select），不触发快捷键
    const activeElement = document.activeElement;
    if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.tagName === 'SELECT'
    )) {
        return;
    }
    
    // 上一帧：左箭头 或 A 键
    if (SHORTCUTS.PREV_FRAME.includes(e.key)) {
        e.preventDefault();
        if (prevFrameBtn) {
            prevFrameBtn.click();
        }
        return;
    }
    
    // 下一帧：右箭头 或 D 键
    if (SHORTCUTS.NEXT_FRAME.includes(e.key)) {
        e.preventDefault();
        if (nextFrameBtn) {
            nextFrameBtn.click();
        }
        return;
    }
    
    // 保存：Ctrl+S 或 S 键
    if ((e.ctrlKey && e.key === SHORTCUTS.SAVE_CTRL) || SHORTCUTS.SAVE.includes(e.key)) {
        e.preventDefault();
        // 检查保存按钮是否可见且可用
        if (saveSuccessBtn && saveSuccessBtn.style.display !== 'none' && !saveSuccessBtn.disabled) {
            saveSuccessBtn.click();
        }
        return;
    }
    
    // 清空当前帧标注：Ctrl+R 或 R 键
    if ((e.ctrlKey && e.key === SHORTCUTS.RESET_CTRL) || SHORTCUTS.RESET.includes(e.key)) {
        e.preventDefault();
        // 检查清空按钮是否可见且可用
        if (resetBtn && resetBtn.style.display !== 'none' && !resetBtn.disabled) {
            resetBtn.click();
        }
        return;
    }
    
    // 返回任务列表或取消绘制：ESC 键
    if (SHORTCUTS.BACK.includes(e.key)) {
        e.preventDefault();
        
        // 如果正在绘制多边形，优先取消绘制
        const mode = getCurrentDrawMode();
        if ((mode === DRAW_MODE.POLYGON || mode === DRAW_MODE.RECTANGLE) && isDrawing()) {
            cancelDrawing();
            showToast('已取消绘制', 'info');
            return;
        }
        
        // 否则返回任务列表
        if (backToListBtn && annotationUI && !annotationUI.classList.contains('hidden')) {
            backToListBtn.click();
        }
        return;
    }
    
    // 添加新标注：X 键
    if (SHORTCUTS.ADD_OBJECT.includes(e.key)) {
        e.preventDefault();
        // 只在标注模式下允许添加
        if (appMode === 'annotate' && annotationUI && !annotationUI.classList.contains('hidden')) {
            console.log('[keyboard-shortcuts] X key pressed - adding new annotation');
            addNewObject();
        }
        return;
    }
}

/**
 * 获取快捷键说明
 */
export function getShortcutsHelp() {
    return [
        { keys: '← 或 A', description: '上一帧' },
        { keys: '→ 或 D', description: '下一帧' },
        { keys: 'S 或 Ctrl+S', description: '保存标注' },
        { keys: 'R 或 Ctrl+R', description: '清空当前帧' },
        { keys: 'X', description: '添加新标注' },
        { keys: 'M', description: 'SAM模式' },
        { keys: 'B', description: '矩形框模式' },
        { keys: 'P', description: '多边形模式' },
        { keys: 'ESC', description: '取消绘制 / 返回列表' }
    ];
}

/**
 * 显示快捷键帮助
 */
export function showShortcutsHelp() {
    const shortcuts = getShortcutsHelp();
    const helpText = shortcuts.map(s => `${s.keys}: ${s.description}`).join('\n');
    showToast(`快捷键帮助:\n${helpText}`, 'info');
}

/**
 * 禁用快捷键（例如在模态框打开时）
 */
export function disableShortcuts() {
    document.removeEventListener('keydown', handleKeyDown);
}

/**
 * 重新启用快捷键
 */
export function enableShortcuts() {
    document.removeEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleKeyDown);
}

/**
 * 检查某个键是否为快捷键
 */
export function isShortcutKey(key, ctrlKey = false) {
    // 检查是否为任何快捷键
    for (const shortcutKeys of Object.values(SHORTCUTS)) {
        if (Array.isArray(shortcutKeys) && shortcutKeys.includes(key)) {
            return true;
        }
        if (typeof shortcutKeys === 'string' && shortcutKeys === key && ctrlKey) {
            return true;
        }
    }
    return false;
}

export default {
    init,
    getShortcutsHelp,
    showShortcutsHelp,
    disableShortcuts,
    enableShortcuts,
    isShortcutKey
};
