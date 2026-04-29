/**
 * 标签管理模块
 * 处理标签的CRUD操作
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm } from '../../utils/modal.js';

// 防止重复初始化
let isInitialized = false;

// 监听登出事件，重置模块状态
eventBus.on(EVENTS.USER_LOGGED_OUT, () => {
    isInitialized = false;
});

/**
 * 初始化标签管理模块
 */
export async function init() {
    // 无论是否已初始化，先清空残留的标签列表 DOM 和项目信息
    const projectSelect = document.getElementById('label-project-select');
    const labelListContainer = document.getElementById('label-list-container');
    if (projectSelect) {
        projectSelect.innerHTML = '<option value="">请选择项目</option>';
    }
    if (labelListContainer) {
        labelListContainer.innerHTML = '';
    }
    updateProjectInfoDisplay(null);

    if (isInitialized) {
        console.log('[label-manager] Already initialized, reloading...');
        // 清空现有标签列表，更新角色 UI
        renderLabelList([]);
        updateUIForUserRole();
        // 重新加载项目列表和标签
        await loadProjectsForLabelManagement();
        return;
    }

    console.log('[label-manager] Initializing label management module');

    setupLabelManagementEvents();

    // 加载项目列表
    await loadProjectsForLabelManagement();

    // 设置项目选择器事件
    setupProjectSelectorEvents();

    // 根据用户角色显示/隐藏管理功能
    updateUIForUserRole();

    isInitialized = true;
    console.log('[label-manager] Initialization complete');
}

/**
 * 加载项目列表（标签管理用）
 */
async function loadProjectsForLabelManagement() {
    const currentUser = appState.getState('currentUser');
    const userRoles = appState.getState('userRoles') || [];
    const isAdmin = userRoles.includes('admin');
    const projectSelect = document.getElementById('label-project-select');

    if (!projectSelect) {
        console.error('[label-manager] Project select element not found');
        return;
    }

    try {
        let projects = [];

        if (isAdmin) {
            const response = await fetch(`/api/admin/projects?user=${currentUser}`);
            const data = await response.json();
            if (response.ok && data.projects) {
                projects = Object.keys(data.projects);
            } else {
                throw new Error(data.error || '获取项目列表失败');
            }
        } else {
            const response = await fetch(`/api/user/projects?user=${currentUser}`);
            const data = await response.json();
            if (response.ok && data.projects) {
                projects = Array.isArray(data.projects) ? data.projects : Object.keys(data.projects);
            } else {
                throw new Error(data.error || '获取项目列表失败');
            }
        }

        // 清空现有选项
        projectSelect.innerHTML = '<option value="">请选择项目</option>';

        // 添加项目选项
        projects.forEach(projectName => {
            const option = document.createElement('option');
            option.value = projectName;
            option.textContent = projectName;
            projectSelect.appendChild(option);
        });

        console.log('[label-manager] Loaded projects:', projects);

        // 如果有当前项目，选中它
        const currentProject = appState.getState('currentProject');
        if (currentProject && projects.includes(currentProject)) {
            projectSelect.value = currentProject;
            await onProjectSelected(currentProject);
        }
    } catch (error) {
        console.error('[label-manager] Failed to load projects:', error);
        showToast(`加载项目列表失败: ${error.message}`, 'error');
    }
}

/**
 * 设置项目选择器事件
 */
function setupProjectSelectorEvents() {
    const projectSelect = document.getElementById('label-project-select');
    
    if (projectSelect) {
        projectSelect.addEventListener('change', async (e) => {
            const selectedProject = e.target.value;
            await onProjectSelected(selectedProject);
        });
    }
}

/**
 * 当项目被选择时
 */
async function onProjectSelected(projectName) {
    console.log('[label-manager] Project selected:', projectName);
    
    // 更新应用状态
    appState.setState('currentProject', projectName);
    
    // 更新UI显示
    updateProjectInfoDisplay(projectName);
    
    // 加载该项目的标签
    if (projectName) {
        await loadLabelsForManagement();
    } else {
        renderLabelList([]);
    }
}

/**
 * 更新项目信息显示
 */
function updateProjectInfoDisplay(projectName) {
    const projectInfo = document.getElementById('current-project-info');
    const labelFormTitle = document.getElementById('label-form-title');
    const labelFormHint = document.getElementById('label-form-hint');
    
    if (projectInfo) {
        if (projectName) {
            projectInfo.innerHTML = `<span class="project-badge">📁 当前项目：${projectName}</span>`;
        } else {
            projectInfo.innerHTML = `<span class="project-badge project">📁 请选择项目</span>`;
        }
    }
    
    if (labelFormTitle && labelFormHint) {
        if (projectName) {
            labelFormTitle.textContent = `➕ 为项目 "${projectName}" 添加新标签`;
            labelFormHint.textContent = `正在管理项目 "${projectName}" 的标签体系。`;
        } else {
            labelFormTitle.textContent = '➕ 添加新标签';
            labelFormHint.textContent = '请先选择项目后再添加标签。';
        }
    }
}

/**
 * 根据用户角色更新UI
 */
function updateUIForUserRole() {
    const userRoles = appState.getState('userRoles') || [];
    const isAdmin = userRoles.includes('admin');
    
    const adminSection = document.getElementById('label-admin-section');
    const userNotice = document.getElementById('label-user-notice');
    
    if (isAdmin) {
        if (adminSection) adminSection.classList.remove('hidden');
        if (userNotice) userNotice.classList.add('hidden');
    } else {
        if (adminSection) adminSection.classList.add('hidden');
        if (userNotice) userNotice.classList.remove('hidden');
    }
}

/**
 * 设置标签管理事件
 * 从 app.js:5015 迁移
 */
function setupLabelManagementEvents() {
    const addLabelBtn = document.getElementById('add-label-btn');
    const saveEditBtn = document.getElementById('save-edit-label-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-label-btn');
    const newLabelInput = document.getElementById('new-label-name');
    const editLabelInput = document.getElementById('edit-label-name');
    
    if (addLabelBtn) {
        addLabelBtn.addEventListener('click', () => addLabel());
    }
    
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', () => saveLabelEdit());
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => hideEditLabelForm());
    }
    
    // 回车键添加标签
    if (newLabelInput) {
        newLabelInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addLabel();
            }
        });
    }
    
    // 回车键保存编辑
    if (editLabelInput) {
        editLabelInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveLabelEdit();
            }
        });
    }
}

/**
 * 加载标签列表（标注模式用）
 * 从 app.js:1424 迁移
 */
export async function loadLabels() {
    const currentUser = appState.getState('currentUser');
    const currentProject = appState.getState('currentProject');
    
    // 现在需要项目参数，如果没有项目则返回空数组
    if (!currentProject) {
        appState.setState('labels', []);
        eventBus.emit('labels:updated', []);
        return;
    }
    
    try {
        const response = await fetch(`/api/labels?user=${currentUser}&project=${encodeURIComponent(currentProject)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && Array.isArray(data.labels)) {
            appState.setState('labels', data.labels);
            eventBus.emit('labels:updated', data.labels);
        } else {
            appState.setState('labels', []);
            eventBus.emit('labels:updated', []);
        }
    } catch (error) {
        console.error('Failed to load labels:', error);
        appState.setState('labels', []);
        eventBus.emit('labels:updated', []);
        showToast(`加载标签失败: ${error.message}`, 'error');
    }
}

/**
 * 加载标签列表（标签管理模式用）
 * 从 app.js:4967 迁移
 */
export async function loadLabelsForManagement() {
    const currentUser = appState.getState('currentUser');
    const currentProject = appState.getState('currentProject');
    
    if (!currentProject) {
        appState.setState('labels', []);
        renderLabelList([]);
        return;
    }
    
    try {
        const endpoint = `/api/labels?project=${encodeURIComponent(currentProject)}&user=${currentUser}`;
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && Array.isArray(data.labels)) {
            // 为每个标签添加project字段，保持"所属项目"列显示
            const labels = data.labels.map(label => ({
                ...label,
                project: currentProject
            }));
            appState.setState('labels', labels);
            renderLabelList(labels);
        } else {
            appState.setState('labels', []);
            renderLabelList([]);
        }
    } catch (error) {
        console.error('Failed to load labels:', error);
        appState.setState('labels', []);
        renderLabelList([]);
        showToast(`加载标签失败: ${error.message}`, 'error');
    }
}

/**
 * 智能选择下一个可用颜色
 * 从 app.js:1474 迁移
 */
function selectNextAvailableColor() {
    const labels = appState.getState('labels') || [];
    
    // 预定义的颜色列表
    const availableColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B500', '#52B788'
    ];
    
    // 获取当前已使用的颜色
    const usedColors = labels.map(label => label.color).filter(c => c);
    
    // 查找第一个未使用的颜色
    for (const color of availableColors) {
        if (!usedColors.includes(color)) {
            return color;
        }
    }
    
    // 如果所有颜色都用过了，循环使用（根据标签数量取模）
    return availableColors[labels.length % availableColors.length];
}

/**
 * 添加标签
 * 从 app.js:1495 迁移
 */
export async function addLabel() {
    const currentUser = appState.getState('currentUser');
    const currentProject = appState.getState('currentProject');
    const nameInput = document.getElementById('new-label-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        showToast('标签名不能为空', 'warning');
        return;
    }
    
    if (!currentProject) {
        showToast('请先选择项目', 'warning');
        return;
    }
    
    // 智能选择颜色
    const color = selectNextAvailableColor();
    
    try {
        const endpoint = '/api/admin/project_labels';
        const payload = {
            user: currentUser,
            project: currentProject,
            action: 'add',
            label: { name: name, color: color }
        };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast(data.message);
            nameInput.value = '';
            
            // 直接使用返回的标签数据，避免重新加载延迟
            if (data.labels) {
                // 为每个标签添加project字段，保持"所属项目"列显示
                const labels = data.labels.map(label => ({
                    ...label,
                    project: currentProject
                }));
                appState.setState('labels', labels);
                renderLabelList(labels);
            }
            
            // 触发标签更新事件
            eventBus.emit(EVENTS.LABEL_ADDED, { name, color, project: currentProject });
        } else {
            throw new Error(data.error || '添加标签失败');
        }
    } catch (error) {
        showToast(`添加标签失败: ${error.message}`, 'error');
    }
}

/**
 * 保存标签编辑
 * 从 app.js:1558 迁移
 */
export async function saveLabelEdit() {
    const currentUser = appState.getState('currentUser');
    const currentProject = appState.getState('currentProject');
    const labels = appState.getState('labels') || [];
    
    const id = parseInt(document.getElementById('edit-label-id').value);
    const name = document.getElementById('edit-label-name').value.trim();
    
    if (!name) {
        showToast('标签名不能为空', 'warning');
        return;
    }
    
    if (!currentProject) {
        showToast('请先选择项目', 'warning');
        return;
    }
    
    // 获取原标签的颜色，编辑时保留
    const originalLabel = labels.find(label => label.id === id);
    const color = originalLabel ? originalLabel.color : '#FF6B6B';
    
    try {
        const endpoint = '/api/admin/project_labels';
        const payload = {
            user: currentUser,
            project: currentProject,
            action: 'edit',
            label: { id: id, name: name, color: color }
        };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast(data.message);
            hideEditLabelForm();
            
            // 直接使用返回的标签数据，避免重新加载延迟
            if (data.labels) {
                // 为每个标签添加project字段，保持"所属项目"列显示
                const labels = data.labels.map(label => ({
                    ...label,
                    project: currentProject
                }));
                appState.setState('labels', labels);
                renderLabelList(labels);
            }
            
            // 触发标签更新事件
            eventBus.emit(EVENTS.LABEL_UPDATED, { id, name, project: currentProject });
        } else {
            throw new Error(data.error || '编辑标签失败');
        }
    } catch (error) {
        showToast(`编辑标签失败: ${error.message}`, 'error');
    }
}

/**
 * 删除标签
 * 从 app.js:1622 迁移
 */
export async function deleteLabel(id) {
    const currentUser = appState.getState('currentUser');
    const currentProject = appState.getState('currentProject');
    
    if (!currentProject) {
        showToast('请先选择项目', 'warning');
        return;
    }
    
    const result = await showConfirm(
        `确定要删除这个项目标签吗？`,
        [
            `标注该项目标签的图像需要清空重新标注`
        ],
        `删除项目标签`
    );
    
    if (!result) {
        return;
    }
    
    try {
        const endpoint = '/api/admin/project_labels';
        const payload = {
            user: currentUser,
            project: currentProject,
            action: 'delete',
            label: { id: id }
        };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast(data.message);
            
            // 直接使用返回的标签数据，避免重新加载延迟
            if (data.labels) {
                // 为每个标签添加project字段，保持"所属项目"列显示
                const labels = data.labels.map(label => ({
                    ...label,
                    project: currentProject
                }));
                appState.setState('labels', labels);
                renderLabelList(labels);
            }
            
            // 触发标签删除事件
            eventBus.emit(EVENTS.LABEL_DELETED, { id, project: currentProject });
        } else {
            throw new Error(data.error || '删除标签失败');
        }
    } catch (error) {
        showToast(`删除标签失败: ${error.message}`, 'error');
    }
}

/**
 * 显示编辑标签表单
 * 从 app.js:1455 迁移
 */
export function showEditLabelForm(id, name) {
    const editIdInput = document.getElementById('edit-label-id');
    const editNameInput = document.getElementById('edit-label-name');
    const editArea = document.getElementById('label-edit-area');
    
    if (editIdInput) editIdInput.value = id;
    if (editNameInput) editNameInput.value = name;
    if (editArea) editArea.classList.remove('hidden');
    
    // 滚动到编辑区域
    if (editArea) {
        editArea.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

/**
 * 隐藏编辑标签表单
 * 从 app.js:1467 迁移
 */
export function hideEditLabelForm() {
    const editIdInput = document.getElementById('edit-label-id');
    const editNameInput = document.getElementById('edit-label-name');
    const editArea = document.getElementById('label-edit-area');
    
    if (editArea) editArea.classList.add('hidden');
    if (editIdInput) editIdInput.value = '';
    if (editNameInput) editNameInput.value = '';
}

/**
 * 渲染标签列表
 * 从 app.js:5041 迁移，优化为列表内编辑和底部添加
 */
export function renderLabelList(labels) {
    const currentProject = appState.getState('currentProject');
    const userRoles = appState.getState('userRoles') || [];
    const isAdmin = Array.isArray(userRoles) && userRoles.includes('admin');
    const labelListContainer = document.getElementById('label-list-container');
    const labelCount = document.getElementById('label-count');
    
    if (!labelListContainer) return;
    
    labelListContainer.innerHTML = '';
    
    // 如果没有项目，显示提示
    if (!currentProject) {
        labelListContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <h3>请先选择项目</h3>
                <p>请在上方选择一个项目后查看和管理标签</p>
            </div>
        `;
        if (labelCount) labelCount.textContent = '共 0 个标签';
        return;
    }
    
    // 更新标签计数
    if (labelCount) {
        labelCount.textContent = `共 ${labels.length} 个标签`;
    }
    
    // 创建标签表格
    const table = document.createElement('table');
    table.className = 'label-management-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="col-id">#️⃣ ID</th>
            <th class="col-name">📛 标签名称</th>
            <th class="col-color">🎨 颜色</th>
            ${isAdmin ? '<th class="col-actions">⚡ 操作</th>' : ''}
        </tr>
    `;
    table.appendChild(thead);
    
    // 表体
    const tbody = document.createElement('tbody');
    
    // 渲染现有标签行
    labels.forEach(label => {
        const row = createLabelRow(label, isAdmin);
        tbody.appendChild(row);
    });
    
    // 如果是管理员，在底部添加新标签行
    if (isAdmin) {
        const addRow = createAddLabelRow();
        tbody.appendChild(addRow);
    }
    
    table.appendChild(tbody);
    labelListContainer.appendChild(table);
    
    // 如果没有标签且不是管理员，显示提示
    if (!labels || labels.length === 0 && !isAdmin) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="3" class="empty-message">
                暂无标签，请联系管理员添加标签
            </td>
        `;
        tbody.appendChild(emptyRow);
    }
}

/**
 * 创建标签行
 */
function createLabelRow(label, isAdmin) {
    const row = document.createElement('tr');
    row.className = 'label-row';
    row.dataset.id = label.id;
    const labelColor = label.color || '#FF6B6B';
    
    row.innerHTML = `
        <td class="label-id-cell">${label.id}</td>
        <td class="label-name-cell ${isAdmin ? 'editable' : ''}">
            <span class="label-name-display">${label.name}</span>
            ${isAdmin ? `
                <input type="text" class="label-name-edit hidden" value="${label.name}">
                <div class="edit-actions hidden">
                    <button class="btn-save-inline">✓</button>
                    <button class="btn-cancel-inline">✕</button>
                </div>
            ` : ''}
        </td>
        <td class="label-color-cell">
            <div class="color-indicator">
                <span class="color-box" style="background-color: ${labelColor};"></span>
                <span class="color-code">${labelColor}</span>
            </div>
        </td>
        ${isAdmin ? `
            <td class="label-actions-cell">
                <div class="action-buttons">
                    <button class="label-action-btn edit-inline" title="编辑">
                        <span class="btn-icon">✏️</span>
                    </button>
                    <button class="label-action-btn delete" title="删除">
                        <span class="btn-icon">🗑️</span>
                    </button>
                </div>
            </td>
        ` : ''}
    `;
    
    if (isAdmin) {
        // 绑定编辑事件
        const nameCell = row.querySelector('.label-name-cell');
        const nameDisplay = row.querySelector('.label-name-display');
        const nameEdit = row.querySelector('.label-name-edit');
        const editActions = row.querySelector('.edit-actions');
        const editBtn = row.querySelector('.edit-inline');
        const saveBtn = row.querySelector('.btn-save-inline');
        const cancelBtn = row.querySelector('.btn-cancel-inline');
        const deleteBtn = row.querySelector('.delete');
        
        // 点击编辑按钮进入编辑模式
        editBtn.addEventListener('click', () => {
            enterEditMode(nameCell, nameDisplay, nameEdit, editActions, editBtn);
        });
        
        // 双击标签名进入编辑模式
        nameDisplay.addEventListener('dblclick', () => {
            enterEditMode(nameCell, nameDisplay, nameEdit, editActions, editBtn);
        });
        
        // 保存编辑
        saveBtn.addEventListener('click', () => {
            const newName = nameEdit.value.trim();
            if (newName && newName !== label.name) {
                saveLabelEditInline(label, newName, row, nameDisplay, nameCell, nameEdit, editActions, editBtn);
            } else {
                exitEditMode(nameCell, nameDisplay, nameEdit, editActions, editBtn);
            }
        });
        
        // 取消编辑
        cancelBtn.addEventListener('click', () => {
            nameEdit.value = label.name;
            exitEditMode(nameCell, nameDisplay, nameEdit, editActions, editBtn);
        });
        
        // 回车保存，ESC取消
        nameEdit.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
        
        // 删除标签
        deleteBtn.addEventListener('click', () => {
            deleteLabel(label.id);
        });
    }
    
    return row;
}

/**
 * 创建添加标签行
 */
function createAddLabelRow() {
    const row = document.createElement('tr');
    row.className = 'label-add-row';
    
    row.innerHTML = `
        <td class="label-id-cell">
            <span class="add-icon"></span>
        </td>
        <td class="label-name-cell">
            <input type="text" class="label-name-add" placeholder="输入新标签名称...">
        </td>
        <td class="label-color-cell">
            <div class="color-indicator">
                <span class="color-box auto-color" style="background-color: #999;"></span>
                <span class="color-code">自动</span>
            </div>
        </td>
        <td class="label-actions-cell">
            <button class="label-action-btn add-submit" title="添加">
                <span class="btn-icon">+</span>
            </button>
        </td>
    `;
    
    const nameInput = row.querySelector('.label-name-add');
    const addBtn = row.querySelector('.add-submit');
    
    // 添加标签
    addBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            addLabelInline(name, nameInput);
        } else {
            showToast('请输入标签名称', 'warning');
            nameInput.focus();
        }
    });
    
    // 回车添加
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addBtn.click();
        }
    });
    
    return row;
}

/**
 * 进入编辑模式
 */
function enterEditMode(cell, display, edit, actions, editBtn) {
    cell.classList.add('editing');
    display.classList.add('hidden');
    edit.classList.remove('hidden');
    actions.classList.remove('hidden');
    editBtn.style.visibility = 'hidden';
    edit.focus();
    edit.select();
}

/**
 * 退出编辑模式
 */
function exitEditMode(cell, display, edit, actions, editBtn) {
    cell.classList.remove('editing');
    display.classList.remove('hidden');
    edit.classList.add('hidden');
    actions.classList.add('hidden');
    editBtn.style.visibility = 'visible';
}

/**
 * 列表内保存标签编辑
 */
async function saveLabelEditInline(label, newName, row, display, cell, edit, actions, editBtn) {
    const currentUser = appState.getState('currentUser');
    const currentProject = appState.getState('currentProject');
    
    try {
        const response = await fetch('/api/admin/project_labels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: currentUser,
                project: currentProject,
                action: 'edit',
                label: {
                    id: label.id,
                    name: newName,
                    color: label.color
                }
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast(data.message);
            display.textContent = newName;
            edit.value = newName;
            row.querySelector('.edit-inline').dataset.name = newName;
            exitEditMode(cell, display, edit, actions, editBtn);
            
            // 更新状态
            if (data.labels) {
                const labels = data.labels.map(label => ({
                    ...label,
                    project: currentProject
                }));
                appState.setState('labels', labels);
            }
            
            eventBus.emit(EVENTS.LABEL_UPDATED, { id: label.id, name: newName, project: currentProject });
        } else {
            throw new Error(data.error || '修改标签失败');
        }
    } catch (error) {
        showToast(`修改标签失败: ${error.message}`, 'error');
        edit.value = display.textContent;
    }
}

/**
 * 列表内添加标签
 */
async function addLabelInline(name, nameInput) {
    const currentUser = appState.getState('currentUser');
    const currentProject = appState.getState('currentProject');
    
    if (!currentProject) {
        showToast('请先选择项目', 'warning');
        return;
    }
    
    const color = selectNextAvailableColor();
    
    try {
        const response = await fetch('/api/admin/project_labels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: currentUser,
                project: currentProject,
                action: 'add',
                label: { name: name, color: color }
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast(data.message);
            nameInput.value = '';
            
            // 重新渲染列表
            if (data.labels) {
                const labels = data.labels.map(label => ({
                    ...label,
                    project: currentProject
                }));
                appState.setState('labels', labels);
                renderLabelList(labels);
            }
            
            eventBus.emit(EVENTS.LABEL_ADDED, { name, color, project: currentProject });
        } else {
            throw new Error(data.error || '添加标签失败');
        }
    } catch (error) {
        showToast(`添加标签失败: ${error.message}`, 'error');
    }
}

export default {
    init,
    loadLabels,
    loadLabelsForManagement,
    addLabel,
    saveLabelEdit,
    deleteLabel,
    showEditLabelForm,
    hideEditLabelForm,
    renderLabelList
};
