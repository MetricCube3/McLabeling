/**
 * 路由管理器
 * 负责应用模式切换和模块动态加载
 */

import { appState } from './state.js';
import { eventBus, EVENTS } from './event-bus.js';
import { APP_CONSTANTS, log } from './config.js';

class Router {
    constructor() {
        this.currentMode = APP_CONSTANTS.MODES.LOGIN;
        this.modules = {};
        this.beforeChangeHandlers = [];
    }
    
    /**
     * 初始化路由
     */
    init() {
        log('Router initialized');
    }
    
    /**
     * 切换应用模式
     * @param {string} mode - 目标模式
     * @param {Object} options - 选项参数
     * @returns {Promise<boolean>} 是否切换成功
     */
    async switchMode(mode, options = {}) {
        log(`Switching mode from ${this.currentMode} to ${mode}`);
        
        // 如果已经是目标模式，直接返回
        if (this.currentMode === mode && !options.force) {
            log(`Already in ${mode} mode`);
            return true;
        }
        
        // 触发切换前事件
        const beforeChangeEvent = {
            from: this.currentMode,
            to: mode,
            cancel: false
        };
        
        eventBus.emit(EVENTS.MODE_BEFORE_CHANGE, beforeChangeEvent);
        
        // 如果被取消，则不切换
        if (beforeChangeEvent.cancel) {
            log(`Mode switch to ${mode} was cancelled`);
            return false;
        }
        
        // 执行切换前的处理器
        for (const handler of this.beforeChangeHandlers) {
            const result = await handler(this.currentMode, mode);
            if (result === false) {
                log(`Mode switch to ${mode} was cancelled by handler`);
                return false;
            }
        }
        
        try {
            // 更新当前模式（先设置状态，因为模块初始化需要用到）
            const previousMode = this.currentMode;
            this.currentMode = mode;
            appState.setState('appMode', mode);
            
            // 隐藏所有UI
            this.hideAllUI();
            
            // 更新UI显示（先显示UI，再加载模块）
            this.updateUI(mode);
            
            // 加载并初始化目标模式的模块
            await this.loadModeModule(mode);
            
            // 触发模式切换事件
            eventBus.emit(EVENTS.MODE_CHANGED, {
                from: previousMode,
                to: mode
            });
            
            log(`Mode switched to ${mode}`);
            return true;
            
        } catch (error) {
            console.error(`Failed to switch to ${mode} mode:`, error);
            return false;
        }
    }
    
    /**
     * 动态加载模式对应的模块
     * @param {string} mode - 模式名称
     */
    async loadModeModule(mode) {
        // 如果模块已加载，直接调用初始化
        if (this.modules[mode]) {
            if (this.modules[mode].init) {
                await this.modules[mode].init();
            }
            return;
        }
        
        // 动态导入模块
        let module;
        
        switch (mode) {
            case APP_CONSTANTS.MODES.ANNOTATE:
                module = await import('../modules/annotation/annotation-ui.js');
                break;
                
            case APP_CONSTANTS.MODES.REVIEW:
                module = await import('../modules/review/review-ui.js');
                break;
                
            case APP_CONSTANTS.MODES.PROJECT_MANAGEMENT:
                module = await import('../modules/project/project-list.js');
                break;
                
            case APP_CONSTANTS.MODES.LABEL_MANAGEMENT:
                module = await import('../modules/label/label-manager.js');
                break;
                
            case APP_CONSTANTS.MODES.DATASET_MANAGEMENT:
                module = await import('../modules/dataset/dataset-list.js');
                break;
                
            case APP_CONSTANTS.MODES.TASK_ASSIGNMENT:
                module = await import('../modules/task/task-assignment.js');
                break;
                
            case APP_CONSTANTS.MODES.MODEL_MANAGEMENT:
                module = await import('../modules/model/model-management.js');
                break;
                
            case APP_CONSTANTS.MODES.ADMIN:
                module = await import('../modules/admin/admin-panel.js');
                break;
                
            default:
                log(`Unknown mode: ${mode}`);
                return;
        }
        
        // 缓存模块
        this.modules[mode] = module;
        
        // 调用模块的初始化函数
        if (module.init) {
            await module.init();
        }
    }
    
    /**
     * 隐藏所有UI
     */
    hideAllUI() {
        const uiElements = [
            'video-selection',
            'annotation-ui',
            'admin-panel',
            'project-management-ui',
            'label-management-ui',
            'dataset-management-ui',
            'task-assignment-ui',
            'model-management-ui'
        ];
        
        uiElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('hidden');
            }
        });
    }
    
    /**
     * 更新UI显示
     * @param {string} mode - 模式名称
     */
    updateUI(mode) {
        // 更新侧边栏按钮激活状态
        this.updateSidebarButtons(mode);
        
        // 显示对应的UI
        this.showUI(mode);
    }
    
    /**
     * 更新侧边栏按钮状态
     * @param {string} activeMode - 激活的模式
     */
    updateSidebarButtons(activeMode) {
        const modeButtons = {
            [APP_CONSTANTS.MODES.ANNOTATE]: 'annotate-mode-btn',
            [APP_CONSTANTS.MODES.REVIEW]: 'review-mode-btn',
            [APP_CONSTANTS.MODES.PROJECT_MANAGEMENT]: 'project-management-mode-btn',
            [APP_CONSTANTS.MODES.LABEL_MANAGEMENT]: 'label-management-mode-btn',
            [APP_CONSTANTS.MODES.DATASET_MANAGEMENT]: 'dataset-management-mode-btn',
            [APP_CONSTANTS.MODES.TASK_ASSIGNMENT]: 'task-assignment-mode-btn',
            [APP_CONSTANTS.MODES.MODEL_MANAGEMENT]: 'model-management-mode-btn'
        };
        
        // 移除所有按钮的激活状态
        Object.values(modeButtons).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.classList.remove('active');
            }
        });
        
        // 激活当前模式的按钮
        const activeBtnId = modeButtons[activeMode];
        if (activeBtnId) {
            const activeBtn = document.getElementById(activeBtnId);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    }
    
    /**
     * 显示对应模式的UI
     * @param {string} mode - 模式名称
     */
    showUI(mode) {
        const mainLayout = document.getElementById('main-layout');
        
        const uiMapping = {
            [APP_CONSTANTS.MODES.ANNOTATE]: 'video-selection',
            [APP_CONSTANTS.MODES.REVIEW]: 'video-selection',
            [APP_CONSTANTS.MODES.ADMIN]: 'admin-panel',
            [APP_CONSTANTS.MODES.PROJECT_MANAGEMENT]: 'project-management-ui',
            [APP_CONSTANTS.MODES.LABEL_MANAGEMENT]: 'label-management-ui',
            [APP_CONSTANTS.MODES.DATASET_MANAGEMENT]: 'dataset-management-ui',
            [APP_CONSTANTS.MODES.TASK_ASSIGNMENT]: 'task-assignment-ui',
            [APP_CONSTANTS.MODES.MODEL_MANAGEMENT]: 'model-management-ui'
        };
        
        const uiId = uiMapping[mode];
        if (uiId) {
            const element = document.getElementById(uiId);
            if (element) {
                element.classList.remove('hidden');
                
                // admin-panel 独立显示，需要隐藏 main-layout
                if (mode === APP_CONSTANTS.MODES.ADMIN) {
                    if (mainLayout) mainLayout.classList.add('hidden');
                } else {
                    if (mainLayout) mainLayout.classList.remove('hidden');
                }
                
                // 模型管理需要加载项目列表
                if (mode === APP_CONSTANTS.MODES.MODEL_MANAGEMENT) {
                    eventBus.emit('model:load-ui');
                }
            }
        }
    }
    
    /**
     * 注册模式切换前的处理器
     * @param {Function} handler - 处理函数，返回false可取消切换
     */
    beforeChange(handler) {
        this.beforeChangeHandlers.push(handler);
    }
    
    /**
     * 获取当前模式
     * @returns {string}
     */
    getCurrentMode() {
        return this.currentMode;
    }
    
    /**
     * 预加载模块
     * @param {string[]} modes - 要预加载的模式列表
     */
    async preloadModules(modes) {
        const promises = modes.map(mode => this.loadModeModule(mode));
        await Promise.all(promises);
        log(`Preloaded modules: ${modes.join(', ')}`);
    }
}

// 创建全局路由实例
export const router = new Router();

// 导出Router类
export default Router;
