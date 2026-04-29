/**
 * 绘制模式管理模块
 * 管理SAM、矩形框、多边形三种绘制模式
 */

import { eventBus, EVENTS } from '../../core/event-bus.js';

// 绘制模式枚举
export const DRAW_MODE = {
    SAM: 'sam',
    RECTANGLE: 'rectangle',
    POLYGON: 'polygon'
};

// 当前绘制模式
let currentDrawMode = DRAW_MODE.SAM;

/**
 * 初始化绘制模式模块
 */
export function init() {
    setupModeButtons();
    setupKeyboardShortcuts();
}

/**
 * 设置模式切换按钮
 */
function setupModeButtons() {
    const samBtn = document.getElementById('sam-mode-btn');
    const rectBtn = document.getElementById('rect-mode-btn');
    const polygonBtn = document.getElementById('polygon-mode-btn');
    
    if (samBtn) {
        samBtn.addEventListener('click', () => setDrawMode(DRAW_MODE.SAM));
    }
    
    if (rectBtn) {
        rectBtn.addEventListener('click', () => setDrawMode(DRAW_MODE.RECTANGLE));
    }
    
    if (polygonBtn) {
        polygonBtn.addEventListener('click', () => setDrawMode(DRAW_MODE.POLYGON));
    }
}

/**
 * 设置快捷键
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 只在标注界面激活时响应
        const annotationUI = document.getElementById('annotation-ui');
        if (!annotationUI || annotationUI.classList.contains('hidden')) {
            return;
        }
        
        // 避免在输入框中触发
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        switch(e.key.toLowerCase()) {
            case 'm':
                setDrawMode(DRAW_MODE.SAM);
                e.preventDefault();
                break;
            case 'b':
                setDrawMode(DRAW_MODE.RECTANGLE);
                e.preventDefault();
                break;
            case 'p':
                setDrawMode(DRAW_MODE.POLYGON);
                e.preventDefault();
                break;
        }
    });
}

/**
 * 设置绘制模式
 */
export function setDrawMode(mode) {
    if (currentDrawMode === mode) return;
    
    currentDrawMode = mode;
    updateModeButtons();
    
    // 触发模式变化事件
    eventBus.emit('draw-mode:changed', mode);
}

/**
 * 获取当前绘制模式
 */
export function getCurrentDrawMode() {
    return currentDrawMode;
}

/**
 * 更新模式按钮状态
 */
function updateModeButtons() {
    const buttons = {
        [DRAW_MODE.SAM]: document.getElementById('sam-mode-btn'),
        [DRAW_MODE.RECTANGLE]: document.getElementById('rect-mode-btn'),
        [DRAW_MODE.POLYGON]: document.getElementById('polygon-mode-btn')
    };
    
    Object.entries(buttons).forEach(([mode, btn]) => {
        if (btn) {
            if (mode === currentDrawMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

export default {
    init,
    setDrawMode,
    getCurrentDrawMode,
    DRAW_MODE
};
