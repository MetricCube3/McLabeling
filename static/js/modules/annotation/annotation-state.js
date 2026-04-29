/**
 * 标注状态管理模块
 * 管理标注对象、活动对象索引等状态
 * 从 app.js 迁移而来
 */

import { appState } from '../../core/state.js';
import { eventBus, EVENTS } from '../../core/event-bus.js';

// 默认颜色列表
const COLORS = ['#FF3838', '#FF9D38', '#3877FF', '#38FFFF', '#8B38FF', '#FF38F5'];

// 标注状态
let annotationState = {
    objects: [],
    activeObjectIndex: -1,
    nextId: 1,
    nextObjectId: 1
};

/**
 * 初始化标注状态管理模块
 */
export function init() {
    // 可以在这里订阅需要的状态变化
    appState.subscribe('labels', handleLabelsChange);
}

/**
 * 获取当前标注状态
 */
export function getAnnotationState() {
    return annotationState;
}

/**
 * 设置标注状态（用于加载已有标注）
 */
export function setAnnotationState(state) {
    annotationState = state;
    eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
}

/**
 * 初始化标注状态
 * 从 app.js:1740 迁移
 */
export function initAnnotationState() {
    annotationState = {
        objects: [],
        activeObjectIndex: -1,
        nextId: 1,
        nextObjectId: 1
    };
    eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
}

/**
 * 清空标注状态（不添加默认对象）
 * 从 app.js:1747 迁移
 */
export function clearAnnotationState() {
    annotationState = {
        objects: [],
        activeObjectIndex: -1,
        nextId: 1,
        nextObjectId: 1
    };
    eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
}

/**
 * 获取下一个可用的ID（始终使用最大ID+1）
 */
function getNextAvailableId() {
    if (annotationState.objects.length === 0) {
        return 1;
    }
    const maxId = Math.max(...annotationState.objects.map(obj => obj.id));
    return maxId + 1;
}

/**
 * 添加新对象
 * 从 app.js:1750 迁移
 */
export function addNewObject() {
    const labels = appState.getState('labels') || [];
    
    // 获取默认标签的颜色（如果有标签的话）
    let defaultColor = COLORS[0]; // 后备颜色
    let defaultClassId = 0;
    
    if (Array.isArray(labels) && labels.length > 0) {
        // 使用第一个标签的颜色和ID
        defaultClassId = labels[0].id;
        defaultColor = labels[0].color || COLORS[0];
    }
    
    const newObject = {
        id: getNextAvailableId(),  // 使用最小可用ID
        color: defaultColor,
        classId: defaultClassId,
        points: [],
        maskData: null,
        boxData: null,
        isVisible: true,
        annotationType: 'sam', // 标注类型：sam, rectangle, polygon
    };
    
    annotationState.objects.push(newObject);
    setActiveObject(annotationState.objects.length - 1);
    
    return newObject;
}

/**
 * 设置活动对象
 * 从 app.js:1774 迁移
 */
export function setActiveObject(index) {
    annotationState.activeObjectIndex = index;
    eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
    eventBus.emit(EVENTS.ANNOTATION_ACTIVE_OBJECT_CHANGED, index);
}

/**
 * 删除对象
 * 从 app.js:1778 迁移
 */
export function deleteObject(index) {
    annotationState.objects.splice(index, 1);
    
    if (annotationState.activeObjectIndex === index) {
        annotationState.activeObjectIndex = -1;
    } else if (annotationState.activeObjectIndex > index) {
        annotationState.activeObjectIndex--;
    }
    
    // 删除后不自动添加新对象，允许列表为空
    if (annotationState.objects.length > 0 && annotationState.activeObjectIndex === -1) {
        setActiveObject(annotationState.objects.length - 1);
    } else {
        eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
    }
}

/**
 * 切换对象可见性
 * 从 app.js:1786 迁移
 */
export function toggleObjectVisibility(index) {
    if (index >= 0 && index < annotationState.objects.length) {
        annotationState.objects[index].isVisible = !annotationState.objects[index].isVisible;
        eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
    }
}

/**
 * 更新对象的类别ID
 * 从 app.js:1790 迁移
 */
export function updateObjectClassId(index, newClassId) {
    if (index < 0 || index >= annotationState.objects.length) return;
    
    const obj = annotationState.objects[index];
    obj.classId = newClassId;
    
    // 更新颜色为该标签对应的颜色
    const labels = appState.getState('labels') || [];
    if (Array.isArray(labels) && labels.length > 0) {
        const selectedLabel = labels.find(label => label.id === newClassId);
        if (selectedLabel && selectedLabel.color) {
            obj.color = selectedLabel.color;
        }
    }
    
    eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
}

/**
 * 获取活动对象
 */
export function getActiveObject() {
    if (annotationState.activeObjectIndex === -1) return null;
    return annotationState.objects[annotationState.activeObjectIndex];
}

/**
 * 获取所有对象
 */
export function getAllObjects() {
    return annotationState.objects;
}

/**
 * 更新活动对象的points
 */
export function updateActiveObjectPoints(points) {
    const activeObject = getActiveObject();
    if (activeObject) {
        activeObject.points = points;
        eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
    }
}

/**
 * 更新活动对象的mask数据
 */
export function updateActiveObjectMask(maskData, boxData) {
    const activeObject = getActiveObject();
    if (activeObject) {
        activeObject.maskData = maskData;
        activeObject.boxData = boxData;
        eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
    }
}

/**
 * 当标签列表变化时的处理
 */
function handleLabelsChange(newLabels) {
    // 标签变化时，可能需要更新对象的颜色等
    // 这里暂时不做处理，保持现有标注不变
}

/**
 * 从服务器数据加载标注状态
 */
export function loadAnnotationFromData(data) {
    if (!data || !Array.isArray(data.objects)) {
        initAnnotationState();
        return;
    }
    
    annotationState = {
        objects: data.objects.map((obj, index) => ({
            id: obj.id || index + 1,
            color: obj.color || COLORS[index % COLORS.length],
            classId: obj.classId || obj.class_id || 0,
            points: obj.points || [],
            maskData: obj.maskData || obj.mask_data || null,
            boxData: obj.boxData || obj.box_data || null,
            isVisible: obj.isVisible !== undefined ? obj.isVisible : true,
        })),
        activeObjectIndex: -1,
        nextId: Math.max(...data.objects.map(obj => obj.id || 0), 0) + 1,
        nextObjectId: Math.max(...data.objects.map(obj => obj.id || 0), 0) + 1
    };
    
    eventBus.emit(EVENTS.ANNOTATION_STATE_CHANGED, annotationState);
}

/**
 * 将标注状态转换为可保存的格式
 */
export function serializeAnnotationState() {
    return {
        objects: annotationState.objects.map(obj => ({
            id: obj.id,
            class_id: obj.classId,
            color: obj.color,
            points: obj.points,
            mask_data: obj.maskData,
            box_data: obj.boxData,
            is_visible: obj.isVisible
        }))
    };
}

export default {
    init,
    getAnnotationState,
    setAnnotationState,
    initAnnotationState,
    clearAnnotationState,
    addNewObject,
    setActiveObject,
    deleteObject,
    toggleObjectVisibility,
    updateObjectClassId,
    getActiveObject,
    getAllObjects,
    updateActiveObjectPoints,
    updateActiveObjectMask,
    loadAnnotationFromData,
    serializeAnnotationState
};
