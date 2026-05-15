/**
 * 手动编辑模块
 * 处理已完成标注（矩形框、多边形、OBB）的顶点拖拽、边拖拽和整体移动
 */

import { eventBus, EVENTS } from '../../core/event-bus.js';
import { getAnnotationState, getActiveObject, updateActiveObjectMask } from './annotation-state.js';

// 编辑状态
let editState = {
    isDragging: false,
    dragType: null,       // 'vertex' | 'edge' | 'move'
    dragIndex: -1,        // 被拖拽的顶点/边索引
    dragStartImage: null, // 拖拽起始图像坐标
    originalMaskData: null, // 拖拽前的原始数据（用于取消）
    originalBoxData: null,
    originalObbData: null
};

// 悬停状态（用于光标变化和视觉反馈）
let editHover = {
    type: null,   // 'vertex' | 'edge' | 'interior' | null
    index: -1     // 顶点/边索引
};

// Canvas和图像尺寸
let canvas = null;
let imageDimensions = { width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 };

// 常量
const VERTEX_HIT_RADIUS = 8;   // 顶点命中半径（canvas像素）
const EDGE_HIT_DISTANCE = 5;   // 边命中距离（canvas像素）
const EDGE_MIDPOINT_RADIUS = 5; // 边中点标记半径

/**
 * 初始化编辑模块
 */
export function init() {
    canvas = document.getElementById('point-canvas');
    
    // 活动对象切换时重置编辑状态和光标
    eventBus.on(EVENTS.ANNOTATION_ACTIVE_OBJECT_CHANGED, () => {
        editHover.type = null;
        editHover.index = -1;
        updateCursor(null);
    });
}

/**
 * 设置图像尺寸信息
 */
export function setImageDimensions(dims) {
    imageDimensions = dims;
}

/**
 * 是否正在拖拽编辑
 */
export function isDragging() {
    return editState.isDragging;
}

/**
 * 获取当前编辑悬停状态（用于光标和渲染）
 */
export function getEditHover() {
    return editHover;
}

/**
 * 判断当前活动对象是否可编辑
 */
export function isEditable() {
    const obj = getActiveObject();
    if (!obj || !obj.maskData) return false;
    return obj.annotationType === 'rectangle' || obj.annotationType === 'polygon' || obj.annotationType === 'obb';
}

// ─── Hit Testing ─────────────────────────────────────────────────────────────

/**
 * 对当前活动对象进行命中检测
 * @param {Object} canvasCoords - Canvas坐标
 * @returns {{ type: string|null, index: number }} 命中类型和索引
 */
export function hitTest(canvasCoords) {
    const obj = getActiveObject();
    if (!obj || !obj.maskData || !obj.maskData[0]) return { type: null, index: -1 };

    const polygon = obj.maskData[0]; // 第一个多边形
    const canvasPoints = polygon.map(p => imageToCanvas(p));

    // 优先级1：顶点
    for (let i = 0; i < canvasPoints.length; i++) {
        const dist = Math.hypot(canvasCoords.x - canvasPoints[i].x, canvasCoords.y - canvasPoints[i].y);
        if (dist < VERTEX_HIT_RADIUS) {
            return { type: 'vertex', index: i };
        }
    }

    // 优先级2：边（多边形类型才支持边上插入顶点）
    for (let i = 0; i < canvasPoints.length; i++) {
        const j = (i + 1) % canvasPoints.length;
        const dist = pointToSegmentDistance(canvasCoords, canvasPoints[i], canvasPoints[j]);
        if (dist < EDGE_HIT_DISTANCE) {
            return { type: 'edge', index: i };
        }
    }

    // 优先级3：内部（point-in-polygon）—— 仅矩形和OBB支持整体平移
    if (obj.annotationType !== 'polygon' && pointInPolygon(canvasCoords, canvasPoints)) {
        return { type: 'interior', index: -1 };
    }

    return { type: null, index: -1 };
}

// ─── Mouse Event Handlers ────────────────────────────────────────────────────

/**
 * 处理鼠标按下（开始拖拽）
 * @returns {boolean} 是否已处理
 */
export function handleMouseDown(canvasCoords, imageCoords) {
    if (!isEditable()) return false;

    const hit = hitTest(canvasCoords);
    if (!hit.type) return false;

    const obj = getActiveObject();

    // 多边形：点击边 → 插入顶点，然后开始拖拽新顶点
    if (hit.type === 'edge' && obj.annotationType === 'polygon') {
        const polygon = obj.maskData[0];
        const insertIdx = hit.index + 1;
        polygon.splice(insertIdx, 0, [imageCoords.x, imageCoords.y]);
        // 更新后开始拖拽这个新顶点
        startDrag('vertex', insertIdx, imageCoords, obj);
        return true;
    }

    startDrag(hit.type, hit.index, imageCoords, obj);
    return true;
}

/**
 * 处理鼠标移动
 * @returns {boolean} 是否已处理（正在拖拽）
 */
export function handleMouseMove(canvasCoords, imageCoords) {
    if (editState.isDragging) {
        performDrag(imageCoords);
        return true;
    }

    // 非拖拽：更新悬停状态
    if (isEditable()) {
        const hit = hitTest(canvasCoords);
        const changed = editHover.type !== hit.type || editHover.index !== hit.index;
        editHover.type = hit.type;
        editHover.index = hit.index;
        updateCursor(hit.type);
        return changed; // 返回是否需要重绘
    }

    return false;
}

/**
 * 处理鼠标释放（完成拖拽）
 * @returns {boolean} 是否已处理
 */
export function handleMouseUp(canvasCoords, imageCoords) {
    if (!editState.isDragging) return false;

    finishDrag();
    return true;
}

/**
 * 处理右键点击（删除多边形顶点）
 * @returns {boolean} 是否已处理
 */
export function handleRightClick(canvasCoords) {
    const obj = getActiveObject();
    if (!obj || obj.annotationType !== 'polygon' || !obj.maskData || !obj.maskData[0]) return false;

    const polygon = obj.maskData[0];
    const canvasPoints = polygon.map(p => imageToCanvas(p));

    // 查找点击的顶点
    for (let i = 0; i < canvasPoints.length; i++) {
        const dist = Math.hypot(canvasCoords.x - canvasPoints[i].x, canvasCoords.y - canvasPoints[i].y);
        if (dist < VERTEX_HIT_RADIUS) {
            // 多边形至少需要3个顶点
            if (polygon.length <= 3) return true;
            polygon.splice(i, 1);
            recalcBox(obj);
            eventBus.emit('manual-edit:updated');
            return true;
        }
    }

    return false;
}

/**
 * 取消当前拖拽，恢复原始数据
 */
export function cancelEdit() {
    if (!editState.isDragging) return;

    const obj = getActiveObject();
    if (obj && editState.originalMaskData) {
        obj.maskData = editState.originalMaskData;
        obj.boxData = editState.originalBoxData;
        if (editState.originalObbData) obj.obbData = editState.originalObbData;
    }

    resetEditState();
    eventBus.emit('manual-edit:cancelled');
}

// ─── Drag Logic ──────────────────────────────────────────────────────────────

function startDrag(type, index, imageCoords, obj) {
    editState.isDragging = true;
    editState.dragType = type;
    editState.dragIndex = index;
    editState.dragStartImage = { ...imageCoords };
    editState.originalMaskData = JSON.parse(JSON.stringify(obj.maskData));
    editState.originalBoxData = obj.boxData ? [...obj.boxData] : null;
    editState.originalObbData = obj.obbData ? JSON.parse(JSON.stringify(obj.obbData)) : null;
}

function performDrag(imageCoords) {
    if (!imageCoords) return;

    const obj = getActiveObject();
    if (!obj || !obj.maskData || !obj.maskData[0]) return;

    const type = obj.annotationType;

    if (editState.dragType === 'vertex') {
        dragVertex(obj, imageCoords);
    } else if (editState.dragType === 'edge') {
        dragEdge(obj, imageCoords);
    } else if (editState.dragType === 'interior') {
        dragMove(obj, imageCoords);
    }

    recalcBox(obj);
    eventBus.emit('manual-edit:updated');
}

function finishDrag() {
    const obj = getActiveObject();
    if (obj) {
        recalcBox(obj);
        // 通过 updateActiveObjectMask 触发状态事件
        updateActiveObjectMask(obj.maskData, obj.boxData);
    }
    resetEditState();
    eventBus.emit('manual-edit:completed');
}

function resetEditState() {
    editState.isDragging = false;
    editState.dragType = null;
    editState.dragIndex = -1;
    editState.dragStartImage = null;
    editState.originalMaskData = null;
    editState.originalBoxData = null;
    editState.originalObbData = null;
}

// ─── Vertex Drag ─────────────────────────────────────────────────────────────

function dragVertex(obj, imageCoords) {
    const polygon = obj.maskData[0];
    const idx = editState.dragIndex;
    if (idx < 0 || idx >= polygon.length) return;

    if (obj.annotationType === 'rectangle') {
        // 矩形：拖拽一个角点，对角点固定，重新计算AABB四顶点
        const oppositeIdx = (idx + 2) % 4;
        const opposite = polygon[oppositeIdx];
        const x1 = Math.min(imageCoords.x, opposite[0]);
        const y1 = Math.min(imageCoords.y, opposite[1]);
        const x2 = Math.max(imageCoords.x, opposite[0]);
        const y2 = Math.max(imageCoords.y, opposite[1]);
        polygon[0] = [x1, y1];
        polygon[1] = [x2, y1];
        polygon[2] = [x2, y2];
        polygon[3] = [x1, y2];
    } else if (obj.annotationType === 'obb') {
        // OBB：拖拽角点需保持矩形约束
        dragObbVertex(obj, idx, imageCoords);
    } else {
        // 多边形：自由移动顶点
        polygon[idx] = [imageCoords.x, imageCoords.y];
    }
}

/**
 * OBB 顶点拖拽（保持矩形约束）
 * 顶点顺序：[A, B, C, D]，AB∥DC，AD∥BC
 * 拖拽某角点时，对角点固定，邻边方向保持不变
 */
function dragObbVertex(obj, idx, imageCoords) {
    const polygon = obj.maskData[0];
    const oppositeIdx = (idx + 2) % 4;
    const prevIdx = (idx + 3) % 4;
    const nextIdx = (idx + 1) % 4;

    const O = { x: polygon[oppositeIdx][0], y: polygon[oppositeIdx][1] }; // 对角点（固定）
    const P = { x: polygon[prevIdx][0], y: polygon[prevIdx][1] };         // 邻接点1
    const N = { x: polygon[nextIdx][0], y: polygon[nextIdx][1] };         // 邻接点2

    // 从对角点出发的两条边方向
    const d1 = { x: P.x - O.x, y: P.y - O.y }; // O → prevIdx 方向
    const d2 = { x: N.x - O.x, y: N.y - O.y }; // O → nextIdx 方向

    const len1 = Math.hypot(d1.x, d1.y);
    const len2 = Math.hypot(d2.x, d2.y);
    if (len1 < 1 || len2 < 1) return;

    // 单位向量
    const u1 = { x: d1.x / len1, y: d1.y / len1 };
    const u2 = { x: d2.x / len2, y: d2.y / len2 };

    // 将鼠标位置投影到两个方向上
    const v = { x: imageCoords.x - O.x, y: imageCoords.y - O.y };
    const proj1 = v.x * u1.x + v.y * u1.y;
    const proj2 = v.x * u2.x + v.y * u2.y;

    // 重新计算四个角点
    const newPrev = { x: O.x + u1.x * proj1, y: O.y + u1.y * proj1 };
    const newNext = { x: O.x + u2.x * proj2, y: O.y + u2.y * proj2 };
    const newDragged = { x: O.x + u1.x * proj1 + u2.x * proj2, y: O.y + u1.y * proj1 + u2.y * proj2 };

    polygon[oppositeIdx] = [O.x, O.y];
    polygon[prevIdx] = [newPrev.x, newPrev.y];
    polygon[nextIdx] = [newNext.x, newNext.y];
    polygon[idx] = [newDragged.x, newDragged.y];

    // 同步 obbData
    if (obj.obbData) {
        obj.obbData = polygon.map(p => [...p]);
    }
}

// ─── Edge Drag ───────────────────────────────────────────────────────────────

function dragEdge(obj, imageCoords) {
    const polygon = obj.maskData[0];
    const idx = editState.dragIndex;
    const nextIdx = (idx + 1) % polygon.length;

    if (obj.annotationType === 'rectangle') {
        // 矩形：拖拽边 → 该边沿法线方向移动
        dragRectEdge(polygon, idx, imageCoords);
    } else if (obj.annotationType === 'obb') {
        // OBB：拖拽边 → 该边沿法线方向移动，对边固定
        dragObbEdge(obj, idx, imageCoords);
    } else {
        // 多边形：拖拽边 → 两个端点同时平移
        const dx = imageCoords.x - editState.dragStartImage.x;
        const dy = imageCoords.y - editState.dragStartImage.y;
        const origPolygon = editState.originalMaskData[0];
        polygon[idx] = [origPolygon[idx][0] + dx, origPolygon[idx][1] + dy];
        polygon[nextIdx] = [origPolygon[nextIdx][0] + dx, origPolygon[nextIdx][1] + dy];
    }
}

function dragRectEdge(polygon, edgeIdx, imageCoords) {
    // 矩形顶点顺序：[TL(0), TR(1), BR(2), BL(3)]
    // 边：0=上(TL-TR), 1=右(TR-BR), 2=下(BR-BL), 3=左(BL-TL)
    const origPolygon = editState.originalMaskData[0];
    const x1 = origPolygon[0][0], y1 = origPolygon[0][1];
    const x2 = origPolygon[2][0], y2 = origPolygon[2][1];

    let nx1 = x1, ny1 = y1, nx2 = x2, ny2 = y2;

    if (edgeIdx === 0) ny1 = imageCoords.y;       // 上边
    else if (edgeIdx === 1) nx2 = imageCoords.x;   // 右边
    else if (edgeIdx === 2) ny2 = imageCoords.y;   // 下边
    else if (edgeIdx === 3) nx1 = imageCoords.x;   // 左边

    polygon[0] = [nx1, ny1];
    polygon[1] = [nx2, ny1];
    polygon[2] = [nx2, ny2];
    polygon[3] = [nx1, ny2];
}

function dragObbEdge(obj, edgeIdx, imageCoords) {
    const polygon = obj.maskData[0];
    const origPolygon = editState.originalMaskData[0];

    // 被拖拽的边：edgeIdx → (edgeIdx+1)
    // 对边：(edgeIdx+2) → (edgeIdx+3)
    const i0 = edgeIdx;
    const i1 = (edgeIdx + 1) % 4;
    const i2 = (edgeIdx + 2) % 4;
    const i3 = (edgeIdx + 3) % 4;

    // 边方向
    const eDir = {
        x: origPolygon[i1][0] - origPolygon[i0][0],
        y: origPolygon[i1][1] - origPolygon[i0][1]
    };
    const eLen = Math.hypot(eDir.x, eDir.y);
    if (eLen < 1) return;

    // 法线方向（从对边指向本边）
    const normal = { x: -eDir.y / eLen, y: eDir.x / eLen };

    // 计算鼠标在法线方向上相对于原始边的位移
    const origMid = {
        x: (origPolygon[i0][0] + origPolygon[i1][0]) / 2,
        y: (origPolygon[i0][1] + origPolygon[i1][1]) / 2
    };
    const delta = (imageCoords.x - origMid.x) * normal.x + (imageCoords.y - origMid.y) * normal.y;

    // 移动本边的两个顶点，对边不动
    polygon[i0] = [origPolygon[i0][0] + normal.x * delta, origPolygon[i0][1] + normal.y * delta];
    polygon[i1] = [origPolygon[i1][0] + normal.x * delta, origPolygon[i1][1] + normal.y * delta];
    polygon[i2] = [origPolygon[i2][0], origPolygon[i2][1]];
    polygon[i3] = [origPolygon[i3][0], origPolygon[i3][1]];

    if (obj.obbData) {
        obj.obbData = polygon.map(p => [...p]);
    }
}

// ─── Move (Interior Drag) ───────────────────────────────────────────────────

function dragMove(obj, imageCoords) {
    const polygon = obj.maskData[0];
    const origPolygon = editState.originalMaskData[0];
    const dx = imageCoords.x - editState.dragStartImage.x;
    const dy = imageCoords.y - editState.dragStartImage.y;

    for (let i = 0; i < polygon.length; i++) {
        polygon[i] = [origPolygon[i][0] + dx, origPolygon[i][1] + dy];
    }

    if (obj.obbData) {
        obj.obbData = polygon.map(p => [...p]);
    }
}

// ─── Geometry Helpers ────────────────────────────────────────────────────────

/**
 * 重新计算 boxData（AABB）
 */
function recalcBox(obj) {
    if (!obj.maskData || !obj.maskData[0]) return;
    const polygon = obj.maskData[0];
    const xs = polygon.map(p => p[0]);
    const ys = polygon.map(p => p[1]);
    obj.boxData = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * 点到线段的距离
 */
function pointToSegmentDistance(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * 点是否在多边形内部（射线法）
 */
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * 图像坐标 → Canvas坐标
 */
function imageToCanvas(point) {
    const displayRect = getImageDisplayRect();
    const x = Array.isArray(point) ? point[0] : point.x;
    const y = Array.isArray(point) ? point[1] : point.y;
    return {
        x: (x / imageDimensions.naturalWidth) * displayRect.width + displayRect.x,
        y: (y / imageDimensions.naturalHeight) * displayRect.height + displayRect.y
    };
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
 * 更新鼠标光标
 */
function updateCursor(hitType) {
    if (!canvas) return;
    switch (hitType) {
        case 'vertex':
            canvas.style.cursor = 'grab';
            break;
        case 'edge':
            canvas.style.cursor = 'pointer';
            break;
        case 'interior':
            canvas.style.cursor = 'move';
            break;
        default:
            canvas.style.cursor = '';
            break;
    }
}

/**
 * 获取当前活动对象的编辑控制柄数据（用于Canvas渲染）
 * @returns {{ vertices: Array, edgeMidpoints: Array, annotationType: string }|null}
 */
export function getEditHandles() {
    const obj = getActiveObject();
    if (!obj || !obj.maskData || !obj.maskData[0]) return null;
    if (obj.annotationType !== 'rectangle' && obj.annotationType !== 'polygon' && obj.annotationType !== 'obb') return null;

    const polygon = obj.maskData[0];
    const vertices = polygon.map(p => imageToCanvas(p));

    // 边中点（仅多边形才显示，用于提示可插入顶点）
    let edgeMidpoints = [];
    if (obj.annotationType === 'polygon') {
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            const mid = imageToCanvas([(polygon[i][0] + polygon[j][0]) / 2, (polygon[i][1] + polygon[j][1]) / 2]);
            edgeMidpoints.push(mid);
        }
    }

    return {
        vertices,
        edgeMidpoints,
        annotationType: obj.annotationType,
        hoverType: editHover.type,
        hoverIndex: editHover.index,
        color: obj.color
    };
}

export default {
    init,
    setImageDimensions,
    isDragging,
    isEditable,
    getEditHover,
    getEditHandles,
    hitTest,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleRightClick,
    cancelEdit
};
