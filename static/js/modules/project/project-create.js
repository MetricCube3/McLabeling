/**
 * 项目创建模块
 * 处理新项目的创建
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { loadProjects } from './project-list.js';

// 防止重复初始化
let isInitialized = false;

/**
 * 初始化项目创建模块
 */
export function init() {
    console.log('[project-create] Initializing project create module');
    
    // 防止重复初始化
    if (isInitialized) {
        console.log('[project-create] Already initialized, skipping');
        return;
    }
    
    setupCreateProjectEvents();
    
    // 初始化时添加一个空的标签输入框
    const initialLabelsContainer = document.getElementById('initial-labels-container');
    console.log('[project-create] initialLabelsContainer:', initialLabelsContainer);
    
    // 只计算标签输入框的数量（排除添加按钮）
    const labelFieldCount = initialLabelsContainer?.querySelectorAll('.label-field').length || 0;
    console.log('[project-create] Label field count:', labelFieldCount);
    
    if (initialLabelsContainer && labelFieldCount === 0) {
        console.log('[project-create] Adding initial label field');
        addInitialLabelField();
    }
    
    isInitialized = true;
    console.log('[project-create] Initialization complete');
}

/**
 * 设置创建项目相关事件
 * 从 app.js:1410 迁移
 */
function setupCreateProjectEvents() {
    const createBtn = document.getElementById('create-project-btn');
    const clearBtn = document.getElementById('clear-project-form-btn');
    const addLabelBtn = document.getElementById('add-initial-label-btn');
    const newProjectNameInput = document.getElementById('new-project-name');
    
    console.log('[project-create] Setting up events');
    console.log('[project-create] createBtn:', createBtn);
    console.log('[project-create] clearBtn:', clearBtn);
    console.log('[project-create] addLabelBtn:', addLabelBtn);
    console.log('[project-create] newProjectNameInput:', newProjectNameInput);
    
    // 移除旧的事件监听器（使用克隆替换方式）
    if (createBtn) {
        const newCreateBtn = createBtn.cloneNode(true);
        createBtn.parentNode.replaceChild(newCreateBtn, createBtn);
        newCreateBtn.addEventListener('click', () => {
            console.log('[project-create] Create button clicked');
            createProject();
        });
    }
    
    if (clearBtn) {
        const newClearBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
        newClearBtn.addEventListener('click', () => {
            console.log('[project-create] Clear button clicked');
            clearProjectForm();
        });
    }
    
    if (addLabelBtn) {
        const newAddLabelBtn = addLabelBtn.cloneNode(true);
        addLabelBtn.parentNode.replaceChild(newAddLabelBtn, addLabelBtn);
        newAddLabelBtn.addEventListener('click', () => {
            console.log('[project-create] Add label button clicked');
            addInitialLabelField();
        });
    }
    
    // 回车键创建项目
    if (newProjectNameInput) {
        const newProjectInput = newProjectNameInput.cloneNode(true);
        newProjectNameInput.parentNode.replaceChild(newProjectInput, newProjectNameInput);
        newProjectInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('[project-create] Enter key pressed');
                createProject();
            }
        });
    }
}

/**
 * 创建项目
 * 从 app.js:1290 迁移
 */
async function createProject() {
    const currentUser = appState.getState('currentUser');
    const newProjectNameInput = document.getElementById('new-project-name');
    const projectName = newProjectNameInput.value.trim();
    const initialLabels = getInitialLabels();
    
    if (!projectName) {
        showToast('项目名称不能为空', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/create_project?user=${currentUser}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_name: projectName,
                description: '',
                labels: initialLabels
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast(data.message);
            clearProjectForm();
            await loadProjects(); // 刷新项目列表
            
            eventBus.emit(EVENTS.PROJECT_CREATED, { projectName, labels: initialLabels });
        } else {
            throw new Error(data.detail || data.error || '创建项目失败');
        }
    } catch (error) {
        showToast(`创建项目失败: ${error.message}`, 'error');
    }
}

/**
 * 获取初始标签
 * 从 app.js:1259 迁移
 */
function getInitialLabels() {
    const initialLabelsContainer = document.getElementById('initial-labels-container');
    if (!initialLabelsContainer) return [];
    
    const labelInputs = initialLabelsContainer.querySelectorAll('.label-input');
    const labels = [];
    
    // 预定义的颜色列表
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B500', '#52B788'
    ];
    
    labelInputs.forEach((input, index) => {
        const name = input.value.trim();
        if (name) {
            labels.push({
                id: index,
                name: name,
                color: colors[index % colors.length]  // 循环使用颜色
            });
        }
    });
    
    return labels;
}

/**
 * 清空项目表单
 * 从 app.js:1283 迁移
 */
function clearProjectForm() {
    const newProjectNameInput = document.getElementById('new-project-name');
    const initialLabelsContainer = document.getElementById('initial-labels-container');
    
    if (newProjectNameInput) {
        newProjectNameInput.value = '';
    }
    
    if (initialLabelsContainer) {
        // 只删除标签输入框，保留添加按钮
        const labelFields = initialLabelsContainer.querySelectorAll('.label-field');
        labelFields.forEach(field => field.remove());
        
        // 添加一个空的标签输入框
        addInitialLabelField();
    }
}

/**
 * 添加初始标签字段
 * 从 app.js:1240 迁移
 */
export function addInitialLabelField() {
    console.log('[project-create] addInitialLabelField called');
    const initialLabelsContainer = document.getElementById('initial-labels-container');
    
    if (!initialLabelsContainer) {
        console.error('[project-create] initialLabelsContainer not found!');
        return;
    }
    
    const labelId = Date.now(); // 临时ID
    const labelField = document.createElement('div');
    labelField.className = 'label-field';
    labelField.innerHTML = `
        <input type="text" class="label-input" placeholder="标签名称" data-id="${labelId}">
        <button class="remove-label-btn" type="button">
            <span class="btn-icon">❌</span>
        </button>
    `;
    
    const removeBtn = labelField.querySelector('.remove-label-btn');
    removeBtn.addEventListener('click', () => {
        console.log('[project-create] Remove label button clicked');
        labelField.remove();
        
        // 如果删除后没有标签输入框了，至少保留一个
        const remainingFields = initialLabelsContainer.querySelectorAll('.label-field');
        if (remainingFields.length === 0) {
            console.log('[project-create] No label fields left, adding one back');
            addInitialLabelField();
        }
    });
    
    // 找到添加按钮，在它之前插入新的输入框
    const addButton = initialLabelsContainer.querySelector('.btn-add-label');
    if (addButton) {
        initialLabelsContainer.insertBefore(labelField, addButton);
    } else {
        // 如果没有找到按钮（不应该发生），就直接添加
        initialLabelsContainer.appendChild(labelField);
    }
    
    const labelFieldCount = initialLabelsContainer.querySelectorAll('.label-field').length;
    console.log('[project-create] Label field added, total fields:', labelFieldCount);
}

export default {
    init,
    createProject,
    clearProjectForm,
    addInitialLabelField
};
