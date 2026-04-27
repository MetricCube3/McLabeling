/**
 * 用户菜单模块
 * 处理用户头像下拉菜单的交互
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';

let dropdownTimeout = null;

/**
 * 初始化用户菜单
 */
export function init() {
    setupUserMenuEvents();
    setupEventListeners();
}

/**
 * 设置用户菜单事件
 * 从 app.js:5846 迁移
 */
function setupUserMenuEvents() {
    const userAvatar = document.getElementById('user-avatar');
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    
    if (!userAvatar || !userDropdownMenu) return;
    
    // 用户头像点击事件
    userAvatar.addEventListener('click', toggleMenu);
    
    // 鼠标悬停和离开事件
    userAvatar.addEventListener('mouseenter', () => {
        clearTimeout(dropdownTimeout);
    });
    
    userAvatar.addEventListener('mouseleave', () => {
        dropdownTimeout = setTimeout(() => {
            if (!userDropdownMenu.matches(':hover')) {
                hideMenu();
            }
        }, 300);
    });
    
    // 下拉菜单悬停和离开事件
    userDropdownMenu.addEventListener('mouseenter', () => {
        clearTimeout(dropdownTimeout);
    });
    
    userDropdownMenu.addEventListener('mouseleave', () => {
        dropdownTimeout = setTimeout(() => {
            hideMenu();
        }, 300);
    });
    
    // 点击页面其他区域关闭下拉菜单
    document.addEventListener('click', (e) => {
        if (!userAvatar.contains(e.target) && !userDropdownMenu.contains(e.target)) {
            hideMenu();
        }
    });
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 监听来自登录模块的隐藏菜单事件
    eventBus.on('user-menu:hide', () => {
        hideMenu();
    });
    
    // 设置管理面板按钮点击事件
    setupAdminButtonEvent();
}

/**
 * 设置管理面板按钮事件
 */
function setupAdminButtonEvent() {
    const adminBtn = document.getElementById('admin-mode-btn');
    
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            console.log('[user-menu] Admin panel button clicked');
            hideMenu();
            // 触发切换到管理面板模式
            eventBus.emit('ui:switch-mode', 'admin');
        });
    }
}

/**
 * 切换用户下拉菜单
 * 从 app.js:5885 迁移
 */
function toggleMenu() {
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    if (!userDropdownMenu) return;
    
    if (userDropdownMenu.classList.contains('hidden')) {
        showMenu();
    } else {
        hideMenu();
    }
}

/**
 * 显示用户下拉菜单
 * 从 app.js:5894 迁移
 */
function showMenu() {
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    const userAvatar = document.getElementById('user-avatar');
    
    if (userDropdownMenu) {
        userDropdownMenu.classList.remove('hidden');
    }
    
    if (userAvatar) {
        userAvatar.style.transform = 'scale(1.05)';
        userAvatar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    }
    
    eventBus.emit('user-menu:shown');
}

/**
 * 隐藏用户下拉菜单
 * 从 app.js:5901 迁移
 */
function hideMenu() {
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    const userAvatar = document.getElementById('user-avatar');
    
    if (userDropdownMenu) {
        userDropdownMenu.classList.add('hidden');
    }
    
    if (userAvatar) {
        userAvatar.style.transform = 'scale(1)';
        userAvatar.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    }
    
    eventBus.emit('user-menu:hidden');
}

export default {
    init,
    toggleMenu,
    showMenu,
    hideMenu
};
