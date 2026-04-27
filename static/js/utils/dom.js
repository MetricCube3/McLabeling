/**
 * DOM操作工具
 * 提供常用的DOM操作辅助函数
 */

/**
 * 查询单个元素
 * @param {string} selector - CSS选择器
 * @param {Element} parent - 父元素
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * 查询多个元素
 * @param {string} selector - CSS选择器
 * @param {Element} parent - 父元素
 * @returns {NodeList}
 */
export function $$(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * 创建元素
 * @param {string} tag - 标签名
 * @param {Object} attributes - 属性对象
 * @param {string|Element|Array} children - 子元素
 * @returns {Element}
 */
export function createElement(tag, attributes = {}, children = null) {
    const element = document.createElement(tag);
    
    // 设置属性
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else if (key.startsWith('on')) {
            const eventName = key.substring(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // 添加子元素
    if (children) {
        if (typeof children === 'string') {
            element.textContent = children;
        } else if (children instanceof Element) {
            element.appendChild(children);
        } else if (Array.isArray(children)) {
            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof Element) {
                    element.appendChild(child);
                }
            });
        }
    }
    
    return element;
}

/**
 * 显示元素
 * @param {Element|string} element - 元素或选择器
 */
export function show(element) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) el.classList.remove('hidden');
}

/**
 * 隐藏元素
 * @param {Element|string} element - 元素或选择器
 */
export function hide(element) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) el.classList.add('hidden');
}

/**
 * 切换元素显示状态
 * @param {Element|string} element - 元素或选择器
 */
export function toggle(element) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) el.classList.toggle('hidden');
}

/**
 * 添加类名
 * @param {Element|string} element - 元素或选择器
 * @param {string|Array} classNames - 类名
 */
export function addClass(element, classNames) {
    const el = typeof element === 'string' ? $(element) : element;
    if (!el) return;
    
    const classes = Array.isArray(classNames) ? classNames : [classNames];
    el.classList.add(...classes);
}

/**
 * 移除类名
 * @param {Element|string} element - 元素或选择器
 * @param {string|Array} classNames - 类名
 */
export function removeClass(element, classNames) {
    const el = typeof element === 'string' ? $(element) : element;
    if (!el) return;
    
    const classes = Array.isArray(classNames) ? classNames : [classNames];
    el.classList.remove(...classes);
}

/**
 * 检查是否有类名
 * @param {Element|string} element - 元素或选择器
 * @param {string} className - 类名
 * @returns {boolean}
 */
export function hasClass(element, className) {
    const el = typeof element === 'string' ? $(element) : element;
    return el ? el.classList.contains(className) : false;
}

/**
 * 设置/获取HTML内容
 * @param {Element|string} element - 元素或选择器
 * @param {string} html - HTML内容（不传则为获取）
 * @returns {string|void}
 */
export function html(element, html) {
    const el = typeof element === 'string' ? $(element) : element;
    if (!el) return;
    
    if (html === undefined) {
        return el.innerHTML;
    } else {
        el.innerHTML = html;
    }
}

/**
 * 设置/获取文本内容
 * @param {Element|string} element - 元素或选择器
 * @param {string} text - 文本内容（不传则为获取）
 * @returns {string|void}
 */
export function text(element, text) {
    const el = typeof element === 'string' ? $(element) : element;
    if (!el) return;
    
    if (text === undefined) {
        return el.textContent;
    } else {
        el.textContent = text;
    }
}

/**
 * 设置/获取属性
 * @param {Element|string} element - 元素或选择器
 * @param {string|Object} attr - 属性名或属性对象
 * @param {string} value - 属性值（不传则为获取）
 * @returns {string|void}
 */
export function attr(element, attr, value) {
    const el = typeof element === 'string' ? $(element) : element;
    if (!el) return;
    
    if (typeof attr === 'object') {
        Object.entries(attr).forEach(([key, val]) => {
            el.setAttribute(key, val);
        });
    } else if (value === undefined) {
        return el.getAttribute(attr);
    } else {
        el.setAttribute(attr, value);
    }
}

/**
 * 移除属性
 * @param {Element|string} element - 元素或选择器
 * @param {string} attr - 属性名
 */
export function removeAttr(element, attr) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) el.removeAttribute(attr);
}

/**
 * 事件委托
 * @param {Element|string} parent - 父元素或选择器
 * @param {string} selector - 子元素选择器
 * @param {string} event - 事件名称
 * @param {Function} handler - 事件处理函数
 */
export function delegate(parent, selector, event, handler) {
    const el = typeof parent === 'string' ? $(parent) : parent;
    if (!el) return;
    
    el.addEventListener(event, (e) => {
        const target = e.target.closest(selector);
        if (target && el.contains(target)) {
            handler.call(target, e);
        }
    });
}

/**
 * 清空元素内容
 * @param {Element|string} element - 元素或选择器
 */
export function empty(element) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) {
        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }
    }
}

/**
 * 移除元素
 * @param {Element|string} element - 元素或选择器
 */
export function remove(element) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el && el.parentNode) {
        el.parentNode.removeChild(el);
    }
}

/**
 * 获取/设置数据属性
 * @param {Element|string} element - 元素或选择器
 * @param {string|Object} key - 数据键或数据对象
 * @param {*} value - 数据值（不传则为获取）
 * @returns {*}
 */
export function data(element, key, value) {
    const el = typeof element === 'string' ? $(element) : element;
    if (!el) return;
    
    if (typeof key === 'object') {
        Object.entries(key).forEach(([k, v]) => {
            el.dataset[k] = JSON.stringify(v);
        });
    } else if (value === undefined) {
        const val = el.dataset[key];
        try {
            return JSON.parse(val);
        } catch {
            return val;
        }
    } else {
        el.dataset[key] = JSON.stringify(value);
    }
}

export default {
    $,
    $$,
    createElement,
    show,
    hide,
    toggle,
    addClass,
    removeClass,
    hasClass,
    html,
    text,
    attr,
    removeAttr,
    delegate,
    empty,
    remove,
    data
};
