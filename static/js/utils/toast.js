/**
 * Toast消息提示工具
 * 显示临时提示消息
 * 从 app.js 迁移而来
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

let toastElement = null;
let toastTimer = null;

/**
 * 初始化Toast元素
 */
function initToast() {
    if (toastElement) return;
    
    toastElement = document.getElementById('toast-notification');
    
    if (!toastElement) {
        console.error('Toast notification element not found');
    }
}

/**
 * 显示Toast消息
 * 优化后的版本，增强淡出效果
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型：success, error, warning, info
 */
export function showToast(message, type = 'info') {
    initToast();
    
    if (!toastElement) return;
    
    // 清除之前的定时器
    if (toastTimer) clearTimeout(toastTimer);

    // 移除淡出类，确保Toast处于正常状态
    toastElement.classList.remove('fade-out');

    // 设置消息内容和类型
    toastElement.textContent = message;

    // 移除所有类型类，添加当前类型
    toastElement.classList.remove('success', 'error', 'warning', 'info');
    toastElement.classList.add(type);

    // 确保Toast完全可见
    toastElement.style.display = 'block';

    // 强制重绘，确保过渡效果生效
    void toastElement.offsetWidth;

    // 添加show类触发入场动画
    toastElement.classList.add('show');

    // 根据类型设置不同的延迟时间
    let delayTime;
    switch(type) {
        case 'info':
        case 'success':
            delayTime = 1500; // 1.5秒
            break;
        case 'error':
        case 'warning':
            delayTime = 3000; // 3秒
            break;
        default:
            delayTime = 2000; // 默认2秒
    }

    // 触发事件
    eventBus.emit(EVENTS.TOAST_SHOW, { message, type, delayTime });

    // 设置定时器，在指定时间后开始淡出
    toastTimer = setTimeout(() => {
        // 添加淡出类触发淡出动画
        toastElement.classList.add('fade-out');

        // 等待淡出动画完成后完全隐藏
        setTimeout(() => {
            toastElement.style.display = 'none';
            toastElement.classList.remove('show', 'fade-out', 'success', 'error', 'warning', 'info');
        }, 600); // 这个时间需要与CSS中的淡出过渡时间匹配
    }, delayTime);
}

/**
 * 隐藏Toast消息
 */
export function hideToast() {
    if (!toastElement) return;
    
    // 添加淡出效果
    toastElement.classList.add('fade-out');
    
    // 等待动画完成后移除显示类
    setTimeout(() => {
        toastElement.classList.remove('show', 'fade-out');
    }, 600); // 与CSS过渡时间一致
    
    // 清除定时器
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
}

/**
 * 显示成功消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长
 */
export function showSuccess(message, duration) {
    showToast(message, 'success', duration);
}

/**
 * 显示错误消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长
 */
export function showError(message, duration) {
    showToast(message, 'error', duration);
}

/**
 * 显示警告消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长
 */
export function showWarning(message, duration) {
    showToast(message, 'warning', duration);
}

/**
 * 显示信息消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长
 */
export function showInfo(message, duration) {
    showToast(message, 'info', duration);
}

export default {
    show: showToast,
    hide: hideToast,
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo
};
