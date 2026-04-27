/**
 * 标注Canvas模块
 * 处理Canvas绘制和交互
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';
import { getAnnotationState, setActiveObject, toggleObjectVisibility, deleteObject, updateObjectClassId } from './annotation-state.js';

// Canvas和图像相关的全局变量
let canvas = null;
let ctx = null;
let displayImage = null;
let imageDimensions = { width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, ratio: 1 };
let hoverState = { pointIndex: -1, objectIndex: -1 };
let highlightedObjectIndex = -1; // 来自列表悬停的高亮目标

/**
 * 初始化Canvas模块
 */
export function init() {
    canvas = document.getElementById('point-canvas');
    ctx = canvas ? canvas.getContext('2d') : null;
    displayImage = document.getElementById('display-image');
    
    if (canvas && ctx) {
        // 设置Canvas事件监听
        setupCanvasEvents();
    }
    
    // 订阅标注状态变化事件
    eventBus.on(EVENTS.ANNOTATION_STATE_CHANGED, handleStateChanged);
    eventBus.on(EVENTS.ANNOTATION_ACTIVE_OBJECT_CHANGED, handleActiveObjectChanged);
    eventBus.on(EVENTS.ANNOTATION_LIST_HOVERED, handleListHovered);
}

/**
 * 设置Canvas事件监听
 */
function setupCanvasEvents() {
    if (!canvas) return;
    
    canvas.addEventListener('click', (e) => handleCanvasClick(e, 1));
    canvas.addEventListener('contextmenu', (e) => { 
        e.preventDefault(); 
        handleCanvasClick(e, 0); 
    });
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
}

/**
 * 设置图像尺寸信息
 */
export function setImageDimensions(dims) {
    imageDimensions = dims;
}

/**
 * 重绘所有内容
 * 从 app.js:1807 迁移
 */
export function redrawAll() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawAllMasks();
    drawAllPoints();
    drawObjectHighlights();
}

/**
 * 绘制所有masks
 * 从 app.js:1901 迁移
 */
function drawAllMasks() {
    const annotationState = getAnnotationState();
    if (!annotationState.objects) return;
    
    const displayRect = getImageDisplayRect();
    
    annotationState.objects.forEach((obj, index) => {
        if (obj.isVisible && obj.maskData) {
            // 判断是否为高亮对象（active、hovered、列表高亮）
            const isHighlighted = index === annotationState.activeObjectIndex || 
                                 index === hoverState.objectIndex ||
                                 index === highlightedObjectIndex;
            
            // 高亮对象使用更高不透明度，普通对象降低不透明度避免干扰
            ctx.fillStyle = hexToRgba(obj.color, isHighlighted ? 0.6 : 0.4);
            obj.maskData.forEach(polygon => {
                if (polygon.length === 0) return;
                ctx.beginPath();
                
                const startPoint = scaleCoordsToCanvas(polygon[0]);
                if (!startPoint) return;
                
                ctx.moveTo(startPoint.x, startPoint.y);
                for (let i = 1; i < polygon.length; i++) {
                    const point = scaleCoordsToCanvas(polygon[i]);
                    if (point) {
                        ctx.lineTo(point.x, point.y);
                    }
                }
                ctx.closePath();
                ctx.fill();
            });
            
            // 绘制多边形轮廓：选定状态画点，非选定状态画线
            if (isHighlighted) {
                // 选定/高亮状态：绘制轮廓点（避免多区域连线混乱）
                const pointRadius = 2.5;
                ctx.fillStyle = hexToRgba(obj.color, 0.9);
                
                obj.maskData.forEach(polygon => {
                    if (polygon.length === 0) return;
                    
                    // 绘制轮廓上的每个点
                    polygon.forEach(point => {
                        const canvasPoint = scaleCoordsToCanvas(point);
                        if (canvasPoint) {
                            ctx.beginPath();
                            ctx.arc(canvasPoint.x, canvasPoint.y, pointRadius, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    });
                });
            } else {
                // 非选定状态：绘制轮廓线（保持原有视觉效果）
                ctx.strokeStyle = hexToRgba(obj.color, 0.85);
                ctx.lineWidth = 1;
                ctx.lineJoin = 'round';
                
                obj.maskData.forEach(polygon => {
                    if (polygon.length === 0) return;
                    ctx.beginPath();
                    
                    const startPoint = scaleCoordsToCanvas(polygon[0]);
                    if (!startPoint) return;
                    
                    ctx.moveTo(startPoint.x, startPoint.y);
                    for (let i = 1; i < polygon.length; i++) {
                        const point = scaleCoordsToCanvas(polygon[i]);
                        if (point) {
                            ctx.lineTo(point.x, point.y);
                        }
                    }
                    ctx.closePath();
                    ctx.stroke();
                });
            }
        }
    });
}

/**
 * 绘制所有标注点
 * 从 app.js:1930 迁移
 */
function drawAllPoints() {
    const annotationState = getAnnotationState();
    if (!annotationState.objects) return;
    
    const activeObject = annotationState.objects[annotationState.activeObjectIndex];
    if (activeObject) {
        activeObject.points.forEach((p, pointIndex) => {
            const canvasP = scaleCoordsToCanvas(p);
            const isHovered = pointIndex === hoverState.pointIndex;
            
            ctx.beginPath();
            ctx.arc(canvasP.x, canvasP.y, isHovered ? 8 : 5, 0, 2 * Math.PI);
            ctx.fillStyle = p.label === 1 ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }
}

/**
 * 绘制悬停信息
 * 从 app.js:1943 迁移
 */
function drawObjectHighlights() {
    const annotationState = getAnnotationState();
    if (!annotationState.objects) return;
    
    // 收集所有需要高亮的对象索引
    const highlightIndices = new Set();
    if (hoverState.objectIndex !== -1) highlightIndices.add(hoverState.objectIndex);
    if (annotationState.activeObjectIndex !== -1) highlightIndices.add(annotationState.activeObjectIndex);
    if (highlightedObjectIndex !== -1) highlightIndices.add(highlightedObjectIndex);
    
    // 只为高亮对象绘制矩形边界框和标签，非高亮对象已由 drawAllMasks 的多边形轮廓表示
    highlightIndices.forEach(index => {
        const obj = annotationState.objects[index];
        if (!obj || !obj.isVisible || !obj.boxData) return;
        
        const box = obj.boxData;
        const p1 = scaleCoordsToCanvas({ x: box[0], y: box[1] });
        const p2 = scaleCoordsToCanvas({ x: box[2], y: box[3] });
        const width = p2.x - p1.x;
        const height = p2.y - p1.y;
        
        const isHovered = index === hoverState.objectIndex;
        const isActive = index === annotationState.activeObjectIndex;
        const isListHighlighted = index === highlightedObjectIndex;
        
        ctx.save();
        
        if (isActive || isListHighlighted) {
            // active 或列表高亮：粗边框带发光效果
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = 3;
            ctx.shadowColor = obj.color;
            ctx.shadowBlur = 10;
            ctx.strokeRect(p1.x, p1.y, width, height);
            ctx.shadowBlur = 0;
            
            // 绘制角标增强视觉效果
            const cornerLength = Math.min(15, width * 0.15, height * 0.15);
            ctx.lineWidth = 3;
            ctx.beginPath();
            // 左上角
            ctx.moveTo(p1.x, p1.y + cornerLength); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p1.x + cornerLength, p1.y);
            // 右上角
            ctx.moveTo(p2.x - cornerLength, p1.y); ctx.lineTo(p2.x, p1.y); ctx.lineTo(p2.x, p1.y + cornerLength);
            // 左下角
            ctx.moveTo(p1.x, p2.y - cornerLength); ctx.lineTo(p1.x, p2.y); ctx.lineTo(p1.x + cornerLength, p2.y);
            // 右下角
            ctx.moveTo(p2.x - cornerLength, p2.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p2.x, p2.y - cornerLength);
            ctx.stroke();
            
            // 绘制标签
            const labels = appState.getState('labels') || [];
            const matchedLabel = labels.find(l => l.id === obj.classId);
            const labelText = matchedLabel ? matchedLabel.name : `标签 ${obj.classId}`;
            ctx.font = 'bold 13px Arial';
            const textWidth = ctx.measureText(labelText).width;
            const labelWidth = Math.max(textWidth + 12, 65);
            const labelHeight = 22;
            
            ctx.fillStyle = obj.color;
            ctx.fillRect(p1.x, p1.y - labelHeight, labelWidth, labelHeight);
            ctx.fillStyle = 'white';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, p1.x + 6, p1.y - labelHeight / 2);
        } else if (isHovered) {
            // 仅悬停：中等边框
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(p1.x, p1.y, width, height);
            
            const labelsHover = appState.getState('labels') || [];
            const matchedLabelHover = labelsHover.find(l => l.id === obj.classId);
            const labelTextHover = matchedLabelHover ? matchedLabelHover.name : `标签 ${obj.classId}`;
            ctx.font = '13px Arial';
            const textWidthHover = ctx.measureText(labelTextHover).width;
            const labelWidthHover = Math.max(textWidthHover + 12, 60);
            
            ctx.fillStyle = obj.color;
            ctx.fillRect(p1.x, p1.y - 20, labelWidthHover, 20);
            ctx.fillStyle = 'white';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelTextHover, p1.x + 6, p1.y - 10);
        }
        
        ctx.restore();
    });
}

/**
 * 处理Canvas点击事件
 * 从 app.js:3316 迁移
 */
export async function handleCanvasClick(e, label) {
    const annotationState = getAnnotationState();
    if (!annotationState.objects || annotationState.activeObjectIndex === -1) return;
    
    const activeObject = annotationState.objects[annotationState.activeObjectIndex];
    const canvasCoords = getCanvasMousePos(e);
    const imageCoords = scaleCoordsToImage(canvasCoords);
    
    // 检查点击是否在图像区域内
    if (!imageCoords) {
        return;
    }
    
    // 检查是否点击了现有的点（删除）
    const pointToRemoveIdx = activeObject.points.findIndex(p => {
        const canvasPoint = scaleCoordsToCanvas(p);
        return canvasPoint && Math.hypot(canvasCoords.x - canvasPoint.x, canvasCoords.y - canvasPoint.y) < 8;
    });
    
    if (pointToRemoveIdx !== -1) {
        activeObject.points.splice(pointToRemoveIdx, 1);
    } else {
        activeObject.points.push({ x: imageCoords.x, y: imageCoords.y, label });
    }
    
    // 触发分割事件
    eventBus.emit('annotation:segmentation-needed');
    redrawAll();
}

/**
 * 处理Canvas鼠标移动事件
 * 从 app.js:3344 迁移
 */
export function handleCanvasMouseMove(e) {
    const annotationState = getAnnotationState();
    if (!annotationState.objects) return;
    
    const canvasCoords = getCanvasMousePos(e);
    let needsRedraw = false;
    const oldPointHover = hoverState.pointIndex;
    hoverState.pointIndex = -1;
    
    const activeObject = annotationState.objects[annotationState.activeObjectIndex];
    if (activeObject) {
        const foundPoint = activeObject.points.findIndex(p => {
            const canvasP = scaleCoordsToCanvas(p);
            return Math.hypot(canvasCoords.x - canvasP.x, canvasCoords.y - canvasP.y) < 8;
        });
        if (foundPoint > -1) hoverState.pointIndex = foundPoint;
    }
    
    if (oldPointHover !== hoverState.pointIndex) needsRedraw = true;
    
    const oldObjectHover = hoverState.objectIndex;
    hoverState.objectIndex = -1;
    
    for (let i = annotationState.objects.length - 1; i >= 0; i--) {
        const obj = annotationState.objects[i];
        const box = obj.boxData;
        
        if (!obj.isVisible || !box) {
            continue;
        }
        
        if (obj.isVisible && box) {
            const p1 = scaleCoordsToCanvas({ x: box[0], y: box[1] });
            const p2 = scaleCoordsToCanvas({ x: box[2], y: box[3] });
            if (canvasCoords.x >= p1.x && canvasCoords.x <= p2.x && 
                canvasCoords.y >= p1.y && canvasCoords.y <= p2.y) {
                hoverState.objectIndex = i;
                break;
            }
        }
    }
    
    if (oldObjectHover !== hoverState.objectIndex) {
        needsRedraw = true;
        // 发出事件通知侧边栏高亮对应列表项
        eventBus.emit(EVENTS.ANNOTATION_OBJECT_HOVERED, hoverState.objectIndex);
    }
    if (needsRedraw) redrawAll();
}

/**
 * 清空Canvas
 */
export function clearCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * 获取Canvas鼠标位置
 * 从 app.js:5297 迁移
 */
function getCanvasMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/**
 * 获取图像在Canvas中的实际显示区域
 * 从 app.js:5323 迁移
 */
function getImageDisplayRect() {
    if (!imageDimensions.naturalWidth || !imageDimensions.naturalHeight) {
        return { x: 0, y: 0, width: canvas.width, height: canvas.height };
    }
    
    const containerAspect = canvas.width / canvas.height;
    const imageAspect = imageDimensions.naturalWidth / imageDimensions.naturalHeight;
    
    let displayWidth, displayHeight, displayX, displayY;
    
    if (imageAspect > containerAspect) {
        // 图像更宽，以宽度为准
        displayWidth = canvas.width;
        displayHeight = canvas.width / imageAspect;
        displayX = 0;
        displayY = (canvas.height - displayHeight) / 2;
    } else {
        // 图像更高，以高度为准
        displayHeight = canvas.height;
        displayWidth = canvas.height * imageAspect;
        displayX = (canvas.width - displayWidth) / 2;
        displayY = 0;
    }
    
    return {
        x: displayX,
        y: displayY,
        width: displayWidth,
        height: displayHeight
    };
}

/**
 * 将图像坐标转换为Canvas坐标
 * 从 app.js:5357 迁移
 */
function scaleCoordsToCanvas(point) {
    const displayRect = getImageDisplayRect();
    const x = Array.isArray(point) ? point[0] : point.x;
    const y = Array.isArray(point) ? point[1] : point.y;
    
    // 将原始图像坐标转换到canvas显示坐标
    const canvasX = (x / imageDimensions.naturalWidth) * displayRect.width + displayRect.x;
    const canvasY = (y / imageDimensions.naturalHeight) * displayRect.height + displayRect.y;
    
    return { x: canvasX, y: canvasY };
}

/**
 * 将Canvas坐标转换为图像坐标
 * 从 app.js:5300 迁移
 */
function scaleCoordsToImage(canvasCoords) {
    const displayRect = getImageDisplayRect();
    
    // 检查点击是否在图像显示区域内
    if (canvasCoords.x < displayRect.x ||
        canvasCoords.x > displayRect.x + displayRect.width ||
        canvasCoords.y < displayRect.y ||
        canvasCoords.y > displayRect.y + displayRect.height) {
        return null;
    }
    
    // 计算相对于图像显示区域的坐标
    const relativeX = canvasCoords.x - displayRect.x;
    const relativeY = canvasCoords.y - displayRect.y;
    
    // 分别计算X和Y的缩放比例，确保精确转换
    const scaleX = imageDimensions.naturalWidth / displayRect.width;
    const scaleY = imageDimensions.naturalHeight / displayRect.height;
    
    // 转换为原始图像坐标
    return {
        x: Math.round(relativeX * scaleX),
        y: Math.round(relativeY * scaleY)
    };
}

/**
 * 将十六进制颜色转换为RGBA
 * 从 app.js:1955 迁移
 */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 处理标注状态变化
 */
function handleStateChanged() {
    redrawAll();
}

/**
 * 处理活动对象变化
 */
function handleActiveObjectChanged() {
    redrawAll();
}

/**
 * 处理列表悬停事件（来自侧边栏）
 */
function handleListHovered(index) {
    const oldHighlight = highlightedObjectIndex;
    highlightedObjectIndex = index;
    if (oldHighlight !== highlightedObjectIndex) {
        redrawAll();
    }
}

export default {
    init,
    redrawAll,
    clearCanvas,
    setImageDimensions,
    handleCanvasClick,
    handleCanvasMouseMove
};
