/**
 * 标注保存和分割模块
 * 处理标注保存、SAM分割等功能
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { getAnnotationState } from './annotation-state.js';
import { redrawAll } from './annotation-canvas.js';
import { getCurrentFrameInfo } from './annotation-frame.js';

/**
 * 初始化保存模块
 */
export function init() {
    // 订阅分割需求事件
    eventBus.on('annotation:segmentation-needed', runSegmentation);
    
    // 订阅保存按钮事件
    setupSaveButton();
}

/**
 * 设置保存按钮
 */
function setupSaveButton() {
    const saveBtn = document.getElementById('save-success-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => saveAnnotations());
    }
}

/**
 * 运行SAM分割
 * 从 app.js:1958 迁移
 */
export async function runSegmentation() {
    const annotationState = getAnnotationState();
    if (!annotationState.objects) return;
    
    const activeObject = annotationState.objects[annotationState.activeObjectIndex];
    if (!activeObject || activeObject.points.length === 0) {
        if (activeObject) {
            activeObject.maskData = null;
            activeObject.boxData = null;
        }
        redrawAll();
        return;
    }
    
    const displayImage = document.getElementById('display-image');
    if (!displayImage || !displayImage.src) return;
    
    const payload = {
        frameUrl: new URL(displayImage.src).pathname,
        points: [activeObject.points.map(p => [p.x, p.y])],
        labels: [activeObject.points.map(p => p.label)],
    };
    
    try {
        const response = await fetch('/api/segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || '分割请求失败');
        }
        
        activeObject.maskData = (data.masks && data.masks.length > 0) ? data.masks : null;
        activeObject.boxData = (data.boxes && data.boxes.length > 0) ? data.boxes[0] : null;
        
        redrawAll();
        
    } catch (error) {
        console.error('Segmentation failed:', error);
        showToast(`掩码生成失败: ${error.message}`, 'error');
    }
}

/**
 * 保存标注
 * 从 app.js:2346 迁移
 */
export async function saveAnnotations() {
    const annotationState = getAnnotationState();
    const displayImage = document.getElementById('display-image');
    const appMode = appState.getState('appMode');
    
    if (!displayImage || !displayImage.src) {
        showToast('没有可保存的图像', 'error');
        return;
    }
    
    // 获取图像尺寸
    const imageDimensions = {
        naturalWidth: displayImage.naturalWidth,
        naturalHeight: displayImage.naturalHeight
    };
    
    // 验证并过滤有效对象
    const validObjects = annotationState.objects.filter(obj => {
        if (!obj.maskData || obj.maskData.length === 0) return false;
        
        // 验证mask数据是否在图像范围内
        for (const polygon of obj.maskData) {
            for (const point of polygon) {
                const x = point[0], y = point[1];
                if (x < 0 || x >= imageDimensions.naturalWidth ||
                    y < 0 || y >= imageDimensions.naturalHeight) {
                    console.warn(`Invalid mask point: (${x}, ${y}) outside image bounds`);
                    return false;
                }
            }
        }
        return true;
    });
    
    // 检查是否是抽帧图片
    const isExtractedFrame = displayImage.src.includes('/extracted/');
    const frameInfo = getCurrentFrameInfo();
    
    const payload = {
        status: 'success',
        objects: validObjects,
        frameUrl: new URL(displayImage.src).pathname,
        videoPath: frameInfo.videoPath,
        imageWidth: imageDimensions.naturalWidth,
        imageHeight: imageDimensions.naturalHeight,
        frameIndex: frameInfo.frameIndex,
        totalFrames: frameInfo.totalFrames,
        isExtractedFrame: isExtractedFrame
    };
    
    // 如果是覆盖保存（审核模式），添加路径
    if (appMode === 'review' && frameInfo.editingFilePath) {
        payload.overwrite_path = frameInfo.editingFilePath;
    }
    
    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.message && data.message.startsWith('图像未标注')) {
                showToast(data.message, 'warning');
            } else {
                showToast(data.message || "保存成功!", 'success');
            }
            
            // 触发保存成功事件
            eventBus.emit(EVENTS.ANNOTATION_SAVED, {
                validObjects: validObjects,
                isExtractedFrame: isExtractedFrame,
                appMode: appMode
            });
            
            // 处理保存后的导航
            handlePostSaveNavigation(validObjects, isExtractedFrame, appMode);
            
        } else {
            throw new Error(data.error || '未知错误');
        }
        
    } catch (error) {
        console.error('保存失败:', error);
        showToast(`保存失败: ${error.message}`, 'error');
    }
}

/**
 * 静默保存标注（用于批量标注）
 * 从 app.js:2303 迁移
 */
export async function saveAnnotationsSilent() {
    const annotationState = getAnnotationState();
    const displayImage = document.getElementById('display-image');
    
    if (!displayImage || !displayImage.src) {
        throw new Error('没有可保存的图像');
    }
    
    const imageDimensions = {
        naturalWidth: displayImage.naturalWidth,
        naturalHeight: displayImage.naturalHeight
    };
    
    const validObjects = annotationState.objects.filter(obj => {
        if (!obj.maskData || obj.maskData.length === 0) return false;
        for (const polygon of obj.maskData) {
            for (const point of polygon) {
                const x = point[0], y = point[1];
                if (x < 0 || x >= imageDimensions.naturalWidth ||
                    y < 0 || y >= imageDimensions.naturalHeight) {
                    return false;
                }
            }
        }
        return true;
    });
    
    const isExtractedFrame = displayImage.src.includes('/extracted/');
    const frameInfo = getCurrentFrameInfo();
    
    const payload = {
        status: 'success',
        objects: validObjects,
        frameUrl: new URL(displayImage.src).pathname,
        videoPath: frameInfo.videoPath,
        imageWidth: imageDimensions.naturalWidth,
        imageHeight: imageDimensions.naturalHeight,
        frameIndex: frameInfo.frameIndex,
        totalFrames: frameInfo.totalFrames,
        isExtractedFrame: isExtractedFrame
    };
    
    const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '保存失败');
    }
    
    return await response.json();
}

/**
 * 处理保存后的导航
 */
function handlePostSaveNavigation(validObjects, isExtractedFrame, appMode) {
    const nextFrameBtn = document.getElementById('next-frame-btn');
    
    if (validObjects.length === 0) {
        // 清空标注的情况
        if (appMode === 'review') {
            // 审核模式：通过事件通知review模块处理
            eventBus.emit('review:annotation-cleared');
        } else {
            // 标注模式：跳转到下一帧
            if (nextFrameBtn) {
                nextFrameBtn.click();
            }
        }
    } else {
        // 正常保存的情况
        if (appMode === 'annotate') {
            // 标注模式：自动跳转到下一帧
            if (nextFrameBtn) {
                nextFrameBtn.click();
            }
        } else {
            // 审核模式：重新绘制以确保状态同步
            setTimeout(() => {
                redrawAll();
            }, 100);
        }
    }
}

/**
 * 验证标注数据
 */
export function validateAnnotations() {
    const annotationState = getAnnotationState();
    const displayImage = document.getElementById('display-image');
    
    if (!displayImage || !displayImage.src) {
        return { valid: false, message: '没有可验证的图像' };
    }
    
    const imageDimensions = {
        naturalWidth: displayImage.naturalWidth,
        naturalHeight: displayImage.naturalHeight
    };
    
    const validObjects = annotationState.objects.filter(obj => {
        if (!obj.maskData || obj.maskData.length === 0) return false;
        
        for (const polygon of obj.maskData) {
            for (const point of polygon) {
                const x = point[0], y = point[1];
                if (x < 0 || x >= imageDimensions.naturalWidth ||
                    y < 0 || y >= imageDimensions.naturalHeight) {
                    return false;
                }
            }
        }
        return true;
    });
    
    return {
        valid: validObjects.length > 0,
        validCount: validObjects.length,
        totalCount: annotationState.objects.length,
        message: validObjects.length > 0 
            ? `有 ${validObjects.length} 个有效标注` 
            : '没有有效的标注对象'
    };
}

export default {
    init,
    runSegmentation,
    saveAnnotations,
    saveAnnotationsSilent,
    validateAnnotations
};
