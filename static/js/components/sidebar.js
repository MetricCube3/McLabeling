/**
 * 侧边栏组件
 * 管理侧边栏的展开/折叠状态
 * 从 app.js 迁移而来
 */

import { appState } from '../core/state.js';
import { eventBus, EVENTS } from '../core/event-bus.js';
import { debounce } from '../utils/helpers.js';
import { router } from '../core/router.js';
import { APP_CONSTANTS } from '../core/config.js';

/**
 * 初始化侧边栏
 */
export function init() {
    setupSidebarEvents();
    setupModeButtonEvents();
    setupStateSubscriptions();
    
    // 初始化侧边栏状态
    appState.setState('sidebarCollapsed', false);
}

/**
 * 设置侧边栏事件监听
 * 从 app.js:5768 迁移
 */
function setupSidebarEvents() {
    const toggleBtn = document.getElementById('toggle-sidebar-btn');
    const expandBtn = document.getElementById('expand-sidebar-btn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleSidebar());
    }
    
    if (expandBtn) {
        expandBtn.addEventListener('click', () => expandSidebar());
    }
}

/**
 * 设置模式切换按钮事件
 */
function setupModeButtonEvents() {
    console.log('[sidebar] Setting up mode button events...');
    
    const modeButtons = {
        'annotate-mode-btn': APP_CONSTANTS.MODES.ANNOTATE,
        'review-mode-btn': APP_CONSTANTS.MODES.REVIEW,
        'project-management-mode-btn': APP_CONSTANTS.MODES.PROJECT_MANAGEMENT,
        'label-management-mode-btn': APP_CONSTANTS.MODES.LABEL_MANAGEMENT,
        'dataset-management-mode-btn': APP_CONSTANTS.MODES.DATASET_MANAGEMENT,
        'task-assignment-mode-btn': APP_CONSTANTS.MODES.TASK_ASSIGNMENT,
        'model-management-mode-btn': APP_CONSTANTS.MODES.MODEL_MANAGEMENT
    };
    
    Object.entries(modeButtons).forEach(([btnId, mode]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', async () => {
                console.log(`[sidebar] Mode button clicked: ${mode}`);
                await router.switchMode(mode);
            });
            console.log(`[sidebar] Bound event for ${btnId}`);
        } else {
            console.warn(`[sidebar] Button not found: ${btnId}`);
        }
    });
    
    console.log('[sidebar] Mode button events setup complete');
}

/**
 * 设置状态订阅
 */
function setupStateSubscriptions() {
    // 监听侧边栏状态变化
    appState.subscribe('sidebarCollapsed', (collapsed) => {
        updateSidebarUI(collapsed);
        
        // 触发侧边栏状态变化事件
        eventBus.emit(EVENTS.SIDEBAR_TOGGLED, { collapsed });
    });
}

/**
 * 切换侧边栏
 */
const optimizedToggleSidebar = debounce(function() {
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    const toggleBtn = document.getElementById('toggle-sidebar-btn');
    
    if (!mainSidebar || !mainContentArea) return;
    
    const isCollapsed = mainSidebar.classList.contains('sidebar-collapsed');
    
    if (isCollapsed) {
        // 展开侧边栏
        mainSidebar.classList.remove('sidebar-collapsed');
        mainContentArea.classList.remove('main-content-expanded');
        if (sidebarCollapsedHeader) {
            sidebarCollapsedHeader.classList.add('hidden');
        }
        if (toggleBtn) {
            toggleBtn.innerHTML = '<span class="btn-icon">◀</span>';
            toggleBtn.title = "隐藏侧边栏";
        }
        
        // 更新状态
        appState.setState('sidebarCollapsed', false);
    } else {
        // 折叠侧边栏
        mainSidebar.classList.add('sidebar-collapsed');
        mainContentArea.classList.add('main-content-expanded');
        if (sidebarCollapsedHeader) {
            sidebarCollapsedHeader.classList.remove('hidden');
        }
        if (toggleBtn) {
            toggleBtn.innerHTML = '<span class="btn-icon">▶</span>';
            toggleBtn.title = "显示侧边栏";
        }
        
        // 更新状态
        appState.setState('sidebarCollapsed', true);
    }
}, 16); // 约60fps

/**
 * 切换侧边栏
 * 从 app.js:313 迁移
 */
function toggleSidebar() {
    optimizedToggleSidebar();
}

/**
 * 展开侧边栏
 * 从 app.js:335 迁移
 */
function expandSidebar() {
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    const toggleBtn = document.getElementById('toggle-sidebar-btn');
    
    if (mainSidebar) {
        mainSidebar.classList.remove('sidebar-collapsed');
    }
    if (mainContentArea) {
        mainContentArea.classList.remove('main-content-expanded');
    }
    if (sidebarCollapsedHeader) {
        sidebarCollapsedHeader.classList.add('hidden');
    }
    if (toggleBtn) {
        toggleBtn.innerHTML = '<span class="btn-icon">◀</span>';
        toggleBtn.title = "隐藏侧边栏";
    }
    
    // 更新状态
    appState.setState('sidebarCollapsed', false);
}

/**
 * 折叠侧边栏
 */
export function collapseSidebar() {
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    const toggleBtn = document.getElementById('toggle-sidebar-btn');
    
    if (mainSidebar) {
        mainSidebar.classList.add('sidebar-collapsed');
    }
    if (mainContentArea) {
        mainContentArea.classList.add('main-content-expanded');
    }
    if (sidebarCollapsedHeader) {
        sidebarCollapsedHeader.classList.remove('hidden');
    }
    if (toggleBtn) {
        toggleBtn.innerHTML = '<span class="btn-icon">▶</span>';
        toggleBtn.title = "显示侧边栏";
    }
    
    // 更新状态
    appState.setState('sidebarCollapsed', true);
}

/**
 * 显示侧边栏（完全显示，不是展开折叠）
 */
export function showSidebar() {
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    
    if (mainSidebar) {
        mainSidebar.classList.remove('hidden');
    }
    if (mainContentArea) {
        mainContentArea.classList.remove('full-width');
    }
    
    // 检查是否处于折叠状态
    if (mainSidebar && mainSidebar.classList.contains('sidebar-collapsed')) {
        // 侧边栏是折叠的，需要显示展开按钮
        if (sidebarCollapsedHeader) {
            sidebarCollapsedHeader.classList.remove('hidden');
        }
    } else {
        // 侧边栏是展开的，隐藏展开按钮
        if (sidebarCollapsedHeader) {
            sidebarCollapsedHeader.classList.add('hidden');
        }
    }
}

/**
 * 隐藏侧边栏（完全隐藏）
 */
export function hideSidebar() {
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    
    if (mainSidebar) {
        mainSidebar.classList.add('hidden');
    }
    if (mainContentArea) {
        mainContentArea.classList.add('full-width');
    }
    if (sidebarCollapsedHeader) {
        sidebarCollapsedHeader.classList.add('hidden');
    }
}

/**
 * 更新侧边栏UI
 * @param {boolean} collapsed - 是否折叠
 */
function updateSidebarUI(collapsed) {
    const mainSidebar = document.getElementById('main-sidebar');
    const mainContentArea = document.getElementById('main-content-area');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    const toggleBtn = document.getElementById('toggle-sidebar-btn');
    
    if (!mainSidebar || !mainContentArea) return;
    
    if (collapsed) {
        mainSidebar.classList.add('sidebar-collapsed');
        mainContentArea.classList.add('main-content-expanded');
        if (sidebarCollapsedHeader) {
            sidebarCollapsedHeader.classList.remove('hidden');
        }
        if (toggleBtn) {
            toggleBtn.innerHTML = '<span class="btn-icon">▶</span>';
            toggleBtn.title = '显示侧边栏';
        }
    } else {
        mainSidebar.classList.remove('sidebar-collapsed');
        mainContentArea.classList.remove('main-content-expanded');
        if (sidebarCollapsedHeader) {
            sidebarCollapsedHeader.classList.add('hidden');
        }
        if (toggleBtn) {
            toggleBtn.innerHTML = '<span class="btn-icon">◀</span>';
            toggleBtn.title = '隐藏侧边栏';
        }
    }
}

export default {
    init,
    toggleSidebar,
    expandSidebar,
    collapseSidebar
};
