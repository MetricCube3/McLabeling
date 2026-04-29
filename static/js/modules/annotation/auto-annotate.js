/**
 * 自动标注模块
 * 处理AI自动标注功能（单张和批量）
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { showToast } from '../../utils/toast.js';
import { clearAnnotationState, getAnnotationState } from './annotation-state.js';
import { redrawAll } from './annotation-canvas.js';
import { renderSidebar } from './annotation-sidebar.js';
import { loadFrame, getCurrentFrameInfo, setupCanvasAndRedraw } from './annotation-frame.js';
import { saveAnnotationsSilent } from './annotation-save.js';

// DOM元素
let autoAnnotateBtn = null;
let displayImage = null;
let confirmModal = null;
let batchBtn = null;
let singleBtn = null;
let cancelBtn = null;

// 默认颜色列表
const COLORS = ['#FF3838', '#FF9D38', '#3877FF', '#38FFFF', '#8B38FF', '#FF38F5'];

/**
 * 初始化自动标注模块
 */
export function init() {
    autoAnnotateBtn = document.getElementById('auto-annotate-btn');
    displayImage = document.getElementById('display-image');
    confirmModal = document.getElementById('auto-annotate-confirm-modal');
    batchBtn = document.getElementById('auto-annotate-batch-btn');
    singleBtn = document.getElementById('auto-annotate-single-btn');
    cancelBtn = document.getElementById('auto-annotate-cancel-btn');
    
    // 设置自动标注按钮事件
    if (autoAnnotateBtn) {
        autoAnnotateBtn.addEventListener('click', handleAutoAnnotate);
    }
    
    // 设置模态框按钮事件
    if (batchBtn) {
        batchBtn.addEventListener('click', () => {
            hideConfirmModal();
            handleBatchAutoAnnotate();
        });
    }
    
    if (singleBtn) {
        singleBtn.addEventListener('click', () => {
            hideConfirmModal();
            handleSingleAutoAnnotate();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            hideConfirmModal();
            // 取消时不显示任何提示
        });
    }
    
    // 点击模态框背景关闭
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                hideConfirmModal();
                // 取消时不显示任何提示
            }
        });
    }
    
    // ESC键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && confirmModal && !confirmModal.classList.contains('hidden')) {
            hideConfirmModal();
            // 取消时不显示任何提示
        }
    });
}

/**
 * 自动标注入口
 * 从 app.js:1985 迁移
 */
export async function handleAutoAnnotate() {
    const currentVideoPath = getCurrentFrameInfo().videoPath;
    
    if (!currentVideoPath || !displayImage || !displayImage.src) {
        showToast('请先选择图片', 'error');
        return;
    }
    
    // 显示模态框让用户选择
    showConfirmModal();
}

/**
 * 单张图片自动标注
 * 从 app.js:2005 迁移
 */
export async function handleSingleAutoAnnotate() {
    try {
        if (autoAnnotateBtn) {
            autoAnnotateBtn.disabled = true;
        }
        showToast('正在进行自动标注，请稍候...', 'info');
        
        // 获取当前图片的路径
        const currentImagePath = new URL(displayImage.src).pathname;
        const currentProject = appState.getState('currentProject');
        
        const response = await fetch('/api/models/auto_annotate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_path: currentImagePath,
                project_name: currentProject || ''
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // 清空当前标注（不添加默认对象）
            clearAnnotationState();
            
            // 将自动标注结果添加到标注状态
            if (data.annotations && data.annotations.length > 0) {
                const labels = appState.getState('labels') || [];
                const annotationState = getAnnotationState();
                const modelType = data.model_type || 'detection';
                
                data.annotations.forEach((annotation, index) => {
                    // 获取标签颜色
                    let objColor = COLORS[index % COLORS.length];
                    if (Array.isArray(labels)) {
                        const matchedLabel = labels.find(l => l.id === annotation.label_id);
                        if (matchedLabel && matchedLabel.color) {
                            objColor = matchedLabel.color;
                        }
                    }
                    
                    const obj = {
                        id: annotationState.nextObjectId++,
                        labelId: annotation.label_id,
                        classId: annotation.label_id,
                        color: objColor,
                        isVisible: true,
                        points: [],
                        maskData: [[]],
                        boxData: null
                    };
                    
                    annotation.points.forEach(point => {
                        const canvasX = point.x * displayImage.naturalWidth;
                        const canvasY = point.y * displayImage.naturalHeight;
                        obj.points.push({ x: canvasX, y: canvasY });
                        obj.maskData[0].push([canvasX, canvasY]);
                    });
                    
                    // 设置边界框（如果有）
                    if (annotation.bbox) {
                        const bbox = annotation.bbox;
                        obj.boxData = [
                            bbox.x1 * displayImage.naturalWidth,
                            bbox.y1 * displayImage.naturalHeight,
                            bbox.x2 * displayImage.naturalWidth,
                            bbox.y2 * displayImage.naturalHeight
                        ];
                    } else if (obj.maskData[0].length > 0) {
                        // 从多边形计算边界框
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        obj.maskData[0].forEach(p => {
                            minX = Math.min(minX, p[0]);
                            minY = Math.min(minY, p[1]);
                            maxX = Math.max(maxX, p[0]);
                            maxY = Math.max(maxY, p[1]);
                        });
                        obj.boxData = [minX, minY, maxX, maxY];
                    }
                    
                    annotationState.objects.push(obj);
                });
                
                const typeText = modelType === 'segmentation' ? '分割模型' : '检测模型';
                showToast(`自动标注完成，检测到 ${data.annotations.length} 个实例 (${typeText}: ${data.model_used})`, 'success');
            } else {
                showToast('未检测到任何实例', 'info');
            }
            
            redrawAll();
            renderSidebar();
        } else {
            throw new Error(data.detail || '自动标注失败');
        }
    } catch (error) {
        showToast(`自动标注失败: ${error.message}`, 'error');
        console.error('Auto annotation error:', error);
    } finally {
        if (autoAnnotateBtn) {
            autoAnnotateBtn.disabled = false;
        }
    }
}

/**
 * 批量自动标注
 * 从 app.js:2111 迁移
 */
export async function handleBatchAutoAnnotate() {
    const frameInfo = getCurrentFrameInfo();
    const currentVideoPath = frameInfo.videoPath;
    const totalFrames = frameInfo.totalFrames;
    
    if (!currentVideoPath || totalFrames === 0) {
        showToast('无法获取任务信息', 'error');
        return;
    }
    
    try {
        if (autoAnnotateBtn) {
            autoAnnotateBtn.disabled = true;
        }
        
        showToast(`开始批量自动标注 ${totalFrames} 张图片...`, 'info');
        
        let successCount = 0;
        let failCount = 0;
        const labels = appState.getState('labels') || [];
        const currentProject = appState.getState('currentProject');
        
        // 遍历所有帧
        for (let i = 0; i < totalFrames; i++) {
            try {
                // 加载帧
                await loadFrame(i, true);
                
                // 等待图片加载完成
                await waitForImageLoad();
                
                // 小延迟确保所有更新完成
                await new Promise(resolve => setTimeout(resolve, 50));
                
                const currentImagePath = new URL(displayImage.src).pathname;
                
                // 调用自动标注API
                const response = await fetch('/api/models/auto_annotate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image_path: currentImagePath,
                        project_name: currentProject || ''
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // 如果有检测结果，保存标注
                    if (data.annotations && data.annotations.length > 0) {
                        // 清空当前标注（不添加默认对象）
                        clearAnnotationState();
                        
                        const annotationState = getAnnotationState();
                        
                        // 添加自动标注结果
                        data.annotations.forEach((annotation, index) => {
                            // 获取标签颜色
                            let objColor = COLORS[index % COLORS.length];
                            if (Array.isArray(labels)) {
                                const matchedLabel = labels.find(l => l.id === annotation.label_id);
                                if (matchedLabel && matchedLabel.color) {
                                    objColor = matchedLabel.color;
                                }
                            }
                            
                            const obj = {
                                id: annotationState.nextObjectId++,
                                labelId: annotation.label_id,
                                classId: annotation.label_id,
                                color: objColor,
                                isVisible: true,
                                points: [],
                                maskData: [[]],
                                boxData: null
                            };
                            
                            annotation.points.forEach(point => {
                                const canvasX = point.x * displayImage.naturalWidth;
                                const canvasY = point.y * displayImage.naturalHeight;
                                obj.points.push({ x: canvasX, y: canvasY });
                                obj.maskData[0].push([canvasX, canvasY]);
                            });
                            
                            // 设置边界框（如果有）
                            if (annotation.bbox) {
                                const bbox = annotation.bbox;
                                obj.boxData = [
                                    bbox.x1 * displayImage.naturalWidth,
                                    bbox.y1 * displayImage.naturalHeight,
                                    bbox.x2 * displayImage.naturalWidth,
                                    bbox.y2 * displayImage.naturalHeight
                                ];
                            } else if (obj.maskData[0].length > 0) {
                                // 从多边形计算边界框
                                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                                obj.maskData[0].forEach(p => {
                                    minX = Math.min(minX, p[0]);
                                    minY = Math.min(minY, p[1]);
                                    maxX = Math.max(maxX, p[0]);
                                    maxY = Math.max(maxY, p[1]);
                                });
                                obj.boxData = [minX, minY, maxX, maxY];
                            }
                            
                            annotationState.objects.push(obj);
                        });
                        
                        // 保存标注（使用静默保存，避免UI干扰）
                        try {
                            const saveResult = await saveAnnotationsSilent();
                            successCount++;
                            
                            // 小延迟确保保存操作完成
                            await new Promise(resolve => setTimeout(resolve, 50));
                        } catch (saveError) {
                            console.error(`Frame ${i}: Save failed:`, saveError);
                            failCount++;
                        }
                    } else {
                        console.log(`Frame ${i}: No detections, skipping`);
                        // 没有检测到实例，不算失败，也不算成功
                    }
                } else {
                    console.error(`Frame ${i}: Auto-annotate API failed:`, data);
                    failCount++;
                }
                
                // 更新进度
                showToast(`批量标注进度: ${i + 1}/${totalFrames} (成功: ${successCount}, 失败: ${failCount})`, 'info');
                
            } catch (error) {
                console.error(`Frame ${i} annotation failed:`, error);
                failCount++;
            }
        }
        
        // 完成后返回第一帧并重新绘制
        await loadFrame(0, true);
        
        // 等待图片加载完成后重新绘制
        await waitForImageLoad();
        
        // 重新绘制当前帧的标注
        redrawAll();
        renderSidebar();
        
        const totalProcessed = successCount + failCount;
        const skipped = totalFrames - totalProcessed;
        showToast(`批量自动标注完成！成功保存: ${successCount}张, 失败: ${failCount}张, 未检测到: ${skipped}张`, 'success');
        
    } catch (error) {
        showToast(`批量标注失败: ${error.message}`, 'error');
        console.error('Batch auto annotation error:', error);
    } finally {
        if (autoAnnotateBtn) {
            autoAnnotateBtn.disabled = false;
        }
    }
}

/**
 * 等待图片加载完成
 */
function waitForImageLoad() {
    return new Promise(resolve => {
        if (displayImage.complete && displayImage.naturalWidth > 0) {
            // 图片已经加载完成，立即更新坐标映射（避免缓存图片未更新imageDimensions）
            setupCanvasAndRedraw();
            resolve();
        } else {
            // 图片还在加载中，等待onload事件
            const originalOnload = displayImage.onload;
            displayImage.onload = () => {
                if (originalOnload) originalOnload();
                setupCanvasAndRedraw();
                resolve();
            };
        }
    });
}

/**
 * 显示确认模态框
 */
function showConfirmModal() {
    if (confirmModal) {
        confirmModal.classList.remove('hidden');
        // 自动聚焦到取消按钮（更安全的默认选项）
        if (cancelBtn) {
            setTimeout(() => cancelBtn.focus(), 100);
        }
    }
}

/**
 * 隐藏确认模态框
 */
function hideConfirmModal() {
    if (confirmModal) {
        confirmModal.classList.add('hidden');
    }
}

export default {
    init,
    handleAutoAnnotate,
    handleSingleAutoAnnotate,
    handleBatchAutoAnnotate
};
