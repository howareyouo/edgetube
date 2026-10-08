// ==================== 在线优选相关函数 ====================
// 打开在线优选全屏模块
function openOnlineOptimizeModal() {
    const modal = document.getElementById('onlineOptimizeModal');
    const frame = document.getElementById('onlineOptimizeFrame');
    if (!modal || !frame) return;
    if (!frame.dataset.loaded) {
        const template = document.getElementById('onlineOptimizeTemplate');
        if (!template) {
            showToast('在线优选模块加载失败', 'error');
            return;
        }
        frame.srcdoc = template.innerHTML.trim();
        frame.dataset.loaded = 'true';
    }
    if (!document.body.dataset.onlineOptimizePreviousOverflow) {
        document.body.dataset.onlineOptimizePreviousOverflow = document.body.style.overflow || 'auto';
    }
    document.body.style.overflow = 'hidden';
    modal.classList.add('show');
}
// 关闭在线优选全屏模块
function closeOnlineOptimizeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('onlineOptimizeModal');
    if (modal) modal.classList.remove('show');
    if (document.body.dataset.onlineOptimizePreviousOverflow !== undefined) {
        const previousOverflow = document.body.dataset.onlineOptimizePreviousOverflow;
        document.body.style.overflow = previousOverflow === 'auto' ? '' : previousOverflow;
        delete document.body.dataset.onlineOptimizePreviousOverflow;
    }
}
// ==================== 开始优选 - 方式选择 ====================
const CF_TOOLS_RAW_URL = 'https://raw.githubusercontent.com/cmliu/cmliu/refs/heads/main/json/best-cf-tools.json';
let localOptimizeProjects = [];
let localUiFilter = 'all';
// GitHub Star 图标（octicon star）
const STAR_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>';
// 打开"开始优选"方式选择弹窗
function openOptimizeStartModal() {
    const modal = document.getElementById('optimizeStartModal');
    if (!modal) return;
    modal.classList.add('show');
}
// 关闭"开始优选"方式选择弹窗
function closeOptimizeStartModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('optimizeStartModal');
    if (modal) modal.classList.remove('show');
}
// 选择"在线优选"：关闭选择弹窗并打开在线优选全屏模块
function chooseOnlineOptimize() {
    closeOptimizeStartModal();
    openOnlineOptimizeModal();
}
// 选择"本地优选"：关闭选择弹窗并打开本地优选工具目录弹窗
function chooseLocalOptimize() {
    closeOptimizeStartModal();
    openLocalOptimizeModal();
}
// 选择"在线优选域名"：先关闭选择弹窗，再新标签页打开官方在线优选域名站点
function chooseOnlineDomainOptimize() {
    closeOptimizeStartModal();
    window.open('https://bestcf.fxxk.dedyn.io/', '_blank', 'noopener');
}
// ==================== 本地优选 - CF 优选工具目录 ====================
// 打开本地优选工具目录弹窗（请求RAW拉取工具清单）
async function openLocalOptimizeModal() {
    const modal = document.getElementById('localOptimizeModal');
    const list = document.getElementById('localOptimizeToolList');
    if (!modal || !list) return;
    modal.classList.add('show');
    // 已加载过则直接显示，避免重复请求
    if (list.dataset.loaded === 'true') return;
    list.innerHTML = '<div class="local-tools-loading">⏳ 正在拉取 CF 优选工具目录…</div>';
    try {
        const jsonText = await fetchWithAutoMirror(CF_TOOLS_RAW_URL + '?_t=' + Date.now(), 'CF优选工具目录');
        const data = JSON.parse(jsonText);
        const projects = Array.isArray(data && data.projects) ? data.projects : [];
        renderLocalOptimizeTools(list, projects);
        list.dataset.loaded = 'true';
    } catch (error) {
        console.error('[请求RAW] CF优选工具目录拉取失败:', error);
        list.innerHTML = `
			<div class="local-tools-error">
				❌ 工具目录拉取失败，请检查网络后重试<br>
				<button type="button" class="local-tools-retry" onclick="openLocalOptimizeModal()">重试</button>
			</div>`;
    }
}
// 渲染本地优选工具卡片
function renderLocalOptimizeTools(list, projects) {
    localOptimizeProjects = projects;
    // 同步类型筛选按钮高亮态，保证弹窗重开时高亮一致
    const filterButtons = document.querySelectorAll('#localUiFilter .local-ui-filter-btn');
    filterButtons.forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.ui === localUiFilter);
    });
    if (!projects.length) {
        list.innerHTML = '<div class="local-tools-error">😕 暂无可用的本地优选工具</div>';
        return;
    }
    const uiLabels = {
        webui: {
            emoji: '🌐',
            label: '网页界面'
        },
        gui: {
            emoji: '🖥️',
            label: '图形界面'
        },
        cli: {
            emoji: '⌨️',
            label: '命令行CLI'
        }
    };
    // 按 stars 数由高到低排序，携带原始索引（openLocalToolGitHub 依赖 localOptimizeProjects 索引）
    const ranked = projects.map((project, index) => ({
        project,
        index
    })).sort((a, b) => (Number(b.project.stars) || 0) - (Number(a.project.stars) || 0));
    // 按类型筛选
    const filtered = ranked.filter(({
        project
    }) => {
        if (localUiFilter === 'all') return true;
        const uiValues = Array.isArray(project.ui) ? project.ui.map(u => String(u).trim().toLowerCase()) : [];
        return uiValues.includes(localUiFilter);
    });
    if (!filtered.length) {
        const currentLabel = (uiLabels[localUiFilter] && uiLabels[localUiFilter].label) || '该';
        list.innerHTML = `<div class="local-tools-error">😕 没有「${currentLabel}」类型的工具</div>`;
        return;
    }
    list.innerHTML = filtered.map(({
        project,
        index
    }, i) => {
        const name = escapeHtml(String(project.name || '未命名工具'));
        const author = project.author ? escapeHtml(String(project.author)) : '';
        const description = project.description ? escapeHtml(String(project.description)) : '';
        const platforms = Array.isArray(project.platforms) ? project.platforms : [];
        const platformBadges = platforms.map(p => `<span class="local-tool-platform">${escapeHtml(String(p))}</span>`).join('');
        const uiList = Array.isArray(project.ui) ? project.ui : [];
        const uiBadges = uiList.filter(u => u !== null && u !== undefined && String(u).trim() !== '').map(u => {
            const key = String(u).trim().toLowerCase();
            const meta = uiLabels[key];
            if (!meta) {
                return `<span class="local-tool-ui">${escapeHtml(String(u))}</span>`;
            }
            return `<span class="local-tool-ui local-tool-ui-${key}">${meta.emoji} ${meta.label}</span>`;
        }).join('');
        // GitHub Stars 徽章（无有效数据时不显示）
        const starsNum = Number(project.stars);
        const starsBadge = Number.isFinite(starsNum) && starsNum > 0 ? `<span class="local-tool-stars" title="GitHub Stars">${STAR_SVG}${starsNum.toLocaleString('en-US')}</span>` : '';
        return `
			<div class="local-tool-card" style="animation-delay: ${Math.min(i, 8) * 40}ms">
				<div class="local-tool-head">
					<span class="local-tool-name">${name}</span>
					${author ? `<span class="local-tool-author">@${author}</span>` : ''}
					${starsBadge}
				</div>
				<div class="local-tool-desc">${description}</div>
				${(uiBadges || platformBadges) ? `<div class="local-tool-platforms">${uiBadges}${platformBadges}</div>` : ''}
				<div class="local-tool-actions">
					<button type="button" class="local-tool-github" onclick="openLocalToolGitHub(${index})">
						🔗 前往 GitHub
					</button>
				</div>
			</div>`;
    }).join('');
}
// 设置本地优选工具类型筛选（白名单：all/webui/gui/cli）
function setLocalUiFilter(type) {
    if (type !== 'all' && type !== 'webui' && type !== 'gui' && type !== 'cli') return;
    localUiFilter = type;
    const filterButtons = document.querySelectorAll('#localUiFilter .local-ui-filter-btn');
    filterButtons.forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.ui === localUiFilter);
    });
    const list = document.getElementById('localOptimizeToolList');
    if (list) renderLocalOptimizeTools(list, localOptimizeProjects);
}
// 关闭本地优选工具目录弹窗
function closeLocalOptimizeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('localOptimizeModal');
    if (modal) modal.classList.remove('show');
}
// 在新窗口打开所选工具的 GitHub 仓库
function openLocalToolGitHub(index) {
    const project = localOptimizeProjects[index];
    if (!project || !project.url) {
        showToast('未找到该工具的 GitHub 地址', 'error');
        return;
    }
    window.open(project.url, '_blank', 'noopener');
}

function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function appendOnlineOptimizeSelections(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
        showToast('请先勾选需要保存的优选结果', 'warning');
        return false;
    }
    const textarea = document.getElementById('customIPs');
    if (!textarea) {
        showToast('未找到自定义优选地址输入框', 'error');
        return false;
    }
    const newLines = lines.map(line => String(line || '').trim()).filter(Boolean);
    if (!newLines.length) {
        showToast('没有可保存的优选结果', 'warning');
        return false;
    }
    const currentValue = textarea.value.trim();
    textarea.value = currentValue ? `${currentValue}\n${newLines.join('\n')}` : newLines.join('\n');
    refreshLineEditor(textarea);
    markModified('sub');
    showToast(`✅ 已追加 ${newLines.length} 条优选结果到自定义优选地址`, 'success');
    closeOnlineOptimizeModal();
    return true;
}
// 从在线优选警告弹窗切换到本地优选（关闭在线全屏并打开本地优选工具目录）
function switchToLocalOptimizeFromOnline() {
    closeOnlineOptimizeModal();
    openLocalOptimizeModal();
}
window.addEventListener('message', (event) => {
    const frame = document.getElementById('onlineOptimizeFrame');
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (data.type === 'bestcf-save-results') {
        appendOnlineOptimizeSelections(data.lines);
    } else if (data.type === 'bestcf-close') {
        closeOnlineOptimizeModal();
    } else if (data.type === 'bestcf-force-reload') {
        window.location.reload();
    } else if (data.type === 'bestcf-open-local-optimize') {
        switchToLocalOptimizeFromOnline();
    }
});
// ==================== API优选相关函数 ====================
// 打开API优选模态框
function openAPIOptimizeModal() {
    document.getElementById('apiOptimizeModal').classList.add('show');
    // 重置表单
    document.getElementById('apiOptimizeURL').value = '';
    document.getElementById('apiOptimizePort').value = '443';
    document.getElementById('apiOptimizeResults').value = '';
    document.getElementById('useProxyIPCheckbox').checked = false;
    document.getElementById('btnAppendAPI').disabled = true;
    document.getElementById('btnAppendResults').disabled = true;
    // 初始化line-editor
    initLineEditor('apiOptimizeResults');
}
// 关闭API优选模态框
function closeAPIOptimizeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('apiOptimizeModal').classList.remove('show');
}
// 验证和规范化端口号
function validateAndNormalizePort(port) {
    let num = parseInt(port, 10);
    if (isNaN(num)) return '443';
    if (num < 1) return '1';
    if (num > 65535) return '65535';
    return num.toString();
}
// 验证API URL格式
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}
// 将GitHub链接转换为raw格式
function convertGitHubURLToRaw(url) {
    if (!url.includes('github.com')) {
        return url;
    }
    // 将 https://github.com/user/repo/blob/branch/path 转换为 https://raw.githubusercontent.com/user/repo/refs/heads/branch/path
    if (url.includes('/blob/')) {
        // 提取分支和文件路径
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)/);
        if (match) {
            const [, user, repo, branch, filePath] = match;
            return `https://raw.githubusercontent.com/${user}/${repo}/refs/heads/${branch}/${filePath}`;
        }
    }
    // 将 https://github.com/user/repo/tree/branch/path 转换为 https://raw.githubusercontent.com/user/repo/refs/heads/branch/path
    if (url.includes('/tree/')) {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.*)/);
        if (match) {
            const [, user, repo, branch, filePath] = match;
            return `https://raw.githubusercontent.com/${user}/${repo}/refs/heads/${branch}/${filePath}`;
        }
    }
    return url;
}
// 实时自动转换GitHub链接
function autoConvertGitHubURL() {
    const urlInput = document.getElementById('apiOptimizeURL');
    const url = urlInput.value.trim();
    if (url.includes('github.com/')) {
        const convertedURL = convertGitHubURLToRaw(url);
        if (convertedURL !== url) {
            urlInput.value = convertedURL;
        }
    }
}
// 自动检测URL中的port参数并填充到默认端口字段
function autoDetectPortFromURL() {
    const urlInput = document.getElementById('apiOptimizeURL').value.trim();
    const portInput = document.getElementById('apiOptimizePort');
    if (!urlInput) return;
    try {
        const urlObj = new URL(urlInput);
        const portParam = urlObj.searchParams.get('port');
        if (portParam) {
            // 检测到port参数，验证并规范化
            const normalizedPort = validateAndNormalizePort(portParam);
            portInput.value = normalizedPort;
        }
    } catch (error) {
        // URL格式错误，忽略
        console.log('URL格式检查失败:', error);
    }
}
// 可用性验证
async function verifyAPIOptimize() {
    let urlInput = document.getElementById('apiOptimizeURL').value.trim();
    const portInput = document.getElementById('apiOptimizePort').value.trim();
    if (!urlInput) {
        alert('请输入API URL');
        return;
    }
    // 自动转换GitHub链接为raw格式
    const convertedURL = convertGitHubURLToRaw(urlInput);
    if (convertedURL !== urlInput) {
        document.getElementById('apiOptimizeURL').value = convertedURL;
        urlInput = convertedURL;
        showToast('✅ GitHub链接已自动转换为raw格式', 'info');
    }
    if (!isValidURL(urlInput)) {
        alert('请输入有效的URL格式');
        return;
    }
    // 检测和提取URL中的port参数
    let detectedPort = null;
    let cleanURL = urlInput;
    try {
        const urlObj = new URL(urlInput);
        const portParam = urlObj.searchParams.get('port');
        if (portParam) {
            // 识别到port参数
            detectedPort = validateAndNormalizePort(portParam);
            // 移除port参数
            urlObj.searchParams.delete('port');
            cleanURL = urlObj.toString();
            // 更新URL输入框（移除port参数）
            document.getElementById('apiOptimizeURL').value = cleanURL;
            // 更新端口输入框
            document.getElementById('apiOptimizePort').value = detectedPort;
            showToast(`✅ 已自动识别URL中的端口号: ${detectedPort}，并已移除port参数`, 'success');
        }
    } catch (error) {
        console.log('URL port参数提取失败:', error);
    }
    // 规范化端口（如果没有从URL中检测到端口，则使用输入框中的值）
    const normalizedPort = detectedPort || validateAndNormalizePort(portInput);
    document.getElementById('apiOptimizePort').value = normalizedPort;
    // 使用清理后的URL构建完整URL
    const urlObj = new URL(cleanURL);
    urlObj.searchParams.set('port', normalizedPort);
    // 如果勾选了"将优选作为PROXYIP"，添加proxyip参数
    const useProxyIP = document.getElementById('useProxyIPCheckbox').checked;
    if (useProxyIP) {
        urlObj.searchParams.set('proxyip', 'true');
    }
    const completeURL = urlObj.toString();
    // URL编码
    const encodedURL = encodeURIComponent(completeURL);
    // 构建请求URL
    const requestURL = `/admin/getADDAPI?url=${encodedURL}`;
    try {
        const btn = document.getElementById('btnVerifyAPI');
        btn.disabled = true;
        btn.textContent = '验证中...';
        const response = await fetch(requestURL);
        const data = await response.json();
        if (data.success && data.data && Array.isArray(data.data)) {
            // 接口可用
            const results = data.data.join('\n');
            document.getElementById('apiOptimizeResults').value = results;
            // 刷新line-editor行数
            const resultsTA = document.getElementById('apiOptimizeResults');
            if (resultsTA._refreshLineEditor) {
                resultsTA._refreshLineEditor();
            }
            document.getElementById('btnAppendAPI').disabled = false;
            document.getElementById('btnAppendResults').disabled = false;
            showToast('✅ API接口验证成功！', 'success');
        } else {
            // 接口不可用
            document.getElementById('apiOptimizeResults').value = '❌ 接口不可用，请检查URL和端口是否正确';
            // 刷新line-editor行数
            const resultsTA = document.getElementById('apiOptimizeResults');
            if (resultsTA._refreshLineEditor) {
                resultsTA._refreshLineEditor();
            }
            document.getElementById('btnAppendAPI').disabled = true;
            document.getElementById('btnAppendResults').disabled = true;
            showToast('❌ API接口验证失败，请检查接口', 'error');
        }
    } catch (error) {
        console.error('API验证错误:', error);
        document.getElementById('apiOptimizeResults').value = `❌ 验证出错: ${error.message}`;
        // 刷新line-editor行数
        const resultsTA = document.getElementById('apiOptimizeResults');
        if (resultsTA._refreshLineEditor) {
            resultsTA._refreshLineEditor();
        }
        document.getElementById('btnAppendAPI').disabled = true;
        document.getElementById('btnAppendResults').disabled = true;
        showToast('❌ 验证出错，请稍后重试', 'error');
    } finally {
        const btn = document.getElementById('btnVerifyAPI');
        btn.disabled = false;
        btn.textContent = '可用性验证';
    }
}
// 追加API到自定义优选地址
function appendAPIToCustom() {
    let urlInput = document.getElementById('apiOptimizeURL').value.trim();
    const portInput = document.getElementById('apiOptimizePort').value.trim();
    const useProxyIP = document.getElementById('useProxyIPCheckbox').checked;
    if (!urlInput) {
        alert('请输入API URL');
        return;
    }
    // 移除URL中可能存在的port参数和proxyip参数
    try {
        const urlObj = new URL(urlInput);
        urlObj.searchParams.delete('port');
        urlObj.searchParams.delete('proxyip');
        urlInput = urlObj.toString();
    } catch (error) {
        console.log('URL处理失败:', error);
    }
    // 构建完整URL
    const urlObj = new URL(urlInput);
    urlObj.searchParams.set('port', portInput);
    // 如果勾选了"将优选作为PROXYIP"，添加proxyip参数
    if (useProxyIP) {
        urlObj.searchParams.set('proxyip', 'true');
    }
    const completeURL = urlObj.toString();
    const customIPsTextarea = document.getElementById('customIPs');
    const currentValue = customIPsTextarea.value.trim();
    // 追加到文本框
    if (currentValue) {
        customIPsTextarea.value = currentValue + '\n' + completeURL;
    } else {
        customIPsTextarea.value = completeURL;
    }
    // 刷新line-editor行数
    if (customIPsTextarea._refreshLineEditor) {
        customIPsTextarea._refreshLineEditor();
    }
    // 标记为已修改
    markModified('sub');
    showToast('✅ API URL已追加到自定义优选地址', 'success');
    closeAPIOptimizeModal();
}
// 追加结果到自定义优选地址
function appendResultsToCustom() {
    const resultsTextarea = document.getElementById('apiOptimizeResults');
    const results = resultsTextarea.value.trim();
    if (!results || results.startsWith('❌')) {
        alert('请先进行可用性验证且验证通过');
        return;
    }
    const customIPsTextarea = document.getElementById('customIPs');
    const currentValue = customIPsTextarea.value.trim();
    // 追加到文本框
    if (currentValue) {
        customIPsTextarea.value = currentValue + '\n' + results;
    } else {
        customIPsTextarea.value = results;
    }
    // 刷新line-editor行数
    if (customIPsTextarea._refreshLineEditor) {
        customIPsTextarea._refreshLineEditor();
    }
    // 标记为已修改
    markModified('sub');
    showToast('✅ API结果已追加到自定义优选地址', 'success');
    closeAPIOptimizeModal();
}
// 智能镜像拉取函数 - 原始地址与镜像并发抢占，谁先成功就用谁
async function fetchWithAutoMirror(originalUrl, description = '资源') {
    const rawGithubPrefix = 'https://raw.githubusercontent.com';
    const mirrorDomains = ['https://github.090227.xyz/raw.githubusercontent.com', 'https://github.cmliussss.com/raw.githubusercontent.com', 'https://github.cmliussss.net/raw.githubusercontent.com', ];
    const candidates = [{
        url: originalUrl,
        label: '原始链接'
    }];
    if (originalUrl.startsWith(rawGithubPrefix)) {
        mirrorDomains.forEach((mirrorDomain, index) => {
            candidates.push({
                url: originalUrl.replace(rawGithubPrefix, mirrorDomain),
                label: `备用镜像 ${index + 1}`
            });
        });
    }
    console.log(`[请求RAW] 进度: 并发拉取 ${description}，候选源数量=${candidates.length}`);
    const controllers = candidates.map(() => new AbortController());
    let hasWinner = false;
    const requests = candidates.map((candidate, index) => (async () => {
        try {
            console.log(`[请求RAW] 进度: 发起${candidate.label}请求 URL=${candidate.url}`);
            const response = await fetch(candidate.url, {
                signal: controllers[index].signal
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            return { ...candidate,
                index,
                text
            };
        } catch (error) {
            if (!(hasWinner && error.name === 'AbortError')) {
                console.warn(`[请求RAW] ❌ ${candidate.label}拉取失败: ${error.message}`);
            }
            throw error;
        }
    })());
    try {
        const winner = await Promise.any(requests);
        hasWinner = true;
        controllers.forEach((controller, index) => {
            if (index !== winner.index) {
                controller.abort();
            }
        });
        console.log(`[请求RAW] 成功: 从${winner.label}拉取 ${description}，长度=${winner.text.length} 字符`);
        return winner.text;
    } catch (error) {
        const mirrorCount = Math.max(candidates.length - 1, 0);
        throw new Error(mirrorCount > 0 ? `${description}拉取失败，已尝试原始链接和全部${mirrorCount}个备用镜像` : `${description}拉取失败，原始链接不可用`);
    }
}
// 初始化
initializeTheme();
window.addEventListener('DOMContentLoaded', () => {
    initializePerformanceMode().catch(err => console.warn('Performance mode initialization failed:', err));
    loadConfig();
    initUserMode();
    initLineEditor('customIPs');
    initNodeUUIDEasterEgg();
    initVersionCopyEasterEgg();
    // 独立预加载 SubConfig 数据，不阻塞主流程
    loadSubConfigData().catch(err => console.error('SubConfig预加载失败:', err));
});
// 启动倒计时更新
setInterval(updateCountdown, 1000);
updateCountdown(); // 立即执行一次
// ==================== 网络信息相关函数 ====================
// 设置状态指示器
function setStatus(id, status) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.className = 'status-indicator status-' + status;
    }
}
// 网络信息默认脱敏显示（点击卡片可显示真实值）
let networkPrivacyVisible = false;
const NETWORK_FIELD_CONFIGS = [{
    id: 'ipip-ip',
    type: 'ip'
}, {
    id: 'overseas-ip',
    type: 'ip'
}, {
    id: 'cf-ip',
    type: 'ip'
}, {
    id: 'twitter-ip',
    type: 'ip'
}, {
    id: 'ipip-country',
    type: 'location'
}, {
    id: 'overseas-country',
    type: 'location'
}, {
    id: 'cf-country',
    type: 'location'
}, {
    id: 'twitter-country',
    type: 'location'
}];
const NETWORK_API_TIMEOUT_MS = 6180.3;
const NETWORK_BACKGROUND_START_DELAY_MS = 1200;
const NETWORK_BACKGROUND_IDLE_TIMEOUT_MS = 2500;
const NETWORK_BACKGROUND_TASK_GAP_MS = 420;
const NETWORK_BACKGROUND_TASK_TIMEOUT_MS = (NETWORK_API_TIMEOUT_MS * 3) + 1200;
let networkInfoScheduled = false;
let networkInfoLoadPromise = null;

function waitForPageComplete() {
    if (document.readyState === 'complete') {
        return Promise.resolve();
    }
    return new Promise(resolve => {
        window.addEventListener('load', resolve, {
            once: true
        });
    });
}

function waitForBrowserIdle(timeoutMs = NETWORK_BACKGROUND_IDLE_TIMEOUT_MS) {
    return new Promise(resolve => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => resolve(), {
                timeout: timeoutMs
            });
            return;
        }
        setTimeout(resolve, 0);
    });
}

function waitForDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function scheduleNetworkInfoLoad(options = {}) {
    const {
        delayMs = NETWORK_BACKGROUND_START_DELAY_MS
    } = options;
    if (networkInfoLoaded || networkInfoLoadPromise || networkInfoScheduled) {
        return;
    }
    networkInfoScheduled = true;
    (async () => {
        await waitForPageComplete();
        if (delayMs > 0) {
            await waitForDelay(delayMs);
        }
        await waitForBrowserIdle();
        await loadNetworkInfo();
    })().catch(error => {
        console.warn('[网络信息] 后台加载调度失败:', error);
    }).finally(() => {
        networkInfoScheduled = false;
    });
}
async function runNetworkInfoBackgroundTask(task, index) {
    if (index > 0) {
        await waitForDelay(NETWORK_BACKGROUND_TASK_GAP_MS);
    }
    await waitForBrowserIdle();
    let watchdogId = null;
    const watchdog = new Promise((_, reject) => {
        watchdogId = setTimeout(() => {
            reject(new Error(`${task.name} background timeout`));
        }, NETWORK_BACKGROUND_TASK_TIMEOUT_MS);
    });
    try {
        await Promise.race([
            Promise.resolve().then(task.run),
            watchdog
        ]);
    } catch (error) {
        console.warn(`[网络信息] ${task.name} 后台任务异常:`, error);
    } finally {
        if (watchdogId) {
            clearTimeout(watchdogId);
        }
    }
}
async function fetchWithTimeout(url, options = {}, timeoutMs = NETWORK_API_TIMEOUT_MS) {
    const {
        signal: externalSignal,
        ...fetchOptions
    } = options || {};
    const timeoutController = new AbortController();
    let timeoutReached = false;
    let externalAbortHandler = null;
    if (externalSignal) {
        if (externalSignal.aborted) {
            timeoutController.abort();
        } else {
            externalAbortHandler = () => timeoutController.abort();
            externalSignal.addEventListener('abort', externalAbortHandler, {
                once: true
            });
        }
    }
    const timeoutId = setTimeout(() => {
        timeoutReached = true;
        timeoutController.abort();
    }, timeoutMs);
    try {
        return await fetch(url, { ...fetchOptions,
            signal: timeoutController.signal
        });
    } catch (error) {
        if (timeoutReached) {
            throw new Error(`request timeout after ${timeoutMs}ms: ${url}`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        if (externalSignal && externalAbortHandler) {
            externalSignal.removeEventListener('abort', externalAbortHandler);
        }
    }
}

function maskNetworkIpValue(ip) {
    const value = String(ip || '').trim();
    if (!value || value === '未知') return value;
    if (value.includes('.') && !value.includes(':')) {
        const parts = value.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${'*'.repeat(parts[1].length)}.${'*'.repeat(parts[2].length)}.${'*'.repeat(parts[3].length)}`;
        }
    }
    if (value.includes(':')) {
        const hasBrackets = value.startsWith('[') && value.endsWith(']');
        const pureValue = hasBrackets ? value.slice(1, -1) : value;
        const [baseIp, zoneSuffix = ''] = pureValue.split('%');
        const firstColonIndex = baseIp.indexOf(':');
        if (firstColonIndex === -1) {
            return value;
        }
        const firstSegment = baseIp.slice(0, firstColonIndex);
        const remain = baseIp.slice(firstColonIndex + 1);
        const maskedRemain = remain.replace(/[^:]/g, '*');
        const maskedBase = `${firstSegment}:${maskedRemain}`;
        const maskedWithZone = zoneSuffix ? `${maskedBase}%${zoneSuffix}` : maskedBase;
        return hasBrackets ? `[${maskedWithZone}]` : maskedWithZone;
    }
    return value.length <= 2 ? '*'.repeat(Math.max(2, value.length)) : `${value.slice(0, 2)}${'*'.repeat(value.length - 2)}`;
}

function maskNetworkLocationValue(location) {
    const value = String(location || '').trim();
    if (!value || value === '未知') return value;
    const tokens = value.split(/\s+/).filter(Boolean);
    if (!tokens.length) return value;
    return tokens.map((token, index) => {
        if (index === 0 && /^[a-zA-Z]{2}$/.test(token)) {
            return token.toUpperCase();
        }
        return '*'.repeat(Math.max(2, token.length));
    }).join(' ');
}

function stopNetworkFieldAnimation(fieldElement) {
    if (!fieldElement) return;
    if (fieldElement._privacyAnimFrame) {
        cancelAnimationFrame(fieldElement._privacyAnimFrame);
        fieldElement._privacyAnimFrame = null;
    }
}

function animateNetworkFieldDisplay(fieldElement, targetText, durationMs = 160) { //逐字符替换速度
    if (!fieldElement) return;
    stopNetworkFieldAnimation(fieldElement);
    const fromText = String(fieldElement.textContent || '');
    const toText = String(targetText || '');
    if (fromText === toText) {
        fieldElement.textContent = toText;
        return;
    }
    const maxLen = Math.max(fromText.length, toText.length);
    const fromChars = fromText.padEnd(maxLen, ' ').split('');
    const toChars = toText.padEnd(maxLen, ' ').split('');
    const diffIndexes = [];
    for (let i = 0; i < maxLen; i++) {
        if (fromChars[i] !== toChars[i]) diffIndexes.push(i);
    }
    if (!diffIndexes.length) {
        fieldElement.textContent = toText;
        return;
    }
    const startTime = performance.now();
    const frame = now => {
        const progress = Math.min((now - startTime) / durationMs, 1);
        const changedCount = Math.floor(progress * diffIndexes.length);
        const currentChars = fromChars.slice();
        for (let i = 0; i < changedCount; i++) {
            const idx = diffIndexes[i];
            currentChars[idx] = toChars[idx];
        }
        fieldElement.textContent = currentChars.join('').trimEnd();
        if (progress < 1) {
            fieldElement._privacyAnimFrame = requestAnimationFrame(frame);
        } else {
            fieldElement._privacyAnimFrame = null;
            fieldElement.textContent = toText;
        }
    };
    fieldElement._privacyAnimFrame = requestAnimationFrame(frame);
}

function renderNetworkFieldDisplay(fieldElement, options = {}) {
    if (!fieldElement) return;
    if (fieldElement.dataset.displayState !== 'ready') return;
    const {
        animate = false
    } = options;
    const rawValue = String(fieldElement.dataset.rawValue || '').trim();
    const maskType = fieldElement.dataset.maskType || 'location';
    if (!rawValue) {
        stopNetworkFieldAnimation(fieldElement);
        fieldElement.textContent = '';
        return;
    }
    let displayValue = rawValue;
    if (!networkPrivacyVisible) {
        displayValue = maskType === 'ip' ? maskNetworkIpValue(rawValue) : maskNetworkLocationValue(rawValue);
    }
    if (animate) {
        animateNetworkFieldDisplay(fieldElement, displayValue);
    } else {
        stopNetworkFieldAnimation(fieldElement);
        fieldElement.textContent = displayValue;
    }
}

function setNetworkFieldValue(fieldId, rawValue, maskType) {
    const fieldElement = document.getElementById(fieldId);
    if (!fieldElement) return;
    fieldElement.dataset.rawValue = String(rawValue || '').trim();
    fieldElement.dataset.maskType = maskType;
    fieldElement.dataset.displayState = 'ready';
    renderNetworkFieldDisplay(fieldElement);
    // IP 字段加载完成后立即就绪点击查询，不等待其它卡片
    if (maskType === 'ip') {
        makeIpClickable();
    }
}

function setNetworkFieldError(fieldId, errorText) {
    const fieldElement = document.getElementById(fieldId);
    if (!fieldElement) return;
    stopNetworkFieldAnimation(fieldElement);
    fieldElement.dataset.rawValue = '';
    fieldElement.dataset.displayState = 'error';
    fieldElement.classList.remove('clickable', 'is-loading');
    fieldElement.removeAttribute('title');
    fieldElement.removeAttribute('aria-busy');
    fieldElement.innerHTML = `<span class="error">${errorText}</span>`;
}

function clearNetworkFieldValue(fieldId) {
    const fieldElement = document.getElementById(fieldId);
    if (!fieldElement) return;
    stopNetworkFieldAnimation(fieldElement);
    fieldElement.dataset.rawValue = '';
    fieldElement.dataset.displayState = 'empty';
    fieldElement.classList.remove('clickable', 'is-loading');
    fieldElement.removeAttribute('title');
    fieldElement.removeAttribute('aria-busy');
    fieldElement.textContent = '';
}

function refreshAllNetworkFieldDisplays(animate = false) {
    NETWORK_FIELD_CONFIGS.forEach(({
        id
    }) => {
        const fieldElement = document.getElementById(id);
        renderNetworkFieldDisplay(fieldElement, {
            animate
        });
    });
    applyNetworkCardFlag('ipip-country');
    applyNetworkCardFlag('overseas-country');
    applyNetworkCardFlag('cf-country');
    applyNetworkCardFlag('twitter-country');
}

function toggleNetworkPrivacy(event) {
    if (event) event.stopPropagation();
    networkPrivacyVisible = !networkPrivacyVisible;
    refreshAllNetworkFieldDisplays(true);
}

function bindNetworkCardPrivacyToggle() {
    const cards = document.querySelectorAll('.network-cards-container .network-card');
    cards.forEach(card => {
        if (card.dataset.privacyToggleBound === '1') return;
        card.dataset.privacyToggleBound = '1';
        card.title = '点击卡片可显示/隐藏真实IP和地址';
        card.addEventListener('click', toggleNetworkPrivacy);
    });
}
// 根据卡片内国家缩写设置国旗角标
function applyNetworkCardFlag(countryElementId) {
    const countryElement = document.getElementById(countryElementId);
    if (!countryElement) return;
    const networkCard = countryElement.closest('.network-card');
    if (!networkCard) return;
    const countryText = String(countryElement.dataset.rawValue || countryElement.textContent || '').trim();
    const codeMatch = countryText.match(/\b([a-zA-Z]{2})\b/);
    const countryCode = codeMatch ? codeMatch[1].toLowerCase() : '';
    if (!countryCode) {
        networkCard.classList.remove('has-flag-badge');
        networkCard.style.removeProperty('--flag-badge-url');
        return;
    }
    networkCard.style.setProperty('--flag-badge-url', `url("https://ipdata.co/flags/${countryCode}.png")`);
    networkCard.classList.add('has-flag-badge');
}
// JSONP 请求工具（用于无 CORS 的接口）
function createJsonpRequest(url, callbackParam, timeoutMs = NETWORK_API_TIMEOUT_MS) {
    let settled = false;
    let timeoutId = null;
    let script = null;
    let callbackScope = null;
    let callbackKey = null;
    let rejectPromise = null;
    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (script && script.parentNode) {
            script.parentNode.removeChild(script);
        }
        if (callbackScope && callbackKey) {
            try {
                delete callbackScope[callbackKey];
            } catch {
                callbackScope[callbackKey] = undefined;
            }
        }
    };
    const promise = new Promise((resolve, reject) => {
        rejectPromise = reject;
        const finalize = (handler, value) => {
            if (settled) return;
            settled = true;
            cleanup();
            handler(value);
        };
        const callbackPath = `window.__EDT2_IP_TEST_.__${Date.now()}_${Math.floor(Math.random() * 1e16)}__`;
        const callbackChain = callbackPath.replace(/^window\./, '').split('.');
        callbackScope = window;
        for (let i = 0; i < callbackChain.length - 1; i++) {
            const key = callbackChain[i];
            if (!callbackScope[key] || typeof callbackScope[key] !== 'object') {
                callbackScope[key] = {};
            }
            callbackScope = callbackScope[key];
        }
        callbackKey = callbackChain[callbackChain.length - 1];
        callbackScope[callbackKey] = payload => finalize(resolve, payload);
        const requestUrl = new URL(url);
        requestUrl.searchParams.set(callbackParam, callbackPath);
        requestUrl.searchParams.set('_t', Date.now().toString());
        script = document.createElement('script');
        script.src = requestUrl.toString();
        script.async = true;
        script.referrerPolicy = 'no-referrer';
        script.onerror = () => finalize(reject, new Error(`JSONP load failed: ${url}`));
        timeoutId = setTimeout(() => {
            finalize(reject, new Error(`JSONP timeout: ${url}`));
        }, timeoutMs);
        document.head.appendChild(script);
    });
    return {
        promise,
        cancel: () => {
            if (!settled && rejectPromise) {
                settled = true;
                cleanup();
                rejectPromise(new Error(`JSONP cancelled: ${url}`));
            } else {
                cleanup();
            }
        }
    };
}
// 统一调用 IP 详情接口（按 IP 查询）
async function fetchIpInfoByIp(ip) {
    const requestIp = String(ip || '').trim();
    if (!requestIp) {
        throw new Error('missing ip');
    }
    const apis = [{
        name: 'cm-cf',
        url: `https://api.090227.xyz/api/ipsb?ip=${encodeURIComponent(requestIp)}`
    }];
    const requestTasks = apis.map(async api => {
        const response = await fetchWithTimeout(api.url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`${api.name} HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data || typeof data !== 'object') {
            throw new Error(`${api.name} invalid payload`);
        }
        return data;
    });
    try {
        return await Promise.any(requestTasks);
    } catch (error) {
        throw new Error(`ipinfo all failed for ${requestIp}`);
    }
}

function formatIpInfoLocation(info) {
    const countryCode = String(info ? .country_code || '未知').trim() || '未知';
    const rawAsn = info ? .asn;
    const asnText = rawAsn === undefined || rawAsn === null ? '' : (/^\d+$/.test(String(rawAsn).trim()) ? `AS${String(rawAsn).trim()}` : String(rawAsn).trim());
    const asnName = String(info ? .as_name || info ? .asn_organization || info ? .organization || info ? .isp || '').trim();
    return `${countryCode} ${asnText} ${asnName}`.trim() || '未知';
}

function createIpProbeRequestTask(sourceConfig) {
    if (sourceConfig.type === 'jsonp') {
        const jsonpTask = createJsonpRequest(sourceConfig.url, sourceConfig.callbackParam);
        return {
            cancel: jsonpTask.cancel,
            promise: jsonpTask.promise.then(payload => {
                const requestIp = String(sourceConfig.extractIp(payload) || '').trim();
                if (!requestIp) {
                    throw new Error(`${sourceConfig.url} missing jsonp ip`);
                }
                return {
                    source: sourceConfig.url,
                    requestIp,
                    providerName: sourceConfig.name
                };
            })
        };
    }
    if (sourceConfig.type === 'trace') {
        const controller = new AbortController();
        return {
            cancel: () => controller.abort(),
            promise: (async () => {
                const url = `${sourceConfig.url}${sourceConfig.url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
                const response = await fetchWithTimeout(url, {
                    cache: 'no-store',
                    signal: controller.signal
                });
                if (!response.ok) {
                    throw new Error(`${sourceConfig.url} HTTP ${response.status}`);
                }
                const text = await response.text();
                const ipMatch = text.match(/^ip=(.+)$/m);
                const requestIp = ipMatch ? ipMatch[1].trim() : '';
                if (!requestIp) {
                    throw new Error(`${sourceConfig.url} missing ip field`);
                }
                return {
                    source: sourceConfig.url,
                    requestIp,
                    providerName: sourceConfig.name
                };
            })()
        };
    }
    const controller = new AbortController();
    return {
        cancel: () => controller.abort(),
        promise: (async () => {
            const url = `${sourceConfig.url}${sourceConfig.url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
            const response = await fetchWithTimeout(url, {
                method: 'HEAD',
                cache: 'no-store',
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error(`${sourceConfig.url} HTTP ${response.status}`);
            }
            const requestIp = String(response.headers.get(sourceConfig.ipHeader) || '').trim();
            if (!requestIp) {
                throw new Error(`${sourceConfig.url} missing ${sourceConfig.ipHeader}`);
            }
            return {
                source: sourceConfig.url,
                requestIp,
                providerName: sourceConfig.name
            };
        })()
    };
}
async function raceIpProbeSources(sourceConfigs, label) {
    if (!sourceConfigs.length) {
        throw new Error(`${label} has no sources`);
    }
    const requestTasks = sourceConfigs.map(createIpProbeRequestTask);
    try {
        return await Promise.any(requestTasks.map(task => task.promise));
    } finally {
        requestTasks.forEach(task => task.cancel && task.cancel());
    }
}
// 获取国内测试数据（HEAD 优先，失败后再用 JSONP 兜底）
async function fetchIpipData() {
    setStatus('status-ipip', 'loading');
    const statusElement = document.querySelector('#status-ipip');
    const titleElement = statusElement ? statusElement.parentElement : null;
    const testSources = [
        /*
        {
        	type: 'head',
        	name: '字节跳动',
        	url: 'https://perfops2.byte-test.com/500b-bench.jpg',
        	ipHeader: 'X-Request-Ip'
        },
        {
        	type: 'head',
        	name: '字节跳动',
        	url: 'https://perfops.byte-test.com',
        	ipHeader: 'X-Request-Ip'
        },
        {
        	type: 'head',
        	name: '网易科技',
        	url: 'https://necaptcha.nosdn.127.net/ab7f4275c1744aa28e0a8f3a1c58c532.png',
        	ipHeader: 'cdn-user-ip'
        },
        {
        	type: 'jsonp',
        	name: '腾讯新闻',
        	url: 'https://r.inews.qq.com/api/ip2city?otype=jsonp',
        	callbackParam: 'callback',
        	extractIp: payload => payload?.ip
        },
        {
        	type: 'jsonp',
        	name: '太平洋科技',
        	url: 'https://whois.pconline.com.cn/ipJson.jsp',
        	callbackParam: 'callback',
        	extractIp: payload => payload?.ip
        },
        {
        	type: 'jsonp',
        	name: '阿里巴巴',
        	url: `https://${Date.now()}.dns-detect.alicdn.com/api/detect/DescribeDNSLookup`,
        	callbackParam: 'cb',
        	extractIp: payload => payload?.content?.localIp
        },
        */
        {
            type: 'trace',
            name: '科赋锐科技₁',
            url: 'https://api.cloudflare-cn.com/cdn-cgi/trace'
        }, {
            type: 'trace',
            name: '科赋锐科技₂',
            url: 'https://www.cf-ns.com/cdn-cgi/trace'
        }, {
            type: 'trace',
            name: '科赋锐科技₃',
            url: 'https://www.cf-ns.net/cdn-cgi/trace'
        }, {
            type: 'trace',
            name: '科赋锐科技₄',
            url: 'https://www.cf-ns.tech/cdn-cgi/trace'
        }
    ];
    const headSources = testSources.filter(sourceConfig => sourceConfig.type === 'head' || sourceConfig.type === 'trace');
    const jsonpSources = testSources.filter(sourceConfig => sourceConfig.type === 'jsonp');
    let fastestSuccess;
    try {
        try {
            fastestSuccess = await raceIpProbeSources(headSources, '国内测试 HEAD');
        } catch (headError) {
            console.warn('[国内测试] HEAD 测试源不可用，后台切换到 JSONP 兜底:', headError);
            if (!jsonpSources.length) {
                throw headError;
            }
            fastestSuccess = await raceIpProbeSources(jsonpSources, '国内测试 JSONP');
        }
    } catch (error) {
        setNetworkFieldError('ipip-ip', '加载失败');
        clearNetworkFieldValue('ipip-country');
        applyNetworkCardFlag('ipip-country');
        const ipipCityElement = document.getElementById('ipip-city');
        if (ipipCityElement) {
            ipipCityElement.textContent = '';
        }
        setStatus('status-ipip', 'error');
        console.error('国内测试 所有测试源都失败:', error);
        return;
    }
    const fallbackIp = String(fastestSuccess.requestIp || '未知').trim() || '未知';
    setNetworkFieldValue('ipip-ip', fallbackIp, 'ip');
    clearNetworkFieldValue('ipip-country');
    applyNetworkCardFlag('ipip-country');
    if (titleElement) {
        titleElement.innerHTML = `<span class="status-indicator" id="status-ipip"></span><div class="title-text"><div class="title-main">国内测试</div><div class="title-subtitle">${fastestSuccess.providerName}</div></div>`;
        setStatus('status-ipip', 'loading');
    }
    try {
        const info = await fetchIpInfoByIp(fastestSuccess.requestIp);
        const ip = String(info.ip || fastestSuccess.requestIp || '未知').trim();
        const location = formatIpInfoLocation(info);
        setNetworkFieldValue('ipip-ip', ip, 'ip');
        setNetworkFieldValue('ipip-country', location || '未知', 'location');
        applyNetworkCardFlag('ipip-country');
        setStatus('status-ipip', 'success');
        console.log(`[国内测试] 成功: IP=${ip}, 位置=${location}, 来源=${fastestSuccess.source}`);
    } catch (detailError) {
        setNetworkFieldValue('ipip-country', '未知', 'location');
        applyNetworkCardFlag('ipip-country');
        setStatus('status-ipip', 'success');
        console.warn(`[国内测试] 已获取IP=${fallbackIp}，但查询详细信息失败:`, detailError);
    }
}
// 获取国外测试数据
async function fetchOverseasTestData() {
    setStatus('status-overseas', 'loading');
    // API 配置：URL + 字段映射
    const apis = [{
        url: `https://api.ipapi.is`,
        parse: d => ({
            ip: d.ip,
            loc: `${d.cc || '未知'} AS${d.asn_num || ''} ${d.asn_org || ''}`.trim()
        })
    }, {
        url: `https://api.cmliussss.net/api/ipinfo`,
        parse: d => ({
            ip: d.ip,
            loc: `${d.country_code || '未知'} ${d.asn || ''} ${d.as_name || ''}`.trim()
        })
    }];
    const requestTasks = apis.map(api => {
        const controller = new AbortController();
        return {
            cancel: () => controller.abort(),
            promise: (async () => {
                const url = `${api.url}${api.url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
                const response = await fetchWithTimeout(url, {
                    cache: 'no-store',
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const {
                    ip,
                    loc
                } = api.parse(await response.json());
                const edgeIp = ip || '未知';
                return {
                    edgeIp,
                    loc,
                    url: api.url
                };
            })().catch(error => {
                console.log(`[国外测试] ${api.url} 失败: ${error.message}`);
                throw error;
            })
        };
    });
    try {
        const {
            edgeIp,
            loc
        } = await Promise.any(requestTasks.map(task => task.promise));
        requestTasks.forEach(task => task.cancel && task.cancel());
        setNetworkFieldValue('overseas-ip', edgeIp, 'ip');
        setNetworkFieldValue('overseas-country', loc || '未知', 'location');
        applyNetworkCardFlag('overseas-country');
        setStatus('status-overseas', 'success');
        console.log(`[国外测试] 成功: IP=${edgeIp}, 位置=${loc}`);
        return;
    } catch (error) {
        requestTasks.forEach(task => task.cancel && task.cancel());
    }
    // 所有 API 都失败
    setNetworkFieldError('overseas-ip', '加载失败');
    clearNetworkFieldValue('overseas-country');
    applyNetworkCardFlag('overseas-country');
    setStatus('status-overseas', 'error');
    console.error('国外测试 所有API都失败');
}
// CloudFlare ProxyIP 卡片状态（支持双出口切换）
let cloudFlareEntries = [];
let cloudFlareActiveIndex = 0;
// 墙外测试卡片状态（支持多来源切换）
let twitterEntries = [];
let twitterActiveIndex = 0;

function isValidIpv4(ip) {
    const value = String(ip || '').trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
    return value.split('.').every(part => {
        if (!/^\d+$/.test(part)) return false;
        const num = Number(part);
        return num >= 0 && num <= 255;
    });
}

function isValidIpv6(ip) {
    const value = String(ip || '').trim().replace(/^\[|\]$/g, '');
    if (!value || !value.includes(':')) return false;
    try {
        // 借助 URL 解析器校验 IPv6 格式，兼容缩写写法
        new URL(`http://[${value}]/`);
        return true;
    } catch {
        return false;
    }
}

function detectIpVersion(ip) {
    const value = String(ip || '').trim();
    if (!value) return '';
    if (isValidIpv4(value)) return 'v4';
    if (isValidIpv6(value)) return 'v6';
    return '';
}

function getCloudFlareProxyClass(version) {
    if (version === 'v4') return 'cf-subtitle-v4';
    if (version === 'v6') return 'cf-subtitle-v6';
    return '';
}

function getCloudFlareProxyLabel(version, full = false) {
    if (version === 'v4') return full ? 'ProxyIPv4' : 'v4';
    if (version === 'v6') return full ? 'ProxyIPv6' : 'v6';
    return full ? 'ProxyIP' : 'IP';
}

function formatCloudFlareLocation(data) {
    const country = String(data ? .country || '').trim();
    const org = String(data ? .org || '').trim();
    return `${country} ${org}`.trim() || '未知';
}

function resetCloudFlareSubtitle() {
    const subtitleElement = document.getElementById('cf-subtitle');
    if (!subtitleElement) return;
    subtitleElement.classList.remove('cf-subtitle-rich');
    subtitleElement.textContent = 'ProxyIP';
}

function renderCloudFlareSubtitle() {
    const subtitleElement = document.getElementById('cf-subtitle');
    if (!subtitleElement) return;
    if (!cloudFlareEntries.length) {
        resetCloudFlareSubtitle();
        return;
    }
    subtitleElement.classList.add('cf-subtitle-rich');
    if (cloudFlareEntries.length === 1) {
        const entry = cloudFlareEntries[0];
        subtitleElement.innerHTML = `<span class="${getCloudFlareProxyClass(entry.version)}">${getCloudFlareProxyLabel(entry.version, true)}</span>`;
        return;
    }
    cloudFlareActiveIndex = Math.min(Math.max(cloudFlareActiveIndex, 0), cloudFlareEntries.length - 1);
    const onSwitch = event => {
        event.preventDefault();
        event.stopPropagation();
        const targetIndex = Number(event.currentTarget.dataset.cfTargetIndex);
        if (!Number.isInteger(targetIndex)) return;
        if (targetIndex < 0 || targetIndex >= cloudFlareEntries.length) return;
        if (targetIndex === cloudFlareActiveIndex) return;
        cloudFlareActiveIndex = targetIndex;
        renderCloudFlareActiveEntry();
    };
    const subtitleHtml = cloudFlareEntries.map((entry, index) => {
        const entryClass = getCloudFlareProxyClass(entry.version);
        const isActive = index === cloudFlareActiveIndex;
        const label = getCloudFlareProxyLabel(entry.version, isActive);
        if (isActive) {
            return `<span class="${entryClass}">${label}</span>`;
        }
        return `<span class="${entryClass} cf-subtitle-switch" data-cf-target-index="${index}" role="button" tabindex="0">${label}</span>`;
    }).join('<span class="cf-subtitle-sep"> / </span>');
    subtitleElement.innerHTML = subtitleHtml;
    const switchElements = subtitleElement.querySelectorAll('.cf-subtitle-switch');
    switchElements.forEach(switchElement => {
        switchElement.title = '点击切换出口IP';
        switchElement.addEventListener('click', onSwitch);
        switchElement.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            onSwitch(event);
        });
    });
}

function renderCloudFlareActiveEntry() {
    if (!cloudFlareEntries.length) return;
    cloudFlareActiveIndex = Math.min(Math.max(cloudFlareActiveIndex, 0), cloudFlareEntries.length - 1);
    const activeEntry = cloudFlareEntries[cloudFlareActiveIndex];
    setNetworkFieldValue('cf-ip', activeEntry.ip, 'ip');
    setNetworkFieldValue('cf-country', activeEntry.loc || '未知', 'location');
    applyNetworkCardFlag('cf-country');
    renderCloudFlareSubtitle();
}
// 获取 CloudFlare 数据（并发请求多个接口，按实际返回 IP 判定类型）
async function fetchCloudFlareData() {
    setStatus('status-cf', 'loading');
    cloudFlareEntries = [];
    cloudFlareActiveIndex = 0;
    resetCloudFlareSubtitle();
    const timestamp = Date.now();
    const endpoints = [{
        url: 'https://ipv4.090227.xyz'
    }, {
        url: 'https://ipv6.090227.xyz'
    }];
    try {
        const requestResults = await Promise.allSettled(endpoints.map(async endpoint => {
            const response = await fetchWithTimeout(`${endpoint.url}/?_t=${timestamp}`, {
                cache: 'no-store'
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            const ip = String(data ? .ip || '').trim();
            const version = detectIpVersion(ip);
            if (!ip || !version) {
                throw new Error(`invalid ip payload: ${ip || 'empty'}`);
            }
            return {
                ip,
                version,
                loc: formatCloudFlareLocation(data)
            };
        }));
        const availableEntries = [];
        const seenEntryKeys = new Set();
        requestResults.forEach((result, index) => {
            const endpoint = endpoints[index];
            if (result.status !== 'fulfilled') {
                const reason = result.reason ? .message || String(result.reason || 'unknown error');
                console.log(`[CloudFlare] ${endpoint.url} 失败: ${reason}`);
                return;
            }
            const entry = result.value;
            if (!entry ? .ip || !entry ? .version) return;
            const normalizedIp = String(entry.ip || '').trim().toLowerCase();
            const dedupeKey = `${entry.version}:${normalizedIp}`;
            if (seenEntryKeys.has(dedupeKey)) {
                return;
            }
            seenEntryKeys.add(dedupeKey);
            availableEntries.push(entry);
        });
        if (!availableEntries.length) {
            throw new Error('no valid cloudflare ip from all endpoints');
        }
        const hasV4 = availableEntries.some(entry => entry.version === 'v4');
        const hasV6 = availableEntries.some(entry => entry.version === 'v6');
        if (hasV4 && hasV6) {
            availableEntries.sort((a, b) => {
                if (a.version === b.version) return 0;
                return a.version === 'v4' ? -1 : 1;
            });
        }
        cloudFlareEntries = availableEntries;
        cloudFlareActiveIndex = 0;
        renderCloudFlareActiveEntry();
        setStatus('status-cf', 'success');
        const summary = cloudFlareEntries.map(entry => `${entry.ip}(${entry.version})`).join(', ');
        console.log(`[CloudFlare] 成功: ${summary}`);
    } catch (error) {
        setNetworkFieldError('cf-ip', '加载失败');
        clearNetworkFieldValue('cf-country');
        applyNetworkCardFlag('cf-country');
        resetCloudFlareSubtitle();
        setStatus('status-cf', 'error');
        console.error('CloudFlare 接口错误:', error);
    }
}
// 获取墙外测试数据（后台并发取最快可用源）
// 获取墙外测试数据（后台并发取所有可用源，支持切换显示）
async function fetchTwitterData() {
    setStatus('status-twitter', 'loading');
    const statusElement = document.querySelector('#status-twitter');
    const titleElement = statusElement ? statusElement.parentElement : null;
    const tipElement = document.getElementById('twitter-tip');
    const isInvalidOutsideEntryIp = ip => {
        const candidate = String(ip || '').trim();
        return !candidate || candidate === '0.0.0.0';
    };
    const renderTwitterSubtitle = () => {
        if (!titleElement) return;
        const prevIndicator = document.getElementById('status-twitter');
        const prevStatus = prevIndicator ? (prevIndicator.className.match(/status-(?!indicator)(\w+)/) || [])[1] : '';
        const getBrandClass = name => {
            if (name.includes('Google')) return 'tw-subtitle-google';
            if (name.includes('X.com')) return 'tw-subtitle-twitter';
            return '';
        };
        if (!twitterEntries.length) {
            titleElement.innerHTML = '<span class="status-indicator" id="status-twitter"></span><div class="title-text"><div class="title-main">墙外测试</div><div class="title-subtitle">!CN-Test</div></div>';
            if (prevStatus) setStatus('status-twitter', prevStatus);
            return;
        }
        if (twitterEntries.length === 1) {
            const brandClass = getBrandClass(twitterEntries[0].providerName);
            titleElement.innerHTML = `<span class="status-indicator" id="status-twitter"></span><div class="title-text"><div class="title-main">墙外测试</div><div class="title-subtitle"><span class="${brandClass}">${twitterEntries[0].providerName}</span></div></div>`;
            if (prevStatus) setStatus('status-twitter', prevStatus);
            return;
        }
        twitterActiveIndex = Math.min(Math.max(twitterActiveIndex, 0), twitterEntries.length - 1);
        const onSwitch = event => {
            event.preventDefault();
            event.stopPropagation();
            const targetIndex = Number(event.currentTarget.dataset.twTargetIndex);
            if (!Number.isInteger(targetIndex)) return;
            if (targetIndex < 0 || targetIndex >= twitterEntries.length) return;
            if (targetIndex === twitterActiveIndex) return;
            twitterActiveIndex = targetIndex;
            renderTwitterActiveEntry();
        };
        const subtitleHtml = twitterEntries.map((entry, index) => {
            const isActive = index === twitterActiveIndex;
            const label = entry.providerName;
            const brandClass = getBrandClass(label);
            if (isActive) {
                return `<span class="${brandClass}">${label}</span>`;
            }
            return `<span class="${brandClass} cf-subtitle-switch" data-tw-target-index="${index}" role="button" tabindex="0">${label}</span>`;
        }).join('<span class="cf-subtitle-sep"> / </span>');
        titleElement.innerHTML = `<span class="status-indicator" id="status-twitter"></span><div class="title-text"><div class="title-main">墙外测试</div><div class="title-subtitle">${subtitleHtml}</div></div>`;
        if (prevStatus) setStatus('status-twitter', prevStatus);
        const switchElements = titleElement.querySelectorAll('.cf-subtitle-switch');
        switchElements.forEach(el => {
            el.title = '点击切换来源';
            el.addEventListener('click', onSwitch);
            el.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                onSwitch(event);
            });
        });
    };
    const renderTwitterActiveEntry = () => {
        if (!twitterEntries.length) return;
        twitterActiveIndex = Math.min(Math.max(twitterActiveIndex, 0), twitterEntries.length - 1);
        const activeEntry = twitterEntries[twitterActiveIndex];
        setNetworkFieldValue('twitter-ip', activeEntry.ip, 'ip');
        setNetworkFieldValue('twitter-country', activeEntry.loc || '未知', 'location');
        applyNetworkCardFlag('twitter-country');
        if (tipElement) {
            tipElement.textContent = `· 您访问 ${activeEntry.providerName} 所使用的IP`;
        }
        renderTwitterSubtitle();
    };
    const renderTwitterTip = (sourceName) => {
        if (!tipElement) return;
        tipElement.textContent = `· 您访问 ${sourceName} 所使用的IP`;
    };
    const testSources = [{
        name: '谷歌(Google)',
        createTask: () => {
            const jsonpTask = createJsonpRequest(`https://jsonp-ip.appspot.com/?_t=${Date.now()}`, 'callback');
            return {
                cancel: jsonpTask.cancel,
                promise: jsonpTask.promise.then(payload => {
                    const requestIp = String(payload ? .ip || '').trim();
                    if (isInvalidOutsideEntryIp(requestIp)) {
                        if (requestIp === '0.0.0.0') {
                            throw new Error('google jsonp returned invalid ip 0.0.0.0');
                        }
                        throw new Error('google jsonp missing ip');
                    }
                    return {
                        providerName: '谷歌(Google)',
                        requestIp
                    };
                })
            };
        }
    }, {
        name: '推特(X.com)',
        createTask: () => {
            const controller = new AbortController();
            return {
                cancel: () => controller.abort(),
                promise: (async () => {
                    const response = await fetchWithTimeout(`https://help.x.com/cdn-cgi/trace?_t=${Date.now()}`, {
                        cache: 'no-store',
                        signal: controller.signal
                    });
                    if (!response.ok) {
                        throw new Error(`x trace HTTP ${response.status}`);
                    }
                    const text = await response.text();
                    const ipLine = text.split('\n').find(line => line.startsWith('ip='));
                    const requestIp = String(ipLine ? ipLine.slice(3) : '').trim();
                    if (isInvalidOutsideEntryIp(requestIp)) {
                        if (requestIp === '0.0.0.0') {
                            throw new Error('x trace returned invalid ip 0.0.0.0');
                        }
                        throw new Error('x trace missing ip');
                    }
                    return {
                        providerName: '推特(X.com)',
                        requestIp
                    };
                })()
            };
        }
    }];
    twitterEntries = [];
    twitterActiveIndex = 0;
    try {
        const requestTasks = testSources.map(source => {
            const task = source.createTask();
            const taskPromise = task.promise.then(result => {
                return {
                    source: source.name,
                    result
                };
            }).catch(sourceError => {
                console.log(`[墙外测试] ${source.name} 失败: ${sourceError.message}`);
                return {
                    source: source.name,
                    error: sourceError
                };
            });
            return {
                cancel: task.cancel,
                promise: taskPromise
            };
        });
        // 等所有来源完成（不再取消慢的那个）
        const results = await Promise.allSettled(requestTasks.map(t => t.promise));
        const successfulResults = [];
        for (const settled of results) {
            if (settled.status === 'fulfilled' && settled.value && settled.value.result) {
                successfulResults.push(settled.value);
            }
        }
        if (!successfulResults.length) {
            throw new Error('all outside entry sources failed');
        }
        // 为每个成功的来源查询 IP 详情
        const detailPromises = successfulResults.map(async ({
            source,
            result
        }) => {
            try {
                const info = await fetchIpInfoByIp(result.requestIp);
                return {
                    providerName: result.providerName,
                    ip: String(info.ip || result.requestIp || '未知').trim(),
                    loc: formatIpInfoLocation(info)
                };
            } catch {
                return {
                    providerName: result.providerName,
                    ip: String(result.requestIp || '未知').trim(),
                    loc: '未知'
                };
            }
        });
        const detailedEntries = await Promise.all(detailPromises);
        twitterEntries = detailedEntries;
        twitterActiveIndex = 0;
        // 渲染第一个（默认选中第一个）
        renderTwitterActiveEntry();
        setStatus('status-twitter', 'success');
        const summary = twitterEntries.map(e => `${e.ip}(${e.providerName})`).join(', ');
        console.log(`[墙外测试] 成功: ${summary}`);
    } catch (error) {
        setNetworkFieldError('twitter-ip', '翻墙未开启');
        clearNetworkFieldValue('twitter-country');
        applyNetworkCardFlag('twitter-country');
        if (titleElement) {
            titleElement.innerHTML = '<span class="status-indicator" id="status-twitter"></span><div class="title-text"><div class="title-main">墙外测试</div><div class="title-subtitle">翻墙失败</div></div>';
        }
        setStatus('status-twitter', 'error');
        renderTwitterTip('墙外站点');
        console.error('墙外测试接口错误:', error);
    }
}
// 网络信息加载标志
let networkInfoLoaded = false;
// 加载网络信息
async function loadNetworkInfo() {
    if (networkInfoLoadPromise) {
        return networkInfoLoadPromise;
    }
    // 检查容器是否存在
    const container = document.querySelector('.network-cards-container');
    if (!container) return;
    bindNetworkCardPrivacyToggle();
    // 设置加载标志
    networkInfoLoaded = true;
    const networkTasks = [{
        name: '国外测试',
        run: fetchOverseasTestData
    }, {
        name: 'CloudFlare',
        run: fetchCloudFlareData
    }, {
        name: '国内测试',
        run: fetchIpipData
    }, {
        name: '墙外测试',
        run: fetchTwitterData
    }];
    networkInfoLoadPromise = (async () => {
        for (let i = 0; i < networkTasks.length; i++) {
            await runNetworkInfoBackgroundTask(networkTasks[i], i);
        }
        // 所有网络信息加载完成后,使 IP 可点击
        setTimeout(() => {
            makeIpClickable();
        }, 500);
    })();
    return networkInfoLoadPromise;
}
// 页面加载完成并进入空闲状态后，在后台获取网络信息，避免影响前台初始化
scheduleNetworkInfoLoad();
// IP 点击查询详情功能
function makeIpClickable() {
    const ipElements = document.querySelectorAll('.ip-text');
    ipElements.forEach(element => {
        const rawIpText = String(element.dataset.rawValue || element.textContent || '').trim();
        // 跳过已经标记为错误、加载中、未知的元素
        if (element.querySelector('.error') || element.dataset.displayState === 'error' || rawIpText === '加载中...' || rawIpText === '未知' || !rawIpText || element.classList.contains('clickable')) {
            return;
        }
        // 添加可点击样式
        element.classList.add('clickable');
        element.title = '点击查询IP详细信息';
        element.addEventListener('click', function(event) {
            event.stopPropagation();
            if (this.dataset.displayState !== 'ready') {
                return;
            }
            const rawIp = String(this.dataset.rawValue || this.textContent || '').trim();
            // 跳过显示"加载中..."或"未知"的元素
            if (!rawIp || rawIp === '加载中...' || rawIp === '未知') {
                return;
            }
            fetchAndShowIpDetail(rawIp, this);
        });
    });
}
// 将布尔值转换为 emoji
function boolToEmoji(value, trueEmoji = '✅', falseEmoji = '❌') {
    return value ? trueEmoji : falseEmoji;
}
// 将 IP 类型转换为中文并添加样式
function formatIpType(type) {
    if (!type) return '<span class="ip-type-unknown">未知</span>';
    const typeMap = {
        'isp': {
            text: '住宅',
            class: 'ip-type-residential'
        },
        'hosting': {
            text: '机房',
            class: 'ip-type-hosting'
        },
        'business': {
            text: '商用',
            class: 'ip-type-business'
        }
    };
    const typeInfo = typeMap[type.toLowerCase()] || {
        text: type,
        class: 'ip-type-unknown'
    };
    return `<span class="${typeInfo.class}">${typeInfo.text}</span>`;
}
// 获取威胁等级的样式类
function getThreatBadgeClass(score) {
    if (!score) return 'badge-info';
    const numScore = parseFloat(score);
    if (numScore < 0.001) return 'badge-success';
    if (numScore < 0.01) return 'badge-info';
    if (numScore < 0.1) return 'badge-warning';
    return 'badge-danger';
}
// 计算综合滥用评分
function calculateAbuseScore(companyScore, asnScore, securityFlags = {}) {
    // 如果两个分数都无效，返回null
    if (!companyScore || companyScore === '未知') companyScore = 0;
    if (!asnScore || asnScore === '未知') asnScore = 0;
    const company = parseFloat(companyScore) || 0;
    const asn = parseFloat(asnScore) || 0;
    // 计算基础评分：(company + asn) / 2 * 5
    let baseScore = ((company + asn) / 2) * 5;
    // 计算安全风险附加分：每个安全风险项增加 15%
    let riskAddition = 0;
    const riskFlags = [
        securityFlags.is_crawler, // 爬虫
        securityFlags.is_proxy, // 代理服务器
        securityFlags.is_vpn, // VPN
        securityFlags.is_tor, // Tor 网络
        securityFlags.is_abuser // 滥用 IP
    ];
    // 统计为 true 的风险项数量
    const riskCount = riskFlags.filter(flag => flag === true).length;
    riskAddition = riskCount * 0.15; // 每个风险项增加 15%
    // 最终评分 = 基础评分 + 风险附加分
    let finalScore = baseScore + riskAddition;
    // 如果是虚假IP (蜜罐)，则风险值增加100%
    if (securityFlags.is_bogon === true) {
        finalScore += 1.0; // 增加100%
    }
    // 如果基础评分和风险附加分都是0且不是虚假IP，返回null
    if (baseScore === 0 && riskAddition === 0 && securityFlags.is_bogon !== true) return null;
    return finalScore;
}
// 获取滥用评分的颜色等级
function getAbuseScoreBadgeClass(percentage) {
    if (percentage === null || percentage === undefined) return 'badge-info';
    if (percentage >= 100) return 'badge-critical'; // 危险红色 >= 100%
    if (percentage >= 20) return 'badge-high'; // 橘黄色 15-99.99%
    if (percentage >= 5) return 'badge-elevated'; // 黄色 5-14.99%
    if (percentage >= 0.25) return 'badge-low'; // 淡绿色 0.25-4.99%
    return 'badge-verylow'; // 绿色 < 0.25%
}
// 格式化滥用评分为百分比
function formatAbuseScorePercentage(score) {
    if (score === null || score === undefined) return '未知';
    const percentage = score * 100;
    return percentage.toFixed(2) + '%';
}
// 切换评分算法说明气泡
function toggleScoreTooltip(helpIcon) {
    const tooltip = helpIcon.nextElementSibling;
    const isShowing = tooltip.classList.contains('show');
    // 隐藏所有其他气泡
    document.querySelectorAll('.score-tooltip.show').forEach(t => {
        if (t !== tooltip) t.classList.remove('show');
    });
    // 切换当前气泡
    tooltip.classList.toggle('show');
    // 如果显示气泡，调整位置并添加点击事件监听器来关闭它
    if (!isShowing) {
        setTimeout(() => {
            positionTooltipNearMouse(tooltip, helpIcon);
            const closeTooltip = (e) => {
                if (!tooltip.contains(e.target) && !helpIcon.contains(e.target)) {
                    tooltip.classList.remove('show');
                    document.removeEventListener('click', closeTooltip);
                }
            };
            document.addEventListener('click', closeTooltip);
        }, 100);
    }
}
// 将气泡位置设置在鼠标附近
function positionTooltipNearMouse(tooltip, helpIcon) {
    const iconRect = helpIcon.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const padding = 10;
    let left = iconRect.right + padding;
    let top = iconRect.top - tooltipHeight / 2;
    // 如果气泡超出右边界，显示在左边
    if (left + tooltipWidth > windowWidth - padding) {
        left = iconRect.left - tooltipWidth - padding;
    }
    // 如果气泡超出顶部，调整到下方
    if (top < padding) {
        top = iconRect.top + padding;
    }
    // 如果气泡超出底部，调整到上方
    if (top + tooltipHeight > windowHeight - padding) {
        top = windowHeight - tooltipHeight - padding;
    }
    tooltip.style.position = 'fixed';
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}
// 将 ipapi.is 新版扁平响应归一化为旧版嵌套结构（幂等：已含 location 子对象的旧格式/fallback 数据原样返回）
function normalizeIpapiData(data) {
    if (!data || typeof data !== 'object') return data || {};
    // 幂等保护：已有 location 子对象说明是旧格式或 fallback 数据，无需二次处理
    if (data.location && typeof data.location === 'object') return data;
    // 复制原对象并保留扁平字段（cc/lat/lon/company_name/asn_num/asn_org 等仍可访问）
    const normalized = Object.assign({}, data);
    // 构造 location 子对象（新版缺少 country/state/city/timezone，缺省为 undefined）
    normalized.location = {
        country: data.country,
        country_code: data.cc,
        state: data.state,
        city: data.city,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone
    };
    // 构造 company 子对象（新版仅有 company_name，无 type/abuser_score，缺省为 undefined）
    normalized.company = {
        name: data.company_name,
        type: data.company_type,
        abuser_score: data.company_abuser_score
    };
    // 构造 asn 子对象（新版仅有 asn_num/asn_org，无 type/abuser_score，缺省为 undefined）
    normalized.asn = {
        asn: data.asn_num,
        org: data.asn_org,
        type: data.asn_type,
        abuser_score: data.asn_abuser_score
    };
    return normalized;
}
// 显示 IP 详情弹窗
function showIpDetailModal(data) {
    // 首先移除旧的弹窗（如果存在）
    const existingModal = document.querySelector('.ip-detail-modal');
    if (existingModal) existingModal.remove();
    // 创建弹窗
    const modal = document.createElement('div');
    modal.className = 'ip-detail-modal';
    // 计算评分和等级
    const companyScore = data.company ? .abuser_score;
    const asnScore = data.asn ? .abuser_score;
    const securityFlags = {
        is_crawler: data.is_crawler,
        is_proxy: data.is_proxy,
        is_vpn: data.is_vpn,
        is_tor: data.is_tor,
        is_abuser: data.is_abuser,
        is_bogon: data.is_bogon
    };
    const combinedScore = calculateAbuseScore(companyScore, asnScore, securityFlags);
    let riskControlHTML = '未知';
    let riskLevel = '未知';
    let badgeClass = 'badge-info';
    if (combinedScore !== null) {
        const scorePercentage = combinedScore * 100;
        badgeClass = getAbuseScoreBadgeClass(scorePercentage);
        const formattedScore = formatAbuseScorePercentage(combinedScore);
        if (scorePercentage >= 100) riskLevel = '极度危险';
        else if (scorePercentage >= 20) riskLevel = '高风险';
        else if (scorePercentage >= 5) riskLevel = '轻微风险';
        else if (scorePercentage >= 0.25) riskLevel = '纯净';
        else riskLevel = '极度纯净';
        riskControlHTML = `<span class="ip-detail-badge ${badgeClass}">${formattedScore} ${riskLevel}</span>`;
    }
    // 构建 HTML 结构
    modal.innerHTML = `
		<div class="ip-detail-content">
			<div class="ip-detail-header">
				<h2 class="ip-detail-title">
					🔍 IP 详细信息
					<span class="ip-detail-source-tag">数据来源: ipapi.is</span>
				</h2>
				<button class="ip-detail-close" title="关闭">&times;</button>
			</div>
			<div class="ip-detail-body">
				<!-- 地图展示区 -->
				<div class="ip-detail-map-container">
					<div id="ip-detail-map"></div>
				</div>

				<!-- 数据网格区 -->
				<div class="ip-detail-grid-container">
					<!-- 左栏: 基本信息 (整合地理、运营商信息) -->
					<div class="ip-detail-left-col">
						<div class="ip-detail-card" style="height: 100%;">
							<div class="ip-detail-section-title">📍 基本信息</div>
							<div class="ip-detail-item" title="当前查询的公网 IP 地址，用于在互联网上唯一标识设备">
								<span class="ip-detail-label">IP 地址</span>
								<span class="ip-detail-value">${data.ip || '未知'}</span>
							</div>
							<div class="ip-detail-item" title="IP 地址的物理位置，通过 IP 地址段分配数据库推算得出，包括国家/地区、州省和城市信息">
								<span class="ip-detail-label">地理位置</span>
								<span class="ip-detail-value">${data.location?.country_code ? `[${data.location.country_code}]` : ''}${data.location?.country || ''} ${[data.location?.state, data.location?.city].filter(Boolean).join('/') || '未知'}</span>
							</div>
							<div class="ip-detail-item" title="该 IP 地址所在地区使用的标准时区，格式为洲/城市，如 Asia/Shanghai">
								<span class="ip-detail-label">时区</span>
								<span class="ip-detail-value">${data.location?.timezone || '未知'}</span>
							</div>
							<div class="ip-detail-item" title="IP 的网络类型:【住宅】家庭宽带、【机房】数据中心或云服务器、【商用】企业专线。左侧为运营商分类，右侧为 ASN (自治系统)分类">
								<span class="ip-detail-label">运营商 / ASN 类型</span>
								<span class="ip-detail-value">${formatIpType(data.company?.type)} / ${formatIpType(data.asn?.type)}</span>
							</div>
							<div class="ip-detail-item" title="综合滥用评分，基于运营商/ASN 历史记录和安全风险项计算。评分越低表示 IP 越纯净，越高表示被滥用可能性越大">
								<span class="ip-detail-label">风控评级</span>
								<span class="ip-detail-value">${riskControlHTML}</span>
							</div>
						</div>
					</div>

					<!-- 右栏: 安全检测 -->
					<div class="ip-detail-right-col">
						<!-- 安全检测内容保持不变 -->
						<div class="ip-detail-card" style="height: 100%;">
							<div class="ip-detail-section-title">🛡️ 安全检测</div>
							<div class="ip-detail-security-grid">
								<div class="ip-detail-item" title="该 IP 是否属于数据中心(IDC)、云服务商或主机托管服务。数据中心 IP 常被用于服务器部署，部分网站可能限制此类 IP 访问">
									<span class="ip-detail-label">数据中心</span>
									<span class="ip-detail-value">${data.is_datacenter ? '<span class="warning-text">🏢 是</span>' : '✅ 否'}</span>
								</div>
								<div class="ip-detail-item" title="该 IP 是否被识别为公开的代理服务器(如 HTTP/SOCKS 代理)。代理服务器可能被用于隐藏真实 IP，部分服务会限制代理访问">
									<span class="ip-detail-label">代理服务器</span>
									<span class="ip-detail-value">${data.is_proxy ? '<span class="danger-text">⚠️ 是</span>' : '✅ 否'}</span>
								</div>
								<div class="ip-detail-item" title="该 IP 是否属于已知的 VPN (虚拟私人网络)服务提供商。VPN 用于加密网络流量和隐藏真实位置，部分网站会限制 VPN 访问">
									<span class="ip-detail-label">VPN 连线</span>
									<span class="ip-detail-value">${data.is_vpn ? '<span class="danger-text">⚠️ 是</span>' : '✅ 否'}</span>
								</div>
								<div class="ip-detail-item" title="该 IP 是否属于 Tor (洋葱路由)匿名网络的出口节点。Tor 提供高度匿名性，但也常被用于非法活动，因此大多数网站会限制或禁止 Tor 访问">
									<span class="ip-detail-label">Tor 网络</span>
									<span class="ip-detail-value">${data.is_tor ? '<span class="danger-text">⚠️ 是</span>' : '✅ 否'}</span>
								</div>
								<div class="ip-detail-item" title="该 IP 是否被识别为网络爬虫(搜索引擎蜘蛛、数据采集机器人等)。爬虫可能对网站造成额外负担，部分网站会限制或特殊处理爬虫流量">
									<span class="ip-detail-label">网络爬虫</span>
									<span class="ip-detail-value">${data.is_crawler ? '<span class="danger-text">🤖 是</span>' : '✅ 否'}</span>
								</div>
								<div class="ip-detail-item" title="该 IP 是否来自移动网络运营商(如 4G/5G 网络)。移动网络 IP 通常动态分配且更换频繁，属于住宅类 IP">
									<span class="ip-detail-label">移动网络</span>
									<span class="ip-detail-value">${data.is_mobile ? '<span class="success-text">📱 是</span>' : '否'}</span>
								</div>
								<div class="ip-detail-item" title="该 IP 是否来自卫星互联网服务(如 Starlink、OneWeb 等)。卫星网络通常用于偏远地区或移动场景的互联网接入，延迟较高">
									<span class="ip-detail-label">卫星网络</span>
									<span class="ip-detail-value">${data.is_satellite ? '<span class="success-text">🛰️ 是</span>' : '否'}</span>
								</div>
								<div class="ip-detail-item" title="该 IP 是否存在已知的滥用记录(如垃圾邮件、DDoS 攻击、恶意扫描等)。滥用 IP 通常会被安全系统拦截或限制访问">
									<span class="ip-detail-label">已知滥用</span>
									<span class="ip-detail-value">${data.is_abuser ? '<span class="danger-text">⚠️ 是</span>' : '✅ 否'}</span>
								</div>
								<div class="ip-detail-item" title="该 IP 是否为虚假 IP (Bogon IP)，即保留地址、私有地址或未分配的地址段。此类 IP 不应出现在公网上，可能表示异常流量或蜜罐">
									<span class="ip-detail-label">虚假 IP</span>
									<span class="ip-detail-value">${data.is_bogon ? '<span class="danger-text">⚠️ 是</span>' : '✅ 否'}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	`;
    document.body.appendChild(modal);
    // 初始化弹窗内的地图
    if (data.location ? .latitude && data.location ? .longitude) {
        const lat = parseFloat(data.location.latitude);
        const lng = parseFloat(data.location.longitude);
        // 给 DOM 渲染留出一点点时间
        setTimeout(() => {
            const detailMap = L.map('ip-detail-map', {
                zoomControl: false,
                attributionControl: false
            }).setView([lat + 5, lng], 4); // 向上偏移中心点，使标记在视野内偏下
            L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
                subdomains: '1234',
                minZoom: 1,
                maxZoom: 18
            }).addTo(detailMap);
            const popupHTML = `
				<div class="ip-detail-popup-content">
					<div class="ip-detail-popup-city">
						${data.location?.city || data.location?.country || '位置'}
					</div>
					<div class="ip-detail-popup-item">
						<span class="ip-detail-popup-label">国家:</span>
						<span class="ip-detail-popup-value">[${data.location?.country_code || '-'}]${data.location?.country || '未知'}</span>
					</div>
					<div class="ip-detail-popup-item">
						<span class="ip-detail-popup-label">落地IP:</span>
						<span class="ip-detail-popup-value">${data.ip}</span>
					</div>
					<div class="ip-detail-popup-item">
						<span class="ip-detail-popup-label">ASN:</span>
						<span class="ip-detail-popup-value">${data.asn?.asn || ''}</span>
					</div>
					<div class="ip-detail-popup-item">
						<span class="ip-detail-popup-label">运营商:</span>
						<span class="ip-detail-popup-value">${data.company?.name || '未知'}</span>
					</div>
				</div>
			`;
            L.marker([lat, lng]).addTo(detailMap).bindPopup(popupHTML, {
                closeButton: false,
                offset: [0, -32]
            }).openPopup();
            // 偶尔地图布局会出问题，强制刷新
            detailMap.invalidateSize();
        }, 400);
    } else {
        // 如果没有经纬度，隐藏地图容器
        const mapContainer = modal.querySelector('.ip-detail-map-container');
        if (mapContainer) mapContainer.style.display = 'none';
    }
    // 关闭逻辑
    const closeBtn = modal.querySelector('.ip-detail-close');
    const closeFunc = () => {
        modal.style.opacity = '0';
        modal.querySelector('.ip-detail-content').style.transform = 'translateY(20px)';
        setTimeout(() => modal.remove(), 300);
    };
    closeBtn.onclick = closeFunc;
    modal.onclick = (e) => {
        if (e.target === modal) closeFunc();
    };
    // ESC 键关闭
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeFunc();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}