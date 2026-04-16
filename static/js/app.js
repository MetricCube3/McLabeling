document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const expandSidebarBtn = document.getElementById('expand-sidebar-btn');
    const mainSidebar = document.getElementById('main-sidebar');
    const sidebarCollapsedHeader = document.getElementById('sidebar-collapsed-header');
    const mainLayout = document.getElementById('main-layout');
    const annotateModeBtn = document.getElementById('annotate-mode-btn'),
          reviewModeBtn = document.getElementById('review-mode-btn'),
          videoSelectionUI = document.getElementById('video-selection'),
          annotationUI = document.getElementById('annotation-ui'),
          videoList = document.getElementById('video-list'),
          breadcrumb = document.getElementById('breadcrumb'),
          displayImage = document.getElementById('display-image'),
          canvas = document.getElementById('point-canvas'),
          ctx = canvas.getContext('2d'),
          sidebar = document.getElementById('sidebar'),
          objectList = document.getElementById('object-list'),
          addObjectBtn = document.getElementById('add-object-btn'),
          prevFrameBtn = document.getElementById('prev-frame-btn'),
          nextFrameBtn = document.getElementById('next-frame-btn'),
          frameCounter = document.getElementById('frame-counter'),
          skipFramesInput = document.getElementById('skip-frames'),
          modifyBtn = document.getElementById('modify-btn'),
          cancelModifyBtn = document.getElementById('cancel-modify-btn'),
          resetBtn = document.getElementById('reset-btn'),
          autoAnnotateBtn = document.getElementById('auto-annotate-btn'),
          saveSuccessBtn = document.getElementById('save-success-btn'),
          backToListBtn = document.getElementById('back-to-list-btn'),
          toastNotification = document.getElementById('toast-notification');

    // --- New UI Elements for Login ---
    const loginModal = document.getElementById('login-modal'),
          usernameInput = document.getElementById('username-input'),
          passwordInput = document.getElementById('password-input'),
          loginBtn = document.getElementById('login-btn'),
          loginError = document.getElementById('login-error'),
          mainContainer = document.getElementById('main-container'),
          deleteBtn = document.getElementById('delete-btn'),
          mainContentArea = document.getElementById('main-content-area'),
          backToMainBtn = document.getElementById('back-to-main-btn');

    // --- Admin Panel ---
    const adminPanel = document.getElementById('admin-panel'),
          userManagementTable = document.getElementById('user-management-table'),
          newUsernameInput = document.getElementById('new-username'),
          newPasswordInput = document.getElementById('new-password'),
          newUserRolesContainer = document.getElementById('new-user-roles'),
          addUserBtn = document.getElementById('add-user-btn'),
          clearFormBtn = document.getElementById('clear-form-btn');

    // --- NEW: Task Assignment ---
    const videoPoolSelect = document.getElementById('video-pool-select'),
          annotatorSelect = document.getElementById('annotator-select'),
          assignAnnotationBtn = document.getElementById('assign-annotation-btn'),
          reviewPoolSelect = document.getElementById('review-pool-select'),
          reviewerSelect = document.getElementById('reviewer-select'),
          assignReviewBtn = document.getElementById('assign-review-btn');

    // 在现有的变量声明部分添加新变量
    const labelManagementModeBtn = document.getElementById('label-management-mode-btn');
    const labelManagementUI = document.getElementById('label-management-ui');
    const labelListContainer = document.getElementById('label-list-container');
    const labelCount = document.getElementById('label-count');
    const labelAdminSection = document.getElementById('label-admin-section');
    const labelUserNotice = document.getElementById('label-user-notice');

    // 在现有的变量声明部分添加新变量
    const datasetManagementModeBtn = document.getElementById('dataset-management-mode-btn');
    const datasetManagementUI = document.getElementById('dataset-management-ui');
    const mainVideoUploadInput = document.getElementById('main-video-upload-input');
    const mainUploadVideosBtn = document.getElementById('main-upload-videos-btn');
    const mainUploadStatus = document.getElementById('main-upload-status');
    const mainImageUploadInput = document.getElementById('main-image-upload-input');
    const mainUploadImagesBtn = document.getElementById('main-upload-images-btn');
    const mainUploadImageStatus = document.getElementById('main-upload-image-status');
    const refreshDatasetsBtn = document.getElementById('refresh-datasets-btn');
    const datasetListContainer = document.getElementById('dataset-list-container');
    const videoCount = document.getElementById('video-count');
    const imageTaskCount = document.getElementById('image-task-count');
    const totalDatasetCount = document.getElementById('total-dataset-count');

    const currentPageSpan = document.getElementById('current-page');
    const totalPagesSpan = document.getElementById('total-pages');

    // 在现有的变量声明部分添加新变量
    const taskAssignmentModeBtn = document.getElementById('task-assignment-mode-btn');
    const taskAssignmentUI = document.getElementById('task-assignment-ui');

    const modelManagementModeBtn = document.getElementById('model-management-mode-btn');
    const modelManagementUI = document.getElementById('model-management-ui');

    const userAvatar = document.getElementById('user-avatar');
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    const dropdownUsername = document.getElementById('dropdown-username');
    const dropdownRoles = document.getElementById('dropdown-roles');
    const dropdownAdminBtn = document.getElementById('admin-mode-btn');

    const logoutBtn = document.getElementById('logout-btn');

    const projectManagementModeBtn = document.getElementById('project-management-mode-btn');
    const projectManagementUI = document.getElementById('project-management-ui');
    const newProjectNameInput = document.getElementById('new-project-name');
    const initialLabelsContainer = document.getElementById('initial-labels-container');
    const addInitialLabelBtn = document.getElementById('add-initial-label-btn');
    const createProjectBtn = document.getElementById('create-project-btn');
    const clearProjectFormBtn = document.getElementById('clear-project-form-btn');
    const projectListContainer = document.getElementById('project-list-container');
    const projectCount = document.getElementById('project-count');

    const projectSelectorSection = document.getElementById('project-selector-section');
    const labelProjectSelect = document.getElementById('label-project-select');
    const currentProjectInfo = document.getElementById('current-project-info');
    const labelFormTitle = document.getElementById('label-form-title');
    const labelFormHint = document.getElementById('label-form-hint');
    const userNoticeText = document.getElementById('user-notice-text');

    // 项目管理状态
    let projects = [];
    let currentProject = null;

    let labelManagementContext = {
        currentProject: null, // 必须选择项目，不能为null
    };
    
    let dropdownTimeout = null;

    // 添加分页状态变量
    let paginationState = {
        currentPage: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
        allDatasets: []  // 存储所有数据集用于前端分页
    };

    // 在现有的变量声明部分添加分页状态变量
    let taskPaginationState = {
        currentPage: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1
    };

    let reviewImagePaginationState = {
        currentPage: 1,
        pageSize: 60,
        totalItems: 0,
        totalPages: 1
    };

    let taskPaginationBottom, reviewImagePaginationTop, reviewImagePaginationBottom;

    // --- State Management ---
    let jumpToFrameInput = null; // 用于跟踪当前是否在输入跳转帧号
    let appMode = 'annotate'; // 'annotate', 'review', 'label_management', 'dataset_management', 'task_assignment'
    let currentVideoPath = null, currentFrameIndex = 0, totalFrames = 0;
    let imageDimensions = { width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, ratio: 1 };
    let annotationState = {};
    let hoverState = { pointIndex: -1, objectIndex: -1 };
    const COLORS = ['#FF3838', '#FF9D38', '#3877FF', '#38FFFF', '#8B38FF', '#FF38F5'];

    let taskSkipFrames = {}; // 存储每个任务的间隔帧数设置
    let currentTaskSkipFrames = 1; // 当前任务的间隔帧数

    // Review Mode Context
    let reviewContext = {
        basePath: '',      
        fileList: [],      
        currentIndex: -1   
    };
    
    // NEW: Path of the file currently being edited/reviewed
    let editingFilePath = null;

    // --- New State Management for User ---
    let currentUser = null;
    let userRoles = [];

    // --- 标签管理相关变量 ---
    let labels = [];

    let taskManagementState = {
        currentTask: null,
        currentTaskType: null
    };

    let filterState = {
        status: 'all',
        user: '',
        project: ''
    };

    let frameExtractionModal = null;
    let currentExtractionVideoPath = null;
    let extractionProgressInterval = null;

    // 自定义确认对话框函数
    function showCustomConfirm(message, details = [], title = "确认操作") {
        return new Promise((resolve) => {
            // 创建模态框
            const modal = document.createElement('div');
            modal.className = 'custom-confirm-modal';

            // 构建对话框内容
            modal.innerHTML = `
                <div class="custom-confirm-dialog">
                    <div class="custom-confirm-header">
                        <div class="custom-confirm-icon">⚠️</div>
                        <h3 class="custom-confirm-title">${title}</h3>
                    </div>
                    
                    <div class="custom-confirm-content">
                        <div class="custom-confirm-message">${message}</div>
                        
                        ${details.length > 0 ? `
                            <div class="custom-confirm-details">
                                <ul>
                                    ${details.map(detail => `<li>${detail}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        
                        <div class="custom-confirm-warning">
                            <span class="custom-confirm-warning-icon">🚨</span>
                            此操作不可恢复！
                        </div>
                    </div>
                    
                    <div class="custom-confirm-actions">
                        <button class="custom-confirm-btn cancel" type="button">取消</button>
                        <button class="custom-confirm-btn confirm" type="button">确认删除</button>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(modal);

            // 获取按钮元素
            const confirmBtn = modal.querySelector('.custom-confirm-btn.confirm');
            const cancelBtn = modal.querySelector('.custom-confirm-btn.cancel');

            // 确认按钮事件
            confirmBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });

            // 取消按钮事件
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });

            // ESC键关闭
            const handleEscKey = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    resolve(false);
                    document.removeEventListener('keydown', handleEscKey);
                }
            };
            document.addEventListener('keydown', handleEscKey);

            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(false);
                }
            });

            // 自动聚焦取消按钮（更安全）
            cancelBtn.focus();
        });
    }

    function debounce(func, wait) {
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

    // 优化侧边栏切换性能
    const optimizedToggleSidebar = debounce(function() {
        const isCollapsed = mainSidebar.classList.contains('sidebar-collapsed');

        if (isCollapsed) {
            // 展开侧边栏
            mainSidebar.classList.remove('sidebar-collapsed');
            mainContentArea.classList.remove('main-content-expanded');
            sidebarCollapsedHeader.classList.add('hidden');
            toggleSidebarBtn.innerHTML = '<span class="btn-icon">◀</span>';
            toggleSidebarBtn.title = "隐藏侧边栏";
        } else {
            // 折叠侧边栏
            mainSidebar.classList.add('sidebar-collapsed');
            mainContentArea.classList.add('main-content-expanded');
            sidebarCollapsedHeader.classList.remove('hidden');
            toggleSidebarBtn.innerHTML = '<span class="btn-icon">▶</span>';
            toggleSidebarBtn.title = "显示侧边栏";
        }
    }, 16); // 约60fps

    // 替换原来的toggleSidebar函数
    function toggleSidebar() {
        optimizedToggleSidebar();
    }

    // 优化任务列表渲染 - 添加虚拟滚动
    function optimizeTaskListRendering() {
        const videoList = document.getElementById('video-list');
        if (!videoList) return;

        // 监听滚动事件，实现虚拟滚动
        videoList.addEventListener('scroll', debounce(function() {
            // 这里可以添加虚拟滚动逻辑
            // 只渲染可见区域的任务项
        }, 16));

        // 减少重排重绘
        const items = videoList.querySelectorAll('.video-item, .folder-item');
        items.forEach(item => {
            item.style.willChange = 'transform';
        });
    }

    function expandSidebar() {
        mainSidebar.classList.remove('sidebar-collapsed');
        mainContentArea.classList.remove('main-content-expanded');
        sidebarCollapsedHeader.classList.add('hidden');
        toggleSidebarBtn.innerHTML = '<span class="btn-icon">◀</span>';
        toggleSidebarBtn.title = "隐藏侧边栏";
    }


    // --- 修改现有的帧计数器显示和交互 ---
    function updateFrameCounter() {
        if (appMode === 'review') {
            // 在审核模式下，显示全局索引和总图片数
            const globalIndex = (reviewContext.currentPage - 1) * reviewContext.pageSize + reviewContext.currentIndex + 1;
            frameCounter.textContent = `${globalIndex} / ${reviewContext.totalImages}`;
        } else {
            // 在标注模式下，使用原有的逻辑
            frameCounter.textContent = `${currentFrameIndex + 1} / ${totalFrames}`;
        }

        // 移除可能存在的输入框，恢复为普通文本
        if (frameCounter.querySelector('input')) {
            const input = frameCounter.querySelector('input');
            input.remove();
        }
        jumpToFrameInput = null;
    }

    function makeFrameCounterEditable() {
        // 如果已经在编辑状态，则不做任何操作
        if (jumpToFrameInput) return;

        const currentText = frameCounter.textContent;
        const [current, total] = currentText.split(' / ').map(Number);

        // 创建输入框
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = total.toString();
        input.value = current.toString();
        input.style.width = '60px';
        input.style.textAlign = 'center';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '3px';
        input.style.padding = '2px';

        // 清空frameCounter内容并添加输入框
        frameCounter.textContent = '';
        frameCounter.appendChild(input);

        // 添加分隔符
        frameCounter.appendChild(document.createTextNode(` / ${total}`));

        // 自动聚焦并选择文本
        input.focus();
        input.select();

        jumpToFrameInput = input;

        // 添加键盘事件
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleJumpToFrame();
            } else if (e.key === 'Escape') {
                updateFrameCounter(); // 恢复原状
            }
        });

        // 点击外部时恢复原状
        setTimeout(() => {
            const outsideClickHandler = (e) => {
                if (!frameCounter.contains(e.target)) {
                    updateFrameCounter();
                    document.removeEventListener('click', outsideClickHandler);
                }
            };
            document.addEventListener('click', outsideClickHandler);
        }, 100);
    }

    function handleJumpToFrame() {
        if (!jumpToFrameInput) return;

        const targetFrame = parseInt(jumpToFrameInput.value, 10);
        if (isNaN(targetFrame)) {
            updateFrameCounter(); // 恢复原状
            return;
        }

        if (appMode === 'review') {
            // 审核模式下跳转到指定图片索引（全局索引）
            const frameIndex = targetFrame - 1;
            if (frameIndex < 0 || frameIndex >= reviewContext.totalImages) {
                showToast(`图片序号超出范围 (1-${reviewContext.totalImages})`, 'warning');
                updateFrameCounter();
                return;
            }

            // 计算目标图片在哪个分页
            const targetPage = Math.floor(frameIndex / reviewImagePaginationState.pageSize) + 1;
            const targetIndexInPage = frameIndex % reviewImagePaginationState.pageSize;

            if (targetPage !== reviewContext.currentPage) {
                // 如果目标图片不在当前页，需要先切换到正确的分页
                reviewImagePaginationState.currentPage = targetPage;
                browse(reviewContext.basePath).then(() => {
                    // 分页加载完成后，启动审核会话
                    setTimeout(() => {
                        startReviewSession(targetIndexInPage);
                    }, 100);
                });
            } else {
                // 如果目标图片在当前页，直接跳转
                reviewContext.currentIndex = targetIndexInPage;
                loadReviewedImage();
            }
        } else {
            // 标注模式下跳转到指定视频帧
            if (targetFrame < 1 || targetFrame > totalFrames) {
                showToast(`帧号超出范围 (1-${totalFrames})`, 'warning');
                updateFrameCounter();
                return;
            }
            const frameIndex = targetFrame - 1;
            loadFrame(frameIndex);
        }
    }


    async function loadProjects() {
        if (!Array.isArray(userRoles) || !userRoles.includes('admin')) return;

        try {
            const response = await fetch(`/api/admin/projects?user=${currentUser}`);
            const data = await response.json();

            if (response.ok) {
                projects = data.projects || {};
                renderProjectList();
            } else {
                throw new Error(data.error || '获取项目列表失败');
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
            showToast(`加载项目失败: ${error.message}`, 'error');
        }
    }

    function renderProjectList() {
    if (!projectListContainer) return;

    // 清空现有内容
    projectListContainer.innerHTML = '';

    const projectEntries = Object.entries(projects);
    projectCount.textContent = `共 ${projectEntries.length} 个项目`;

    if (projectEntries.length === 0) {
        projectListContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <h3>暂无项目</h3>                
            </div>
        `;
        return;
    }

    const table = document.createElement('table');
    table.className = 'project-management-table';

    // 表头
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>📛 项目名称</th>
            <th>📅 创建时间</th>
            <th>🏷️ 标签数量</th>
            <th>📊 任务统计</th>
            <th>⚡ 操作</th>
        </tr>
    `;
    table.appendChild(thead);

    // 表体
    const tbody = document.createElement('tbody');

    projectEntries.forEach(([projectName, projectData]) => {
        const labelCount = projectData.labels ? projectData.labels.length : 0;
        const annotationTasks = projectData.tasks?.annotation?.length || 0;
        const reviewTasks = projectData.tasks?.review?.length || 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="project-name-cell">
                <span class="project-icon">📁</span>
                ${projectName}
            </td>
            <td class="project-time-cell">${projectData.created_time}</td>
            <td class="project-labels-cell">
                <span class="label-count-badge">${labelCount} 个标签</span>
            </td>
            <td class="project-stats-cell">
                <button class="project-action-btn stats-btn" data-project="${projectName}" title="可导出项目标注数据">
                    <span class="btn-icon">👀</span>
                    查看统计
                </button>                
            </td>
            <td class="project-actions-cell">                
                <button class="project-action-btn delete" data-project="${projectName}">
                    <span class="btn-icon">🗑️</span>
                    删除
                </button>
            </td>
        `;

        // 添加事件监听
        const statsBtn = row.querySelector('.stats-btn');
        const deleteBtn = row.querySelector('.delete');

        statsBtn.addEventListener('click', () => {
            showProjectTaskStats(projectName);
        });

        deleteBtn.addEventListener('click', () => {
            deleteProject(projectName);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    projectListContainer.appendChild(table);
}

    async function showProjectTaskStats(projectName) {
        try {
            const response = await fetch(`/api/admin/project_task_stats?user=${currentUser}&project=${encodeURIComponent(projectName)}`);
            const data = await response.json();

            if (response.ok) {
                showTaskStatsModal(data);
            } else {
                throw new Error(data.error || '获取任务统计失败');
            }
        } catch (error) {
            console.error('Failed to load project task stats:', error);
            showToast(`加载任务统计失败: ${error.message}`, 'error');
        }
    }

    function showTaskStatsModal(statsData) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay task-stats-modal';

        const { project_name, project_labels, annotation_tasks, total_stats } = statsData;

        // 确保total_stats有默认值
        const safeStats = {
            total_tasks: 0,
            total_images: 0,
            total_labeled: 0,
            progress: 0,
            label_counts: {},
            status_counts: {
                in_progress: 0,
                completed: 0
            },
            ...total_stats
        };

        // 确保annotation_tasks是数组
        const safeTasks = Array.isArray(annotation_tasks) ? annotation_tasks : [];

        // 生成任务列表HTML
        const taskListHTML = generateTaskListHTML(safeTasks);

        // 生成汇总统计HTML
        const summaryHTML = generateSummaryHTML(safeStats);

        // 生成标签统计HTML - 传入项目标签信息
        const labelStatsHTML = generateLabelStatsHTML(safeStats.labeled_counts || safeStats.label_counts || {}, project_labels, project_name);

        modal.innerHTML = `
            <div class="modal-dialog task-stats-dialog">
                <div class="modal-header">
                    <h3>📊 项目任务统计 - ${project_name}</h3>
                    <p class="stats-notice">💡 提示：未分配且未标注的任务不参与统计</p>
                    <button class="close-modal-btn" title="关闭">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- 汇总统计 -->
                    <div class="stats-summary-section">
                        <h4>📈 项目总览</h4>
                        ${summaryHTML}
                    </div>
    
                    <!-- 标签统计 -->
                    <div class="label-stats-section">
                        <h4>🏷️ 标签分布</h4>
                        ${labelStatsHTML}
                    </div>
    
                    <!-- 任务列表 -->
                    <div class="task-list-section">
                        <div class="section-header">
                            <h4>📋 任务详情 (${safeTasks.length})</h4>
                            <div class="task-filters">
                                <label>
                                    <input type="checkbox" id="select-all-tasks" class="select-all-checkbox">
                                    全选
                                </label>
                                <button id="aggregate-selected-btn" class="btn-secondary btn-sm" ${safeTasks.length === 0 ? 'disabled' : ''}>
                                    <span class="btn-icon">📊</span>
                                    汇总选中任务
                                </button>
                            </div>
                        </div>
                        ${taskListHTML}
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="close-stats-modal" class="btn-primary">关闭</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 添加事件监听器
        setupTaskStatsModalEvents(modal, safeTasks, project_name);
    }

    function generateTaskListHTML(annotationTasks) {
        if (annotationTasks.length === 0) {
            return `
                <div class="no-tasks-message">
                    <p>📭 该项目暂无标注任务</p>
                    <p class="no-tasks-hint">请先为项目分配标注任务</p>
                </div>
            `;
        }

        return `
            <div class="task-stats-container">
                <div class="task-stats-grid">
                    ${annotationTasks.map(task => generateTaskCardHTML(task)).join('')}
                </div>
            </div>
        `;
    }

    // 生成单个任务卡片HTML
    function generateTaskCardHTML(task) {
        const statusClass = task.status === 'completed' ? 'completed' : 'in-progress';
        const statusText = task.status === 'completed' ? '已完成' : '进行中';

        return `
            <div class="task-stat-card ${statusClass}" data-task-path="${task.path}" data-task-type="${task.type}">
                <div class="task-card-header">
                    <label class="task-select-label">
                        <input type="checkbox" class="task-select-checkbox" data-task-path="${task.path}">
                        <span class="checkmark"></span>
                    </label>
                    <div class="task-info">
                        <div class="task-name">${task.name}</div>
                        <div class="task-meta">
                            <span class="task-assignee">${task.assignee || '未分配'}</span>
                            <span class="task-status ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 生成汇总统计HTML
    function generateSummaryHTML(totalStats) {
        // 确保所有字段都有默认值
        const stats = {
            total_tasks: 0,
            total_images: 0,
            total_labeled: 0,
            total_annotated_images: 0,
            total_labels: 0,
            overall_completion_rate: 0,
            progress: 0,
            status_counts: {
                in_progress: 0,
                completed: 0
            },
            ...totalStats
        };

        // 确保status_counts存在
        if (!stats.status_counts) {
            stats.status_counts = { in_progress: 0, completed: 0 };
        }

        return `
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-icon">📋</div>
                    <div class="summary-content">
                        <div class="summary-value">${stats.total_tasks || 0}</div>
                        <div class="summary-label">总任务数</div>
                    </div>
                </div>
                <div class="summary-item">
                    <div class="summary-icon">🖼️</div>
                    <div class="summary-content">
                        <div class="summary-value">${stats.total_images || 0}</div>
                        <div class="summary-label">总图片数</div>
                    </div>
                </div>
                <div class="summary-item">
                    <div class="summary-icon">✅</div>
                    <div class="summary-content">
                        <div class="summary-value">${stats.total_labeled || stats.total_annotated_images || 0}</div>
                        <div class="summary-label">已标注图片</div>
                    </div>
                </div>
                <div class="summary-item">
                    <div class="summary-icon">🏷️</div>
                    <div class="summary-content">
                        <div class="summary-value">${stats.total_labels || 0}</div>
                        <div class="summary-label">总标签数</div>
                    </div>
                </div>
                <div class="summary-item">
                    <div class="summary-icon">📈</div>
                    <div class="summary-content">
                        <div class="summary-value">${stats.progress || stats.overall_completion_rate || 0}%</div>
                        <div class="summary-label">完成率</div>
                    </div>
                </div>
                <div class="summary-item">
                    <div class="summary-icon">⚡</div>
                    <div class="summary-content">
                        <div class="summary-value">${(stats.status_counts && stats.status_counts.in_progress) || 0}</div>
                        <div class="summary-label">进行中</div>
                    </div>
                </div>
                <div class="summary-item">
                    <div class="summary-icon">🎉</div>
                    <div class="summary-content">
                        <div class="summary-value">${(stats.status_counts && stats.status_counts.completed) || 0}</div>
                        <div class="summary-label">已完成</div>
                    </div>
                </div>
            </div>
        `;
    }

    // 生成标签统计HTML
    function generateLabelStatsHTML(labelCounts, projectLabels, projectName) {
        const labels = Object.entries(labelCounts);

        if (labels.length === 0) {
            return '<div class="no-labels-message">暂无标签数据</div>';
        }

        // 按数量排序
        const sortedLabels = labels.sort((a, b) => b[1] - a[1]);
        const totalLabels = sortedLabels.reduce((sum, [_, count]) => sum + count, 0);

        return `
            <div class="label-stats-grid">
                ${sortedLabels.map(([labelName, count]) => {
                    const percentage = totalLabels > 0 ? ((count / totalLabels) * 100).toFixed(1) : 0;
                    return `
                    <div class="label-stat-item">
                        <div class="label-info">
                            <span class="label-name" title="${labelName}">${labelName}</span>
                            <span class="label-count">${count}</span>
                        </div>
                        <div class="label-bar-container">
                            <div class="label-bar" style="width: ${percentage}%"></div>
                        </div>
                        <div class="label-percentage">${percentage}%</div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function setupTaskStatsModalEvents(modal, annotationTasks, projectName) {
        const closeModal = () => document.body.removeChild(modal);
        const selectAllCheckbox = modal.querySelector('#select-all-tasks');
        const aggregateBtn = modal.querySelector('#aggregate-selected-btn');
        const taskCheckboxes = modal.querySelectorAll('.task-select-checkbox');

        // 关闭按钮事件
        modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
        modal.querySelector('#close-stats-modal').addEventListener('click', closeModal);

        // 全选/取消全选
        selectAllCheckbox.addEventListener('change', (e) => {
            taskCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });

        // 汇总选中任务
        aggregateBtn.addEventListener('click', () => {
            const selectedTasks = Array.from(taskCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => {
                    const taskPath = cb.dataset.taskPath;
                    return annotationTasks.find(task => task.path === taskPath);
                })
                .filter(task => task);

            if (selectedTasks.length === 0) {
                showToast('请至少选择一个任务进行汇总', 'warning');
                return;
            }

            showAggregateStats(selectedTasks, projectName);
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // ESC键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
    }

    function showAggregateStats(selectedTasks, projectName) {
        // 计算汇总统计
        const aggregateStats = {
            total_tasks: selectedTasks.length,
            total_images: 0,
            total_annotated_images: 0,
            total_labels: 0,
            label_counts: {},
            status_counts: {
                "in_progress": 0,
                "completed": 0
            }
        };

        // 收集所有标签信息用于名称映射
        const allLabelCounts = {};
        const taskPaths = [];

        selectedTasks.forEach(task => {
            const stats = task.stats || {};
            aggregateStats.total_images += stats.total_images || 0;
            aggregateStats.total_annotated_images += stats.annotated_images || 0;
            aggregateStats.total_labels += stats.total_labels || 0;

            // 统计任务状态
            const status = task.status || 'in_progress';
            aggregateStats.status_counts[status] = aggregateStats.status_counts[status] + 1;

            // 收集任务路径
            taskPaths.push(task.path);

            // 合并标签统计 - 使用labeled_counts如果有的话，否则用label_counts
            const labelCounts = stats.labeled_counts || stats.label_counts || {};
            Object.entries(labelCounts).forEach(([labelName, count]) => {
                allLabelCounts[labelName] = (allLabelCounts[labelName] || 0) + count;
            });
        });

        aggregateStats.label_counts = allLabelCounts;

        // 计算完成率
        const completionRate = aggregateStats.total_images > 0
            ? round((aggregateStats.total_annotated_images / aggregateStats.total_images) * 100, 1)
            : 0;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay aggregate-stats-modal';

        // 生成标签汇总分布HTML
        const labelAggregateHTML = generateLabelAggregateHTML(aggregateStats.label_counts, aggregateStats.total_labels);

        modal.innerHTML = `
            <div class="modal-dialog aggregate-stats-dialog">
                <div class="modal-header">
                    <h3>📊 选中任务汇总统计</h3>
                    <button class="close-modal-btn" title="关闭">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="aggregate-summary">
                        <h4>选中 ${selectedTasks.length} 个任务的汇总结果</h4>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <div class="summary-icon">📋</div>
                                <div class="summary-content">
                                    <div class="summary-value">${aggregateStats.total_tasks}</div>
                                    <div class="summary-label">总任务数</div>
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-icon">🖼️</div>
                                <div class="summary-content">
                                    <div class="summary-value">${aggregateStats.total_images}</div>
                                    <div class="summary-label">总图片数</div>
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-icon">✅</div>
                                <div class="summary-content">
                                    <div class="summary-value">${aggregateStats.total_annotated_images}</div>
                                    <div class="summary-label">已标注图片</div>
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-icon">🏷️</div>
                                <div class="summary-content">
                                    <div class="summary-value">${aggregateStats.total_labels}</div>
                                    <div class="summary-label">总标签数</div>
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-icon">📈</div>
                                <div class="summary-content">
                                    <div class="summary-value">${completionRate}%</div>
                                    <div class="summary-label">完成率</div>
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-icon">⚡</div>
                                <div class="summary-content">
                                    <div class="summary-value">${aggregateStats.status_counts.in_progress || 0}</div>
                                    <div class="summary-label">进行中</div>
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-icon">🎉</div>
                                <div class="summary-content">
                                    <div class="summary-value">${aggregateStats.status_counts.completed || 0}</div>
                                    <div class="summary-label">已完成</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${Object.keys(aggregateStats.label_counts).length > 0 ? `
                    <div class="aggregate-label-stats">
                        <h5>🏷️ 标签汇总分布</h5>
                        ${labelAggregateHTML}
                    </div>
                    ` : ''}
    
                    <!-- 导出功能 -->
                    <div class="export-section">
                        <h5>📤 导出标注数据</h5>
                        <div class="export-controls">
                            <!-- 数据集划分比例 -->
                            <div class="export-config-group">
                                <label class="section-label">数据集划分比例</label>
                                <div class="ratio-controls">
                                    <div class="ratio-inputs-horizontal">
                                        <div class="ratio-group-horizontal">
                                            <label for="train-ratio">训练集</label>
                                            <div class="ratio-input-wrapper">
                                                <input type="number" id="train-ratio" class="ratio-input" value="70" min="0" max="100">
                                                <span class="ratio-unit">%</span>
                                            </div>
                                        </div>
                                        <div class="ratio-group-horizontal">
                                            <label for="val-ratio">验证集</label>
                                            <div class="ratio-input-wrapper">
                                                <input type="number" id="val-ratio" class="ratio-input" value="20" min="0" max="100">
                                                <span class="ratio-unit">%</span>
                                            </div>
                                        </div>
                                        <div class="ratio-group-horizontal">
                                            <label for="test-ratio">测试集</label>
                                            <div class="ratio-input-wrapper">
                                                <input type="number" id="test-ratio" class="ratio-input" value="10" min="0" max="100">
                                                <span class="ratio-unit">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="ratio-summary-horizontal">
                                        <span class="ratio-total-label">比例总和：</span>
                                        <span id="ratio-total" class="ratio-total-value">100</span>
                                        <span class="ratio-unit">%</span>
                                    </div>
                                </div>
                            </div>
    
                            <!-- 选择导出格式 -->
                            <div class="export-config-group">
                                <label class="section-label">选择导出格式</label>
                                <div class="format-select-wrapper">
                                    <select id="export-format-select" class="format-select">
                                        <option value="yolo">YOLO格式 (分割+bbox)</option>
                                        <option value="coco">COCO格式 (标准JSON格式)</option>
                                    </select>
                                    <div class="select-arrow">▼</div>
                                </div>
                            </div>
    
                            <!-- 开始导出 -->
                            <div class="export-action-group">                                
                                <button id="export-dataset-btn" class="btn-primary export-action-btn">
                                    <span class="btn-icon">🚀</span>
                                    开始导出
                                </button>
                            </div>
                        </div>
                    </div>                        
                </div>
                <div class="modal-footer">
                    <button class="btn-primary close-aggregate-modal">关闭</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 设置比例输入事件
        setupRatioInputs(modal);

        // 设置导出按钮事件
        setupExportButton(modal, taskPaths, projectName, aggregateStats);

        // 关闭事件
        const closeAggregateModal = () => document.body.removeChild(modal);
        modal.querySelector('.close-modal-btn').addEventListener('click', closeAggregateModal);
        modal.querySelector('.close-aggregate-modal').addEventListener('click', closeAggregateModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAggregateModal();
        });

        // ESC键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeAggregateModal();
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
    }

    function setupRatioInputs(modal) {
        const trainInput = modal.querySelector('#train-ratio');
        const valInput = modal.querySelector('#val-ratio');
        const testInput = modal.querySelector('#test-ratio');
        const totalSpan = modal.querySelector('#ratio-total');

        function updateTotal() {
            const train = parseInt(trainInput.value) || 0;
            const val = parseInt(valInput.value) || 0;
            const test = parseInt(testInput.value) || 0;
            const total = train + val + test;

            totalSpan.textContent = total;

            if (total !== 100) {
                totalSpan.style.color = '#e74c3c';
                totalSpan.style.fontWeight = 'bold';
            } else {
                totalSpan.style.color = '#27ae60';
                totalSpan.style.fontWeight = 'normal';
            }
        }

        [trainInput, valInput, testInput].forEach(input => {
            input.addEventListener('input', updateTotal);
            input.addEventListener('change', updateTotal);
        });

        // 初始更新
        updateTotal();
    }

    function setupExportButton(modal, taskPaths, projectName, stats) {
        const exportBtn = modal.querySelector('#export-dataset-btn');

        exportBtn.addEventListener('click', async () => {
            const trainRatio = parseInt(modal.querySelector('#train-ratio').value) || 0;
            const valRatio = parseInt(modal.querySelector('#val-ratio').value) || 0;
            const testRatio = parseInt(modal.querySelector('#test-ratio').value) || 0;
            const exportFormat = modal.querySelector('#export-format-select').value;

            // 验证比例
            if (trainRatio + valRatio + testRatio !== 100) {
                showToast('训练集、验证集、测试集比例之和必须为100%', 'error');
                return;
            }

            if (stats.total_images === 0) {
                showToast('选中的任务中没有可导出的标注数据', 'warning');
                return;
            }

            try {
                // 禁用按钮并显示加载状态
                exportBtn.disabled = true;

                let endpoint, payload;

                if (exportFormat === 'coco') {
                    endpoint = '/api/admin/export_project_tasks_coco';
                    exportBtn.innerHTML = '<span class="btn-icon">⏳</span>正在导出COCO格式...';
                } else {
                    endpoint = '/api/admin/export_project_tasks';
                    exportBtn.innerHTML = '<span class="btn-icon">⏳</span>正在导出YOLO格式...';
                }

                payload = {
                    user: currentUser,
                    project_name: projectName,
                    task_paths: taskPaths,
                    split_ratios: {
                        train: trainRatio,
                        val: valRatio,
                        test: testRatio
                    }
                };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok) {
                    showToast(data.message, 'success');

                    // 触发下载
                    const downloadLink = document.createElement('a');
                    downloadLink.href = data.download_url;

                    // 根据格式生成不同的文件名
                    let filename;
                    if (exportFormat === 'coco') {
                        filename = `project_${projectName}_coco_export.zip`;
                    } else {
                        filename = `project_${projectName}_yolo_export.zip`;
                    }

                    downloadLink.download = filename;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                } else {
                    throw new Error(data.error || '导出失败');
                }
            } catch (error) {
                console.error('Export failed:', error);
                showToast(`导出失败: ${error.message}`, 'error');
            } finally {
                // 恢复按钮状态
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<span class="btn-icon">🚀</span>开始导出';
            }
        });
    }

    function generateLabelAggregateHTML(labelCounts, totalLabels) {
        const labels = Object.entries(labelCounts);

        if (labels.length === 0) {
            return '<div class="no-labels-message">暂无标签数据</div>';
        }

        // 按数量排序
        const sortedLabels = labels.sort((a, b) => b[1] - a[1]);

        return `
            <div class="label-stats-grid">
                ${sortedLabels.map(([labelName, count]) => {
                    const percentage = totalLabels > 0 ? ((count / totalLabels) * 100).toFixed(1) : 0;
                    return `
                    <div class="label-stat-item">
                        <div class="label-info">
                            <span class="label-name" title="${labelName}">${labelName}</span>
                            <span class="label-count">${count}</span>
                        </div>
                        <div class="label-bar-container">
                            <div class="label-bar" style="width: ${percentage}%"></div>
                        </div>
                        <div class="label-percentage">${percentage}%</div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function round(value, decimals) {
        return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
    }

    function addInitialLabelField() {
        const labelId = Date.now(); // 临时ID
        const labelField = document.createElement('div');
        labelField.className = 'label-field';
        labelField.innerHTML = `
            <input type="text" class="label-input" placeholder="标签名称" data-id="${labelId}">
            <button class="remove-label-btn" type="button">
                <span class="btn-icon">❌</span>
            </button>
        `;

        const removeBtn = labelField.querySelector('.remove-label-btn');
        removeBtn.addEventListener('click', () => {
            labelField.remove();
        });

        initialLabelsContainer.appendChild(labelField);
    }

    function getInitialLabels() {
        const labelInputs = initialLabelsContainer.querySelectorAll('.label-input');
        const labels = [];
        
        // 预定义的颜色列表
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B500', '#52B788'
        ];

        labelInputs.forEach((input, index) => {
            const name = input.value.trim();
            if (name) {
                labels.push({
                    id: index,
                    name: name,
                    color: colors[index % colors.length]  // 循环使用颜色
                });
            }
        });

        return labels;
    }

    function clearProjectForm() {
        newProjectNameInput.value = '';
        initialLabelsContainer.innerHTML = '';
        // 添加一个空的标签输入框
        addInitialLabelField();
    }

    async function createProject() {
        const projectName = newProjectNameInput.value.trim();
        const initialLabels = getInitialLabels();

        if (!projectName) {
            showToast('项目名称不能为空', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/admin/create_project?user=${currentUser}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_name: projectName,
                    description: '',
                    labels: initialLabels
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message);
                clearProjectForm();
                await loadProjects(); // 刷新项目列表
            } else {
                throw new Error(data.detail || data.error || '创建项目失败');
            }
        } catch (error) {
            showToast(`创建项目失败: ${error.message}`, 'error');
        }
    }

    async function deleteProject(projectName) {
        const result = await showCustomConfirm(
            `确定要删除项目 '${projectName}' 吗？`,
            [
                '🏷️ 删除项目的标签体系',
                '🚨 删除项目相关的任务和标注数据',
                '⚠️ 此操作不可逆！'
            ],
            '删除项目'
        );

        if (!result) return;

        try {
            // 显示删除中的状态
            const deleteBtn = document.querySelector(`.project-action-btn.delete[data-project="${projectName}"]`);
            const originalText = deleteBtn.innerHTML;
            deleteBtn.innerHTML = '<span class="btn-icon">⏳</span>删除中...';
            deleteBtn.disabled = true;

            const response = await fetch(`/api/admin/delete_project?user=${currentUser}&project_name=${encodeURIComponent(projectName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');

                // 如果当前标签管理正在使用这个项目，切换到全局标签
                if (labelManagementContext.currentProject === projectName) {
                    labelManagementContext.currentProject = null;
                    labelManagementContext.isGlobal = true;
                    if (labelProjectSelect) {
                        labelProjectSelect.value = '';
                    }
                    updateProjectInfoDisplay('global');
                    showToast(`已从项目 '${projectName}' 切换回全局标签`);
                }

                // 刷新项目列表
                await loadProjects();
            } else {
                throw new Error(data.error || '删除项目失败');
            }
        } catch (error) {
            console.error('Failed to delete project:', error);
            showToast(`删除项目失败: ${error.message}`, 'error');

            // 恢复按钮状态
            const deleteBtn = document.querySelector(`.project-action-btn.delete[data-project="${projectName}"]`);
            if (deleteBtn) {
                deleteBtn.innerHTML = '<span class="btn-icon">🗑️</span>删除';
                deleteBtn.disabled = false;
            }
        }
    }

    function switchToProjectLabelManagement(projectName) {
        // 更新当前项目
        currentProject = projectName;
        labelManagementContext.currentProject = projectName;

        // 切换到标签管理界面
        switchMode('label_management');

        // 不需要延迟执行，因为 switchMode 会调用 loadLabelManagementUI
        showToast(`已切换到项目 '${projectName}' 的标签管理`);
    }

    function loadProjectManagementUI() {
        if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
            showToast('需要管理员权限访问项目管理');
            switchMode('annotate');
            return;
        }

        loadProjects();
        setupProjectManagementEvents();

        // 初始化时添加一个空的标签输入框
        if (initialLabelsContainer.children.length === 0) {
            addInitialLabelField();
        }
    }

    function setupProjectManagementEvents() {
        addInitialLabelBtn.addEventListener('click', addInitialLabelField);
        createProjectBtn.addEventListener('click', createProject);
        clearProjectFormBtn.addEventListener('click', clearProjectForm);

        // 回车键创建项目
        newProjectNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                createProject();
            }
        });
    }

    // --- 标签管理函数 ---
    async function loadLabels() {
        // 现在需要项目参数，如果没有项目则返回空数组
        if (!currentProject) {
            labels = [];
            updateLabelSelection();
            return;
        }

        try {
            const response = await fetch(`/api/labels?user=${currentUser}&project=${encodeURIComponent(currentProject)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && Array.isArray(data.labels)) {
                labels = data.labels;
                updateLabelSelection();
            } else {
                labels = [];
                updateLabelSelection();
            }
        } catch (error) {
            console.error('Failed to load labels:', error);
            labels = [];
            updateLabelSelection();
            showToast(`加载标签失败: ${error.message}`, 'error');
        }
    }

    function showEditLabelForm(id, name) {
        document.getElementById('edit-label-id').value = id;
        document.getElementById('edit-label-name').value = name;
        document.getElementById('label-edit-area').classList.remove('hidden');

        // 滚动到编辑区域
        document.getElementById('label-edit-area').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    function hideEditLabelForm() {
        document.getElementById('label-edit-area').classList.add('hidden');
        document.getElementById('edit-label-id').value = '';
        document.getElementById('edit-label-name').value = '';
    }

    // 智能选择下一个可用颜色
    function selectNextAvailableColor() {
        // 预定义的颜色列表
        const availableColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B500', '#52B788'
        ];
        
        // 获取当前已使用的颜色
        const usedColors = labels.map(label => label.color).filter(c => c);
        
        // 查找第一个未使用的颜色
        for (const color of availableColors) {
            if (!usedColors.includes(color)) {
                return color;
            }
        }
        
        // 如果所有颜色都用过了，循环使用（根据标签数量取模）
        return availableColors[labels.length % availableColors.length];
    }

    async function addLabel() {
        const nameInput = document.getElementById('new-label-name');
        const name = nameInput.value.trim();

        if (!name) {
            showToast('标签名不能为空', 'warning');
            return;
        }

        if (!currentProject) {
            showToast('请先选择项目', 'warning');
            return;
        }

        // 智能选择颜色
        const color = selectNextAvailableColor();

        try {
            const endpoint = '/api/admin/project_labels';
            const payload = {
                user: currentUser,
                project: currentProject,
                action: 'add',
                label: { name: name, color: color }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message);
                nameInput.value = '';

                // 直接使用返回的标签数据，避免重新加载延迟
                if (data.labels) {
                    // 为每个标签添加project字段，保持"所属项目"列显示
                    labels = data.labels.map(label => ({
                        ...label,
                        project: currentProject
                    }));
                }
                renderLabelList();

                // 刷新项目列表（更新标签数量）
                if (!projectManagementUI.classList.contains('hidden')) {
                    await loadProjects();
                }

                if (!annotationUI.classList.contains('hidden')) {
                    renderSidebar();
                }
            } else {
                throw new Error(data.error || '添加标签失败');
            }
        } catch (error) {
            showToast(`添加标签失败: ${error.message}`, 'error');
        }
    }

    async function saveLabelEdit() {
        const id = parseInt(document.getElementById('edit-label-id').value);
        const name = document.getElementById('edit-label-name').value.trim();

        if (!name) {
            showToast('标签名不能为空', 'warning');
            return;
        }

        if (!currentProject) {
            showToast('请先选择项目', 'warning');
            return;
        }

        // 获取原标签的颜色，编辑时保留
        const originalLabel = labels.find(label => label.id === id);
        const color = originalLabel ? originalLabel.color : '#FF6B6B';

        try {
            const endpoint = '/api/admin/project_labels';
            const payload = {
                user: currentUser,
                project: currentProject,
                action: 'edit',
                label: { id: id, name: name, color: color }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message);
                hideEditLabelForm();

                // 直接使用返回的标签数据，避免重新加载延迟
                if (data.labels) {
                    // 为每个标签添加project字段，保持"所属项目"列显示
                    labels = data.labels.map(label => ({
                        ...label,
                        project: currentProject
                    }));
                }
                renderLabelList();

                // 刷新项目列表（更新标签数量）
                if (!projectManagementUI.classList.contains('hidden')) {
                    await loadProjects();
                }

                if (!annotationUI.classList.contains('hidden')) {
                    renderSidebar();
                }
            } else {
                throw new Error(data.error || '编辑标签失败');
            }
        } catch (error) {
            showToast(`编辑标签失败: ${error.message}`, 'error');
        }
    }

    async function deleteLabel(id) {
        if (!currentProject) {
            showToast('请先选择项目', 'warning');
            return;
        }

        const result = await showCustomConfirm(
            `确定要删除这个项目标签吗？`,
            [
                `标注该项目标签的图像需要清空重新标注`
            ],
            `删除项目标签`
        );

        if (!result) {
            return;
        }

        try {
            const endpoint = '/api/admin/project_labels';
            const payload = {
                user: currentUser,
                project: currentProject,
                action: 'delete',
                label: { id: id }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message);

                // 直接使用返回的标签数据，避免重新加载延迟
                if (data.labels) {
                    // 为每个标签添加project字段，保持"所属项目"列显示
                    labels = data.labels.map(label => ({
                        ...label,
                        project: currentProject
                    }));
                }
                renderLabelList();

                // 刷新项目列表（更新标签数量）
                if (!projectManagementUI.classList.contains('hidden')) {
                    await loadProjects();
                }

                if (!annotationUI.classList.contains('hidden')) {
                    renderSidebar();
                }
            } else {
                throw new Error(data.error || '删除标签失败');
            }
        } catch (error) {
            showToast(`删除标签失败: ${error.message}`, 'error');
        }
    }


    // --- 优化后的Toast通知函数，增强淡出效果 ---
    let toastTimer;
    function showToast(message, type = 'info') {
        // 清除之前的定时器
        if (toastTimer) clearTimeout(toastTimer);

        // 移除淡出类，确保Toast处于正常状态
        toastNotification.classList.remove('fade-out');

        // 设置消息内容和类型
        toastNotification.textContent = message;

        // 移除所有类型类，添加当前类型
        toastNotification.classList.remove('success', 'error', 'warning', 'info');
        toastNotification.classList.add(type);

        // 确保Toast完全可见
        toastNotification.style.display = 'block';

        // 强制重绘，确保过渡效果生效
        void toastNotification.offsetWidth;

        // 添加show类触发入场动画
        toastNotification.classList.add('show');

        // 根据类型设置不同的延迟时间
        let delayTime;
        switch(type) {
            case 'info':
            case 'success':
                delayTime = 1500; // 1.5秒
                break;
            case 'error':
            case 'warning':
                delayTime = 3000; // 3秒
                break;
            default:
                delayTime = 2000; // 默认2秒
        }

        // 设置定时器，在指定时间后开始淡出
        toastTimer = setTimeout(() => {
            // 添加淡出类触发淡出动画
            toastNotification.classList.add('fade-out');

            // 等待淡出动画完成后完全隐藏
            setTimeout(() => {
                toastNotification.style.display = 'none';
                toastNotification.classList.remove('show', 'fade-out', 'success', 'error', 'warning', 'info');
            }, 600); // 这个时间需要与CSS中的淡出过渡时间匹配
        }, delayTime);
    }

    // --- Core Annotation State Functions ---
    function initAnnotationState() {
        annotationState = { objects: [], activeObjectIndex: -1, nextId: 1, nextObjectId: 1 };
        addNewObject();
        renderSidebar();
    }
    
    // 清空标注状态（不添加默认对象）
    function clearAnnotationState() {
        annotationState = { objects: [], activeObjectIndex: -1, nextId: 1, nextObjectId: 1 };
    }
    function addNewObject() {
        // 获取默认标签的颜色（如果有标签的话）
        let defaultColor = COLORS[0]; // 后备颜色
        let defaultClassId = 0;
        
        if (Array.isArray(labels) && labels.length > 0) {
            // 使用第一个标签的颜色和ID
            defaultClassId = labels[0].id;
            defaultColor = labels[0].color || COLORS[0];
        }
        
        const newObject = {
            id: annotationState.nextId++,
            color: defaultColor,
            classId: defaultClassId,
            points: [],
            maskData: null,
            boxData: null,
            isVisible: true,
        };
        annotationState.objects.push(newObject);
        setActiveObject(annotationState.objects.length - 1);
        return newObject;
    }
    function setActiveObject(index) {
        annotationState.activeObjectIndex = index;
        renderSidebar(); redrawAll();
    }
    function deleteObject(index) {
        annotationState.objects.splice(index, 1);
        if (annotationState.activeObjectIndex === index) annotationState.activeObjectIndex = -1;
        else if (annotationState.activeObjectIndex > index) annotationState.activeObjectIndex--;
        if (annotationState.objects.length === 0) addNewObject();
        else if (annotationState.activeObjectIndex === -1) setActiveObject(annotationState.objects.length - 1);
        renderSidebar(); redrawAll();
    }
    function toggleObjectVisibility(index) {
        annotationState.objects[index].isVisible = !annotationState.objects[index].isVisible;
        renderSidebar(); redrawAll();
    }
    function updateObjectClassId(index, newClassId) {
        const obj = annotationState.objects[index];
        obj.classId = newClassId;
        
        // 更新颜色为该标签对应的颜色
        if (Array.isArray(labels) && labels.length > 0) {
            const selectedLabel = labels.find(label => label.id === newClassId);
            if (selectedLabel && selectedLabel.color) {
                obj.color = selectedLabel.color;
            }
        }
        
        renderSidebar();
        redrawAll(); // 重绘画布，显示新颜色
    }
    
    // --- Rendering Functions ---
    function redrawAll() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAllMasks(); drawAllPoints(); drawHoverInfo();
    }
    function renderSidebar() {
        objectList.innerHTML = '';

        // 如果没有当前项目，显示提示
        if (!currentProject) {
            objectList.innerHTML = `
                <div class="no-project-message">
                    <p>⚠️ 请先选择项目</p>
                    <p>在标签管理界面中选择项目后，才能开始标注</p>
                </div>
            `;
            return;
        }

        // 使用有效的标签数组
        const validLabels = Array.isArray(labels) ? labels : [];

        annotationState.objects.forEach((obj, index) => {
            const currentLabel = validLabels.find(label => label.id === obj.classId) || {
                name: `标签 ${obj.classId}`
            };

            const item = document.createElement('div');
            item.className = `object-item ${index === annotationState.activeObjectIndex ? 'active' : ''}`;
            item.innerHTML = `
                <span class="object-color-swatch" style="background-color: ${obj.color};"></span>
                <span class="object-name">实例 ${obj.id}</span>
                <select class="object-class-select">
                    ${validLabels.map(label => 
                        `<option value="${label.id}" ${obj.classId === label.id ? 'selected' : ''}>${label.name}</option>`
                    ).join('')}
                </select>
                <div class="object-actions">
                    <button class="visibility-btn" title="显示/隐藏">${obj.isVisible ? '👁️' : '🚫'}</button>
                    <button class="delete-btn" title="删除">🗑️</button>
                </div>`;

            item.querySelector('.visibility-btn').onclick = (e) => { e.stopPropagation(); toggleObjectVisibility(index); };
            item.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); deleteObject(index); };

            // 修改标签选择事件
            const classSelect = item.querySelector('.object-class-select');
            // classSelect.onchange = (e) => {
            //     // e.stopPropagation();
            //     updateObjectClassId(index, parseInt(e.target.value));
            // };

            // mousedown 事件：阻止冒泡但允许默认行为（下拉框展开）
            classSelect.onmousedown = (e) => {
                e.stopPropagation();
                // 不要调用 e.preventDefault() ！！！
            };

            // click 事件：阻止冒泡
            classSelect.onclick = (e) => {
                e.stopPropagation();
            };

            // change 事件：处理选择变化
            classSelect.onchange = (e) => {
                e.stopPropagation();
                updateObjectClassId(index, parseInt(e.target.value));
            };

            item.onclick = () => setActiveObject(index);
            objectList.appendChild(item);
        });
    }

    // 更新 updateLabelSelection 函数
    function updateLabelSelection() {
        // 添加安全检查
        if (!labels || !Array.isArray(labels)) {
            console.warn('Labels is not an array:', labels);
            labels = []; // 确保labels是数组
        }

        // 如果标签管理界面是打开的，更新标签列表
        if (!labelManagementUI.classList.contains('hidden')) {
            renderLabelList();
        }

        // 更新标注界面的标签选择
        if (annotationState.objects && annotationState.objects.length > 0) {
            renderSidebar();
        }
    }

    // 修改绘制函数，只在图像区域内绘制
    function drawAllMasks() {
        if (!annotationState.objects) return;

        const displayRect = getImageDisplayRect();

        annotationState.objects.forEach(obj => {
            if (obj.isVisible && obj.maskData) {
                ctx.fillStyle = hexToRgba(obj.color, 0.5);
                obj.maskData.forEach(polygon => {
                    if (polygon.length === 0) return;
                    ctx.beginPath();

                    const startPoint = scaleCoordsToCanvas(polygon[0]);
                    if (!startPoint) return; // 如果坐标无效则跳过

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
            }
        });
    }

    function drawAllPoints() {
        if (!annotationState.objects) return;
        const activeObject = annotationState.objects[annotationState.activeObjectIndex];
        if (activeObject) {
            activeObject.points.forEach((p, pointIndex) => {
                const canvasP = scaleCoordsToCanvas(p), isHovered = pointIndex === hoverState.pointIndex;
                ctx.beginPath();
                ctx.arc(canvasP.x, canvasP.y, isHovered ? 8 : 5, 0, 2 * Math.PI);
                ctx.fillStyle = p.label === 1 ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
                ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
            });
        }
    }
    function drawHoverInfo() {
        if (!annotationState.objects || hoverState.objectIndex === -1) return;
        const obj = annotationState.objects[hoverState.objectIndex];
        if (obj && obj.isVisible && obj.boxData) {
            const box = obj.boxData, p1 = scaleCoordsToCanvas({ x: box[0], y: box[1] }), p2 = scaleCoordsToCanvas({ x: box[2], y: box[3] });
            ctx.strokeStyle = obj.color; ctx.lineWidth = 2;
            ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
            ctx.fillStyle = obj.color; ctx.fillRect(p1.x, p1.y - 20, 60, 20);
            ctx.fillStyle = 'white'; ctx.font = '14px Arial';
            ctx.fillText(`物体 ${obj.id}`, p1.x + 5, p1.y - 5);
        }
    }
    function hexToRgba(hex, alpha) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgba(${r}, ${g}, ${b}, ${alpha})`; }

    // --- API & Data Handling ---
    async function runSegmentation() {
        if (!annotationState.objects) return;
        const activeObject = annotationState.objects[annotationState.activeObjectIndex];
        if (!activeObject || activeObject.points.length === 0) {
            if (activeObject) { activeObject.maskData = null; activeObject.boxData = null; }
            redrawAll(); return;
        }
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
            if (!response.ok) throw new Error(data.error || '分割请求失败');
            activeObject.maskData = (data.masks && data.masks.length > 0) ? data.masks : null;
            activeObject.boxData = (data.boxes && data.boxes.length > 0) ? data.boxes[0] : null;
            redrawAll();
        } catch (error) { console.error('Segmentation failed:', error); alert(`掩码生成失败: ${error.message}。`); }
    }
    
    // 自动标注函数
    async function handleAutoAnnotate() {
        if (!currentVideoPath || !displayImage.src) {
            showToast('请先选择图片', 'error');
            return;
        }
        
        // 询问用户是否批量标注
        const doBatch = await showConfirmDialog(
            '自动标注模式',
            '是否批量标注该任务的所有图片？\n\n点击"确定"批量标注所有图片\n点击"取消"仅标注当前图片'
        );
        
        if (doBatch) {
            await handleBatchAutoAnnotate();
        } else {
            await handleSingleAutoAnnotate();
        }
    }
    
    // 单张图片自动标注
    async function handleSingleAutoAnnotate() {
        try {
            if (autoAnnotateBtn) {
                autoAnnotateBtn.disabled = true;
            }
            showToast('正在进行自动标注，请稍候...', 'info');
            
            // 获取当前图片的路径
            const currentImagePath = new URL(displayImage.src).pathname;
            
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
    
    // 批量自动标注
    async function handleBatchAutoAnnotate() {
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
            
            // 遍历所有帧
            for (let i = 0; i < totalFrames; i++) {
                try {
                    // 加载帧
                    await loadFrame(i, true);
                    
                    // 等待图片加载完成并更新imageDimensions
                    await new Promise(resolve => {
                        if (displayImage.complete && displayImage.naturalWidth > 0) {
                            // 图片已经加载完成，立即更新imageDimensions
                            setupCanvasAndRedraw();
                            resolve();
                        } else {
                            // 图片还在加载中，等待onload事件
                            const originalOnload = displayImage.onload;
                            displayImage.onload = () => {
                                if (originalOnload) originalOnload();
                                setupCanvasAndRedraw(); // 确保更新imageDimensions
                                resolve();
                            };
                        }
                    });
                    
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
            await new Promise(resolve => {
                if (displayImage.complete && displayImage.naturalWidth > 0) {
                    setupCanvasAndRedraw();
                    resolve();
                } else {
                    const originalOnload = displayImage.onload;
                    displayImage.onload = () => {
                        if (originalOnload) originalOnload();
                        setupCanvasAndRedraw();
                        resolve();
                    };
                }
            });
            
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
    
    // 确认对话框
    function showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const result = confirm(message);
            resolve(result);
        });
    }
    
    // 静默保存标注（用于批量标注）
    async function saveAnnotationsSilent() {
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
        const payload = {
            status: 'success',
            objects: validObjects,
            frameUrl: new URL(displayImage.src).pathname,
            videoPath: currentVideoPath,
            imageWidth: imageDimensions.naturalWidth,
            imageHeight: imageDimensions.naturalHeight,
            frameIndex: currentFrameIndex,
            totalFrames: totalFrames,
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
    
    // MODIFIED: saveAnnotations
    async function saveAnnotations() {
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

        const payload = {
            status: 'success',
            objects: validObjects, // 可以是空数组
            frameUrl: new URL(displayImage.src).pathname,
            videoPath: currentVideoPath,
            imageWidth: imageDimensions.naturalWidth,
            imageHeight: imageDimensions.naturalHeight,
            frameIndex: currentFrameIndex,  // 传递当前帧索引
            totalFrames: totalFrames,       // 传递总帧数
            isExtractedFrame: isExtractedFrame  // 明确标记是否是抽帧图片
        };

        // 如果是覆盖保存，添加路径
        if (appMode === 'review' && editingFilePath) {
            payload.overwrite_path = editingFilePath;
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

                // 保存成功后，根据是否清空标注采取不同操作
                if (validObjects.length === 0) {
                    // 如果是清空标注，图片已被删除，需要特殊处理
                    if (appMode === 'review') {
                        // 审核模式下，从文件列表中移除当前文件
                        reviewContext.fileList.splice(reviewContext.currentIndex, 1);
                        if (reviewContext.fileList.length === 0) {
                            // 如果没有更多文件，返回列表
                            showListUI();
                            showToast("所有标注已处理完成");
                        } else {
                            // 加载下一张图片
                            if (reviewContext.currentIndex >= reviewContext.fileList.length) {
                                reviewContext.currentIndex = reviewContext.fileList.length - 1;
                            }
                            loadReviewedImage();
                        }
                    } else {
                        // 标注模式下，跳转到下一帧
                        // 对于抽帧图片，确保图片仍然存在
                        if (isExtractedFrame) {
                            // 抽帧图片不会被删除，直接跳转
                            nextFrameBtn.click();
                        } else {
                            nextFrameBtn.click();
                        }
                    }
                } else {
                    // 正常保存，跳转到下一帧
                    if (appMode === 'annotate') {
                        nextFrameBtn.click();
                    } else {
                        // 审核模式下重新加载当前标注以确保状态同步
                        setTimeout(() => {
                            redrawAll();
                        }, 100);
                    }
                }
            } else {
                throw new Error(data.error || '未知错误');
            }
        } catch (error) {
            console.error('保存失败:', error);
            alert(`保存失败: ${error.message}`);
        }
    }

    // 修改 showLabelDetailsModal 函数中的标签列表生成部分
    async function showLabelDetailsModal(labelCounts, taskPath, projectName = 'default') {
        // 加载项目特定的标签名称映射
        let labelNames = {};
        try {
            const response = await fetch(`/api/labels?user=${currentUser}&project=${encodeURIComponent(projectName)}`);
            const data = await response.json();
            if (response.ok) {
                data.labels.forEach(label => {
                    labelNames[label.id] = label.name;
                });
            } else {
                throw new Error(data.error || 'Failed to load labels');
            }
        } catch (error) {
            console.error('Failed to load labels:', error);
            // 如果加载失败，尝试加载全局标签作为后备
            try {
                const response = await fetch(`/api/labels?user=${currentUser}`);
                const data = await response.json();
                if (response.ok) {
                    data.labels.forEach(label => {
                        labelNames[label.id] = label.name;
                    });
                }
            } catch (fallbackError) {
                console.error('Failed to load global labels as fallback:', fallbackError);
            }
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        // 生成标签列表HTML
        let labelsHTML = '';
        let hasLabels = false;

        if (Object.keys(labelCounts).length > 0) {
            hasLabels = true;
            // 按标签数量降序排列
            const sortedLabels = Object.entries(labelCounts)
                .sort((a, b) => b[1] - a[1]);

            labelsHTML = sortedLabels.map(([classId, count]) => {
                const labelName = labelNames[classId] || `标签 ${classId}`;
                // 在标签名称后添加标签ID和项目信息
                const displayName = `${labelName} (ID: ${classId})`;
                return `
                    <div class="label-detail-row">
                        <span class="label-name" title="${displayName}">${displayName}</span>
                        <span class="label-count">${count}</span>
                        <div class="label-bar-container">
                            <div class="label-bar" style="width: ${(count / Math.max(...Object.values(labelCounts))) * 100}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            labelsHTML = '<div class="no-labels-message">暂无标注数据</div>';
        }

        modal.innerHTML = `
            <div class="modal-dialog label-details-modal">
                <div class="modal-header">
                    <h3>📊 标签统计详情</h3>
                    <button class="close-modal-btn" title="关闭">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="task-info">
                        <strong>任务:</strong> ${taskPath}
                    </div>
                    <div class="label-details-container">
                        <div class="label-details-header">
                            <span>标签名称 (ID)</span>
                            <span>数量</span>
                        </div>
                        <div class="label-details-list">
                            ${labelsHTML}
                        </div>
                    </div>
                    ${hasLabels ? `
                    <div class="label-summary">
                        <div class="summary-item">
                            <span class="summary-label">总标签数:</span>
                            <span class="summary-value">${Object.values(labelCounts).reduce((a, b) => a + b, 0)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">标签种类:</span>
                            <span class="summary-value">${Object.keys(labelCounts).length}</span>
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button id="close-label-modal" class="btn-primary">关闭</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 添加事件监听器
        const closeModal = () => document.body.removeChild(modal);

        modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
        modal.querySelector('#close-label-modal').addEventListener('click', closeModal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // ESC键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
    }

    async function browse(path = '') {
        if (!currentUser) {
            showToast("请先登录");
            return;
        }

        let endpoint;
        if (appMode === 'annotate') {
            if (!Array.isArray(userRoles) || (!userRoles.includes('annotator') && !userRoles.includes('admin'))) {
                videoList.innerHTML = '<p>您没有标注权限。</p>';
                return;
            }
            endpoint = `/api/browse?user=${currentUser}`;
        } else { // review mode
            if (!Array.isArray(userRoles) || (!userRoles.includes('reviewer') && !userRoles.includes('admin'))) {
                videoList.innerHTML = '<p>您没有审核权限。</p>';
                return;
            }
            endpoint = `/api/browse_annotated?user=${currentUser}`;
        }

        // 添加筛选参数
        endpoint += `&status=${filterState.status}`;
        if (filterState.user) {
            endpoint += `&user_filter=${encodeURIComponent(filterState.user)}`;
        }
        if (filterState.project) {
            endpoint += `&project_filter=${encodeURIComponent(filterState.project)}`;
        }

        // 添加分页参数
        if (appMode === 'review' && path) {
            // 审核任务内部的图片列表分页 - 使用60张每页
            endpoint += `&page=${reviewImagePaginationState.currentPage}&page_size=${reviewImagePaginationState.pageSize}`;
        } else {
            // 任务列表分页 - 使用12张每页
            endpoint += `&page=${taskPaginationState.currentPage}&page_size=${taskPaginationState.pageSize}`;
        }

        try {
            const response = await fetch(`${endpoint}&path=${encodeURIComponent(path)}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to browse directory');
            }
            const data = await response.json();

            // 更新分页状态
            if (appMode === 'review' && path) {
                // 审核任务内部的图片列表
                reviewImagePaginationState.totalItems = data.total_count || 0;
                reviewImagePaginationState.totalPages = Math.ceil(reviewImagePaginationState.totalItems / reviewImagePaginationState.pageSize);

                // 确保分页状态正确
                if (reviewImagePaginationState.currentPage > reviewImagePaginationState.totalPages) {
                    reviewImagePaginationState.currentPage = Math.max(1, reviewImagePaginationState.totalPages);
                }

                // 关键修改：保存整个任务的总图片数到reviewContext
                reviewContext.totalImages = data.total_count || 0;

                updateReviewImagePaginationControls();

                // 隐藏任务级别的分页控件和筛选框，显示图片级别的分页控件
                hideTaskLevelControls();
                showReviewImageLevelControls();
            } else {
                // 任务列表
                taskPaginationState.totalItems = data.total_count || 0;
                taskPaginationState.totalPages = Math.ceil(taskPaginationState.totalItems / taskPaginationState.pageSize);

                // 确保分页状态正确
                if (taskPaginationState.currentPage > taskPaginationState.totalPages) {
                    taskPaginationState.currentPage = Math.max(1, taskPaginationState.totalPages);
                }

                updateTaskPaginationControls();

                // 显示任务级别的分页控件和筛选框，隐藏图片级别的分页控件
                showTaskLevelControls();
                hideReviewImageLevelControls();
            }

            // 修改面包屑导航逻辑
            if (appMode === 'review') {
                if (path) {
                    breadcrumb.style.display = '';
                    breadcrumb.innerHTML = `
                        <button class="back-breadcrumb-btn" id="back-to-root">
                            <span class="btn-icon">←</span>
                            返回任务列表
                        </button>
                        <span class="breadcrumb-separator">/</span>
                        <span class="current-folder">${path.split('/').pop()}</span>
                    `;
                    document.getElementById('back-to-root').addEventListener('click', () => {
                        // 返回时重置图片分页并显示任务级别控件
                        reviewImagePaginationState.currentPage = 1;
                        showTaskLevelControls();
                        hideReviewImageLevelControls();
                        browse('');
                    });
                } else {
                    breadcrumb.style.display = 'none';
                }
            } else {
                breadcrumb.style.display = 'none';
            }

            // 只在任务级别显示筛选控件
            if (appMode === 'review' && path) {
                // 审核任务内部隐藏筛选控件
                hideFilterControls();
            } else {
                // 任务级别显示筛选控件
                renderFilterControls(data.total_count || 0);
            }

            videoList.innerHTML = '';

            let hasTasks = false;

            if (appMode === 'review') {
                if (data.files) {
                    // 在具体任务文件夹中 - 显示图片列表（60张每页）
                    reviewContext.basePath = path;
                    reviewContext.fileList = data.files; // 注意：这里已经是当前页的数据了

                    if (data.files.length === 0) {
                        videoList.innerHTML = `
                            <div class="no-tasks-message">
                                <p>📭 当前任务中没有图片</p>
                                <p class="no-tasks-hint">该任务可能尚未完成标注或图片已被处理</p>
                            </div>
                        `;
                    } else {
                        hasTasks = true;

                        // 显示当前页的图片
                        data.files.forEach((file, index) => {
                            const globalIndex = (reviewImagePaginationState.currentPage - 1) * reviewImagePaginationState.pageSize + index;
                            const item = document.createElement('div');
                            item.className = 'video-item review-image-item';
                            item.innerHTML = `
                                <div class="folder-icon">🖼️</div>
                                <div class="item-name">${file.name}</div>
                                <div class="image-index">图片 ${globalIndex + 1} / ${reviewContext.totalImages}</div>
                            `;
                            item.addEventListener('click', () => {
                                // 启动审核会话，从当前页的第一张图片开始
                                startReviewSession(index);
                            });
                            videoList.appendChild(item);
                        });
                    }
                } else if (data.directories) {
                    // 在顶级文件夹中 - 显示任务列表（12个每页）
                    if (data.directories.length === 0) {
                        videoList.innerHTML = '<div class="no-tasks-message"><p>📭 当前无任务分配</p><p class="no-tasks-hint">请联系管理员获取新的审核任务</p></div>';
                    } else {
                        hasTasks = true;
                        data.directories.forEach(dir => {
                            const dirItem = document.createElement('div');
                            dirItem.className = `folder-item status-${dir.status}`;

                            let actionButtonHTML = '';
                            if (dir.status === 'completed') {
                                actionButtonHTML = `<button class="reopen-btn completed-status" data-task-path="${dir.path}" title="点击重新打开任务">审核完成</button>`;
                            } else {
                                actionButtonHTML = `<button class="complete-btn in-progress-status" data-task-path="${dir.path}" title="点击标记为完成">审核中</button>`;
                            }

                            dirItem.innerHTML = `
                                <div class="folder-icon">📁</div>
                                <div class="item-name">${dir.name}</div>
                                <!-- <div class="item-status">${dir.status}</div> -->
                                <div class="item-assignee">审核员: ${dir.assignee}</div>
                                ${actionButtonHTML}
                                ${(Array.isArray(userRoles) && userRoles.includes('admin')) ? createTaskMenuButton(dir.path, 'review', dir.name) : ''}
                            `;
                            dirItem.querySelector('.item-name').addEventListener('click', () => {
                                // 点击任务文件夹时，重置图片分页到第一页
                                reviewImagePaginationState.currentPage = 1;
                                browse(dir.path);
                            });
                            dirItem.querySelector('.folder-icon').addEventListener('click', () => {
                                reviewImagePaginationState.currentPage = 1;
                                browse(dir.path);
                            });

                            const completeBtn = dirItem.querySelector('.complete-btn');
                            if (completeBtn) {
                                completeBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    markTaskAsComplete('review', dir.path, 'completed');
                                });
                            }

                            const reopenBtn = dirItem.querySelector('.reopen-btn');
                            if (reopenBtn) {
                                reopenBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    markTaskAsComplete('review', dir.path, 'in_progress');
                                });
                            }

                            videoList.appendChild(dirItem);
                        });
                    }
                } else {
                    // review mode 根目录没有数据
                    videoList.innerHTML = '<div class="no-tasks-message"><p>📭 当前无任务分配</p><p class="no-tasks-hint">请联系管理员获取新的审核任务</p></div>';
                }
            } else {
                // annotate mode - 原有逻辑保持不变
                if (data.files && data.files.length > 0) {
                    hasTasks = true;
                    data.files.forEach(video => {
                        const videoItem = document.createElement('div');
                        videoItem.className = `video-item status-${video.status}`;

                        let actionButtonHTML = '';
                        if (video.status === 'completed') {
                            actionButtonHTML = `<button class="reopen-btn completed-status" data-task-path="${video.path}" title="点击重新打开任务">标注完成</button>`;
                        } else {
                            actionButtonHTML = `<button class="complete-btn in-progress-status" data-task-path="${video.path}" title="点击标记为完成">标注中</button>`;
                        }

                        const itemIcon = video.type === 'image' ? '🖼️' : '🎬';

                        // 获取统计信息（直接从video对象读取驼峰命名字段）
                        const totalImages = video.totalImages || 0;
                        const annotatedImages = video.annotatedImages || 0;
                        const totalLabels = video.totalLabels || 0;
                        const labelCounts = video.labelCounts || {};

                        // 计算标注进度
                        const progressPercent = video.progress || (totalImages > 0 ? Math.round((annotatedImages / totalImages) * 100) : 0);

                        // 修复：正确显示分配者信息
                        const assigneeInfo = video.assignee ?
                            `<div class="item-assignee">标注员: ${video.assignee}</div>` :
                            `<div class="item-assignee unassigned">未分配</div>`;

                        const projectInfo = video.project ?
                            `<div class="item-project">项目: ${video.project}</div>` :
                            `<div class="item-project unassigned">未指定项目</div>`;

                        videoItem.innerHTML = `
                            <div class="item-icon">${itemIcon}</div>
                            <img src="${video.coverUrl || ''}" alt="${video.name} cover" class="video-item-cover" onerror="this.style.display='none'">
                            <div class="item-name">${video.name}</div>
                            
                            ${video.type === 'video' ? `
                                <button class="extract-frames-btn" data-video-path="${video.path}">🎞️ 抽帧</button>
                            ` : '<div class="extract-frames-btn-placeholder"></div>'}                                                
                            
                            <!-- 统计信息 -->
                            <div class="item-stats">
                                <div class="stat-row">
                                    <span class="stat-label">图片总数:</span>
                                    <span class="stat-value">${totalImages}</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">已标注:</span>
                                    <span class="stat-value">${annotatedImages}</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">标签总数:</span>
                                    <span class="stat-value clickable-label-count" 
                                          data-task-path="${video.path}"
                                          data-label-counts='${JSON.stringify(labelCounts)}'>
                                        ${totalLabels}
                                    </span>
                                </div>
                            </div>
                            
                            <!-- 进度条 -->
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                                </div>
                                <div class="progress-text">${progressPercent}%</div>
                            </div>
                            
                            ${assigneeInfo}
                            ${projectInfo}  <!-- 添加项目信息显示 -->
                            ${actionButtonHTML}                                                                                   
                            ${(Array.isArray(userRoles) && userRoles.includes('admin')) ? createTaskMenuButton(video.path, 'annotation', video.name) : ''}
                        `;

                        // 添加标签总数点击事件
                        const labelCountElement = videoItem.querySelector('.clickable-label-count');
                        if (labelCountElement) {
                            labelCountElement.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const labelCounts = JSON.parse(e.target.dataset.labelCounts || '{}');
                                const taskPath = e.target.dataset.taskPath;
                                const taskProject = video.project || 'default';
                                showLabelDetailsModal(labelCounts, taskPath, taskProject);
                            });
                        }

                        // 修复：确保点击事件正确绑定
                        const coverElement = videoItem.querySelector('.video-item-cover');
                        if (coverElement) {
                            coverElement.addEventListener('click', async () => {
                                // 对于视频任务，先检查是否已抽帧
                                if (video.type === 'video') {
                                    const canOpen = await checkVideoExtractedBeforeOpen(video.path);
                                    if (!canOpen) return;
                                }
                                selectVideo(video.path, video.totalFrames, video.type);
                            });
                        }

                        // 修复：确保任务名称也可点击
                        const nameElement = videoItem.querySelector('.item-name');
                        if (nameElement) {
                            nameElement.addEventListener('click', async () => {
                                // 对于视频任务，先检查是否已抽帧
                                if (video.type === 'video') {
                                    const canOpen = await checkVideoExtractedBeforeOpen(video.path);
                                    if (!canOpen) return;
                                }
                                selectVideo(video.path, video.totalFrames, video.type);
                            });
                        }

                        const completeBtn = videoItem.querySelector('.complete-btn');
                        if(completeBtn) {
                            completeBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                markTaskAsComplete('annotation', video.path, 'completed');
                            });
                        }

                        const reopenBtn = videoItem.querySelector('.reopen-btn');
                        if(reopenBtn) {
                            reopenBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                markTaskAsComplete('annotation', video.path, 'in_progress');
                            });
                        }

                        videoList.appendChild(videoItem);
                    });
                } else {
                    // 标注模式没有任务
                    videoList.innerHTML = '<div class="no-tasks-message"><p>📭 当前无任务分配</p><p class="no-tasks-hint">请联系管理员获取新的标注任务</p></div>';
                }
            }

            // 如果有任务，设置任务菜单监听器
            if (hasTasks) {
                setupTaskMenuListeners();
            }

        } catch (error) {
            console.error('Failed to load list:', error);
            alert(`无法加载列表: ${error.message}`);
        }
    }

    // 新增函数：显示任务级别控件
    function showTaskLevelControls() {
        if (taskPaginationBottom) taskPaginationBottom.style.display = 'flex';

        // 显示筛选控件（如果存在）
        const filterControls = document.getElementById('filter-controls');
        if (filterControls) {
            filterControls.style.display = 'block';
        }
    }

    // 新增函数：隐藏任务级别控件
    function hideTaskLevelControls() {
        if (taskPaginationBottom) taskPaginationBottom.style.display = 'none';

        // 隐藏筛选控件（如果存在）
        const filterControls = document.getElementById('filter-controls');
        if (filterControls) {
            filterControls.style.display = 'none';
        }
    }

    // 新增函数：显示审核图片级别控件
    function showReviewImageLevelControls() {
        if (reviewImagePaginationTop) reviewImagePaginationTop.style.display = 'flex';
        if (reviewImagePaginationBottom) reviewImagePaginationBottom.style.display = 'flex';
    }


    // 新增函数：隐藏审核图片级别控件
    function hideReviewImageLevelControls() {
        if (reviewImagePaginationTop) reviewImagePaginationTop.style.display = 'none';
        if (reviewImagePaginationBottom) reviewImagePaginationBottom.style.display = 'none';
    }

    // 新增函数：隐藏筛选控件
    function hideFilterControls() {
        const filterControls = document.getElementById('filter-controls');
        if (filterControls) {
            filterControls.style.display = 'none';
        }
    }

    // 新增函数：更新任务列表分页控件
    function updateTaskPaginationControls() {
        if (!taskPaginationBottom) return;

        const updateControls = (container) => {
            container.innerHTML = '';

            if (taskPaginationState.totalPages <= 1) return;

            const paginationHTML = `
                <div class="pagination-controls task-pagination">
                    <button class="pagination-btn first-page" ${taskPaginationState.currentPage === 1 ? 'disabled' : ''}>
                        <span class="btn-icon">«</span>
                    </button>
                    <button class="pagination-btn prev-page" ${taskPaginationState.currentPage === 1 ? 'disabled' : ''}>
                        <span class="btn-icon">‹</span>
                    </button>
                    <span class="pagination-info">
                        第 <span class="current-page">${taskPaginationState.currentPage}</span> 页，共 <span class="total-pages">${taskPaginationState.totalPages}</span> 页
                    </span>
                    <button class="pagination-btn next-page" ${taskPaginationState.currentPage === taskPaginationState.totalPages ? 'disabled' : ''}>
                        <span class="btn-icon">›</span>
                    </button>
                    <button class="pagination-btn last-page" ${taskPaginationState.currentPage === taskPaginationState.totalPages ? 'disabled' : ''}>
                        <span class="btn-icon">»</span>
                    </button>
                </div>
            `;

            container.innerHTML = paginationHTML;

            // 添加事件监听
            container.querySelector('.first-page').addEventListener('click', () => {
                taskPaginationState.currentPage = 1;
                browse('');
            });

            container.querySelector('.prev-page').addEventListener('click', () => {
                if (taskPaginationState.currentPage > 1) {
                    taskPaginationState.currentPage--;
                    browse('');
                }
            });

            container.querySelector('.next-page').addEventListener('click', () => {
                if (taskPaginationState.currentPage < taskPaginationState.totalPages) {
                    taskPaginationState.currentPage++;
                    browse('');
                }
            });

            container.querySelector('.last-page').addEventListener('click', () => {
                taskPaginationState.currentPage = taskPaginationState.totalPages;
                browse('');
            });
        };

        updateControls(taskPaginationBottom);
    }

    // 新增函数：更新审核图片分页控件
    function updateReviewImagePaginationControls() {
        if (!reviewImagePaginationTop || !reviewImagePaginationBottom) return;

        const updateControls = (container) => {
            container.innerHTML = '';

            if (reviewImagePaginationState.totalPages <= 1) return;

            const paginationHTML = `
                <div class="pagination-controls review-image-pagination">
                    <button class="pagination-btn first-page" ${reviewImagePaginationState.currentPage === 1 ? 'disabled' : ''}>
                        <span class="btn-icon">«</span>
                    </button>
                    <button class="pagination-btn prev-page" ${reviewImagePaginationState.currentPage === 1 ? 'disabled' : ''}>
                        <span class="btn-icon">‹</span>
                    </button>
                    <span class="pagination-info">
                        第 <span class="current-page">${reviewImagePaginationState.currentPage}</span> 页，共 <span class="total-pages">${reviewImagePaginationState.totalPages}</span> 页
                        <span class="image-count">（${reviewImagePaginationState.totalItems} 张图片）</span>
                    </span>
                    <button class="pagination-btn next-page" ${reviewImagePaginationState.currentPage === reviewImagePaginationState.totalPages ? 'disabled' : ''}>
                        <span class="btn-icon">›</span>
                    </button>
                    <button class="pagination-btn last-page" ${reviewImagePaginationState.currentPage === reviewImagePaginationState.totalPages ? 'disabled' : ''}>
                        <span class="btn-icon">»</span>
                    </button>
                </div>
            `;

            container.innerHTML = paginationHTML;

            // 添加事件监听
            container.querySelector('.first-page').addEventListener('click', () => {
                reviewImagePaginationState.currentPage = 1;
                browse(reviewContext.basePath);
            });

            container.querySelector('.prev-page').addEventListener('click', () => {
                if (reviewImagePaginationState.currentPage > 1) {
                    reviewImagePaginationState.currentPage--;
                    browse(reviewContext.basePath);
                }
            });

            container.querySelector('.next-page').addEventListener('click', () => {
                if (reviewImagePaginationState.currentPage < reviewImagePaginationState.totalPages) {
                    reviewImagePaginationState.currentPage++;
                    browse(reviewContext.basePath);
                }
            });

            container.querySelector('.last-page').addEventListener('click', () => {
                reviewImagePaginationState.currentPage = reviewImagePaginationState.totalPages;
                browse(reviewContext.basePath);
            });
        };

        updateControls(reviewImagePaginationTop);
        updateControls(reviewImagePaginationBottom);
    }

    // 新增函数：渲染筛选控件
    function renderFilterControls(totalCount) {
        // 移除已存在的筛选控件
        const existingFilter = document.getElementById('filter-controls');
        if (existingFilter) {
            existingFilter.remove();
        }

        // 创建筛选控件容器
        const filterControls = document.createElement('div');
        filterControls.id = 'filter-controls';
        filterControls.className = 'filter-controls';

        // 根据当前模式确定状态选项
        const statusOptions = appMode === 'annotate' ? [
            { value: 'all', label: '全选' },
            { value: 'in_progress', label: '标注中' },
            { value: 'completed', label: '标注完成' }
        ] : [
            { value: 'all', label: '全选' },
            { value: 'in_progress', label: '审核中' },
            { value: 'completed', label: '审核完成' }
        ];

        // 构建状态筛选HTML
        let statusFilterHTML = `
            <div class="filter-group">
                <label for="status-filter">状态:</label>
                <select id="status-filter" class="filter-select">
                    ${statusOptions.map(option => 
                        `<option value="${option.value}" ${filterState.status === option.value ? 'selected' : ''}>${option.label}</option>`
                    ).join('')}
                </select>
            </div>
        `;

        // 如果是管理员，添加用户筛选
        let userFilterHTML = '';
        if (Array.isArray(userRoles) && userRoles.includes('admin')) {
            userFilterHTML = `
                <div class="filter-group">
                    <label for="user-filter">用户:</label>
                    <select id="user-filter" class="filter-select">
                        <option value="">全部用户</option>
                        <!-- 用户选项将通过JavaScript动态加载 -->
                    </select>
                </div>
            `;
        }

        // 添加项目筛选（所有用户可见）
        let projectFilterHTML = `
            <div class="filter-group">
                <label for="project-filter">项目:</label>
                <select id="project-filter" class="filter-select">
                    <option value="">全部项目</option>
                    <!-- 项目选项将通过JavaScript动态加载 -->
                </select>
            </div>
        `;

        // 任务计数
        const countHTML = `
            <div class="filter-count">
                <span class="count-text">共 ${totalCount} 个任务</span>
            </div>
        `;

        filterControls.innerHTML = `
            <div class="filter-row">
                ${statusFilterHTML}
                ${userFilterHTML}
                ${projectFilterHTML}
                ${countHTML}
            </div>
        `;

        // 插入到视频列表之前
        const videoSelection = document.getElementById('video-selection');
        const videoList = document.getElementById('video-list');
        videoSelection.insertBefore(filterControls, videoList);

        // 添加事件监听器 - 筛选时重置分页状态
        document.getElementById('status-filter').addEventListener('change', (e) => {
            filterState.status = e.target.value;
            // 重置分页到第一页
            taskPaginationState.currentPage = 1;
            browse('');
        });

        // 如果是管理员，加载用户选项并添加事件监听
        if (Array.isArray(userRoles) && userRoles.includes('admin')) {
            loadUserFilterOptions().then(() => {
                document.getElementById('user-filter').addEventListener('change', (e) => {
                    filterState.user = e.target.value;
                    // 重置分页到第一页
                    taskPaginationState.currentPage = 1;
                    browse('');
                });
            });
            
            // 加载项目选项并添加事件监听
            loadProjectFilterOptions().then(() => {
                document.getElementById('project-filter').addEventListener('change', (e) => {
                    filterState.project = e.target.value;
                    // 重置分页到第一页
                    taskPaginationState.currentPage = 1;
                    browse('');
                });
            });
        } else {
            // 普通用户也加载项目筛选
            loadProjectFilterOptions().then(() => {
                document.getElementById('project-filter').addEventListener('change', (e) => {
                    filterState.project = e.target.value;
                    // 重置分页到第一页
                    taskPaginationState.currentPage = 1;
                    browse('');
                });
            });
        }
    }

    // 新增函数：加载用户筛选选项
    async function loadUserFilterOptions() {
        if (!Array.isArray(userRoles) || !userRoles.includes('admin')) return;

        try {
            const response = await fetch(`/api/admin/users?user=${currentUser}`);
            const users = await response.json();
            if (!response.ok) throw new Error(users.error || 'Failed to load users');

            const userFilter = document.getElementById('user-filter');
            if (!userFilter) return;

            // 清空现有选项（保留"全部用户"和"未分配"选项）
            const isUnassignedSelected = filterState.user === 'unassigned';
            userFilter.innerHTML = `
                <option value="">全部用户</option>
                <option value="unassigned" ${isUnassignedSelected ? 'selected' : ''}>未分配</option>
            `;

            // 根据当前模式筛选用户
            const roleToCheck = appMode === 'annotate' ? 'annotator' : 'reviewer';

            Object.entries(users).forEach(([username, userData]) => {
                // 排除admin用户
                if (username === 'admin') {
                    return;
                }

                if (userData.roles.includes(roleToCheck) || userData.roles.includes('admin')) {
                    const option = document.createElement('option');
                    option.value = username;
                    option.textContent = username;
                    if (username === filterState.user) {
                        option.selected = true;
                    }
                    userFilter.appendChild(option);
                }
            });

        } catch (error) {
            console.error('Failed to load users for filter:', error);
        }
    }

    // 新增函数：加载项目筛选选项
    async function loadProjectFilterOptions() {
        try {
            // 根据用户角色选择不同的API
            const isAdmin = Array.isArray(userRoles) && userRoles.includes('admin');
            const apiEndpoint = isAdmin 
                ? `/api/admin/projects?user=${currentUser}`
                : `/api/user/projects?user=${currentUser}`;
            
            const response = await fetch(apiEndpoint);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to load projects');

            const projectFilter = document.getElementById('project-filter');
            if (!projectFilter) return;

            // 清空现有选项（保留"全部项目"选项）
            projectFilter.innerHTML = '<option value="">全部项目</option>';

            // 添加项目选项
            // 管理员API返回格式: { "projects": { "project_name": {...}, ... } }
            // 用户API返回格式: { "projects": ["project_name1", "project_name2", ...] }
            let projectNames = [];
            
            if (data.projects) {
                if (Array.isArray(data.projects)) {
                    // 用户API返回的数组格式
                    projectNames = data.projects.sort();
                } else if (typeof data.projects === 'object') {
                    // 管理员API返回的对象格式
                    projectNames = Object.keys(data.projects).sort();
                }
            }
            
            projectNames.forEach(projectName => {
                const option = document.createElement('option');
                option.value = projectName;
                option.textContent = projectName;
                if (projectName === filterState.project) {
                    option.selected = true;
                }
                projectFilter.appendChild(option);
            });

        } catch (error) {
            console.error('Failed to load projects for filter:', error);
        }
    }

    // --- Event Handlers & UI Logic ---
    // 修改点击事件处理，添加边界检查
    async function handleCanvasClick(e, label) {
        if (!annotationState.objects || annotationState.activeObjectIndex === -1) return;

        const activeObject = annotationState.objects[annotationState.activeObjectIndex];
        const canvasCoords = getCanvasMousePos(e);
        const imageCoords = scaleCoordsToImage(canvasCoords);

        // 检查点击是否在图像区域内
        if (!imageCoords) {
            showToast("❌ 点击位置不在图像区域内，请在图像上点击", 'error');
            return;
        }

        // 检查是否点击了现有的点（删除）
        const pointToRemoveIdx = activeObject.points.findIndex(p => {
            const canvasPoint = scaleCoordsToCanvas(p);
            return canvasPoint && Math.hypot(canvasCoords.x - canvasPoint.x, canvasCoords.y - canvasPoint.y) < 8;
        });

        if (pointToRemoveIdx > -1) {
            activeObject.points.splice(pointToRemoveIdx, 1);
        } else {
            activeObject.points.push({ ...imageCoords, label });
        }

        await runSegmentation();
        redrawAll();
    }
    function handleCanvasMouseMove(e) {
        if (!annotationState.objects) return;
        const canvasCoords = getCanvasMousePos(e);
        let needsRedraw = false;
        const oldPointHover = hoverState.pointIndex;
        hoverState.pointIndex = -1;
        const activeObject = annotationState.objects[annotationState.activeObjectIndex];
        if (activeObject) {
            const foundPoint = activeObject.points.findIndex(p => Math.hypot(canvasCoords.x - scaleCoordsToCanvas(p).x, canvasCoords.y - scaleCoordsToCanvas(p).y) < 8);
            if (foundPoint > -1) hoverState.pointIndex = foundPoint;
        }
        if(oldPointHover !== hoverState.pointIndex) needsRedraw = true;
        const oldObjectHover = hoverState.objectIndex;
        hoverState.objectIndex = -1;
        for (let i = annotationState.objects.length - 1; i >= 0; i--) {
            const obj = annotationState.objects[i];
            let box = obj.boxData;
            if (!box && obj.maskData && obj.maskData.length > 0) {
                 let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                 obj.maskData[0].forEach(p => {
                     minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
                     maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
                 });
                 box = [minX, minY, maxX, maxY];
            }

            if (obj.isVisible && box) {
                const p1 = scaleCoordsToCanvas({x: box[0], y: box[1]}), p2 = scaleCoordsToCanvas({x: box[2], y: box[3]});
                if (canvasCoords.x >= p1.x && canvasCoords.x <= p2.x && canvasCoords.y >= p1.y && canvasCoords.y <= p2.y) {
                    hoverState.objectIndex = i;
                    break;
                }
            }
        }
        if (oldObjectHover !== hoverState.objectIndex) needsRedraw = true;
        if (needsRedraw) redrawAll();
    }

    // 修改setupCanvasAndRedraw函数
    function setupCanvasAndRedraw() {
        if (!displayImage.naturalWidth) return;

        const rect = displayImage.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        imageDimensions = {
            width: rect.width,
            height: rect.height,
            naturalWidth: displayImage.naturalWidth,
            naturalHeight: displayImage.naturalHeight,
            ratio: displayImage.naturalWidth / rect.width, // 这个需要重新计算
        };

        // 重新计算实际的比例（考虑图像可能不会填满整个canvas）
        const displayRect = getImageDisplayRect();
        imageDimensions.ratio = displayImage.naturalWidth / displayRect.width;

        redrawAll();
    }

    displayImage.onload = setupCanvasAndRedraw;
    
    async function loadFrame(index, forceLoad = false) {
        if (!currentVideoPath || index < 0 || (totalFrames > 0 && index >= totalFrames)) return;

        if (!forceLoad && currentFrameIndex === index && displayImage.src) {
            return;
        }

        try {
            editingFilePath = null;
            const url = `/api/videos/frame?video_path=${encodeURIComponent(currentVideoPath)}&frame_index=${index}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const data = await response.json();

            // 1. Prepare data first
            totalFrames = data.totalFrames;
            currentFrameIndex = index;
            updateFrameCounter();

            // 2. 在设置新图像源之前清除当前显示
            displayImage.src = '';
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 3. 检查是否有已存在的标注并初始化状态
            if (data.hasAnnotation && data.annotations && data.annotations.length > 0) {
                // 存在标注，加载标注数据
                initAnnotationStateWithData(data.annotations);
            } else {
                // 没有标注，初始化空状态
                initAnnotationState();
            }

            // 4. Set src to trigger onload
            displayImage.src = data.frameUrl;

            // 4. 确保图片加载后重新绘制标注
            displayImage.onload = () => {
                setupCanvasAndRedraw();
                // 如果有标注数据，重新绘制
                if (data.hasAnnotation && data.annotations && data.annotations.length > 0) {
                    redrawAll();
                }
            };

        } catch (error) {
            console.error(`加载第 ${index + 1} 帧失败:`, error);
            alert(`加载第 ${index + 1} 帧失败。`);
        }
    }

    // 新增：使用标注数据初始化状态
    function initAnnotationStateWithData(annotations) {
        annotationState = { objects: [], activeObjectIndex: -1, nextId: 1 };

        annotations.forEach((ann, index) => {
            const newObj = addNewObject();
            newObj.classId = ann.classId;
            newObj.maskData = ann.maskData;
            newObj.points = [];
            
            // 🔧 修复：根据classId设置对应标签的颜色
            if (Array.isArray(labels) && labels.length > 0) {
                const selectedLabel = labels.find(label => label.id === ann.classId);
                if (selectedLabel && selectedLabel.color) {
                    newObj.color = selectedLabel.color;
                }
            }

            // 重新计算boxData
            if (newObj.maskData && newObj.maskData.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                newObj.maskData[0].forEach(p => {
                    minX = Math.min(minX, p[0]);
                    minY = Math.min(minY, p[1]);
                    maxX = Math.max(maxX, p[0]);
                    maxY = Math.max(maxY, p[1]);
                });
                newObj.boxData = [minX, minY, maxX, maxY];
            }
        });

        if (annotationState.objects.length > 0) {
            setActiveObject(0);
        } else {
            addNewObject();
        }

        renderSidebar();
        // showToast("已加载已保存的标注");

        // 确保标注被绘制
        setTimeout(() => {
            redrawAll();
        }, 100);
    }

    async function selectVideo(videoPath, initialTotalFrames, taskType = 'video') {
        // 保存当前任务的间隔帧数设置（如果存在）
        if (currentVideoPath && skipFramesInput) {
            taskSkipFrames[currentVideoPath] = parseInt(skipFramesInput.value) || 1;
        }

        // 立即清除当前显示的图像和标注
        displayImage.src = '';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        initAnnotationState();

        editingFilePath = null;
        currentVideoPath = videoPath;
        currentFrameIndex = 0;
        totalFrames = 0;

        try {
            // 从任务列表中获取项目信息
            let taskProject = null;
            const taskListResponse = await fetch(`/api/browse?user=${currentUser}`);
            const taskListData = await taskListResponse.json();

            if (taskListResponse.ok && taskListData.files) {
                const currentTask = taskListData.files.find(task => task.path === videoPath);
                if (currentTask && currentTask.project) {
                    taskProject = currentTask.project;
                }
            }

            // 设置当前项目
            if (taskProject) {
                currentProject = taskProject;
            }

            // 加载项目对应的标签
            await loadLabels();

            // 首先检查是否有抽帧图片
            const extractionInfoResponse = await fetch(`/api/video/extraction_info?user=${currentUser}&video_path=${encodeURIComponent(videoPath)}`);
            const extractionInfoData = await extractionInfoResponse.json();

            let startFrameIndex = 0;
            let hasExtractedFrames = false;
            let extractedFrameCount = 0;

            if (extractionInfoResponse.ok && extractionInfoData.extraction_info) {
                const extractedCount = extractionInfoData.extraction_info.extracted_frame_count || 0;
                if (extractedCount > 0) {
                    totalFrames = extractedCount;
                    extractedFrameCount = extractedCount;
                    hasExtractedFrames = true;
                }
            }

            // 获取最后标注的帧（自动定位）
            const lastAnnotatedFrameResponse = await fetch(`/api/task/last_annotated_frame?user=${currentUser}&task_path=${encodeURIComponent(videoPath)}`);
            const lastAnnotatedFrameData = await lastAnnotatedFrameResponse.json();

            if (lastAnnotatedFrameResponse.ok && lastAnnotatedFrameData.last_frame_index >= 0) {
                startFrameIndex = lastAnnotatedFrameData.last_frame_index;
            }

            showAnnotationUI('annotate');

            // 恢复新任务的间隔帧数设置
            if (taskSkipFrames[videoPath]) {
                skipFramesInput.value = taskSkipFrames[videoPath];
                currentTaskSkipFrames = taskSkipFrames[videoPath];
            } else {
                // 新任务使用默认值
                skipFramesInput.value = 1;
                currentTaskSkipFrames = 1;
                taskSkipFrames[videoPath] = 1;
            }

            // 对于抽帧图片，确保起始帧索引不超过抽帧图片数量
            if (hasExtractedFrames && startFrameIndex >= extractedFrameCount) {
                startFrameIndex = Math.max(0, extractedFrameCount - 1);
            }

            await loadFrame(startFrameIndex, true);

        } catch (error) {
            console.error('Failed to load task progress:', error);
            // 如果获取进度失败，从第0帧开始
            showAnnotationUI('annotate');

            // 设置默认间隔帧数
            skipFramesInput.value = 1;
            currentTaskSkipFrames = 1;
            taskSkipFrames[videoPath] = 1;

            await loadFrame(0, true);
        }
    }

    function startReviewSession(startIndex) {
        // 保存当前任务的间隔帧数设置（如果存在）
        if (reviewContext.basePath && skipFramesInput) {
            taskSkipFrames[reviewContext.basePath] = parseInt(skipFramesInput.value) || 1;
        }

        // 保存当前分页信息到reviewContext
        reviewContext.currentPage = reviewImagePaginationState.currentPage;
        reviewContext.pageSize = reviewImagePaginationState.pageSize;

        // 恢复审核任务的间隔帧数设置
        if (taskSkipFrames[reviewContext.basePath]) {
            skipFramesInput.value = taskSkipFrames[reviewContext.basePath];
            currentTaskSkipFrames = taskSkipFrames[reviewContext.basePath];
        } else {
            // 新审核任务使用默认值
            skipFramesInput.value = 1;
            currentTaskSkipFrames = 1;
            taskSkipFrames[reviewContext.basePath] = 1;
        }

        reviewContext.currentIndex = startIndex;
        showAnnotationUI('review');
        loadReviewedImage();
    }

    async function loadReviewedImage() {
        if (reviewContext.currentIndex < 0 || reviewContext.currentIndex >= reviewContext.fileList.length) {
            showToast(reviewContext.currentIndex < 0 ? "已经是第一张了" : "已经是最后一张了");
            reviewContext.currentIndex = Math.max(0, Math.min(reviewContext.currentIndex, reviewContext.fileList.length - 1));
            return;
        }

        const currentFile = reviewContext.fileList[reviewContext.currentIndex];

        // 设置全局编辑文件路径
        editingFilePath = currentFile.relative_path;

        try {
            const response = await fetch(`/api/get_annotation?path=${encodeURIComponent(editingFilePath)}`);
            if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(errData.error || 'Failed to fetch annotation data');
            }
            const data = await response.json();
            // 1. Prepare all data and state first
            currentVideoPath = data.originalVideoPath;
            currentFrameIndex = data.frameIndex;

            // 设置当前项目（如果返回了项目信息）
            if (data.project) {
                currentProject = data.project;
                // 加载项目对应的标签
                await loadLabels();
            } // <--- 补上缺失的右花括号

            if (data.totalFrames && data.totalFrames > 0) {
                totalFrames = data.totalFrames;
            } else if (reviewContext.totalImages && reviewContext.totalImages > 0) {
                totalFrames = reviewContext.totalImages;
            } else {
                // 如果都没有，使用当前分页的图片数作为后备
                totalFrames = reviewContext.fileList.length;
            }

            // 暂存标注数据，等图片加载后再处理
            const annotationsToLoad = data.annotations;

            // 2. Set src to trigger onload
            displayImage.src = currentFile.web_path;

            // 3. 图片加载完成后处理标注数据
            displayImage.onload = () => {
                // 先更新canvas和图片尺寸
                setupCanvasAndRedraw();
                
                // 然后加载标注数据（此时imageDimensions已经是新图片的尺寸）
                annotationState = { objects: [], activeObjectIndex: -1, nextId: 1, nextObjectId: 1 };
                annotationsToLoad.forEach(ann => {
                    const newObj = addNewObject();
                    newObj.classId = ann.classId;
                    newObj.maskData = ann.maskData;  // maskData是像素坐标（基于当前图片尺寸）
                    newObj.points = [];
                    
                    // 🔧 修复：根据classId设置对应标签的颜色
                    if (Array.isArray(labels) && labels.length > 0) {
                        const selectedLabel = labels.find(label => label.id === ann.classId);
                        if (selectedLabel && selectedLabel.color) {
                            newObj.color = selectedLabel.color;
                        }
                    }
                    
                    // 重新计算boxData（maskData已经是正确的像素坐标）
                    if (newObj.maskData && newObj.maskData.length > 0) {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        newObj.maskData[0].forEach(p => {
                            minX = Math.min(minX, p[0]); 
                            minY = Math.min(minY, p[1]);
                            maxX = Math.max(maxX, p[0]); 
                            maxY = Math.max(maxY, p[1]);
                        });
                        newObj.boxData = [minX, minY, maxX, maxY];
                    }
                });
                
                if (annotationState.objects.length > 0) {
                    setActiveObject(0);
                } else {
                    addNewObject();
                }
                
                updateFrameCounter();
                redrawAll(); // 确保标注被绘制
            };

        } catch (error) {
            console.error("Error loading annotation for review:", error);
            alert("加载标注失败: " + error.message);
        }
    }
    
    // --- New Admin Panel Logic ---
    function clearUserForm() {
        newUsernameInput.value = '';
        newUsernameInput.disabled = false;
        newPasswordInput.value = '';
        const checkboxes = newUserRolesContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
    }

    // 更新 loadUsersForAdmin 函数
    async function loadUsersForAdmin() {
        if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
            return;
        }
        try {
            const response = await fetch(`/api/admin/users?user=${currentUser}`);
            const users = await response.json();
            if (!response.ok) throw new Error(users.error || 'Failed to load users');

            userManagementTable.innerHTML = `
                <div class="table-container">
                    <table class="user-management-table">
                        <thead>
                            <tr>
                                <th>👤 用户名</th>
                                <th>🔒 密码</th>
                                <th>🎭 角色</th>
                                <th>⚡ 操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(users).map(([username, data]) => `
                                <tr>
                                    <td class="username-cell">
                                        ${data.roles.includes('admin') ? '👑 ' : ''}${username}
                                    </td>
                                    <td class="password-cell">
                                        <div class="password-display">
                                            <span class="password-text" style="display: none;">${data.password}</span>
                                            <span class="password-dots">••••••••</span>
                                            <button class="toggle-password-btn" data-username="${username}" title="显示/隐藏密码">
                                                👁️
                                            </button>
                                        </div>
                                    </td>
                                    <td class="roles-cell">${data.roles.join(', ')}</td>
                                    <td class="actions-cell">
                                        <button class="admin-action-btn edit" data-username="${username}" data-roles="${data.roles.join(',')}">✏️编辑</button>
                                        ${username !== 'admin' ? `<button class="admin-action-btn delete" data-username="${username}">🗑️ 删除</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            // 添加密码显示/隐藏功能
            document.querySelectorAll('.toggle-password-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const username = e.target.dataset.username;
                    const row = e.target.closest('tr');
                    const passwordText = row.querySelector('.password-text');
                    const passwordDots = row.querySelector('.password-dots');
                    const isVisible = passwordText.style.display !== 'none';

                    passwordText.style.display = isVisible ? 'none' : 'inline';
                    passwordDots.style.display = isVisible ? 'inline' : 'none';
                    e.target.textContent = isVisible ? '👁️' : '🙈';
                    e.target.title = isVisible ? '显示密码' : '隐藏密码';
                });
            });

            // 添加编辑和删除事件监听器
            document.querySelectorAll('.admin-action-btn.edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const { username, roles } = e.target.dataset;
                    window.editUser(username, roles);
                });
            });
            document.querySelectorAll('.admin-action-btn.delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {  // 添加 async 关键字
                    const username = e.target.dataset.username;
                    const result = await showCustomConfirm(
                        `确定要删除用户 '${username}' 吗？`,
                        [
                            '属于该用户的标注或审核任务需要重新分配'
                        ],
                        '删除用户'
                    );

                    if (result) {
                        window.manageUser('delete', username);
                    }
                });
            });

        } catch (error) {
            showToast(`加载用户失败: ${error.message}`, 'error');
        }
    }

    // --- NEW: Task Assignment Logic ---
    async function loadAssignmentData() {
        // 确保userRoles是有效数组
        if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
            return;
        }
        try {
            const response = await fetch(`/api/admin/assignment_data?user=${currentUser}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to load assignment data');

            // Populate video pool - 修复：确保正确显示所有可分配的任务
            videoPoolSelect.innerHTML = '';
            if (data.video_pool && data.video_pool.length > 0) {
                data.video_pool.forEach(videoPath => {
                    const option = document.createElement('option');
                    option.value = videoPath;

                    // 从路径中提取项目信息
                    let projectName = '默认项目';
                    if (videoPath.includes('/')) {
                        projectName = videoPath.split('/')[0];
                    }

                    // 根据路径判断是视频还是图片任务
                    if (videoPath.includes('images_')) {
                        option.textContent = `🖼️ ${videoPath} [${projectName}]`;
                    } else {
                        option.textContent = `🎬 ${videoPath} [${projectName}]`;
                    }

                    videoPoolSelect.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "暂无待分配任务";
                option.disabled = true;
                videoPoolSelect.appendChild(option);
            }

            // Populate review pool
            reviewPoolSelect.innerHTML = '';
            if (data.completed_annotations && data.completed_annotations.length > 0) {
                data.completed_annotations.forEach(task => {
                    const option = document.createElement('option');
                    option.value = task.path;
                    // 后端已经返回格式化的名称：任务名 [项目名]
                    option.textContent = task.name;
                    reviewPoolSelect.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "暂无待审核任务";
                option.disabled = true;
                reviewPoolSelect.appendChild(option);
            }

            // Populate user dropdowns
            const annotators = [], reviewers = [];
            Object.entries(data.users).forEach(([username, userData]) => {
                // 确保userData.roles是有效数组
                if (!userData.roles || !Array.isArray(userData.roles)) {
                    console.warn(`用户 ${username} 的roles字段无效:`, userData.roles);
                    return;
                }
                if (userData.roles.includes('annotator')) {
                    annotators.push(username);
                }
                if (userData.roles.includes('reviewer')) {
                    reviewers.push(username);
                }
            });

            annotatorSelect.innerHTML = '<option value="">请选择标注员</option>' +
                annotators.map(u => `<option value="${u}">${u}</option>`).join('');
            reviewerSelect.innerHTML = '<option value="">请选择审核员</option>' +
                reviewers.map(u => `<option value="${u}">${u}</option>`).join('');

            // 更新计数
            document.getElementById('video-pool-count').textContent = `${data.video_pool ? data.video_pool.length : 0} 个任务`;
            document.getElementById('review-pool-count').textContent = `${data.completed_annotations ? data.completed_annotations.length : 0} 个任务`;

        } catch (error) {
            showToast(`加载分配数据失败: ${error.message}`, 'error');
        }
    }

    let isAssigning = false;
    async function handleAssignTask(taskType) {
        // 防止重复点击
        if (isAssigning) {
            showToast('正在处理分配请求，请稍候...');
            return;
        }

        const itemsSelect = taskType === 'annotation' ? videoPoolSelect : reviewPoolSelect;
        const userSelect = taskType === 'annotation' ? annotatorSelect : reviewerSelect;

        const selectedItems = Array.from(itemsSelect.selectedOptions).map(opt => opt.value);
        const selectedAssignee = userSelect.value;

        if (selectedItems.length === 0) {
            showToast(`请至少选择一个要分配的${taskType === 'annotation' ? '视频' : '任务'}`);
            return;
        }
        if (!selectedAssignee) {
            showToast(`请选择一个${taskType === 'annotation' ? '标注员' : '审核员'}`);
            return;
        }

        try {
            // 设置正在分配标志
            isAssigning = true;

            // 禁用按钮防止重复点击
            if (taskType === 'annotation') {
                assignAnnotationBtn.disabled = true;
                assignAnnotationBtn.textContent = '分配中...';
            } else {
                assignReviewBtn.disabled = true;
                assignReviewBtn.textContent = '分配中...';
            }

            const response = await fetch(`/api/admin/assign_task?user=${currentUser}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_type: taskType,
                    items: selectedItems,
                    assignee: selectedAssignee
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '分配失败');

            showToast(data.message);
            loadAssignmentData(); // Refresh the lists

            // 清空选择
            itemsSelect.selectedIndex = -1;
            userSelect.selectedIndex = 0;

        } catch (error) {
            showToast(`分配失败: ${error.message}`, 'error');
        } finally {
            // 恢复按钮状态
            isAssigning = false;
            if (taskType === 'annotation') {
                assignAnnotationBtn.disabled = false;
                assignAnnotationBtn.textContent = '➡️ 分配选中任务';
            } else {
                assignReviewBtn.disabled = false;
                assignReviewBtn.textContent = '➡️ 分配选中任务';
            }
        }
    }
    // --- END: Task Assignment Logic ---

    window.editUser = (username, roles) => {
        newUsernameInput.value = username;
        newUsernameInput.disabled = true; // 防止编辑用户名
        newPasswordInput.value = ''; // 清空密码字段，表示不修改
        newPasswordInput.placeholder = '留空则不修改密码';

        const rolesArray = roles.split(',');
        const checkboxes = newUserRolesContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = rolesArray.includes(cb.value);
        });

        // 滚动到表单位置
        document.querySelector('.user-form').scrollIntoView({ behavior: 'smooth' });
    };

    window.manageUser = async (action, username, roles = []) => {
        const targetUsername = action === 'delete' ? username : newUsernameInput.value.trim();
        const password = action === 'delete' ? null : newPasswordInput.value.trim();
        if (!targetUsername) {
            showToast('用户名不能为空');
            return;
        }
        // 对于添加操作，密码不能为空
        if (action === 'add_update' && !password && !newUsernameInput.disabled) {
            showToast('创建新用户时密码不能为空', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/admin/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin_user: currentUser,
                    action: action === 'delete' ? 'delete' : 'add_update',
                    username: targetUsername,
                    roles: roles,
                    password: password || undefined  // 如果密码为空，则不发送该字段
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '操作失败');

            showToast(data.message);
            clearUserForm();
            loadUsersForAdmin(); // 刷新用户列表
        } catch (error) {
            console.error('User management error:', error);
            showToast(`操作失败: ${error.message}`, 'error');
            newUsernameInput.disabled = false; // 出错时重新启用用户名输入
        }
    };

    async function markTaskAsComplete(taskType, taskPath, status) {
        try {
            const response = await fetch('/api/task/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: currentUser,
                    task_type: taskType,
                    task_path: taskPath,
                    status: status
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                // 调试：打印完整响应数据
                // FastAPI返回detail字段，Flask返回error字段，两者都支持
                const errorMsg = data.detail || data.error || 'Failed to update task status';
                throw new Error(errorMsg);
            }
            showToast(data.message || '任务状态已更新');
            browse(); // Refresh the list to show the updated status
        } catch (error) {
            console.error('Error updating task status:', error);
            // 显示友好的错误提示
            showToast(error.message, 'error');
        }
    }

    // 添加模态对话框函数
    function showModeSwitchWarning() {
        // 创建模态对话框
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>切换模式提示</h3>
                </div>
                <div class="modal-body">
                    <p>您当前正在编辑图像，请先返回列表页面再切换工作模式。</p>
                    <p>返回列表前，请保存标注结果。</p>
                </div>
                <div class="modal-footer">
                    <button id="confirm-back-btn" class="btn-primary">返回列表</button>
                    <button id="cancel-modal-btn" class="btn-secondary">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 添加事件监听器
        document.getElementById('confirm-back-btn').addEventListener('click', () => {
            // 返回列表
            showListUI();
            document.body.removeChild(modal);
        });

        document.getElementById('cancel-modal-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // 点击模态背景也可以关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // 修改 switchMode 函数使用模态对话框
    function switchMode(newMode) {
        // 检查是否在图像界面
        if (!annotationUI.classList.contains('hidden')) {
            showModeSwitchWarning();
            return;
        }

        if (appMode === newMode) return;

        // 保存当前任务的间隔帧数设置
        if (currentVideoPath && skipFramesInput) {
            taskSkipFrames[currentVideoPath] = parseInt(skipFramesInput.value) || 1;
        }
        if (reviewContext.basePath && skipFramesInput) {
            taskSkipFrames[reviewContext.basePath] = parseInt(skipFramesInput.value) || 1;
        }

        appMode = newMode;
        editingFilePath = null;

        // 重置筛选状态
        filterState = {
            status: 'all',
            user: '',
            project: ''
        };

        // 重置分页状态
        taskPaginationState.currentPage = 1;
        reviewImagePaginationState.currentPage = 1;

        // 重置间隔帧数为默认值
        skipFramesInput.value = 1;
        currentTaskSkipFrames = 1;

        // 新增：重置数据集管理分页状态
        if (newMode === 'dataset_management') {
            paginationState.currentPage = 1;
            paginationState.totalItems = 0;
            paginationState.totalPages = 1;
            paginationState.allDatasets = [];
        }

        // 重置控件显示状态
        showTaskLevelControls();
        hideReviewImageLevelControls();

        // 更新按钮状态
        annotateModeBtn.classList.remove('active');
        reviewModeBtn.classList.remove('active');
        labelManagementModeBtn.classList.remove('active');
        datasetManagementModeBtn.classList.remove('active');
        taskAssignmentModeBtn.classList.remove('active');
        projectManagementModeBtn.classList.remove('active');
        modelManagementModeBtn.classList.remove('active');

        // 隐藏所有界面
        videoSelectionUI.classList.add('hidden');
        annotationUI.classList.add('hidden');
        labelManagementUI.classList.add('hidden');
        datasetManagementUI.classList.add('hidden');
        taskAssignmentUI.classList.add('hidden');
        projectManagementUI.classList.add('hidden');
        modelManagementUI.classList.add('hidden');

        // 根据新模式显示对应界面
        if (appMode === 'annotate') {
            annotateModeBtn.classList.add('active');
            videoSelectionUI.classList.remove('hidden');
            browse('');
        } else if (appMode === 'review') {
            reviewModeBtn.classList.add('active');
            videoSelectionUI.classList.remove('hidden');
            browse('');
        } else if (appMode === 'label_management') {
            labelManagementModeBtn.classList.add('active');
            labelManagementUI.classList.remove('hidden');

            // 等待加载函数完成
            (async () => {
                await loadLabelManagementUI();
            })();
        } else if (appMode === 'dataset_management') {
            datasetManagementModeBtn.classList.add('active');
            datasetManagementUI.classList.remove('hidden');
            loadDatasetManagementUI();
        } else if (appMode === 'task_assignment') {
            taskAssignmentModeBtn.classList.add('active');
            taskAssignmentUI.classList.remove('hidden');
            loadTaskAssignmentUI();
        } else if (appMode === 'project_management') {
            projectManagementModeBtn.classList.add('active');
            projectManagementUI.classList.remove('hidden');
            loadProjectManagementUI();
        } else if (appMode === 'model_management') {
            modelManagementModeBtn.classList.add('active');
            modelManagementUI.classList.remove('hidden');
            if (typeof window.loadModelManagementUI === 'function') {
                window.loadModelManagementUI();
            } else {
                console.error('[App] loadModelManagementUI function not found');
            }
        }
    }

    // 新增函数：加载任务分配界面
    function loadTaskAssignmentUI() {
        // 只有管理员可以访问任务分配
        if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
            showToast('需要管理员权限访问任务分配');
            switchMode('annotate');
            return;
        }

        // 加载任务分配数据
        loadAssignmentData();

        // 设置事件监听器（确保只设置一次）
        setupTaskAssignmentEvents();
    }

    // 新增函数：设置任务分配事件
    function setupTaskAssignmentEvents() {
        // 先移除之前可能绑定的事件监听器
        assignAnnotationBtn.removeEventListener('click', handleAssignAnnotation);
        assignReviewBtn.removeEventListener('click', handleAssignReview);

        // 标注任务分配按钮 - 使用命名函数
        assignAnnotationBtn.addEventListener('click', handleAssignAnnotation);

        // 审核任务分配按钮 - 使用命名函数
        assignReviewBtn.addEventListener('click', handleAssignReview);
    }

    // 为任务分配创建独立的处理函数
    function handleAssignAnnotation() {
        handleAssignTask('annotation');
    }

    function handleAssignReview() {
        handleAssignTask('review');
    }

    // 新增函数：加载数据集管理界面
    function loadDatasetManagementUI() {
        // 只有管理员可以访问数据集管理
        if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
            showToast('需要管理员权限访问数据集管理');
            switchMode('annotate');
            return;
        }

        // 重置分页状态到第一页
        paginationState.currentPage = 1;
        paginationState.totalItems = 0;
        paginationState.totalPages = 1;
        paginationState.allDatasets = [];

        // 加载项目列表
        loadProjectOptionsForDataset();

        // 加载数据集统计和列表
        loadDatasetStats();
        loadDatasetList();

        // 设置事件监听器
        setupDatasetManagementEvents();
    }

    async function loadProjectOptionsForDataset() {
        try {
            const response = await fetch(`/api/admin/projects?user=${currentUser}`);
            const data = await response.json();

            if (response.ok) {
                const projects = data.projects || {};
                const projectNames = Object.keys(projects);

                // 更新视频上传的项目选择器
                const videoProjectSelect = document.getElementById('video-project-select');
                if (videoProjectSelect) {
                    videoProjectSelect.innerHTML = '<option value="">请选择项目</option>';
                    projectNames.forEach(projectName => {
                        const option = document.createElement('option');
                        option.value = projectName;
                        option.textContent = projectName;
                        videoProjectSelect.appendChild(option);
                    });

                    // 如果有当前项目，默认选择它
                    if (currentProject && projectNames.includes(currentProject)) {
                        videoProjectSelect.value = currentProject;
                    }
                }

                // 更新图片上传的项目选择器
                const imageProjectSelect = document.getElementById('image-project-select');
                if (imageProjectSelect) {
                    imageProjectSelect.innerHTML = '<option value="">请选择项目</option>';
                    projectNames.forEach(projectName => {
                        const option = document.createElement('option');
                        option.value = projectName;
                        option.textContent = projectName;
                        imageProjectSelect.appendChild(option);
                    });

                    // 如果有当前项目，默认选择它
                    if (currentProject && projectNames.includes(currentProject)) {
                        imageProjectSelect.value = currentProject;
                    }
                }

                // 更新数据集筛选的项目选择器
                const datasetProjectFilter = document.getElementById('dataset-project-filter');
                if (datasetProjectFilter) {
                    datasetProjectFilter.innerHTML = '<option value="">全部项目</option>';
                    projectNames.forEach(projectName => {
                        const option = document.createElement('option');
                        option.value = projectName;
                        option.textContent = projectName;
                        datasetProjectFilter.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load project options for dataset management:', error);
        }
    }

    // 新增函数：设置数据集管理事件
    function setupDatasetManagementEvents() {
        // 视频上传
        mainUploadVideosBtn.addEventListener('click', handleMainVideoUpload);

        // 图片上传
        mainUploadImagesBtn.addEventListener('click', handleMainImageUpload);

        // 刷新按钮
        refreshDatasetsBtn.addEventListener('click', async () => {
            await loadDatasetStats();
            await loadDatasetList();
            showToast('数据集列表已刷新');
        });

        // 分页事件
        setupPaginationEvents();

        // 数据集筛选事件
        const applyFilterBtn = document.getElementById('apply-dataset-filter');
        const clearFilterBtn = document.getElementById('clear-dataset-filter');
        const projectFilter = document.getElementById('dataset-project-filter');

        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', async () => {
                const selectedProject = projectFilter ? projectFilter.value : '';
                await loadDatasetStats(selectedProject);
                await loadDatasetList(selectedProject);
                showToast(selectedProject ? `已筛选项目: ${selectedProject}` : '显示所有项目数据集');
            });
        }

        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', async () => {
                if (projectFilter) projectFilter.value = '';
                await loadDatasetStats();
                await loadDatasetList();
                showToast('已清除筛选');
            });
        }
    }

    // 新增函数：加载数据集统计
    async function loadDatasetStats(projectName = '') {
        try {
            let url = `/api/admin/dataset_stats?user=${currentUser}`;
            if (projectName) {
                url += `&project=${encodeURIComponent(projectName)}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                videoCount.textContent = data.video_count || 0;
                imageTaskCount.textContent = data.image_task_count || 0;
                totalDatasetCount.textContent = data.total_datasets || 0;
            } else {
                throw new Error(data.error || '获取统计信息失败');
            }
        } catch (error) {
            console.error('Failed to load dataset stats:', error);
            videoCount.textContent = '0';
            imageTaskCount.textContent = '0';
            totalDatasetCount.textContent = '0';
        }
    }

    // 新增函数：加载数据集列表
    async function loadDatasetList(projectName = '') {
        try {
            let url = `/api/admin/datasets?user=${currentUser}`;
            if (projectName) {
                url += `&project=${encodeURIComponent(projectName)}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                // 存储所有数据集
                paginationState.allDatasets = data.datasets || [];
                paginationState.totalItems = paginationState.allDatasets.length;
                paginationState.totalPages = Math.ceil(paginationState.totalItems / paginationState.pageSize);

                // 确保当前页在有效范围内
                if (paginationState.currentPage > paginationState.totalPages) {
                    paginationState.currentPage = Math.max(1, paginationState.totalPages);
                }
                if (paginationState.currentPage < 1) {
                    paginationState.currentPage = 1;
                }

                // 更新分页信息显示
                updatePaginationInfo();

                // 渲染当前页的数据
                renderCurrentPage();
            } else {
                throw new Error(data.error || '获取数据集列表失败');
            }
        } catch (error) {
            console.error('Failed to load dataset list:', error);
            datasetListContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>加载失败</h3>
                    <p>无法加载数据集列表: ${error.message}</p>
                </div>
            `;

            // 重置分页状态
            resetPagination();
        }
    }

    // 新增函数：更新分页信息显示
    function updatePaginationInfo() {
        if (!currentPageSpan || !totalPagesSpan) return;

        currentPageSpan.textContent = paginationState.currentPage;
        totalPagesSpan.textContent = paginationState.totalPages;

        // 更新按钮状态
        const firstPageBtn = document.getElementById('first-page-btn');
        const prevPageBtn = document.getElementById('prev-page-btn');
        const nextPageBtn = document.getElementById('next-page-btn');
        const lastPageBtn = document.getElementById('last-page-btn');

        if (firstPageBtn) firstPageBtn.disabled = paginationState.currentPage === 1;
        if (prevPageBtn) prevPageBtn.disabled = paginationState.currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = paginationState.currentPage === paginationState.totalPages;
        if (lastPageBtn) lastPageBtn.disabled = paginationState.currentPage === paginationState.totalPages;
    }

    // 新增函数：重置分页状态
    function resetPagination() {
        paginationState.currentPage = 1;
        paginationState.totalItems = 0;
        paginationState.totalPages = 1;
        paginationState.allDatasets = [];
        updatePaginationInfo();
    }

    // 新增函数：获取当前页的数据
    function getCurrentPageData() {
        const startIndex = (paginationState.currentPage - 1) * paginationState.pageSize;
        const endIndex = startIndex + paginationState.pageSize;
        return paginationState.allDatasets.slice(startIndex, endIndex);
    }

    // 新增函数：渲染数据集列表
    function renderCurrentPage() {
        if (!datasetListContainer) return;

        const currentPageData = getCurrentPageData();

        datasetListContainer.innerHTML = '';

        if (!currentPageData || currentPageData.length === 0) {
            datasetListContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <h3>${paginationState.currentPage === 1 ? '暂无数据集' : '本页无数据'}</h3>
                    <p>${paginationState.currentPage === 1 ? '还没有上传任何数据集文件，请使用上方功能上传视频或图片包' : '请返回第一页查看数据'}</p>
                </div>
            `;
            return;
        }

        const table = document.createElement('table');
        table.className = 'dataset-management-table';

        // 表头 - 添加项目列
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>#</th>
                <th>📛 名称</th>
                <th>📂 项目</th>
                <th>🎯 类型</th>
                <th>📅 上传时间</th>
                <th>📏 大小/数量</th>
                <th>⚡ 操作</th>
            </tr>
        `;
        table.appendChild(thead);

        // 表体
        const tbody = document.createElement('tbody');

        const startNumber = (paginationState.currentPage - 1) * paginationState.pageSize + 1;

        currentPageData.forEach((dataset, index) => {
            const rowNumber = startNumber + index;

            const row = document.createElement('tr');

            // 根据类型显示不同的信息
            let sizeInfo = '';
            if (dataset.type === 'video') {
                sizeInfo = dataset.file_size || '未知大小';
            } else {
                sizeInfo = `${dataset.image_count || 0} 张图片`;
            }

            row.innerHTML = `
                <td class="dataset-number-cell">${rowNumber}</td>
                <td class="dataset-name-cell">
                    <span class="dataset-icon">${dataset.type === 'video' ? '🎬' : '🖼️'}</span>
                    ${dataset.name}
                </td>
                <td class="dataset-project-cell">
                    <span class="project-badge">${dataset.project || '未知项目'}</span>
                </td>
                <td class="dataset-type-cell">
                    <span class="type-badge ${dataset.type}">${dataset.type === 'video' ? '视频' : '图片任务'}</span>
                </td>
                <td class="dataset-time-cell">${dataset.upload_time || '未知'}</td>
                <td class="dataset-size-cell">${sizeInfo}</td>
                <td class="dataset-actions-cell">
                    <button class="dataset-action-btn delete" data-path="${dataset.path}" data-type="${dataset.type}">
                        <span class="btn-icon">🗑️</span>
                        删除
                    </button>
                </td>
            `;

            // 添加删除事件
            const deleteBtn = row.querySelector('.dataset-action-btn.delete');
            deleteBtn.addEventListener('click', (e) => {
                const path = e.target.closest('button').dataset.path;
                const type = e.target.closest('button').dataset.type;
                deleteDataset(path, type);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        datasetListContainer.appendChild(table);
    }

        function updateUploadStatus(element, message, type = 'info') {
            element.textContent = message;
            element.className = 'upload-status';
            element.classList.add(type);
        }

    async function handleMainVideoUpload() {
        const files = mainVideoUploadInput.files;
        const projectSelect = document.getElementById('video-project-select');
        const selectedProject = projectSelect ? projectSelect.value : '';

        if (!files.length) {
            updateUploadStatus(mainUploadStatus, '请先选择要上传的视频文件。', 'error');
            return;
        }

        if (!selectedProject) {
            updateUploadStatus(mainUploadStatus, '请选择项目。', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('user', currentUser);
        formData.append('project', selectedProject);  // 添加项目参数
        for (const file of files) {
            formData.append('videos[]', file);
        }

        updateUploadStatus(mainUploadStatus, '正在上传视频文件...', 'info');
        mainUploadVideosBtn.disabled = true;

        try {
            const response = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                updateUploadStatus(mainUploadStatus, data.message, 'success');
                mainVideoUploadInput.value = '';

                // 刷新数据集列表和统计
                await loadDatasetStats();
                await loadDatasetList();
                
                showToast('视频上传成功，数据集列表已更新', 'success');
            } else {
                throw new Error(data.error || data.detail || '上传失败');
            }
        } catch (error) {
            updateUploadStatus(mainUploadStatus, `上传出错: ${error.message}`, 'error');
        } finally {
            mainUploadVideosBtn.disabled = false;
        }
    }

    // 新增函数：跳转到指定页面
    function goToPage(page) {
        if (page < 1 || page > paginationState.totalPages || page === paginationState.currentPage) {
            return;
        }

        paginationState.currentPage = page;
        updatePaginationInfo();
        renderCurrentPage();

        // 滚动到列表顶部
        if (datasetListContainer) {
            datasetListContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // 新增函数：设置分页事件监听器
    function setupPaginationEvents() {
        // 先移除可能已存在的事件监听器
        const firstPageBtn = document.getElementById('first-page-btn');
        const prevPageBtn = document.getElementById('prev-page-btn');
        const nextPageBtn = document.getElementById('next-page-btn');
        const lastPageBtn = document.getElementById('last-page-btn');

        // 克隆并替换按钮来移除旧的事件监听器
        const replaceButton = (btn) => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            return newBtn;
        };

        const newFirstBtn = replaceButton(firstPageBtn);
        const newPrevBtn = replaceButton(prevPageBtn);
        const newNextBtn = replaceButton(nextPageBtn);
        const newLastBtn = replaceButton(lastPageBtn);

        // 重新绑定事件
        newFirstBtn.addEventListener('click', () => goToPage(1));
        newPrevBtn.addEventListener('click', () => goToPage(paginationState.currentPage - 1));
        newNextBtn.addEventListener('click', () => goToPage(paginationState.currentPage + 1));
        newLastBtn.addEventListener('click', () => goToPage(paginationState.totalPages));
    }

    // 新增函数：处理图片上传（主界面）
    async function handleMainImageUpload() {
        const files = mainImageUploadInput.files;
        const projectSelect = document.getElementById('image-project-select');
        const selectedProject = projectSelect ? projectSelect.value : '';

        if (!files.length) {
            updateUploadStatus(mainUploadImageStatus, '请先选择要上传的图片压缩包文件。', 'error');
            return;
        }

        if (!selectedProject) {
            updateUploadStatus(mainUploadImageStatus, '请选择项目。', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('user', currentUser);
        formData.append('project', selectedProject);  // 添加项目参数
        for (const file of files) {
            formData.append('images[]', file);
        }

        updateUploadStatus(mainUploadImageStatus, '正在上传并解压图片压缩包...', 'info');
        mainUploadImagesBtn.disabled = true;

        try {
            const response = await fetch('/api/admin/upload_images', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                let statusMessage = data.message;
                updateUploadStatus(mainUploadImageStatus, statusMessage, 'success');
                mainImageUploadInput.value = '';

                // 显示上传的任务详情
                if (data.uploaded_tasks && data.uploaded_tasks.length > 0) {
                    const taskDetails = data.uploaded_tasks.map(task =>
                        `${task.task_name} (${task.image_count}张图片)`
                    ).join(', ');
                    mainUploadImageStatus.textContent += ` - 任务: ${taskDetails}`;
                }

                // 刷新数据集列表和统计
                await loadDatasetStats();
                await loadDatasetList();
                
                showToast('图片压缩包上传成功，数据集列表已更新', 'success');
            } else {
                throw new Error(data.error || data.detail || '上传失败');
            }
        } catch (error) {
            updateUploadStatus(mainUploadImageStatus, `上传出错: ${error.message}`, 'error');
        } finally {
            mainUploadImagesBtn.disabled = false;
        }
    }

    // 新增函数：删除数据集
    async function deleteDataset(path, type) {
        const datasetTypeName = type === 'video' ? '视频' : '图片任务';
        const message = `确定要删除这个${datasetTypeName}吗？`;
        const details = [
            '删除原始数据文件',
            '删除所有关联的标注数据',
            '如有需要，请先导出关联的标注数据！'
        ];

        const result = await showCustomConfirm(message, details, `删除${datasetTypeName}`);

        if (!result) {
            return; // 用户取消操作
        }

        try {
            const response = await fetch('/api/admin/delete_dataset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: currentUser,
                    path: path,
                    type: type
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message);
                // 刷新数据集列表和统计
                await loadDatasetStats();
                await loadDatasetList(); // 这会重置分页状态

                // 如果删除后当前页没有数据了，且不是第一页，则跳转到上一页
                setTimeout(() => {
                    const currentPageData = getCurrentPageData();
                    if (currentPageData.length === 0 && paginationState.currentPage > 1) {
                        goToPage(paginationState.currentPage - 1);
                    }
                }, 100);
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            showToast(`删除失败: ${error.message}`, 'error');
        }
    }

    // 新增函数：加载标签管理界面
    async function loadLabelManagementUI() {
        // 根据用户角色显示/隐藏管理员功能
        if (Array.isArray(userRoles) && userRoles.includes('admin')) {
            labelAdminSection.classList.remove('hidden');
            labelUserNotice.classList.add('hidden');
            projectSelectorSection.classList.remove('hidden');

            // 加载所有项目选项
            await loadProjectOptions();

            // 确保当前项目正确设置
            if (currentProject && labelProjectSelect) {
                labelProjectSelect.value = currentProject;
                updateProjectInfoDisplay('project', currentProject);
            }

            // 添加管理员功能的事件监听器
            setupLabelManagementEvents();
        } else {
            // 普通用户：显示他们有权访问的项目标签
            labelAdminSection.classList.add('hidden');
            labelUserNotice.classList.add('hidden');
            projectSelectorSection.classList.remove('hidden'); // 普通用户也需要选择项目

            // 为普通用户加载他们有权访问的项目
            await loadUserProjectsForLabels();

            // 添加普通用户的事件监听器（只读）
            setupLabelManagementEventsForUser();
        }

        // 加载并显示标签列表
        await loadLabelsForManagement();
    }

    async function loadUserProjectsForLabels() {
        try {
            // 获取用户有权限的项目
            const response = await fetch(`/api/user/projects?user=${currentUser}`);
            const data = await response.json();

            if (response.ok) {
                // 清空现有选项
                labelProjectSelect.innerHTML = '';

                const userProjects = data.projects || [];

                if (userProjects.length === 0) {
                    // 如果没有项目，显示提示
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = '暂无可用项目';
                    option.disabled = true;
                    labelProjectSelect.appendChild(option);
                    currentProject = null;

                    // 显示提示信息
                    labelUserNotice.classList.remove('hidden');
                    userNoticeText.textContent = '您当前没有被分配到任何项目，请联系管理员获取项目权限。';
                    return;
                }

                // 添加项目选项
                userProjects.forEach(projectName => {
                    const option = document.createElement('option');
                    option.value = projectName;
                    option.textContent = `📁 ${projectName}`;
                    labelProjectSelect.appendChild(option);
                });

                // 移除旧的事件监听器
                labelProjectSelect.removeEventListener('change', handleProjectChange);

                // 设置事件监听
                labelProjectSelect.addEventListener('change', handleProjectChange);

                // 设置默认项目
                currentProject = userProjects[0];
                labelProjectSelect.value = currentProject;
                updateProjectInfoDisplay('project', currentProject);

            }
        } catch (error) {
            console.error('Failed to load user projects:', error);
            labelUserNotice.classList.remove('hidden');
            userNoticeText.textContent = '加载项目列表失败，请刷新页面重试。';
        }
    }

    function setupLabelManagementEventsForUser() {
        // 普通用户只能查看，不能编辑
        // 只需要处理项目切换事件
        labelProjectSelect.addEventListener('change', handleProjectChange);

        // 禁用添加标签的表单（如果有显示的话）
        const addLabelBtn = document.getElementById('add-label-btn');
        if (addLabelBtn) {
            addLabelBtn.disabled = true;
            addLabelBtn.title = '普通用户无权限添加标签';
        }
    }

    async function loadProjectOptions() {
        if (!Array.isArray(userRoles) || !userRoles.includes('admin')) return;

        try {
            const response = await fetch(`/api/admin/projects?user=${currentUser}`);
            const data = await response.json();

            if (response.ok) {
                // 更新全局项目数据
                projects = data.projects || {};

                // 清空现有选项
                labelProjectSelect.innerHTML = '';

                const projectNames = Object.keys(projects);

                if (projectNames.length === 0) {
                    // 如果没有项目，显示提示
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = '暂无项目，请先创建项目';
                    option.disabled = true;
                    labelProjectSelect.appendChild(option);
                    currentProject = null;
                    return;
                }

                // 添加项目选项
                projectNames.forEach(projectName => {
                    const option = document.createElement('option');
                    option.value = projectName;
                    option.textContent = `📁 ${projectName}`;
                    labelProjectSelect.appendChild(option);
                });

                // 移除旧的事件监听器并添加新的
                labelProjectSelect.removeEventListener('change', handleProjectChange);
                labelProjectSelect.addEventListener('change', handleProjectChange);

                // 确保当前项目有效，如果无效则选择第一个项目
                if (!currentProject || !projectNames.includes(currentProject)) {
                    currentProject = projectNames[0];
                }

                // 更新项目选择器
                labelProjectSelect.value = currentProject;

                // 更新项目信息显示
                updateProjectInfoDisplay('project', currentProject);

            }
        } catch (error) {
            console.error('Failed to load project options:', error);
        }
    }
    
    function handleProjectChange() {
        const selectedProject = labelProjectSelect.value;

        if (!selectedProject) {
            return;
        }

        // 更新当前项目
        currentProject = selectedProject;
        labelManagementContext.currentProject = selectedProject;
        updateProjectInfoDisplay('project', selectedProject);

        // 重新加载标签
        loadLabelsForManagement();
    }

    async function loadLabelsForManagement() {
        if (!currentProject) {
            labels = [];
            renderLabelList();
            return;
        }

        try {
            const endpoint = `/api/labels?project=${encodeURIComponent(currentProject)}&user=${currentUser}`;
            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && Array.isArray(data.labels)) {
                // 为每个标签添加project字段，保持"所属项目"列显示
                labels = data.labels.map(label => ({
                    ...label,
                    project: currentProject
                }));
                renderLabelList();
            } else {
                labels = [];
                renderLabelList();
            }
        } catch (error) {
            console.error('Failed to load labels:', error);
            labels = [];
            renderLabelList();
            showToast(`加载标签失败: ${error.message}`, 'error');
        }
    }

    function updateProjectInfoDisplay(type, projectName = '') {
        if (Array.isArray(userRoles) && userRoles.includes('admin')) {
            currentProjectInfo.innerHTML = `<span class="project-badge project">📁 当前项目：${projectName}</span>`;
            labelFormTitle.textContent = `➕ 添加项目标签（${projectName}）`;
            labelFormHint.textContent = `此标签仅属于项目 "${projectName}"。`;
        } else {
            currentProjectInfo.innerHTML = `<span class="project-badge project">📁 当前项目：${projectName}（只读）</span>`;
            labelFormTitle.textContent = `👀 查看项目标签（${projectName}）`;
            labelFormHint.textContent = `您正在查看项目 "${projectName}" 的标签体系。`;
        }
    }

    // 新增函数：设置标签管理事件
    function setupLabelManagementEvents() {
        // 添加标签按钮
        document.getElementById('add-label-btn').addEventListener('click', addLabel);

        // 保存编辑按钮
        document.getElementById('save-edit-label-btn').addEventListener('click', saveLabelEdit);

        // 取消编辑按钮
        document.getElementById('cancel-edit-label-btn').addEventListener('click', hideEditLabelForm);

        // 回车键添加标签
        document.getElementById('new-label-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addLabel();
            }
        });

        // 回车键保存编辑
        document.getElementById('edit-label-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveLabelEdit();
            }
        });
    }

    // 新增函数：渲染标签列表
    function renderLabelList() {
        if (!labelListContainer) return;

        labelListContainer.innerHTML = '';

        if (!labels || labels.length === 0) {
            labelListContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏷️</div>
                    <h3>暂无标签</h3>
                    <p>${currentProject ? 
                        `项目 "${currentProject}" 中还没有创建任何标签` : 
                        '没有找到可用的标签'}，${(Array.isArray(userRoles) && userRoles.includes('admin')) ? '请添加第一个标签' : '请联系管理员创建标签'}。</p>
                </div>
            `;
            labelCount.textContent = '共 0 个标签';
            return;
        }

        // 更新标签计数
        labelCount.textContent = `共 ${labels.length} 个标签`;

        // 创建标签表格
        const table = document.createElement('table');
        table.className = 'label-management-table';

        // 表头 - 添加项目列（如果显示多个项目）
        const showProjectColumn = labels.some(label => label.project) &&
                                 (userRoles.includes('admin') ||
                                  (labels.map(l => l.project).filter((v, i, a) => a.indexOf(v) === i).length > 1));

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>#️⃣ ID</th>
                <th>📛 标签名称</th>
                ${showProjectColumn ? '<th>📂 所属项目</th>' : ''}
                ${userRoles.includes('admin') ? '<th>⚡ 操作</th>' : ''}
            </tr>
        `;
        table.appendChild(thead);

        // 表体
        const tbody = document.createElement('tbody');

        labels.forEach(label => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="label-id-cell">${label.id}</td>
                <td class="label-name-cell">${label.name}</td>
                ${showProjectColumn ? `
                    <td class="label-project-cell">
                        <span class="project-badge">${label.project || '未知项目'}</span>
                    </td>
                ` : ''}
                ${userRoles.includes('admin') ? `
                    <td class="label-actions-cell">
                        <button class="label-action-btn edit" data-id="${label.id}" data-name="${label.name}">
                            <span class="btn-icon">✏️</span>
                            编辑
                        </button>
                        <button class="label-action-btn delete" data-id="${label.id}">
                            <span class="btn-icon">🗑️</span>
                            删除
                        </button>
                    </td>
                ` : ''}
            `;

            // 添加管理员操作事件
            if (userRoles.includes('admin')) {
                const editBtn = row.querySelector('.label-action-btn.edit');
                const deleteBtn = row.querySelector('.label-action-btn.delete');

                editBtn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.closest('button').dataset.id);
                    const name = e.target.closest('button').dataset.name;
                    showEditLabelForm(id, name);
                });

                deleteBtn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.closest('button').dataset.id);
                    deleteLabel(id);
                });
            }

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        labelListContainer.appendChild(table);
    }
    
    // --- UI State Changers ---
    function showAnnotationUI(mode) {
        // 在显示界面之前先清理
        if (displayImage) {
            displayImage.src = '';
        }
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        videoSelectionUI.classList.add('hidden');
        annotationUI.classList.remove('hidden');

        [prevFrameBtn, nextFrameBtn, skipFramesInput].forEach(el => {
            el.disabled = false;
        });

        // 新增：隐藏侧边栏
        mainSidebar.classList.add('hidden');
        mainContentArea.classList.add('full-width');
        sidebarCollapsedHeader.classList.add('hidden');

        if (mode === 'annotate') {
            modifyBtn.classList.add('hidden');
            cancelModifyBtn.classList.add('hidden');
            deleteBtn.classList.add('hidden');
            [resetBtn, saveSuccessBtn, addObjectBtn].forEach(el => {
                el.style.display = '';
            });
            // 标注模式下显示自动标注按钮
            if (autoAnnotateBtn) {
                autoAnnotateBtn.style.display = '';
            }
            canvas.style.pointerEvents = 'auto';
        } else { // review mode
            modifyBtn.classList.remove('hidden');
            cancelModifyBtn.classList.add('hidden'); // 确保取消按钮初始隐藏
            deleteBtn.classList.remove('hidden');
            [resetBtn, saveSuccessBtn, addObjectBtn].forEach(el => el.style.display = 'none');
            // 审核模式下隐藏自动标注按钮
            if (autoAnnotateBtn) {
                autoAnnotateBtn.style.display = 'none';
            }
            canvas.style.pointerEvents = 'none';
        }
    }

    function showListUI() {
        // 保存当前任务的间隔帧数设置
        if (currentVideoPath && skipFramesInput) {
            taskSkipFrames[currentVideoPath] = parseInt(skipFramesInput.value) || 1;
        }
        if (reviewContext.basePath && skipFramesInput) {
            taskSkipFrames[reviewContext.basePath] = parseInt(skipFramesInput.value) || 1;
        }

        // 重置修改状态
        cancelModifyBtn.classList.add('hidden');
        modifyBtn.classList.remove('hidden');
        [resetBtn, saveSuccessBtn, addObjectBtn].forEach(el => el.style.display = 'none');
        canvas.style.pointerEvents = 'none';

        annotationUI.classList.add('hidden');
        videoSelectionUI.classList.remove('hidden');

        // 新增：显示侧边栏，并恢复折叠状态
        mainSidebar.classList.remove('hidden');
        mainContentArea.classList.remove('full-width');
        
        // 关键修复：检查侧边栏是否处于折叠状态，如果是则显示展开按钮
        const isCollapsed = mainSidebar.classList.contains('sidebar-collapsed');
        if (isCollapsed) {
            // 侧边栏是折叠的，需要显示展开按钮
            sidebarCollapsedHeader.classList.remove('hidden');
        } else {
            // 侧边栏是展开的，隐藏展开按钮
            sidebarCollapsedHeader.classList.add('hidden');
        }

        const path = (appMode === 'review') ? reviewContext.basePath : breadcrumb.textContent.replace(/ \/ /g, '/').replace('根目录', '');
        browse(path);
    }

    async function checkVideoExtractedBeforeOpen(videoPath) {
        // 检查视频是否已抽帧
        try {
            const response = await fetch(`/api/video/extraction_info?user=${currentUser}&video_path=${encodeURIComponent(videoPath)}`);
            const data = await response.json();
            
            if (response.ok && data.extraction_info) {
                const extractedCount = data.extraction_info.extracted_frame_count || 0;
                if (extractedCount > 0) {
                    return true; // 已抽帧，可以打开
                }
            }
            
            // 未抽帧，显示提示
            showExtractRequiredNotice();
            return false;
        } catch (error) {
            console.error('检查抽帧信息失败:', error);
            return true; // 出错时允许打开
        }
    }

    function showExtractRequiredNotice() {
        // 创建页面中央的提示框
        const existingNotice = document.getElementById('extract-required-notice');
        if (existingNotice) {
            existingNotice.remove();
        }

        const noticeDiv = document.createElement('div');
        noticeDiv.id = 'extract-required-notice';
        noticeDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #444;
            color: #f7fafc;
            padding: 30px 40px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
            border: 1px solid #666;
            z-index: 10000;
            text-align: center;
            min-width: 400px;
            font-family: 'Arial', sans-serif;
        `;

        noticeDiv.innerHTML = `
            <div style="font-size: 42px; margin-bottom: 15px;">⚠️</div>
            <h2 style="margin: 0 0 25px 0; font-size: 20px; font-weight: 500; color: #f7fafc;">请先抽帧后再标注</h2>
            <button id="extract-notice-confirm" style="
                background: #3182ce;
                color: white;
                border: none;
                padding: 10px 30px;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                transition: background 0.2s;
            ">确定</button>
        `;

        document.body.appendChild(noticeDiv);

        // 确认按钮事件
        const confirmBtn = document.getElementById('extract-notice-confirm');
        confirmBtn.addEventListener('click', () => {
            noticeDiv.remove();
        });
        
        // hover 效果
        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.background = '#2c5282';
        });
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.background = '#3182ce';
        });
    }

    function getCanvasMousePos(e) { const rect = canvas.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }

    // 修改坐标转换函数，添加边界检查
    function scaleCoordsToImage(canvasCoords) {
        const displayRect = getImageDisplayRect();

        // 检查点击是否在图像显示区域内
        if (canvasCoords.x < displayRect.x ||
            canvasCoords.x > displayRect.x + displayRect.width ||
            canvasCoords.y < displayRect.y ||
            canvasCoords.y > displayRect.y + displayRect.height) {
            return null; // 返回null表示点在图像外
        }

        // 计算相对于图像显示区域的坐标
        const relativeX = canvasCoords.x - displayRect.x;
        const relativeY = canvasCoords.y - displayRect.y;

        // 转换为原始图像坐标
        return {
            x: Math.round(relativeX * imageDimensions.ratio),
            y: Math.round(relativeY * imageDimensions.ratio)
        };
    }

    // 新增函数：获取图像在canvas中的实际显示区域
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


    // 修改坐标转换到canvas的函数
    function scaleCoordsToCanvas(point) {
        const displayRect = getImageDisplayRect();
        const x = Array.isArray(point) ? point[0] : point.x;
        const y = Array.isArray(point) ? point[1] : point.y;

        // 将原始图像坐标转换到canvas显示坐标
        const canvasX = (x / imageDimensions.naturalWidth) * displayRect.width + displayRect.x;
        const canvasY = (y / imageDimensions.naturalHeight) * displayRect.height + displayRect.y;

        return { x: canvasX, y: canvasY };
    }

    // 初始化抽帧功能
    function initializeFrameExtraction() {
        // 为抽帧按钮添加事件监听
        document.addEventListener('click', function(e) {
            if (e.target.closest('.extract-frames-btn')) {
                const videoPath = e.target.closest('.extract-frames-btn').dataset.videoPath;
                showFrameExtractionModal(videoPath);
            }
        });
    }

    // 显示抽帧模态框
    async function showFrameExtractionModal(videoPath) {
        currentExtractionVideoPath = videoPath;

        try {
            // 获取抽帧信息
            const response = await fetch(`/api/video/extraction_info?user=${currentUser}&video_path=${encodeURIComponent(videoPath)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '获取抽帧信息失败');
            }

            // 创建模态框
            createFrameExtractionModal(data);

        } catch (error) {
            showToast(`获取抽帧信息失败: ${error.message}`, 'error');
        }
    }

    // 创建抽帧模态框
    function createFrameExtractionModal(extractionData) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay frame-extraction-modal';

        const hasAnnotations = extractionData.has_annotations;
        const extractionInfo = extractionData.extraction_info;
        const canExtract = !hasAnnotations;

        modal.innerHTML = `
            <div class="modal-dialog frame-extraction-dialog">
                <div class="modal-header">
                    <h3>🎞️ 视频抽帧</h3>
                    <button class="close-modal-btn" title="关闭">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="extraction-info-section">
                        <h4>视频信息</h4>
                        <div class="info-grid">
                            <div class="info-item">
                                <label>视频路径:</label>
                                <span>${currentExtractionVideoPath}</span>
                            </div>
                            ${extractionInfo ? `
                                <div class="info-item">
                                    <label>上次抽帧:</label>
                                    <span>${extractionInfo.extraction_time}</span>
                                </div>
                                <div class="info-item">
                                    <label>抽帧参数:</label>
                                    <span>${extractionInfo.target_fps} 帧/秒</span>
                                </div>
                                <div class="info-item">
                                    <label>抽帧数量:</label>
                                    <span>${extractionInfo.extracted_frame_count} 张图片</span>
                                </div>
                            ` : `
                                <div class="info-item">
                                    <label>状态:</label>
                                    <span class="status-new">未抽帧</span>
                                </div>
                            `}
                        </div>
                    </div>
                    
                    ${hasAnnotations ? `
                        <div class="annotation-warning">
                            <div class="warning-icon">⚠️</div>
                            <div class="warning-content">
                                <h5>该视频已有标注数据</h5>
                                <p>如需重新抽帧，请先清空标注数据</p>
                                <button id="clear-annotations-btn" class="btn-warning">
                                    <span class="btn-icon">🗑️</span>
                                    清空标注数据
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div class="extraction-settings-section">
                            <h4>抽帧参数设置</h4>
                            <div class="fps-form-group">
                                <label for="target-fps">目标帧率 (帧/秒):</label>
                                <input type="number" id="target-fps" class="fps-form-input" value="1" min="0.1" max="30" step="0.1">                                
                            </div>
                            
                            <div class="extraction-preview">
                                <h5>说明</h5>
                                <div id="extraction-preview-info" class="preview-info">
                                    可设置小数，比如：0.1 帧/秒 = 每 10 秒取 1 帧
                                </div>
                            </div>
                        </div>
                        
                        <div class="extraction-progress-section hidden">
                            <h4>抽帧进度</h4>
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div id="extraction-progress-bar" class="progress-fill" style="width: 0%"></div>
                                </div>
                                <div id="extraction-progress-text" class="progress-text">0%</div>
                            </div>
                            <div id="extraction-details" class="extraction-details">
                                <!-- 进度详情将通过JavaScript动态更新 -->
                            </div>
                        </div>
                        
                        <div class="extraction-result-section hidden">
                            <h4>抽帧结果</h4>
                            <div id="extraction-result" class="extraction-result">
                                <!-- 结果信息将通过JavaScript动态更新 -->
                            </div>
                        </div>
                    `}
                </div>
                <div class="modal-footer">
                    ${hasAnnotations ? `
                        <button id="close-extraction-modal" class="btn-primary">关闭</button>
                    ` : `
                        <button id="start-extraction-btn" class="btn-primary">
                            <span class="btn-icon">🚀</span>
                            开始抽帧
                        </button>
                        <button id="cancel-extraction-btn" class="btn-secondary">取消</button>
                    `}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        frameExtractionModal = modal;

        // 添加事件监听
        setupFrameExtractionModalEvents(hasAnnotations);
    }

    // 设置抽帧模态框事件
    function setupFrameExtractionModalEvents(hasAnnotations) {
        const closeModal = () => {
            if (frameExtractionModal) {
                document.body.removeChild(frameExtractionModal);
                frameExtractionModal = null;
                currentExtractionVideoPath = null;
            }
        };

        // 关闭按钮
        frameExtractionModal.querySelector('.close-modal-btn').addEventListener('click', closeModal);

        if (hasAnnotations) {
            // 清空标注数据按钮
            frameExtractionModal.querySelector('#clear-annotations-btn').addEventListener('click', clearVideoAnnotations);
            frameExtractionModal.querySelector('#close-extraction-modal').addEventListener('click', closeModal);
        } else {
            // 抽帧相关事件
            const targetFpsInput = frameExtractionModal.querySelector('#target-fps');
            const startExtractionBtn = frameExtractionModal.querySelector('#start-extraction-btn');
            const cancelExtractionBtn = frameExtractionModal.querySelector('#cancel-extraction-btn');

            // 开始抽帧按钮
            startExtractionBtn.addEventListener('click', startFrameExtraction);

            // 取消按钮
            cancelExtractionBtn.addEventListener('click', closeModal);
        }

        // 点击背景关闭
        frameExtractionModal.addEventListener('click', (e) => {
            if (e.target === frameExtractionModal) {
                closeModal();
            }
        });

        // ESC键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
    }

    // 清空视频标注数据
    async function clearVideoAnnotations() {
        if (!currentExtractionVideoPath) return;

        const result = await showCustomConfirm(
            '确定要清空该视频的所有标注数据吗？',
            [
                '🗑️ 删除所有标注文件',
                '📝 清空标注记录'
            ],
            '清空标注数据'
        );

        if (!result) return;

        try {
            const response = await fetch('/api/video/clear_annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: currentUser,
                    video_path: currentExtractionVideoPath
                })
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');
                // 关闭当前模态框并重新打开抽帧模态框
                if (frameExtractionModal) {
                    document.body.removeChild(frameExtractionModal);
                    frameExtractionModal = null;
                }
                // 重新打开抽帧模态框
                setTimeout(() => showFrameExtractionModal(currentExtractionVideoPath), 500);
            } else {
                throw new Error(data.error || '清空标注数据失败');
            }
        } catch (error) {
            showToast(`清空标注数据失败: ${error.message}`, 'error');
        }
    }

    // 开始抽帧
    async function startFrameExtraction() {
        if (!currentExtractionVideoPath) return;

        const targetFps = parseFloat(frameExtractionModal.querySelector('#target-fps').value) || 1;
        const startExtractionBtn = frameExtractionModal.querySelector('#start-extraction-btn');
        const cancelExtractionBtn = frameExtractionModal.querySelector('#cancel-extraction-btn');

        // 禁用按钮
        startExtractionBtn.disabled = true;
        cancelExtractionBtn.disabled = true;
        startExtractionBtn.innerHTML = '<span class="btn-icon">⏳</span>抽帧中...';

        // 显示进度区域
        frameExtractionModal.querySelector('.extraction-settings-section').classList.add('hidden');
        frameExtractionModal.querySelector('.extraction-progress-section').classList.remove('hidden');

        try {
            const response = await fetch('/api/video/extract_frames', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: currentUser,
                    video_path: currentExtractionVideoPath,
                    target_fps: targetFps
                })
            });

            const data = await response.json();

            if (response.ok) {
                // 显示结果
                showExtractionResult(data);

                // 更新任务列表中的图片数量
                updateTaskFrameCount(currentExtractionVideoPath, data.extracted_count);

            } else {
                throw new Error(data.error || '抽帧失败');
            }
        } catch (error) {
            showToast(`抽帧失败: ${error.message}`, 'error');
            // 恢复界面
            resetExtractionUI();
        }
    }

    // 显示抽帧结果
    function showExtractionResult(result) {
        if (!frameExtractionModal) return;

        const progressSection = frameExtractionModal.querySelector('.extraction-progress-section');
        const resultSection = frameExtractionModal.querySelector('.extraction-result-section');
        const footer = frameExtractionModal.querySelector('.modal-footer');

        // 更新进度为100%
        frameExtractionModal.querySelector('#extraction-progress-bar').style.width = '100%';
        frameExtractionModal.querySelector('#extraction-progress-text').textContent = '100%';

        // 显示结果
        resultSection.classList.remove('hidden');
        resultSection.querySelector('#extraction-result').innerHTML = `
            <div class="result-success">
                <div class="success-icon">✅ ${result.message}</div>
            </div>
        `;

        // 更新底部按钮
        footer.innerHTML = `
            <button id="close-result-btn" class="btn-primary">完成</button>
            <button id="refresh-task-btn" class="btn-secondary">刷新任务列表</button>
            <button id="start-annotate-btn" class="btn-primary">开始标注</button>
        `;

        // 添加结果按钮事件
        footer.querySelector('#close-result-btn').addEventListener('click', () => {
            if (frameExtractionModal) {
                document.body.removeChild(frameExtractionModal);
                frameExtractionModal = null;
                currentExtractionVideoPath = null;
            }
        });

        footer.querySelector('#refresh-task-btn').addEventListener('click', () => {
            // 刷新任务列表
            if (frameExtractionModal) {
                document.body.removeChild(frameExtractionModal);
                frameExtractionModal = null;
            }
            browse('');
            showToast('任务列表已刷新');
        });

        footer.querySelector('#start-annotate-btn').addEventListener('click', () => {
            // 开始标注这个视频任务
            if (frameExtractionModal) {
                document.body.removeChild(frameExtractionModal);
                frameExtractionModal = null;
            }
            // 选择这个视频任务进行标注
            selectVideo(currentExtractionVideoPath, result.extracted_count, 'video');
        });

        // 更新任务列表中的图片数量
        updateTaskFrameCount(currentExtractionVideoPath, result.extracted_count);
    }

    // 重置抽帧UI
    function resetExtractionUI() {
        if (!frameExtractionModal) return;

        const startExtractionBtn = frameExtractionModal.querySelector('#start-extraction-btn');
        const cancelExtractionBtn = frameExtractionModal.querySelector('#cancel-extraction-btn');

        startExtractionBtn.disabled = false;
        cancelExtractionBtn.disabled = false;
        startExtractionBtn.innerHTML = '<span class="btn-icon">🚀</span>开始抽帧';

        frameExtractionModal.querySelector('.extraction-progress-section').classList.add('hidden');
        frameExtractionModal.querySelector('.extraction-settings-section').classList.remove('hidden');
    }

    // 更新任务卡片中的帧数显示
    function updateTaskFrameCount(videoPath, newFrameCount) {
        const videoItems = document.querySelectorAll('.video-item');
        videoItems.forEach(item => {
            // 查找对应的视频任务项
            const itemPath = item.querySelector('.item-name').getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            if (itemPath === videoPath) {
                // 更新统计信息中的图片总数
                const statsContainer = item.querySelector('.item-stats');
                if (statsContainer) {
                    const totalImagesElement = statsContainer.querySelector('.stat-row:first-child .stat-value');
                    if (totalImagesElement) {
                        totalImagesElement.textContent = newFrameCount;
                    }
                }

                // 更新进度条
                const annotatedImages = item.querySelector('.stat-row:nth-child(2) .stat-value')?.textContent || 0;
                const progressPercent = newFrameCount > 0 ? Math.round((annotatedImages / newFrameCount) * 100) : 0;

                const progressFill = item.querySelector('.progress-fill');
                const progressText = item.querySelector('.progress-text');
                if (progressFill) {
                    progressFill.style.width = `${progressPercent}%`;
                }
                if (progressText) {
                    progressText.textContent = `${progressPercent}%`;
                }
            }
        });
    }



    async function init() {

        optimizeTaskListRendering();

        // 添加侧边栏控制事件监听器
        toggleSidebarBtn.addEventListener('click', toggleSidebar);
        expandSidebarBtn.addEventListener('click', expandSidebar);

        initializeFrameExtraction();
        
        // 初始化分页控件
        initializePaginationControls();

        // 初始状态：显示任务级别控件，隐藏图片级别控件
        showTaskLevelControls();
        hideReviewImageLevelControls();

        // 确保主布局初始显示
        mainLayout.classList.remove('hidden');

        // 初始化用户头像和下拉菜单
        initUserAvatar();

        // 初始化退出登录功能
        initLogout();
    }

    // 新增函数：初始化退出登录功能
    function initLogout() {
        if (!logoutBtn) return;

        logoutBtn.addEventListener('click', handleLogout);
    }

    // 新增函数：处理退出登录
    function handleLogout() {
        // 隐藏下拉菜单
        hideUserDropdown();

        // const confirmLogout = confirm("确定要退出登录吗？");
        // if (!confirmLogout) {
        //     return;
        // }

        // 执行退出登录
        performLogout();
    }

    // 新增函数：执行退出登录
    function performLogout() {
        // 重置用户状态
        currentUser = null;
        userRoles = [];

        // 隐藏主界面，显示登录界面
        mainContainer.classList.add('hidden');
        loginModal.classList.remove('hidden');

        // 清空登录表单
        usernameInput.value = '';
        passwordInput.value = '';
        loginError.textContent = '';

        // 隐藏管理相关按钮
        dropdownAdminBtn.classList.add('hidden');
        datasetManagementModeBtn.classList.add('hidden');
        taskAssignmentModeBtn.classList.add('hidden');
        labelManagementModeBtn.classList.add('hidden');
        modelManagementModeBtn.classList.add('hidden');

        // 重置界面状态
        if (!adminPanel.classList.contains('hidden')) {
            adminPanel.classList.add('hidden');
        }

        // 重置工作模式到标注模式
        switchMode('annotate');

        // 显示退出成功提示
        showToast("已成功退出登录", "success");

    }

    function initUserAvatar() {
        if (!userAvatar) return;

        // 用户头像点击事件
        userAvatar.addEventListener('click', toggleUserDropdown);

        // 鼠标悬停和离开事件
        userAvatar.addEventListener('mouseenter', () => {
            clearTimeout(dropdownTimeout);
        });

        userAvatar.addEventListener('mouseleave', () => {
            dropdownTimeout = setTimeout(() => {
                if (!userDropdownMenu.matches(':hover')) {
                    hideUserDropdown();
                }
            }, 300);
        });

        // 下拉菜单悬停和离开事件
        userDropdownMenu.addEventListener('mouseenter', () => {
            clearTimeout(dropdownTimeout);
        });

        userDropdownMenu.addEventListener('mouseleave', () => {
            dropdownTimeout = setTimeout(() => {
                hideUserDropdown();
            }, 300);
        });

        // 点击页面其他区域关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!userAvatar.contains(e.target) && !userDropdownMenu.contains(e.target)) {
                hideUserDropdown();
            }
        });
    }

    // 新增函数：切换用户下拉菜单
    function toggleUserDropdown() {
        if (userDropdownMenu.classList.contains('hidden')) {
            showUserDropdown();
        } else {
            hideUserDropdown();
        }
    }

    // 新增函数：显示用户下拉菜单
    function showUserDropdown() {
        userDropdownMenu.classList.remove('hidden');
        userAvatar.style.transform = 'scale(1.05)';
        userAvatar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    }

    // 新增函数：隐藏用户下拉菜单
    function hideUserDropdown() {
        userDropdownMenu.classList.add('hidden');
        userAvatar.style.transform = 'scale(1)';
        userAvatar.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    }

    // 新增函数：初始化分页控件
    function initializePaginationControls() {
        // 创建任务列表分页控件
        taskPaginationBottom = document.createElement('div');
        taskPaginationBottom.className = 'task-pagination-container';

        // 创建审核图片分页控件 - 放在video-selection中
        reviewImagePaginationTop = document.createElement('div');
        reviewImagePaginationTop.className = 'review-image-pagination-container';
        reviewImagePaginationBottom = document.createElement('div');
        reviewImagePaginationBottom.className = 'review-image-pagination-container';

        // 插入分页控件到DOM
        const videoSelection = document.getElementById('video-selection');
        const videoList = document.getElementById('video-list');

        // 在视频列表前后插入任务分页控件
        videoSelection.appendChild(taskPaginationBottom);

        // 在视频列表前后插入审核图片分页控件
        videoSelection.insertBefore(reviewImagePaginationTop, videoList);
        videoSelection.insertBefore(reviewImagePaginationBottom, videoList.nextSibling);
    }

    function createTaskMenuButton(taskPath, taskType, taskName) {
        if (!userRoles.includes('admin')) return '';

        return `
            <div class="task-menu-container">
                <button class="task-menu-btn" data-task-path="${taskPath}" data-task-type="${taskType}" data-task-name="${taskName}">
                    ⋮
                </button>
            </div>
        `;
    }

    function setupTaskMenuListeners() {
        document.querySelectorAll('.task-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskPath = e.target.dataset.taskPath;
                const taskType = e.target.dataset.taskType;
                const taskName = e.target.dataset.taskName;

                taskManagementState.currentTask = taskPath;
                taskManagementState.currentTaskType = taskType;

                showTaskMenuModal(taskPath, taskType, taskName);
            });
        });
    }

    function showTaskMenuModal(taskPath, taskType, taskName) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        // 根据任务类型决定显示哪些选项
        const isReviewTask = taskType === 'review';

        modal.innerHTML = `
            <div class="modal-dialog task-management-modal">
                <div class="modal-header">
                    <h3>任务管理 - ${taskName}</h3>
                    <button class="close-modal-btn" title="关闭">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="task-management-options">
                        <button class="task-option-btn reassign-btn" data-action="reassign">
                            <span class="option-icon">👤</span>
                            <div class="option-content">
                                <div class="option-title">重新分配用户</div>
                                <div class="option-description">将任务分配给其他${taskType === 'annotation' ? '标注员' : '审核员'}</div>
                            </div>
                        </button>
                        
                        ${isReviewTask ? `
                        <button class="task-option-btn export-btn" data-action="export">
                            <span class="option-icon">📥</span>
                            <div class="option-content">
                                <div class="option-title">导出数据</div>
                                <div class="option-description">下载标注文件和图像</div>
                            </div>
                        </button>
                        ` : ''}
                    </div>
                    
                    ${!isReviewTask ? `
                    <div class="feature-notice">
                        <p>📝 <strong>标注任务暂不支持导出</strong></p>
                        <p class="notice-detail">标注完成后，任务将出现在审核任务列表中，届时可进行导出操作</p>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 添加事件监听器
        const closeModal = () => document.body.removeChild(modal);

        modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);

        modal.querySelector('.reassign-btn').addEventListener('click', () => {
            closeModal();
            showReassignModal(taskPath, taskType, taskName);
        });

        // 只有审核任务才添加导出按钮事件
        if (isReviewTask) {
            modal.querySelector('.export-btn').addEventListener('click', () => {
                closeModal();
                showExportModal(taskPath, taskType, taskName);
            });
        }

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // ESC键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
    }

    async function showReassignModal(taskPath, taskType, taskName) {
        // 获取可分配的用户列表
        let users = [];
        try {
            const response = await fetch(`/api/admin/task/users?user=${currentUser}&task_type=${taskType}`);
            const data = await response.json();
            if (response.ok) {
                users = data.users;
            } else {
                throw new Error(data.error || '获取用户列表失败');
            }
        } catch (error) {
            showToast(`获取用户列表失败: ${error.message}`, 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>重新分配任务</h3>
                    <button class="close-modal-btn" title="关闭">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="modal-content-text">任务: <strong>${taskName}</strong></p>
                    <div class="op-form-group">
                        <label for="user-select">选择${taskType === 'annotation' ? '标注员' : '审核员'}:</label>
                        <select id="user-select" class="form-select">
                            <option value="">请选择用户</option>
                            ${users.map(user => `<option value="${user}">${user}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="confirm-reassign-btn" class="btn-primary">确认分配</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 添加事件监听器
        const closeModal = () => document.body.removeChild(modal);

        modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);

        modal.querySelector('#confirm-reassign-btn').addEventListener('click', async () => {
            const selectedUser = modal.querySelector('#user-select').value;
            if (!selectedUser) {
                showToast('请选择用户');
                return;
            }

            try {
                const response = await fetch('/api/admin/task/reassign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user: currentUser,
                        task_path: taskPath,
                        task_type: taskType,
                        new_assignee: selectedUser
                    })
                });

                const data = await response.json();
                if (response.ok) {
                    showToast(data.message);
                    closeModal();
                    browse(); // 刷新列表
                } else {
                    throw new Error(data.error || '重新分配失败');
                }
            } catch (error) {
                showToast(`重新分配失败: ${error.message}`, 'error');
            }
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // ESC键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
    }

    function showExportModal(taskPath, taskType, taskName) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>导出任务数据</h3>
                    <button class="close-modal-btn" title="关闭">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="modal-content-text">任务: <strong>${taskName}</strong></p>
                    <div class="op-form-group">
                        <label for="export-type-select">选择导出类型:</label>
                        <select id="export-type-select" class="form-select">
                            <option value="segmentation">YOLO格式 [分割数据]</option>
                            <option value="bbox">YOLO格式 [BBox数据]</option>
                            <option value="all">YOLO格式 [分割+BBox]</option>
                            <option value="coco">COCO格式</option>
                        </select>
                    </div>
                    <div class="export-info">
                        <p>📦 导出内容:</p>
                        <ul id="export-content-list">
                            <li>所有图像文件 (.jpg/.png)</li>
                            <li>YOLO格式标注文件 (.txt)</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="confirm-export-btn" class="btn-primary">🚀 开始导出</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 根据选择更新导出内容描述
        const exportTypeSelect = modal.querySelector('#export-type-select');
        const exportContentList = modal.querySelector('#export-content-list');

        function updateExportContent() {
            const exportType = exportTypeSelect.value;
            let contentHTML = '';

            switch(exportType) {
                case 'segmentation':
                    contentHTML = `
                        <li>所有图像文件 (.jpg/.png)</li>
                        <li>YOLO格式分割标注文件 (.txt)</li>
                        <li>标签映射文件 (labels.txt)</li>
                    `;
                    break;
                case 'bbox':
                    contentHTML = `
                        <li>所有图像文件 (.jpg/.png)</li>
                        <li>YOLO格式BBox标注文件 (.txt)</li>
                        <li>标签映射文件 (labels.txt)</li>
                    `;
                    break;
                case 'all':
                    contentHTML = `
                        <li>所有图像文件 (.jpg/.png)</li>
                        <li>YOLO格式分割标注文件 (.txt)</li>
                        <li>YOLO格式BBox标注文件 (.txt)</li>
                        <li>标签映射文件 (labels.txt)</li>
                    `;
                    break;
                case 'coco':
                    contentHTML = `
                        <li>所有图像文件 (.jpg/.png)</li>
                        <li>COCO格式标注文件 (instances.json)</li>
                        <li>包含完整的COCO数据结构</li>
                    `;
                    break;
            }

            exportContentList.innerHTML = contentHTML;
        }

        // 初始化内容描述
        updateExportContent();

        // 监听选择变化
        exportTypeSelect.addEventListener('change', updateExportContent);

        // 添加事件监听器
        const closeModal = () => document.body.removeChild(modal);

        modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);

        modal.querySelector('#confirm-export-btn').addEventListener('click', async () => {
            const exportType = modal.querySelector('#export-type-select').value;

            try {
                let endpoint, payload;

                if (exportType === 'coco') {
                    // 使用COCO专用端点
                    endpoint = '/api/admin/task/export_coco';
                    payload = {
                        user: currentUser,
                        task_path: taskPath
                    };
                } else {
                    // 使用原有的YOLO端点
                    endpoint = '/api/admin/task/export';
                    payload = {
                        user: currentUser,
                        task_path: taskPath,
                        export_type: exportType
                    };
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (response.ok) {
                    showToast(data.message);
                    // 触发下载
                    const downloadLink = document.createElement('a');
                    downloadLink.href = data.download_url;

                    // 根据导出类型生成不同的文件名
                    let filename;
                    if (exportType === 'coco') {
                        filename = `${taskName}_coco_export.zip`;
                    } else {
                        filename = `${taskName}_${exportType}_export.zip`;
                    }

                    downloadLink.download = filename;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);

                    closeModal();
                } else {
                    throw new Error(data.error || '导出失败');
                }
            } catch (error) {
                showToast(`导出失败: ${error.message}`, 'error');
            }
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // ESC键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
    }
    
    // --- New Login Logic ---
    async function handleLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        if (!username || !password) {
            loginError.textContent = '用户名和密码不能为空';
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password }),
            });
            const data = await response.json();
            if (response.ok) {
                currentUser = data.username;
                // 确保userRoles始终是数组
                userRoles = Array.isArray(data.roles) ? data.roles : [];
                loginModal.classList.add('hidden');
                mainContainer.classList.remove('hidden');

                // 更新用户头像和下拉菜单信息
                updateUserAvatarInfo();

                // 管理员显示管理面板按钮
                if (Array.isArray(userRoles) && userRoles.includes('admin')) {
                    dropdownAdminBtn.classList.remove('hidden');
                }

                if (Array.isArray(userRoles) && userRoles.includes('admin')) {
                    // 管理员可以看到数据集管理按钮
                    datasetManagementModeBtn.classList.remove('hidden');
                    taskAssignmentModeBtn.classList.remove('hidden');
                    projectManagementModeBtn.classList.remove('hidden');
                    modelManagementModeBtn.classList.remove('hidden');
                }

                if (Array.isArray(userRoles) && (userRoles.includes('admin') || userRoles.includes('annotator') || userRoles.includes('reviewer'))) {
                    // 所有登录用户都可以访问标签管理（查看权限）
                    labelManagementModeBtn.classList.remove('hidden');
                }

                // 新增：登录成功后自动加载项目并设置默认项目
                await initializeUserProjects();

                // Set default mode based on roles
                if (Array.isArray(userRoles) && (userRoles.includes('annotator') || userRoles.includes('admin'))) {
                    switchMode('annotate');
                } else if (Array.isArray(userRoles) && userRoles.includes('reviewer')) {
                    switchMode('review');
                } else {
                    videoList.innerHTML = "<p>您没有被分配任何任务角色。</p>";
                }
                // Force initial browse regardless of mode switch
                browse('');
            } else {
                throw new Error(data.error || '登录失败');
            }
        } catch (error) {
            loginError.textContent = error.message;
        }
    }

    async function initializeUserProjects() {
        if (!Array.isArray(userRoles) || !userRoles.includes('admin')) {
            // 非管理员用户可能不需要项目初始化，或者可以从其他途径获取项目信息
            return;
        }

        try {
            const response = await fetch(`/api/admin/projects?user=${currentUser}`);
            const data = await response.json();

            if (response.ok) {
                projects = data.projects || {};

                // 设置默认项目（第一个项目）
                const projectNames = Object.keys(projects);
                if (projectNames.length > 0) {
                    currentProject = projectNames[0];
                } else {
                    currentProject = null;
                }
            } else {
                throw new Error(data.error || '获取项目列表失败');
            }
        } catch (error) {
            console.error('Failed to initialize user projects:', error);
            currentProject = null;
        }
    }

    // 新增函数：更新用户头像信息
    function updateUserAvatarInfo() {
        if (!currentUser) return;

        // 获取用户名的首字母（支持中文）
        const firstChar = getFirstCharacter(currentUser);

        // 更新头像显示
        const avatarElements = document.querySelectorAll('.user-avatar, .user-avatar-small');
        avatarElements.forEach(avatar => {
            avatar.textContent = firstChar;
        });

        // 更新下拉菜单中的用户信息
        if (dropdownUsername) {
            dropdownUsername.textContent = currentUser;
        }

        if (dropdownRoles) {
            dropdownRoles.textContent = userRoles.join(', ');
        }
    }

    // 新增函数：获取字符串的首个字符（支持中文）
    function getFirstCharacter(str) {
        if (!str) return '?';

        // 如果是中文字符，直接返回第一个字符
        if (/^[\u4e00-\u9fa5]/.test(str)) {
            return str.charAt(0);
        }

        // 如果是英文，返回第一个字母的大写
        return str.charAt(0).toUpperCase();
    }

    async function deleteCurrentImage() {
        if (!editingFilePath || !currentUser) {
            showToast("没有可删除的文件或未登录");
            return;
        }

        const result = await showCustomConfirm(
            '确定要删除该图片吗？',
            [],
            '删除图片'
        );

        if (!result) {
            return;
        }

        try {
            const response = await fetch('/api/delete_annotation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: currentUser, path: editingFilePath }),
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message || "删除成功!", 'success');
                // Remove from local context and move to the next image
                reviewContext.fileList.splice(reviewContext.currentIndex, 1);
                if (reviewContext.currentIndex >= reviewContext.fileList.length) {
                    reviewContext.currentIndex--;
                }
                if (reviewContext.fileList.length === 0) {
                    showListUI();
                } else {
                    loadReviewedImage();
                }
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            alert(`删除失败: ${error.message}`);
        }
    }

    // --- Event Listeners ---
    loginBtn.addEventListener('click', handleLogin);
    usernameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    deleteBtn.addEventListener('click', deleteCurrentImage);
    labelManagementModeBtn.addEventListener('click', () => switchMode('label_management'));
    datasetManagementModeBtn.addEventListener('click', () => switchMode('dataset_management'));
    taskAssignmentModeBtn.addEventListener('click', () => switchMode('task_assignment'));
    projectManagementModeBtn.addEventListener('click', () => switchMode('project_management'));
    
    // Admin Panel
    addUserBtn.addEventListener('click', () => {
        const username = newUsernameInput.value.trim();
        const roles = Array.from(newUserRolesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        window.manageUser('add_update', username, roles);
    });
    clearFormBtn.addEventListener('click', clearUserForm);
    dropdownAdminBtn.addEventListener('click', () => {
        mainLayout.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        loadUsersForAdmin();
        loadAssignmentData();
        hideUserDropdown();
    });
    backToMainBtn.addEventListener('click', () => {
        adminPanel.classList.add('hidden');
        mainLayout.classList.remove('hidden');
    });
    
    document.getElementById('add-label-btn').addEventListener('click', addLabel);
    document.getElementById('save-edit-label-btn').addEventListener('click', saveLabelEdit);
    document.getElementById('cancel-edit-label-btn').addEventListener('click', hideEditLabelForm);

    canvas.addEventListener('click', (e) => handleCanvasClick(e, 1));
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); handleCanvasClick(e, 0); });
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('resize', () => { if(displayImage.src) displayImage.onload(); });
    addObjectBtn.addEventListener('click', addNewObject);
    resetBtn.addEventListener('click', () => { initAnnotationState(); redrawAll(); renderSidebar(); showToast("已清空当前帧标注"); });
    if (autoAnnotateBtn) {
        autoAnnotateBtn.addEventListener('click', handleAutoAnnotate);
    }
    saveSuccessBtn.addEventListener('click', () => saveAnnotations());
    backToListBtn.addEventListener('click', showListUI);

    nextFrameBtn.addEventListener('click', () => {
        // 如果正在输入跳转帧号，执行跳转
        if (jumpToFrameInput) {
            handleJumpToFrame();
            return;
        }

        // 否则执行正常的下一帧逻辑
        const skip = parseInt(skipFramesInput.value, 10) || 1;
        // 更新当前任务的间隔帧数
        if (appMode === 'annotate' && currentVideoPath) {
            taskSkipFrames[currentVideoPath] = skip;
            currentTaskSkipFrames = skip;
        } else if (appMode === 'review' && reviewContext.basePath) {
            taskSkipFrames[reviewContext.basePath] = skip;
            currentTaskSkipFrames = skip;
        }
        if (appMode === 'review') {
            const currentGlobalIndex = (reviewContext.currentPage - 1) * reviewImagePaginationState.pageSize + reviewContext.currentIndex;
            const nextGlobalIndex = currentGlobalIndex + skip;

            if (nextGlobalIndex >= reviewContext.totalImages) {
                showToast("已经是最后一张了");
                return;
            }

            // 计算下一张图片在哪个分页
            const nextPage = Math.floor(nextGlobalIndex / reviewImagePaginationState.pageSize) + 1;
            const nextIndexInPage = nextGlobalIndex % reviewImagePaginationState.pageSize;

            if (nextPage !== reviewContext.currentPage) {
                // 如果下一张图片不在当前页，需要先切换到正确的分页
                reviewImagePaginationState.currentPage = nextPage;
                browse(reviewContext.basePath).then(() => {
                    // 分页加载完成后，启动审核会话
                    setTimeout(() => {
                        startReviewSession(nextIndexInPage);
                    }, 100);
                });
            } else {
                // 如果下一张图片在当前页，直接跳转
                reviewContext.currentIndex += skip;
                loadReviewedImage();
            }
        } else {
            loadFrame(currentFrameIndex + skip);
        }
    });

    prevFrameBtn.addEventListener('click', () => {
        // 如果正在输入跳转帧号，执行跳转
        if (jumpToFrameInput) {
            handleJumpToFrame();
            return;
        }

        // 使用当前任务的间隔帧数
        const skip = parseInt(skipFramesInput.value, 10) || 1;
        // 更新当前任务的间隔帧数
        if (appMode === 'annotate' && currentVideoPath) {
            taskSkipFrames[currentVideoPath] = skip;
            currentTaskSkipFrames = skip;
        } else if (appMode === 'review' && reviewContext.basePath) {
            taskSkipFrames[reviewContext.basePath] = skip;
            currentTaskSkipFrames = skip;
        }
        if (appMode === 'review') {
            const currentGlobalIndex = (reviewContext.currentPage - 1) * reviewImagePaginationState.pageSize + reviewContext.currentIndex;
            const prevGlobalIndex = currentGlobalIndex - skip;

            if (prevGlobalIndex < 0) {
                showToast("已经是第一张了");
                return;
            }

            // 计算上一张图片在哪个分页
            const prevPage = Math.floor(prevGlobalIndex / reviewImagePaginationState.pageSize) + 1;
            const prevIndexInPage = prevGlobalIndex % reviewImagePaginationState.pageSize;

            if (prevPage !== reviewContext.currentPage) {
                // 如果上一张图片不在当前页，需要先切换到正确的分页
                reviewImagePaginationState.currentPage = prevPage;
                browse(reviewContext.basePath).then(() => {
                    // 分页加载完成后，启动审核会话
                    setTimeout(() => {
                        startReviewSession(prevIndexInPage);
                    }, 100);
                });
            } else {
                // 如果上一张图片在当前页，直接跳转
                reviewContext.currentIndex -= skip;
                loadReviewedImage();
            }
        } else {
            loadFrame(currentFrameIndex - skip);
        }
    });

    // --- 为帧计数器添加点击事件 ---
    frameCounter.addEventListener('click', makeFrameCounterEditable);

    annotateModeBtn.addEventListener('click', () => switchMode('annotate'));
    reviewModeBtn.addEventListener('click', () => switchMode('review'));

    modifyBtn.addEventListener('click', () => {
        modifyBtn.classList.add('hidden');
        cancelModifyBtn.classList.remove('hidden');
        [resetBtn, saveSuccessBtn, addObjectBtn].forEach(el => el.style.display = '');
        canvas.style.pointerEvents = 'auto';
        showToast("修改模式已启用，您可以开始编辑了");
    });

    cancelModifyBtn.addEventListener('click', () => {
        cancelModifyBtn.classList.add('hidden');
        modifyBtn.classList.remove('hidden');
        [resetBtn, saveSuccessBtn, addObjectBtn].forEach(el => el.style.display = 'none');
        canvas.style.pointerEvents = 'none';

        // 重新加载当前图片，放弃所有未保存的修改
        if (appMode === 'review' && reviewContext.currentIndex >= 0) {
            loadReviewedImage();
        }

        showToast("已退出修改模式");
    });

    // 全局键盘快捷键支持
    document.addEventListener('keydown', (e) => {
        // 只在标注或审核模式下启用快捷键
        if (appMode !== 'annotate' && appMode !== 'review') return;
        
        // 如果正在输入文本（input、textarea、select），不触发快捷键
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.tagName === 'SELECT'
        )) {
            return;
        }

        // 左箭头 或 A 键 - 上一帧
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            prevFrameBtn.click();
            return;
        }

        // 右箭头 或 D 键 - 下一帧
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            nextFrameBtn.click();
            return;
        }

        // Ctrl+S 或 S 键 - 保存
        if ((e.ctrlKey && e.key === 's') || e.key === 's' || e.key === 'S') {
            e.preventDefault();
            // 检查保存按钮是否可见且可用
            if (saveSuccessBtn && saveSuccessBtn.style.display !== 'none' && !saveSuccessBtn.disabled) {
                saveSuccessBtn.click();
            }
            return;
        }

        // Ctrl+R 或 R 键 - 清空当前帧标注
        if ((e.ctrlKey && e.key === 'r') || e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            // 检查清空按钮是否可见且可用
            if (resetBtn && resetBtn.style.display !== 'none' && !resetBtn.disabled) {
                resetBtn.click();
            }
            return;
        }

        // ESC 键 - 返回任务列表
        if (e.key === 'Escape') {
            e.preventDefault();
            if (backToListBtn && !annotationUI.classList.contains('hidden')) {
                backToListBtn.click();
            }
            return;
        }
    });

    // 暴露必要的函数和变量到全局作用域，供其他模块使用
    window.switchMode = switchMode;
    window.showToast = showToast;
    // 使用getter暴露userRoles和currentUser，确保总是获取最新值
    Object.defineProperty(window, 'userRoles', {
        get: function() { return userRoles; }
    });
    Object.defineProperty(window, 'currentUser', {
        get: function() { return currentUser; }
    });

    init();
});