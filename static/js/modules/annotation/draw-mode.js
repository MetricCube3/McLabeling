/**
 * 绘制模式管理模块
 * 管理SAM、矩形框、多边形三种绘制模式
 */

import { eventBus, EVENTS } from '../../core/event-bus.js';
import { getAnnotationState } from './annotation-state.js';

// 绘制模式枚举
export const DRAW_MODE = {
    SAM: 'sam',
    RECTANGLE: 'rectangle',
    POLYGON: 'polygon',
    OBB: 'obb'
};

// 当前绘制模式
let currentDrawMode = DRAW_MODE.SAM;

/**
 * 初始化绘制模式模块
 */
export function init() {
    setupModeButtons();
    setupKeyboardShortcuts();
    
    // 选定标注对象时自动切换到对应的标注模式
    eventBus.on(EVENTS.ANNOTATION_ACTIVE_OBJECT_CHANGED, handleActiveObjectChanged);
}

/**
 * 设置模式切换按钮
 */
function setupModeButtons() {
    const samBtn = document.getElementById('sam-mode-btn');
    const rectBtn = document.getElementById('rect-mode-btn');
    const polygonBtn = document.getElementById('polygon-mode-btn');
    const obbBtn = document.getElementById('obb-mode-btn');
    
    if (samBtn) {
        samBtn.addEventListener('click', () => setDrawMode(DRAW_MODE.SAM));
    }
    
    if (rectBtn) {
        rectBtn.addEventListener('click', () => setDrawMode(DRAW_MODE.RECTANGLE));
    }
    
    if (polygonBtn) {
        polygonBtn.addEventListener('click', () => setDrawMode(DRAW_MODE.POLYGON));
    }
    
    if (obbBtn) {
        obbBtn.addEventListener('click', () => setDrawMode(DRAW_MODE.OBB));
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
            case 'o':
                setDrawMode(DRAW_MODE.OBB);
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
    
    // 如果当前活动对象尚未标注，同步更新其标注类型
    const annotationState = getAnnotationState();
    const idx = annotationState.activeObjectIndex;
    if (idx !== -1) {
        const obj = annotationState.objects[idx];
        if (obj && !obj.maskData) {
            obj.annotationType = mode;
        }
    }
    
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
        [DRAW_MODE.POLYGON]: document.getElementById('polygon-mode-btn'),
        [DRAW_MODE.OBB]: document.getElementById('obb-mode-btn')
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

/**
 * 处理活动对象变化：自动切换到对应标注模式
 */
function handleActiveObjectChanged(index) {
    if (index === -1) return;
    
    const annotationState = getAnnotationState();
    const obj = annotationState.objects[index];
    if (!obj) return;
    
    // 根据对象的标注类型自动切换绘制模式
    const typeToMode = {
        'sam': DRAW_MODE.SAM,
        'rectangle': DRAW_MODE.RECTANGLE,
        'polygon': DRAW_MODE.POLYGON,
        'obb': DRAW_MODE.OBB
    };
    
    const targetMode = typeToMode[obj.annotationType];
    if (targetMode && targetMode !== currentDrawMode) {
        setDrawMode(targetMode);
    }
}

export default {
    init,
    setDrawMode,
    getCurrentDrawMode,
    DRAW_MODE
};
