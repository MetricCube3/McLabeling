/**
 * 模型选择器模块
 * 提供用户界面以切换自动标注使用的模型类型
 */

import { setModelType, getModelType } from './auto-annotate.js';
import { showToast } from '../../utils/toast.js';

let selectorContainer = null;
let modelButtons = {};

/**
 * 初始化模型选择器
 */
export function init() {
    createSelectorUI();
    setupEventListeners();
}

/**
 * 创建模型选择器UI
 */
function createSelectorUI() {
    // 查找自动标注按钮的容器
    const autoAnnotateBtn = document.getElementById('auto-annotate-btn');
    
    if (!autoAnnotateBtn) {
        console.warn('Auto annotate button not found, model selector not created');
        return;
    }
    
    // 创建选择器容器
    selectorContainer = document.createElement('div');
    selectorContainer.id = 'model-selector-container';
    selectorContainer.className = 'model-selector-container';
    selectorContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        margin-left: 10px;
        gap: 5px;
    `;
    
    // 创建标签
    const label = document.createElement('span');
    label.textContent = '模型:';
    label.style.cssText = `
        font-size: 12px;
        color: #666;
        margin-right: 5px;
    `;
    selectorContainer.appendChild(label);
    
    // 创建YOLO按钮
    const yoloBtn = createModelButton('YOLO', 'yolo');
    modelButtons.yolo = yoloBtn;
    selectorContainer.appendChild(yoloBtn);
    
    // 创建LocateAnything按钮
    const locateBtn = createModelButton('LocateAnything', 'locate');
    modelButtons.locate = locateBtn;
    selectorContainer.appendChild(locateBtn);
    
    // 插入到自动标注按钮后面
    autoAnnotateBtn.parentNode.insertBefore(selectorContainer, autoAnnotateBtn.nextSibling);
    
    // 设置初始状态
    updateActiveButton(getModelType());
}

/**
 * 创建模型按钮
 */
function createModelButton(label, modelType) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'model-selector-btn';
    btn.dataset.modelType = modelType;
    btn.style.cssText = `
        padding: 4px 10px;
        font-size: 12px;
        border: 1px solid #ddd;
        background-color: #fff;
        color: #333;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
    `;
    
    // 悬停效果
    btn.addEventListener('mouseenter', () => {
        if (!btn.classList.contains('active')) {
            btn.style.backgroundColor = '#f5f5f5';
        }
    });
    
    btn.addEventListener('mouseleave', () => {
        if (!btn.classList.contains('active')) {
            btn.style.backgroundColor = '#fff';
        }
    });
    
    return btn;
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    if (!selectorContainer) return;
    
    selectorContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.model-selector-btn');
        if (!btn) return;
        
        const modelType = btn.dataset.modelType;
        switchModel(modelType);
    });
}

/**
 * 切换模型
 */
function switchModel(modelType) {
    setModelType(modelType);
    updateActiveButton(modelType);
    
    const modelName = modelType === 'locate' ? 'LocateAnything' : 'YOLO';
    showToast(`已切换到 ${modelName} 模型`, 'success');
}

/**
 * 更新激活按钮样式
 */
function updateActiveButton(modelType) {
    Object.entries(modelButtons).forEach(([type, btn]) => {
        if (type === modelType) {
            btn.classList.add('active');
            btn.style.backgroundColor = '#3b82f6';
            btn.style.color = '#fff';
            btn.style.borderColor = '#3b82f6';
        } else {
            btn.classList.remove('active');
            btn.style.backgroundColor = '#fff';
            btn.style.color = '#333';
            btn.style.borderColor = '#ddd';
        }
    });
}

/**
 * 显示模型状态
 */
export async function showModelStatus() {
    try {
        // 检查 YOLO 模型状态
        const yoloResponse = await fetch('/api/models/active');
        const yoloData = await yoloResponse.json();
        
        // 检查 LocateAnything 模型状态
        const locateResponse = await fetch('/api/models/locate/status');
        const locateData = await locateResponse.json();
        
        let message = '模型状态:\n';
        message += `YOLO: ${yoloData.active_model || '未设置'}\n`;
        message += `LocateAnything: ${locateData.status || '未加载'}`;
        
        showToast(message, 'info');
        
    } catch (error) {
        console.error('Failed to get model status:', error);
    }
}

export default {
    init,
    showModelStatus
};
