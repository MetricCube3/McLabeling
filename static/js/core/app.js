/**
 * 主入口文件（新版模块化）
 * 负责应用的初始化和启动
 */

import { appState } from './state.js';
import { eventBus, EVENTS } from './event-bus.js';
import { router } from './router.js';
import { APP_CONSTANTS, log } from './config.js';
import { showToast } from '../utils/toast.js';

// 导入核心模块
import * as login from '../modules/auth/login.js';
import * as userMenu from '../modules/auth/user-menu.js';
import * as sidebar from '../components/sidebar.js';

/**
 * 应用类
 */
class App {
    constructor() {
        this.initialized = false;
        this.modules = [];
    }
    
    /**
     * 初始化应用
     */
    async init() {
        if (this.initialized) {
            log('App already initialized');
            return;
        }
        
        log('Initializing app...');
        
        try {
            // 1. 初始化核心系统
            await this.initCore();
            
            // 2. 初始化UI组件
            await this.initComponents();
            
            // 3. 设置全局事件监听
            this.setupGlobalListeners();
            
            // 4. 检查认证状态
            await this.checkAuth();
            
            this.initialized = true;
            log('App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            showToast('应用初始化失败，请刷新页面重试', 'error');
        }
    }
    
    /**
     * 初始化核心系统
     */
    async initCore() {
        log('Initializing core systems...');
        
        // 初始化路由
        router.init();
        
        // 设置默认状态
        appState.setState('appMode', APP_CONSTANTS.MODES.LOGIN);
        appState.setState('isAuthenticated', false);
        
        log('Core systems initialized');
    }
    
    /**
     * 初始化UI组件
     */
    async initComponents() {
        log('Initializing UI components...');
        
        // 初始化登录模块
        login.init();
        
        // 初始化用户菜单
        userMenu.init();
        
        // 初始化侧边栏
        sidebar.init();
        
        log('UI components initialized');
    }
    
    /**
     * 设置全局事件监听
     */
    setupGlobalListeners() {
        log('Setting up global listeners...');
        
        // 监听登录成功事件
        eventBus.on(EVENTS.USER_LOGGED_IN, (data) => {
            this.handleLoginSuccess(data);
        });
        
        // 监听登出事件
        eventBus.on(EVENTS.USER_LOGGED_OUT, () => {
            this.handleLogout();
        });
        
        // 监听模式切换事件
        eventBus.on(EVENTS.MODE_CHANGED, (data) => {
            log(`Mode changed from ${data.from} to ${data.to}`);
        });
        
        // 监听UI切换模式请求
        eventBus.on('ui:switch-mode', (mode) => {
            router.switchMode(mode);
        });
        
        // 全局错误处理
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
        });
        
        // 未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
        
        log('Global listeners set up');
    }
    
    /**
     * 检查认证状态
     */
    async checkAuth() {
        log('Checking authentication...');
        
        const isAuthenticated = await login.checkAuth();
        
        if (isAuthenticated) {
            const currentUser = appState.getState('currentUser');
            const userRoles = appState.getState('userRoles');
            
            log(`User authenticated: ${currentUser}, roles: ${userRoles?.join(', ')}`);
            
            // 显示主界面
            this.showMainUI();
            
            // 切换到标注模式
            await router.switchMode(APP_CONSTANTS.MODES.ANNOTATE);
            
        } else {
            log('User not authenticated, showing login');
            this.showLoginUI();
        }
    }
    
    /**
     * 处理登录成功
     */
    async handleLoginSuccess(data) {
        log('Handling login success...');
        
        const { username, roles } = data;
        
        // 更新状态
        appState.setState('isAuthenticated', true);
        appState.setState('currentUser', username);
        appState.setState('userRoles', roles);
        
        // 注意：UI切换和Toast已由login.js处理，这里只负责状态管理和模式切换
        
        // 切换到标注模式
        await router.switchMode(APP_CONSTANTS.MODES.ANNOTATE);
        
        // 延迟预加载，避免干扰主模块
        setTimeout(() => {
            // 预加载常用模块
            const preloadModes = [
                APP_CONSTANTS.MODES.REVIEW,
                APP_CONSTANTS.MODES.PROJECT_MANAGEMENT
            ];
            
            // 如果是管理员，预加载管理模块
            if (roles && roles.includes('admin')) {
                preloadModes.push(
                    APP_CONSTANTS.MODES.LABEL_MANAGEMENT,
                    APP_CONSTANTS.MODES.DATASET_MANAGEMENT,
                    APP_CONSTANTS.MODES.TASK_ASSIGNMENT,
                    APP_CONSTANTS.MODES.MODEL_MANAGEMENT
                );
            }
            
            router.preloadModules(preloadModes).catch(err => {
                console.warn('Failed to preload modules:', err);
            });
        }, 2000); // 延迟2秒预加载
    }
    
    /**
     * 处理登出
     */
    handleLogout() {
        log('Handling logout...');

        // 清除状态
        appState.setState('isAuthenticated', false);
        appState.setState('currentUser', null);
        appState.setState('userRoles', []);
        appState.setState('appMode', APP_CONSTANTS.MODES.LOGIN);
        appState.setState('currentProject', null);
        appState.setState('labels', []);
        appState.setState('projects', {});
        
        // 隐藏所有UI
        this.hideAllUI();
        
        // 显示登录界面
        this.showLoginUI();
        
        showToast('已退出登录', 'info');
    }
    
    /**
     * 显示登录界面
     */
    showLoginUI() {
        const loginModal = document.getElementById('login-modal');
        const mainContainer = document.getElementById('main-container');
        const mainHeader = document.getElementById('main-header');
        const mainSidebar = document.getElementById('main-sidebar');
        const mainContentArea = document.getElementById('main-content-area');
        const mainLayout = document.getElementById('main-layout');
        const adminPanel = document.getElementById('admin-panel');
        
        if (loginModal) {
            loginModal.classList.remove('hidden');
            loginModal.style.display = 'flex';
        }
        if (mainContainer) {
            mainContainer.classList.add('hidden');
            mainContainer.style.display = 'none';
        }
        if (mainHeader) mainHeader.classList.add('hidden');
        if (mainSidebar) mainSidebar.classList.add('hidden');
        if (mainContentArea) mainContentArea.classList.add('hidden');
        if (mainLayout) mainLayout.classList.add('hidden');
        if (adminPanel) adminPanel.classList.add('hidden');
    }
    
    /**
     * 显示主界面
     */
    showMainUI() {
        const loginModal = document.getElementById('login-modal');
        const mainContainer = document.getElementById('main-container');
        const mainHeader = document.getElementById('main-header');
        const mainSidebar = document.getElementById('main-sidebar');
        const mainContentArea = document.getElementById('main-content-area');
        const mainLayout = document.getElementById('main-layout');
        
        if (loginModal) {
            loginModal.classList.add('hidden');
            loginModal.style.display = 'none';
        }
        if (mainContainer) {
            mainContainer.classList.remove('hidden');
            mainContainer.style.display = '';
        }
        if (mainHeader) mainHeader.classList.remove('hidden');
        if (mainSidebar) mainSidebar.classList.remove('hidden');
        if (mainContentArea) mainContentArea.classList.remove('hidden');
        if (mainLayout) mainLayout.classList.remove('hidden');
    }
    
    /**
     * 获取应用版本
     */
    getVersion() {
        return '2.0.0-modular';
    }
}

// 创建应用实例
const app = new App();

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    log('DOM Content Loaded');
    await app.init();
});

// 导出应用实例
export { app };
export default app;
