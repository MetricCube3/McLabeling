/**
 * 通用辅助函数
 * 包含各种实用工具函数
 */

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * 格式化日期时间
 * @param {string} isoString - ISO格式的日期时间字符串
 * @returns {string} 格式化后的日期时间
 */
export function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN');
}

/**
 * 格式化日期
 * @param {string} isoString - ISO格式的日期时间字符串
 * @returns {string} 格式化后的日期
 */
export function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('zh-CN');
}

/**
 * 格式化时间
 * @param {string} isoString - ISO格式的日期时间字符串
 * @returns {string} 格式化后的时间
 */
export function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN');
}

/**
 * 深拷贝对象
 * @param {*} obj - 要拷贝的对象
 * @returns {*} 拷贝后的对象
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    
    const clonedObj = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            clonedObj[key] = deepClone(obj[key]);
        }
    }
    return clonedObj;
}

/**
 * 生成唯一ID
 * @param {string} prefix - ID前缀
 * @returns {string} 唯一ID
 */
export function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 延迟执行
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise}
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 数字四舍五入
 * @param {number} value - 数值
 * @param {number} decimals - 小数位数
 * @returns {number}
 */
export function round(value, decimals = 2) {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * 限制数值范围
 * @param {number} value - 数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * 检查是否为空值
 * @param {*} value - 值
 * @returns {boolean}
 */
export function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

/**
 * 获取URL参数
 * @param {string} name - 参数名
 * @returns {string|null}
 */
export function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

/**
 * 设置URL参数
 * @param {string} name - 参数名
 * @param {string} value - 参数值
 */
export function setUrlParam(name, value) {
    const url = new URL(window.location);
    url.searchParams.set(name, value);
    window.history.pushState({}, '', url);
}

/**
 * 下载文件
 * @param {Blob|string} data - 文件数据或URL
 * @param {string} filename - 文件名
 */
export function downloadFile(data, filename) {
    const link = document.createElement('a');
    
    if (data instanceof Blob) {
        link.href = URL.createObjectURL(data);
    } else {
        link.href = data;
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (data instanceof Blob) {
        URL.revokeObjectURL(link.href);
    }
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy:', error);
        return false;
    }
}

/**
 * 数组分组
 * @param {Array} array - 数组
 * @param {Function} keyFn - 分组键函数
 * @returns {Object}
 */
export function groupBy(array, keyFn) {
    return array.reduce((result, item) => {
        const key = keyFn(item);
        if (!result[key]) {
            result[key] = [];
        }
        result[key].push(item);
        return result;
    }, {});
}

/**
 * 数组去重
 * @param {Array} array - 数组
 * @param {Function} keyFn - 唯一键函数
 * @returns {Array}
 */
export function unique(array, keyFn = item => item) {
    const seen = new Set();
    return array.filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

export default {
    debounce,
    throttle,
    formatFileSize,
    formatDateTime,
    formatDate,
    formatTime,
    deepClone,
    generateId,
    delay,
    round,
    clamp,
    isEmpty,
    getUrlParam,
    setUrlParam,
    downloadFile,
    copyToClipboard,
    groupBy,
    unique
};
