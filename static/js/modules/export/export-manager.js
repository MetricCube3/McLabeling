/**
 * 数据导出管理模块
 * 处理标注数据的导出功能
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { apiPost } from '../../utils/api.js';
import { showToast } from '../../utils/toast.js';
import { showLoadingModal } from '../../utils/modal.js';

/**
 * 初始化导出管理模块
 */
export function init() {
    // 初始化逻辑
}

/**
 * 导出单个任务数据
 * @param {string} taskPath - 任务路径
 * @param {string} exportType - 导出类型：'all', 'segmentation', 'bbox'
 * @returns {Promise<Object>} 导出结果
 */
export async function exportTask(taskPath, exportType = 'all') {
    const currentUser = appState.getState('currentUser');
    
    const loadingModal = showLoadingModal('正在导出数据，请稍候...');
    
    try {
        // API接口：/api/task/export
        const data = await apiPost('/api/task/export', {
            user: currentUser,
            task_path: taskPath,
            export_type: exportType
        });
        
        loadingModal.close();
        
        if (data.download_url) {
            showToast(data.message || '导出成功', 'success');
            // 触发下载
            window.location.href = data.download_url;
            return data;
        } else {
            throw new Error('导出失败：未返回下载链接');
        }
    } catch (error) {
        loadingModal.close();
        console.error('Export task failed:', error);
        throw error;
    }
}

/**
 * 导出单个任务为COCO格式
 * @param {string} taskPath - 任务路径
 * @returns {Promise<Object>} 导出结果
 */
export async function exportTaskCOCO(taskPath) {
    const currentUser = appState.getState('currentUser');
    
    const loadingModal = showLoadingModal('正在导出COCO格式数据，请稍候...');
    
    try {
        // API接口：/api/task/export_coco
        const data = await apiPost('/api/task/export_coco', {
            user: currentUser,
            task_path: taskPath
        });
        
        loadingModal.close();
        
        if (data.download_url) {
            showToast(data.message || 'COCO格式导出成功', 'success');
            window.location.href = data.download_url;
            return data;
        } else {
            throw new Error('COCO格式导出失败：未返回下载链接');
        }
    } catch (error) {
        loadingModal.close();
        console.error('Export task COCO failed:', error);
        throw error;
    }
}

/**
 * 批量导出项目任务（统一接口）
 * @param {string} projectName - 项目名称
 * @param {Array<string>} taskPaths - 任务路径数组
 * @param {Object} options - 导出选项
 * @returns {Promise<Object>} 导出结果
 */
export async function exportProjectTasks(projectName, taskPaths, options = {}) {
    const {
        splitRatios = { train: 70, val: 20, test: 10 },
        exportFormat = 'yolo' // 'yolo' or 'coco'
    } = options;
    
    const currentUser = appState.getState('currentUser');
    
    const loadingModal = showLoadingModal(`正在导出${exportFormat.toUpperCase()}格式数据，请稍候...`);
    
    try {
        // API接口：/api/admin/export_project_tasks
        const data = await apiPost('/api/admin/export_project_tasks', {
            user: currentUser,
            project_name: projectName,
            task_paths: taskPaths,
            split_ratios: splitRatios,
            export_format: exportFormat
        });
        
        loadingModal.close();
        
        if (data.download_url) {
            showToast(data.message || '导出成功', 'success');
            
            // 显示统计信息
            if (data.stats) {
                console.log('Export stats:', data.stats);
            }
            
            // 触发下载
            window.location.href = data.download_url;
            
            eventBus.emit(EVENTS.DATA_EXPORTED, {
                projectName,
                taskPaths,
                format: exportFormat,
                stats: data.stats
            });
            
            return data;
        } else {
            throw new Error('导出失败：未返回下载链接');
        }
    } catch (error) {
        loadingModal.close();
        console.error('Export project tasks failed:', error);
        throw error;
    }
}

/**
 * 导出项目任务为YOLO格式（兼容旧接口）
 * @param {string} projectName - 项目名称
 * @param {Array<string>} taskPaths - 任务路径数组
 * @param {Object} splitRatios - 数据集划分比例
 * @returns {Promise<Object>} 导出结果
 */
export async function exportProjectTasksYOLO(projectName, taskPaths, splitRatios = { train: 70, val: 20, test: 10 }) {
    const currentUser = appState.getState('currentUser');
    
    const loadingModal = showLoadingModal('正在导出YOLO格式数据，请稍候...');
    
    try {
        // API接口：/api/admin/export_project_tasks_yolo（兼容旧API）
        const data = await apiPost('/api/admin/export_project_tasks_yolo', {
            user: currentUser,
            project_name: projectName,
            task_paths: taskPaths,
            split_ratios: splitRatios
        });
        
        loadingModal.close();
        
        if (data.download_url) {
            showToast(data.message || 'YOLO格式导出成功', 'success');
            window.location.href = data.download_url;
            return data;
        } else {
            throw new Error('YOLO格式导出失败：未返回下载链接');
        }
    } catch (error) {
        loadingModal.close();
        console.error('Export project tasks YOLO failed:', error);
        throw error;
    }
}

/**
 * 导出项目任务为COCO格式（兼容旧接口）
 * @param {string} projectName - 项目名称
 * @param {Array<string>} taskPaths - 任务路径数组
 * @param {Object} splitRatios - 数据集划分比例
 * @returns {Promise<Object>} 导出结果
 */
export async function exportProjectTasksCOCO(projectName, taskPaths, splitRatios = { train: 70, val: 20, test: 10 }) {
    const currentUser = appState.getState('currentUser');
    
    const loadingModal = showLoadingModal('正在导出COCO格式数据，请稍候...');
    
    try {
        // API接口：/api/admin/export_project_tasks_coco（兼容旧API）
        const data = await apiPost('/api/admin/export_project_tasks_coco', {
            user: currentUser,
            project_name: projectName,
            task_paths: taskPaths,
            split_ratios: splitRatios
        });
        
        loadingModal.close();
        
        if (data.download_url) {
            showToast(data.message || 'COCO格式导出成功', 'success');
            window.location.href = data.download_url;
            return data;
        } else {
            throw new Error('COCO格式导出失败：未返回下载链接');
        }
    } catch (error) {
        loadingModal.close();
        console.error('Export project tasks COCO failed:', error);
        throw error;
    }
}

/**
 * 验证数据集划分比例
 * @param {Object} splitRatios - 划分比例
 * @returns {boolean} 是否有效
 */
export function validateSplitRatios(splitRatios) {
    const { train, val, test } = splitRatios;
    
    if (typeof train !== 'number' || typeof val !== 'number' || typeof test !== 'number') {
        return false;
    }
    
    if (train < 0 || val < 0 || test < 0) {
        return false;
    }
    
    if (train + val + test !== 100) {
        return false;
    }
    
    return true;
}

export default {
    init,
    exportTask,
    exportTaskCOCO,
    exportProjectTasks,
    exportProjectTasksYOLO,
    exportProjectTasksCOCO,
    validateSplitRatios
};
