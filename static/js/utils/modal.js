/**
 * 模态框管理工具
 * 用于显示和管理模态对话框
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * 显示自定义确认对话框
 * 从 app.js 迁移而来
 * @param {string} message - 主要消息
 * @param {Array<string>} details - 详细信息列表
 * @param {string} title - 对话框标题
 * @returns {Promise<boolean>} 用户选择结果
 */
export function showConfirm(message, details = [], title = "确认操作") {
    return new Promise((resolve) => {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'custom-confirm-modal';

        // 构建对话框内容
        modal.innerHTML = `
            <div class="custom-confirm-dialog">
                <div class="custom-confirm-header">
                    <div class="custom-confirm-icon">⚠️</div>
                    <h3 class="custom-confirm-title">${title}</h3>
                </div>
                
                <div class="custom-confirm-content">
                    <div class="custom-confirm-message">${message}</div>
                    
                    ${details.length > 0 ? `
                        <div class="custom-confirm-details">
                            <ul>
                                ${details.map(detail => `<li>${detail}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div class="custom-confirm-warning">
                        <span class="custom-confirm-warning-icon">🚨</span>
                        此操作不可恢复！
                    </div>
                </div>
                
                <div class="custom-confirm-actions">
                    <button class="custom-confirm-btn cancel" type="button">取消</button>
                    <button class="custom-confirm-btn confirm" type="button">确认删除</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(modal);

        // 获取按钮元素
        const confirmBtn = modal.querySelector('.custom-confirm-btn.confirm');
        const cancelBtn = modal.querySelector('.custom-confirm-btn.cancel');

        // 清理函数
        const cleanup = () => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
            document.removeEventListener('keydown', handleEscKey);
        };

        // 确认按钮事件
        confirmBtn.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });

        // 取消按钮事件
        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });

        // ESC键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEscKey);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(false);
            }
        });

        // 自动聚焦取消按钮（更安全）
        cancelBtn.focus();
        
        eventBus.emit(EVENTS.MODAL_SHOW, { type: 'confirm', message, details, title });
    });
}

/**
 * 显示自定义确认对话框（带更多选项的版本）
 * @param {string} message - 主要消息
 * @param {Object} options - 选项
 * @returns {Promise<boolean>} 用户选择结果
 */
export function showConfirmAdvanced(message, options = {}) {
    const {
        title = '确认操作',
        details = [],
        confirmText = '确认',
        cancelText = '取消',
        confirmClass = 'confirm',
        showWarning = true
    } = options;
    
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'custom-confirm-modal';
        
        modal.innerHTML = `
            <div class="custom-confirm-dialog">
                <div class="custom-confirm-header">
                    <div class="custom-confirm-icon">⚠️</div>
                    <h3 class="custom-confirm-title">${title}</h3>
                </div>
                
                <div class="custom-confirm-content">
                    <div class="custom-confirm-message">${message}</div>
                    
                    ${details.length > 0 ? `
                        <div class="custom-confirm-details">
                            <ul>
                                ${details.map(detail => `<li>${detail}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${showWarning ? `
                        <div class="custom-confirm-warning">
                            <span class="custom-confirm-warning-icon">🚨</span>
                            此操作不可恢复！
                        </div>
                    ` : ''}
                </div>
                
                <div class="custom-confirm-actions">
                    <button class="custom-confirm-btn cancel" type="button">${cancelText}</button>
                    <button class="custom-confirm-btn ${confirmClass}" type="button">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const confirmBtn = modal.querySelector(`.custom-confirm-btn.${confirmClass}`);
        const cancelBtn = modal.querySelector('.custom-confirm-btn.cancel');
        
        const cleanup = () => {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', handleEscKey);
        };
        
        confirmBtn.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });
        
        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });
        
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };
        
        document.addEventListener('keydown', handleEscKey);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(false);
            }
        });
        
        cancelBtn.focus();
        
        eventBus.emit(EVENTS.MODAL_SHOW, { type: 'confirm', message });
    });
}

/**
 * 显示通用模态框
 * @param {string|HTMLElement} content - 内容
 * @param {Object} options - 选项
 * @returns {Object} 模态框控制对象
 */
export function showModal(content, options = {}) {
    const {
        className = '',
        closable = true,
        onClose = null
    } = options;
    
    const modal = document.createElement('div');
    modal.className = `modal-overlay ${className}`;
    
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    
    if (typeof content === 'string') {
        dialog.innerHTML = content;
    } else {
        dialog.appendChild(content);
    }
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    const closeModal = () => {
        document.body.removeChild(modal);
        if (onClose) onClose();
        eventBus.emit(EVENTS.MODAL_CLOSE);
    };
    
    if (closable) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        
        document.addEventListener('keydown', handleEscKey);
    }
    
    eventBus.emit(EVENTS.MODAL_SHOW, { content, options });
    
    return {
        close: closeModal,
        element: modal
    };
}

/**
 * 关闭所有模态框
 */
export function closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        document.body.removeChild(modal);
    });
}

/**
 * 显示加载中模态框
 * @param {string} message - 加载消息
 * @returns {Object} 模态框控制对象
 */
export function showLoadingModal(message = '加载中...') {
    const content = `
        <div class="loading-modal-content">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
    
    return showModal(content, {
        className: 'loading-modal',
        closable: false
    });
}

export default {
    showConfirm,
    showModal,
    closeAllModals,
    showLoadingModal
};
