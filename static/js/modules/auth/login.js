/**
 * 登录模块
 * 处理用户登录、登出和认证状态
 * 从 app.js 迁移而来
 */

import { API_ENDPOINTS } from '../../core/config.js';
import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';

/**
 * 初始化登录模块
 */
export function init() {
    setupLoginEvents();
    setupLogoutEvents();
}

/**
 * 设置登录相关事件
 */
function setupLoginEvents() {
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => handleLogin());
    }
    
    if (usernameInput && passwordInput) {
        // 回车登录
        usernameInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
        
        passwordInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
}

/**
 * 设置登出相关事件
 */
function setupLogoutEvents() {
    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => handleLogout());
    }
}

/**
 * 处理用户登录
 * 从 app.js:6302 迁移
 */
async function handleLogin() {
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const loginError = document.getElementById('login-error');
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        loginError.textContent = '用户名和密码不能为空';
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const currentUser = data.username;
            const userRoles = Array.isArray(data.roles) ? data.roles : [];
            
            // 隐藏登录界面，显示主界面
            showMainUI();
            
            // 更新用户头像和下拉菜单信息
            updateUserAvatarInfo(currentUser, userRoles);
            
            // 显示/隐藏相应的菜单按钮
            updateMenuVisibility(userRoles);
            
            // 登录成功后自动加载项目并设置默认项目
            await initializeUserProjects(currentUser, userRoles);
            
            // 触发登录事件，由app.js统一处理后续逻辑
            eventBus.emit(EVENTS.USER_LOGGED_IN, {
                username: currentUser,
                roles: userRoles
            });
            
            showToast(`欢迎，${currentUser}！`, 'success');
        } else {
            throw new Error(data.error || '登录失败');
        }
    } catch (error) {
        loginError.textContent = error.message;
    }
}

/**
 * 处理用户登出
 * 从 app.js:5798 迁移
 */
function handleLogout() {
    // 隐藏下拉菜单（通过事件通知user-menu模块）
    eventBus.emit('user-menu:hide');
    
    // 执行退出登录
    performLogout();
}

/**
 * 执行退出登录
 * 从 app.js:5812 迁移
 */
function performLogout() {
    // 清除状态
    appState.batchUpdate({
        currentUser: null,
        userRoles: [],
        isAuthenticated: false,
        currentProject: null,
        labels: [],
        projects: {}
    });
    
    // 显示登录界面
    showLoginUI();
    
    // 隐藏管理相关按钮
    hideAdminButtons();
    
    // 触发登出事件
    eventBus.emit(EVENTS.USER_LOGGED_OUT);
    
    showToast('已成功退出登录', 'success');
}

/**
 * 显示主界面
 */
function showMainUI() {
    const loginModal = document.getElementById('login-modal');
    const mainContainer = document.getElementById('main-container');
    const mainHeader = document.getElementById('main-header');
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const mainLayout = document.getElementById('main-layout');
    const videoSelection = document.getElementById('video-selection');
    
    console.log('[login] showMainUI called');
    
    // 隐藏登录模态框
    if (loginModal) {
        loginModal.classList.add('hidden');
        loginModal.style.display = 'none';
    }
    
    // 显示主容器
    if (mainContainer) {
        mainContainer.classList.remove('hidden');
        mainContainer.style.display = '';
    }
    
    // 显示主界面各个部分
    if (mainHeader) {
        mainHeader.classList.remove('hidden');
        mainHeader.style.display = '';
    }
    if (mainSidebar) {
        mainSidebar.classList.remove('hidden');
        mainSidebar.style.display = '';
    }
    if (mainContentArea) {
        mainContentArea.classList.remove('hidden');
        mainContentArea.style.display = '';
    }
    if (mainLayout) {
        mainLayout.classList.remove('hidden');
        mainLayout.style.display = '';
    }
    if (videoSelection) {
        videoSelection.classList.remove('hidden');
        videoSelection.style.display = '';
    }
    
    console.log('[login] All UI elements shown');
}

/**
 * 显示登录界面
 * 从 app.js 迁移
 */
function showLoginUI() {
    const loginModal = document.getElementById('login-modal');
    const mainContainer = document.getElementById('main-container');
    const mainHeader = document.getElementById('main-header');
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const mainLayout = document.getElementById('main-layout');
    const adminPanel = document.getElementById('admin-panel');
    
    console.log('[login] showLoginUI called');
    console.log('[login] loginModal:', loginModal);
    
    if (loginModal) {
        loginModal.classList.remove('hidden');
        loginModal.style.display = 'flex';
    }
    
    // 隐藏所有主界面元素
    if (mainContainer) {
        mainContainer.classList.add('hidden');
        mainContainer.style.display = 'none';
    }
    if (mainHeader) {
        mainHeader.classList.add('hidden');
    }
    if (mainSidebar) {
        mainSidebar.classList.add('hidden');
    }
    if (mainContentArea) {
        mainContentArea.classList.add('hidden');
    }
    if (mainLayout) {
        mainLayout.classList.add('hidden');
    }
    if (adminPanel) {
        adminPanel.classList.add('hidden');
    }
    
    // 清空密码和错误信息，保留用户名（方便重新登录）
    const passwordInput = document.getElementById('password-input');
    const loginError = document.getElementById('login-error');
    
    if (passwordInput) passwordInput.value = '';
    if (loginError) loginError.textContent = '';
}

/**
 * 更新用户头像和信息
 * 从 app.js:6396 迁移
 */
function updateUserAvatarInfo(currentUser, userRoles) {
    if (!currentUser) return;
    
    // 获取用户名的首字母（支持中文）
    const firstChar = getFirstCharacter(currentUser);
    
    // 更新头像显示
    const avatarElements = document.querySelectorAll('.user-avatar, .user-avatar-small');
    avatarElements.forEach(avatar => {
        avatar.textContent = firstChar;
    });
    
    // 更新下拉菜单中的用户信息
    const dropdownUsername = document.getElementById('dropdown-username');
    const dropdownRoles = document.getElementById('dropdown-roles');
    
    if (dropdownUsername) {
        dropdownUsername.textContent = currentUser;
    }
    
    if (dropdownRoles) {
        dropdownRoles.textContent = userRoles.join(', ');
    }
}

/**
 * 获取字符串的首个字符（支持中文）
 * 从 app.js:6419 迁移
 */
function getFirstCharacter(str) {
    if (!str) return '?';
    
    // 如果是中文字符，直接返回第一个字符
    if (/^[\u4e00-\u9fa5]/.test(str)) {
        return str.charAt(0);
    }
    
    // 如果是英文，返回第一个字母的大写
    return str.charAt(0).toUpperCase();
}

/**
 * 更新菜单按钮可见性
 */
function updateMenuVisibility(userRoles) {
    const dropdownAdminBtn = document.getElementById('admin-mode-btn');
    const datasetManagementModeBtn = document.getElementById('dataset-management-mode-btn');
    const taskAssignmentModeBtn = document.getElementById('task-assignment-mode-btn');
    const projectManagementModeBtn = document.getElementById('project-management-mode-btn');
    const modelManagementModeBtn = document.getElementById('model-management-mode-btn');
    const labelManagementModeBtn = document.getElementById('label-management-mode-btn');
    
    // 管理员显示管理面板按钮
    if (Array.isArray(userRoles) && userRoles.includes('admin')) {
        if (dropdownAdminBtn) dropdownAdminBtn.classList.remove('hidden');
        if (datasetManagementModeBtn) datasetManagementModeBtn.classList.remove('hidden');
        if (taskAssignmentModeBtn) taskAssignmentModeBtn.classList.remove('hidden');
        if (projectManagementModeBtn) projectManagementModeBtn.classList.remove('hidden');
        if (modelManagementModeBtn) modelManagementModeBtn.classList.remove('hidden');
    }
    
    // 所有登录用户都可以访问标签管理（查看权限）
    if (Array.isArray(userRoles) && (userRoles.includes('admin') || userRoles.includes('annotator') || userRoles.includes('reviewer'))) {
        if (labelManagementModeBtn) labelManagementModeBtn.classList.remove('hidden');
    }
}

/**
 * 隐藏管理员按钮
 */
function hideAdminButtons() {
    const dropdownAdminBtn = document.getElementById('admin-mode-btn');
    const datasetManagementModeBtn = document.getElementById('dataset-management-mode-btn');
    const taskAssignmentModeBtn = document.getElementById('task-assignment-mode-btn');
    const labelManagementModeBtn = document.getElementById('label-management-mode-btn');
    const modelManagementModeBtn = document.getElementById('model-management-mode-btn');
    const projectManagementModeBtn = document.getElementById('project-management-mode-btn');
    
    if (dropdownAdminBtn) dropdownAdminBtn.classList.add('hidden');
    if (datasetManagementModeBtn) datasetManagementModeBtn.classList.add('hidden');
    if (taskAssignmentModeBtn) taskAssignmentModeBtn.classList.add('hidden');
    if (labelManagementModeBtn) labelManagementModeBtn.classList.add('hidden');
    if (modelManagementModeBtn) modelManagementModeBtn.classList.add('hidden');
    if (projectManagementModeBtn) projectManagementModeBtn.classList.add('hidden');
}

/**
 * 初始化用户项目
 * 从 app.js:6366 迁移
 */
async function initializeUserProjects(currentUser, userRoles) {
    if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
        // 非管理员用户可能不需要项目初始化，或者可以从其他途径获取项目信息
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/projects?user=${currentUser}`);
        const data = await response.json();
        
        if (response.ok) {
            const projects = data.projects || {};
            appState.setState('projects', projects);
            
            // 设置默认项目（第一个项目）
            const projectNames = Object.keys(projects);
            if (projectNames.length > 0) {
                appState.setState('currentProject', projectNames[0]);
            } else {
                appState.setState('currentProject', null);
            }
        } else {
            throw new Error(data.error || '获取项目列表失败');
        }
    } catch (error) {
        console.error('Failed to initialize user projects:', error);
        appState.setState('currentProject', null);
    }
}


/**
 * 检查认证状态
 */
export async function checkAuth() {
    // TODO: 实现检查认证状态的逻辑
    // 可以调用API检查session是否有效
    return appState.getState('isAuthenticated');
}

export default {
    init,
    handleLogin,
    handleLogout,
    checkAuth
};
