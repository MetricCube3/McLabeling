/**
 * 手动绘制模块
 * 处理矩形框和多边形的手动绘制
 */

import { eventBus } from '../../core/event-bus.js';
import { getAnnotationState, getActiveObject, updateActiveObjectMask } from './annotation-state.js';
import { getCurrentDrawMode, DRAW_MODE } from './draw-mode.js';

// 矩形绘制状态
let rectangleDrawing = {
    isDrawing: false,
    startPoint: null,
    currentPoint: null
};

// 多边形绘制状态
let polygonDrawing = {
    isDrawing: false,
    points: []
};

// Canvas相关变量
let canvas = null;
let imageDimensions = { width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 };

/**
 * 初始化手动绘制模块
 */
export function init() {
    canvas = document.getElementById('point-canvas');
    
    // 监听绘制模式变化
    eventBus.on('draw-mode:changed', handleDrawModeChanged);
}

/**
 * 设置图像尺寸信息
 */
export function setImageDimensions(dims) {
    imageDimensions = dims;
}

/**
 * 处理绘制模式变化
 */
function handleDrawModeChanged(mode) {
    // 清除未完成的绘制
    resetDrawingStates();
}

/**
 * 重置所有绘制状态
 */
function resetDrawingStates() {
    rectangleDrawing = {
        isDrawing: false,
        startPoint: null,
        currentPoint: null
    };
    
    polygonDrawing = {
        isDrawing: false,
        points: []
    };
}

/**
 * 处理鼠标按下事件（开始绘制）
 */
export function handleMouseDown(e, canvasCoords, imageCoords) {
    const mode = getCurrentDrawMode();
    
    if (mode === DRAW_MODE.RECTANGLE) {
        startRectangleDrawing(canvasCoords, imageCoords);
    } else if (mode === DRAW_MODE.POLYGON) {
        // 检查是否点击了第一个点
        if (polygonDrawing.isDrawing && polygonDrawing.points.length >= 3) {
            const firstPointIndex = findNearbyPoint(canvasCoords, 0);
            if (firstPointIndex === 0) {
                // 点击第一个点，完成绘制
                finishPolygonDrawing();
                return;
            }
        }
        
        // 否则添加新顶点
        addPolygonPoint(canvasCoords, imageCoords);
    }
}

/**
 * 处理鼠标移动事件
 */
export function handleMouseMove(e, canvasCoords, imageCoords) {
    const mode = getCurrentDrawMode();
    
    if (mode === DRAW_MODE.RECTANGLE && rectangleDrawing.isDrawing) {
        updateRectangleDrawing(canvasCoords, imageCoords);
    } else if (mode === DRAW_MODE.POLYGON && polygonDrawing.isDrawing) {
        // 多边形绘制中，更新预览
        eventBus.emit('manual-draw:polygon-preview', imageCoords);
    }
}

/**
 * 处理鼠标释放事件（完成绘制）
 */
export function handleMouseUp(e, canvasCoords, imageCoords) {
    const mode = getCurrentDrawMode();
    
    if (mode === DRAW_MODE.RECTANGLE && rectangleDrawing.isDrawing) {
        finishRectangleDrawing(canvasCoords, imageCoords);
    }
}

/**
 * 处理双击事件（完成多边形）
 */
export function handleDoubleClick(e) {
    const mode = getCurrentDrawMode();
    
    if (mode === DRAW_MODE.POLYGON && polygonDrawing.isDrawing) {
        finishPolygonDrawing();
    }
}

/**
 * 处理右键点击（删除已有点）
 */
export function handleRightClick(e, canvasCoords, imageCoords) {
    const mode = getCurrentDrawMode();
    
    if (mode === DRAW_MODE.POLYGON && polygonDrawing.isDrawing) {
        // 查找是否点击了已有的点
        const pointIndex = findNearbyPoint(canvasCoords, -1);
        
        if (pointIndex !== -1) {
            // 删除该点
            polygonDrawing.points.splice(pointIndex, 1);
            eventBus.emit('manual-draw:polygon-updated', polygonDrawing.points);
            
            // 如果删除后点数少于1个，取消绘制
            if (polygonDrawing.points.length === 0) {
                resetDrawingStates();
                eventBus.emit('manual-draw:cancelled');
            }
        }
        
        return true; // 阻止默认右键菜单
    }
    
    return false;
}

/**
 * 开始矩形框绘制
 */
function startRectangleDrawing(canvasCoords, imageCoords) {
    if (!imageCoords) return;
    
    rectangleDrawing.isDrawing = true;
    rectangleDrawing.startPoint = imageCoords;
    rectangleDrawing.currentPoint = imageCoords;
}

/**
 * 更新矩形框绘制
 */
function updateRectangleDrawing(canvasCoords, imageCoords) {
    if (!imageCoords) return;
    
    rectangleDrawing.currentPoint = imageCoords;
    
    // 触发重绘事件
    eventBus.emit('manual-draw:rectangle-preview', {
        start: rectangleDrawing.startPoint,
        current: rectangleDrawing.currentPoint
    });
}

/**
 * 完成矩形框绘制
 */
function finishRectangleDrawing(canvasCoords, imageCoords) {
    if (!imageCoords || !rectangleDrawing.startPoint) {
        rectangleDrawing.isDrawing = false;
        return;
    }
    
    const start = rectangleDrawing.startPoint;
    const end = imageCoords;
    
    // 计算矩形的边界框
    const x1 = Math.min(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const x2 = Math.max(start.x, end.x);
    const y2 = Math.max(start.y, end.y);
    
    // 检查矩形是否太小（避免误点击）
    const width = x2 - x1;
    const height = y2 - y1;
    if (width < 10 || height < 10) {
        rectangleDrawing.isDrawing = false;
        eventBus.emit('manual-draw:cancelled');
        return;
    }
    
    // 创建矩形的多边形表示（四个顶点）
    const polygon = [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2]
    ];
    
    // 更新活动对象的mask和box数据
    const activeObject = getActiveObject();
    if (activeObject) {
        const maskData = [polygon];
        const boxData = [x1, y1, x2, y2];
        
        updateActiveObjectMask(maskData, boxData);
        
        // 清除points（手动绘制不需要SAM点）
        activeObject.points = [];
        
        // 标记为矩形框标注
        activeObject.annotationType = 'rectangle';
    }
    
    rectangleDrawing.isDrawing = false;
    eventBus.emit('manual-draw:completed');
}

/**
 * 添加多边形顶点
 */
function addPolygonPoint(canvasCoords, imageCoords) {
    if (!imageCoords) return;
    
    // 如果是第一个点，开始绘制
    if (!polygonDrawing.isDrawing) {
        polygonDrawing.isDrawing = true;
        polygonDrawing.points = [];
    }
    
    // 添加顶点
    polygonDrawing.points.push(imageCoords);
    
    // 触发更新事件
    eventBus.emit('manual-draw:polygon-updated', polygonDrawing.points);
}

/**
 * 完成多边形绘制
 */
function finishPolygonDrawing() {
    if (polygonDrawing.points.length < 3) {
        resetDrawingStates();
        eventBus.emit('manual-draw:cancelled');
        return;
    }
    
    // 将点转换为数组格式
    const polygon = polygonDrawing.points.map(p => [p.x, p.y]);
    
    // 计算边界框
    const xs = polygon.map(p => p[0]);
    const ys = polygon.map(p => p[1]);
    const x1 = Math.min(...xs);
    const y1 = Math.min(...ys);
    const x2 = Math.max(...xs);
    const y2 = Math.max(...ys);
    
    // 更新活动对象的mask和box数据
    const activeObject = getActiveObject();
    if (activeObject) {
        const maskData = [polygon];
        const boxData = [x1, y1, x2, y2];
        
        updateActiveObjectMask(maskData, boxData);
        
        // 清除points（手动绘制不需要SAM点）
        activeObject.points = [];
        
        // 标记为多边形标注
        activeObject.annotationType = 'polygon';
    }
    
    polygonDrawing.isDrawing = false;
    polygonDrawing.points = [];
    eventBus.emit('manual-draw:completed');
}

/**
 * 取消当前绘制
 */
export function cancelDrawing() {
    resetDrawingStates();
    eventBus.emit('manual-draw:cancelled');
}

/**
 * 获取当前绘制状态（用于Canvas绘制）
 */
export function getDrawingState() {
    return {
        rectangle: rectangleDrawing,
        polygon: polygonDrawing
    };
}

/**
 * 是否正在绘制
 */
export function isDrawing() {
    return rectangleDrawing.isDrawing || polygonDrawing.isDrawing;
}

/**
 * 查找是否点击了某个顶点附近
 * @param {Object} canvasCoords - Canvas坐标
 * @param {Number} specificIndex - 特定索引，-1表示查找所有点
 * @returns {Number} 点的索引，-1表示未找到
 */
function findNearbyPoint(canvasCoords, specificIndex) {
    if (!polygonDrawing.isDrawing || polygonDrawing.points.length === 0) {
        return -1;
    }
    
    const threshold = 10; // 点击容差（像素）
    
    // 将图像坐标转换为Canvas坐标需要用到imageDimensions
    const displayRect = getImageDisplayRect();
    
    if (specificIndex >= 0) {
        // 检查特定点
        if (specificIndex < polygonDrawing.points.length) {
            const point = polygonDrawing.points[specificIndex];
            const canvasPoint = imageToCanvasCoords(point, displayRect);
            const distance = Math.hypot(canvasCoords.x - canvasPoint.x, canvasCoords.y - canvasPoint.y);
            if (distance < threshold) {
                return specificIndex;
            }
        }
        return -1;
    }
    
    // 查找所有点
    for (let i = 0; i < polygonDrawing.points.length; i++) {
        const point = polygonDrawing.points[i];
        const canvasPoint = imageToCanvasCoords(point, displayRect);
        const distance = Math.hypot(canvasCoords.x - canvasPoint.x, canvasCoords.y - canvasPoint.y);
        if (distance < threshold) {
            return i;
        }
    }
    
    return -1;
}

/**
 * 获取图像显示区域
 */
function getImageDisplayRect() {
    if (!canvas || !imageDimensions.naturalWidth || !imageDimensions.naturalHeight) {
        return { x: 0, y: 0, width: canvas?.width || 0, height: canvas?.height || 0 };
    }
    
    const containerAspect = canvas.width / canvas.height;
    const imageAspect = imageDimensions.naturalWidth / imageDimensions.naturalHeight;
    
    let displayWidth, displayHeight, displayX, displayY;
    
    if (imageAspect > containerAspect) {
        displayWidth = canvas.width;
        displayHeight = canvas.width / imageAspect;
        displayX = 0;
        displayY = (canvas.height - displayHeight) / 2;
    } else {
        displayHeight = canvas.height;
        displayWidth = canvas.height * imageAspect;
        displayX = (canvas.width - displayWidth) / 2;
        displayY = 0;
    }
    
    return { x: displayX, y: displayY, width: displayWidth, height: displayHeight };
}

/**
 * 将图像坐标转换为Canvas坐标
 */
function imageToCanvasCoords(point, displayRect) {
    const x = (point.x / imageDimensions.naturalWidth) * displayRect.width + displayRect.x;
    const y = (point.y / imageDimensions.naturalHeight) * displayRect.height + displayRect.y;
    return { x, y };
}

export default {
    init,
    setImageDimensions,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    handleRightClick,
    cancelDrawing,
    getDrawingState,
    isDrawing
};
