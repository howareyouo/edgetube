async function saveEch() {
    // 联动保存指纹（指纹与ECH联动，保存任一模块时同时保存两者的变更）
    if (currentConfig['Fingerprint'] !== undefined) {
        currentConfig['Fingerprint'] = document.getElementById('fingerprint').value;
    }
    // 保存ECH（如果字段存在）
    if (currentConfig['ECH'] !== undefined) {
        currentConfig['ECH'] = document.getElementById('enableECH').checked;
        // 保存ECHConfig.DNS（如果存在）
        if (currentConfig.ECHConfig ? .DNS !== undefined) {
            const dnsValue = document.getElementById('echDNSValue').value;
            if (dnsValue) {
                currentConfig.ECHConfig.DNS = dnsValue;
            }
        }
        // 保存ECHConfig.SNI（如果存在）
        if (currentConfig.ECHConfig ? .SNI !== undefined) {
            const sniValue = document.getElementById('echSNIValue').value;
            currentConfig.ECHConfig.SNI = sniValue === '' ? null : sniValue;
        }
    }
    await saveConfigToServer('ech');
}
async function saveProxy() {
    const mode = getEffectiveProxyMode();
    let socksEnabled = null;
    let socksAccount = '';
    let globalProxy = false;
    let proxyIP = currentConfig.反代.PROXYIP;
    // 检查文本框内容是否为空
    if (mode === 'auto') {
        socksEnabled = null;
        const autoProxy = document.getElementById('autoProxy').checked;
        proxyIP = autoProxy ? 'auto' : document.getElementById('proxyIP').value.trim();
        if (!autoProxy && !proxyIP) {
            showToast('PROXYIP地址不能为空', 'error');
            return;
        }
    } else if (mode === 'socks5') {
        socksEnabled = 'socks5';
        socksAccount = document.getElementById('socks5Addr').value.trim();
        globalProxy = document.getElementById('globalSocks5').checked;
        if (!socksAccount) {
            showToast('SOCKS5地址不能为空', 'error');
            return;
        }
    } else if (mode === 'http') {
        socksEnabled = 'http';
        socksAccount = document.getElementById('httpAddr').value.trim();
        globalProxy = document.getElementById('globalHTTP').checked;
        if (!socksAccount) {
            showToast('HTTP地址不能为空', 'error');
            return;
        }
    } else if (mode === 'https') {
        if (!httpsProxyFeatureEnabled) {
            showToast('当前后端版本暂不支持HTTPS反代', 'error');
            return;
        }
        socksEnabled = 'https';
        socksAccount = document.getElementById('httpsAddr').value.trim();
        globalProxy = document.getElementById('globalHTTPS').checked;
        if (!socksAccount) {
            showToast('HTTPS地址不能为空', 'error');
            return;
        }
    } else if (mode === 'turn') {
        if (!turnSstpProxyFeatureEnabled) {
            showToast('当前后端版本暂不支持TURN反代', 'error');
            return;
        }
        socksEnabled = 'turn';
        socksAccount = document.getElementById('turnAddr').value.trim();
        globalProxy = document.getElementById('globalTURN').checked;
        if (!socksAccount) {
            showToast('TURN地址不能为空', 'error');
            return;
        }
    } else if (mode === 'sstp') {
        if (!turnSstpProxyFeatureEnabled) {
            showToast('当前后端版本暂不支持SSTP反代', 'error');
            return;
        }
        socksEnabled = 'sstp';
        socksAccount = document.getElementById('sstpAddr').value.trim();
        globalProxy = document.getElementById('globalSSTP').checked;
        if (!socksAccount) {
            showToast('SSTP地址不能为空', 'error');
            return;
        }
    }
    const existingReverseProxyConfig = currentConfig.反代 || {};
    const existingSocks5Config = existingReverseProxyConfig.SOCKS5 || {};
    currentConfig.反代 = { ...existingReverseProxyConfig,
        PROXYIP: proxyIP,
        SOCKS5: { ...existingSocks5Config,
            启用: socksEnabled,
            全局: globalProxy,
            账号: socksAccount,
            白名单: existingSocks5Config.白名单
        }
    };
    await saveConfigToServer('proxy');
}
// 加载SubConfig JSON数据
async function loadSubConfigData() {
    try {
        const url = 'https://raw.githubusercontent.com/cmliu/cmliu/main/SUBCONFIG.json';
        const text = await fetchWithAutoMirror(url, 'SubConfig');
        subConfigData = JSON.parse(text);
        populateSubConfigSelect();
        console.log('[订阅转换配置列表] SUBCONFIG 数据加载成功');
    } catch (error) {
        console.error('Error loading SubConfig:', error);
        // 加载失败时，仍然显示下拉框（只有自定义选项）
        subConfigData = null;
        populateSubConfigSelect();
    }
}
// 填充SubConfig下拉框
function populateSubConfigSelect() {
    const select = document.getElementById('subConfigSelect');
    const customInput = document.getElementById('subConfigCustomInput');
    if (!select) return; // 元素还不存在，等待后续调用
    // 始终添加"自定义"选项作为第一项
    select.innerHTML = '<option value="custom">&nbsp;&nbsp;&nbsp;&nbsp;自定义</option>';
    // 如果有数据，添加分组选项
    if (subConfigData && Array.isArray(subConfigData)) {
        subConfigData.forEach(group => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group.label;
            if (group.options && Array.isArray(group.options)) {
                group.options.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option.value;
                    opt.textContent = option.label;
                    optgroup.appendChild(opt);
                });
            }
            select.appendChild(optgroup);
        });
    }
    // 显示下拉框
    select.style.display = 'block';
    // 如果已有保存的配置值，设置选中状态
    const savedSubConfig = currentConfig.订阅转换配置 ? .SUBCONFIG || '';
    if (savedSubConfig) {
        // 尝试在下拉框中找到匹配的选项
        select.value = savedSubConfig;
        // 如果没有匹配到（值不在列表中），选择"自定义"并显示输入框
        if (select.value !== savedSubConfig) {
            select.value = 'custom';
            customInput.value = savedSubConfig;
            customInput.style.display = 'block';
            document.getElementById('subConfig').value = savedSubConfig;
        } else {
            // 匹配成功，隐藏自定义输入框
            customInput.style.display = 'none';
            customInput.value = '';
            document.getElementById('subConfig').value = savedSubConfig;
        }
    } else {
        // 没有保存值，默认选择"自定义"
        select.value = 'custom';
        customInput.style.display = 'block';
    }
    // 设置change事件监听
    select.onchange = function() {
        if (this.value === 'custom') {
            // 选择自定义，显示输入框
            customInput.style.display = 'block';
            document.getElementById('subConfig').value = customInput.value;
        } else {
            // 选择预设值，隐藏输入框并更新值
            customInput.style.display = 'none';
            customInput.value = '';
            document.getElementById('subConfig').value = this.value;
        }
        markModified('convert');
    };
}
// 自定义输入框变化时的处理
function onSubConfigCustomInput() {
    const customInput = document.getElementById('subConfigCustomInput');
    document.getElementById('subConfig').value = customInput.value;
    markModified('convert');
}

function syncSubListOption() {
    const subListGroup = document.getElementById('subListGroup');
    const hasSubList = currentConfig.订阅转换配置 ? .SUBLIST !== undefined;
    subListGroup.style.display = hasSubList ? '' : 'none';
    document.getElementById('subList').checked = hasSubList ? currentConfig.订阅转换配置 ? .SUBLIST || false : false;
    const udpGroup = document.getElementById('udpGroup');
    const hasUDP = currentConfig.订阅转换配置 ? .UDP !== undefined;
    udpGroup.style.display = hasUDP ? '' : 'none';
    document.getElementById('udp').checked = hasUDP ? currentConfig.订阅转换配置 ? .UDP || false : false;
    const xudpGroup = document.getElementById('xudpGroup');
    const hasXUDP = currentConfig.订阅转换配置 ? .XUDP !== undefined;
    xudpGroup.style.display = hasXUDP ? '' : 'none';
    document.getElementById('xudp').checked = hasXUDP ? currentConfig.订阅转换配置 ? .XUDP || false : false;
    const tls13Group = document.getElementById('tls13Group');
    const hasTLS13 = currentConfig.订阅转换配置 ? .TLS13 !== undefined;
    tls13Group.style.display = hasTLS13 ? '' : 'none';
    document.getElementById('tls13').checked = hasTLS13 ? currentConfig.订阅转换配置 ? .TLS13 || false : false;
    const appendTypeGroup = document.getElementById('appendTypeGroup');
    const hasAppendType = currentConfig.订阅转换配置 ? .APPEND_TYPE !== undefined;
    appendTypeGroup.style.display = hasAppendType ? '' : 'none';
    document.getElementById('appendType').checked = hasAppendType ? currentConfig.订阅转换配置 ? .APPEND_TYPE || false : false;
    const sortGroup = document.getElementById('sortGroup');
    const hasSORT = currentConfig.订阅转换配置 ? .SORT !== undefined;
    sortGroup.style.display = hasSORT ? '' : 'none';
    document.getElementById('sort').checked = hasSORT ? currentConfig.订阅转换配置 ? .SORT || false : false;
    const expandGroup = document.getElementById('expandGroup');
    const hasEXPAND = currentConfig.订阅转换配置 ? .EXPAND !== undefined;
    expandGroup.style.display = hasEXPAND ? '' : 'none';
    document.getElementById('expand').checked = hasEXPAND ? currentConfig.订阅转换配置 ? .EXPAND || false : false;
}
// UDP/XUDP 联动：XUDP 依赖 UDP，勾选 XUDP 自动勾选 UDP，取消 UDP 自动取消 XUDP
document.getElementById('xudp').addEventListener('change', function() {
    if (this.checked) {
        document.getElementById('udp').checked = true;
    }
});
document.getElementById('udp').addEventListener('change', function() {
    if (!this.checked) {
        document.getElementById('xudp').checked = false;
    }
});
async function saveConvert() {
    const hasSubList = currentConfig.订阅转换配置 ? .SUBLIST !== undefined;
    const hasUDP = currentConfig.订阅转换配置 ? .UDP !== undefined;
    const hasXUDP = currentConfig.订阅转换配置 ? .XUDP !== undefined;
    const hasTLS13 = currentConfig.订阅转换配置 ? .TLS13 !== undefined;
    const hasAppendType = currentConfig.订阅转换配置 ? .APPEND_TYPE !== undefined;
    const hasSORT = currentConfig.订阅转换配置 ? .SORT !== undefined;
    const hasEXPAND = currentConfig.订阅转换配置 ? .EXPAND !== undefined;
    currentConfig.订阅转换配置 = {
        SUBAPI: document.getElementById('subAPI').value,
        SUBCONFIG: document.getElementById('subConfig').value,
        SUBEMOJI: document.getElementById('emoji').checked
    };
    if (hasSubList) {
        currentConfig.订阅转换配置.SUBLIST = document.getElementById('subList').checked;
    }
    if (hasUDP) {
        currentConfig.订阅转换配置.UDP = document.getElementById('udp').checked;
    }
    if (hasXUDP) {
        currentConfig.订阅转换配置.XUDP = document.getElementById('xudp').checked;
    }
    if (hasTLS13) {
        currentConfig.订阅转换配置.TLS13 = document.getElementById('tls13').checked;
    }
    if (hasAppendType) {
        currentConfig.订阅转换配置.APPEND_TYPE = document.getElementById('appendType').checked;
    }
    if (hasSORT) {
        currentConfig.订阅转换配置.SORT = document.getElementById('sort').checked;
    }
    if (hasEXPAND) {
        currentConfig.订阅转换配置.EXPAND = document.getElementById('expand').checked;
    }
    await saveConfigToServer('convert');
}
async function saveConfigToServer(section) {
    try {
        const response = await fetch('/admin/config.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify(currentConfig)
        });
        if (!response.ok) throw new Error('保存失败');
        showToast('✅ 配置已保存，请更新订阅，才能获取最新节点内容！', 'success');
        modifiedSections.delete(section);
        updateButtonStates();
    } catch (error) {
        showToast('😢 ' + error.message + '，请检测网络环境，或关闭代理后再试！', 'error');
    }
}

function cancelEdit(section) {
    currentConfig = JSON.parse(JSON.stringify(originalConfig));
    // 只重置该模块的值，不调用 renderUI 以保持展开状态
    if (section === 'sub') {
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
    } else if (section === 'config') {
        document.getElementById('subName').value = currentConfig.优选订阅生成 ? .SUBNAME || '';
        document.getElementById('nodeHost').value = currentConfig.HOST || '';
        document.getElementById('nodeUUID').value = currentConfig.UUID || '';
        document.getElementById('nodePATH').value = currentConfig.PATH || '';
        syncSSProtocolSettingsFromConfig();
        document.getElementById('protocol').value = currentConfig.协议类型 || 'vless';
        syncTransportSettingsFromConfig();
        document.getElementById('skipVerify').checked = currentConfig.跳过证书验证 || false;
        // 处理PATH字段的只读状态
        const nodePathInput = document.getElementById('nodePATH');
        if (currentConfig['完整节点路径'] !== undefined) {
            nodePathInput.removeAttribute('readonly');
            nodePathInput.title = '节点的伪装路径';
            nodePathInput.onchange = handlePathChange;
        } else {
            nodePathInput.setAttribute('readonly', '');
            nodePathInput.title = '节点的伪装路径 仅可通过 \'PATH\'环境变量 进行修改';
            nodePathInput.onchange = null;
        }
        // 重置随机路径（如果字段存在）
        if (currentConfig['随机路径'] !== undefined) {
            document.getElementById('randomPath').checked = currentConfig['随机路径'] || false;
        }
        // 重置启用0RTT（如果字段存在）
        if (currentConfig['启用0RTT'] !== undefined) {
            document.getElementById('enable0RTT').checked = currentConfig['启用0RTT'] || false;
        }
        // 重置TLS分片（如果字段存在）
        if (currentConfig['TLS分片'] !== undefined) {
            document.getElementById('tlsFragmentShadowrocket').checked = currentConfig['TLS分片'] === 'Shadowrocket';
            document.getElementById('tlsFragmentHapp').checked = currentConfig['TLS分片'] === 'Happ';
        }
        // 重置ECH（如果字段存在）
        if (currentConfig['ECH'] !== undefined) {
            document.getElementById('enableECH').checked = currentConfig['ECH'] || false;
            // 重置ECHConfig的下拉框
            populateEchDNSSelect();
            populateEchSNISelect();
        }
        updateProtocol();
    } else if (section === 'ech') {
        // 重置ECH设置
        if (currentConfig['ECH'] !== undefined) {
            document.getElementById('enableECH').checked = currentConfig['ECH'] || false;
            // 重置ECHConfig的下拉框
            populateEchDNSSelect();
            populateEchSNISelect();
        }
    } else if (section === 'proxy') {
        applyProxyConfigToForm();
    } else if (section === 'convert') {
        document.getElementById('subAPI').value = currentConfig.订阅转换配置 ? .SUBAPI || '';
        document.getElementById('subConfig').value = currentConfig.订阅转换配置 ? .SUBCONFIG || '';
        document.getElementById('emoji').checked = currentConfig.订阅转换配置 ? .SUBEMOJI || false;
        syncSubListOption();
        // 重新填充下拉框以恢复正确的选中状态
        populateSubConfigSelect();
    }
    modifiedSections.delete(section);
    updateButtonStates();
}
// 保存模块展开/折叠状态到 localStorage
function saveModuleStates() {
    const states = {};
    document.querySelectorAll('.module').forEach((module, index) => {
        const title = module.querySelector('.module-title') ? .textContent ? .trim() || ('module-' + index);
        // 不保存"查看操作日志"和"当前网络信息"模块的状态
        if (title !== '📋 查看操作日志' && title !== '🌍 当前网络信息' && module.id !== 'preferredSubscriptionModule') {
            states[title] = !module.classList.contains('collapsed');
        }
    });
    localStorage.setItem('adminModuleStates', JSON.stringify(states));
}
// 从 localStorage 加载模块展开/折叠状态
function loadModuleStates() {
    const savedStates = localStorage.getItem('adminModuleStates');
    const states = savedStates ? JSON.parse(savedStates) : {};
    // 如果是第一次访问（localStorage中没有保存状态），所有模块默认折叠
    const isFirstVisit = !savedStates;
    document.querySelectorAll('.module').forEach((module, index) => {
        const title = module.querySelector('.module-title') ? .textContent ? .trim() || ('module-' + index);
        let shouldBeExpanded;
        // "查看操作日志"模块始终保持折叠状态，"当前网络信息"模块始终展开
        if (title === '📋 查看操作日志') {
            shouldBeExpanded = false;
        } else if (title === '🌍 当前网络信息') {
            shouldBeExpanded = true;
        } else if (module.id === 'preferredSubscriptionModule') {
            shouldBeExpanded = true;
        } else {
            shouldBeExpanded = isFirstVisit ? false : (states[title] !== false); // 第一次默认折叠，之后按保存的状态
        }
        const isCurrentlyCollapsed = module.classList.contains('collapsed');
        const content = module.querySelector('.module-content');
        if (shouldBeExpanded && isCurrentlyCollapsed) {
            // 需要展开
            module.classList.remove('collapsed');
            if (content) {
                clearHeightTransition(content);
                content.style.display = 'block';
                content.style.height = 'auto';
                content.style.overflow = 'visible';
            }
        } else if (!shouldBeExpanded && !isCurrentlyCollapsed) {
            // 需要折叠
            module.classList.add('collapsed');
            if (content) {
                clearHeightTransition(content);
                content.style.display = 'none';
                content.style.height = '0px';
                content.style.overflow = 'hidden';
            }
        }
    });
}
async function refreshConfig() {
    await loadConfig();
    const loadTime = currentConfig.加载时间 || '未知';
    showToast(`配置已刷新 (加载时间: ${loadTime})`, 'success');
}

function resetConfigWithConfirm() {
    document.getElementById('resetModal').classList.add('show');
}

function closeResetModal(event) {
    if (event && event.target.id !== 'resetModal') return;
    document.getElementById('resetModal').classList.remove('show');
}
async function confirmReset() {
    try {
        const response = await fetch('/admin/init');
        if (!response.ok) throw new Error('重置失败');
        closeResetModal();
        showToast('配置已重置为默认值', 'success');
        // 延迟1秒后刷新页面，让用户看到成功提示
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch (error) {
        showToast('重置失败: ' + error.message, 'error');
    }
}

function logout() {
    window.location.href = '/logout';
}
const USER_MODE_TRANSITION_DURATION = 1450;
let userModeTransitioning = false;

function getUserModeTransitionCopy(userMode) {
    if (userMode === 'simple') {
        return {
            icon: '🐣',
            title: '进入小白模式',
            subtitle: '常用设置已经为你收好'
        };
    }
    return {
        icon: '>_',
        title: 'ENTER THE MATRIX',
        subtitle: 'ROOT ACCESS // ADVANCED CONFIG ONLINE'
    };
}

function createExpertModeCodeRain() {
    const rain = document.createElement('div');
    rain.className = 'mode-transition-code-rain';
    rain.setAttribute('aria-hidden', 'true');
    const glyphs = ['ACCESS\n0x7F\n1011\nROOT\nTLS\nECHO\n443\nPATH', 'CONFIG\nHOST\nUUID\nVLESS\nREALITY\nHY2\nSNI\nOK', 'ROUTE\nPROXY\nSOCKS\nHTTP\nECH\nDNS\nALPN\nRUN', '0101\n1110\nAUTH\nTOKEN\nTRACE\nEDGE\nWORKER\nCF', 'PATCH\nMERGE\nDEBUG\nCHAIN\nAPI\nPORT\nLOG\nUP', 'SYSTEM\nONLINE\nVERIFY\nNODE\nRULE\nBYPASS\nLINK\nGO'];
    const streamCount = Math.min(44, Math.max(24, Math.ceil(window.innerWidth / 34)));
    for (let index = 0; index < streamCount; index += 1) {
        const stream = document.createElement('span');
        stream.className = 'mode-transition-code-stream';
        stream.textContent = glyphs[index % glyphs.length];
        stream.style.setProperty('--stream-x', `${((index + 0.3) / streamCount) * 100}%`);
        stream.style.setProperty('--stream-delay', `${-(index % 9) * 0.13}s`);
        stream.style.setProperty('--stream-duration', `${0.95 + (index % 7) * 0.1}s`);
        stream.style.setProperty('--stream-opacity', `${0.36 + (index % 5) * 0.11}`);
        stream.style.setProperty('--stream-size', `clamp(10px, ${1.1 + (index % 4) * 0.22}vw, 17px)`);
        rain.appendChild(stream);
    }
    return rain;
}

function createExpertModeFrame() {
    const frame = document.createElement('div');
    frame.className = 'mode-transition-expert-frame';
    frame.setAttribute('aria-hidden', 'true');
    return frame;
}

function createExpertModeBurst() {
    const burst = document.createElement('div');
    burst.className = 'mode-transition-expert-burst';
    burst.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 34; index += 1) {
        const particle = document.createElement('span');
        particle.className = 'mode-transition-expert-particle';
        particle.style.setProperty('--particle-angle', `${(360 / 34) * index}deg`);
        particle.style.setProperty('--particle-distance', `min(${190 + (index % 9) * 24}px, 47vw)`);
        particle.style.setProperty('--particle-delay', `${(index % 6) * 0.018}s`);
        particle.style.setProperty('--particle-size', `${2 + (index % 4)}px`);
        burst.appendChild(particle);
    }
    return burst;
}

function createExpertModeBootLog() {
    const log = document.createElement('div');
    log.className = 'mode-transition-boot-log';
    log.setAttribute('aria-hidden', 'true');
    [
        ['INIT ROOT SHELL', 'OK'],
        ['DECRYPT CONFIG GRAPH', 'OK'],
        ['MOUNT ADVANCED MODULES', 'ONLINE']
    ].forEach(([label, state], index) => {
        const line = document.createElement('div');
        line.className = 'mode-transition-boot-line';
        line.style.setProperty('--boot-delay', `${0.28 + index * 0.16}s`);
        const labelNode = document.createElement('span');
        labelNode.textContent = label;
        const stateNode = document.createElement('span');
        stateNode.textContent = state;
        line.appendChild(labelNode);
        line.appendChild(stateNode);
        log.appendChild(line);
    });
    return log;
}

function playUserModeTransition(userMode, onCovered, onDone) {
    const copy = getUserModeTransitionCopy(userMode);
    const btn = document.getElementById('modeToggleBtn');
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const overlay = document.createElement('div');
    overlay.className = 'mode-transition-overlay';
    overlay.dataset.mode = userMode;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    const content = document.createElement('div');
    content.className = 'mode-transition-content';
    const icon = document.createElement('div');
    icon.className = 'mode-transition-icon';
    icon.textContent = copy.icon;
    const title = document.createElement('h2');
    title.className = 'mode-transition-title';
    title.textContent = copy.title;
    title.dataset.text = copy.title;
    const subtitle = document.createElement('p');
    subtitle.className = 'mode-transition-subtitle';
    subtitle.textContent = copy.subtitle;
    const pulse = document.createElement('div');
    pulse.className = 'mode-transition-pulse';
    if (userMode === 'expert') {
        overlay.appendChild(createExpertModeCodeRain());
        overlay.appendChild(createExpertModeFrame());
        overlay.appendChild(createExpertModeBurst());
    }
    content.appendChild(icon);
    content.appendChild(title);
    content.appendChild(subtitle);
    if (userMode === 'expert') {
        content.appendChild(createExpertModeBootLog());
    }
    content.appendChild(pulse);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    userModeTransitioning = true;
    if (btn) {
        btn.disabled = true;
    }
    requestAnimationFrame(() => {
        overlay.classList.add('is-visible');
    });
    const visibleDelay = prefersReducedMotion ? 220 : USER_MODE_TRANSITION_DURATION;
    const exitDelay = prefersReducedMotion ? 80 : 260;
    setTimeout(() => {
        try {
            if (typeof onCovered === 'function') {
                onCovered();
            }
        } catch (error) {
            console.warn('User mode transition failed:', error);
        }
        overlay.classList.add('is-exiting');
        setTimeout(() => {
            overlay.remove();
            if (btn) {
                btn.disabled = false;
            }
            userModeTransitioning = false;
            if (typeof onDone === 'function') {
                onDone();
            }
        }, exitDelay);
    }, visibleDelay);
}

function applyUserMode(userMode) {
    const cardContainer = document.querySelector('.card-container');
    const btn = document.getElementById('modeToggleBtn');
    const isSimpleMode = userMode === 'simple';
    if (!cardContainer || !btn) {
        return;
    }
    if (isSimpleMode) {
        cardContainer.classList.add('simple-mode');
        btn.textContent = '🚀 我是高手！我就要折腾！';
        localStorage.setItem('userMode', 'simple');
    } else {
        cardContainer.classList.remove('simple-mode');
        btn.textContent = '🐣 我是小白！我想简单点！';
        localStorage.setItem('userMode', 'expert');
    }
    // 使用 requestAnimationFrame 确保动画流畅
    requestAnimationFrame(() => {
        void cardContainer.offsetHeight;
    });
}
// 切换用户模式（小白模式 / 高手模式）
function toggleUserMode() {
    const cardContainer = document.querySelector('.card-container');
    if (!cardContainer || userModeTransitioning) {
        return;
    }
    const targetMode = cardContainer.classList.contains('simple-mode') ? 'expert' : 'simple';
    playUserModeTransition(targetMode, () => applyUserMode(targetMode));
}
// 初始化用户模式
function initUserMode() {
    const userMode = localStorage.getItem('userMode') || 'simple'; // 默认为小白模式
    applyUserMode(userMode);
}

function showToast(message, type = 'info') {
    // 移除现有的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    // 创建新的toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    // 显示动画
    setTimeout(() => toast.classList.add('show'), 10);
    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
// UUID easter egg
const UUID_EASTER_CLICK_TARGET_COUNT = 10;
const UUID_EASTER_LONG_PRESS_TARGET_COUNT = 16;
const UUID_EASTER_HINT_START = 4;
const UUID_EASTER_MAX_INTERVAL = 1000;
const UUID_EASTER_RESET_DELAY = 1400;
const UUID_EASTER_LONG_PRESS_DELAY = 360;
const UUID_EASTER_LONG_PRESS_INTERVAL = 120;
const UUID_EASTER_FX_VERTICAL_OFFSET = 12;
const UUID_EASTER_GIFT_ICONS = ['🎁', '🎀', '🧧', '🎉'];
const UUID_EASTER_FIREWORK_PARTICLE_COUNT = 26;
const UUID_SNIPPETS_JS_URL = 'https://raw.githubusercontent.com/EDT-Pages/EDT.min.js/Snippets/EDT.min.js';
const UUID_SNIPPETS_DICT_URL = 'https://raw.githubusercontent.com/EDT-Pages/EDT.min.js/Snippets/字典.json';
let uuidEasterClickCount = 0;
let uuidEasterLastClickAt = 0;
let uuidEasterResetTimer = null;
let uuidEasterLongPressDelayTimer = null;
let uuidEasterLongPressIntervalTimer = null;
let uuidEasterActivePointerId = null;
let uuidEasterPointerX = NaN;
let uuidEasterPointerY = NaN;
let uuidEasterLongPressMode = false;
let uuidSnippetLoading = false;
let uuidSnippetDisplayProgressTimer = null;
let uuidSnippetDisplayPreviewTimer = null;
let uuidSnippetDisplayRevealFrame = null;
let uuidSnippetDisplayReleaseTimer = null;
let uuidSnippetDisplayToken = 0;
let uuidSnippetDisplayProgressValue = 0;
let uuidSnippetDisplayProgressTarget = 0;
let uuidSnippetRawCode = '';
const uuidSnippetLastLiteralVariants = new Map();
const UUID_SNIPPET_REVEAL_CHARSET = '01<>/\\\\{}[]=+-_*#@$%&ABCDEFGHJKLMNPQRSTUVWXYZ';
const UUID_SNIPPET_STATUS_TEXT = {
    boot: 'BOOT',
    sync: 'SYNC',
    bind: 'BIND',
    mesh: 'MESH',
    reveal: 'REVEAL',
    fail: 'FAIL'
};

function resetNodeUUIDEasterCount() {
    uuidEasterClickCount = 0;
    uuidEasterLastClickAt = 0;
    if (uuidEasterResetTimer) {
        clearTimeout(uuidEasterResetTimer);
        uuidEasterResetTimer = null;
    }
}

function stopNodeUUIDLongPress() {
    if (uuidEasterLongPressDelayTimer) {
        clearTimeout(uuidEasterLongPressDelayTimer);
        uuidEasterLongPressDelayTimer = null;
    }
    if (uuidEasterLongPressIntervalTimer) {
        clearInterval(uuidEasterLongPressIntervalTimer);
        uuidEasterLongPressIntervalTimer = null;
    }
    uuidEasterActivePointerId = null;
    uuidEasterLongPressMode = false;
}

function getNodeUUIDFxOrigin(clientX, clientY, fallbackEl) {
    const rect = fallbackEl.getBoundingClientRect();
    const baseX = Number.isFinite(clientX) ? clientX : rect.left + rect.width / 2;
    const baseY = Number.isFinite(clientY) ? clientY : rect.top + rect.height / 2;
    return {
        x: baseX,
        y: baseY - UUID_EASTER_FX_VERTICAL_OFFSET
    };
}

function showNodeUUIDGiftFountain(clientX, clientY, fallbackEl) {
    const origin = getNodeUUIDFxOrigin(clientX, clientY, fallbackEl);
    const fx = document.createElement('div');
    fx.className = 'uuid-gift-fx';
    fx.textContent = UUID_EASTER_GIFT_ICONS[Math.floor(Math.random() * UUID_EASTER_GIFT_ICONS.length)];
    fx.style.left = (origin.x + (Math.random() * 20 - 10)) + 'px';
    fx.style.top = (origin.y + (Math.random() * 10 - 5)) + 'px';
    fx.style.setProperty('--gift-x-drift', `${(Math.random() * 90 - 45).toFixed(1)}px`);
    fx.style.setProperty('--gift-y-lift', `${(140 + Math.random() * 40).toFixed(1)}px`);
    fx.style.setProperty('--gift-rotate', `${(Math.random() * 70 - 35).toFixed(1)}deg`);
    fx.style.setProperty('--gift-duration', `${(640 + Math.random() * 240).toFixed(0)}ms`);
    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 1300);
}

function showNodeUUIDRocketFirework(clientX, clientY, fallbackEl) {
    const origin = getNodeUUIDFxOrigin(clientX, clientY, fallbackEl);
    const launchX = origin.x + (Math.random() * 26 - 13);
    const launchY = origin.y + 12;
    const rocket = document.createElement('div');
    rocket.className = 'uuid-rocket-fx';
    rocket.textContent = '🚀';
    rocket.style.left = `${launchX}px`;
    rocket.style.top = `${launchY}px`;
    rocket.style.setProperty('--rocket-x-drift', `${(Math.random() * 34 - 17).toFixed(1)}px`);
    document.body.appendChild(rocket);
    setTimeout(() => {
        const burstX = launchX + (Math.random() * 16 - 8);
        const burstY = launchY - (188 + Math.random() * 34);
        const flash = document.createElement('div');
        flash.className = 'uuid-firework-flash';
        flash.style.left = `${burstX}px`;
        flash.style.top = `${burstY}px`;
        const ring = document.createElement('div');
        ring.className = 'uuid-firework-ring';
        ring.style.left = `${burstX}px`;
        ring.style.top = `${burstY}px`;
        const burst = document.createElement('div');
        burst.className = 'uuid-firework-burst';
        burst.style.left = `${burstX}px`;
        burst.style.top = `${burstY}px`;
        for (let i = 0; i < UUID_EASTER_FIREWORK_PARTICLE_COUNT; i++) {
            const angle = (Math.PI * 2 * i / UUID_EASTER_FIREWORK_PARTICLE_COUNT) + (Math.random() * 0.14 - 0.07);
            const distance = 78 + Math.random() * 86;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            const particle = document.createElement('span');
            particle.className = 'uuid-firework-particle';
            particle.style.setProperty('--dx', `${dx.toFixed(1)}px`);
            particle.style.setProperty('--dy', `${dy.toFixed(1)}px`);
            particle.style.setProperty('--hue', `${Math.floor(Math.random() * 360)}`);
            particle.style.setProperty('--particle-duration', `${(780 + Math.random() * 420).toFixed(0)}ms`);
            burst.appendChild(particle);
        }
        document.body.appendChild(flash);
        document.body.appendChild(ring);
        document.body.appendChild(burst);
        rocket.remove();
        setTimeout(() => {
            flash.remove();
            ring.remove();
            burst.remove();
        }, 1400);
    }, 560);
    setTimeout(() => rocket.remove(), 1700);
}

function sha224(s) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const r = (n, b) => ((n >>> b) | (n << (32 - b))) >>> 0;
    s = unescape(encodeURIComponent(s));
    const l = s.length * 8;
    s += String.fromCharCode(0x80);
    while ((s.length * 8) % 512 !== 448) s += String.fromCharCode(0);
    const h = [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4];
    const hi = Math.floor(l / 0x100000000);
    const lo = l & 0xFFFFFFFF;
    s += String.fromCharCode((hi >>> 24) & 0xFF, (hi >>> 16) & 0xFF, (hi >>> 8) & 0xFF, hi & 0xFF, (lo >>> 24) & 0xFF, (lo >>> 16) & 0xFF, (lo >>> 8) & 0xFF, lo & 0xFF);
    const w = [];
    for (let i = 0; i < s.length; i += 4) {
        w.push((s.charCodeAt(i) << 24) | (s.charCodeAt(i + 1) << 16) | (s.charCodeAt(i + 2) << 8) | s.charCodeAt(i + 3));
    }
    for (let i = 0; i < w.length; i += 16) {
        const x = new Array(64).fill(0);
        for (let j = 0; j < 16; j++) x[j] = w[i + j];
        for (let j = 16; j < 64; j++) {
            const s0 = r(x[j - 15], 7) ^ r(x[j - 15], 18) ^ (x[j - 15] >>> 3);
            const s1 = r(x[j - 2], 17) ^ r(x[j - 2], 19) ^ (x[j - 2] >>> 10);
            x[j] = (x[j - 16] + s0 + x[j - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h0] = h;
        for (let j = 0; j < 64; j++) {
            const S1 = r(e, 6) ^ r(e, 11) ^ r(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (h0 + S1 + ch + K[j] + x[j]) >>> 0;
            const S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) >>> 0;
            h0 = g;
            g = f;
            f = e;
            e = (d + t1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) >>> 0;
        }
        for (let j = 0; j < 8; j++) {
            h[j] = (h[j] + (j === 0 ? a : j === 1 ? b : j === 2 ? c : j === 3 ? d : j === 4 ? e : j === 5 ? f : j === 6 ? g : h0)) >>> 0;
        }
    }
    let hex = '';
    for (let i = 0; i < 7; i++) {
        for (let j = 24; j >= 0; j -= 8) hex += ((h[i] >>> j) & 0xFF).toString(16).padStart(2, '0');
    }
    return hex;
}

function closeUUIDSnippetModal() {
    const modal = document.getElementById('uuidSnippetModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function getUUIDSnippetDisplayElements() {
    return {
        stage: document.getElementById('uuidSnippetStage'),
        textarea: document.getElementById('uuidSnippetTextarea'),
        preview: document.getElementById('uuidSnippetPreview'),
        copyBtn: document.getElementById('uuidSnippetCopyBtn'),
        copyBtnLabel: document.getElementById('uuidSnippetCopyBtnLabel')
    };
}

function clearUUIDSnippetDisplayTimers() {
    if (uuidSnippetDisplayProgressTimer) {
        clearInterval(uuidSnippetDisplayProgressTimer);
        uuidSnippetDisplayProgressTimer = null;
    }
    if (uuidSnippetDisplayPreviewTimer) {
        clearInterval(uuidSnippetDisplayPreviewTimer);
        uuidSnippetDisplayPreviewTimer = null;
    }
    if (uuidSnippetDisplayReleaseTimer) {
        clearTimeout(uuidSnippetDisplayReleaseTimer);
        uuidSnippetDisplayReleaseTimer = null;
    }
    if (uuidSnippetDisplayRevealFrame) {
        cancelAnimationFrame(uuidSnippetDisplayRevealFrame);
        uuidSnippetDisplayRevealFrame = null;
    }
}

function setUUIDSnippetStageState(state) {
    const {
        stage
    } = getUUIDSnippetDisplayElements();
    if (!stage) {
        return;
    }
    stage.classList.remove('is-processing', 'is-revealing', 'is-ready', 'is-error');
    if (state) {
        stage.classList.add(`is-${state}`);
    }
}

function setUUIDSnippetDisplayStatus(label, meta, badgeKey) {
    const {
        copyBtn,
        copyBtnLabel
    } = getUUIDSnippetDisplayElements();
    if (copyBtn) {
        copyBtn.dataset.phase = badgeKey || 'boot';
        copyBtn.title = meta ? `${label}：${meta}` : (label || '');
        copyBtn.setAttribute('aria-label', meta ? `${label}：${meta}` : (label || ''));
    }
    if (copyBtnLabel && copyBtn ? .disabled) {
        copyBtnLabel.textContent = badgeKey === 'fail' ? '源码重组失败' : '🔐 等待源码混淆重组';
    }
}

function setUUIDSnippetProgress(progress) {
    const {
        copyBtn
    } = getUUIDSnippetDisplayElements();
    uuidSnippetDisplayProgressValue = Math.max(0, Math.min(100, progress));
    if (copyBtn) {
        copyBtn.style.setProperty('--uuid-copy-progress', `${Math.max(uuidSnippetDisplayProgressValue, 2)}%`);
    }
}

function updateUUIDSnippetProcessingStage(targetProgress, badgeKey, label, meta) {
    uuidSnippetDisplayProgressTarget = Math.max(uuidSnippetDisplayProgressTarget, targetProgress);
    setUUIDSnippetDisplayStatus(label, meta, badgeKey);
}

function createUUIDSnippetRandom(seedText) {
    let seed = 2166136261;
    const text = String(seedText || 'vault');
    for (let i = 0; i < text.length; i++) {
        seed ^= text.charCodeAt(i);
        seed = Math.imul(seed, 16777619);
    }
    return function nextRandom() {
        seed += 0x6D2B79F5;
        let value = seed;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function buildUUIDSnippetLoadingFrame(uuidValue, frameIndex) {
    const verbs = ['sync', 'fold', 'mesh', 'seal', 'splice', 'phase', 'stream', 'prime'];
    const nouns = ['lattice', 'entropy', 'cipher', 'matrix', 'vault', 'signal', 'kernel', 'mirror'];
    const tags = ['SCAN', 'TRACE', 'PULSE', 'FOLD', 'LINK', 'HASH'];
    const compactUUID = (uuidValue || '').replace(/-/g, '').toUpperCase() || 'VOID0000';
    const random = createUUIDSnippetRandom(`${compactUUID}:${frameIndex}`);
    const pick = (pool) => pool[Math.floor(random() * pool.length) % pool.length];
    const sliceHex = (offset, size) => {
        const safeSize = Math.max(1, size);
        const start = offset % Math.max(compactUUID.length, safeSize);
        return (compactUUID.slice(start, start + safeSize) || compactUUID.slice(0, safeSize)).padEnd(safeSize, '0');
    };
    const lines = [`// Quantum vault handshake :: ${sliceHex(frameIndex, 4)}-${sliceHex(frameIndex + 4, 4)} :: frame ${String(frameIndex).padStart(2, '0')}`, `const shard_${sliceHex(frameIndex + 2, 6).toLowerCase()} = prism.${pick(verbs)}("${sliceHex(frameIndex + 8, 8)}");`];
    for (let i = 0; i < 10; i++) {
        const term = `${pick(verbs)}_${pick(nouns)}`;
        const signature = sliceHex(frameIndex + i * 3, 6);
        const ratio = Math.floor(random() * 87 + 12);
        const lane = String(Math.floor(random() * 24)).padStart(2, '0');
        if (i % 3 === 0) {
            lines.push(`[${pick(tags)}] stream.${term}("${signature}") -> lane:${lane} | flux:${ratio}%`);
        } else if (i % 3 === 1) {
            lines.push(`mesh.${term}(${Math.floor(random() * 512)}, seed_${signature.toLowerCase()}, "${sliceHex(frameIndex + i, 10)}");`);
        } else {
            lines.push(`await vault.${pick(verbs)}("${sliceHex(frameIndex + i * 2, 12)}", entropy:${ratio.toString().padStart(2, '0')});`);
        }
    }
    lines.push(`// Identity lock :: ${compactUUID.slice(0, 8)} :: bandwidth ${Math.floor(random() * 41 + 59)} THz`);
    return lines.join('\n');
}

function normalizeUUIDSnippetCodeForDisplay(sourceCode) {
    return String(sourceCode || '').replace(/	/g, '    ');
}

function extractUUIDSnippetPreviewSource(sourceCode) {
    const lines = normalizeUUIDSnippetCodeForDisplay(sourceCode).split(/\r?\n/).slice(0, 22);
    return lines.join('\n');
}

function getUUIDSnippetRevealChar(index, progress) {
    const randomValue = Math.abs(Math.sin((index + 1) * 12.9898 + progress * 78.233)) * 43758.5453;
    return UUID_SNIPPET_REVEAL_CHARSET[Math.floor(randomValue) % UUID_SNIPPET_REVEAL_CHARSET.length];
}

function buildUUIDSnippetRevealFrame(source, progress) {
    const safeSource = String(source || '');
    if (!safeSource) {
        return '';
    }
    const revealEdge = Math.floor(safeSource.length * progress);
    const scrambleZone = Math.max(12, Math.floor((1 - progress) * 96));
    let result = '';
    for (let i = 0; i < safeSource.length; i++) {
        const currentChar = safeSource[i];
        if (currentChar === '\n' || currentChar === '\r') {
            result += currentChar;
            continue;
        }
        if (currentChar === '	') {
            result += '    ';
            continue;
        }
        if (currentChar === ' ') {
            result += ' ';
            continue;
        }
        if (i < revealEdge - scrambleZone) {
            result += currentChar;
        } else if (i <= revealEdge + scrambleZone) {
            result += progress > 0.985 ? currentChar : getUUIDSnippetRevealChar(i, progress);
        } else {
            result += getUUIDSnippetRevealChar(i + 17, progress);
        }
    }
    return result;
}

function startUUIDSnippetPresentation(uuidValue) {
    const {
        textarea,
        preview
    } = getUUIDSnippetDisplayElements();
    clearUUIDSnippetDisplayTimers();
    uuidSnippetRawCode = '';
    uuidSnippetDisplayToken += 1;
    uuidSnippetDisplayProgressTarget = 18;
    setUUIDSnippetProgress(3);
    setUUIDSnippetStageState('processing');
    setUUIDSnippetDisplayStatus('已激活专属源码解码仓', `正在为 ${String(uuidValue || '').slice(0, 8) || '当前 UUID'} 建立加密通道`, 'boot');
    if (textarea) {
        textarea.value = '';
        textarea.scrollTop = 0;
    }
    if (preview) {
        preview.textContent = buildUUIDSnippetLoadingFrame(uuidValue, 0);
    }
    const currentToken = uuidSnippetDisplayToken;
    if (isLowPerformanceMode) {
        setUUIDSnippetProgress(45);
        if (preview) {
            preview.textContent = 'Low performance mode: generating dedicated Snippet.js...';
        }
        return currentToken;
    }
    let frameIndex = 1;
    uuidSnippetDisplayPreviewTimer = setInterval(() => {
        if (currentToken !== uuidSnippetDisplayToken) {
            return;
        }
        const {
            preview: livePreview
        } = getUUIDSnippetDisplayElements();
        if (livePreview) {
            livePreview.textContent = buildUUIDSnippetLoadingFrame(uuidValue, frameIndex);
        }
        frameIndex += 1;
    }, 120);
    uuidSnippetDisplayProgressTimer = setInterval(() => {
        if (currentToken !== uuidSnippetDisplayToken) {
            return;
        }
        const delta = uuidSnippetDisplayProgressTarget - uuidSnippetDisplayProgressValue;
        if (delta > 0.15) {
            setUUIDSnippetProgress(uuidSnippetDisplayProgressValue + Math.max(0.35, delta * 0.08));
        }
    }, 56);
    return currentToken;
}

function finishUUIDSnippetPresentation(finalScript, token) {
    if (token !== uuidSnippetDisplayToken) {
        return;
    }
    const {
        textarea,
        preview
    } = getUUIDSnippetDisplayElements();
    uuidSnippetRawCode = String(finalScript || '');
    const displayScript = normalizeUUIDSnippetCodeForDisplay(uuidSnippetRawCode);
    if (textarea) {
        textarea.value = displayScript;
        textarea.scrollTop = 0;
    }
    if (uuidSnippetDisplayProgressTimer) {
        clearInterval(uuidSnippetDisplayProgressTimer);
        uuidSnippetDisplayProgressTimer = null;
    }
    if (uuidSnippetDisplayPreviewTimer) {
        clearInterval(uuidSnippetDisplayPreviewTimer);
        uuidSnippetDisplayPreviewTimer = null;
    }
    setUUIDSnippetStageState('revealing');
    setUUIDSnippetDisplayStatus('源码晶格重组完成', '正在解除视觉掩码并写入真实 Snippet.js', 'reveal');
    const previewSource = extractUUIDSnippetPreviewSource(displayScript);
    if (isLowPerformanceMode) {
        if (preview) {
            preview.textContent = previewSource;
        }
        setUUIDSnippetProgress(100);
        setUUIDSnippetStageState('ready');
        setUUIDSnippetCopyButtonEnabled(true);
        return;
    }
    const revealStart = performance.now();
    const revealDuration = 1650;
    const animateReveal = (now) => {
        if (token !== uuidSnippetDisplayToken) {
            return;
        }
        const progress = Math.min(1, (now - revealStart) / revealDuration);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        if (preview) {
            preview.textContent = buildUUIDSnippetRevealFrame(previewSource, easedProgress);
        }
        setUUIDSnippetProgress(78 + easedProgress * 22);
        if (progress < 1) {
            uuidSnippetDisplayRevealFrame = requestAnimationFrame(animateReveal);
            return;
        }
        uuidSnippetDisplayRevealFrame = null;
        if (preview) {
            preview.textContent = previewSource;
        }
        setUUIDSnippetStageState('ready');
        setUUIDSnippetCopyButtonEnabled(true);
    };
    uuidSnippetDisplayRevealFrame = requestAnimationFrame(animateReveal);
}

function failUUIDSnippetPresentation(message, token) {
    if (token !== uuidSnippetDisplayToken) {
        return;
    }
    const {
        textarea,
        preview
    } = getUUIDSnippetDisplayElements();
    clearUUIDSnippetDisplayTimers();
    uuidSnippetRawCode = '';
    setUUIDSnippetStageState('processing');
    setUUIDSnippetDisplayStatus('源码生成失败', '远端内容未能完成解码，正在释放错误信息', 'fail');
    setUUIDSnippetProgress(100);
    if (preview) {
        preview.textContent = ['// Snippet.js decode aborted', `// ${message}`, '// 请稍后重试，或检查网络与 UUID 是否正常'].join('\n');
    }
    if (textarea) {
        textarea.value = `生成失败：${message}`;
        textarea.scrollTop = 0;
    }
    uuidSnippetDisplayReleaseTimer = setTimeout(() => {
        if (token !== uuidSnippetDisplayToken) {
            return;
        }
        setUUIDSnippetStageState('error');
    }, 720);
}

function setUUIDSnippetCopyButtonEnabled(enabled) {
    const {
        copyBtn,
        copyBtnLabel
    } = getUUIDSnippetDisplayElements();
    if (copyBtn) {
        copyBtn.disabled = !enabled;
        if (enabled) {
            copyBtn.dataset.phase = 'ready';
            copyBtn.style.setProperty('--uuid-copy-progress', '100%');
            copyBtn.title = '复制已生成的专属 Snippet.js';
            copyBtn.setAttribute('aria-label', '复制已生成的专属 Snippet.js');
        }
    }
    if (copyBtnLabel && enabled) {
        copyBtnLabel.textContent = '📋 点击复制代码';
    }
}

function openUUIDSnippetModal() {
    const modal = document.getElementById('uuidSnippetModal');
    const textarea = document.getElementById('uuidSnippetTextarea');
    if (!modal || !textarea) {
        return;
    }
    modal.classList.add('show');
    if (uuidSnippetLoading) {
        return;
    }
    textarea.value = '';
    setUUIDSnippetCopyButtonEnabled(false);
    generateUUIDSnippetCode();
}
async function copyUUIDSnippetCode() {
    const textarea = document.getElementById('uuidSnippetTextarea');
    const code = uuidSnippetRawCode || (textarea ? textarea.value : '');
    if (!code) {
        showToast('暂无可复制代码', 'error');
        return;
    }
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(code);
        } else {
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = code;
            tempTextarea.setAttribute('readonly', '');
            tempTextarea.style.position = 'fixed';
            tempTextarea.style.opacity = '0';
            tempTextarea.style.pointerEvents = 'none';
            tempTextarea.style.left = '-9999px';
            document.body.appendChild(tempTextarea);
            tempTextarea.focus();
            tempTextarea.select();
            tempTextarea.setSelectionRange(0, tempTextarea.value.length);
            const copied = document.execCommand('copy');
            tempTextarea.remove();
            if (!copied) throw new Error('copy failed');
        }
        showToast('📋 Snippet.js 代码已复制', 'success');
    } catch (error) {
        showToast('复制失败，请手动复制代码', 'error');
    }
}

function replaceSnippetCredentials(sourceCode, userID) {
    const password = sha224(userID);
    const linePattern = /(const\s+userID\s*=\s*["'])([^"']*)(["']\s*,\s*Password\s*=\s*["'])([^"']*)(["']\s*;)/;
    if (!linePattern.test(sourceCode)) {
        throw new Error('未找到EDT.min.js中的userID与Password配置');
    }
    return sourceCode.replace(linePattern, `$1${userID}$3${password}$5`);
}

function encodeSnippetCharAsUnicodeEscape(char) {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
}

function escapeSnippetLiteralForRegExp(literal) {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function randomizeSnippetLiteralCase(literal) {
    const letterIndexes = [];
    for (let i = 0; i < literal.length; i++) {
        if (/[a-z]/i.test(literal[i])) {
            letterIndexes.push(i);
        }
    }
    if (!letterIndexes.length) {
        return {
            value: literal,
            changedLetters: 0
        };
    }
    const forcedUpperIndex = letterIndexes[Math.floor(Math.random() * letterIndexes.length)];
    let changedLetters = 0;
    let value = '';
    for (let i = 0; i < literal.length; i++) {
        const currentChar = literal[i];
        if (!/[a-z]/i.test(currentChar)) {
            value += currentChar;
            continue;
        }
        const nextChar = (i === forcedUpperIndex || Math.random() < 0.5) ? currentChar.toUpperCase() : currentChar.toLowerCase();
        if (nextChar !== currentChar) {
            changedLetters += 1;
        }
        value += nextChar;
    }
    return {
        value,
        changedLetters
    };
}

function randomizeSnippetLiteralUnicodeEscapes(literal) {
    const forcedIndex = Math.floor(Math.random() * literal.length);
    let escapedChars = 0;
    let value = '';
    for (let i = 0; i < literal.length; i++) {
        const currentChar = literal[i];
        const shouldEscape = i === forcedIndex || Math.random() < 0.5;
        if (shouldEscape) {
            value += encodeSnippetCharAsUnicodeEscape(currentChar);
            escapedChars += 1;
        } else {
            value += currentChar;
        }
    }
    return {
        value,
        escapedChars
    };
}

function randomizeSnippetLiteralOccurrences(sourceCode, literal, options = {}) {
    const pattern = new RegExp(escapeSnippetLiteralForRegExp(literal), 'g');
    const matches = sourceCode.match(pattern);
    if (!matches || !matches.length) {
        return {
            code: sourceCode,
            occurrences: 0,
            escapedChars: 0,
            changedLetters: 0
        };
    }
    const lastSignature = uuidSnippetLastLiteralVariants.get(literal) || '';
    let variantSignature = '';
    let escapedChars = 0;
    let changedLetters = 0;
    let randomizedCode = sourceCode;
    for (let attempt = 0; attempt < 8; attempt++) {
        const signatureParts = [];
        escapedChars = 0;
        changedLetters = 0;
        randomizedCode = sourceCode.replace(pattern, () => {
            let variantValue = literal;
            if (options.randomizeCase) {
                const caseVariant = randomizeSnippetLiteralCase(variantValue);
                variantValue = caseVariant.value;
                changedLetters += caseVariant.changedLetters;
            }
            const unicodeVariant = randomizeSnippetLiteralUnicodeEscapes(variantValue);
            variantValue = unicodeVariant.value;
            escapedChars += unicodeVariant.escapedChars;
            signatureParts.push(variantValue);
            return variantValue;
        });
        variantSignature = signatureParts.join('||');
        if (variantSignature !== lastSignature) {
            break;
        }
    }
    uuidSnippetLastLiteralVariants.set(literal, variantSignature);
    return {
        code: randomizedCode,
        occurrences: matches.length,
        escapedChars,
        changedLetters
    };
}

function buildSnippetDictionaryMap(dictionaryData) {
    const allRaw = Array.isArray(dictionaryData ? .ALL) ? dictionaryData.ALL : [];
    const edtRaw = Array.isArray(dictionaryData ? .EDT) ? dictionaryData.EDT : [];
    const allChars = [...new Set(allRaw.filter(item => typeof item === 'string' && item.length > 0).map(item => item[0]))];
    const edtChars = [...new Set(edtRaw.filter(item => typeof item === 'string' && item.length > 0).map(item => item[0]))];
    if (!allChars.length || !edtChars.length) {
        throw new Error('字典内容无效');
    }
    if (allChars.length < edtChars.length) {
        throw new Error('字典ALL数量不足，无法完成不重复随机替换');
    }
    const randomizedAllChars = shuffleArray(allChars);
    const dictionaryMap = new Map();
    edtChars.forEach((char, index) => {
        dictionaryMap.set(char, randomizedAllChars[index]);
    });
    return dictionaryMap;
}

function applySnippetDictionary(sourceCode, dictionaryMap) {
    let result = '';
    for (const ch of sourceCode) {
        result += dictionaryMap.has(ch) ? dictionaryMap.get(ch) : ch;
    }
    return result;
}

function randomizeSnippetIndentationTabs(sourceCode) {
    let totalTabs = 0;
    let removedTabs = 0;
    let keptTabs = 0;
    let affectedLines = 0;
    const code = sourceCode.replace(/^	+/gm, leadingTabs => {
        affectedLines += 1;
        let randomizedIndentation = '';
        for (const tabChar of leadingTabs) {
            totalTabs += 1;
            if (Math.random() < 0.5) {
                removedTabs += 1;
            } else {
                keptTabs += 1;
                randomizedIndentation += tabChar;
            }
        }
        return randomizedIndentation;
    });
    return {
        code,
        totalTabs,
        removedTabs,
        keptTabs,
        affectedLines
    };
}
async function generateUUIDSnippetCode() {
    if (uuidSnippetLoading) {
        return;
    }
    const textarea = document.getElementById('uuidSnippetTextarea');
    const nodeUUIDInput = document.getElementById('nodeUUID');
    if (!textarea || !nodeUUIDInput) {
        return;
    }
    const uuidValue = (nodeUUIDInput.value || '').trim();
    if (!uuidValue) {
        uuidSnippetRawCode = '';
        textarea.value = '';
        setUUIDSnippetCopyButtonEnabled(false);
        clearUUIDSnippetDisplayTimers();
        setUUIDSnippetStageState('');
        setUUIDSnippetProgress(0);
        setUUIDSnippetDisplayStatus('等待源码重组完成', '请先填写 UUID 再生成专属源码', 'boot');
        showToast('UUID为空，无法生成专属代码', 'error');
        return;
    }
    const animationToken = startUUIDSnippetPresentation(uuidValue);
    try {
        uuidSnippetLoading = true;
        updateUUIDSnippetProcessingStage(28, 'sync', '正在拉取原始 Snippet 内核', '远端源码流与字典矩阵已接入');
        const [rawScriptText, rawDictionaryText] = await Promise.all([
            fetchWithAutoMirror(UUID_SNIPPETS_JS_URL, 'Snippets EDT.min.js'),
            fetchWithAutoMirror(UUID_SNIPPETS_DICT_URL, 'Snippets 字典')
        ]);
        updateUUIDSnippetProcessingStage(51, 'sync', '远端内容捕获完成', `源码 ${rawScriptText.length} 字符，字典 ${rawDictionaryText.length} 字符`);
        const replacedScript = replaceSnippetCredentials(rawScriptText, uuidValue);
        updateUUIDSnippetProcessingStage(69, 'bind', '专属 UUID 指纹已注入', `用户标识 ${uuidValue.slice(0, 8)} 已锁定到内核`);
        const dictionaryData = JSON.parse(rawDictionaryText);
        const dictionaryMap = buildSnippetDictionaryMap(dictionaryData);
        updateUUIDSnippetProcessingStage(86, 'mesh', '字符晶格正在重映射', `字典矩阵已生成 ${dictionaryMap.size} 组替换通道`);
        const dictionaryAppliedScript = applySnippetDictionary(replacedScript, dictionaryMap);
        const socketsVariantResult = randomizeSnippetLiteralOccurrences(dictionaryAppliedScript, 'cloudflare:sockets');
        const proxyipVariantResult = randomizeSnippetLiteralOccurrences(socketsVariantResult.code, 'proxyip.cmliussss.net', {
            randomizeCase: true
        });
        const finalScript = proxyipVariantResult.code;
        const variantSummaries = [];
        if (socketsVariantResult.occurrences > 0) {
            variantSummaries.push(`cloudflare:sockets ${socketsVariantResult.occurrences} 处 / ${socketsVariantResult.escapedChars} 个 Unicode 转义`);
        }
        if (proxyipVariantResult.occurrences > 0) {
            variantSummaries.push(`proxyip.cmliussss.net ${proxyipVariantResult.occurrences} 处 / ${proxyipVariantResult.changedLetters} 个大小写扰动 / ${proxyipVariantResult.escapedChars} 个 Unicode 转义`);
        }
        if (variantSummaries.length > 0) {
            updateUUIDSnippetProcessingStage(94, 'mesh', '目标标识已完成随机扰动', variantSummaries.join(' ; '));
        } else {
            updateUUIDSnippetProcessingStage(94, 'mesh', '未发现目标标识', '跳过字符串扰动步骤，直接进入最终揭晓');
        }
        const indentationRandomizedResult = randomizeSnippetIndentationTabs(finalScript);
        if (indentationRandomizedResult.totalTabs > 0) {
            updateUUIDSnippetProcessingStage(97, 'mesh', '源码缩进已完成随机排版', `影响 ${indentationRandomizedResult.affectedLines} 行 / 保留 ${indentationRandomizedResult.keptTabs} 个 tab / 删除 ${indentationRandomizedResult.removedTabs} 个 tab`);
        } else {
            updateUUIDSnippetProcessingStage(97, 'mesh', '未发现可扰动缩进', '源码中没有行首 tab，跳过随机排版步骤');
        }
        finishUUIDSnippetPresentation(indentationRandomizedResult.code, animationToken);
        showToast('Snippets.js专属代码已生成', 'success');
    } catch (error) {
        setUUIDSnippetCopyButtonEnabled(false);
        failUUIDSnippetPresentation(error.message || String(error), animationToken);
        showToast('生成失败: ' + (error.message || error), 'error');
    } finally {
        uuidSnippetLoading = false;
    }
}
async function copyNodeUUIDValue(nodeUUIDInput) {
    const uuidValue = (nodeUUIDInput.value || '').trim();
    if (!uuidValue) {
        showToast('UUID为空，无法复制', 'error');
        return;
    }
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(uuidValue);
            showToast('📋 已复制UUID的值', 'success');
            return;
        }
        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = uuidValue;
        tempTextarea.setAttribute('readonly', '');
        tempTextarea.style.position = 'fixed';
        tempTextarea.style.opacity = '0';
        tempTextarea.style.pointerEvents = 'none';
        tempTextarea.style.left = '-9999px';
        document.body.appendChild(tempTextarea);
        tempTextarea.focus();
        tempTextarea.select();
        tempTextarea.setSelectionRange(0, tempTextarea.value.length);
        const copied = document.execCommand('copy');
        tempTextarea.remove();
        if (copied) {
            showToast('📋 已复制UUID的值', 'success');
        } else {
            showToast('复制失败，请手动复制UUID', 'error');
        }
    } catch (error) {
        showToast('复制失败，请手动复制UUID', 'error');
    }
}

function initNodeUUIDEasterEgg() {
    const nodeUUIDInput = document.getElementById('nodeUUID');
    if (!nodeUUIDInput) {
        return;
    }
    nodeUUIDInput.addEventListener('click', () => {
        copyNodeUUIDValue(nodeUUIDInput);
    });
}
// 日志类型翻译
function translateLogType(type, ua = '') {
    // 如果是 Get_SUB 类型，检查 UA 是否包含 subconverter
    if (type === 'Get_SUB') {
        const uaLowercase = (ua || '').toLowerCase();
        if (uaLowercase.includes('subconverter')) {
            return {
                text: '订阅转换',
                color: '#3b82f6'
            };
        }
        return {
            text: '获取订阅',
            color: '#10b981'
        };
    }
    const typeMap = {
        'Admin_Login': {
            text: '登录后台',
            color: '#f59e0b'
        },
        'Save_Config': {
            text: '保存配置',
            color: '#8b5cf6'
        },
        'Init_Config': {
            text: '重置配置',
            color: '#ef4444'
        },
        'Save_Custom_IPs': {
            text: '自定义优选',
            color: '#06b6d4'
        }
    };
    return typeMap[type] || {
        text: type,
        color: '#6b7280'
    };
}
// 格式化时间戳为 UTC+8
function formatTime(timestamp) {
    const date = new Date(timestamp + 8 * 3600 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
// 在展开日志模块时加载日志
let logsLoaded = false;

function loadLogsOnExpand(titleEl) {
    const module = titleEl.parentElement;
    const isCollapsed = module.classList.contains('collapsed');
    // 如果是展开状态且还未加载过日志，则加载
    if (!isCollapsed && !logsLoaded) {
        loadLogs();
    }
}
// 加载最近8条日志
async function loadLogs() {
    try {
        const response = await fetch('/admin/log.json?_t=' + Date.now(), {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        if (!response.ok) throw new Error('加载日志失败');
        const logs = await response.json();
        logsLoaded = true;
        // 按时间从新到旧排序，取前6条
        const recentLogs = logs.sort((a, b) => b.TIME - a.TIME).slice(0, 6);
        const container = document.getElementById('logsContainer');
        if (recentLogs.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280;">暂无日志记录</div>';
            return;
        }
        // 检查是否为移动设备
        const isMobile = window.innerWidth <= 768;
        let html = '<table style="width: 100%; border-collapse: collapse;">';
        if (isMobile) {
            // 移动设备：显示时间、IP、操作
            html += '<thead><tr style="border-bottom: 2px solid #e5e7eb;"><th style="text-align: left; padding: 10px; font-weight: 600;">时间 (UTC+8)</th><th style="text-align: left; padding: 10px; font-weight: 600;">IP</th><th style="text-align: left; padding: 10px; font-weight: 600;">操作</th></tr></thead>';
        } else {
            // 桌面设备：显示时间、IP、地区、操作
            html += '<thead><tr style="border-bottom: 2px solid #e5e7eb;"><th style="text-align: left; padding: 10px; font-weight: 600;">时间 (UTC+8)</th><th style="text-align: left; padding: 10px; font-weight: 600;">IP</th><th style="text-align: left; padding: 10px; font-weight: 600;">地区</th><th style="text-align: left; padding: 10px; font-weight: 600;">操作</th></tr></thead>';
        }
        html += '<tbody>';
        recentLogs.forEach(log => {
            const logType = translateLogType(log.TYPE, log.UA);
            const cc = log.CC || '未知';
            const timeStr = formatTime(log.TIME);
            const ip = log.IP || '未知';
            if (isMobile) {
                // 移动设备：不显示地区
                html += `<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px; font-size: 12px;">${timeStr}</td><td style="padding: 10px; font-family: monospace; font-size: 12px;">${ip}</td><td style="padding: 10px;"><span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; color: #fff; background-color: ${logType.color};">${logType.text}</span></td></tr>`;
            } else {
                // 桌面设备：显示地区
                html += `<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px;">${timeStr}</td><td style="padding: 10px; font-family: monospace; font-size: 12px;">${ip}</td><td style="padding: 10px;">${cc}</td><td style="padding: 10px;"><span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; color: #fff; background-color: ${logType.color};">${logType.text}</span></td></tr>`;
            }
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        const container = document.getElementById('logsContainer');
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444;">加载日志失败: ${error.message}</div>`;
    }
}
// 显示全部日志
async function showAllLogs() {
    try {
        const response = await fetch('/admin/log.json?_t=' + Date.now(), {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        if (!response.ok) throw new Error('加载日志失败');
        const logs = await response.json();
        // 按时间从新到旧排序
        const sortedLogs = logs.sort((a, b) => b.TIME - a.TIME);
        const container = document.getElementById('allLogsContainer');
        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 12px; table-layout: auto;">';
        html += '<thead><tr style="border-bottom: 2px solid #e5e7eb; background: #f9fafb; white-space: nowrap;"><th style="text-align: left; padding: 10px; font-weight: 600; width: 160px;">时间 (UTC+8)</th><th style="text-align: left; padding: 10px; font-weight: 600; width: 120px;">IP</th><th style="text-align: left; padding: 10px; font-weight: 600; width: 80px;">地区</th><th style="text-align: left; padding: 10px; font-weight: 600; width: 80px;">ASN</th><th style="text-align: left; padding: 10px; font-weight: 600; width: 150px;">操作</th><th style="text-align: left; padding: 10px; font-weight: 600; flex: 1; min-width: 300px;">URL</th><th style="text-align: left; padding: 10px; font-weight: 600; flex: 1; min-width: 200px;">UA</th></tr></thead>';
        html += '<tbody>';
        sortedLogs.forEach(log => {
            const logType = translateLogType(log.TYPE, log.UA);
            const cc = log.CC || '未知';
            const asn = log.ASN || '未知';
            const timeStr = formatTime(log.TIME);
            const ip = log.IP || '未知';
            const url = log.URL || '无';
            const ua = log.UA ? log.UA.substring(0, 60) : '无';
            html += `<tr style="border-bottom: 1px solid #f3f4f6;"><td style="text-align: left; padding: 8px; white-space: nowrap; width: 160px; font-size: 11px;">${timeStr}</td><td style="text-align: left; padding: 8px; font-family: monospace; font-size: 10px; white-space: nowrap; width: 120px; word-break: break-word;">${ip}</td><td style="text-align: left; padding: 8px; white-space: nowrap; width: 80px; font-size: 11px;">${cc}</td><td style="text-align: left; padding: 8px; white-space: nowrap; width: 80px; font-size: 11px; font-family: monospace;">${asn}</td><td style="text-align: left; padding: 8px; width: 150px;"><span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; color: #fff; background-color: ${logType.color}; white-space: nowrap;">${logType.text}</span></td><td style="text-align: left; padding: 8px; font-size: 11px; word-break: break-word; min-width: 300px;">${url}</td><td style="text-align: left; padding: 8px; font-size: 10px; color: #6b7280; min-width: 200px; word-break: break-word;">${ua}</td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
        document.getElementById('logsModal').classList.add('show');
    } catch (error) {
        showToast('加载日志失败: ' + error.message, 'error');
    }
}
// 关闭日志模态框
function closeLogsModal(event) {
    if (event && event.target.id !== 'logsModal') return;
    document.getElementById('logsModal').classList.remove('show');
}