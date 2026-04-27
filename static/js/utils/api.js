/**
 * API请求工具
 * 封装所有HTTP请求，提供统一的错误处理和响应处理
 */

import { logError } from '../core/config.js';
import { showToast } from './toast.js';

/**
 * 发送GET请求
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} 响应数据
 */
export async function apiGet(url, options = {}) {
    return apiRequest(url, {
        method: 'GET',
        ...options
    });
}

/**
 * 发送POST请求
 * @param {string} url - 请求URL
 * @param {Object|FormData} data - 请求数据
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} 响应数据
 */
export async function apiPost(url, data, options = {}) {
    const isFormData = data instanceof FormData;
    
    return apiRequest(url, {
        method: 'POST',
        headers: isFormData ? {} : { 'Content-Type': 'application/json' },
        body: isFormData ? data : JSON.stringify(data),
        ...options
    });
}

/**
 * 发送PUT请求
 * @param {string} url - 请求URL
 * @param {Object} data - 请求数据
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} 响应数据
 */
export async function apiPut(url, data, options = {}) {
    return apiRequest(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        ...options
    });
}

/**
 * 发送DELETE请求
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} 响应数据
 */
export async function apiDelete(url, options = {}) {
    return apiRequest(url, {
        method: 'DELETE',
        ...options
    });
}

/**
 * 通用请求函数
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} 响应数据
 */
async function apiRequest(url, options = {}) {
    const {
        showError = true,
        showSuccess = false,
        successMessage = '操作成功',
        ...fetchOptions
    } = options;
    
    try {
        const response = await fetch(url, fetchOptions);
        const data = await response.json();
        
        if (response.ok) {
            if (showSuccess && successMessage) {
                showToast(successMessage, 'success');
            }
            return data;
        } else {
            throw new Error(data.detail || data.error || data.message || '请求失败');
        }
    } catch (error) {
        logError('API request failed:', url, error);
        
        if (showError) {
            showToast(`请求失败: ${error.message}`, 'error');
        }
        
        throw error;
    }
}

/**
 * 文件上传请求（带进度）
 * @param {string} url - 上传URL
 * @param {FormData} formData - 表单数据
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Object>} 响应数据
 */
export async function apiUpload(url, formData, onProgress = null) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // 监听进度
        if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    onProgress(progress);
                }
            });
        }
        
        // 监听完成
        xhr.addEventListener('load', () => {
            try {
                const data = JSON.parse(xhr.responseText);
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(data);
                } else {
                    reject(new Error(data.detail || data.error || '上传失败'));
                }
            } catch (error) {
                reject(new Error('响应解析失败'));
            }
        });
        
        // 监听错误
        xhr.addEventListener('error', () => {
            reject(new Error('网络错误'));
        });
        
        // 监听中止
        xhr.addEventListener('abort', () => {
            reject(new Error('上传被取消'));
        });
        
        // 发送请求
        xhr.open('POST', url);
        xhr.send(formData);
    });
}

/**
 * 批量请求
 * @param {Array<Promise>} requests - 请求数组
 * @returns {Promise<Array>} 结果数组
 */
export async function apiBatch(requests) {
    try {
        return await Promise.all(requests);
    } catch (error) {
        logError('Batch request failed:', error);
        throw error;
    }
}

/**
 * 带重试的请求
 * @param {Function} requestFn - 请求函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} delay - 重试延迟（毫秒）
 * @returns {Promise<Object>} 响应数据
 */
export async function apiWithRetry(requestFn, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await requestFn();
        } catch (error) {
            lastError = error;
            
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }
    
    throw lastError;
}

export default {
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
    upload: apiUpload,
    batch: apiBatch,
    withRetry: apiWithRetry
};
