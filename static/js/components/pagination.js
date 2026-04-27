/**
 * 分页组件
 * 提供通用的分页功能
 */

/**
 * 创建分页控件
 * @param {Object} options - 分页选项
 * @returns {HTMLElement} 分页元素
 */
export function createPagination(options = {}) {
    const {
        currentPage = 1,
        totalPages = 1,
        onPageChange = null,
        showFirstLast = true
    } = options;
    
    const container = document.createElement('div');
    container.className = 'pagination-controls';
    
    // 第一页按钮
    if (showFirstLast) {
        container.appendChild(createButton('«', 'first-page', () => {
            if (onPageChange && currentPage > 1) onPageChange(1);
        }, currentPage === 1));
    }
    
    // 上一页按钮
    container.appendChild(createButton('‹', 'prev-page', () => {
        if (onPageChange && currentPage > 1) onPageChange(currentPage - 1);
    }, currentPage === 1));
    
    // 页码信息
    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.innerHTML = `<span class="current-page">${currentPage}</span> / <span class="total-pages">${totalPages}</span>`;
    container.appendChild(pageInfo);
    
    // 下一页按钮
    container.appendChild(createButton('›', 'next-page', () => {
        if (onPageChange && currentPage < totalPages) onPageChange(currentPage + 1);
    }, currentPage >= totalPages));
    
    // 最后一页按钮
    if (showFirstLast) {
        container.appendChild(createButton('»', 'last-page', () => {
            if (onPageChange && currentPage < totalPages) onPageChange(totalPages);
        }, currentPage >= totalPages));
    }
    
    return container;
}

/**
 * 创建分页按钮
 */
function createButton(text, className, onClick, disabled = false) {
    const button = document.createElement('button');
    button.className = `pagination-btn ${className}`;
    button.innerHTML = `<span class="btn-icon">${text}</span>`;
    button.disabled = disabled;
    
    if (onClick) {
        button.addEventListener('click', onClick);
    }
    
    return button;
}

/**
 * 更新分页信息
 */
export function updatePagination(container, currentPage, totalPages) {
    const currentPageSpan = container.querySelector('.current-page');
    const totalPagesSpan = container.querySelector('.total-pages');
    const buttons = container.querySelectorAll('button');
    
    if (currentPageSpan) currentPageSpan.textContent = currentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalPages;
    
    // 更新按钮状态
    const [firstBtn, prevBtn, nextBtn, lastBtn] = buttons;
    
    if (firstBtn) firstBtn.disabled = currentPage === 1;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (lastBtn) lastBtn.disabled = currentPage >= totalPages;
}

export default {
    createPagination,
    updatePagination
};
