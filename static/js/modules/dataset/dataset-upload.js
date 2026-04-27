/**
 * 数据集上传模块
 * 处理视频和图片的上传
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { loadDatasetStats, loadDatasetList } from './dataset-list.js';

/**
 * 初始化数据集上传模块
 */
export function init() {
    setupUploadEvents();
}

/**
 * 设置上传事件
 */
function setupUploadEvents() {
    const uploadVideosBtn = document.getElementById('main-upload-videos-btn');
    const uploadImagesBtn = document.getElementById('main-upload-images-btn');
    
    if (uploadVideosBtn) {
        uploadVideosBtn.addEventListener('click', () => handleVideoUpload());
    }
    
    if (uploadImagesBtn) {
        uploadImagesBtn.addEventListener('click', () => handleImageUpload());
    }
}

/**
 * 更新上传状态显示
 * 从 app.js:4580 迁移
 */
function updateUploadStatus(element, message, type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.className = 'upload-status';
    element.classList.add(type);
}

/**
 * 处理视频上传
 * 从 app.js:4586 迁移
 */
export async function handleVideoUpload() {
    const currentUser = appState.getState('currentUser');
    const videoUploadInput = document.getElementById('main-video-upload-input');
    const uploadStatus = document.getElementById('main-upload-status');
    const uploadBtn = document.getElementById('main-upload-videos-btn');
    const projectSelect = document.getElementById('video-project-select');
    
    const files = videoUploadInput ? videoUploadInput.files : [];
    const selectedProject = projectSelect ? projectSelect.value : '';
    
    if (!files.length) {
        updateUploadStatus(uploadStatus, '请先选择要上传的视频文件。', 'error');
        return;
    }
    
    if (!selectedProject) {
        updateUploadStatus(uploadStatus, '请选择项目。', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('user', currentUser);
    formData.append('project', selectedProject);
    for (const file of files) {
        formData.append('videos[]', file);
    }
    
    updateUploadStatus(uploadStatus, '正在上传视频文件...', 'info');
    if (uploadBtn) uploadBtn.disabled = true;
    
    try {
        const response = await fetch('/api/admin/upload', {
            method: 'POST',
            body: formData,
        });
        
        const data = await response.json();
        
        if (response.ok) {
            updateUploadStatus(uploadStatus, data.message, 'success');
            if (videoUploadInput) videoUploadInput.value = '';
            
            // 刷新数据集列表和统计
            await loadDatasetStats();
            await loadDatasetList();
            
            showToast('视频上传成功，数据集列表已更新', 'success');
            
            // 触发上传成功事件
            eventBus.emit(EVENTS.DATASET_UPLOADED, { type: 'video', project: selectedProject });
        } else {
            throw new Error(data.error || data.detail || '上传失败');
        }
    } catch (error) {
        updateUploadStatus(uploadStatus, `上传出错: ${error.message}`, 'error');
    } finally {
        if (uploadBtn) uploadBtn.disabled = false;
    }
}

/**
 * 处理图片上传
 * 从 app.js:4682 迁移
 */
export async function handleImageUpload() {
    const currentUser = appState.getState('currentUser');
    const imageUploadInput = document.getElementById('main-image-upload-input');
    const uploadStatus = document.getElementById('main-upload-image-status');
    const uploadBtn = document.getElementById('main-upload-images-btn');
    const projectSelect = document.getElementById('image-project-select');
    
    const files = imageUploadInput ? imageUploadInput.files : [];
    const selectedProject = projectSelect ? projectSelect.value : '';
    
    if (!files.length) {
        updateUploadStatus(uploadStatus, '请先选择要上传的图片压缩包文件。', 'error');
        return;
    }
    
    if (!selectedProject) {
        updateUploadStatus(uploadStatus, '请选择项目。', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('user', currentUser);
    formData.append('project', selectedProject);
    for (const file of files) {
        formData.append('images[]', file);
    }
    
    updateUploadStatus(uploadStatus, '正在上传并解压图片压缩包...', 'info');
    if (uploadBtn) uploadBtn.disabled = true;
    
    try {
        const response = await fetch('/api/admin/upload_images', {
            method: 'POST',
            body: formData,
        });
        
        const data = await response.json();
        
        if (response.ok) {
            let statusMessage = data.message;
            updateUploadStatus(uploadStatus, statusMessage, 'success');
            if (imageUploadInput) imageUploadInput.value = '';
            
            // 显示上传的任务详情
            if (data.uploaded_tasks && data.uploaded_tasks.length > 0) {
                const taskDetails = data.uploaded_tasks.map(task =>
                    `${task.task_name} (${task.image_count}张图片)`
                ).join(', ');
                if (uploadStatus) {
                    uploadStatus.textContent += ` - 任务: ${taskDetails}`;
                }
            }
            
            // 刷新数据集列表和统计
            await loadDatasetStats();
            await loadDatasetList();
            
            showToast('图片压缩包上传成功，数据集列表已更新', 'success');
            
            // 触发上传成功事件
            eventBus.emit(EVENTS.DATASET_UPLOADED, { type: 'images', project: selectedProject });
        } else {
            throw new Error(data.error || data.detail || '上传失败');
        }
    } catch (error) {
        updateUploadStatus(uploadStatus, `上传出错: ${error.message}`, 'error');
    } finally {
        if (uploadBtn) uploadBtn.disabled = false;
    }
}

export default {
    init,
    handleVideoUpload,
    handleImageUpload
};
