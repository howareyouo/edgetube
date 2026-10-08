// ==================== 获取更多 PROXYIP 相关函数 ====================
function showGetMoreProxyIPModal() {
    showExploreProxyModal('proxyip');
    // 重置已选
    selectedProxyIPs = [];
    updateSelectedProxyIPsUI();
}

function closeGetMoreProxyIPModal(event) {
    closeExploreProxyModal('proxyip', event);
}

function onProxyIPDataRegionChange() {
    onProxyRegionChange('proxyip');
}
async function verifySingleProxyIP(proxy, signal) {
    const config = proxyConfigs['proxyip'];
    const proxyIp = proxy.proxy; // format: ip
    if (signal && signal.aborted) return;
    // 设置15秒超时
    const timeoutId = setTimeout(() => {
        window[config.verificationStatus][proxyIp] = {
            status: 'timeout',
            responseTime: null
        };
        updateProxyDisplay('proxyip');
    }, 10000);
    window[config.verificationTimeouts][proxyIp] = timeoutId;
    try {
        const response = await fetch(`https://api.090227.xyz/check?proxyip=${proxyIp}`, {
            signal
        });
        clearTimeout(window[config.verificationTimeouts][proxyIp]);
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                window[config.verificationStatus][proxyIp] = {
                    status: 'success',
                    responseTime: data.responseTime,
                    supports_ipv4: data.supports_ipv4 === true,
                    supports_ipv6: data.supports_ipv6 === true
                };
            } else {
                window[config.verificationStatus][proxyIp] = {
                    status: 'failed',
                    responseTime: null
                };
            }
        } else {
            window[config.verificationStatus][proxyIp] = {
                status: 'failed',
                responseTime: null
            };
        }
    } catch (error) {
        if (signal && signal.aborted) return;
        window[config.verificationStatus][proxyIp] = {
            status: 'failed',
            responseTime: null
        };
    }
    updateProxyDisplay('proxyip');
}

function addSelectedProxyIP() {
    const select = document.getElementById('proxyIPProxySelect');
    const ip = select.value;
    if (!ip) return;
    if (selectedProxyIPs.length >= 8) {
        showToast('最多只能选择 8 个 ProxyIP', 'warning');
        return;
    }
    if (selectedProxyIPs.includes(ip)) {
        showToast('该 IP 已在选择列表中', 'warning');
        return;
    }
    selectedProxyIPs.push(ip);
    updateSelectedProxyIPsUI();
    updateProxyIPConfirmButton();
}

function removeSelectedProxyIP(ip) {
    selectedProxyIPs = selectedProxyIPs.filter(item => item !== ip);
    updateSelectedProxyIPsUI();
    updateProxyIPConfirmButton();
}

function updateSelectedProxyIPsUI() {
    const container = document.getElementById('selectedProxyIPsContainer');
    container.innerHTML = '';
    selectedProxyIPs.forEach(ip => {
        // 查找对应的国家 emoji
        const dataList = window.proxyIPListData || [];
        const proxyData = dataList.find(p => p.ip === ip);
        const emoji = proxyData ? .country_emoji || '🌐';
        // 构建 title 信息
        let titleText = '';
        if (proxyData) {
            const city = proxyData.city || '未知';
            const country = proxyData.country || '未知';
            const countryName = proxyData.country_cn || '未知';
            const clientIp = proxyData.clientIp || ip;
            const asn = proxyData.asn || '未知';
            const asOrganization = proxyData.asOrganization || '未知';
            titleText = `${city}\n国家: [${country}]${countryName}\n落地IP: ${clientIp}\nASN: ${asn}\n运营商: ${asOrganization}`;
        }
        const tag = document.createElement('div');
        tag.style.cssText = 'background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c; padding: 4px 10px; border-radius: 9999px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500;';
        if (titleText) {
            tag.title = titleText;
        }
        tag.innerHTML = `
			<span>${emoji} ${ip}</span>
			<span onclick="removeSelectedProxyIP('${ip}')" style="cursor: pointer; font-weight: bold; font-size: 16px;">×</span>
		`;
        container.appendChild(tag);
    });
}

function updateProxyIPConfirmButton() {
    const btn = document.getElementById('proxyIPConfirmBtn');
    btn.disabled = selectedProxyIPs.length === 0;
}

function confirmSelectProxyIP() {
    const input = document.getElementById('proxyIP');
    if (input) {
        input.value = selectedProxyIPs.join(',');
        input.dispatchEvent(new Event('change', {
            bubbles: true
        }));
        markModified('proxy');
    }
    closeGetMoreProxyIPModal();
    // 如果勾选了自动获取，取消勾选
    const autoProxyCheck = document.getElementById('autoProxy');
    if (autoProxyCheck && autoProxyCheck.checked) {
        autoProxyCheck.checked = false;
        if (typeof toggleAutoProxy === 'function') toggleAutoProxy();
    }
    const config = proxyConfigs['proxyip'];
    if (config.abortController) {
        config.abortController.abort();
        config.abortController = null;
    }
    // 亮起保存和取消按钮
    const saveBtn = document.getElementById('saveProxyBtn');
    const cancelBtn = document.getElementById('cancelProxyBtn');
    if (saveBtn) saveBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
}
// ==================== SOCKS5 相关函数 ====================
// 代理类型配置
const proxyConfigs = {
    socks5: {
        modalId: 'exploreSocks5Modal',
        regionSelectId: 'socks5RegionSelect',
        proxySelectId: 'socks5ProxySelect',
        proxySelectGroupId: 'socks5ProxySelectGroup',
        confirmBtnId: 'socks5ConfirmBtn',
        listData: 'socks5ListData',
        countryMap: 'socks5CountryMap',
        verificationStatus: 'socks5VerificationStatus',
        verificationTimeouts: 'socks5VerificationTimeouts',
        url: 'https://raw.githubusercontent.com/EDT-Pages/Proxy-List/main/data/socks5.json',
        description: 'SOCKS5列表',
        inputId: 'socks5Addr',
        abortController: null,
        verifySingleFunction: (proxy, signal) => verifySingleProxy(proxy, 'socks5', signal)
    },
    http: {
        modalId: 'exploreHTTPModal',
        regionSelectId: 'httpRegionSelect',
        proxySelectId: 'httpProxySelect',
        proxySelectGroupId: 'httpProxySelectGroup',
        confirmBtnId: 'httpConfirmBtn',
        listData: 'httpListData',
        countryMap: 'httpCountryMap',
        verificationStatus: 'httpVerificationStatus',
        verificationTimeouts: 'httpVerificationTimeouts',
        url: 'https://raw.githubusercontent.com/EDT-Pages/Proxy-List/main/data/http.json',
        description: 'HTTP列表',
        inputId: 'httpAddr',
        abortController: null,
        verifySingleFunction: (proxy, signal) => verifySingleProxy(proxy, 'http', signal)
    },
    https: {
        modalId: 'exploreHTTPSModal',
        regionSelectId: 'httpsRegionSelect',
        proxySelectId: 'httpsProxySelect',
        proxySelectGroupId: 'httpsProxySelectGroup',
        confirmBtnId: 'httpsConfirmBtn',
        listData: 'httpsListData',
        countryMap: 'httpsCountryMap',
        verificationStatus: 'httpsVerificationStatus',
        verificationTimeouts: 'httpsVerificationTimeouts',
        url: 'https://raw.githubusercontent.com/EDT-Pages/Proxy-List/main/data/https.json',
        description: 'HTTPS列表',
        inputId: 'httpsAddr',
        abortController: null,
        verifySingleFunction: (proxy, signal) => verifySingleProxy(proxy, 'https', signal)
    },
    proxyip: {
        modalId: 'getMoreProxyIPModal',
        regionSelectId: 'proxyIPDataRegionSelect',
        proxySelectId: 'proxyIPProxySelect',
        proxySelectGroupId: 'proxyIPProxySelectGroup',
        confirmBtnId: 'proxyIPConfirmBtn',
        listData: 'proxyIPListData',
        countryMap: 'proxyIPCountryMap',
        verificationStatus: 'proxyIPVerificationStatus',
        verificationTimeouts: 'proxyIPVerificationTimeouts',
        url: 'https://zip.cm.edu.kg.cmliussss.net/all.json',
        description: 'ProxyIP列表',
        inputId: 'proxyIP',
        abortController: null,
        verifySingleFunction: (proxy, signal) => verifySingleProxyIP(proxy, signal)
    }
};
// 存储SOCKS5数据
let socks5ListData = [];
let socks5CountryMap = {};
let socks5VerificationStatus = {}; // 存储验证状态
let socks5VerificationTimeouts = {}; // 存储超时计时器
// 存储 ProxyIP 数据
let proxyIPListData = [];
let proxyIPCountryMap = {};
let proxyIPVerificationStatus = {};
let proxyIPVerificationTimeouts = {};
let selectedProxyIPs = []; // 存储用户选择的 ProxyIP
function showExploreSocks5Modal() {
    showExploreProxyModal('socks5');
}

function closeExploreSocks5Modal(event) {
    closeExploreProxyModal('socks5', event);
}

function loadSocks5List() {
    loadProxyList('socks5');
}

function buildCountryMap(listData, countryMap) {
    countryMap = {};
    // 统计每个国家的代理数量
    listData.forEach(item => {
        const country = item.country;
        if (!countryMap[country]) {
            countryMap[country] = [];
        }
        countryMap[country].push(item);
    });
    // 按数量排序（多到少）
    countryMap = Object.fromEntries(Object.entries(countryMap).sort((a, b) => b[1].length - a[1].length));
    return countryMap;
}

function populateSocks5RegionSelect() {
    populateProxyRegionSelect('socks5');
}

function onSocks5RegionChange() {
    onProxyRegionChange('socks5');
}

function populateSocks5ProxySelect(selectedCountry) {
    populateProxySelect(selectedCountry, 'socks5ProxySelect', socks5CountryMap, socks5VerificationStatus, 'socks5');
}

function verifySocks5Proxies(proxies) {
    verifyProxies(proxies, verifySingleSocks5);
}

function verifySingleSocks5(proxy, signal) {
    return verifySingleProxy(proxy, 'socks5', signal);
}

function updateSocks5Display() {
    updateProxyDisplay('socks5');
}

function confirmSelectSocks5() {
    confirmSelectProxy('socks5');
}

function updateSocks5ConfirmButton() {
    updateProxyConfirmButton('socks5');
}
// 通用代理选择器填充函数
function populateProxySelect(selectedCountry, selectId, countryMap, verificationStatus, type) {
    const select = document.getElementById(selectId);
    const proxies = countryMap[selectedCountry] || [];
    // 保存当前选中的值
    const currentValue = select.value;
    // 检查是否所有代理都验证完成
    const allVerified = proxies.every(p => {
        const status = verificationStatus[p.proxy];
        return status && status.status !== 'pending';
    });
    // 获取当前地区的所有代理，并按状态和延迟排序
    const sortedProxies = [...proxies].sort((a, b) => {
        const statusA = verificationStatus[a.proxy] || {
            status: 'pending'
        };
        const statusB = verificationStatus[b.proxy] || {
            status: 'pending'
        };
        // 可用的在前面，且按延迟从低到高
        if (statusA.status === 'success' && statusB.status === 'success') {
            return (statusA.responseTime || 0) - (statusB.responseTime || 0);
        }
        if (statusA.status === 'success') return -1;
        if (statusB.status === 'success') return 1;
        return 0;
    });
    // 检查是否有成功的代理
    const successfulProxies = sortedProxies.filter(proxy => verificationStatus[proxy.proxy] ? .status === 'success');
    // 辅助函数：生成代理选项HTML
    function generateProxyOption(proxy, isSelectable = false) {
        const status = verificationStatus[proxy.proxy] || {
            status: 'pending'
        };
        let emoji = '⏳';
        let statusText = '验证中';
        if (status.status === 'success') {
            if (type === 'proxyip') {
                const supportsV4 = status.supports_ipv4 === true;
                const supportsV6 = status.supports_ipv6 === true;
                if (supportsV4 && supportsV6) {
                    emoji = '✅✅';
                } else if (supportsV4 && !supportsV6) {
                    emoji = '✅🔴';
                } else if (!supportsV4 && supportsV6) {
                    emoji = '🔴✅';
                } else {
                    emoji = '🔴🔴';
                }
            } else {
                emoji = '✅';
            }
            statusText = `${status.responseTime}ms`;
        } else if (status.status === 'timeout') {
            emoji = '🔴';
            statusText = '已超时';
        } else if (status.status === 'failed') {
            emoji = '🔴';
            statusText = '不可用';
        }
        // ProxyIP 模式下 label 稍微不同，不包含协议前缀
        const label = type === 'proxyip' ? `${emoji}[${statusText}]${proxy.ip}${proxy.city ? ` - ${proxy.city}` : ''},AS${proxy.asn}` : `${emoji}[${statusText}]${proxy.city},AS${proxy.asn},${proxy.asOrganization}`;
        const disabled = !isSelectable || status.status !== 'success';
        // ProxyIP 不需要默认选中，因为是多选触发
        const selected = type !== 'proxyip' && isSelectable && status.status === 'success' && successfulProxies.indexOf(proxy) === 0 ? 'selected' : '';
        return `<option value="${proxy.proxy}" ${disabled ? 'disabled' : ''} ${selected}>${label}</option>`;
    }
    let html = type === 'proxyip' ? '<option value="">-- 请选择代理 --</option>' : '';
    if (successfulProxies.length > 0) {
        // 有成功的代理，显示所有代理
        sortedProxies.forEach(proxy => {
            html += generateProxyOption(proxy, true);
        });
    } else if (allVerified) {
        // 验证完成但没有成功的代理
        html = '<option value="">很抱歉，当前地区无可用代理，请切换其他地区。</option>';
    } else {
        // 验证中，显示代理列表
        html = (type === 'proxyip' ? '<option value="">正在验证可用性，请稍候...</option>' : '<option value="">正在验证可用性，请稍候...</option>');
        sortedProxies.forEach(proxy => {
            html += generateProxyOption(proxy, false);
        });
    }
    select.innerHTML = html;
    // 恢复用户的选择 (ProxyIP 模式下如果当前选中的仍然有效，也恢复)
    if (successfulProxies.length > 0) {
        if (currentValue && successfulProxies.some(p => p.proxy === currentValue)) {
            select.value = currentValue;
        } else if (type !== 'proxyip') {
            select.value = successfulProxies[0].proxy;
        }
    }
}
// 通用代理验证函数
// Fisher-Yates 打乱算法 - 随机打乱数组顺序
function shuffleArray(array) {
    const shuffled = [...array]; // 创建副本，不修改原数组
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // 交换元素
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function verifyProxies(proxies, verifySingleFunction, onProgress, signal) {
    // 打乱代理列表的顺序，避免多个用户同时测试时都从头开始
    const shuffledProxies = shuffleArray(proxies);
    // 并发控制：最多8个并发请求
    const maxConcurrent = 8;
    let currentIndex = 0;
    let activeRequests = 0;

    function startNextProxy() {
        if (signal && signal.aborted) return;
        if (currentIndex >= shuffledProxies.length || activeRequests >= maxConcurrent) {
            return;
        }
        activeRequests++;
        const proxy = shuffledProxies[currentIndex++];
        verifySingleFunction(proxy, signal).finally(() => {
            activeRequests--;
            if (onProgress) onProgress();
            startNextProxy();
        });
    }
    // 启动初始8个请求
    for (let i = 0; i < Math.min(maxConcurrent, shuffledProxies.length); i++) {
        startNextProxy();
    }
}
// 通用代理探索函数
function showExploreProxyModal(type) {
    const config = proxyConfigs[type];
    const modal = document.getElementById(config.modalId);
    if (!modal) return;
    // 重置状态
    window[config.listData] = [];
    window[config.countryMap] = {};
    window[config.verificationStatus] = {};
    window[config.verificationTimeouts] = {};
    lastMappedProxy[type] = null;
    modal.classList.add('show');
    document.getElementById(config.regionSelectId).innerHTML = '<option value="">加载中...</option>';
    document.getElementById(config.proxySelectGroupId).style.display = 'block';
    document.getElementById(config.confirmBtnId).disabled = true;
    // 初始化下拉框 focus/blur 监听（首次生效）
    ensureProxySelectListeners(type);
    // 重置节流状态
    resetProxyDisplayUpdateState(type);
    // 加载列表
    loadProxyList(type);
    // 初始化或更新地图容器
    setTimeout(() => {
        initProxyMap(type);
    }, 300);
}
const lastMappedProxy = {
    socks5: null,
    http: null,
    https: null,
    proxyip: null
};
const proxyMaps = {
    socks5: {
        map: null,
        marker: null
    },
    http: {
        map: null,
        marker: null
    },
    https: {
        map: null,
        marker: null
    },
    proxyip: {
        map: null,
        marker: null
    }
};

function initProxyMap(type) {
    const containerId = type === 'socks5' ? 'proxy-map-socks5' : (type === 'http' ? 'proxy-map-http' : (type === 'https' ? 'proxy-map-https' : 'proxy-map-proxyip'));
    const container = document.getElementById(containerId);
    if (!container) return;
    // 如果地图已存在，先刷新布局
    if (proxyMaps[type] && proxyMaps[type].map) {
        proxyMaps[type].map.invalidateSize();
        return;
    }
    if (!proxyMaps[type]) proxyMaps[type] = {
        map: null,
        marker: null
    };
    // 创建地图
    const map = L.map(containerId, {
        zoomControl: false, // 隐藏缩放控制，让界面更清爽
        attributionControl: false
    }).setView([22.2783, 114.1747], 4);
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: '1234',
        minZoom: 1,
        maxZoom: 18
    }).addTo(map);
    proxyMaps[type].map = map;
}

function updateProxyMap(type) {
    const config = proxyConfigs[type];
    const select = document.getElementById(config.proxySelectId);
    const selectedProxyUrl = select.value;
    if (!selectedProxyUrl || !proxyMaps[type].map) return;
    // 如果该代理已经显示在地图上了，就不再重复加载，避免频繁刷新导致的气泡闪烁
    if (lastMappedProxy[type] === selectedProxyUrl) return;
    lastMappedProxy[type] = selectedProxyUrl;
    // 从数据列表中找到完整的代理信息
    const proxyData = window[config.listData].find(p => p.proxy === selectedProxyUrl);
    if (!proxyData || proxyData.latitude === null || proxyData.longitude === null) return;
    const lat = parseFloat(proxyData.latitude);
    const lng = parseFloat(proxyData.longitude);
    const map = proxyMaps[type].map;
    // 更新或创建 Marker
    if (proxyMaps[type].marker) {
        proxyMaps[type].marker.setLatLng([lat, lng]);
    } else {
        proxyMaps[type].marker = L.marker([lat, lng]).addTo(map);
    }
    // 平滑移动地图 - 将标记点定位到地图的下方60%位置，避免气泡被遮挡
    map.setZoom(4);
    // 计算偏移后的中心点，使标记显示在视图的60%处（下方）
    const mapSize = map.getSize();
    const offsetY = mapSize.y * 0.2; // 向上偏移20%，使标记显示在60%处
    const point = map.project([lat, lng], 4).subtract([0, offsetY]);
    const offsetCenter = map.unproject(point, 4);
    if (isLowPerformanceMode) {
        map.setView(offsetCenter, 4, {
            animate: false
        });
    } else {
        map.flyTo(offsetCenter, 4, {
            duration: 1.5
        });
    }
    // 添加或更新 Popup
    const isDark = document.documentElement.classList.contains('dark-mode');
    const textColor = isDark ? '#ffffff' : '#333333';
    const popupContent = `
		<div class="ip-detail-popup-city">
			${proxyData.city || proxyData.country || '位置'}
		</div>
		<div class="ip-detail-popup-item">
			<span class="ip-detail-popup-label">国家:</span>
			<span class="ip-detail-popup-value">[${proxyData.country || '-'}]${proxyData.country_cn || ''}</span>
		</div>
		<div class="ip-detail-popup-item">
			<span class="ip-detail-popup-label">落地IP:</span>
			<span class="ip-detail-popup-value">${proxyData.clientIp || proxyData.ip || '-'}</span>
		</div>
		<div class="ip-detail-popup-item">
			<span class="ip-detail-popup-label">ASN:</span>
			<span class="ip-detail-popup-value">${proxyData.asn || ''}</span>
		</div>
		<div class="ip-detail-popup-item">
			<span class="ip-detail-popup-label">运营商:</span>
			<span class="ip-detail-popup-value">${proxyData.asOrganization || '未知'}</span>
		</div>
	`;
    proxyMaps[type].marker.bindPopup(popupContent, {
        offset: L.point(0, -32)
    }).openPopup();
}

function closeExploreProxyModal(type, event) {
    if (event && event.preventDefault) event.preventDefault();
    const config = proxyConfigs[type];
    const modal = document.getElementById(config.modalId);
    if (modal) {
        modal.classList.remove('show');
    }
    // 停止正在进行的测试
    if (config.abortController) {
        config.abortController.abort();
        config.abortController = null;
    }
    // 清除所有超时计时器
    for (let timeout of Object.values(window[config.verificationTimeouts])) {
        clearTimeout(timeout);
    }
    // 清理节流定时器
    resetProxyDisplayUpdateState(type);
}

function loadProxyList(type) {
    const config = proxyConfigs[type];
    const url = config.url;
    fetchWithAutoMirror(url, config.description).then(text => {
        let data = JSON.parse(text);
        if (type === 'proxyip') {
            // all.json format has a 'data' array
            data = data.data.filter(item => Array.isArray(item.port) ? item.port.includes(443) : item.port === 443).map(item => ({
                proxy: item.ip,
                ip: item.ip,
                country: item.meta ? .country || 'Unknown',
                country_cn: item.meta ? .country_cn || '未知',
                country_en: item.meta ? .country_en || 'Unknown',
                country_emoji: item.meta ? .country_emoji || '🏳️',
                city: item.meta ? .city || '未知',
                clientIp: item.meta ? .clientIp || item.ip,
                asn: item.meta ? .asn || 0,
                asOrganization: item.meta ? .asOrganization || '未知',
                continent: item.meta ? .continent || 'Unknown',
                latitude: item.meta ? .latitude !== undefined ? item.meta.latitude : (item.meta ? .colo ? .lat !== undefined ? item.meta.colo.lat : null),
                longitude: item.meta ? .longitude !== undefined ? item.meta.longitude : (item.meta ? .colo ? .lon !== undefined ? item.meta.colo.lon : null)
            }));
        }
        window[config.listData] = data;
        window[config.countryMap] = buildCountryMap(window[config.listData], window[config.countryMap]);
        populateProxyRegionSelect(type);
    }).catch(error => {
        console.error(`${config.description}加载失败:`, error);
        document.getElementById(config.regionSelectId).innerHTML = '<option value="">加载失败</option>';
    });
}
// 大洲信息映射
const continentInfo = {
    'AS': {
        emoji: '🌏',
        name: '亚洲'
    },
    'NA': {
        emoji: '🌎',
        name: '北美'
    },
    'EU': {
        emoji: '🌍',
        name: '欧洲'
    },
    'AF': {
        emoji: '🌍',
        name: '非洲'
    },
    'SA': {
        emoji: '🌎',
        name: '南美'
    },
    'OC': {
        emoji: '🌏',
        name: '大洋洲'
    },
    'AN': {
        emoji: '❄️',
        name: '南极洲'
    }
};

function populateProxyRegionSelect(type) {
    const config = proxyConfigs[type];
    const select = document.getElementById(config.regionSelectId);
    let html = '<option value="">-- 请选择地区 --</option>';
    // 构建按大洲分组的结构
    const continentMap = {};
    // 遍历所有国家，归类到大洲
    for (const [country, proxies] of Object.entries(window[config.countryMap])) {
        const proxy = proxies[0]; // 取第一个代理获取大洲信息
        const continent = proxy.continent || 'Unknown';
        const continentData = continentInfo[continent] || {
            emoji: '🌍',
            name: continent
        };
        if (!continentMap[continent]) {
            continentMap[continent] = {
                emoji: continentData.emoji,
                name: continentData.name,
                countries: {}
            };
        }
        continentMap[continent].countries[country] = {
            count: proxies.length,
            name: proxy.country_cn || country,
            emoji: proxy.country_emoji || ''
        };
    }
    // 生成 HTML
    for (const [continentCode, continentData] of Object.entries(continentMap)) {
        const label = `${continentData.emoji} ${continentData.name} / ${continentCode}`;
        html += `<optgroup label="${label}">`;
        for (const [country, countryData] of Object.entries(continentData.countries)) {
            html += `<option value="${country}">${countryData.emoji} ${countryData.name}(${countryData.count})</option>`;
        }
        html += `</optgroup>`;
    }
    select.innerHTML = html;
}

function onProxyRegionChange(type) {
    const config = proxyConfigs[type];
    const selectedCountry = document.getElementById(config.regionSelectId).value;
    if (!selectedCountry) {
        document.getElementById(config.confirmBtnId).disabled = true;
        return;
    }
    const proxies = window[config.countryMap][selectedCountry] || [];
    // 显示代理选择组
    document.getElementById(config.proxySelectGroupId).style.display = 'block';
    // 初始化每个代理的验证状态
    proxies.forEach(proxy => {
        if (!window[config.verificationStatus][proxy.proxy]) {
            window[config.verificationStatus][proxy.proxy] = {
                status: 'pending', // pending, success, failed, timeout
                responseTime: null
            };
        }
    });
    // 设置select为验证中状态
    const select = document.getElementById(config.proxySelectId);
    select.innerHTML = '<option value="">正在验证可用性，请稍候...</option>';
    // 显示代理列表
    populateProxySelect(selectedCountry, config.proxySelectId, window[config.countryMap], window[config.verificationStatus]);
    // 释放之前的 AbortController 并创建新的
    if (config.abortController) {
        config.abortController.abort();
    }
    config.abortController = new AbortController();
    // 开始验证所有代理
    verifyProxies(proxies, config.verifySingleFunction, () => {
        updateProxyDisplay(type);
        // 如果当前选中的是成功的，尝试更新地图
        updateProxyMap(type);
    }, config.abortController.signal);
}
// ===== 节流更新系统：避免移动端下拉框被频繁刷新 =====
const PROXY_DISPLAY_UPDATE_INTERVAL = 6000; // 节流间隔：6秒
const proxyDisplayUpdateState = {
    socks5: {
        lastUpdate: 0,
        pending: false,
        timer: null,
        selectOpen: false,
        listenersAdded: false
    },
    http: {
        lastUpdate: 0,
        pending: false,
        timer: null,
        selectOpen: false,
        listenersAdded: false
    },
    https: {
        lastUpdate: 0,
        pending: false,
        timer: null,
        selectOpen: false,
        listenersAdded: false
    },
    proxyip: {
        lastUpdate: 0,
        pending: false,
        timer: null,
        selectOpen: false,
        listenersAdded: false
    }
};
// 为代理选择下拉框添加 focus/blur 监听，检测用户是否正在操作下拉框
function ensureProxySelectListeners(type) {
    const state = proxyDisplayUpdateState[type];
    if (state.listenersAdded) return;
    const config = proxyConfigs[type];
    const select = document.getElementById(config.proxySelectId);
    if (!select) return;
    select.addEventListener('focus', () => {
        state.selectOpen = true;
    });
    select.addEventListener('blur', () => {
        state.selectOpen = false;
        // 下拉框关闭时，如果有待处理的更新立即执行
        if (state.pending) {
            _doUpdateProxyDisplay(type);
        }
    });
    state.listenersAdded = true;
}
// 检查当前地区所有代理是否全部验证完成
function isAllProxiesVerified(type) {
    const config = proxyConfigs[type];
    const selectedCountry = document.getElementById(config.regionSelectId).value;
    if (!selectedCountry) return false;
    const proxies = window[config.countryMap][selectedCountry] || [];
    return proxies.length > 0 && proxies.every(p => {
        const s = window[config.verificationStatus][p.proxy];
        return s && s.status !== 'pending';
    });
}
// 节流版 updateProxyDisplay —— 外部统一调用此函数
// 策略：下拉框关闭时实时更新；下拉框打开时每 6 秒节流更新一次
function updateProxyDisplay(type) {
    const state = proxyDisplayUpdateState[type];
    const now = Date.now();
    // 下拉框未打开：直接实时更新
    if (!state.selectOpen) {
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        _doUpdateProxyDisplay(type);
        return;
    }
    // === 以下为下拉框打开状态的节流逻辑 ===
    // 全部验证完成时强制安排一次更新（最终结果）
    if (isAllProxiesVerified(type)) {
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        // 距上次更新已超过节流间隔，直接更新
        if (now - state.lastUpdate >= PROXY_DISPLAY_UPDATE_INTERVAL) {
            _doUpdateProxyDisplay(type);
        } else {
            // 未到间隔，安排一个定时器确保最终结果会被刷新
            state.pending = true;
            if (!state.timer) {
                const delay = PROXY_DISPLAY_UPDATE_INTERVAL - (now - state.lastUpdate);
                state.timer = setTimeout(() => {
                    state.timer = null;
                    if (state.pending) {
                        _doUpdateProxyDisplay(type);
                    }
                }, delay);
            }
        }
        return;
    }
    // 节流：距上次更新不到 6 秒，延迟执行
    if (now - state.lastUpdate < PROXY_DISPLAY_UPDATE_INTERVAL) {
        state.pending = true;
        if (!state.timer) {
            const delay = PROXY_DISPLAY_UPDATE_INTERVAL - (now - state.lastUpdate);
            state.timer = setTimeout(() => {
                state.timer = null;
                if (state.pending) {
                    _doUpdateProxyDisplay(type);
                }
            }, delay);
        }
        return;
    }
    // 已超过节流间隔，直接更新
    _doUpdateProxyDisplay(type);
}
// 实际执行更新的内部函数
function _doUpdateProxyDisplay(type) {
    const state = proxyDisplayUpdateState[type];
    state.lastUpdate = Date.now();
    state.pending = false;
    const config = proxyConfigs[type];
    const selectedCountry = document.getElementById(config.regionSelectId).value;
    if (selectedCountry) {
        populateProxySelect(selectedCountry, config.proxySelectId, window[config.countryMap], window[config.verificationStatus], type);
        // 更新确定按钮状态
        const select = document.getElementById(config.proxySelectId);
        const selectedValue = select.value;
        const isValidSelected = selectedValue && window[config.verificationStatus][selectedValue] && window[config.verificationStatus][selectedValue].status === 'success';
        document.getElementById(config.confirmBtnId).disabled = !isValidSelected;
    }
}
// 重置节流状态（模态框关闭时调用）
function resetProxyDisplayUpdateState(type) {
    const state = proxyDisplayUpdateState[type];
    if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
    }
    state.lastUpdate = 0;
    state.pending = false;
    state.selectOpen = false;
}

function confirmSelectProxy(type) {
    const config = proxyConfigs[type];
    const select = document.getElementById(config.proxySelectId);
    const selectedProxy = select.value;
    if (!selectedProxy) {
        showToast(`请选择一个有效的${type.toUpperCase()}代理`, 'error');
        return;
    }
    // 填入代理地址
    const input = document.getElementById(config.inputId);
    if (input) {
        input.value = selectedProxy.replace(/^socks5:\/\/|^http:\/\/|^https:\/\/|^turn:\/\/|^sstp:\/\//, '');
        setProxyModeSelection(type);
        updateProxyMode(false, false);
        input.dispatchEvent(new Event('change', {
            bubbles: true
        }));
        markModified('proxy');
    }
    // 关闭模态框
    const modal = document.getElementById(config.modalId);
    if (modal) {
        modal.classList.remove('show');
    }
    // 确认选择后停止剩余测试
    if (config.abortController) {
        config.abortController.abort();
        config.abortController = null;
    }
    // 亮起保存和取消按钮
    const saveBtn = document.getElementById('saveProxyBtn');
    const cancelBtn = document.getElementById('cancelProxyBtn');
    if (saveBtn) saveBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
}

function updateProxyConfirmButton(type) {
    const config = proxyConfigs[type];
    const select = document.getElementById(config.proxySelectId);
    const selectedValue = select.value;
    const confirmBtn = document.getElementById(config.confirmBtnId);
    // 检查选中的代理是否可用
    const isValidSelected = selectedValue && window[config.verificationStatus][selectedValue] && window[config.verificationStatus][selectedValue].status === 'success';
    if (confirmBtn) {
        confirmBtn.disabled = !isValidSelected;
    }
}
// 通用单个代理验证函数
function verifySingleProxy(proxy, type, signal) {
    return new Promise((resolve) => {
        const config = proxyConfigs[type];
        const protocol = proxy.protocol || type;
        const proxyUrl = proxy.proxy;
        if (!proxyUrl) {
            resolve();
            return;
        }
        let cleanProxy = String(proxyUrl);
        for (const prefix of ['socks5://', 'http://', 'https://', 'turn://', 'sstp://', 'socks5=', 'http=', 'https=', 'turn=', 'sstp=']) {
            if (cleanProxy.toLowerCase().startsWith(prefix)) {
                cleanProxy = cleanProxy.substring(prefix.length).trim();
                break;
            }
        }
        const checkProtocol = ['https', 'turn', 'sstp'].includes(type) ? type : protocol;
        const checkUrl = `/admin/check?${checkProtocol}=${encodeURIComponent(cleanProxy)}&_t=${Date.now()}`;
        // 如果已经终止，直接返回
        if (signal && signal.aborted) {
            return resolve();
        }
        // 设置15秒超时
        const timeoutId = setTimeout(() => {
            window[config.verificationStatus][proxyUrl] = {
                status: 'timeout',
                responseTime: null
            };
            updateProxyDisplay(type);
            resolve();
        }, 15000);
        window[config.verificationTimeouts][proxyUrl] = timeoutId;
        fetch(checkUrl, {
            signal
        }).then(response => response.json()).then(data => {
            clearTimeout(timeoutId);
            delete window[config.verificationTimeouts][proxyUrl];
            if (data.success) {
                window[config.verificationStatus][proxyUrl] = {
                    status: 'success',
                    responseTime: data.responseTime
                };
            } else {
                window[config.verificationStatus][proxyUrl] = {
                    status: 'failed',
                    responseTime: null
                };
            }
            updateProxyDisplay(type);
            resolve();
        }).catch(error => {
            clearTimeout(timeoutId);
            delete window[config.verificationTimeouts][proxyUrl];
            window[config.verificationStatus][proxyUrl] = {
                status: 'failed',
                responseTime: null
            };
            updateProxyDisplay(type);
            resolve();
        });
    });
}
// ==================== HTTP 相关函数 ====================
// 存储HTTP数据
let httpListData = [];
let httpCountryMap = {};
let httpVerificationStatus = {}; // 存储验证状态
let httpVerificationTimeouts = {}; // 存储超时计时器
// 存储HTTPS数据
let httpsListData = [];
let httpsCountryMap = {};
let httpsVerificationStatus = {}; // 存储验证状态
let httpsVerificationTimeouts = {}; // 存储超时计时器
function showExploreHTTPModal() {
    showExploreProxyModal('http');
}

function closeExploreHTTPModal(event) {
    closeExploreProxyModal('http', event);
}

function loadHTTPList() {
    loadProxyList('http');
}

function populateHTTPRegionSelect() {
    populateProxyRegionSelect('http');
}

function onHTTPRegionChange() {
    onProxyRegionChange('http');
}

function populateHTTPProxySelect(selectedCountry) {
    populateProxySelect(selectedCountry, 'httpProxySelect', httpCountryMap, httpVerificationStatus, 'http');
}

function verifyHTTPProxies(proxies) {
    verifyProxies(proxies, verifySingleHTTP);
}

function verifySingleHTTP(proxy, signal) {
    return verifySingleProxy(proxy, 'http', signal);
}

function updateHTTPDisplay() {
    updateProxyDisplay('http');
}

function confirmSelectHTTP() {
    confirmSelectProxy('http');
}

function updateHTTPConfirmButton() {
    updateProxyConfirmButton('http');
}

function showExploreHTTPSModal() {
    showExploreProxyModal('https');
}

function closeExploreHTTPSModal(event) {
    closeExploreProxyModal('https', event);
}

function loadHTTPSList() {
    loadProxyList('https');
}

function populateHTTPSRegionSelect() {
    populateProxyRegionSelect('https');
}

function onHTTPSRegionChange() {
    onProxyRegionChange('https');
}

function populateHTTPSProxySelect(selectedCountry) {
    populateProxySelect(selectedCountry, 'httpsProxySelect', httpsCountryMap, httpsVerificationStatus, 'https');
}

function verifyHTTPSProxies(proxies) {
    verifyProxies(proxies, verifySingleHTTPS);
}

function verifySingleHTTPS(proxy, signal) {
    return verifySingleProxy(proxy, 'https', signal);
}

function updateHTTPSDisplay() {
    updateProxyDisplay('https');
}

function confirmSelectHTTPS() {
    confirmSelectProxy('https');
}

function updateHTTPSConfirmButton() {
    updateProxyConfirmButton('https');
}
// ============ HOSTS 检查相关函数 ============
// 检查当前访问域名是否在 HOSTS 数组中
function checkHostsMismatch() {
    const currentHostname = window.location.hostname;
    const hosts = currentConfig.HOSTS || [];
    // 检查当前 hostname 是否存在于 HOSTS 数组中
    const isHostInArray = hosts.some(host => {
        // 移除端口号后进行比较
        const hostWithoutPort = host.split(':')[0];
        return hostWithoutPort === currentHostname;
    });
    if (!isHostInArray && hosts.length > 0) {
        // 检查缓存，是否在 24 小时内已提示过
        if (shouldShowHostsMismatchNotification()) {
            showHostsMismatchNotification(currentHostname, hosts);
        }
    }
}
// 检查是否应该显示 HOSTS 不匹配提示
function shouldShowHostsMismatchNotification() {
    const cacheKey = 'hostsMismatchNotificationTime';
    const cachedTime = localStorage.getItem(cacheKey);
    if (!cachedTime) {
        // 没有缓存，应该显示
        return true;
    }
    const lastNotificationTime = parseInt(cachedTime, 10);
    const currentTime = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 小时毫秒数
    // 检查是否超过 24 小时
    return (currentTime - lastNotificationTime) > twentyFourHours;
}
// 显示 HOSTS 不匹配提示
function showHostsMismatchNotification(currentHostname, hosts) {
    // 填充模态框中的内容
    const currentHostnameEl = document.getElementById('currentHostname');
    const hostToAddEl = document.getElementById('hostToAdd');
    const currentHostsEl = document.getElementById('currentHosts');
    if (currentHostnameEl) {
        currentHostnameEl.textContent = currentHostname;
    }
    if (hostToAddEl) {
        hostToAddEl.textContent = currentHostname;
    }
    // 填充当前 HOSTS 列表 - 用 HTML badge 而不是纯文本
    if (currentHostsEl) {
        // 清空并用 HTML 结构重新填充
        currentHostsEl.innerHTML = '';
        hosts.forEach((host) => {
            const badge = document.createElement('span');
            badge.className = 'hosts-badge';
            badge.textContent = host;
            currentHostsEl.appendChild(badge);
        });
    }
    // 显示模态框
    const overlay = document.getElementById('hostsMismatchModal');
    if (overlay) {
        const modal = overlay.querySelector('.modal');
        overlay.classList.add('show');
        console.log('✓ 域名不匹配提示已显示');
    } else {
        console.error('✗ 无法找到 hostsMismatchModal 元素');
    }
}
// 关闭 HOSTS 不匹配提示模态框
function closeHostsMismatchModal(event) {
    // 如果有事件对象且点击的不是 overlay 本身，则返回
    if (event && event.target && event.target.id !== 'hostsMismatchModal') {
        return;
    }
    const overlay = document.getElementById('hostsMismatchModal');
    if (overlay) {
        overlay.classList.remove('show');
    }
}
// 处理"知道了！24小时内不提示"按钮
function dismissHostsMismatchNotification() {
    const cacheKey = 'hostsMismatchNotificationTime';
    const currentTime = Date.now();
    // 将当前时间戳保存到 localStorage
    localStorage.setItem(cacheKey, currentTime.toString());
    // 关闭模态框
    closeHostsMismatchModal({
        target: {
            id: 'hostsMismatchModal'
        }
    });
    // 显示确认提示
    showToast('🎉 24小时内不会再提示', 'info');
}