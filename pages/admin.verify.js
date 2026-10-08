// ==================== 代理验证模态框函数 ====================
// 全局变量存储当前验证的代理类型
let currentProxyType = null;
let currentProxyFieldId = null;
const proxyVerificationConfigs = {
    socks5: {
        type: 'socks5',
        fieldId: 'socks5Addr',
        title: '🔒 SOCKS5代理验证',
        label: 'SOCKS5代理:',
        placeholder: 'user:password@127.0.0.1:1080'
    },
    http: {
        type: 'http',
        fieldId: 'httpAddr',
        title: '🌐 HTTP代理验证',
        label: 'HTTP代理:',
        placeholder: 'user:password@127.0.0.1:8080'
    },
    https: {
        type: 'https',
        fieldId: 'httpsAddr',
        title: '🌐 HTTPS代理验证',
        label: 'HTTPS代理:',
        placeholder: 'user:password@127.0.0.1:8443'
    },
    turn: {
        type: 'turn',
        fieldId: 'turnAddr',
        title: '🔁 TURN代理验证',
        label: 'TURN代理:',
        placeholder: 'user:password@127.0.0.1:3478'
    },
    sstp: {
        type: 'sstp',
        fieldId: 'sstpAddr',
        title: '🔐 SSTP代理验证',
        label: 'SSTP代理:',
        placeholder: 'user:password@127.0.0.1:443'
    }
};

function getProxyVerificationConfig(proxyType) {
    return proxyVerificationConfigs[proxyType] || proxyVerificationConfigs.http;
}

function openProxyVerificationModal(proxyType) {
    const config = getProxyVerificationConfig(proxyType);
    currentProxyType = config.type;
    currentProxyFieldId = config.fieldId;
    // 设置模态框标题和标签
    document.getElementById('proxyVerificationTitle').textContent = config.title;
    document.getElementById('proxyVerificationLabel').textContent = config.label;
    document.getElementById('proxyVerificationInput').placeholder = config.placeholder;
    // 设置输入框的当前值
    const currentValue = document.getElementById(currentProxyFieldId).value;
    document.getElementById('proxyVerificationInput').value = currentValue;
    // 重置状态
    document.getElementById('proxyVerificationStatus').style.display = 'none';
    document.getElementById('proxyVerificationStatus').textContent = '';
    document.getElementById('proxyConfirmBtn').disabled = true;
    document.getElementById('proxyConfirmBtn').style.opacity = '0.5';
    // 显示模态框
    document.getElementById('proxyVerificationModal').classList.add('show');
}

function closeProxyVerificationModal(event) {
    document.getElementById('proxyVerificationModal').classList.remove('show');
    currentProxyType = null;
    currentProxyFieldId = null;
    document.getElementById('proxyVerificationInput').value = '';
    document.getElementById('proxyVerificationStatus').style.display = 'none';
}
async function verifyProxyAvailability() {
    const input = document.getElementById('proxyVerificationInput').value.trim();
    if (!input) {
        showProxyVerificationStatus('请输入代理地址', 'error');
        return;
    }
    // 预处理代理地址
    const processedAddress = processProxyAddressForValidation(input, currentProxyType);
    if (!processedAddress) {
        showProxyVerificationStatus('代理地址格式无效', 'error');
        return;
    }
    const statusEl = document.getElementById('proxyVerificationStatus');
    const verifyBtn = document.querySelector('#proxyVerificationModal .btn-verify-api');
    try {
        verifyBtn.disabled = true;
        statusEl.textContent = '⏳ 验证中...';
        statusEl.style.display = 'block';
        statusEl.style.background = 'linear-gradient(135deg, #3b82f6 0, #1d4ed8 100%)';
        statusEl.style.color = '#fff';
        statusEl.style.padding = '16px';
        statusEl.style.borderRadius = '8px';
        // 构建请求参数
        const params = new URLSearchParams();
        params.append(currentProxyType, processedAddress);
        // 创建 AbortController 实现 5 秒超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(`/admin/check?${params}&_t=${Date.now()}`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        // 检查是否有 success 字段
        if (!data.hasOwnProperty('success')) {
            statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
            statusEl.style.padding = '16px';
            statusEl.style.borderRadius = '8px';
            statusEl.innerHTML = '❌ <strong>后端版本过旧</strong><br/><small style="opacity: 0.9;">请升级 edgetunnel 代码</small>';
            document.getElementById('proxyConfirmBtn').disabled = true;
            document.getElementById('proxyConfirmBtn').style.opacity = '0.5';
        } else if (data.success === false) {
            statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
            statusEl.style.padding = '16px';
            statusEl.style.borderRadius = '8px';
            statusEl.innerHTML = `❌ <strong>代理无效</strong><br/><small style="opacity: 0.9;">${data.error || '未知错误'}</small>`;
            document.getElementById('proxyConfirmBtn').disabled = true;
            document.getElementById('proxyConfirmBtn').style.opacity = '0.5';
        } else if (data.success === true) {
            const ip = data.ip || '未知';
            const loc = data.loc || '未知';
            const responseTime = data.responseTime || 0;
            const responseTimeDisplay = responseTime > 0 ? `${responseTime}ms` : '未知';
            statusEl.style.background = 'linear-gradient(135deg, #10b981 0, #059669 100%)';
            statusEl.style.padding = '16px';
            statusEl.style.borderRadius = '8px';
            statusEl.innerHTML = `
				<div style="display: flex; flex-direction: column; gap: 10px; font-family: 'Inter', system-ui, sans-serif;">
					<!-- 顶部标题栏 -->
					<div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 8px; margin-bottom: 2px;">
						<div style="display: flex; align-items: center; gap: 8px;">
							<div style="width: 8px; height: 8px; background: #fff; border-radius: 50%; box-shadow: 0 0 8px #fff; animation: pulse 2s infinite;"></div>
							<span style="font-weight: 700; font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: #fff;">Connection Secured</span>
						</div>
						<span style="font-size: 10px; opacity: 0.7; font-family: 'Fira Code', monospace; color: #fff;">STATUS: 200 OK</span>
					</div>
					
					<!-- 信息网格 -->
					<div style="display: grid; grid-template-columns: 0.4fr 1.2fr; gap: 8px;">
						<div style="background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); min-width: 0; max-width: 100px;">
							<div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; color: #fff;">区域 (Region)</div>
							<div style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff;" title="${loc}">${loc}</div>
						</div>
						<div style="background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); min-width: 0;">
							<div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; text-align: center;">落地地址 (IP)</div>
							<div style="font-family: 'Fira Code', monospace; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; color: #fff; text-decoration: underline; min-width: 0;" onclick="showIpDetailForProxy('${ip}', this)">
								<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ip}">${ip}</span>
								<span style="font-size: 12px; opacity: 0.8; flex-shrink: 0;">🔍</span>
							</div>
						</div>
					</div>
					
					<!-- 底部延迟栏 -->
					<div style="background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #fff;">
						<div style="display: flex; align-items: center; gap: 6px;">
							<span style="font-size: 14px;">⏱️</span>
							<span style="font-size: 11px; font-weight: 500; opacity: 0.9; color: #fff;">响应延迟</span>
						</div>
						<div style="font-family: 'Orbitron', sans-serif; font-size: 16px; font-weight: 800; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.3);">
							${responseTimeDisplay}
						</div>
					</div>
				</div>
			`;
            // 启用确定按钮
            document.getElementById('proxyConfirmBtn').disabled = false;
            document.getElementById('proxyConfirmBtn').style.opacity = '1';
            // 存储验证后的地址以备后用
            document.getElementById('proxyConfirmBtn').dataset.validAddress = processedAddress;
        }
    } catch (error) {
        statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
        statusEl.style.padding = '16px';
        statusEl.style.borderRadius = '8px';
        // 判断是否为超时错误
        if (error.name === 'AbortError') {
            statusEl.innerHTML = `❌ <strong>验证超时</strong><br/><small style="opacity: 0.9;">请求超过 10 秒无响应，请检查代理连接</small>`;
        } else {
            statusEl.innerHTML = `❌ <strong>验证失败</strong><br/><small style="opacity: 0.9;">${error.message}</small>`;
        }
        document.getElementById('proxyConfirmBtn').disabled = true;
        document.getElementById('proxyConfirmBtn').style.opacity = '0.5';
    } finally {
        verifyBtn.disabled = false;
    }
}

function processProxyAddressForValidation(input, type) {
    input = input.trim();
    // 移除开头的 "/" 或 "/"
    if (input.startsWith('/')) {
        input = input.substring(1).trim();
    }
    // 检测并移除协议前缀
    const socks5Prefixes = ['socks5://', 'socks5=', 'socks5://'];
    const httpPrefixes = ['http://', 'http='];
    const httpsPrefixes = ['https://', 'https='];
    const turnPrefixes = ['turn://', 'turn='];
    const sstpPrefixes = ['sstp://', 'sstp='];
    for (const prefix of socks5Prefixes) {
        if (input.toLowerCase().startsWith(prefix)) {
            input = input.substring(prefix.length).trim();
            break;
        }
    }
    for (const prefix of httpPrefixes) {
        if (input.toLowerCase().startsWith(prefix)) {
            input = input.substring(prefix.length).trim();
            break;
        }
    }
    for (const prefix of httpsPrefixes) {
        if (input.toLowerCase().startsWith(prefix)) {
            input = input.substring(prefix.length).trim();
            break;
        }
    }
    for (const prefix of turnPrefixes) {
        if (input.toLowerCase().startsWith(prefix)) {
            input = input.substring(prefix.length).trim();
            break;
        }
    }
    for (const prefix of sstpPrefixes) {
        if (input.toLowerCase().startsWith(prefix)) {
            input = input.substring(prefix.length).trim();
            break;
        }
    }
    // 移除末尾的备注（#符号之后的内容）
    if (input.includes('#')) {
        input = input.split('#')[0].trim();
    }
    return input;
}

function showProxyVerificationStatus(message, type) {
    const statusEl = document.getElementById('proxyVerificationStatus');
    const prefix = type === 'error' ? '❌' : 'ℹ️';
    statusEl.textContent = prefix + ' ' + message;
    statusEl.style.display = 'block';
    if (type === 'error') {
        statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
    } else {
        statusEl.style.background = 'linear-gradient(135deg, #3b82f6 0, #1d4ed8 100%)';
    }
    statusEl.style.color = '#fff';
}
async function fetchAndShowIpDetail(ip, targetElement = null) {
    let cleanIp = String(ip || '').trim();
    if (cleanIp.includes('*') && targetElement && targetElement.dataset && targetElement.dataset.rawValue) {
        cleanIp = String(targetElement.dataset.rawValue || '').trim();
    }
    if (!cleanIp || cleanIp === '未知') {
        return;
    }
    if (targetElement) {
        if (targetElement.classList.contains('is-loading')) {
            return; // 正在加载中,不重复请求
        }
        targetElement.classList.add('is-loading');
        targetElement.setAttribute('aria-busy', 'true');
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
        let response;
        let fromPrimary = false;
        try {
            response = await fetch(`https://api.ipapi.is/?q=${cleanIp}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Primary API failed');
            fromPrimary = true;
        } catch (e) {
            console.warn('Primary IP API failed, trying fallback...', e);
            response = await fetch(`https://api.090227.xyz/api/ipapi?ip=${cleanIp}`);
            if (!response.ok) throw new Error('Fallback API failed');
        }
        const data = await response.json();
        // 主 API(ipapi.is) 返回新版扁平结构，归一化为旧版嵌套结构供弹窗展示；fallback 数据保持原样透传
        const modalData = fromPrimary ? normalizeIpapiData(data) : data;
        // 显示详情弹窗
        showIpDetailModal(modalData);
    } catch (error) {
        showToast('❌ 查询IP详细信息失败');
        console.error('IP查询错误:', error);
    } finally {
        if (targetElement) {
            targetElement.classList.remove('is-loading');
            targetElement.removeAttribute('aria-busy');
        }
    }
}

function showIpDetailForProxy(ip, element = null) {
    fetchAndShowIpDetail(ip, element);
}

function confirmProxyAddress() {
    const validAddress = document.getElementById('proxyConfirmBtn').dataset.validAddress;
    if (!validAddress) return;
    document.getElementById(currentProxyFieldId).value = validAddress;
    setProxyModeSelection(currentProxyType);
    updateProxyMode(false, false);
    markModified('proxy');
    closeProxyVerificationModal();
}

function getDefaultChainProxyHost() {
    const hostname = String(window.location.hostname || '').trim();
    return hostname || String(document.getElementById('nodeHost') ? .value || '').trim();
}

function openChainProxyModal() {
    if (!chainProxyFeatureEnabled) {
        showToast('当前后端版本暂不支持链式代理', 'error');
        return;
    }
    const modal = document.getElementById('chainProxyModal');
    const nodeNameInput = document.getElementById('chainProxyNodeName');
    const hostInput = document.getElementById('chainProxyHost');
    const portInput = document.getElementById('chainProxyPort');
    const protocolSelect = document.getElementById('chainProxyProtocol');
    const addressInput = document.getElementById('chainProxyAddress');
    const statusEl = document.getElementById('chainProxyStatus');
    const addBtn = document.getElementById('btnAddChainProxy');
    if (!modal || !nodeNameInput || !hostInput || !portInput || !protocolSelect || !addressInput) return;
    nodeNameInput.value = '';
    nodeNameInput.placeholder = '链式代理';
    hostInput.value = getDefaultChainProxyHost();
    hostInput.placeholder = getDefaultChainProxyHost() || '当前网页域名';
    portInput.value = '';
    protocolSelect.value = 'socks5';
    addressInput.value = '';
    if (statusEl) {
        statusEl.style.display = 'none';
        statusEl.textContent = '';
    }
    if (addBtn) {
        addBtn.disabled = true;
        delete addBtn.dataset.validProtocol;
        delete addBtn.dataset.validAddress;
        delete addBtn.dataset.validKey;
        delete addBtn.dataset.defaultNodeName;
    }
    updateChainProxyVerifyState(false);
    modal.classList.add('show');
    setTimeout(() => addressInput.focus(), 0);
}

function closeChainProxyModal() {
    document.getElementById('chainProxyModal') ? .classList.remove('show');
}

function resetChainProxyValidation() {
    const addBtn = document.getElementById('btnAddChainProxy');
    const nodeNameInput = document.getElementById('chainProxyNodeName');
    const statusEl = document.getElementById('chainProxyStatus');
    if (addBtn) {
        addBtn.disabled = true;
        delete addBtn.dataset.validProtocol;
        delete addBtn.dataset.validAddress;
        delete addBtn.dataset.validKey;
        delete addBtn.dataset.defaultNodeName;
    }
    if (nodeNameInput && !String(nodeNameInput.value || '').trim()) {
        nodeNameInput.placeholder = '链式代理';
    }
    if (statusEl) {
        statusEl.style.display = 'none';
        statusEl.textContent = '';
    }
    updateChainProxyVerifyState(false);
}

function updateChainProxyVerifyState(resetValidation = true) {
    if (resetValidation) {
        const addBtn = document.getElementById('btnAddChainProxy');
        const nodeNameInput = document.getElementById('chainProxyNodeName');
        const statusEl = document.getElementById('chainProxyStatus');
        if (addBtn) {
            addBtn.disabled = true;
            delete addBtn.dataset.validProtocol;
            delete addBtn.dataset.validAddress;
            delete addBtn.dataset.validKey;
            delete addBtn.dataset.defaultNodeName;
        }
        if (nodeNameInput && !String(nodeNameInput.value || '').trim()) {
            nodeNameInput.placeholder = '链式代理';
        }
        if (statusEl) {
            statusEl.style.display = 'none';
            statusEl.textContent = '';
        }
    }
    const addressInput = document.getElementById('chainProxyAddress');
    const verifyBtn = document.getElementById('btnVerifyChainProxy');
    if (!verifyBtn) return;
    verifyBtn.disabled = !String(addressInput ? .value || '').trim();
}

function normalizeChainProxyNodeName(value) {
    const cleanValue = String(value || '').replace(/[\r\n]+/g, ' ').trim();
    if (!cleanValue) return '';
    try {
        return decodeURIComponent(cleanValue);
    } catch (error) {
        return cleanValue;
    }
}

function sanitizeChainProxyAddressInput() {
    const addressInput = document.getElementById('chainProxyAddress');
    const protocolSelect = document.getElementById('chainProxyProtocol');
    const nodeNameInput = document.getElementById('chainProxyNodeName');
    if (!addressInput || !protocolSelect) return;
    let value = addressInput.value.trimStart();
    const lowerValue = value.toLowerCase();
    for (const protocol of PROXY_PROTOCOLS) {
        const protocolPrefix = `${protocol}://`;
        const legacyPrefix = `${protocol}=`;
        if (lowerValue.startsWith(protocolPrefix)) {
            protocolSelect.value = protocol;
            value = value.slice(protocolPrefix.length).trimStart();
            break;
        }
        if (lowerValue.startsWith(legacyPrefix)) {
            protocolSelect.value = protocol;
            value = value.slice(legacyPrefix.length).trimStart();
            break;
        }
    }
    const hashIndex = value.indexOf('#');
    if (hashIndex >= 0) {
        const nodeName = normalizeChainProxyNodeName(value.slice(hashIndex + 1));
        if (nodeName && nodeNameInput) {
            nodeNameInput.value = nodeName;
        }
        value = value.slice(0, hashIndex).trimEnd();
    }
    if (addressInput.value !== value) {
        addressInput.value = value;
    }
}

function normalizeChainProxyPortInput() {
    const portInput = document.getElementById('chainProxyPort');
    if (!portInput) return;
    let value = portInput.value.replace(/\D/g, '');
    if (value) {
        const numberValue = Number(value);
        if (numberValue < 1) value = '1';
        if (numberValue > 65535) value = '65535';
    }
    portInput.value = value;
}

function showChainProxyStatus(message, type = 'info', asHtml = false) {
    const statusEl = document.getElementById('chainProxyStatus');
    if (!statusEl) return;
    if (asHtml) {
        statusEl.innerHTML = message;
    } else {
        statusEl.textContent = message;
    }
    statusEl.style.display = 'block';
    statusEl.style.padding = type === 'chain-success' ? '0' : '14px 16px';
    statusEl.style.color = type === 'chain-success' ? '' : '#fff';
    statusEl.style.background = type === 'chain-success' ? 'transparent' : type === 'success' ? 'linear-gradient(135deg, #10b981 0, #059669 100%)' : type === 'error' ? 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)' : 'linear-gradient(135deg, #3b82f6 0, #1d4ed8 100%)';
}

function maskChainProxyAddressForDisplay(address) {
    const raw = String(address || '').trim();
    const atIndex = raw.lastIndexOf('@');
    if (atIndex <= 0) return raw;
    const userInfo = raw.slice(0, atIndex);
    const target = raw.slice(atIndex + 1);
    const colonIndex = userInfo.indexOf(':');
    if (colonIndex < 0) return `***@${target}`;
    return `${userInfo.slice(0, colonIndex)}:***@${target}`;
}

function extractChainProxyCountryCode(loc) {
    const value = String(loc || '').trim().toUpperCase();
    if (!value || value === '未知') return '';
    const bracketMatch = value.match(/\[([A-Z]{2})\]/);
    if (bracketMatch) return bracketMatch[1];
    const codeMatch = value.match(/\b[A-Z]{2}\b/);
    if (codeMatch) return codeMatch[0];
    return '';
}

function buildChainProxyDefaultNodeName(loc, protocol) {
    const countryCode = extractChainProxyCountryCode(loc);
    const protocolLabel = normalizeProxyProtocol(protocol || 'socks5').toUpperCase();
    return `${countryCode ? `${countryCode} ` : ''}链式${protocolLabel}代理`;
}

function buildChainProxyPreferredEndpoint(host, port) {
    const cleanHost = String(host || '').trim() || '未填写';
    const cleanPort = String(port || '').trim();
    return cleanPort ? `${cleanHost}:${cleanPort}` : cleanHost;
}

function renderChainProxyAvailabilitySuccessCard(options) {
    const {
        ip,
        loc,
        responseTimeDisplay,
        preferredHost,
        preferredPort,
        protocol,
        proxyAddress
    } = options || {};
    const safeIp = escapeMarkdownHtml(ip || '未知');
    const safeLoc = escapeMarkdownHtml(loc || '未知');
    const safeResponseTime = escapeMarkdownHtml(responseTimeDisplay || '未知');
    const safeBadgeRegion = escapeMarkdownHtml(extractChainProxyCountryCode(loc) || loc || '未知');
    const safePreferred = escapeMarkdownHtml(buildChainProxyPreferredEndpoint(preferredHost, preferredPort));
    const safeProtocol = escapeMarkdownHtml(protocol || 'socks5');
    const safeProtocolLabel = escapeMarkdownHtml(`${protocol || 'socks5'}代理`);
    const safeProxyAddress = escapeMarkdownHtml(maskChainProxyAddressForDisplay(proxyAddress || ''));
    return `
		<div class="chain-verify-card">
			<div class="chain-verify-head">
				<div class="chain-verify-title">
					<span class="chain-verify-dot"></span>
					<span>验证通过</span>
				</div>
				<span class="chain-verify-badge" title="地区: ${safeLoc} ${safeResponseTime}">地区: ${safeBadgeRegion} ${safeResponseTime}</span>
			</div>

			<div class="chain-verify-body">
				<div class="chain-route">
					<div class="chain-route-node">
						<div class="chain-route-label">优选入口</div>
						<div class="chain-route-value" title="${safePreferred}">${safePreferred}</div>
					</div>
					<div class="chain-route-arrow">→</div>
					<div class="chain-route-node">
						<div class="chain-route-label">${safeProtocolLabel}</div>
						<div class="chain-route-value" title="${safeProtocol}://${safeProxyAddress}">${safeProtocol}://${safeProxyAddress}</div>
					</div>
					<div class="chain-route-arrow">→</div>
					<div class="chain-route-node">
						<div class="chain-route-label">落地地址</div>
						<div class="chain-route-value chain-ip-link" data-raw-value="${safeIp}" onclick="showIpDetailForProxy(this.dataset.rawValue, this)" title="${safeIp}">
							${safeIp} 🔍
						</div>
					</div>
				</div>
			</div>
		</div>
	`;
}

function getChainProxyValidationKey(protocol, address) {
    return `${protocol}://${address}`;
}
async function verifyChainProxyAvailability() {
    const protocolSelect = document.getElementById('chainProxyProtocol');
    const addressInput = document.getElementById('chainProxyAddress');
    const verifyBtn = document.getElementById('btnVerifyChainProxy');
    const addBtn = document.getElementById('btnAddChainProxy');
    const protocol = normalizeProxyProtocol(protocolSelect ? .value || 'socks5');
    const input = String(addressInput ? .value || '').trim();
    if (!input) {
        showChainProxyStatus('❌ 请输入链式代理地址', 'error');
        updateChainProxyVerifyState(false);
        return;
    }
    const processedAddress = processProxyAddressForValidation(input, protocol);
    if (!processedAddress) {
        showChainProxyStatus('❌ 链式代理地址格式无效', 'error');
        updateChainProxyVerifyState(false);
        return;
    }
    const validationKey = getChainProxyValidationKey(protocol, processedAddress);
    if (addBtn) {
        addBtn.disabled = true;
        delete addBtn.dataset.validProtocol;
        delete addBtn.dataset.validAddress;
        delete addBtn.dataset.validKey;
        delete addBtn.dataset.defaultNodeName;
    }
    try {
        if (verifyBtn) verifyBtn.disabled = true;
        showChainProxyStatus('⏳ 验证中...', 'info');
        const params = new URLSearchParams();
        params.append(protocol, processedAddress);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(`/admin/check?${params}&_t=${Date.now()}`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        if (!Object.prototype.hasOwnProperty.call(data, 'success')) {
            showChainProxyStatus('❌ <strong>后端版本过旧</strong><br><small style="opacity: 0.9;">请升级 edgetunnel 代码</small>', 'error', true);
            return;
        }
        if (data.success === false) {
            showChainProxyStatus(`❌ <strong>代理无效</strong><br><small style="opacity: 0.9;">${escapeMarkdownHtml(data.error || '未知错误')}</small>`, 'error', true);
            return;
        }
        const currentProtocol = normalizeProxyProtocol(protocolSelect ? .value || 'socks5');
        const currentProcessedAddress = processProxyAddressForValidation(String(addressInput ? .value || '').trim(), currentProtocol);
        if (validationKey !== getChainProxyValidationKey(currentProtocol, currentProcessedAddress)) {
            showChainProxyStatus('ℹ️ 链式代理内容已变化，请重新验证', 'info');
            return;
        }
        const ip = data.ip || '未知';
        const loc = data.loc || '未知';
        const responseTime = data.responseTime || 0;
        const responseTimeDisplay = responseTime > 0 ? `${responseTime}ms` : '未知';
        const defaultNodeName = buildChainProxyDefaultNodeName(loc, protocol);
        const nodeNameInput = document.getElementById('chainProxyNodeName');
        if (nodeNameInput && !String(nodeNameInput.value || '').trim()) {
            nodeNameInput.placeholder = defaultNodeName;
        }
        const previewHost = normalizeChainProxyPreferredHost(document.getElementById('chainProxyHost') ? .value || getDefaultChainProxyHost());
        const previewPort = String(document.getElementById('chainProxyPort') ? .value || '').trim();
        showChainProxyStatus(renderChainProxyAvailabilitySuccessCard({
            ip,
            loc,
            responseTimeDisplay,
            preferredHost: previewHost,
            preferredPort: previewPort,
            protocol,
            proxyAddress: processedAddress
        }), 'chain-success', true);
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.dataset.validProtocol = protocol;
            addBtn.dataset.validAddress = processedAddress;
            addBtn.dataset.validKey = validationKey;
            addBtn.dataset.defaultNodeName = defaultNodeName;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            showChainProxyStatus('❌ <strong>验证超时</strong><br><small style="opacity: 0.9;">请求超过 10 秒无响应，请检查代理连接</small>', 'error', true);
        } else {
            showChainProxyStatus(`❌ <strong>验证失败</strong><br><small style="opacity: 0.9;">${escapeMarkdownHtml(error.message)}</small>`, 'error', true);
        }
    } finally {
        if (verifyBtn) {
            verifyBtn.disabled = !String(addressInput ? .value || '').trim();
        }
    }
}

function normalizeChainProxyPreferredHost(host) {
    const cleanHost = String(host || '').replace(/[\r\n]+/g, '').trim();
    const colonCount = (cleanHost.match(/:/g) || []).length;
    if (colonCount > 1 && !cleanHost.startsWith('[') && !cleanHost.endsWith(']')) {
        return `[${cleanHost}]`;
    }
    return cleanHost;
}

function addChainProxyNode() {
    const addBtn = document.getElementById('btnAddChainProxy');
    const validProtocol = addBtn ? .dataset.validProtocol || '';
    const validAddress = addBtn ? .dataset.validAddress || '';
    const protocolSelect = document.getElementById('chainProxyProtocol');
    const addressInput = document.getElementById('chainProxyAddress');
    const currentProtocol = normalizeProxyProtocol(protocolSelect ? .value || 'socks5');
    const currentAddress = processProxyAddressForValidation(String(addressInput ? .value || '').trim(), currentProtocol);
    const currentKey = getChainProxyValidationKey(currentProtocol, currentAddress);
    if (!validProtocol || !validAddress) {
        showToast('请先点击"可用性验证"按钮通过验证', 'error');
        return;
    }
    if (addBtn ? .dataset.validKey !== currentKey) {
        showToast('链式代理内容已变化，请重新验证', 'error');
        resetChainProxyValidation();
        return;
    }
    const nodeName = String(document.getElementById('chainProxyNodeName') ? .value || '').replace(/[\r\n]+/g, ' ').trim() || addBtn ? .dataset.defaultNodeName || buildChainProxyDefaultNodeName('', validProtocol);
    const preferredHost = normalizeChainProxyPreferredHost(document.getElementById('chainProxyHost') ? .value || getDefaultChainProxyHost());
    const portValue = String(document.getElementById('chainProxyPort') ? .value || '').trim();
    const portNumber = portValue ? Number(portValue) : null;
    if (!preferredHost) {
        showChainProxyStatus('❌ 优选域名/IP不能为空', 'error');
        return;
    }
    if (portValue && (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535)) {
        showChainProxyStatus('❌ 优选端口只能填写 1~65535 的数字', 'error');
        return;
    }
    const chainProxyURL = `${validProtocol}://${validAddress}`;
    const preferredEndpoint = buildChainProxyPreferredEndpoint(preferredHost, portNumber);
    const line = `${preferredEndpoint}#${nodeName}$${chainProxyURL}`;
    const customIPsTextarea = document.getElementById('customIPs');
    if (!customIPsTextarea) return;
    const currentValue = customIPsTextarea.value.trim();
    customIPsTextarea.value = currentValue ? `${currentValue}\n${line}` : line;
    if (customIPsTextarea._refreshLineEditor) {
        customIPsTextarea._refreshLineEditor();
    }
    markModified('sub');
    closeChainProxyModal();
    showToast('✅ 链式代理节点已追加到自定义优选地址', 'success');
}

function openSubAPIModal() {
    const currentValue = document.getElementById('subAPI').value;
    document.getElementById('subAPIStatus').style.display = 'none';
    document.getElementById('subAPIStatus').textContent = '';
    document.getElementById('subAPIConfirmBtn').disabled = true;
    document.getElementById('subAPIConfirmBtn').style.opacity = '0.5';
    document.getElementById('subAPIModal').classList.add('show');
    // 加载 SUBAPI 列表
    loadSubAPIList(currentValue);
}

function closeSubAPIModal(event) {
    if (event && event.target.id !== 'subAPIModal') return;
    document.getElementById('subAPIModal').classList.remove('show');
    document.getElementById('testSubAPIInput').value = '';
    document.getElementById('subAPIStatus').style.display = 'none';
}
async function loadSubAPIList(currentValue) {
    const selectEl = document.getElementById('subAPISelect');
    selectEl.innerHTML = '<option value="">-- 加载中，请稍候 --</option>';
    try {
        const jsonText = await fetchWithAutoMirror('https://raw.githubusercontent.com/cmliu/cmliu/main/SUBAPI.json', 'SUBAPI 列表');
        const apiList = JSON.parse(jsonText);
        // 清空选项
        selectEl.innerHTML = '';
        // 添加 API 列表的选项
        apiList.forEach(item => {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = `${item.label}[${item.value}]`;
            selectEl.appendChild(option);
        });
        // 添加自定义选项
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '🔧 自定义';
        selectEl.appendChild(customOption);
        // 尝试匹配当前值（大小写不敏感比较）
        if (currentValue && currentValue.trim()) {
            const currentValueLower = currentValue.trim().toLowerCase();
            const matchedOption = Array.from(selectEl.options).find(opt => opt.value.toLowerCase() === currentValueLower);
            if (matchedOption) {
                // 找到了匹配的选项
                selectEl.value = matchedOption.value;
                document.getElementById('customSubAPIInputGroup').style.display = 'none';
                document.getElementById('testSubAPIInput').value = '';
            } else {
                // 没有找到匹配的选项，说明是自定义的
                selectEl.value = 'custom';
                document.getElementById('testSubAPIInput').value = currentValue.trim();
                document.getElementById('customSubAPIInputGroup').style.display = 'block';
            }
        } else {
            // 没有当前值，显示第一个选项
            selectEl.value = '';
            document.getElementById('customSubAPIInputGroup').style.display = 'none';
            document.getElementById('testSubAPIInput').value = '';
        }
    } catch (error) {
        console.error('加载 SUBAPI 列表失败:', error);
        selectEl.innerHTML = '<option value="custom">🔧 自定义</option>';
        selectEl.value = 'custom';
        document.getElementById('customSubAPIInputGroup').style.display = 'block';
        if (currentValue && currentValue.trim()) {
            document.getElementById('testSubAPIInput').value = currentValue.trim();
        } else {
            document.getElementById('testSubAPIInput').value = '';
        }
    }
}

function handleSubAPISelectChange() {
    const selectEl = document.getElementById('subAPISelect');
    const customInputGroup = document.getElementById('customSubAPIInputGroup');
    const testInput = document.getElementById('testSubAPIInput');
    if (selectEl.value === 'custom') {
        customInputGroup.style.display = 'block';
        testInput.focus();
    } else {
        customInputGroup.style.display = 'none';
        testInput.value = selectEl.value;
    }
}
// ProxyIP 帮助模态框函数
function showProxyIPHelpModal() {
    const simpleDiv = document.getElementById('proxyIPHelpSimple');
    if (simpleDiv) simpleDiv.style.display = 'block';
    document.getElementById('proxyIPHelpModal').classList.add('show');
}

function closeProxyIPHelpModal(event) {
    if (event && event.target.id !== 'proxyIPHelpModal') return;
    document.getElementById('proxyIPHelpModal').classList.remove('show');
}
// 路径模板配置函数
let pathTemplatePresets = [];
let pathTemplateOriginal = {};
async function showPathTemplateConfigModal() {
    const modal = document.getElementById('pathTemplateConfigModal');
    modal.classList.add('show');
    // 初始化原始值
    pathTemplateOriginal = JSON.parse(JSON.stringify(currentConfig.反代 ? .路径模板 || {}));
    // 加载预设模板
    await loadPathTemplatePresets();
    // 填充当前配置到文本框（添加"/"前缀用于显示）
    document.getElementById('proxyIPTemplateInput').value = '/' + (currentConfig.反代 ? .路径模板 ? .PROXYIP || '');
    document.getElementById('socks5StandardTemplateInput').value = '/' + (currentConfig.反代 ? .路径模板 ? .SOCKS5 ? .标准 || '');
    document.getElementById('socks5GlobalTemplateInput').value = '/' + (currentConfig.反代 ? .路径模板 ? .SOCKS5 ? .全局 || '');
    document.getElementById('httpStandardTemplateInput').value = '/' + (currentConfig.反代 ? .路径模板 ? .HTTP ? .标准 || '');
    document.getElementById('httpGlobalTemplateInput').value = '/' + (currentConfig.反代 ? .路径模板 ? .HTTP ? .全局 || '');
    // 初始化验证状态
    validatePathTemplate('proxyIPTemplateInput', currentConfig.反代 ? .路径模板 ? .PROXYIP || '');
    validatePathTemplate('socks5StandardTemplateInput', currentConfig.反代 ? .路径模板 ? .SOCKS5 ? .标准 || '');
    validatePathTemplate('socks5GlobalTemplateInput', currentConfig.反代 ? .路径模板 ? .SOCKS5 ? .全局 || '');
    validatePathTemplate('httpStandardTemplateInput', currentConfig.反代 ? .路径模板 ? .HTTP ? .标准 || '');
    validatePathTemplate('httpGlobalTemplateInput', currentConfig.反代 ? .路径模板 ? .HTTP ? .全局 || '');
    // 禁用保存按钮
    document.getElementById('pathTemplateSaveBtn').disabled = true;
    // 重置预设模板选择
    document.getElementById('presetTemplateSelect').value = 'custom';
}

function closePathTemplateConfigModal(event) {
    if (event && event.target.id !== 'pathTemplateConfigModal') return;
    document.getElementById('pathTemplateConfigModal').classList.remove('show');
}
async function loadPathTemplatePresets() {
    try {
        const url = 'https://raw.githubusercontent.com/cmliu/cmliu/main/json/edt-path-config.json';
        const text = await fetchWithAutoMirror(url, '路径模板配置');
        pathTemplatePresets = JSON.parse(text);
        const select = document.getElementById('presetTemplateSelect');
        // 清除除"自定义"外的所有选项
        while (select.options.length > 1) {
            select.remove(1);
        }
        // 添加预设模板选项
        pathTemplatePresets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.项目名;
            option.textContent = preset.项目名;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('加载路径模板预设失败:', error);
        showToast('加载预设模板失败: ' + error.message, 'error');
    }
}

function onPresetTemplateChange() {
    const select = document.getElementById('presetTemplateSelect');
    const selectedValue = select.value;
    if (selectedValue === 'custom') {
        return;
    }
    // 找到对应的预设
    const preset = pathTemplatePresets.find(p => p.项目名 === selectedValue);
    if (!preset) return;
    // 显示提示消息
    showToast(preset.提示消息, 'info');
    // 填充模板（添加"/"前缀用于显示）
    document.getElementById('proxyIPTemplateInput').value = '/' + (preset.路径模板.PROXYIP || '');
    document.getElementById('socks5StandardTemplateInput').value = '/' + (preset.路径模板.SOCKS5.标准 || '');
    document.getElementById('socks5GlobalTemplateInput').value = '/' + (preset.路径模板.SOCKS5.全局 || '');
    document.getElementById('httpStandardTemplateInput').value = '/' + (preset.路径模板.HTTP.标准 || '');
    document.getElementById('httpGlobalTemplateInput').value = '/' + (preset.路径模板.HTTP.全局 || '');
    // 验证填充后的内容
    validatePathTemplate('proxyIPTemplateInput', preset.路径模板.PROXYIP || '');
    validatePathTemplate('socks5StandardTemplateInput', preset.路径模板.SOCKS5.标准 || '');
    validatePathTemplate('socks5GlobalTemplateInput', preset.路径模板.SOCKS5.全局 || '');
    validatePathTemplate('httpStandardTemplateInput', preset.路径模板.HTTP.标准 || '');
    validatePathTemplate('httpGlobalTemplateInput', preset.路径模板.HTTP.全局 || '');
    // 亮起保存按钮
    document.getElementById('pathTemplateSaveBtn').disabled = false;
}

function onPathTemplateInput() {
    // 获取所有模板输入框的值（去掉开头的"/"用于对比）
    const proxyIP = document.getElementById('proxyIPTemplateInput').value.replace(/^\//, '');
    const socks5Standard = document.getElementById('socks5StandardTemplateInput').value.replace(/^\//, '');
    const socks5Global = document.getElementById('socks5GlobalTemplateInput').value.replace(/^\//, '');
    const httpStandard = document.getElementById('httpStandardTemplateInput').value.replace(/^\//, '');
    const httpGlobal = document.getElementById('httpGlobalTemplateInput').value.replace(/^\//, '');
    // 验证每个输入框是否包含占位符，没有则标记为invalid
    validatePathTemplate('proxyIPTemplateInput', proxyIP);
    validatePathTemplate('socks5StandardTemplateInput', socks5Standard);
    validatePathTemplate('socks5GlobalTemplateInput', socks5Global);
    validatePathTemplate('httpStandardTemplateInput', httpStandard);
    validatePathTemplate('httpGlobalTemplateInput', httpGlobal);
    // 检查是否有任何内容发生变化
    const hasChanged = proxyIP !== (pathTemplateOriginal.PROXYIP || '') || socks5Standard !== (pathTemplateOriginal.SOCKS5 ? .标准 || '') || socks5Global !== (pathTemplateOriginal.SOCKS5 ? .全局 || '') || httpStandard !== (pathTemplateOriginal.HTTP ? .标准 || '') || httpGlobal !== (pathTemplateOriginal.HTTP ? .全局 || '');
    // 控制保存按钮的启用/禁用
    document.getElementById('pathTemplateSaveBtn').disabled = !hasChanged;
}

function validatePathTemplate(inputId, value) {
    const inputElement = document.getElementById(inputId);
    const wrapper = inputElement.closest('.path-template-input-wrapper');
    // 生成对应的错误提示的ID
    const errorId = inputId.replace('Input', 'Error');
    const errorElement = document.getElementById(errorId);
    // 如果内容不为空且不包含占位符，添加invalid样式并显示错误提示
    if (value.trim() && !value.includes('{{IP:PORT}}')) {
        wrapper.classList.add('invalid');
        if (errorElement) {
            errorElement.style.display = 'block';
        }
    } else {
        wrapper.classList.remove('invalid');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
}
async function savePathTemplateConfig() {
    // 获取输入框的值并去掉开头的"/"
    const proxyIP = document.getElementById('proxyIPTemplateInput').value.replace(/^\//, '');
    const socks5Standard = document.getElementById('socks5StandardTemplateInput').value.replace(/^\//, '');
    const socks5Global = document.getElementById('socks5GlobalTemplateInput').value.replace(/^\//, '');
    const httpStandard = document.getElementById('httpStandardTemplateInput').value.replace(/^\//, '');
    const httpGlobal = document.getElementById('httpGlobalTemplateInput').value.replace(/^\//, '');
    try {
        // 验证是否包含{{IP:PORT}}占位符
        const templates = [proxyIP, socks5Standard, socks5Global, httpStandard, httpGlobal].filter(t => t);
        if (templates.length > 0) {
            const hasPlaceholder = templates.every(t => t.includes('{{IP:PORT}}'));
            if (!hasPlaceholder) {
                showToast('当前路径模板存在缺失 {{IP:PORT}} 占位符', 'error');
                //return;
            }
        }
        // 更新currentConfig中的路径模板数据（不包含开头的"/"）
        if (!currentConfig.反代) {
            currentConfig.反代 = {};
        }
        if (!currentConfig.反代.路径模板) {
            currentConfig.反代.路径模板 = {};
        }
        currentConfig.反代.路径模板.PROXYIP = proxyIP;
        currentConfig.反代.路径模板.SOCKS5 = {
            标准: socks5Standard,
            全局: socks5Global
        };
        currentConfig.反代.路径模板.HTTP = {
            标准: httpStandard,
            全局: httpGlobal
        };
        // 通过saveConfigToServer保存到服务器
        await saveConfigToServer('pathTemplate');
        // 关闭模态框
        closePathTemplateConfigModal();
    } catch (error) {
        console.error('保存路径模板失败:', error);
        showToast('保存路径模板失败: ' + error.message, 'error');
    }
}
// 防止输出"#"字符，允许输入"?"
function preventInvalidChars(input) {
    input.value = input.value.replace(/#/g, '');
}

function preventInvalidCharsOnKeypress(event) {
    if (event.key === '#') {
        event.preventDefault();
    }
}
// 确保路径以"/"开头（虽然显示中已有前缀，但防止意外删除）
function ensurePathPrefix(input) {
    // 不在这里强制，而是在防删除函数中处理
}
// 防止删除路径前缀"/"
function preventPathPrefixDeletion(event, input) {
    // 只在删除键时处理
    if (event.key === 'Backspace' || event.key === 'Delete') {
        // 如果选中的文本包括位置0（开头），阻止删除
        if (input.selectionStart === 0 && event.key === 'Backspace') {
            event.preventDefault();
            return false;
        }
        // 如果光标在开头且按下Delete，防止删除
        if (input.selectionStart === 0 && event.key === 'Delete') {
            event.preventDefault();
            return false;
        }
    }
    // 防止在开头输入任何内容
    if (input.selectionStart === 0 && event.key && event.key.length === 1 && event.key !== '/') {
        // 将光标移动到位置1
        setTimeout(() => {
            input.setSelectionRange(1, 1);
        }, 0);
    }
}
// ECH 帮助模态框函数
function showECHHelpModal() {
    document.getElementById('echHelpModal').classList.add('show');
    // 计算并设置内容高度以适应浏览器高度
    setTimeout(() => {
        calculateECHContentHeight();
        // 窗口大小改变时重新计算
        window.addEventListener('resize', calculateECHContentHeight);
    }, 0);
}

function calculateECHContentHeight() {
    const modal = document.querySelector('.ech-help-modal');
    const tabContent = document.querySelector('.ech-tab-content');
    const tabs = document.querySelector('.ech-tabs');
    const closeBtn = document.querySelector('#echHelpModal .modal-close');
    const bottomBtn = document.querySelector('#echHelpModal .btn-close-modal');
    if (!modal || !tabContent) return;
    // 获取浏览器视口高度
    const viewportHeight = window.innerHeight;
    // 计算各个元素的高度（带上下文margin/padding）
    const modalPadding = 20; // 模态框内边距
    const tabsHeight = tabs ? tabs.offsetHeight + 15 : 50; // 选项卡高度 + margin
    const closeBtnHeight = 40; // 关闭按钮高度
    const bottomBtnHeight = bottomBtn ? bottomBtn.offsetHeight + 20 : 60; // 底部按钮高度 + margin
    const headerHeight = 20; // 其他上边距
    // 计算可用的内容高度
    // viewportHeight - (顶部padding + 选项卡 + 底部按钮 + 底部padding)
    const availableHeight = viewportHeight - (modalPadding * 2 + tabsHeight + bottomBtnHeight + headerHeight);
    // 设置最大高度，确保不超出视口
    tabContent.style.maxHeight = Math.max(200, availableHeight) + 'px';
}

function closeECHHelpModal(event) {
    if (event && event.target.id !== 'echHelpModal') return;
    document.getElementById('echHelpModal').classList.remove('show');
}

function showAuthTokenHelpModal(mode) {
    const displayMode = mode === 'uuid' ? 'uuid' : mode === 'customIPs' ? 'customIPs' : 'token';
    const modal = document.getElementById('authTokenHelpModal');
    const tokenSection = document.getElementById('authTokenTokenSection');
    const uuidSection = document.getElementById('authTokenUUIDSection');
    const customIPsSection = document.getElementById('authTokenCustomIPsSection');
    const titleEl = document.getElementById('authTokenHelpTitle');
    if (!modal || !tokenSection || !uuidSection || !customIPsSection) return;
    modal.dataset.mode = displayMode;
    tokenSection.style.display = displayMode === 'token' ? 'block' : 'none';
    uuidSection.style.display = displayMode === 'uuid' ? 'block' : 'none';
    customIPsSection.style.display = displayMode === 'customIPs' ? 'block' : 'none';
    if (titleEl) {
        if (displayMode === 'uuid') {
            titleEl.textContent = '🔑 如何修改 UUID？';
        } else if (displayMode === 'customIPs') {
            titleEl.textContent = '📍 自定义优选 填写说明';
        } else {
            titleEl.textContent = '🎫 如何修改订阅 TOKEN？';
        }
    }
    modal.classList.add('show');
}

function closeAuthTokenHelpModal(event) {
    if (event && event.target.id !== 'authTokenHelpModal') return;
    const modal = document.getElementById('authTokenHelpModal');
    if (!modal) return;
    delete modal.dataset.mode;
    modal.classList.remove('show');
}

function switchECHTab(tabIndex) {
    // 切换选项卡按钮状态
    const tabs = document.querySelectorAll('.ech-tab');
    tabs.forEach((tab, index) => {
        if (index === tabIndex) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    // 切换选项卡内容
    const panes = document.querySelectorAll('.ech-tab-pane');
    panes.forEach((pane, index) => {
        if (index === tabIndex) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
    // 自动滚动到活跃选项卡
    const activeTab = tabs[tabIndex];
    if (activeTab) {
        const tabsContainer = document.querySelector('.ech-tabs');
        if (tabsContainer) {
            activeTab.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }
}
// ECH 选项卡拖拽功能
function initECHTabsDrag() {
    const tabsContainer = document.querySelector('.ech-tabs');
    if (!tabsContainer) return;
    let isDown = false;
    let startX;
    let scrollLeft;
    let isDragged = false;
    tabsContainer.addEventListener('mousedown', (e) => {
        // 如果点击的是按钮，不启动拖拽
        if (e.target.closest('.ech-tab')) {
            isDown = true;
            isDragged = false;
            startX = e.pageX - tabsContainer.offsetLeft;
            scrollLeft = tabsContainer.scrollLeft;
            tabsContainer.classList.add('dragging');
        }
    });
    tabsContainer.addEventListener('mouseleave', () => {
        isDown = false;
        tabsContainer.classList.remove('dragging');
    });
    tabsContainer.addEventListener('mouseup', () => {
        isDown = false;
        tabsContainer.classList.remove('dragging');
    });
    tabsContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - tabsContainer.offsetLeft;
        const walk = (x - startX) * 1; // 拖拽速度
        if (Math.abs(walk) > 5) {
            isDragged = true;
        }
        tabsContainer.scrollLeft = scrollLeft - walk;
    });
    // 触摸设备支持
    tabsContainer.addEventListener('touchstart', (e) => {
        isDown = true;
        isDragged = false;
        startX = e.touches[0].pageX - tabsContainer.offsetLeft;
        scrollLeft = tabsContainer.scrollLeft;
    });
    tabsContainer.addEventListener('touchend', () => {
        isDown = false;
    });
    tabsContainer.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        const x = e.touches[0].pageX - tabsContainer.offsetLeft;
        const walk = (x - startX) * 1;
        if (Math.abs(walk) > 5) {
            isDragged = true;
        }
        tabsContainer.scrollLeft = scrollLeft - walk;
    });
    // 为选项卡按钮添加点击拦截，防止拖拽时误触发
    const tabs = document.querySelectorAll('.ech-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (isDragged) {
                e.preventDefault();
                e.stopPropagation();
                isDragged = false;
            }
        });
    });
}
// 在模态框显示时初始化拖拽
const echHelpModalOriginal = showECHHelpModal;
showECHHelpModal = function() {
    echHelpModalOriginal.call(this);
    setTimeout(() => {
        initECHTabsDrag();
    }, 0);
}

function normalizeSubAPIURL(url) {
    url = url.trim();
    if (!url) return null;
    let parsedURL;
    if (!url.includes('://')) {
        url = 'https://' + url;
    }
    try {
        parsedURL = new URL(url);
    } catch (e) {
        return null;
    }
    const baseURL = parsedURL.origin;
    return baseURL;
}
async function testSubAPI() {
    let input;
    const selectEl = document.getElementById('subAPISelect');
    if (selectEl.value === 'custom' || !selectEl.value) {
        // 如果是自定义或未选择，从输入框获取
        input = document.getElementById('testSubAPIInput').value.trim();
    } else {
        // 否则从下拉框获取
        input = selectEl.value.trim();
        document.getElementById('testSubAPIInput').value = input;
    }
    if (!input) {
        showStatus('请输入地址', 'error');
        return;
    }
    const baseURL = normalizeSubAPIURL(input);
    if (!baseURL) {
        showStatus('地址格式无效', 'error');
        return;
    }
    const testURL = baseURL + '/version';
    const statusEl = document.getElementById('subAPIStatus');
    const buttons = document.querySelectorAll('#subAPIModal button.btn');
    const testBtn = buttons[0];
    try {
        testBtn.disabled = true;
        statusEl.textContent = '⏳ 检测中...';
        statusEl.style.display = 'block';
        statusEl.style.background = 'linear-gradient(135deg, #3b82f6 0, #1d4ed8 100%)';
        statusEl.style.color = '#fff';
        const response = await fetch(testURL, {
            method: 'GET'
        });
        if (response.status === 200) {
            const content = await response.text();
            const lowerContent = content.toLowerCase();
            if (lowerContent.includes('subconverter')) {
                statusEl.style.background = 'linear-gradient(135deg, #10b981 0, #059669 100%)';
                statusEl.textContent = '✅ ' + content;
                document.getElementById('subAPIConfirmBtn').disabled = false;
                document.getElementById('subAPIConfirmBtn').style.opacity = '1';
                document.getElementById('subAPIConfirmBtn').dataset.validURL = baseURL;
            } else {
                statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
                statusEl.textContent = '❌ 响应内容无效';
                document.getElementById('subAPIConfirmBtn').disabled = true;
                document.getElementById('subAPIConfirmBtn').style.opacity = '0.5';
            }
        } else {
            statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
            statusEl.textContent = '❌ 请求失败 (HTTP ' + response.status + ')';
            document.getElementById('subAPIConfirmBtn').disabled = true;
            document.getElementById('subAPIConfirmBtn').style.opacity = '0.5';
        }
    } catch (error) {
        statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
        statusEl.textContent = '❌ 检测失败: ' + error.message;
        document.getElementById('subAPIConfirmBtn').disabled = true;
        document.getElementById('subAPIConfirmBtn').style.opacity = '0.5';
    } finally {
        testBtn.disabled = false;
    }
}

function showStatus(message, type) {
    const statusEl = document.getElementById('subAPIStatus');
    const prefix = type === 'error' ? '❌' : 'ℹ️';
    statusEl.textContent = prefix + ' ' + message;
    statusEl.style.display = 'block';
    if (type === 'error') {
        statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
    } else {
        statusEl.style.background = 'linear-gradient(135deg, #3b82f6 0, #1d4ed8 100%)';
    }
    statusEl.style.color = '#fff';
}

function confirmSubAPI() {
    const validURL = document.getElementById('subAPIConfirmBtn').dataset.validURL;
    if (!validURL) return;
    document.getElementById('subAPI').value = validURL;
    markModified('convert');
    closeSubAPIModal();
}
// ==================== 消息通知设置相关函数 ====================
// 更新 Telegram 按钮状态和颜色
function updateTelegramButtonStates(isConfigured) {
    // 获取 Telegram 按钮元素（第一组通知按钮是 Telegram）
    const buttons = document.querySelectorAll('.notification-controls');
    if (buttons.length > 0) {
        const telegramControls = buttons[0];
        const configBtn = telegramControls.querySelector('.btn-notification-config');
        const clearBtn = telegramControls.querySelector('.btn-clear-config');
        if (isConfigured) {
            // 已配置：参数配置按钮为绿色，清除配置按钮为红色且可点击
            clearBtn.classList.remove('btn-not-configured');
            clearBtn.classList.add('btn-configured');
            clearBtn.disabled = false;
        } else {
            // 未配置：参数配置按钮保持绿色，清除配置按钮为灰色且禁用
            clearBtn.classList.remove('btn-configured');
            clearBtn.classList.add('btn-not-configured');
            clearBtn.disabled = true;
        }
    }
}
// 清除 Telegram 配置
async function clearTelegramConfig() {
    if (confirm('确定要清除 Telegram 配置吗？')) {
        currentConfig.TG = {
            BotToken: null,
            ChatID: null,
            启用: false
        };
        try {
            await saveConfigToServer('notification');
            showToast('Telegram 配置已清除', 'success');
            updateTelegramButtonStates(false);
            const telegramCheckbox = document.getElementById('telegramEnabled');
            telegramCheckbox.disabled = true;
            telegramCheckbox.checked = false;
        } catch (error) {
            showToast('清除配置失败: ' + error.message, 'error');
        }
    }
}
// 更新 Cloudflare 按钮状态和颜色
function updateCloudflareButtonStates(isConfigured) {
    // 获取 Cloudflare 按钮元素（第二组通知按钮是 Cloudflare）
    const buttons = document.querySelectorAll('.notification-controls');
    if (buttons.length > 1) {
        const cloudflareControls = buttons[1];
        const clearBtn = cloudflareControls.querySelector('.btn-clear-config');
        if (isConfigured) {
            // 已配置：清除配置按钮为红色且可点击
            clearBtn.classList.remove('btn-not-configured');
            clearBtn.classList.add('btn-configured');
            clearBtn.disabled = false;
        } else {
            // 未配置：清除配置按钮为灰色且禁用
            clearBtn.classList.remove('btn-configured');
            clearBtn.classList.add('btn-not-configured');
            clearBtn.disabled = true;
        }
    }
}
// 清除 Cloudflare 配置
async function clearCloudflareConfig() {
    if (confirm('确定要清除 Cloudflare 配置吗？')) {
        currentConfig.CF = {
            Usage: null,
            启用: false
        };
        try {
            await saveConfigToServer('notification');
            showToast('Cloudflare 配置已清除', 'success');
            updateCloudflareButtonStates(false);
        } catch (error) {
            showToast('清除配置失败: ' + error.message, 'error');
        }
    }
}
// 打开 TelegramBot 配置模态框
function openTelegramConfigModal() {
    document.getElementById('telegramConfigModal').classList.add('show');
    // 只加载Chat ID，不加载Bot Token（因为Bot Token是敏感信息）
    const chatID = currentConfig.TG ? .ChatID || currentConfig.通知 ? .Telegram ? .ChatID || '';
    document.getElementById('telegramBotToken').value = '';
    document.getElementById('telegramChatID').value = chatID;
    // 重置状态和保存按钮
    document.getElementById('telegramStatus').style.display = 'none';
    document.getElementById('telegramStatus').textContent = '';
    document.getElementById('telegramConfirmBtn').disabled = true;
    document.getElementById('telegramConfirmBtn').style.opacity = '0.5';
}
// 关闭 TelegramBot 配置模态框
function closeTelegramConfigModal(event) {
    if (event && event.target.id !== 'telegramConfigModal') return;
    document.getElementById('telegramConfigModal').classList.remove('show');
}
// 测试 TelegramBot 连接
async function testTelegramConfig() {
    const token = document.getElementById('telegramBotToken').value.trim();
    const chatID = document.getElementById('telegramChatID').value.trim();
    const statusEl = document.getElementById('telegramStatus');
    const confirmBtn = document.getElementById('telegramConfirmBtn');
    const testBtn = event.target;
    const telegramApiBases = ['https://api.telegram.org', 'https://api.tg.090227.xyz'];
    async function requestTelegram(endpoint, params = null, preferredBase = null) {
        const requestOrder = preferredBase ? [preferredBase, ...telegramApiBases.filter(base => base !== preferredBase)] : telegramApiBases;
        const errors = [];
        for (let i = 0; i < requestOrder.length; i++) {
            const base = requestOrder[i];
            const queryString = params ? `?${params.toString()}` : '';
            const requestUrl = `${base}/bot${token}/${endpoint}${queryString}`;
            try {
                const response = await fetch(requestUrl);
                let data = null;
                try {
                    data = await response.json();
                } catch (jsonError) {
                    if (response.ok) {
                        throw new Error('接口返回了无效的JSON数据');
                    }
                }
                if (!response.ok) {
                    // 401/400 等业务错误通常会携带 JSON，属于“接口可达”，不走备用接口。
                    if (data && typeof data === 'object' && data.ok === false) {
                        return {
                            data,
                            base
                        };
                    }
                    throw new Error(`HTTP ${response.status}`);
                }
                if (!data || typeof data !== 'object') {
                    throw new Error('接口返回数据格式异常');
                }
                return {
                    data,
                    base
                };
            } catch (error) {
                const host = new URL(base).hostname;
                errors.push(`${host}: ${error.message}`);
                if (i < requestOrder.length - 1) {
                    console.warn(`[TelegramBot] ${host} 请求失败，切换备用接口`, error);
                }
            }
        }
        throw new Error(`官方API与备用API均请求失败（${errors.join('；')}）`);
    }
    if (!token || !chatID) {
        statusEl.textContent = '❌ 请填写Bot Token和Chat ID';
        statusEl.style.display = 'block';
        statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
        statusEl.style.color = '#fff';
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        return;
    }
    try {
        testBtn.disabled = true;
        statusEl.textContent = '⏳ 验证中...';
        statusEl.style.display = 'block';
        statusEl.style.background = 'linear-gradient(135deg, #3b82f6 0, #1d4ed8 100%)';
        statusEl.style.color = '#fff';
        // 第一步：验证 Bot Token 的有效性
        const getMeResult = await requestTelegram('getMe');
        const getMeData = getMeResult.data;
        if (!getMeData.ok) {
            throw new Error('Bot Token 无效: ' + (getMeData.description || '未知错误'));
        }
        // 第二步：通过Bot Token向Chat ID推送测试消息
        const sendUrlParams = new URLSearchParams({
            chat_id: chatID,
            text: '✅ Telegram 通知配置已验证成功！'
        });
        const sendResult = await requestTelegram('sendMessage', sendUrlParams, getMeResult.base);
        const sendData = sendResult.data;
        if (!sendData.ok) {
            throw new Error('Chat ID 无效: ' + (sendData.description || '未知错误'));
        }
        console.log(`[TelegramBot] 验证成功，当前接口: ${sendResult.base}`);
        // 验证成功
        statusEl.style.background = 'linear-gradient(135deg, #10b981 0, #059669 100%)';
        statusEl.textContent = '✅ Bot Token 和 Chat ID 均有效';
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    } catch (error) {
        statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
        statusEl.textContent = '❌ 验证失败: ' + error.message;
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
    } finally {
        testBtn.disabled = false;
    }
}
// 保存 TelegramBot 配置
async function confirmTelegramConfig() {
    const token = document.getElementById('telegramBotToken').value.trim();
    const chatID = document.getElementById('telegramChatID').value.trim();
    const confirmBtn = document.getElementById('telegramConfirmBtn');
    // 检查按钮是否禁用（必须先通过验证）
    if (confirmBtn.disabled) {
        showToast('请先点击"可用性验证"按钮验证配置', 'error');
        return;
    }
    if (!token || !chatID) {
        showToast('请填写完整的Bot Token和Chat ID', 'error');
        return;
    }
    try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '保存中...';
        // 提交到后端
        const response = await fetch('/admin/tg.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                BotToken: token,
                ChatID: chatID
            })
        });
        if (response.ok) {
            const result = await response.json();
            showToast('✅ TelegramBot 配置已保存', 'success');
            closeTelegramConfigModal();
            // 更新按钮状态
            currentConfig.TG = {
                BotToken: token,
                ChatID: chatID,
                启用: true
            };
            updateTelegramButtonStates(true);
            // 1秒后刷新页面
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            const errorData = await response.json();
            showToast('❌ 保存失败: ' + (errorData.error || '未知错误'), 'error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = '保存';
        }
    } catch (error) {
        showToast('❌ 保存失败: ' + error.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = '保存';
    }
}
// 打开 Cloudflare 配置模态框
function openCloudflareConfigModal() {
    document.getElementById('cloudflareConfigModal').classList.add('show');
    // 默认选择第一个方案
    document.getElementById('cloudflareAuthMethod').value = 'accountid';
    updateCloudflareAuthMethod();
    // 清空输入框
    document.getElementById('cloudflareEmail').value = '';
    document.getElementById('cloudflareGlobalAPIKey').value = '';
    document.getElementById('cloudflareAccountID').value = '';
    document.getElementById('cloudflareAPIToken').value = '';
    document.getElementById('cloudflareUsageAPI').value = '';
    // 重置状态和保存按钮
    document.getElementById('cloudflareStatus').style.display = 'none';
    document.getElementById('cloudflareStatus').textContent = '';
    document.getElementById('cloudflareConfirmBtn').disabled = true;
    document.getElementById('cloudflareConfirmBtn').style.opacity = '0.5';
    document.getElementById('cloudflareConfirmBtn').dataset.testPassed = 'false';
}
// 更新 Cloudflare 认证方法选择时的显示
function updateCloudflareAuthMethod() {
    const method = document.getElementById('cloudflareAuthMethod').value;
    // 隐藏所有方案的输入框
    document.getElementById('cloudflareEmailSection').style.display = 'none';
    document.getElementById('cloudflareAccountIDSection').style.display = 'none';
    document.getElementById('cloudflareUsageAPISection').style.display = 'none';
    // 显示选中方案的输入框
    if (method === 'email') {
        document.getElementById('cloudflareEmailSection').style.display = 'block';
    } else if (method === 'accountid') {
        document.getElementById('cloudflareAccountIDSection').style.display = 'block';
    } else if (method === 'usageapi') {
        document.getElementById('cloudflareUsageAPISection').style.display = 'block';
    }
    // 切换方案时重置验证状态和保存按钮
    document.getElementById('cloudflareStatus').style.display = 'none';
    document.getElementById('cloudflareStatus').textContent = '';
    document.getElementById('cloudflareConfirmBtn').disabled = true;
    document.getElementById('cloudflareConfirmBtn').style.opacity = '0.5';
    document.getElementById('cloudflareConfirmBtn').dataset.testPassed = 'false';
}
// 关闭 Cloudflare 配置模态框
function closeCloudflareConfigModal(event) {
    if (event && event.target.id !== 'cloudflareConfigModal') return;
    document.getElementById('cloudflareConfigModal').classList.remove('show');
    // 清空输入框和状态
    document.getElementById('cloudflareEmail').value = '';
    document.getElementById('cloudflareGlobalAPIKey').value = '';
    document.getElementById('cloudflareAccountID').value = '';
    document.getElementById('cloudflareAPIToken').value = '';
    document.getElementById('cloudflareUsageAPI').value = '';
    document.getElementById('cloudflareStatus').style.display = 'none';
    document.getElementById('cloudflareStatus').textContent = '';
}
// 测试 Cloudflare 连接
async function testCloudflareConfig() {
    const method = document.getElementById('cloudflareAuthMethod').value;
    let email = '',
        globalAPIKey = '',
        accountID = '',
        apiToken = '',
        usageAPI = '';
    const statusEl = document.getElementById('cloudflareStatus');
    const confirmBtn = document.getElementById('cloudflareConfirmBtn');
    const testBtn = event.target;
    // 根据选择的方案获取输入值
    if (method === 'email') {
        email = document.getElementById('cloudflareEmail').value.trim();
        globalAPIKey = document.getElementById('cloudflareGlobalAPIKey').value.trim();
        if (!email || !globalAPIKey) {
            statusEl.textContent = '❌ 请填写 Email 和 Global API Key';
            statusEl.style.display = 'block';
            statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
            statusEl.style.color = '#fff';
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.dataset.testPassed = 'false';
            return;
        }
    } else if (method === 'accountid') {
        accountID = document.getElementById('cloudflareAccountID').value.trim();
        apiToken = document.getElementById('cloudflareAPIToken').value.trim();
        if (!accountID || !apiToken) {
            statusEl.textContent = '❌ 请填写 Account ID 和 API Token';
            statusEl.style.display = 'block';
            statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
            statusEl.style.color = '#fff';
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.dataset.testPassed = 'false';
            return;
        }
    } else if (method === 'usageapi') {
        usageAPI = document.getElementById('cloudflareUsageAPI').value.trim();
        if (!usageAPI) {
            statusEl.textContent = '❌ 请填写 UsageAPI 地址';
            statusEl.style.display = 'block';
            statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
            statusEl.style.color = '#fff';
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.dataset.testPassed = 'false';
            return;
        }
    }
    try {
        testBtn.disabled = true;
        statusEl.textContent = '⏳ 检测中...';
        statusEl.style.display = 'block';
        statusEl.style.background = 'linear-gradient(135deg, #3b82f6 0, #1d4ed8 100%)';
        statusEl.style.color = '#fff';
        let response;
        if (method === 'usageapi') {
            // UsageAPI 方案：直接请求外部 API
            response = await fetch(usageAPI);
        } else {
            // 构建请求 URL
            let queryParams = new URLSearchParams();
            if (method === 'email') {
                queryParams.append('Email', email);
                queryParams.append('GlobalAPIKey', globalAPIKey);
            } else if (method === 'accountid') {
                queryParams.append('AccountID', accountID);
                queryParams.append('APIToken', apiToken);
            }
            response = await fetch('/admin/getCloudflareUsage?' + queryParams.toString());
        }
        if (!response.ok) {
            throw new Error('请求失败 (HTTP ' + response.status + ')');
        }
        const data = await response.json();
        if (data.success) {
            // 验证成功
            statusEl.style.background = 'linear-gradient(135deg, #10b981 0, #059669 100%)';
            const maxQuota = data.max || 100000;
            const percentage = (data.total / maxQuota * 100).toFixed(2);
            statusEl.textContent = `✅ 验证成功！ 今天的请求配额: ${data.total}/${maxQuota} (${percentage}%)`;
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.dataset.testPassed = 'true';
            // 保存验证通过的数据供后续保存使用
            confirmBtn.dataset.method = method;
            confirmBtn.dataset.email = email;
            confirmBtn.dataset.globalAPIKey = globalAPIKey;
            confirmBtn.dataset.accountID = accountID;
            confirmBtn.dataset.apiToken = apiToken;
            confirmBtn.dataset.usageAPI = usageAPI;
        } else {
            // 验证失败
            statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
            statusEl.textContent = '❌ 验证失败：' + (data.msg || '凭证无效或无权限');
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.dataset.testPassed = 'false';
        }
    } catch (error) {
        statusEl.style.background = 'linear-gradient(135deg, #ef4444 0, #dc2626 100%)';
        statusEl.textContent = '❌ 检测失败: ' + error.message;
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.dataset.testPassed = 'false';
    } finally {
        testBtn.disabled = false;
    }
}
// 保存 Cloudflare 配置
async function confirmCloudflareConfig() {
    const confirmBtn = document.getElementById('cloudflareConfirmBtn');
    // 检查是否通过了验证
    if (confirmBtn.dataset.testPassed !== 'true') {
        showToast('请先点击"可用性验证"按钮通过验证', 'error');
        return;
    }
    const method = confirmBtn.dataset.method;
    const email = confirmBtn.dataset.email || '';
    const globalAPIKey = confirmBtn.dataset.globalAPIKey || '';
    const accountID = confirmBtn.dataset.accountID || '';
    const apiToken = confirmBtn.dataset.apiToken || '';
    const usageAPI = confirmBtn.dataset.usageAPI || '';
    try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '保存中...';
        // 构建请求体
        let payload;
        if (method === 'usageapi') {
            payload = {
                Email: null,
                GlobalAPIKey: null,
                AccountID: null,
                APIToken: null,
                UsageAPI: usageAPI
            };
        } else {
            payload = {
                Email: method === 'email' ? email : null,
                GlobalAPIKey: method === 'email' ? globalAPIKey : null,
                AccountID: method === 'accountid' ? accountID : null,
                APIToken: method === 'accountid' ? apiToken : null,
                UsageAPI: null
            };
        }
        // 提交到后端
        const response = await fetch('/admin/cf.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            showToast('✅ Cloudflare 配置已保存', 'success');
            closeCloudflareConfigModal();
            // 1秒后刷新页面
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            const errorData = await response.json();
            showToast('❌ 保存失败: ' + (errorData.error || '未知错误'), 'error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = '保存';
        }
    } catch (error) {
        showToast('❌ 保存失败: ' + error.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = '保存';
    }
}
// 保存通知设置
async function saveNotification() {
    try {
        // 只更新 TG.启用 字段
        if (!currentConfig.TG) currentConfig.TG = {};
        currentConfig.TG.启用 = document.getElementById('telegramEnabled').checked;
        // 提交到服务器，但整个 currentConfig
        const response = await fetch('/admin/config.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentConfig)
        });
        if (!response.ok) throw new Error('保存失败');
        showToast('✅ 启用状态已保存', 'success');
        modifiedSections.delete('notification');
        updateButtonStates();
    } catch (error) {
        showToast('❌ 保存失败: ' + error.message, 'error');
    }
}
// 清除 Telegram 配置
// 清除 Telegram 配置
function clearTelegramConfig() {
    document.getElementById('clearTelegramModal').classList.add('show');
}

function closeClearTelegramModal(event) {
    if (!event || event.target.id === 'clearTelegramModal') {
        document.getElementById('clearTelegramModal').classList.remove('show');
    }
}
async function confirmClearTelegramConfig() {
    try {
        const response = await fetch('/admin/tg.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                init: true
            })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            closeClearTelegramModal();
            showToast('✅ Telegram 配置已清除，页面即将刷新...', 'success');
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showToast('❌ 清除失败: ' + (data.message || '未知错误'), 'error');
        }
    } catch (error) {
        showToast('❌ 清除出错: ' + error.message, 'error');
    }
}
// 清除 Cloudflare 配置
function clearCloudflareConfig() {
    document.getElementById('clearCloudflareModal').classList.add('show');
}

function closeClearCloudflareModal(event) {
    if (!event || event.target.id === 'clearCloudflareModal') {
        document.getElementById('clearCloudflareModal').classList.remove('show');
    }
}
async function confirmClearCloudflareConfig() {
    try {
        const response = await fetch('/admin/cf.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                init: true
            })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            closeClearCloudflareModal();
            showToast('✅ Cloudflare 配置已清除，页面即将刷新...', 'success');
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showToast('❌ 清除失败: ' + (data.message || '未知错误'), 'error');
        }
    } catch (error) {
        showToast('❌ 清除出错: ' + error.message, 'error');
    }
}
// 取消通知设置编辑
function cancelEdit(section) {
    if (section === 'notification') {
        // 重置通知启用状态为原始值
        const telegramCheckbox = document.getElementById('telegramEnabled');
        const originalEnabled = originalConfig.TG ? .启用 ? ? false;
        telegramCheckbox.checked = originalEnabled;
        currentConfig.TG.启用 = originalEnabled;
    } else {
        // 原有的cancelEdit逻辑
        currentConfig = JSON.parse(JSON.stringify(originalConfig));
        if (section === 'sub') {
            const local = currentConfig.优选订阅生成 ? .local ? ? true;
            const randomIP = currentConfig.优选订阅生成 ? .本地IP库 ? .随机IP ? ? true;
            if (!local) {
                document.getElementById('ipMode').value = 'generator';
                document.getElementById('generatorURL').value = currentConfig.优选订阅生成 ? .SUB || '';
            } else if (randomIP) {
                document.getElementById('ipMode').value = 'random';
                document.getElementById('randomCount').value = currentConfig.优选订阅生成 ? .本地IP库 ? .随机数量 || 16;
            } else {
                document.getElementById('ipMode').value = 'custom';
                loadCustomIPs();
            }
            updateIPMode();
        } else if (section === 'config') {
            document.getElementById('subName').value = currentConfig.优选订阅生成 ? .SUBNAME || '';
            document.getElementById('nodeHost').value = currentConfig.HOST || '';
            document.getElementById('nodeUUID').value = currentConfig.UUID || '';
            document.getElementById('nodePATH').value = currentConfig.PATH || '';
            syncSSProtocolSettingsFromConfig();
            document.getElementById('protocol').value = currentConfig.协议类型 || 'vless';
            syncTransportSettingsFromConfig();
            document.getElementById('skipVerify').checked = currentConfig.跳过证书验证 || false;
            updateProtocol();
            syncFingerprintSelectFromConfig();
            syncALPNSelectFromConfig();
        } else if (section === 'proxy') {
            applyProxyConfigToForm();
        } else if (section === 'convert') {
            document.getElementById('subAPI').value = currentConfig.订阅转换配置 ? .SUBAPI || '';
            document.getElementById('subConfig').value = currentConfig.订阅转换配置 ? .SUBCONFIG || '';
            document.getElementById('emoji').checked = currentConfig.订阅转换配置 ? .SUBEMOJI || false;
            syncSubListOption();
        }
    }
    modifiedSections.delete(section);
    updateButtonStates();
}
// 更新倒计时
function updateCountdown(forceUpdate = false) {
    const countdownEl = document.getElementById('countdown');
    if (!countdownEl) return;
    const cfUsageModule = document.getElementById('cfUsageModule');
    const moduleVisible = !!cfUsageModule && getComputedStyle(cfUsageModule).display !== 'none' && !cfUsageModule.classList.contains('collapsed');
    if (!forceUpdate && (document.hidden || !moduleVisible)) {
        return;
    }
    const now = new Date();
    const nextMidnightUTC = new Date(now);
    nextMidnightUTC.setUTCHours(0, 0, 0, 0);
    nextMidnightUTC.setUTCDate(nextMidnightUTC.getUTCDate() + 1); // 总是设置为明天的0点
    const diff = nextMidnightUTC - now;
    const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
    const minutes = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');
    if (!forceUpdate && countdownEl.dataset.hours === hours && countdownEl.dataset.minutes === minutes && countdownEl.dataset.seconds === seconds) {
        return;
    }
    countdownEl.dataset.hours = hours;
    countdownEl.dataset.minutes = minutes;
    countdownEl.dataset.seconds = seconds;
    const hoursEl = document.getElementById('countdownHours');
    const minutesEl = document.getElementById('countdownMinutes');
    const secondsEl = document.getElementById('countdownSeconds');
    if (hoursEl && minutesEl && secondsEl) {
        hoursEl.textContent = hours;
        minutesEl.textContent = minutes;
        secondsEl.textContent = seconds;
        return;
    }
    countdownEl.textContent = `距离重置还有 ${hours}小时${minutes}分${seconds}秒`;
}