/**
 * 管理面板模块
 * 用户管理功能
 * 从 app.legacy.js 迁移而来
 */

import { showToast } from '../../utils/toast.js';
import { APP_CONSTANTS, log } from '../../core/config.js';
import { eventBus } from '../../core/event-bus.js';
import { appState } from '../../core/state.js';
import { showConfirm } from '../../utils/modal.js';

// 用于跟踪当前编辑状态
let isEditingUser = false;
let currentEditingUsername = null;

/**
 * 初始化管理面板
 */
export function init() {
    log('[admin-panel] Initializing admin panel...');
    setupBackButton();
    loadUsersForAdmin();
    setupUserManagementEvents();
    log('[admin-panel] Admin panel initialized');
}

/**
 * 设置返回按钮
 */
function setupBackButton() {
    const backBtn = document.getElementById('back-to-main-btn');
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            eventBus.emit('ui:switch-mode', APP_CONSTANTS.MODES.ANNOTATE);
        });
    }
}

/**
 * 加载用户列表
 * 从 app.legacy.js:6550 迁移
 */
async function loadUsersForAdmin() {
    try {
        // 从appState获取当前用户
        const currentUser = appState.getState('currentUser');
        if (!currentUser) {
            showToast('请先登录', 'error');
            return;
        }
        
        const response = await fetch(`/api/admin/users?user=${encodeURIComponent(currentUser)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to load users');
        }
        
        const usersData = await response.json();
        // API返回格式: {username: {roles: [], password: ""}}
        // 转换为数组格式
        const users = Object.entries(usersData).map(([username, data]) => ({
            username,
            roles: data.roles || [],
            password: data.password
        }));
        
        displayUsersInTable(users);
    } catch (error) {
        console.error('[admin-panel] Failed to load users:', error);
        showToast(`加载用户列表失败: ${error.message}`, 'error');
    }
}

/**
 * 在表格中显示用户
 * 从 app.legacy.js:6563 迁移
 */
function displayUsersInTable(users) {
    const tableContainer = document.getElementById('user-management-table');
    if (!tableContainer) {
        console.error('[admin-panel] Table container not found');
        return;
    }
    
    // 创建表格
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>用户名</th>
                <th>角色</th>
                <th>密码</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    users.forEach(user => {
        const row = document.createElement('tr');
        const isAdmin = user.username === 'admin';
        
        row.innerHTML = `
            <td>${user.username}${isAdmin ? ' <span class="admin-badge">超级管理员</span>' : ''}</td>
            <td>${user.roles.join(', ')}</td>
            <td>
                <div class="password-display">
                    <span class="password-text hidden">${user.password || '未设置'}</span>
                    <span class="password-dots">••••••••</span>
                    <button class="toggle-password-btn" title="查看密码">
                        <span class="eye-icon">👁️</span>
                    </button>
                </div>
            </td>
            <td>
                <button class="admin-action-btn edit" onclick="window.editUser('${user.username}', '${user.roles.join(',')}')">编辑</button>
                ${!isAdmin ? `<button class="admin-action-btn delete" onclick="window.deleteUser('${user.username}')">删除</button>` : '<span class="protected-note">🔒 受保护</span>'}
            </td>
        `;
        tbody.appendChild(row);
    });
    
    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
}

/**
 * 设置用户管理事件
 */
function setupUserManagementEvents() {
    const addUserBtn = document.getElementById('add-user-btn');
    const clearFormBtn = document.getElementById('clear-form-btn');
    
    if (addUserBtn) {
        addUserBtn.addEventListener('click', handleAddUser);
    }
    
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', clearUserForm);
    }
    
    // 设置密码查看事件（使用事件委托）
    const tableContainer = document.getElementById('user-management-table');
    if (tableContainer) {
        tableContainer.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.toggle-password-btn');
            if (toggleBtn) {
                togglePasswordVisibility(toggleBtn);
            }
        });
    }
    
    // 暴露全局函数供按钮调用
    window.editUser = editUser;
    window.deleteUser = deleteUser;
    window.manageUser = manageUser;
}

/**
 * 切换密码显示/隐藏
 */
function togglePasswordVisibility(button) {
    const passwordDisplay = button.closest('.password-display');
    const passwordText = passwordDisplay.querySelector('.password-text');
    const passwordDots = passwordDisplay.querySelector('.password-dots');
    const eyeIcon = button.querySelector('.eye-icon');
    
    if (passwordText.classList.contains('hidden')) {
        // 显示密码
        passwordText.classList.remove('hidden');
        passwordDots.classList.add('hidden');
        eyeIcon.textContent = '🙈';
        button.title = '隐藏密码';
    } else {
        // 隐藏密码
        passwordText.classList.add('hidden');
        passwordDots.classList.remove('hidden');
        eyeIcon.textContent = '👁️';
        button.title = '查看密码';
    }
}

/**
 * 处理添加/更新用户
 */
async function handleAddUser() {
    const usernameInput = document.getElementById('new-username');
    const passwordInput = document.getElementById('new-password');
    const username = usernameInput?.value.trim();
    const password = passwordInput?.value.trim();
    const roleCheckboxes = document.querySelectorAll('#new-user-roles input[type="checkbox"]:checked');
    const roles = Array.from(roleCheckboxes).map(cb => cb.value);
    
    if (!username) {
        showToast('用户名不能为空', 'error');
        return;
    }
    
    // 新增用户时，密码必填
    // 编辑用户时，密码可选（留空则不修改）
    if (!isEditingUser && !password) {
        showToast('新用户密码不能为空', 'error');
        return;
    }
    
    if (roles.length === 0 && username !== 'admin') {
        showToast('请至少选择一个角色', 'error');
        return;
    }
    
    await manageUser('add_update', username, roles, password || null);
}

/**
 * 清空用户表单
 */
function clearUserForm() {
    const usernameInput = document.getElementById('new-username');
    const passwordInput = document.getElementById('new-password');
    const roleCheckboxes = document.querySelectorAll('#new-user-roles input[type="checkbox"]');
    
    if (usernameInput) {
        usernameInput.value = '';
        usernameInput.readOnly = false;
        usernameInput.style.background = '';
        usernameInput.placeholder = '用户名';
    }
    
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.placeholder = '密码';
    }
    
    roleCheckboxes.forEach(cb => cb.checked = false);
    
    // 移除编辑提示
    document.querySelector('.user-form .edit-notice')?.remove();
    
    // 重置编辑状态
    isEditingUser = false;
    currentEditingUsername = null;
}

/**
 * 编辑用户
 * 从 app.legacy.js:6659 迁移
 */
function editUser(username, rolesStr) {
    const usernameInput = document.getElementById('new-username');
    const passwordInput = document.getElementById('new-password');
    const roleCheckboxes = document.querySelectorAll('#new-user-roles input[type="checkbox"]');
    
    // 设置编辑模式
    isEditingUser = true;
    currentEditingUsername = username;
    
    if (usernameInput) {
        usernameInput.value = username;
        // admin用户不能修改用户名
        if (username === 'admin') {
            usernameInput.readOnly = true;
            usernameInput.style.background = '#f5f5f5';
        } else {
            usernameInput.readOnly = false;
            usernameInput.style.background = '';
        }
    }
    
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.placeholder = '留空则不修改密码';
    }
    
    const roles = rolesStr.split(',').map(r => r.trim()).filter(r => r);
    
    // 设置角色复选框（非admin角色）
    roleCheckboxes.forEach(checkbox => {
        checkbox.checked = roles.includes(checkbox.value);
    });
    
    // 如果是admin用户，显示提示
    const formNotice = document.querySelector('.user-form .edit-notice');
    if (username === 'admin') {
        if (!formNotice) {
            const notice = document.createElement('div');
            notice.className = 'edit-notice admin-edit-notice';
            notice.innerHTML = '<small>⚠️ 正在编辑超级管理员账户，只能修改密码</small>';
            document.querySelector('.user-form h4')?.after(notice);
        }
    } else {
        formNotice?.remove();
    }
    
    // 滚动到表单
    document.querySelector('.user-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 删除用户
 * 从 app.legacy.js:6710 迁移
 */
async function deleteUser(username) {
    // 保护admin用户
    if (username === 'admin') {
        showToast('不能删除超级管理员账户', 'error');
        return;
    }
    
    // 使用统一的确认对话框
    const result = await showConfirm(
        `确定要删除用户 '${username}' 吗？`,
        [
            '⚠️ 属于该用户的标注或审核任务需要重新分配',
            '📋 该操作不可撤销，请谨慎操作'
        ],
        '删除用户'
    );
    
    if (!result) {
        return;
    }
    
    try {
        const currentUser = appState.getState('currentUser');
        if (!currentUser) {
            showToast('请先登录', 'error');
            return;
        }
        
        const response = await fetch('/api/admin/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_user: currentUser,
                action: 'delete',
                username: username
            })
        });
        
        if (response.ok) {
            showToast('用户已删除', 'success');
            await loadUsersForAdmin();
        } else {
            const errorData = await response.json();
            showToast(`删除失败：${errorData.detail || '未知错误'}`, 'error');
        }
    } catch (error) {
        console.error('[admin-panel] Delete user error:', error);
        showToast('删除用户失败', 'error');
    }
}

/**
 * 管理用户（添加/更新）
 * 从 app.legacy.js:6731 迁移
 */
async function manageUser(action, username, roles, password = null) {
    try {
        const currentUser = appState.getState('currentUser');
        if (!currentUser) {
            showToast('请先登录', 'error');
            return;
        }
        
        const body = {
            admin_user: currentUser,
            action: action,
            username: username,
            roles: roles
        };
        
        if (password) {
            body.password = password;
        }
        
        const response = await fetch('/api/admin/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            const result = await response.json();
            const actionMsg = isEditingUser ? '更新' : '创建';
            showToast(result.message || `用户 ${username} ${actionMsg}成功`, 'success');
            clearUserForm(); // 这会重置编辑状态
            await loadUsersForAdmin();
        } else {
            const errorData = await response.json();
            showToast(`操作失败：${errorData.detail || '未知错误'}`, 'error');
        }
    } catch (error) {
        console.error('[admin-panel] Manage user error:', error);
        showToast('操作失败', 'error');
    }
}

export default {
    init
};
