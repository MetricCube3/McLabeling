/**
 * 事件总线
 * 用于模块间通信，实现发布-订阅模式
 */

import { log } from './config.js';

class EventBus {
    constructor() {
        this.events = {};
    }
    
    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @param {Object} options - 选项 { once: boolean, priority: number }
     * @returns {Function} 取消订阅函数
     */
    on(event, callback, options = {}) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        
        const listener = {
            callback,
            once: options.once || false,
            priority: options.priority || 0
        };
        
        this.events[event].push(listener);
        
        // 按优先级排序（优先级高的先执行）
        this.events[event].sort((a, b) => b.priority - a.priority);
        
        log(`Event subscribed: ${event}`);
        
        // 返回取消订阅函数
        return () => this.off(event, callback);
    }
    
    /**
     * 订阅一次性事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    once(event, callback) {
        return this.on(event, callback, { once: true });
    }
    
    /**
     * 取消订阅事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数（不传则取消该事件所有订阅）
     */
    off(event, callback) {
        if (!this.events[event]) return;
        
        if (callback) {
            this.events[event] = this.events[event].filter(
                listener => listener.callback !== callback
            );
        } else {
            delete this.events[event];
        }
        
        log(`Event unsubscribed: ${event}`);
    }
    
    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (!this.events[event]) return;
        
        log(`Event emitted: ${event}`, data);
        
        // 创建副本以避免在回调中修改数组导致问题
        const listeners = [...this.events[event]];
        
        listeners.forEach(listener => {
            try {
                listener.callback(data);
                
                // 如果是一次性事件，执行后移除
                if (listener.once) {
                    this.off(event, listener.callback);
                }
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }
    
    /**
     * 清空所有事件监听器
     */
    clear() {
        this.events = {};
        log('All events cleared');
    }
    
    /**
     * 获取事件的订阅者数量
     * @param {string} event - 事件名称
     * @returns {number}
     */
    getListenerCount(event) {
        return this.events[event] ? this.events[event].length : 0;
    }
    
    /**
     * 获取所有已注册的事件名称
     * @returns {string[]}
     */
    getEventNames() {
        return Object.keys(this.events);
    }
}

// 创建全局事件总线实例
export const eventBus = new EventBus();

// 预定义事件名称（便于IDE自动补全和避免拼写错误）
export const EVENTS = {
    // 用户相关
    USER_LOGIN: 'user:login',
    USER_LOGGED_IN: 'user:logged-in',
    USER_LOGOUT: 'user:logout',
    USER_LOGGED_OUT: 'user:logged-out',
    USER_AUTH_CHANGED: 'user:auth-changed',
    
    // 模式切换
    MODE_CHANGED: 'mode:changed',
    MODE_BEFORE_CHANGE: 'mode:before-change',
    
    // 项目相关
    PROJECT_CREATED: 'project:created',
    PROJECT_DELETED: 'project:deleted',
    PROJECT_SELECTED: 'project:selected',
    PROJECT_LIST_UPDATED: 'project:list-updated',
    
    // 标签相关
    LABEL_ADDED: 'label:added',
    LABEL_UPDATED: 'label:updated',
    LABEL_DELETED: 'label:deleted',
    LABEL_LIST_UPDATED: 'label:list-updated',
    
    // 任务相关
    TASK_ASSIGNED: 'task:assigned',
    TASK_UNASSIGNED: 'task:unassigned',
    TASK_STARTED: 'task:started',
    TASK_COMPLETED: 'task:completed',
    TASK_LIST_UPDATED: 'task:list-updated',
    
    // 标注相关
    ANNOTATION_SAVED: 'annotation:saved',
    ANNOTATION_LOADED: 'annotation:loaded',
    ANNOTATION_OBJECT_ADDED: 'annotation:object-added',
    ANNOTATION_OBJECT_DELETED: 'annotation:object-deleted',
    ANNOTATION_FRAME_CHANGED: 'annotation:frame-changed',
    ANNOTATION_STATE_CHANGED: 'annotation:state-changed',
    ANNOTATION_ACTIVE_OBJECT_CHANGED: 'annotation:active-object-changed',
    ANNOTATION_OBJECT_HOVERED: 'annotation:object-hovered',
    ANNOTATION_LIST_HOVERED: 'annotation:list-hovered',
    
    // 模型相关
    MODEL_UPLOADED: 'model:uploaded',
    MODEL_DELETED: 'model:deleted',
    MODEL_ACTIVATED: 'model:activated',
    MODEL_TRAIN_STARTED: 'model:train-started',
    MODEL_TRAIN_STOPPED: 'model:train-stopped',
    MODEL_TRAIN_COMPLETED: 'model:train-completed',
    
    // 导出相关
    DATA_EXPORTED: 'data:exported',
    EXPORT_STARTED: 'export:started',
    EXPORT_COMPLETED: 'export:completed',
    
    // UI相关
    SIDEBAR_TOGGLED: 'ui:sidebar-toggled',
    TOAST_SHOW: 'ui:toast-show',
    MODAL_SHOW: 'ui:modal-show',
    MODAL_CLOSE: 'ui:modal-close',
    LOADING_START: 'ui:loading-start',
    LOADING_END: 'ui:loading-end',
    
    // 数据相关
    DATA_UPLOADED: 'data:uploaded',
    DATA_DELETED: 'data:deleted',
    DATASET_LIST_UPDATED: 'dataset:list-updated'
};

// 导出EventBus类（用于测试或创建新实例）
export default EventBus;
