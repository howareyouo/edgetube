function refreshLineEditor(textarea) {
    if (!textarea) return;
    if (typeof textarea._refreshLineEditor === 'function') {
        textarea._refreshLineEditor();
        return;
    }
    textarea.dispatchEvent(new Event('input', {
        bubbles: true
    }));
}
async function loadConfig() {
    try {
        // 禁用 Rocket Loader 对该请求的影响
        const response = await fetch('/admin/config.json?_t=' + Date.now(), {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        if (!response.ok) throw new Error('加载配置失败');
        currentConfig = await response.json();
        originalConfig = JSON.parse(JSON.stringify(currentConfig));
        renderUI();
        loadVersionByUUID(currentConfig.UUID);
        // 设置网页标题
        document.title = `${currentConfig.优选订阅生成?.SUBNAME || 'edgetunnel'} 设置页面 - 管理后台`;
    } catch (error) {
        updateVersionBadge('');
        showToast('加载配置失败: ' + error.message, 'error');
    }
}

function renderUI() {
    // 标题
    document.getElementById('pageTitle').textContent = (currentConfig.优选订阅生成 ? .SUBNAME || 'edgetunnel') + ' 设置页面';
    // 检查 CF 使用情况并显示模块
    const cfUsageModule = document.getElementById('cfUsageModule');
    const cfUsage = currentConfig.CF ? .Usage;
    if (cfUsage && cfUsage.success) {
        cfUsageModule.style.display = 'block';
        cfUsageModule.classList.remove('cf-usage-module');
        updateCFUsageDisplay(cfUsage);
        updateCountdown(true);
        updateCloudflareButtonStates(true);
    } else {
        cfUsageModule.style.display = 'none';
        cfUsageModule.classList.add('cf-usage-module');
        updateCloudflareButtonStates(false);
    }
    // 检查 CF.UsageAPI 字段是否存在，向下兼容旧版本
    const usageapiOption = document.getElementById('usageapiOption');
    if (usageapiOption) {
        // 如果 CF.UsageAPI 字段不存在（旧版本），隐藏 UsageAPI 选项
        if (currentConfig.CF ? .UsageAPI === undefined) {
            usageapiOption.style.display = 'none';
        } else {
            usageapiOption.style.display = '';
        }
    }
    // 订阅链接
    const token = currentConfig.优选订阅生成 ? .TOKEN;
    const host = window.location.host;
    const link = currentConfig.LINK;
    document.getElementById('LinkURL').value = currentConfig.LINK;
    document.getElementById('subLink').value = `https://${host}/sub?token=${token}`;
    document.getElementById('base64Link').value = `https://${host}/sub?token=${token}&b64`;
    document.getElementById('clashLink').value = `https://${host}/sub?token=${token}&clash`;
    document.getElementById('singboxLink').value = `https://${host}/sub?token=${token}&sb`;
    // 编辑订阅生成
    const local = currentConfig.优选订阅生成 ? .local ? ? true;
    const randomIP = currentConfig.优选订阅生成 ? .本地IP库 ? .随机IP ? ? true;
    if (!local) {
        document.getElementById('ipMode').value = 'generator';
        document.getElementById('generatorURL').value = currentConfig.优选订阅生成 ? .SUB || '';
    } else if (randomIP) {
        document.getElementById('ipMode').value = 'random';
        document.getElementById('randomCount').value = currentConfig.优选订阅生成 ? .本地IP库 ? .随机数量 || 16;
        // 设置指定端口
        if (currentConfig.优选订阅生成 ? .本地IP库 ? .指定端口 !== undefined) {
            document.getElementById('specifiedPort').value = currentConfig.优选订阅生成.本地IP库.指定端口;
        }
    } else {
        document.getElementById('ipMode').value = 'custom';
        loadCustomIPs();
    }
    updateIPMode();
    // 详细配置
    document.getElementById('subName').value = currentConfig.优选订阅生成 ? .SUBNAME || '';
    // 检查 HOSTS 数组是否存在
    hasMultipleHosts = Array.isArray(currentConfig.HOSTS) && currentConfig.HOSTS.length > 0;
    const nodeHostInput = document.getElementById('nodeHost');
    if (hasMultipleHosts) {
        // 如果存在 HOSTS 数组，用逗号连接显示所有 host
        nodeHostInput.value = currentConfig.HOSTS.join('、');
        // 添加可点击样式和事件
        nodeHostInput.classList.add('nodeHost-clickable');
        nodeHostInput.title = '点击 可编辑多个节点域名';
        nodeHostInput.onclick = openHostsEditModal;
    } else {
        // 否则显示单个 HOST
        nodeHostInput.value = currentConfig.HOST || '';
        // 移除可点击样式和事件
        nodeHostInput.classList.remove('nodeHost-clickable');
        nodeHostInput.title = '节点域名';
        nodeHostInput.onclick = null;
    }
    document.getElementById('nodeUUID').value = currentConfig.UUID || '';
    document.getElementById('nodePATH').value = currentConfig.PATH || '';
    syncSSProtocolSettingsFromConfig();
    document.getElementById('protocol').value = currentConfig.协议类型 || 'vless';
    syncTransportSettingsFromConfig();
    updateProtocol();
    // 检查跳过证书验证字段是否存在
    const skipVerifyGroup = document.getElementById('skipVerifyGroup');
    if (currentConfig['跳过证书验证'] !== undefined) {
        skipVerifyGroup.style.setProperty('display', 'flex', 'important');
        document.getElementById('skipVerify').checked = currentConfig['跳过证书验证'] || false;
    } else {
        skipVerifyGroup.style.setProperty('display', 'none', 'important');
    }
    // 检查"完整节点路径"字段是否存在，判断PATH是否可编辑
    const nodePathInput = document.getElementById('nodePATH');
    if (currentConfig['完整节点路径'] !== undefined) {
        // 存在该字段，表示后端支持编辑PATH，移除readonly属性
        nodePathInput.removeAttribute('readonly');
        nodePathInput.title = '节点的伪装路径';
        nodePathInput.onchange = handlePathChange;
    } else {
        // 不存在该字段，PATH保持只读状态
        nodePathInput.setAttribute('readonly', '');
        nodePathInput.title = '节点的伪装路径 仅可通过 \'PATH\'环境变量 进行修改';
        nodePathInput.onchange = null;
    }
    // 检查Fingerprint字段是否存在
    syncFingerprintSelectFromConfig();
    // 检查ALPN字段是否存在并回显
    syncALPNSelectFromConfig();
    // 检查随机路径字段是否存在
    const randomPathGroup = document.getElementById('randomPathGroup');
    const randomPathCheckbox = document.getElementById('randomPath');
    if (currentConfig['随机路径'] !== undefined) {
        randomPathGroup.style.setProperty('display', 'flex', 'important');
        randomPathCheckbox.checked = currentConfig['随机路径'] || false;
    } else {
        randomPathGroup.style.setProperty('display', 'none', 'important');
    }
    // 检查启用0RTT字段是否存在
    const enable0RTTGroup = document.getElementById('enable0RTTGroup');
    const enable0RTTCheckbox = document.getElementById('enable0RTT');
    if (currentConfig['启用0RTT'] !== undefined) {
        enable0RTTGroup.style.setProperty('display', 'flex', 'important');
        enable0RTTCheckbox.checked = currentConfig['启用0RTT'] || false;
    } else {
        enable0RTTGroup.style.setProperty('display', 'none', 'important');
    }
    // 检查TLS分片字段是否存在
    const tlsFragmentGroup = document.getElementById('tlsFragmentGroup');
    const tlsFragmentHappGroup = document.getElementById('tlsFragmentHappGroup');
    const tlsFragmentShadowrocket = document.getElementById('tlsFragmentShadowrocket');
    const tlsFragmentHapp = document.getElementById('tlsFragmentHapp');
    if (currentConfig['TLS分片'] !== undefined) {
        tlsFragmentGroup.style.setProperty('display', 'flex', 'important');
        tlsFragmentHappGroup.style.setProperty('display', 'flex', 'important');
        // 根据当前值设置勾选状态
        tlsFragmentShadowrocket.checked = currentConfig['TLS分片'] === 'Shadowrocket';
        tlsFragmentHapp.checked = currentConfig['TLS分片'] === 'Happ';
    } else {
        tlsFragmentGroup.style.setProperty('display', 'none', 'important');
        tlsFragmentHappGroup.style.setProperty('display', 'none', 'important');
    }
    // 检查ECH字段是否存在
    const echModule = document.getElementById('echModule');
    const enableECHCheckbox = document.getElementById('enableECH');
    if (currentConfig['ECH'] !== undefined) {
        echModule.style.display = 'block';
        enableECHCheckbox.checked = currentConfig['ECH'] || false;
        // 根据Fingerprint值初始化ECH选项的禁用状态
        updateECHOptionState();
        // 填充ECH DNS下拉框
        populateEchDNSSelect();
        // 填充ECH SNI下拉框
        populateEchSNISelect();
    } else {
        echModule.style.display = 'none';
    }
    // 反代落地设置
    applyProxyConfigToForm();
    // 订阅转换配置
    document.getElementById('subAPI').value = currentConfig.订阅转换配置 ? .SUBAPI || '';
    document.getElementById('subConfig').value = currentConfig.订阅转换配置 ? .SUBCONFIG || '';
    document.getElementById('emoji').checked = currentConfig.订阅转换配置 ? .SUBEMOJI || false;
    syncSubListOption();
    // 消息通知设置 - 兼容两种config结构
    // 优先读取 TG 字段，如果没有则读取 通知.Telegram
    const telegramBotToken = currentConfig.TG ? .BotToken || currentConfig.通知 ? .Telegram ? .BotToken;
    const telegramChatID = currentConfig.TG ? .ChatID || currentConfig.通知 ? .Telegram ? .ChatID;
    const telegramCheckbox = document.getElementById('telegramEnabled');
    // 判断TG配置是否完整（BotToken和ChatID都非null且非空字符串）
    if (telegramBotToken && telegramChatID) {
        // 两个都有，启用checkbox，并加载 TG.启用 的状态
        telegramCheckbox.disabled = false;
        telegramCheckbox.checked = currentConfig.TG ? .启用 ? ? false;
        // "参数配置"按钮颜色为绿色，表示已配置
        updateTelegramButtonStates(true);
        // "清除配置"按钮为红色，且可点击
    } else {
        // 任意一个缺少，禁用checkbox
        telegramCheckbox.disabled = true;
        telegramCheckbox.checked = false;
        // "参数配置"按钮颜色为默认色，表示未配置
        updateTelegramButtonStates(false);
        // "清除配置"按钮为灰色，且不可点击
    }
    modifiedSections.clear();
    resetAllButtons();
    // 从 localStorage 加载模块展开/折叠状态
    loadModuleStates();
    // 填充 SubConfig 下拉框（如果数据已加载，会自动设置选中值）
    populateSubConfigSelect();
    // 检查当前域名是否在 HOSTS 数组中
    checkHostsMismatch();
}
// CF 使用情况显示函数
function updateCFUsageDisplay(cfUsage) {
    const workers = cfUsage.workers || 0;
    const pages = cfUsage.pages || 0;
    const total = cfUsage.total || 0;
    const dailyQuota = cfUsage.max || 100000;
    // 更新显示数值
    document.getElementById('cfWorkerCount').textContent = workers.toLocaleString();
    document.getElementById('cfPagesCount').textContent = pages.toLocaleString();
    document.getElementById('cfDailyQuota').textContent = dailyQuota.toLocaleString();
    document.getElementById('cfTotalDisplay').textContent = total.toLocaleString();
    // 计算百分比
    const percentage = ((total / dailyQuota) * 100).toFixed(2);
    // 计算比例并设置进度条宽度
    const workersRatio = (workers / dailyQuota) * 100;
    const pagesRatio = (pages / dailyQuota) * 100;
    // Workers 进度条：从左边开始
    const workerBarEl = document.getElementById('cfWorkerBar');
    workerBarEl.style.width = Math.min(workersRatio, 100) + '%';
    workerBarEl.textContent = '';
    // Pages 进度条：紧跟在 Workers 进度条后面
    const pagesBarEl = document.getElementById('cfPagesBar');
    pagesBarEl.style.width = Math.min(pagesRatio, 100 - workersRatio) + '%';
    pagesBarEl.style.left = Math.min(workersRatio, 100) + '%';
    pagesBarEl.textContent = '';
    // 总体百分比文字 (中央)
    const percentageCenterEl = document.getElementById('cfPercentageCenter');
    percentageCenterEl.textContent = `请求使用进度: ${total.toLocaleString()} (${percentage}%)`;
}
async function loadCustomIPs() {
    const textarea = document.getElementById('customIPs');
    textarea.disabled = true;
    textarea.value = '正在加载...';
    if (textarea._refreshLineEditor) textarea._refreshLineEditor();
    try {
        const response = await fetch('/admin/ADD.txt?_t=' + Date.now(), {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        if (response.ok) {
            textarea.value = await response.text();
        } else {
            textarea.value = '';
        }
    } catch (error) {
        showToast('加载自定义IP失败', 'error');
        textarea.value = '';
    } finally {
        textarea.disabled = false;
        if (textarea._refreshLineEditor) textarea._refreshLineEditor();
    }
}

function updateIPMode() {
    const mode = document.getElementById('ipMode').value;
    const sections = {
        'random': document.getElementById('randomIPSection'),
        'custom': document.getElementById('customIPSection'),
        'generator': document.getElementById('generatorSection')
    };
    Object.keys(sections).forEach(key => {
        const el = sections[key];
        if (el) {
            if (key === mode) {
                el.classList.remove('hidden-section');
                el.style.display = (key === 'custom') ? 'block' : 'grid';
            } else {
                el.classList.add('hidden-section');
                el.style.display = 'none';
            }
        }
    });
    if (mode === 'custom') {
        requestAnimationFrame(() => refreshLineEditor(document.getElementById('customIPs')));
    }
    // 显示或隐藏指定端口
    const portSection = document.getElementById('portSection');
    if (portSection) {
        if (mode === 'random' && currentConfig.优选订阅生成 ? .本地IP库 ? .指定端口 !== undefined) {
            portSection.classList.remove('hidden-section');
            portSection.style.display = 'grid';
        } else {
            portSection.classList.add('hidden-section');
            portSection.style.display = 'none';
        }
    }
    // 显示或隐藏在线优选、订阅接口和链式代理按钮（仅在自定义优选模式下显示）
    const onlineOptimizeBtn = document.getElementById('onlineOptimizeBtn');
    const apiOptimizeBtn = document.getElementById('apiOptimizeBtn');
    if (onlineOptimizeBtn) {
        if (mode === 'custom') {
            onlineOptimizeBtn.classList.remove('hidden-section');
        } else {
            onlineOptimizeBtn.classList.add('hidden-section');
        }
    }
    if (apiOptimizeBtn) {
        if (mode === 'custom') {
            apiOptimizeBtn.classList.remove('hidden-section');
        } else {
            apiOptimizeBtn.classList.add('hidden-section');
        }
    }
    updateChainProxyButtonVisibility(mode);
    // 当切换到自定义优选时，自动加载现有的ADD.txt内容
    if (mode === 'custom') {
        loadCustomIPs();
    }
    markModified('sub');
}

function updateChainProxyButtonVisibility(mode = null) {
    const chainProxyBtn = document.getElementById('chainProxyBtn');
    const ipMode = document.getElementById('ipMode');
    const activeMode = mode || ipMode ? .value || '';
    if (!chainProxyBtn) return;
    if (activeMode === 'custom' && chainProxyFeatureEnabled) {
        chainProxyBtn.classList.remove('hidden-section');
    } else {
        chainProxyBtn.classList.add('hidden-section');
    }
}
// 处理优选订阅生成器URL
function processGeneratorURL() {
    const input = document.getElementById('generatorURL').value.trim();
    let domain = '';
    if (input) {
        // 如果输入不是空的，提取域名
        domain = extractDomain(input);
        document.getElementById('generatorURL').value = domain;
    }
    markModified('sub');
}
// 提取URL中的纯域名
function extractDomain(url) {
    try {
        url = url.trim();
        // 如果不包含协议，尝试识别是否为完整URL或纯域名
        if (!url.includes('://')) {
            // 检查是否包含路径、查询参数或端口
            if (url.includes('/') || url.includes('?') || url.includes(':')) {
                // 这是一个完整的URL，补充https协议
                url = 'https://' + url;
            } else {
                // 这是纯域名，直接返回
                return url;
            }
        }
        // 解析URL
        const urlObj = new URL(url);
        // 获取hostname（不包含端口）
        let domain = urlObj.hostname;
        // 移除www前缀（如果有）
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }
        return domain;
    } catch (error) {
        // 如果URL解析失败，返回原始输入去掉协议部分的结果
        let temp = url.trim();
        if (temp.includes('://')) {
            temp = temp.split('://')[1];
        }
        if (temp.includes('/')) {
            temp = temp.split('/')[0];
        }
        if (temp.includes('?')) {
            temp = temp.split('?')[0];
        }
        if (temp.includes(':')) {
            temp = temp.split(':')[0];
        }
        if (temp.startsWith('www.')) {
            temp = temp.substring(4);
        }
        return temp;
    }
}

function updateGrpcModeVisibility() {
    const transportSelect = document.getElementById('transport');
    const grpcModeGroup = document.getElementById('grpcModeGroup');
    const grpcUserAgentGroup = document.getElementById('grpcUserAgentGroup');
    if (!transportSelect || !grpcModeGroup) return;
    const isGrpcTransport = transportSelect.value === 'grpc';
    const hasGrpcModeField = currentConfig && currentConfig['gRPC模式'] !== undefined;
    const hasGrpcUserAgentField = currentConfig && currentConfig['gRPCUserAgent'] !== undefined;
    grpcModeGroup.style.display = hasGrpcModeField && isGrpcTransport ? '' : 'none';
    if (grpcUserAgentGroup) {
        grpcUserAgentGroup.style.display = hasGrpcUserAgentField && isGrpcTransport ? '' : 'none';
    }
}

function showTransportGrpcTooltip() {
    const modal = document.getElementById('transportGrpcModal');
    if (!modal) return;
    modal.classList.add('show');
}

function hideTransportGrpcTooltip() {
    const modal = document.getElementById('transportGrpcModal');
    if (!modal) return;
    modal.classList.remove('show');
}

function closeTransportGrpcModal(event) {
    if (event && event.target && event.target.id !== 'transportGrpcModal') {
        return;
    }
    hideTransportGrpcTooltip();
}

function showSSTLSDisableModal(previousValue) {
    const modal = document.getElementById('ssTLSDisableModal');
    if (!modal) return;
    pendingSSTLSPreviousValue = previousValue;
    modal.classList.add('show');
}

function hideSSTLSDisableModal() {
    const modal = document.getElementById('ssTLSDisableModal');
    if (!modal) return;
    modal.classList.remove('show');
}

function closeSSTLSDisableModal(event) {
    if (event && event.target && event.target.id !== 'ssTLSDisableModal') {
        return;
    }
    cancelDisableSSTLS();
}

function confirmDisableSSTLS() {
    const ssTLSSelect = document.getElementById('ssTLS');
    if (!ssTLSSelect) return;
    ssTLSSelect.value = 'false';
    ssTLSSelect.dataset.confirmedValue = 'false';
    pendingSSTLSPreviousValue = null;
    hideSSTLSDisableModal();
    updateProtocol();
    markModified('config');
}

function cancelDisableSSTLS() {
    const ssTLSSelect = document.getElementById('ssTLS');
    if (ssTLSSelect) {
        const restoredValue = pendingSSTLSPreviousValue || ssTLSSelect.dataset.confirmedValue || 'true';
        ssTLSSelect.value = restoredValue;
        ssTLSSelect.dataset.confirmedValue = restoredValue;
    }
    pendingSSTLSPreviousValue = null;
    hideSSTLSDisableModal();
    updateProtocol();
}

function handleSSTLSChange(event) {
    const ssTLSSelect = document.getElementById('ssTLS');
    if (!ssTLSSelect) return;
    const nextValue = ssTLSSelect.value;
    const previousValue = ssTLSSelect.dataset.confirmedValue || 'true';
    const shouldConfirmDisable = nextValue === 'false' && previousValue !== 'false' && (!event || event.isTrusted);
    if (shouldConfirmDisable) {
        showSSTLSDisableModal(previousValue);
        return;
    }
    ssTLSSelect.dataset.confirmedValue = nextValue;
    updateProtocol();
    markModified('config');
}

function updateTransportGrpcTooltipVisibility(showWhenSupportedTransport = false) {
    const transportSelect = document.getElementById('transport');
    if (!transportSelect) return;
    const needsGrpcNotice = transportSelect.value === 'xhttp' || transportSelect.value === 'grpc';
    if (needsGrpcNotice && showWhenSupportedTransport) {
        showTransportGrpcTooltip();
        return;
    }
    hideTransportGrpcTooltip();
}

function handleTransportChange() {
    updateGrpcModeVisibility();
    updateTransportGrpcTooltipVisibility(true);
    const protocolSelect = document.getElementById('protocol');
    updateProtocolOptionAvailability(protocolSelect ? protocolSelect.value : '');
    markModified('config');
}

function fillCurrentGrpcUA() {
    const grpcUserAgentInput = document.getElementById('grpcUserAgent');
    if (!grpcUserAgentInput) return;
    grpcUserAgentInput.value = navigator.userAgent || '';
    markModified('config');
}

function syncTransportSettingsFromConfig() {
    const transportGroup = document.getElementById('transportGroup');
    const transportSelect = document.getElementById('transport');
    const grpcModeGroup = document.getElementById('grpcModeGroup');
    const grpcModeSelect = document.getElementById('grpcMode');
    const grpcUserAgentGroup = document.getElementById('grpcUserAgentGroup');
    const grpcUserAgentInput = document.getElementById('grpcUserAgent');
    if (!transportGroup || !transportSelect || !grpcModeGroup || !grpcModeSelect) return;
    const hasGrpcModeField = currentConfig && currentConfig['gRPC模式'] !== undefined;
    const hasGrpcUserAgentField = currentConfig && currentConfig['gRPCUserAgent'] !== undefined;
    if (!hasGrpcModeField) {
        transportGroup.style.display = 'none';
        grpcModeGroup.style.display = 'none';
        if (grpcUserAgentGroup) {
            grpcUserAgentGroup.style.display = 'none';
        }
        hideTransportGrpcTooltip();
        return;
    }
    transportGroup.style.display = '';
    transportSelect.value = currentConfig['传输协议'] || 'ws';
    if (!transportSelect.value) {
        transportSelect.value = 'ws';
    }
    grpcModeSelect.value = currentConfig['gRPC模式'] || 'gun';
    if (!grpcModeSelect.value) {
        grpcModeSelect.value = 'gun';
    }
    if (grpcUserAgentInput) {
        grpcUserAgentInput.value = hasGrpcUserAgentField ? (currentConfig['gRPCUserAgent'] || '') : '';
    }
    updateGrpcModeVisibility();
    updateTransportGrpcTooltipVisibility(false);
}

function syncSSProtocolSettingsFromConfig() {
    const protocolSelect = document.getElementById('protocol');
    const ssMethodSelect = document.getElementById('ssMethod');
    const ssTLSSelect = document.getElementById('ssTLS');
    if (!protocolSelect || !ssMethodSelect || !ssTLSSelect) return;
    const hasSSConfig = !!(currentConfig && currentConfig.SS && typeof currentConfig.SS === 'object');
    const ssOption = protocolSelect.querySelector('option[value="ss"]');
    const ssMethodKey = '\u52a0\u5bc6\u65b9\u5f0f';
    if (hasSSConfig) {
        if (!ssOption) {
            const option = document.createElement('option');
            option.value = 'ss';
            option.textContent = 'Shadowsocks';
            protocolSelect.appendChild(option);
        }
        const savedMethod = currentConfig.SS[ssMethodKey];
        ssMethodSelect.value = savedMethod || 'aes-128-gcm';
        if (!ssMethodSelect.value) {
            ssMethodSelect.value = 'aes-128-gcm';
        }
        ssTLSSelect.value = currentConfig.SS.TLS ? 'true' : 'false';
        ssTLSSelect.dataset.confirmedValue = ssTLSSelect.value;
        return;
    }
    if (ssOption) {
        ssOption.remove();
    }
    if (protocolSelect.value === 'ss') {
        protocolSelect.value = 'vless';
    }
    ssMethodSelect.value = 'aes-128-gcm';
    ssTLSSelect.value = 'false';
    ssTLSSelect.dataset.confirmedValue = ssTLSSelect.value;
}

function updateSpecifiedPortLabelsByProtocol(protocol) {
    const specifiedPortSelect = document.getElementById('specifiedPort');
    if (!specifiedPortSelect) return;
    const ssTLSSelect = document.getElementById('ssTLS');
    const defaultLabels = {
        '-1': '随机端口',
        '443': '443',
        '2053': '2053',
        '2083': '2083',
        '2087': '2087',
        '2096': '2096',
        '8443': '8443'
    };
    const shadowsocksLabels = {
        '-1': '随机端口',
        '443': '80',
        '2053': '2052',
        '2083': '2082',
        '2087': '2086',
        '2096': '2095',
        '8443': '8080'
    };
    const useShadowsocksNoTLSLabels = protocol === 'ss' && ssTLSSelect && ssTLSSelect.value === 'false';
    const labelMap = useShadowsocksNoTLSLabels ? shadowsocksLabels : defaultLabels;
    Array.from(specifiedPortSelect.options).forEach((option) => {
        const nextLabel = labelMap[option.value];
        if (nextLabel !== undefined) {
            option.textContent = nextLabel;
        }
    });
}

function updateProtocolOptionAvailability(protocol) {
    const ssTLSSelect = document.getElementById('ssTLS');
    const transportSelect = document.getElementById('transport');
    const enable0RTT = document.getElementById('enable0RTT');
    const skipVerify = document.getElementById('skipVerify');
    const tlsFragmentShadowrocket = document.getElementById('tlsFragmentShadowrocket');
    const tlsFragmentHapp = document.getElementById('tlsFragmentHapp');
    const isShadowsocks = protocol === 'ss';
    const isShadowsocksNoTLS = isShadowsocks && ssTLSSelect && ssTLSSelect.value === 'false';
    const isGrpcTransport = !!(transportSelect && transportSelect.value === 'grpc');
    const shouldDisable0RTT = isShadowsocks || isGrpcTransport;
    if (enable0RTT) {
        enable0RTT.disabled = shouldDisable0RTT;
        if (shouldDisable0RTT && enable0RTT.checked) {
            enable0RTT.checked = false;
        }
    }
    [tlsFragmentShadowrocket, tlsFragmentHapp].forEach((checkbox) => {
        if (checkbox) {
            checkbox.disabled = isShadowsocksNoTLS;
            if (isShadowsocksNoTLS && checkbox.checked) {
                checkbox.checked = false;
            }
        }
    });
}

function updateProtocol() {
    const protocolSelect = document.getElementById('protocol');
    const ssMethodGroup = document.getElementById('ssMethodGroup');
    const ssTLSGroup = document.getElementById('ssTLSGroup');
    if (!protocolSelect || !ssMethodGroup || !ssTLSGroup) return;
    const hasSSConfig = !!(currentConfig && currentConfig.SS && typeof currentConfig.SS === 'object');
    const showSSFields = hasSSConfig && protocolSelect.value === 'ss';
    ssMethodGroup.style.display = showSSFields ? '' : 'none';
    ssTLSGroup.style.display = showSSFields ? '' : 'none';
    const protocol = protocolSelect.value;
    updateSpecifiedPortLabelsByProtocol(protocol);
    updateProtocolOptionAvailability(protocol);
    const transport = document.getElementById('transport');
    if (transport) {
        const shouldLockTransport = protocol === 'ss';
        if (shouldLockTransport) {
            transport.value = 'ws';
        }
        transport.disabled = shouldLockTransport;
        updateGrpcModeVisibility();
        updateTransportGrpcTooltipVisibility(false);
    }
    // 协议/TLS 变化会影响 ECH 可用性
    updateECHOptionState();
}
// 处理浏览器指纹变化，联动ECH选项
function handleFingerprintChange() {
    updateECHOptionState();
    const enableECHCheckbox = document.getElementById('enableECH');
    const fingerprintSelect = document.getElementById('fingerprint');
    const currentFingerprint = fingerprintSelect ? .value;
    // 路径A：已开启ECH，但新指纹不支持ECH → 弹窗由用户决定处理方式
    if (enableECHCheckbox ? .checked && currentFingerprint && !ECH_SUPPORTED_FINGERPRINTS.includes(currentFingerprint)) {
        openECHConflictModal(currentFingerprint);
    }
}
// 处理ECH启用状态变化
function handleECHEnableChange() {
    const enableECHCheckbox = document.getElementById('enableECH');
    const fingerprintSelect = document.getElementById('fingerprint');
    // 路径B：用户开启ECH，但当前指纹不支持ECH → 先回退勾选，弹窗由用户决定处理方式
    if (enableECHCheckbox && enableECHCheckbox.checked) {
        const currentFingerprint = fingerprintSelect ? .value;
        if (currentFingerprint && !ECH_SUPPORTED_FINGERPRINTS.includes(currentFingerprint)) {
            enableECHCheckbox.checked = false;
            openECHConflictModal(currentFingerprint);
            return;
        }
    }
    markModified('ech');
}
// 隐藏 ECH×指纹 冲突弹窗（仅负责收起弹窗，不触发任何业务逻辑）
function hideECHConflictModal() {
    document.getElementById('echConflictModal').classList.remove('show');
}
// 打开 ECH×指纹 冲突弹窗（路径A/B共用）
function openECHConflictModal(unsupportedFingerprint) {
    const labelEl = document.getElementById('echConflictFingerprint');
    if (labelEl) labelEl.textContent = unsupportedFingerprint || '';
    document.getElementById('echConflictModal').classList.add('show');
}
// 三选一解决冲突（action: 'chrome' | 'firefox' | 'disable'）
function resolveECHConflict(action) {
    const enableECHCheckbox = document.getElementById('enableECH');
    const fingerprintSelect = document.getElementById('fingerprint');
    if (action === 'chrome' || action === 'firefox') {
        fingerprintSelect.value = action;
        enableECHCheckbox.checked = true;
    } else {
        // 关闭ECH：保留用户当前所选（不支持ECH的）指纹
        enableECHCheckbox.checked = false;
    }
    // 联动变更同时涉及两个模块：按与 currentConfig 的差异精确标记
    if (fingerprintSelect.value !== currentConfig['Fingerprint']) {
        markModified('config');
    }
    if (enableECHCheckbox.checked !== (currentConfig['ECH'] || false)) {
        markModified('ech');
    }
    hideECHConflictModal();
}
// 关闭弹窗入口：未通过按钮确认前关闭（×/遮罩）视为选择「关闭ECH」
function closeECHConflictModal(event) {
    if (!event || event.target.id === 'echConflictModal') {
        hideECHConflictModal();
        resolveECHConflict('disable');
    }
}
// 更新ECH选项的状态（禁用/启用）——仅 SS+TLS关闭 时禁用；与指纹的冲突改由弹窗解决
function updateECHOptionState() {
    const protocol = document.getElementById('protocol') ? .value;
    const ssTLS = document.getElementById('ssTLS') ? .value;
    const enableECHCheckbox = document.getElementById('enableECH');
    const isSSWithoutTLS = protocol === 'ss' && ssTLS === 'false';
    if (enableECHCheckbox) {
        // SS + TLS关闭时不满足条件，自动取消勾选
        if (isSSWithoutTLS && enableECHCheckbox.checked) {
            enableECHCheckbox.checked = false;
            markModified('ech');
        }
        // SS + TLS关闭时，ECH启用不可编辑
        enableECHCheckbox.disabled = isSSWithoutTLS;
    }
}
// 填充ECH DNS下拉框
function populateEchDNSSelect() {
    const formGroup = document.getElementById('echDNSGroup');
    const select = document.getElementById('echDNSSelect');
    const customInput = document.getElementById('echDNSCustomInput');
    const hiddenValue = document.getElementById('echDNSValue');
    if (!select || !formGroup) return;
    // 检查ECHConfig.DNS字段是否存在
    if (currentConfig.ECHConfig ? .DNS === undefined) {
        formGroup.style.display = 'none';
        return;
    }
    // 显示form-group和下拉框
    formGroup.style.display = 'grid';
    select.style.display = 'block';
    // 如果已有保存的DNS值，设置选中状态
    const savedDNS = currentConfig.ECHConfig ? .DNS || '';
    if (savedDNS) {
        // 尝试在下拉框中找到匹配的选项
        select.value = savedDNS;
        // 如果没有匹配到（值不在列表中），选择"自定义"并显示输入框
        if (select.value !== savedDNS) {
            select.value = 'custom';
            customInput.value = savedDNS;
            customInput.style.display = 'block';
            hiddenValue.value = savedDNS;
        } else {
            // 匹配成功，隐藏自定义输入框
            customInput.style.display = 'none';
            customInput.value = '';
            hiddenValue.value = savedDNS;
        }
    } else {
        // 没有保存值，默认选择"自定义"
        select.value = 'custom';
        customInput.style.display = 'block';
    }
}
// 填充ECH SNI下拉框
function populateEchSNISelect() {
    const formGroup = document.getElementById('echSNIGroup');
    const select = document.getElementById('echSNISelect');
    const customInput = document.getElementById('echSNICustomInput');
    const hiddenValue = document.getElementById('echSNIValue');
    if (!select || !formGroup) return;
    // 检查ECHConfig.SNI字段是否存在
    if (currentConfig.ECHConfig ? .SNI === undefined) {
        formGroup.style.display = 'none';
        return;
    }
    // 显示form-group和下拉框
    formGroup.style.display = 'grid';
    select.style.display = 'block';
    // 如果已有保存的SNI值，设置选中状态
    const savedSNI = currentConfig.ECHConfig ? .SNI;
    if (savedSNI !== undefined) {
        if (savedSNI === null) {
            // 自动获取
            select.value = '__AUTO__';
            customInput.style.display = 'none';
            customInput.value = '';
            hiddenValue.value = null;
        } else {
            // 尝试在下拉框中找到匹配的选项
            select.value = savedSNI;
            // 如果没有匹配到（值不在列表中），选择"自定义"并显示输入框
            if (select.value !== savedSNI) {
                select.value = 'custom';
                customInput.value = savedSNI;
                customInput.style.display = 'block';
                hiddenValue.value = savedSNI;
            } else {
                // 匹配成功，隐藏自定义输入框
                customInput.style.display = 'none';
                customInput.value = '';
                hiddenValue.value = savedSNI;
            }
        }
    } else {
        // 没有保存值，默认选择"自定义"
        select.value = 'custom';
        customInput.style.display = 'block';
    }
}
// ECH DNS select 变化处理
function onEchDNSSelectChange() {
    const select = document.getElementById('echDNSSelect');
    const customInput = document.getElementById('echDNSCustomInput');
    const hiddenValue = document.getElementById('echDNSValue');
    if (select.value === 'custom') {
        customInput.style.display = 'block';
        hiddenValue.value = customInput.value;
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
        hiddenValue.value = select.value;
    }
    // 检查是否选择了国内DNS，若是则自动调整ECH解析域名
    const selectedOption = select.options[select.selectedIndex];
    const region = selectedOption.dataset.region;
    if (region === 'domestic') {
        const echSNISelect = document.getElementById('echSNISelect');
        // 如果当前选择是 __AUTO__，自动改为 cloudflare-ech.com
        if (echSNISelect.value === '__AUTO__') {
            echSNISelect.value = 'cloudflare-ech.com';
            onEchSNISelectChange();
        }
    }
    markModified('ech');
}
// ECH DNS 自定义输入框变化处理
function onEchDNSCustomInput() {
    const customInput = document.getElementById('echDNSCustomInput');
    const hiddenValue = document.getElementById('echDNSValue');
    hiddenValue.value = customInput.value;
    markModified('ech');
}
// ECH SNI select 变化处理
function onEchSNISelectChange() {
    const select = document.getElementById('echSNISelect');
    const customInput = document.getElementById('echSNICustomInput');
    const hiddenValue = document.getElementById('echSNIValue');
    if (select.value === '__AUTO__') {
        customInput.style.display = 'none';
        customInput.value = '';
        hiddenValue.value = null;
        // 检查当前DNS服务是否为国内DNS
        const echDNSSelect = document.getElementById('echDNSSelect');
        const selectedDNSOption = echDNSSelect.options[echDNSSelect.selectedIndex];
        const dnsRegion = selectedDNSOption.dataset.region;
        if (dnsRegion === 'domestic') {
            alert('⚠️ ECH 配置提示\n\n默认使用节点HOST伪装域名 配合 国内 DNS 可能导致 ECH 解析失败。\n\n解决方案（任选其一）：\n① 将 ECH 解析域名改为 cloudflare-ech.com（推荐）\n② 将 ECH DNS 切换为国际服务（如 NextDNS）');
            select.value = 'cloudflare-ech.com';
        }
    } else if (select.value === 'custom') {
        customInput.style.display = 'block';
        hiddenValue.value = customInput.value;
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
        hiddenValue.value = select.value;
    }
    markModified('ech');
}
// ECH SNI 自定义输入框变化处理
function onEchSNICustomInput() {
    const customInput = document.getElementById('echSNICustomInput');
    const hiddenValue = document.getElementById('echSNIValue');
    hiddenValue.value = customInput.value;
    markModified('ech');
}
// 处理PROXYIP地址
function processProxyIP() {
    const input = document.getElementById('proxyIP').value.trim();
    if (input && input !== 'auto') {
        const cleanAddress = extractProxyIPAddress(input);
        document.getElementById('proxyIP').value = cleanAddress;
    }
    markModified('proxy');
}
// 提取PROXYIP地址中的纯格式（保留端口号）
function extractProxyIPAddress(input) {
    input = input.trim();
    // 首先检查是否包含 "ip=" (包括 proxyip= 和 pyip=)
    const ipPatterns = ['proxyip=', 'pyip=', 'ip='];
    for (const pattern of ipPatterns) {
        const index = input.toLowerCase().indexOf(pattern);
        if (index !== -1) {
            input = input.substring(index + pattern.length).trim();
            break;
        }
    }
    // 移除协议前缀 (http:// 或 https://)
    if (input.toLowerCase().startsWith('http://')) {
        input = input.substring(7).trim();
    } else if (input.toLowerCase().startsWith('https://')) {
        input = input.substring(8).trim();
    }
    // 移除末尾的斜杠
    if (input.endsWith('/')) {
        input = input.substring(0, input.length - 1).trim();
    }
    // 移除末尾的备注（#符号之后的内容）
    if (input.includes('#')) {
        input = input.split('#')[0].trim();
    }
    return input;
}
// 处理SOCKS5、HTTP、HTTPS、TURN和SSTP代理地址
function processProxyAddress(type) {
    const proxyAddressFieldMap = {
        socks5: 'socks5Addr',
        http: 'httpAddr',
        https: 'httpsAddr',
        turn: 'turnAddr',
        sstp: 'sstpAddr'
    };
    const fieldId = proxyAddressFieldMap[type] || 'httpAddr';
    const input = document.getElementById(fieldId).value.trim();
    let cleanAddress = '';
    if (input) {
        cleanAddress = extractProxyAddress(input, type);
        document.getElementById(fieldId).value = cleanAddress;
        // 如果输入内容包含协议标识，自动切换反代模式并转移内容
        switchProxyModeByProtocol(input, cleanAddress);
    }
    markModified('proxy');
}
// 提取代理地址中的纯格式
function extractProxyAddress(input, type) {
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

function setProxyAddressForProtocol(protocol, cleanAddress) {
    document.getElementById('proxyIP').value = '';
    PROXY_PROTOCOLS.forEach((item) => {
        const field = document.getElementById(getProxyAddressFieldId(item));
        if (field) {
            field.value = item === protocol ? cleanAddress : '';
        }
    });
}
// 根据协议自动切换反代模式
function switchProxyModeByProtocol(input, cleanAddress) {
    const lowerInput = input.toLowerCase();
    const protocolRules = [{
        protocol: 'socks5',
        markers: ['socks5://', 'socks5='],
        pathPrefix: '/socks'
    }, {
        protocol: 'https',
        markers: ['https://', 'https='],
        pathPrefix: '/https'
    }, {
        protocol: 'turn',
        markers: ['turn://', 'turn='],
        pathPrefix: '/turn'
    }, {
        protocol: 'sstp',
        markers: ['sstp://', 'sstp='],
        pathPrefix: '/sstp'
    }, {
        protocol: 'http',
        markers: ['http://', 'http='],
        pathPrefix: '/http'
    }];
    const matchedRule = protocolRules.find(({
        markers,
        pathPrefix
    }) => markers.some((marker) => lowerInput.includes(marker)) || lowerInput.startsWith(pathPrefix));
    if (!matchedRule) return;
    const protocol = normalizeProxyProtocol(matchedRule.protocol);
    setProxyModeSelection(protocol);
    setProxyAddressForProtocol(protocol, cleanAddress);
    updateProxyMode(false, false);
}

function updateProxyProtocol(markSectionModified = true) {
    setProxyModeSelection(getSelectedProxyProtocol());
    updateProxyMode(markSectionModified);
}

function updateProxyMode(markSectionModified = true, populateFromConfig = true) {
    const mode = getEffectiveProxyMode();
    const isProxyIPMode = mode === 'auto';
    document.getElementById('proxyIPSection').style.display = isProxyIPMode ? 'block' : 'none';
    document.getElementById('otherProxySection').style.display = isProxyIPMode ? 'none' : 'block';
    if (!isProxyIPMode) {
        setProxyModeSelection(mode);
        syncProxyProtocolVisibility(mode);
    }
    // 根据选择的模式填充对应的数据
    if (populateFromConfig) {
        if (isProxyIPMode) {
            document.getElementById('proxyIP').value = currentConfig.反代 ? .PROXYIP || '';
            document.getElementById('autoProxy').checked = (currentConfig.反代 ? .PROXYIP === 'auto');
            document.getElementById('proxyIP').disabled = (currentConfig.反代 ? .PROXYIP === 'auto');
        } else {
            populateProxyProtocolFromConfig(mode);
        }
    }
    // 更新 "获取更多PROXYIP" 按钮的显示状态
    const getMoreBtn = document.getElementById('getMoreProxyIPBtn');
    if (getMoreBtn) {
        getMoreBtn.style.display = isProxyIPMode ? 'inline-block' : 'none';
    }
    // 更新 "探索更多SOCKS5" 按钮的显示状态
    const exploreSocks5Btn = document.getElementById('exploreSocks5Btn');
    if (exploreSocks5Btn) {
        exploreSocks5Btn.style.display = mode === 'socks5' ? 'inline-block' : 'none';
    }
    // 更新 "探索更多HTTP" 按钮的显示状态
    const exploreHTTPBtn = document.getElementById('exploreHTTPBtn');
    if (exploreHTTPBtn) {
        exploreHTTPBtn.style.display = mode === 'http' ? 'inline-block' : 'none';
    }
    // 更新 "探索更多HTTPS" 按钮的显示状态
    const exploreHTTPSBtn = document.getElementById('exploreHTTPSBtn');
    if (exploreHTTPSBtn) {
        exploreHTTPSBtn.style.display = mode === 'https' && httpsProxyFeatureEnabled ? 'inline-block' : 'none';
    }
    // 更新 "路径模板配置" 按钮的显示状态
    const pathTemplateConfigBtn = document.getElementById('pathTemplateConfigBtn');
    if (pathTemplateConfigBtn) {
        const supportsPathTemplate = currentConfig.反代 ? .路径模板 !== undefined && ['auto', 'socks5', 'http'].includes(mode);
        pathTemplateConfigBtn.style.display = supportsPathTemplate ? 'inline-block' : 'none';
    }
    if (markSectionModified) {
        markModified('proxy');
    }
}

function toggleAutoProxy() {
    const autoProxy = document.getElementById('autoProxy').checked;
    document.getElementById('proxyIP').disabled = autoProxy;
    markModified('proxy');
}

function clearHeightTransition(content) {
    if (content && content._transitionHandler) {
        content.removeEventListener('transitionend', content._transitionHandler);
        content._transitionHandler = null;
    }
}

function animateSectionHeight(content, expand) {
    if (!content) return;
    clearHeightTransition(content);
    content.style.display = 'block';
    content.style.overflow = 'hidden';
    const startHeight = content.getBoundingClientRect().height;
    content.style.height = startHeight + 'px';
    content.getBoundingClientRect();
    const targetHeight = expand ? content.scrollHeight : 0;
    if (Math.abs(targetHeight - startHeight) < 1) {
        if (expand) {
            content.style.height = 'auto';
            content.style.overflow = 'visible';
        } else {
            content.style.display = 'none';
            content.style.height = '0px';
            content.style.overflow = 'hidden';
        }
        return;
    }
    content.style.height = targetHeight + 'px';
    const onEnd = function(e) {
        if (e.propertyName !== 'height') return;
        content.removeEventListener('transitionend', onEnd);
        content._transitionHandler = null;
        if (expand) {
            content.style.height = 'auto';
            content.style.overflow = 'visible';
        } else {
            content.style.display = 'none';
            content.style.height = '0px';
            content.style.overflow = 'hidden';
        }
    };
    content._transitionHandler = onEnd;
    content.addEventListener('transitionend', onEnd);
}

function toggleModule(titleEl) {
    const module = titleEl.parentElement;
    const content = module.querySelector('.module-content');
    if (module.id === 'preferredSubscriptionModule') {
        module.classList.remove('collapsed');
        return;
    }
    // If there's no collapsible content, just toggle the class
    if (!content) {
        module.classList.toggle('collapsed');
        saveModuleStates();
        return;
    }
    const isCollapsed = module.classList.contains('collapsed');
    if (isCollapsed) {
        // 检查是否是网络模块，如果是则加载数据
        if (module.querySelector('.network-cards-container') && !networkInfoLoaded) {
            scheduleNetworkInfoLoad({
                delayMs: 0
            });
        }
        module.classList.remove('collapsed');
        animateSectionHeight(content, true);
        if (module.id === 'cfUsageModule') {
            updateCountdown(true);
        }
    } else {
        module.classList.add('collapsed');
        animateSectionHeight(content, false);
    }
    // 保存模块状态到 localStorage
    saveModuleStates();
}
// 网络信息模块的折叠/展开函数
function toggleNetworkModule(titleEl) {
    const module = titleEl.parentElement;
    const content = document.getElementById('network-module-content');
    const icon = titleEl.querySelector('.collapse-icon');
    const isHidden = content.style.display === 'none' || getComputedStyle(content).display === 'none';
    if (isHidden) {
        // Expand - show latency tests and start testing
        module.classList.remove('network-detail-collapsed');
        animateSectionHeight(content, true);
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
        // 生成卡片并开始测试
        startLatencyTest();
    } else {
        // Collapse - hide latency tests
        module.classList.add('network-detail-collapsed');
        stopLatencyTest();
        animateSectionHeight(content, false);
        if (icon) {
            icon.style.transform = 'rotate(90deg)';
        }
    }
}
// 规范化PATH字段
function normalizePath(path) {
    // 如果为空，返回原值
    if (!path) return path;
    // 移除 '#' 及其之后的所有内容（注释）
    let normalizedPath = path.split('#')[0];
    // 去除首尾空格
    normalizedPath = normalizedPath.trim();
    // 如果第一个字符不是 '/'，则添加 '/'
    if (normalizedPath && !normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
    }
    return normalizedPath;
}
// 处理PATH输入完成后的规范化
function handlePathChange() {
    const nodePathInput = document.getElementById('nodePATH');
    const originalValue = nodePathInput.value;
    const normalizedValue = normalizePath(originalValue);
    // 如果规范化后的值与原值不同，更新输入框
    if (normalizedValue !== originalValue) {
        nodePathInput.value = normalizedValue;
    }
    // 标记为已修改
    markModified('config');
}

function markModified(section) {
    modifiedSections.add(section);
    // 特殊处理 notification 部分：更新 TG.启用 状态
    if (section === 'notification') {
        const telegramCheckbox = document.getElementById('telegramEnabled');
        if (!currentConfig.TG) currentConfig.TG = {};
        currentConfig.TG.启用 = telegramCheckbox.checked;
    }
    updateButtonStates();
}

function updateButtonStates() {
    // 订阅生成模块
    const subModified = modifiedSections.has('sub');
    document.getElementById('saveSubBtn').disabled = !subModified;
    document.getElementById('cancelSubBtn').disabled = !subModified;
    // 配置信息模块
    const configModified = modifiedSections.has('config');
    document.getElementById('saveConfigBtn').disabled = !configModified;
    document.getElementById('cancelConfigBtn').disabled = !configModified;
    // ECH设置模块
    const echModified = modifiedSections.has('ech');
    document.getElementById('saveEchBtn').disabled = !echModified;
    document.getElementById('cancelEchBtn').disabled = !echModified;
    // 反代设置模块
    const proxyModified = modifiedSections.has('proxy');
    document.getElementById('saveProxyBtn').disabled = !proxyModified;
    document.getElementById('cancelProxyBtn').disabled = !proxyModified;
    // 订阅转换模块
    const convertModified = modifiedSections.has('convert');
    document.getElementById('saveConvertBtn').disabled = !convertModified;
    document.getElementById('cancelConvertBtn').disabled = !convertModified;
    // 通知设置模块
    const notificationModified = modifiedSections.has('notification');
    document.getElementById('saveNotificationBtn').disabled = !notificationModified;
    document.getElementById('cancelNotificationBtn').disabled = !notificationModified;
}

function resetAllButtons() {
    document.querySelectorAll('[id^="save"]').forEach(btn => btn.disabled = true);
    document.querySelectorAll('[id^="cancel"]').forEach(btn => btn.disabled = true);
}

function copySubscription(elementId) {
    const element = document.getElementById(elementId);
    navigator.clipboard.writeText(element.value).then(() => {
        showToast('📋 已复制到剪贴板', 'success');
    }).catch(() => {
        showToast('复制失败', 'error');
    });
}

function handleTLSFragmentChange(type) {
    const shadowrocket = document.getElementById('tlsFragmentShadowrocket');
    const happ = document.getElementById('tlsFragmentHapp');
    if (type === 'Shadowrocket') {
        if (shadowrocket.checked) {
            happ.checked = false;
        }
    } else if (type === 'Happ') {
        if (happ.checked) {
            shadowrocket.checked = false;
        }
    }
}

function showQRCode(elementId) {
    const text = document.getElementById(elementId).value;
    const container = document.getElementById('qrcodeContainer');
    container.innerHTML = '';
    // 如果文本过长，使用较低的纠错等级来支持更长的内容
    let correctLevel = QRCode.CorrectLevel.H;
    if (text.length > 1500) {
        correctLevel = QRCode.CorrectLevel.M;
    }
    if (text.length > 2500) {
        correctLevel = QRCode.CorrectLevel.L;
    }
    try {
        new QRCode(container, {
            text: text,
            width: 300,
            height: 300,
            colorDark: '#000',
            colorLight: '#fff',
            correctLevel: correctLevel
        });
        document.getElementById('qrcodeModal').classList.add('show');
    } catch (error) {
        // 如果文本过长，显示错误提示
        console.error('二维码生成失败:', error);
        showToast('链接过长，无法生成二维码。联系项目作者修复问题。', 'error');
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#f44336;">二维码生成失败：内容过长</div>';
    }
}

function closeQRCode(event) {
    if (!event || event.target.id === 'qrcodeModal') {
        document.getElementById('qrcodeModal').classList.remove('show');
    }
}

function handleSkipVerifyChange(event) {
    if (event.target.checked) {
        if (cachedCurrentVersionNumber >= SKIP_VERIFY_WARNING_BYPASS_MIN_VERSION) {
            markModified('config');
            return;
        }
        // 显示警告弹窗
        event.target.checked = false; // 先取消勾选
        document.getElementById('skipVerifyWarningModal').classList.add('show');
    } else {
        markModified('config');
    }
}

function closeSkipVerifyWarning(event) {
    if (!event || event.target.id === 'skipVerifyWarningModal') {
        document.getElementById('skipVerifyWarningModal').classList.remove('show');
    }
}

function confirmSkipVerify() {
    document.getElementById('skipVerify').checked = true;
    markModified('config');
    closeSkipVerifyWarning();
}
// ALPN 下拉框与警告弹窗相关状态及处理函数
let loadedALPNValue = '';
let pendingALPNValue = '';

function handleALPNChange(event) {
    const select = event.target;
    const newValue = select.value;
    if (!newValue) {
        // 手动切回客户端自动协商：不弹窗
        if (loadedALPNValue !== '') markModified('config');
        return;
    }
    // 暂存所选值，先回退为自动协商，待用户确认后再应用
    pendingALPNValue = newValue;
    select.value = '';
    document.getElementById('alpnPendingLabel').textContent = pendingALPNValue;
    document.getElementById('alpnWarningModal').classList.add('show');
}

function confirmALPNSelection() {
    const select = document.getElementById('alpn');
    if (pendingALPNValue) select.value = pendingALPNValue;
    pendingALPNValue = '';
    if (select.value !== loadedALPNValue) markModified('config');
    closeALPNWarningModal();
}

function keepAutoALPN() {
    pendingALPNValue = '';
    const select = document.getElementById('alpn');
    select.value = '';
    if (loadedALPNValue !== '') markModified('config');
    closeALPNWarningModal();
}

function closeALPNWarningModal(event) {
    if (!event || event.target.id === 'alpnWarningModal') {
        document.getElementById('alpnWarningModal').classList.remove('show');
        // 未确认前关闭（×/遮罩）视为放弃高危选择，回退为自动协商
        if (pendingALPNValue) {
            pendingALPNValue = '';
            const select = document.getElementById('alpn');
            select.value = '';
            if (loadedALPNValue !== '') markModified('config');
        }
    }
}

function updateALPNGroupVisibility() {
    const alpnGroup = document.getElementById('alpnGroup');
    if (!alpnGroup) return;
    const hasField = typeof currentConfig === 'object' && currentConfig !== null && currentConfig['ALPN'] !== undefined;
    alpnGroup.style.setProperty('display', (alpnFeatureEnabled && hasField) ? '' : 'none', 'important');
}
// 从 currentConfig 同步指纹伪装下拉框回显（renderUI 与 cancelEdit 共用）
function syncFingerprintSelectFromConfig() {
    const fingerprintGroup = document.getElementById('fingerprintGroup');
    const fingerprintSelect = document.getElementById('fingerprint');
    if (currentConfig['Fingerprint'] == undefined) {
        fingerprintGroup.style.setProperty('display', 'none', 'important');
    } else {
        fingerprintSelect.value = currentConfig['Fingerprint'] || 'chrome';
    }
}
// 从 currentConfig 同步 ALPN 下拉框回显（renderUI 与 cancelEdit 共用）
function syncALPNSelectFromConfig() {
    // 检查ALPN字段是否存在并回显
    const alpnSelect = document.getElementById('alpn');
    if (currentConfig['ALPN'] !== undefined) {
        const alpnValue = String(currentConfig['ALPN'] || '');
        // 非预设值时动态追加option，避免丢失用户已有配置（遍历比对，避免特殊字符导致选择器异常）
        const hasOption = Array.from(alpnSelect.options).some(opt => opt.value === alpnValue);
        if (alpnValue && !hasOption) {
            const customOption = document.createElement('option');
            customOption.value = alpnValue;
            customOption.textContent = `${alpnValue}（当前配置）`;
            alpnSelect.appendChild(customOption);
        }
        alpnSelect.value = alpnValue;
    } else {
        alpnSelect.value = '';
    }
    loadedALPNValue = alpnSelect.value;
    pendingALPNValue = ''; // 同步后未决的弹窗选择视为过期，避免状态悬挂
    updateALPNGroupVisibility();
}
// HOSTS 编辑模态框相关函数
function openHostsEditModal(event) {
    if (event) event.stopPropagation();
    const modal = document.getElementById('hostsEditModal');
    const textarea = document.getElementById('hostsEditTextarea');
    // 将 HOSTS 数组内容填入文本框，每行一个
    if (currentConfig.HOSTS && Array.isArray(currentConfig.HOSTS)) {
        textarea.value = currentConfig.HOSTS.join('\n');
    } else {
        textarea.value = '';
    }
    modal.classList.add('show');
    textarea.focus();
}

function closeHostsEditModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('hostsEditModal');
    modal.classList.remove('show');
}

function confirmHostsEdit() {
    const textarea = document.getElementById('hostsEditTextarea');
    const nodeHostInput = document.getElementById('nodeHost');
    // 将文本框内容按 逗号、中文逗号 和 换行 分割成数组
    const text = textarea.value;
    // 使用正则表达式，将 , 、， 和 \n 都作为分隔符
    const items = text.split(/[ ,，。\n]+/).map(item => cleanHostDomain(item.trim())).filter(item => item.length > 0);
    if (items.length === 0) {
        showToast('请至少输入一个域名', 'error');
        return;
    }
    // 更新 currentConfig.HOSTS 数组
    currentConfig.HOSTS = items;
    // 更新输入框显示（用逗号连接）
    nodeHostInput.value = items.join('、');
    // 关闭模态框
    closeHostsEditModal();
    // 标记配置已修改
    markModified('config');
    showToast('域名列表已更新，请保存配置', 'success');
}
// 清理域名格式：去掉协议、路径、端口号，只保留纯域名
function cleanHostDomain(input) {
    if (!input) return '';
    let domain = input;
    // 去掉协议前缀 (http:// 或 https://)
    domain = domain.replace(/^https?:\/\//i, '');
    // 去掉路径部分（第一个 / 及之后的内容）
    const slashIndex = domain.indexOf('/');
    if (slashIndex !== -1) {
        domain = domain.substring(0, slashIndex);
    }
    // 去掉端口号（: 及之后的数字）
    domain = domain.replace(/:\d+$/, '');
    return domain.trim();
}
async function saveSub() {
    const mode = document.getElementById('ipMode').value;
    // 检查文本框内容是否为空
    if (mode === 'random') {
        const randomCount = document.getElementById('randomCount').value.trim();
        if (!randomCount) {
            showToast('随机优选数量不能为空', 'error');
            return;
        }
    } else if (mode === 'custom') {
        const customIPs = document.getElementById('customIPs').value.trim();
        if (!customIPs) {
            showToast('自定义优选地址不能为空', 'error');
            return;
        }
    } else if (mode === 'generator') {
        const generatorURL = document.getElementById('generatorURL').value.trim();
        if (!generatorURL) {
            showToast('优选订阅生成器地址不能为空', 'error');
            return;
        }
    }
    const updates = {
        local: mode !== 'generator',
        本地IP库: {
            随机IP: mode === 'random',
            随机数量: parseInt(document.getElementById('randomCount').value) || 16
        },
        SUB: mode === 'generator' ? document.getElementById('generatorURL').value : null,
        SUBNAME: currentConfig.优选订阅生成.SUBNAME,
        SUBUpdateTime: currentConfig.优选订阅生成.SUBUpdateTime,
        TOKEN: currentConfig.优选订阅生成.TOKEN
    };
    // 如果指定端口存在，添加到本地IP库
    if (currentConfig.优选订阅生成 ? .本地IP库 ? .指定端口 !== undefined) {
        updates.本地IP库.指定端口 = parseInt(document.getElementById('specifiedPort').value);
    }
    currentConfig.优选订阅生成 = { ...currentConfig.优选订阅生成,
        ...updates
    };
    if (mode === 'custom') {
        const customIPs = document.getElementById('customIPs').value;
        try {
            await fetch('/admin/ADD.txt', {
                method: 'POST',
                body: customIPs
            });
        } catch (error) {
            showToast('保存自定义IP失败', 'error');
            return;
        }
    }
    await saveConfigToServer('sub');
}
async function saveConfig() {
    currentConfig.优选订阅生成.SUBNAME = document.getElementById('subName').value;
    currentConfig.协议类型 = document.getElementById('protocol').value;
    const ssMethodSelect = document.getElementById('ssMethod');
    const ssTLSSelect = document.getElementById('ssTLS');
    if (currentConfig.SS && typeof currentConfig.SS === 'object' && ssMethodSelect && ssTLSSelect) {
        const ssMethodKey = '\u52a0\u5bc6\u65b9\u5f0f';
        currentConfig.SS[ssMethodKey] = ssMethodSelect.value || 'aes-128-gcm';
        currentConfig.SS.TLS = ssTLSSelect.value === 'true';
    }
    if (currentConfig['gRPC模式'] !== undefined) {
        currentConfig['传输协议'] = document.getElementById('transport').value;
        currentConfig['gRPC模式'] = document.getElementById('grpcMode').value || 'gun';
    }
    if (currentConfig['gRPCUserAgent'] !== undefined) {
        const grpcUserAgentInput = document.getElementById('grpcUserAgent');
        if (grpcUserAgentInput) {
            // 保存前兜底：如果去除空格后为空，自动填入当前UA
            if (!grpcUserAgentInput.value.replace(/\s+/g, '')) {
                grpcUserAgentInput.value = navigator.userAgent || '';
            }
            currentConfig['gRPCUserAgent'] = grpcUserAgentInput.value || '';
        }
    }
    currentConfig.跳过证书验证 = document.getElementById('skipVerify').checked;
    // 保存PATH（如果"完整节点路径"字段存在，表示后端支持编辑PATH）
    if (currentConfig['完整节点路径'] !== undefined) {
        currentConfig.PATH = document.getElementById('nodePATH').value;
    }
    // 保存Fingerprint（如果字段存在）
    if (currentConfig['Fingerprint'] !== undefined) {
        currentConfig['Fingerprint'] = document.getElementById('fingerprint').value;
    }
    // 联动保存ECH（指纹与ECH联动，保存任一模块时同时保存两者的变更）
    if (currentConfig['ECH'] !== undefined) {
        currentConfig['ECH'] = document.getElementById('enableECH').checked;
        if (currentConfig.ECHConfig ? .DNS !== undefined) {
            const dnsValue = document.getElementById('echDNSValue').value;
            if (dnsValue) {
                currentConfig.ECHConfig.DNS = dnsValue;
            }
        }
        if (currentConfig.ECHConfig ? .SNI !== undefined) {
            const sniValue = document.getElementById('echSNIValue').value;
            currentConfig.ECHConfig.SNI = sniValue === '' ? null : sniValue;
        }
    }
    // 保存ALPN（仅当版本支持且字段存在时写入，避免低版本后端覆盖已有值）
    if (currentConfig['ALPN'] !== undefined && alpnFeatureEnabled) {
        currentConfig['ALPN'] = document.getElementById('alpn').value || '';
    }
    // 保存随机路径（如果字段存在）
    if (currentConfig['随机路径'] !== undefined) {
        currentConfig['随机路径'] = document.getElementById('randomPath').checked;
    }
    // 保存启用0RTT（如果字段存在）
    if (currentConfig['启用0RTT'] !== undefined) {
        currentConfig['启用0RTT'] = document.getElementById('enable0RTT').checked;
    }
    // 保存TLS分片（如果字段存在）
    if (currentConfig['TLS分片'] !== undefined) {
        const shadowrocket = document.getElementById('tlsFragmentShadowrocket').checked;
        const happ = document.getElementById('tlsFragmentHapp').checked;
        if (shadowrocket) {
            currentConfig['TLS分片'] = 'Shadowrocket';
        } else if (happ) {
            currentConfig['TLS分片'] = 'Happ';
        } else {
            currentConfig['TLS分片'] = null;
        }
    }
    await saveConfigToServer('config');
    // 更新网页标题
    document.title = `${currentConfig.优选订阅生成?.SUBNAME || 'edgetunnel'}设置页面 - 管理后台`;
}