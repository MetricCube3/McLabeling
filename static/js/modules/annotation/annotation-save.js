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
 * 将标注坐标规范到图像有效范围后生成保存副本。
 * 画布坐标换算可能产生 x === width、y === height 或极小越界，
 * 这些点不应导致整个标注对象被静默丢弃。
 */
function buildSerializableObjects(objects, imageWidth, imageHeight) {
    if (!imageWidth || !imageHeight) return [];

    const maxX = Math.max(0, imageWidth - 0.000001);
    const maxY = Math.max(0, imageHeight - 0.000001);
    const clampPoint = (point) => {
        if (!Array.isArray(point) || point.length < 2) return null;
        const x = Number(point[0]);
        const y = Number(point[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return [Math.max(0, Math.min(maxX, x)), Math.max(0, Math.min(maxY, y))];
    };

    return (objects || []).flatMap(obj => {
        const maskData = (obj.maskData || [])
            .map(polygon => (polygon || []).map(clampPoint).filter(Boolean))
            .filter(polygon => polygon.length >= 3);
        if (maskData.length === 0) return [];

        const boxData = Array.isArray(obj.boxData) && obj.boxData.length === 4
            ? [
                Math.max(0, Math.min(maxX, Number(obj.boxData[0]) || 0)),
                Math.max(0, Math.min(maxY, Number(obj.boxData[1]) || 0)),
                Math.max(0, Math.min(maxX, Number(obj.boxData[2]) || 0)),
                Math.max(0, Math.min(maxY, Number(obj.boxData[3]) || 0))
            ]
            : null;
        const obbData = Array.isArray(obj.obbData)
            ? obj.obbData.map(clampPoint).filter(Boolean)
            : null;

        return [{
            ...obj,
            maskData,
            boxData,
            obbData: obbData?.length === 4 ? obbData : null,
            annotationType: obj.annotationType || 'sam'
        }];
    });
}

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
    
    const validObjects = buildSerializableObjects(
        annotationState.objects,
        imageDimensions.naturalWidth,
        imageDimensions.naturalHeight
    );
    
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
            
            // 保存成功后，将SAM标注转为多边形类型（使其可编辑）
            const currentState = getAnnotationState();
            currentState.objects.forEach(obj => {
                if (obj.annotationType === 'sam' && obj.maskData) {
                    obj.annotationType = 'polygon';
                }
            });
            
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
    
    const validObjects = buildSerializableObjects(
        annotationState.objects,
        imageDimensions.naturalWidth,
        imageDimensions.naturalHeight
    );
    
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
    const autoAdvance = document.getElementById('auto-advance-checkbox');
    const shouldAdvance = autoAdvance ? autoAdvance.checked : true;
    
    if (validObjects.length === 0) {
        // 清空标注的情况
        if (appMode === 'review') {
            // 审核模式：通过事件通知review模块处理
            eventBus.emit('review:annotation-cleared');
        } else if (shouldAdvance) {
            // 标注模式：跳转到下一帧
            if (nextFrameBtn) {
                nextFrameBtn.click();
            }
        }
    } else {
        // 正常保存的情况
        if (appMode === 'annotate' && shouldAdvance) {
            // 标注模式：自动跳转到下一帧
            if (nextFrameBtn) {
                nextFrameBtn.click();
            }
        } else if (appMode === 'review') {
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
    
    const validObjects = buildSerializableObjects(
        annotationState.objects,
        imageDimensions.naturalWidth,
        imageDimensions.naturalHeight
    );
    
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
