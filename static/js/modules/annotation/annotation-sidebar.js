/**
 * 标注侧边栏模块
 * 处理对象列表的渲染和交互
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { getAnnotationState, setActiveObject, toggleObjectVisibility, deleteObject, updateObjectClassId } from './annotation-state.js';

let objectList = null;
let hoveredObjectIndex = -1; // 来自图像悬停的列表高亮目标

/**
 * 初始化侧边栏模块
 */
export function init() {
    objectList = document.getElementById('object-list');
    
    // 点击列表空白区域取消选定
    if (objectList) {
        objectList.addEventListener('click', (e) => {
            if (!e.target.closest('.object-item')) {
                setActiveObject(-1);
            }
        });
    }
    
    // 订阅标注状态变化事件
    eventBus.on(EVENTS.ANNOTATION_STATE_CHANGED, renderSidebar);
    eventBus.on(EVENTS.ANNOTATION_ACTIVE_OBJECT_CHANGED, renderSidebar);
    eventBus.on(EVENTS.LABEL_LIST_UPDATED, renderSidebar);
    eventBus.on(EVENTS.ANNOTATION_OBJECT_HOVERED, handleObjectHovered);
}

/**
 * 渲染侧边栏对象列表
 * 从 app.js:1812 迁移
 */
export function renderSidebar() {
    if (!objectList) return;
    
    objectList.innerHTML = '';
    
    // 更新侧边栏标题中的对象计数
    updateObjectCount();
    
    const currentProject = appState.getState('currentProject');
    
    // 如果没有当前项目，显示提示
    if (!currentProject) {
        objectList.innerHTML = `
            <div class="no-project-message">
                <p>⚠️ 请先选择项目</p>
                <p>在标签管理界面中选择项目后，才能开始标注</p>
            </div>
        `;
        return;
    }
    
    const labels = appState.getState('labels') || [];
    const validLabels = Array.isArray(labels) ? labels : [];
    const annotationState = getAnnotationState();
    
    // 如果没有标注对象，显示提示
    if (!annotationState.objects || annotationState.objects.length === 0) {
        objectList.innerHTML = `
            <div class="no-annotations-message">
                <p>📝 请添加标注</p>
                <p class="hint">按 X 键或点击"添加新实例"按钮开始标注</p>
            </div>
        `;
        return;
    }
    
    annotationState.objects.forEach((obj, index) => {
        const currentLabel = validLabels.find(label => label.id === obj.classId) || {
            name: `标签 ${obj.classId}`
        };
        
        const isActive = index === annotationState.activeObjectIndex;
        const isHovered = index === hoveredObjectIndex;
        const itemClass = `object-item${isActive ? ' active' : ''}${isHovered ? ' hover-highlight' : ''}`;
        
        const item = document.createElement('div');
        item.className = itemClass;
        item.dataset.index = index;
        item.innerHTML = `
            <span class="object-color-swatch" style="background-color: ${obj.color};"></span>
            <span class="object-name">标注 ${obj.id}</span>
            <select class="object-class-select">
                ${validLabels.map(label => 
                    `<option value="${label.id}" ${obj.classId === label.id ? 'selected' : ''}>${label.name}</option>`
                ).join('')}
            </select>
            <div class="object-actions">
                <button class="visibility-btn" title="显示/隐藏">${obj.isVisible ? '👁️' : '🚫'}</button>
                <button class="delete-btn" title="删除">🗑️</button>
            </div>`;
        
        // 可见性按钮事件
        item.querySelector('.visibility-btn').onclick = (e) => {
            e.stopPropagation();
            toggleObjectVisibility(index);
        };
        
        // 删除按钮事件
        item.querySelector('.delete-btn').onclick = (e) => {
            e.stopPropagation();
            deleteObject(index);
        };
        
        // 标签选择器事件
        const classSelect = item.querySelector('.object-class-select');
        
        // mousedown 事件：阻止冒泡但允许默认行为（下拉框展开）
        classSelect.onmousedown = (e) => {
            e.stopPropagation();
        };
        
        // click 事件：阻止冒泡
        classSelect.onclick = (e) => {
            e.stopPropagation();
        };
        
        // change 事件：处理选择变化
        classSelect.onchange = (e) => {
            e.stopPropagation();
            updateObjectClassId(index, parseInt(e.target.value));
        };
        
        // 点击项目设置为活动对象
        item.onclick = () => setActiveObject(index);
        
        // 鼠标悬停列表项 → 高亮图像中对应标注目标
        item.onmouseenter = () => {
            eventBus.emit(EVENTS.ANNOTATION_LIST_HOVERED, index);
        };
        
        // 鼠标离开列表项 → 取消图像高亮
        item.onmouseleave = () => {
            eventBus.emit(EVENTS.ANNOTATION_LIST_HOVERED, -1);
        };
        
        objectList.appendChild(item);
    });
    
    // 滚动高亮的列表项到可视区域
    scrollToHighlightedItem();
}

/**
 * 处理图像中标注对象悬停事件
 */
function handleObjectHovered(index) {
    const oldHover = hoveredObjectIndex;
    hoveredObjectIndex = index;
    if (oldHover !== hoveredObjectIndex) {
        renderSidebar();
    }
}

/**
 * 滚动高亮的列表项到可视区域
 */
function scrollToHighlightedItem() {
    if (!objectList || hoveredObjectIndex === -1) return;
    
    const highlightedItem = objectList.querySelector('.hover-highlight');
    if (highlightedItem) {
        highlightedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * 更新侧边栏标题中的对象计数
 */
function updateObjectCount() {
    const sidebarHeader = document.querySelector('#sidebar .sidebar-header h3');
    if (!sidebarHeader) return;
    
    const annotationState = getAnnotationState();
    const count = annotationState.objects ? annotationState.objects.length : 0;
    
    // 更新标题文本，显示对象个数
    sidebarHeader.textContent = `标注列表 (${count})`;
}

export default {
    init,
    renderSidebar
};
