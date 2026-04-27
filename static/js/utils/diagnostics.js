/**
 * 诊断工具 - 用于检测标注任务界面的问题
 * 在浏览器控制台运行：runDiagnostics()
 */

window.runDiagnostics = async function() {
    console.log('==========================================');
    console.log('🔍 开始诊断标注任务界面...');
    console.log('==========================================\n');
    
    const results = {
        passed: 0,
        failed: 0,
        warnings: 0
    };
    
    // 1. 检查DOM元素
    console.log('📋 1. 检查DOM元素...');
    const domChecks = {
        'video-list': document.getElementById('video-list'),
        'video-selection': document.getElementById('video-selection'),
        'annotation-ui': document.getElementById('annotation-ui'),
        'breadcrumb': document.getElementById('breadcrumb')
    };
    
    for (const [id, element] of Object.entries(domChecks)) {
        if (element) {
            console.log(`   ✅ #${id} 存在`);
            results.passed++;
        } else {
            console.error(`   ❌ #${id} 不存在`);
            results.failed++;
        }
    }
    
    // 2. 检查任务卡片
    console.log('\n📦 2. 检查任务卡片...');
    const taskCards = document.querySelectorAll('.video-item');
    console.log(`   找到 ${taskCards.length} 个任务卡片`);
    
    if (taskCards.length > 0) {
        console.log(`   ✅ 任务卡片已渲染`);
        results.passed++;
        
        // 检查第一个卡片的结构
        const firstCard = taskCards[0];
        const cardElements = {
            '类型图标': firstCard.querySelector('.item-icon'),
            '封面或占位': firstCard.querySelector('.video-item-cover, .cover-placeholder'),
            '任务名称': firstCard.querySelector('.item-name'),
            '统计面板': firstCard.querySelector('.item-stats'),
            '进度条': firstCard.querySelector('.progress-container'),
            '分配者信息': firstCard.querySelector('.item-assignee')
        };
        
        console.log('   第一个卡片的结构：');
        for (const [name, element] of Object.entries(cardElements)) {
            if (element) {
                console.log(`      ✅ ${name}: ${element.textContent?.substring(0, 30) || '(存在)'}`);
                results.passed++;
            } else {
                console.warn(`      ⚠️ ${name}: 缺失`);
                results.warnings++;
            }
        }
    } else {
        console.error(`   ❌ 没有找到任务卡片`);
        results.failed++;
    }
    
    // 3. 检查CSS样式
    console.log('\n🎨 3. 检查CSS样式...');
    if (taskCards.length > 0) {
        const firstCard = taskCards[0];
        const styles = window.getComputedStyle(firstCard);
        const styleChecks = {
            'border-radius': styles.borderRadius,
            'padding': styles.padding,
            'cursor': styles.cursor,
            'background': styles.backgroundColor
        };
        
        for (const [prop, value] of Object.entries(styleChecks)) {
            console.log(`   ${prop}: ${value}`);
        }
        
        if (styles.borderRadius !== '0px') {
            console.log(`   ✅ CSS样式已应用`);
            results.passed++;
        } else {
            console.error(`   ❌ CSS样式未正确应用`);
            results.failed++;
        }
    }
    
    // 4. 检查分页控件
    console.log('\n📄 4. 检查分页控件...');
    const paginationTop = document.getElementById('task-pagination-top');
    const paginationBottom = document.getElementById('task-pagination-bottom');
    
    if (paginationTop) {
        console.log(`   ✅ 顶部分页: ${paginationTop.innerHTML ? '已渲染' : '空'}`);
        results.passed++;
    } else {
        console.error(`   ❌ 顶部分页不存在`);
        results.failed++;
    }
    
    if (paginationBottom) {
        console.log(`   ✅ 底部分页: ${paginationBottom.innerHTML ? '已渲染' : '空'}`);
        results.passed++;
    } else {
        console.error(`   ❌ 底部分页不存在`);
        results.failed++;
    }
    
    // 5. 检查筛选控件
    console.log('\n🔍 5. 检查筛选控件...');
    const filterControls = document.getElementById('filter-controls-container');
    
    if (filterControls) {
        console.log(`   ✅ 筛选控件: 已渲染`);
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            console.log(`   ✅ 状态筛选: ${statusFilter.options.length} 个选项`);
            results.passed++;
        }
    } else {
        console.warn(`   ⚠️ 筛选控件未渲染（可能是空任务列表）`);
        results.warnings++;
    }
    
    // 6. 检查API数据
    console.log('\n🌐 6. 检查API数据...');
    try {
        const user = localStorage.getItem('currentUser');
        if (!user) {
            console.error(`   ❌ 未登录`);
            results.failed++;
        } else {
            console.log(`   ✅ 当前用户: ${user}`);
            results.passed++;
            
            const response = await fetch(`/api/browse?user=${user}&page=1&page_size=20&status=all`);
            const data = await response.json();
            
            if (response.ok) {
                console.log(`   ✅ API响应正常`);
                console.log(`   任务总数: ${data.total_count || 0}`);
                console.log(`   目录数量: ${data.directories?.length || 0}`);
                results.passed++;
                
                if (data.directories && data.directories.length > 0) {
                    console.log('   第一个任务的数据:');
                    const task = data.directories[0];
                    console.log(`      名称: ${task.name}`);
                    console.log(`      类型: ${task.type}`);
                    console.log(`      图片数: ${task.totalImages || task.total_images || task.total_frames || '未知'}`);
                    console.log(`      已标注: ${task.annotatedImages || task.annotated_images || '未知'}`);
                    console.log(`      封面: ${task.coverUrl || task.cover_url || task.thumbnail || '无'}`);
                    console.log(`      标注员: ${task.assignee || '未分配'}`);
                    console.log(`      项目: ${task.project || '无'}`);
                } else {
                    console.warn(`   ⚠️ 没有任务数据`);
                    results.warnings++;
                }
            } else {
                console.error(`   ❌ API错误: ${data.error || '未知错误'}`);
                results.failed++;
            }
        }
    } catch (error) {
        console.error(`   ❌ API请求失败: ${error.message}`);
        results.failed++;
    }
    
    // 7. 检查JavaScript模块
    console.log('\n📜 7. 检查JavaScript模块...');
    const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
    console.log(`   找到 ${scripts.length} 个ES模块`);
    
    // 8. 检查CSS文件
    console.log('\n💅 8. 检查CSS文件...');
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    console.log(`   找到 ${stylesheets.length} 个样式表`);
    stylesheets.forEach(link => {
        console.log(`      ${link.href.split('/').pop()}`);
    });
    
    // 总结
    console.log('\n==========================================');
    console.log('📊 诊断结果汇总:');
    console.log(`   ✅ 通过: ${results.passed}`);
    console.log(`   ⚠️ 警告: ${results.warnings}`);
    console.log(`   ❌ 失败: ${results.failed}`);
    console.log('==========================================\n');
    
    if (results.failed === 0 && results.warnings === 0) {
        console.log('🎉 所有检查都通过了！界面应该正常显示。');
    } else if (results.failed === 0) {
        console.log('✅ 主要功能正常，有一些警告可忽略。');
    } else {
        console.log('❗ 发现问题，请根据上面的错误信息排查。');
        console.log('\n建议操作：');
        if (!document.getElementById('video-list')) {
            console.log('   1. 检查 templates/index.html 是否包含 id="video-list" 的元素');
        }
        if (taskCards.length === 0) {
            console.log('   2. 检查后端API是否正常返回任务数据');
            console.log('   3. 检查浏览器控制台是否有JavaScript错误');
        }
        console.log('   4. 尝试硬刷新浏览器 (Ctrl+Shift+R)');
        console.log('   5. 清除浏览器缓存后重新加载');
    }
    
    return results;
};

// 自动运行诊断（可选）
console.log('💡 提示：在控制台运行 runDiagnostics() 来诊断问题');
