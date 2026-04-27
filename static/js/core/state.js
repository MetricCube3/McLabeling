/**
 * 全局状态管理
 * 使用观察者模式实现响应式状态管理
 */

import { log } from './config.js';

class AppState {
    constructor() {
        this.state = {
            // 用户相关
            currentUser: null,
            userRoles: [],
            isAuthenticated: false,
            
            // 应用状态
            appMode: 'login',
            
            // 项目相关
            projects: {},
            currentProject: null,
            
            // 标签相关
            labels: [],
            
            // 任务相关
            currentTask: null,
            taskSkipFrames: {},
            currentTaskSkipFrames: 1,
            
            // 标注相关
            annotationState: {},
            currentFrameIndex: 0,
            totalFrames: 0,
            
            // 审核相关
            reviewContext: {
                basePath: '',
                fileList: [],
                currentIndex: -1,
                currentPage: 1,
                totalImages: 0
            },
            
            // 分页状态
            pagination: {
                dataset: { currentPage: 1, pageSize: 10, totalPages: 1 },
                task: { currentPage: 1, pageSize: 20, totalPages: 1 },
                review: { currentPage: 1, pageSize: 60, totalPages: 1 }
            },
            
            // 过滤状态
            filters: {
                status: 'all',
                user: '',
                project: ''
            },
            
            // UI状态
            isSidebarCollapsed: false,
            isLoading: false
        };
        
        // 状态订阅者
        this.listeners = {};
        
        // 状态变更历史（用于调试）
        this.history = [];
    }
    
    /**
     * 获取状态值
     * @param {string} key - 状态键名，支持点号访问嵌套属性，如 'pagination.dataset.currentPage'
     * @returns {*} 状态值
     */
    getState(key) {
        if (!key) return this.state;
        
        const keys = key.split('.');
        let value = this.state;
        
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return undefined;
            }
        }
        
        return value;
    }
    
    /**
     * 设置状态值
     * @param {string} key - 状态键名，支持点号设置嵌套属性
     * @param {*} value - 状态值
     */
    setState(key, value) {
        const oldValue = this.getState(key);
        
        // 设置值
        const keys = key.split('.');
        let target = this.state;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!target[k] || typeof target[k] !== 'object') {
                target[k] = {};
            }
            target = target[k];
        }
        
        target[keys[keys.length - 1]] = value;
        
        // 记录历史
        this.history.push({
            timestamp: Date.now(),
            key,
            oldValue,
            newValue: value
        });
        
        // 通知订阅者
        this.notify(key, value, oldValue);
        
        log(`State updated: ${key}`, value);
    }
    
    /**
     * 批量更新状态
     * @param {Object} updates - 键值对对象
     */
    batchUpdate(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.setState(key, value);
        });
    }
    
    /**
     * 订阅状态变化
     * @param {string} key - 状态键名
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        
        this.listeners[key].push(callback);
        
        // 返回取消订阅函数
        return () => {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        };
    }
    
    /**
     * 通知订阅者
     * @param {string} key - 状态键名
     * @param {*} newValue - 新值
     * @param {*} oldValue - 旧值
     */
    notify(key, newValue, oldValue) {
        if (this.listeners[key]) {
            this.listeners[key].forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    console.error(`Error in state listener for ${key}:`, error);
                }
            });
        }
        
        // 通知通配符订阅者
        if (this.listeners['*']) {
            this.listeners['*'].forEach(callback => {
                try {
                    callback(key, newValue, oldValue);
                } catch (error) {
                    console.error(`Error in wildcard state listener:`, error);
                }
            });
        }
    }
    
    /**
     * 重置状态
     * @param {string} key - 要重置的状态键名，不传则重置所有
     */
    reset(key) {
        if (key) {
            this.setState(key, this.getDefaultValue(key));
        } else {
            // 重置所有状态（保留用户信息）
            const userInfo = {
                currentUser: this.state.currentUser,
                userRoles: this.state.userRoles,
                isAuthenticated: this.state.isAuthenticated
            };
            
            this.state = { ...new AppState().state, ...userInfo };
            this.notify('*', this.state, null);
        }
    }
    
    /**
     * 获取默认值（用于重置）
     */
    getDefaultValue(key) {
        const defaultState = new AppState().state;
        return this.getStateFromObject(defaultState, key);
    }
    
    /**
     * 从对象中获取嵌套属性
     */
    getStateFromObject(obj, key) {
        const keys = key.split('.');
        let value = obj;
        
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return undefined;
            }
        }
        
        return value;
    }
    
    /**
     * 获取状态变更历史
     * @param {number} limit - 返回最近的记录数
     */
    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }
    
    /**
     * 清空历史
     */
    clearHistory() {
        this.history = [];
    }
}

// 创建全局状态实例
export const appState = new AppState();

// 导出状态管理类（用于测试或创建新实例）
export default AppState;
