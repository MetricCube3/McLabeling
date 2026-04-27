/**
 * 数据集列表模块
 * 显示和管理数据集列表
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm } from '../../utils/modal.js';
import * as datasetUpload from './dataset-upload.js';

// 分页状态
const paginationState = {
    currentPage: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1,
    allDatasets: []
};

// 防止重复初始化
let isInitialized = false;

/**
 * 初始化数据集列表模块
 */
export async function init() {
    if (isInitialized) {
        console.log('[dataset-list] Already initialized, skipping...');
        // 重新加载数据
        await loadProjectsForDatasetManagement();
        await loadDatasetStats();
        await loadDatasetList();
        return;
    }
    
    console.log('[dataset-list] Initializing dataset management module');
    
    setupDatasetEvents();
    
    // 初始化上传模块
    datasetUpload.init();
    
    // 加载项目列表
    await loadProjectsForDatasetManagement();
    
    await loadDatasetStats();
    await loadDatasetList();
    
    isInitialized = true;
    console.log('[dataset-list] Initialization complete');
}

/**
 * 加载项目列表（数据集管理用）
 */
async function loadProjectsForDatasetManagement() {
    const currentUser = appState.getState('currentUser');
    const videoProjectSelect = document.getElementById('video-project-select');
    const imageProjectSelect = document.getElementById('image-project-select');
    const datasetProjectFilter = document.getElementById('dataset-project-filter');
    
    try {
        const response = await fetch(`/api/admin/projects?user=${currentUser}`);
        const data = await response.json();
        
        if (response.ok && data.projects) {
            const projects = Object.keys(data.projects);
            
            // 更新视频上传项目选择器
            if (videoProjectSelect) {
                videoProjectSelect.innerHTML = '<option value="">请选择项目</option>';
                projects.forEach(projectName => {
                    const option = document.createElement('option');
                    option.value = projectName;
                    option.textContent = projectName;
                    videoProjectSelect.appendChild(option);
                });
            }
            
            // 更新图片上传项目选择器
            if (imageProjectSelect) {
                imageProjectSelect.innerHTML = '<option value="">请选择项目</option>';
                projects.forEach(projectName => {
                    const option = document.createElement('option');
                    option.value = projectName;
                    option.textContent = projectName;
                    imageProjectSelect.appendChild(option);
                });
            }
            
            // 更新数据集筛选器
            if (datasetProjectFilter) {
                const currentFilter = datasetProjectFilter.value;
                datasetProjectFilter.innerHTML = '<option value="">全部项目</option>';
                projects.forEach(projectName => {
                    const option = document.createElement('option');
                    option.value = projectName;
                    option.textContent = projectName;
                    datasetProjectFilter.appendChild(option);
                });
                // 恢复之前的选择
                if (currentFilter && projects.includes(currentFilter)) {
                    datasetProjectFilter.value = currentFilter;
                }
            }
            
            console.log('[dataset-list] Loaded projects:', projects);
        } else {
            throw new Error(data.error || '获取项目列表失败');
        }
    } catch (error) {
        console.error('[dataset-list] Failed to load projects:', error);
        showToast(`加载项目列表失败: ${error.message}`, 'error');
    }
}

/**
 * 设置数据集管理事件
 * 从 app.js:4338 迁移
 */
function setupDatasetEvents() {
    const datasetProjectFilter = document.getElementById('dataset-project-filter');
    
    // 项目筛选下拉框change事件 - 自动触发筛选
    if (datasetProjectFilter) {
        datasetProjectFilter.addEventListener('change', async () => {
            const projectFilter = datasetProjectFilter;
            const selectedProject = projectFilter ? projectFilter.value : '';
            await loadDatasetStats(selectedProject);
            await loadDatasetList(selectedProject);
            showToast(selectedProject ? `已筛选项目: ${selectedProject}` : '显示所有项目数据集');
        });
    }
    
    setupPaginationEvents();
}

/**
 * 加载数据集统计
 * 从 app.js:4380 迁移
 */
export async function loadDatasetStats(projectName = '') {
    const currentUser = appState.getState('currentUser');
    const videoCount = document.getElementById('video-count');
    const imageTaskCount = document.getElementById('image-task-count');
    const totalDatasetCount = document.getElementById('total-dataset-count');
    
    try {
        let url = `/api/admin/dataset_stats?user=${currentUser}`;
        if (projectName) {
            url += `&project=${encodeURIComponent(projectName)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok) {
            if (videoCount) videoCount.textContent = data.video_count || 0;
            if (imageTaskCount) imageTaskCount.textContent = data.image_task_count || 0;
            if (totalDatasetCount) totalDatasetCount.textContent = data.total_datasets || 0;
        } else {
            throw new Error(data.error || '获取统计信息失败');
        }
    } catch (error) {
        console.error('Failed to load dataset stats:', error);
        if (videoCount) videoCount.textContent = '0';
        if (imageTaskCount) imageTaskCount.textContent = '0';
        if (totalDatasetCount) totalDatasetCount.textContent = '0';
    }
}

/**
 * 加载数据集列表
 * 从 app.js:4406 迁移
 */
export async function loadDatasetList(projectName = '') {
    const currentUser = appState.getState('currentUser');
    const datasetListContainer = document.getElementById('dataset-list-container');
    
    try {
        let url = `/api/admin/datasets?user=${currentUser}`;
        if (projectName) {
            url += `&project=${encodeURIComponent(projectName)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok) {
            // 存储所有数据集
            paginationState.allDatasets = data.datasets || [];
            paginationState.totalItems = paginationState.allDatasets.length;
            paginationState.totalPages = Math.ceil(paginationState.totalItems / paginationState.pageSize);
            
            // 确保当前页在有效范围内
            if (paginationState.currentPage > paginationState.totalPages) {
                paginationState.currentPage = Math.max(1, paginationState.totalPages);
            }
            if (paginationState.currentPage < 1) {
                paginationState.currentPage = 1;
            }
            
            // 更新分页信息显示
            updatePaginationInfo();
            
            // 渲染当前页的数据
            renderCurrentPage();
        } else {
            throw new Error(data.error || '获取数据集列表失败');
        }
    } catch (error) {
        console.error('Failed to load dataset list:', error);
        if (datasetListContainer) {
            datasetListContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>加载失败</h3>
                    <p>无法加载数据集列表: ${error.message}</p>
                </div>
            `;
        }
        
        // 重置分页状态
        resetPagination();
    }
}

/**
 * 获取当前页的数据
 * 从 app.js:4482 迁移
 */
function getCurrentPageData() {
    const startIndex = (paginationState.currentPage - 1) * paginationState.pageSize;
    const endIndex = startIndex + paginationState.pageSize;
    return paginationState.allDatasets.slice(startIndex, endIndex);
}

/**
 * 渲染当前页数据
 * 从 app.js:4489 迁移
 */
function renderCurrentPage() {
    const datasetListContainer = document.getElementById('dataset-list-container');
    if (!datasetListContainer) return;
    
    const currentPageData = getCurrentPageData();
    
    datasetListContainer.innerHTML = '';
    
    if (!currentPageData || currentPageData.length === 0) {
        datasetListContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <h3>${paginationState.currentPage === 1 ? '暂无数据集' : '本页无数据'}</h3>
                <p>${paginationState.currentPage === 1 ? '还没有上传任何数据集文件，请使用上方功能上传视频或图片包' : '请返回第一页查看数据'}</p>
            </div>
        `;
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'dataset-management-table';
    
    // 表头
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>#</th>
            <th>📛 名称</th>
            <th>📂 项目</th>
            <th>🎯 类型</th>
            <th>📅 上传时间</th>
            <th>📏 大小/数量</th>
            <th>⚡ 操作</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // 表体
    const tbody = document.createElement('tbody');
    const startNumber = (paginationState.currentPage - 1) * paginationState.pageSize + 1;
    
    currentPageData.forEach((dataset, index) => {
        const rowNumber = startNumber + index;
        
        const row = document.createElement('tr');
        
        // 根据类型显示不同的信息
        let sizeInfo = '';
        if (dataset.type === 'video') {
            sizeInfo = dataset.file_size || '未知大小';
        } else {
            sizeInfo = `${dataset.image_count || 0} 张图片`;
        }
        
        row.innerHTML = `
            <td class="dataset-number-cell">${rowNumber}</td>
            <td class="dataset-name-cell">
                <span class="dataset-icon">${dataset.type === 'video' ? '🎬' : '🖼️'}</span>
                ${dataset.name}
            </td>
            <td class="dataset-project-cell">
                ${dataset.project || '未知项目'}
            </td>
            <td class="dataset-type-cell">
                <span class="type-badge ${dataset.type}">${dataset.type === 'video' ? '视频' : '图片任务'}</span>
            </td>
            <td class="dataset-time-cell">${dataset.upload_time || '未知'}</td>
            <td class="dataset-size-cell">${sizeInfo}</td>
            <td class="dataset-actions-cell">
                <button class="dataset-action-btn delete" data-path="${dataset.path}" data-type="${dataset.type}">
                    <span class="btn-icon">🗑️</span>
                    删除
                </button>
            </td>
        `;
        
        // 添加删除事件
        const deleteBtn = row.querySelector('.dataset-action-btn.delete');
        deleteBtn.addEventListener('click', (e) => {
            const path = e.target.closest('button').dataset.path;
            const type = e.target.closest('button').dataset.type;
            deleteDataset(path, type);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    datasetListContainer.appendChild(table);
}

/**
 * 删除数据集
 * 从 app.js:4744 迁移
 */
export async function deleteDataset(path, type) {
    const currentUser = appState.getState('currentUser');
    const datasetTypeName = type === 'video' ? '视频' : '图片任务';
    const message = `确定要删除这个${datasetTypeName}吗？`;
    const details = [
        '删除原始数据文件',
        '删除所有关联的标注数据',
        '如有需要，请先导出关联的标注数据！'
    ];
    
    const result = await showConfirm(message, details, `删除${datasetTypeName}`);
    
    if (!result) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/delete_dataset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: currentUser,
                path: path,
                type: type
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast(data.message);
            // 刷新数据集列表和统计
            await loadDatasetStats();
            await loadDatasetList();
            
            // 如果删除后当前页没有数据了，且不是第一页，则跳转到上一页
            setTimeout(() => {
                const currentPageData = getCurrentPageData();
                if (currentPageData.length === 0 && paginationState.currentPage > 1) {
                    goToPage(paginationState.currentPage - 1);
                }
            }, 100);
        } else {
            throw new Error(data.error || '删除失败');
        }
    } catch (error) {
        showToast(`删除失败: ${error.message}`, 'error');
    }
}

/**
 * 更新分页信息显示
 * 从 app.js:4454 迁移
 */
function updatePaginationInfo() {
    const currentPageSpan = document.getElementById('current-page');
    const totalPagesSpan = document.getElementById('total-pages');
    
    if (currentPageSpan) currentPageSpan.textContent = paginationState.currentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = paginationState.totalPages;
    
    // 更新按钮状态
    const firstPageBtn = document.getElementById('first-page-btn');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const lastPageBtn = document.getElementById('last-page-btn');
    
    if (firstPageBtn) firstPageBtn.disabled = paginationState.currentPage === 1;
    if (prevPageBtn) prevPageBtn.disabled = paginationState.currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = paginationState.currentPage === paginationState.totalPages;
    if (lastPageBtn) lastPageBtn.disabled = paginationState.currentPage === paginationState.totalPages;
}

/**
 * 重置分页状态
 * 从 app.js:4473 迁移
 */
function resetPagination() {
    paginationState.currentPage = 1;
    paginationState.totalItems = 0;
    paginationState.totalPages = 1;
    paginationState.allDatasets = [];
    updatePaginationInfo();
}

/**
 * 跳转到指定页面
 * 从 app.js:4639 迁移
 */
function goToPage(page) {
    if (page < 1 || page > paginationState.totalPages || page === paginationState.currentPage) {
        return;
    }
    
    paginationState.currentPage = page;
    updatePaginationInfo();
    renderCurrentPage();
    
    // 滚动到列表顶部
    const datasetListContainer = document.getElementById('dataset-list-container');
    if (datasetListContainer) {
        datasetListContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * 设置分页事件监听器
 * 从 app.js:4655 迁移
 */
function setupPaginationEvents() {
    const firstPageBtn = document.getElementById('first-page-btn');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const lastPageBtn = document.getElementById('last-page-btn');
    
    if (!firstPageBtn || !prevPageBtn || !nextPageBtn || !lastPageBtn) return;
    
    // 克隆并替换按钮来移除旧的事件监听器
    const replaceButton = (btn) => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        return newBtn;
    };
    
    const newFirstBtn = replaceButton(firstPageBtn);
    const newPrevBtn = replaceButton(prevPageBtn);
    const newNextBtn = replaceButton(nextPageBtn);
    const newLastBtn = replaceButton(lastPageBtn);
    
    // 重新绑定事件
    newFirstBtn.addEventListener('click', () => goToPage(1));
    newPrevBtn.addEventListener('click', () => goToPage(paginationState.currentPage - 1));
    newNextBtn.addEventListener('click', () => goToPage(paginationState.currentPage + 1));
    newLastBtn.addEventListener('click', () => goToPage(paginationState.totalPages));
}

export default {
    init,
    loadDatasetStats,
    loadDatasetList,
    deleteDataset
};
