let currentConfig = {};
let originalConfig = {};
let modifiedSections = new Set();
let subConfigData = null;
let hasMultipleHosts = false; // 标记是否存在多个 HOSTS
let isLowPerformanceMode = false;
let pendingSSTLSPreviousValue = null;
const LOW_PERF_STORAGE_KEY = 'adminLowPerformanceMode';
let performanceRecheckScheduled = false;
const WORKER_VERSION_SOURCE_URL = 'https://raw.githubusercontent.com/cmliu/edgetunnel/main/_worker.js';
const PAGES_ZIP_DOWNLOAD_URL = 'https://github.com/cmliu/edgetunnel/archive/refs/heads/main.zip';
const CHANGELOG_RAW_URL = 'https://raw.githubusercontent.com/cmliu/edgetunnel/refs/heads/main/CHANGELOG';
const HTTPS_PROXY_MIN_VERSION = 20260413174651;
const TURN_SSTP_PROXY_MIN_VERSION = 20260504172138;
const CHAIN_PROXY_MIN_VERSION = 20260506175102;
const SKIP_VERIFY_WARNING_BYPASS_MIN_VERSION = 20260601154939;
const ALPN_FEATURE_MIN_VERSION = 20260904162413;
const ECH_SUPPORTED_FINGERPRINTS = ['chrome', 'firefox'];
let cachedWorkerVersionRawText = '';
let cachedLatestOnlineVersion = 0;
let cachedCurrentVersionNumber = 0;
let cachedCurrentVersionFullText = '';
let cachedChangelogRawText = '';
let cachedChangelogLoadedAt = 0;
let pendingChangelogLoadPromise = null;
let httpsProxyFeatureEnabled = false;
let turnSstpProxyFeatureEnabled = false;
let chainProxyFeatureEnabled = false;
let alpnFeatureEnabled = false;
let proxyFeatureAvailabilityInitialized = false;
const PROXY_PROTOCOLS = ['socks5', 'http', 'https', 'turn', 'sstp'];

function parseForcedLowPerformanceMode() {
    try {
        const params = new URLSearchParams(window.location.search);
        const lite = params.get('lite');
        if (lite === '1' || lite === 'true') {
            localStorage.setItem(LOW_PERF_STORAGE_KEY, '1');
            return true;
        }
        if (lite === '0' || lite === 'false') {
            localStorage.setItem(LOW_PERF_STORAGE_KEY, '0');
            return false;
        }
    } catch (_) {
        // ignore URL parse errors
    }
    const saved = localStorage.getItem(LOW_PERF_STORAGE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
    return null;
}

function enableLowPerformanceMode(reason) {
    if (isLowPerformanceMode) return;
    isLowPerformanceMode = true;
    document.documentElement.classList.add('low-performance-mode');
    console.info(`[perf] Low performance mode enabled: ${reason}`);
}

function measureAverageFrameTime(sampleCount = 18, timeoutMs = 1500) {
    return new Promise((resolve) => {
        if (!window.requestAnimationFrame) {
            resolve(16.7);
            return;
        }
        let lastTime = 0;
        let frameCount = 0;
        let totalDelta = 0;
        let rafId = 0;
        let finished = false;
        const finish = (value) => {
            if (finished) return;
            finished = true;
            if (rafId) cancelAnimationFrame(rafId);
            clearTimeout(timeoutId);
            resolve(value);
        };
        const step = (now) => {
            if (lastTime > 0) {
                totalDelta += now - lastTime;
            }
            lastTime = now;
            frameCount += 1;
            if (frameCount >= sampleCount) {
                const denominator = Math.max(1, frameCount - 1);
                finish(totalDelta / denominator);
                return;
            }
            rafId = requestAnimationFrame(step);
        };
        const timeoutId = setTimeout(() => finish(16.7), timeoutMs);
        rafId = requestAnimationFrame(step);
    });
}

function detectSoftwareRenderer() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            return {
                isSoftware: true,
                reason: 'webgl-unavailable'
            };
        }
        let renderer = '';
        let vendor = '';
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
            vendor = String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '');
        } else {
            renderer = String(gl.getParameter(gl.RENDERER) || '');
            vendor = String(gl.getParameter(gl.VENDOR) || '');
        }
        const renderInfo = `${renderer} ${vendor}`.toLowerCase();
        const softwareTokens = ['swiftshader', 'software', 'llvmpipe', 'softpipe', 'microsoft basic render', 'mesa offscreen', 'gdi generic', 'rasterizer'];
        const isSoftware = softwareTokens.some(token => renderInfo.includes(token));
        return {
            isSoftware,
            reason: isSoftware ? `software-renderer:${renderer || vendor || 'unknown'}` : 'hardware-renderer'
        };
    } catch (_) {
        return {
            isSoftware: false,
            reason: 'renderer-detect-error'
        };
    }
}

function schedulePerformanceRecheck() {
    if (performanceRecheckScheduled || isLowPerformanceMode) return;
    performanceRecheckScheduled = true;
    const runRecheck = async () => {
        if (isLowPerformanceMode) return;
        const avgFrameTime = await measureAverageFrameTime(30, 2600);
        if (avgFrameTime > 20) {
            enableLowPerformanceMode(`post-load-frame-time=${avgFrameTime.toFixed(1)}ms`);
        }
    };
    const launch = () => {
        setTimeout(() => {
            runRecheck().catch(err => console.warn('Performance recheck failed:', err));
        }, 900);
    };
    if (document.readyState === 'complete') {
        launch();
    } else {
        window.addEventListener('load', launch, {
            once: true
        });
    }
}
async function initializePerformanceMode() {
    const forcedMode = parseForcedLowPerformanceMode();
    if (forcedMode !== null) {
        if (forcedMode) {
            enableLowPerformanceMode('manual');
        }
        return;
    }
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cpuCores = Number(navigator.hardwareConcurrency || 0);
    const memoryGB = Number(navigator.deviceMemory || 0);
    const rendererProbe = detectSoftwareRenderer();
    if (prefersReducedMotion || (cpuCores > 0 && cpuCores <= 4) || (memoryGB > 0 && memoryGB <= 4)) {
        enableLowPerformanceMode('device-hints');
        return;
    }
    if (rendererProbe.isSoftware) {
        enableLowPerformanceMode(rendererProbe.reason);
        return;
    }
    const avgFrameTime = await measureAverageFrameTime(22, 1800);
    if (avgFrameTime > 22) {
        enableLowPerformanceMode(`startup-frame-time=${avgFrameTime.toFixed(1)}ms`);
    }
    schedulePerformanceRecheck();
}
// 延迟测试配置
const latencyTestConfig = {
    count: 16 // 采样和显示数量
};
// 追踪延迟显示的动画状态
const latencyUIState = {};
// 标记延迟测试是否已经开始，防止重复执行
let latencyTestStarted = false;
let latencyTestActive = false;
let latencyTestSessionId = 0;
let latencySiteLatencies = {};
let latencySiteIntervals = {};
let latencySiteUpdateInProgress = {};
const latencyFetchControllers = new Set();
const latencyFetchTimeoutMs = 8000;
// 延迟测试数据
const latencySites = [{
    name: '字节抖音',
    region: '国内',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#1677FF" d="m19.9 1.5 4.1 1v19l-4.1 1zM6.5 10.9l4.1 1v9l-4 1.1zM0 2.6l4.1 1v16.8l-4.1 1zm17.5 5.6v11.1l-4.2-1v-9z"></path></svg>',
    url: 'https://lf3-zlink-tos.ugurl.cn/obj/zebra-public/resource_lmmizj_1632398893.png'
}, {
    name: 'Bilibili',
    region: '国内',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FB7299" d="M17.813 4.653h.854q2.266.08 3.773 1.574Q23.946 7.72 24 9.987v7.36q-.054 2.266-1.56 3.773c-1.506 1.507-2.262 1.524-3.773 1.56H5.333q-2.266-.054-3.773-1.56C.053 19.614.036 18.858 0 17.347v-7.36q.054-2.267 1.56-3.76t3.773-1.574h.774l-1.174-1.12a1.23 1.23 0 0 1-.373-.906q0-.534.373-.907l.027-.027q.4-.373.92-.373t.92.373L9.653 4.44q.107.106.187.213h4.267a.8.8 0 0 1 .16-.213l2.853-2.747q.4-.373.92-.373c.347 0 .662.151.929.4s.391.551.391.907q0 .532-.373.906zM5.333 7.24q-1.12.027-1.88.773q-.76.748-.786 1.894v7.52q.026 1.146.786 1.893t1.88.773h13.334q1.12-.026 1.88-.773t.786-1.893v-7.52q-.026-1.147-.786-1.894t-1.88-.773zM8 11.107q.56 0 .933.373q.375.374.4.96v1.173q-.025.586-.4.96q-.373.375-.933.374c-.56-.001-.684-.125-.933-.374q-.375-.373-.4-.96V12.44q0-.56.386-.947q.387-.386.947-.386m8 0q.56 0 .933.373q.375.374.4.96v1.173q-.025.586-.4.96q-.373.375-.933.374c-.56-.001-.684-.125-.933-.374q-.375-.373-.4-.96V12.44q.025-.586.4-.96q.373-.373.933-.373"></path></svg>',
    url: 'https://i0.hdslb.com/bfs/face/member/noface.jpg@24w_24h_1c'
}, {
    name: '腾讯微信',
    region: '国内',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#09B83E" d="M8.7 2.19C3.9 2.19 0 5.48 0 9.53c0 2.21 1.17 4.2 3 5.55a.6.6 0 0 1 .21.66l-.39 1.48q-.03.11-.04.22c0 .16.13.3.29.3a.3.3 0 0 0 .16-.06l1.9-1.11a.9.9 0 0 1 .72-.1 10 10 0 0 0 2.84.4q.41-.01.81-.05a5.85 5.85 0 0 1 1.93-6.45 8.3 8.3 0 0 1 5.86-1.83c-.58-3.59-4.2-6.35-8.6-6.35m-2.9 3.8c.64 0 1.16.53 1.16 1.18a1.17 1.17 0 0 1-1.16 1.18 1.17 1.17 0 0 1-1.17-1.18c0-.65.52-1.18 1.17-1.18m5.8 0c.65 0 1.17.53 1.17 1.18a1.17 1.17 0 0 1-1.16 1.18 1.17 1.17 0 0 1-1.16-1.18c0-.65.52-1.18 1.16-1.18m5.34 2.87a8 8 0 0 0-5.28 1.78 5.5 5.5 0 0 0-1.78 6.22c.94 2.46 3.66 4.23 6.88 4.23q1.25 0 2.36-.33a.7.7 0 0 1 .6.08l1.59.93.14.04c.13 0 .24-.1.24-.24q-.01-.09-.04-.18l-.33-1.23-.02-.16a.5.5 0 0 1 .2-.4 5.8 5.8 0 0 0 2.5-4.62c0-3.21-2.93-5.84-6.66-6.09zm-2.53 3.27c.53 0 .97.44.97.98a1 1 0 0 1-.97.99 1 1 0 0 1-.97-.99c0-.54.43-.98.97-.98zm4.84 0c.54 0 .97.44.97.98a1 1 0 0 1-.97.99 1 1 0 0 1-.97-.99c0-.54.44-.98.97-.98"></path></svg>',
    url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico'
}, {
    name: '阿里淘宝',
    region: '国内',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#E16322" d="M21.31 9.9a3 3 0 1 1 0 1.92.96.96 0 0 1 0-1.92m2.39 3.05H13.3v-.96h4.14V9.76h-2.89v-.77h2.9v-.92h-2.52v.2H13.3v-2.9h1.64v.35l2.52-.3V4.6h1.85v.64c.93-.08 1.76-.13 2.21-.1 1.5.06 2.45.27 2.49 1.26.03 1-1.43 1.9-1.43 1.9l-.45-.43v.2h-2.8v.92h3.22v.77h-3.23v2.23h4.39zM21.53 7.3l-.02-.01s1.38-.76.35-1.27c-.87-.43-5.54.3-6.93.62v.66zM1.88 6.42a1 1 0 0 0 0-2 1 1 0 0 0-1 1 1 1 0 0 0 1 1m3.41-.86a7 7 0 0 0 .37-.72L4.2 4.42s-.6 1.93-1.65 2.83c0 0 1.02.6 1.01.58a10 10 0 0 0 .78-.88l.68-.3a9 9 0 0 1-1.14 1.69l.61.54s.42-.4.88-.9h.53v.9H3.86v.73H5.9v1.72h-.08c-.23-.01-.58-.05-.71-.27-.17-.26-.05-.75-.04-1.04h-1.4l-.06.02s-.52 2.32 1.5 2.27a5.3 5.3 0 0 0 3.46-.92l.2.76 1.17-.48-.79-1.92-.94.3.18.65a3 3 0 0 1-.82.42V9.6h2v-.72h-2v-.9h2v-.72H6.01c.26-.31.46-.6.51-.78l-.62-.17c2.67-.95 4.15-.79 4.13.77v4.12s.16 1.4-1.46 1.3l-.87-.18-.21.83s3.78 1.08 4.1-1.82-.09-4.76-.09-4.76-.34-2.68-6.2-1.02zm-5.23 6.6 1.58.98c1.1-2.38 1.03-2.06 1.3-2.92.29-.87.35-1.54-.13-2.02a10 10 0 0 0-1.6-1.36L.55 7.86l1.21.75s.82.42.43 1.2c-.36.73-2.13 2.34-2.13 2.34M20 19s-.02.53-.67.53c-.6 0-.64-.42-.64-.42q-.39.45-1.07.46c-.76 0-1.3-.51-1.3-1.3 0-.78.56-1.27 1.4-1.27.39 0 .73.15.93.4l.01-.2c0-.56-.3-.8-1-.8q-.51 0-1.02.13.16-.33.3-.45.18-.14.94-.14c1.27 0 1.74.42 1.74 1.42v1.2c0 .32.03.44.38.44m-1.33-.74c0-.48-.25-.75-.64-.75-.4 0-.66.28-.66.76 0 .47.27.76.65.76.39 0 .65-.27.65-.77m5.27-.5c0 1.15-.7 1.82-1.78 1.82-1.1 0-1.77-.67-1.77-1.82 0-1.16.68-1.83 1.77-1.83s1.78.67 1.78 1.83m-1.08 0q0-1.3-.7-1.3t-.69 1.3.7 1.3.69-1.3m-7.14-.05c0 1.17-.65 1.86-1.57 1.86q-.66-.01-1.05-.47s-.1.42-.66.42c-.69 0-.67-.52-.67-.52.4.02.38-.21.38-.43v-2.89c0-.36-.07-.48-.43-.49.02-.1.08-.53.68-.53.82 0 .76.91.76.91v.79q.34-.4 1-.4c.96 0 1.56.65 1.56 1.75m-1.09.08q-.01-1.35-.76-1.35c-.44 0-.74.4-.74 1.1v.36c0 .72.31 1.12.76 1.12q.73 0 .74-1.23m-3.24-.03c0 1.15-.7 1.82-1.78 1.82-1.1 0-1.78-.67-1.78-1.82 0-1.16.68-1.83 1.78-1.83s1.78.67 1.78 1.83m-1.09 0q0-1.3-.7-1.3-.69 0-.68 1.3t.69 1.3q.7 0 .7-1.3m-6-2.72q-.4.11-1.55.1-1.38-.02-1.85-.04c-.52 0-.73.13-.91.66q.45-.13 1.13-.11c.36 0 .42.04.42.3v2.9c0 .28.11.67.72.67.71 0 .84-.52.84-.52-.36 0-.43-.13-.43-.49v-2.56c0-.27.1-.28.47-.28h.26c.55 0 .7-.1.9-.63M7.46 19s-.02.52-.67.52c-.56 0-.64-.4-.64-.4q-.39.45-1.07.45c-.76 0-1.3-.52-1.3-1.3S4.33 17 5.17 17c.39 0 .73.14.93.4v-.2c0-.56-.3-.8-1-.8q-.5 0-1.01.13.15-.33.3-.46.17-.14.94-.14c1.26 0 1.74.43 1.74 1.43v1.2c0 .32.03.44.38.44m-1.33-.75c0-.48-.26-.74-.64-.74-.4 0-.67.28-.67.76 0 .46.28.76.66.76.39 0 .65-.28.65-.78"></path></svg>',
    url: 'https://img.alicdn.com/imgextra/i2/O1CN01qnQCrN1VkzAWiU4Hs_!!6000000002692-2-tps-33-33.png'
}, {
    name: 'GitHub',
    region: '国际',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#181717" d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.7 4.7 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3"></path></svg>',
    url: 'https://github.github.io/janky/images/bg_hr.png'
}, {
    name: 'Telegram.DC5',
    region: '国际',
    icon: '<svg width="24px" height="24px" viewBox="0 0 16 16" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient x1="50%" y1="0%" x2="50%" y2="100%" id="linearGradient-1"><stop stop-color="#38AEEB" offset="0%"></stop><stop stop-color="#279AD1" offset="100%"></stop></linearGradient></defs><g id="Artboard" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><circle id="Oval" fill="url(#linearGradient-1)" cx="8" cy="8" r="8"></circle><path d="M3.17026167,7.83635602 C5.78750201,6.74265999 7.53273882,6.02162863 8.40597211,5.67326193 C10.8992306,4.67860423 11.2454541,4.53439191 11.5831299,4.52864956 C11.6573986,4.52743168 11.8385417,4.55776042 11.9798438,4.67645833 C12.1211458,4.79515625 12.1635786,4.87206678 12.1755371,4.93908691 C12.1874957,5.00610705 12.1862759,5.21456762 12.1744385,5.3338623 C12.0393279,6.69547283 11.5259342,9.83829771 11.2285121,11.3633248 C11.1026617,12.008621 10.8548582,12.2249854 10.6149558,12.2461596 C10.0935924,12.2921758 9.69769267,11.9156852 9.19272668,11.5981993 C8.40255458,11.1013965 8.13911734,10.9180161 7.3721185,10.4332283 C6.48571864,9.87297217 6.85080034,9.6784879 7.35595703,9.17524981 C7.48815894,9.04355001 9.67825076,7.04590073 9.71077046,6.86250183 C9.7391276,6.70257812 9.7494847,6.68189389 9.67664063,6.60973958 C9.60379655,6.53758527 9.51674192,6.54658941 9.46083149,6.55876051 C9.38158015,6.57601267 8.17521836,7.33962686 5.84174612,8.84960308 C5.48344358,9.08558775 5.15890428,9.20056741 4.86812819,9.19454205 C4.54757089,9.18789957 3.93094724,9.02070014 3.47255094,8.87778221 C2.91030922,8.70248755 2.46345069,8.609808 2.50236203,8.31210343 C2.52262946,8.15704047 2.74526267,7.998458 3.17026167,7.83635602 Z" id="Path-3" fill="#FFFFFF"></path></g></svg>',
    url: 'https://flora.web.telegram.org/'
}, {
    name: 'X.com',
    region: '国际',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#1DA1F2" d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.594 1.85 2.323 3.196 4.368 3.233-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.072 1.328 4.532 2.104 7.172 2.104 8.607 0 13.3-7.132 13.3-13.3 0-.202-.005-.403-.014-.602.913-.66 1.706-1.477 2.332-2.41z"></path></svg>',
    url: 'https://abs.twimg.com/favicons/twitter.3.ico'
}, {
    name: 'YouTube',
    region: '国际',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FF0000" d="M23.5 6.19a3 3 0 0 0-2.12-2.14c-1.87-.5-9.38-.5-9.38-.5s-7.5 0-9.38.5A3 3 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3 3 0 0 0 2.12 2.14c1.87.5 9.38.5 9.38.5s7.5 0 9.38-.5a3 3 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81M9.55 15.57V8.43L15.82 12z"></path></svg>',
    url: 'https://www.youtube.com/favicon.ico'
}];
// 初始化主题
function initializeTheme() {
    const saved = localStorage.getItem('theme');
    let theme = saved;
    // 默认使用暗色主题，仅在用户手动切换过时尊重已保存偏好
    if (!saved) {
        theme = 'dark';
    }
    applyTheme(theme);
}
// 应用主题
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        document.getElementById('themeToggle').title = '切换日间模式';
    } else {
        document.documentElement.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        document.getElementById('themeToggle').title = '切换夜间模式';
    }
}
// 生成延迟卡片
function generateLatencyCards() {
    const container = document.getElementById('latency-cards');
    if (!container) return;
    container.innerHTML = '';
    // 按地区排序：国内优先，然后国际
    const sortedSites = [...latencySites].sort((a, b) => {
        const aIsChina = a.region === '国内' ? 0 : 1;
        const bIsChina = b.region === '国内' ? 0 : 1;
        return aIsChina - bIsChina;
    });
    sortedSites.forEach(site => {
        const card = document.createElement('div');
        card.className = 'latency-card';
        const siteName = site.name.toLowerCase().replace(/\s+/g, '-');
        card.innerHTML = `
			<div class="latency-card-header">
				<div class="latency-card-info">
					<div class="latency-card-icon-wrapper" data-site="${siteName}">
						${site.icon}
					</div>
					<div class="latency-card-text">
						<span class="latency-card-name">${site.name}</span>
						<span class="latency-card-region" data-region="${site.region}">${site.region}</span>
					</div>
				</div>
				<div class="latency-status" id="latency-${siteName}">...<span class="unit">ms</span></div>
			</div>
			<div class="latency-graph-container">
				<div class="graph-grid"></div>
				<svg class="latency-ecg" viewBox="0 0 400 60" preserveAspectRatio="none">
					<path class="ecg-path-bg" d="M0,30 L400,30"></path>
					<path class="ecg-path" id="path-${siteName}" d="M0,30 L400,30"></path>
					<circle class="ecg-cursor" id="cursor-${siteName}" r="3" cx="0" cy="30" style="display:none"></circle>
				</svg>
			</div>
		`;
        container.appendChild(card);
    });
}
// 测试延迟
async function testLatency(site) {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), latencyFetchTimeoutMs);
    latencyFetchControllers.add(controller);
    try {
        await fetch(site.url + '?t=' + Date.now(), {
            method: 'HEAD',
            cache: 'no-cache',
            mode: 'no-cors',
            referrerPolicy: 'no-referrer',
            signal: controller.signal
        });
        const latency = Date.now() - start;
        return latency;
    } catch (error) {
        return -1; // 连接失败
    } finally {
        clearTimeout(timeoutId);
        latencyFetchControllers.delete(controller);
    }
}

function initLatencyDataStorage() {
    if (Object.keys(latencySiteLatencies).length > 0) return;
    latencySites.forEach(site => {
        const siteName = site.name.toLowerCase().replace(/\s+/g, '-');
        latencySiteLatencies[siteName] = [];
    });
}

function stopLatencyTest() {
    latencyTestActive = false;
    latencyTestSessionId += 1;
    Object.values(latencySiteIntervals).forEach(timer => clearInterval(timer));
    latencySiteIntervals = {};
    latencySiteUpdateInProgress = {};
    latencyFetchControllers.forEach(controller => controller.abort());
    latencyFetchControllers.clear();
    Object.values(latencyUIState).forEach(state => {
        if (state && state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
    });
}
// 获取延迟颜色
function getLatencyColor(latency) {
    if (latency === -1) return 'var(--destructive)';
    if (latency <= 49) return 'var(--latency-49)';
    if (latency <= 149) return 'var(--latency-149)';
    if (latency <= 299) return 'var(--latency-299)';
    if (latency <= 999) return 'var(--latency-999)';
    return 'var(--latency-1000)';
}
// 更新延迟显示
function updateLatencyDisplay(siteName, latencies) {
    const valueElement = document.getElementById(`latency-${siteName}`);
    const pathElement = document.getElementById(`path-${siteName}`);
    const cursorElement = document.getElementById(`cursor-${siteName}`);
    if (!valueElement || !pathElement) return;
    // 计算平均延迟
    const lastLatency = latencies[latencies.length - 1];
    const validLatencies = latencies.filter(l => l !== -1);
    let avgLatency = -1;
    if (validLatencies.length > 0) {
        // 如果有足够的数据，去掉最高和最低延迟以获得更稳定的平均值
        if (validLatencies.length > 5) {
            const sorted = [...validLatencies].sort((a, b) => a - b);
            const trimmed = sorted.slice(1, -1);
            avgLatency = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
        } else {
            avgLatency = validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length;
        }
    }
    const targetValue = Math.round(avgLatency);
    // 更新文字显示
    if (validLatencies.length === 0) {
        if (lastLatency === -1) {
            valueElement.innerHTML = 'TIMEOUT';
            valueElement.style.color = 'var(--latency-999)';
        } else {
            valueElement.innerHTML = '...<span class="unit">ms</span>';
            valueElement.style.color = '#f6821f';
        }
    } else {
        const siteState = latencyUIState[siteName] || {
            current: targetValue,
            timer: null
        };
        latencyUIState[siteName] = siteState;
        // 设置颜色
        const avgColor = getLatencyColor(targetValue);
        valueElement.style.color = avgColor;
        // 如果数值变化较小，直接显示
        if (isLowPerformanceMode) {
            if (siteState.timer) {
                clearInterval(siteState.timer);
                siteState.timer = null;
            }
            siteState.current = targetValue;
            valueElement.innerHTML = `${targetValue}<span class="unit">ms</span>`;
        } else if (Math.abs(siteState.current - targetValue) < 2) {
            siteState.current = targetValue;
            valueElement.innerHTML = `${targetValue}<span class="unit">ms</span>`;
        } else {
            // 清除旧的计时器
            if (siteState.timer) clearInterval(siteState.timer);
            // 每 30ms 更新一次数字，实现滚动的动态效果
            const step = () => {
                if (siteState.current < targetValue) {
                    siteState.current += Math.ceil((targetValue - siteState.current) / 5);
                } else if (siteState.current > targetValue) {
                    siteState.current -= Math.ceil((siteState.current - targetValue) / 5);
                }
                valueElement.innerHTML = `${siteState.current}<span class="unit">ms</span>`;
                if (siteState.current === targetValue) {
                    clearInterval(siteState.timer);
                    siteState.timer = null;
                }
            };
            siteState.timer = setInterval(step, 30);
        }
    }
    // 更新 SVG 路径
    const width = 400;
    const height = 60;
    const padding = 10;
    const step = width / (latencyTestConfig.count - 1);
    let points = [];
    latencies.forEach((l, i) => {
        const x = i * step;
        let y;
        if (l === -1) {
            y = height - 5;
        } else {
            // 映射 0-500ms 到高度，高延迟在上，低延迟在下？通常ECG是越高表示值越大或者越快？
            // demo里是 height - padding - (Math.min(l, 500) / 500 * (height - 2 * padding))
            // 这意味着延迟越低，y越大（越靠下）。延迟越高，y越小（越靠上）。
            y = height - padding - (Math.min(l, 500) / 800 * (height - 2 * padding));
        }
        points.push({
            x,
            y
        });
    });
    if (points.length > 0) {
        // 生成平滑曲线路径 (Bezier)
        let d = `M${points[0].x},${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const x_mid = (points[i].x + points[i + 1].x) / 2;
            const y_mid = (points[i].y + points[i + 1].y) / 2;
            d += ` Q${points[i].x},${points[i].y} ${x_mid},${y_mid}`;
        }
        const lastPoint = points[points.length - 1];
        d += ` L${lastPoint.x},${lastPoint.y}`;
        pathElement.setAttribute('d', d);
        const avgColor = getLatencyColor(targetValue);
        pathElement.style.stroke = avgColor;
        // 更新光标位置
        if (cursorElement) {
            cursorElement.style.display = 'block';
            cursorElement.setAttribute('cx', lastPoint.x);
            cursorElement.setAttribute('cy', lastPoint.y);
            cursorElement.style.fill = avgColor;
        }
    }
}
// 开始延迟测试
async function startLatencyTest() {
    if (latencyTestActive) return;
    latencyTestActive = true;
    const currentSessionId = ++latencyTestSessionId;
    Object.values(latencySiteIntervals).forEach(timer => clearInterval(timer));
    latencySiteIntervals = {};
    latencySiteUpdateInProgress = {};
    if (!latencyTestStarted) {
        generateLatencyCards();
        latencyTestStarted = true;
    }
    initLatencyDataStorage();
    latencySites.forEach(site => {
        startSingleSiteLatencyLoop(site, currentSessionId);
    });
}
async function startSingleSiteLatencyLoop(site, sessionId) {
    const siteName = site.name.toLowerCase().replace(/\s+/g, '-');
    while (latencyTestActive && sessionId === latencyTestSessionId && latencySiteLatencies[siteName].length < latencyTestConfig.count) {
        const latency = await testLatency(site);
        if (!latencyTestActive || sessionId !== latencyTestSessionId) return;
        latencySiteLatencies[siteName].push(latency);
        updateLatencyDisplay(siteName, latencySiteLatencies[siteName]);
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (!latencyTestActive || sessionId !== latencyTestSessionId) return;
    if (latencySiteIntervals[siteName]) {
        clearInterval(latencySiteIntervals[siteName]);
        delete latencySiteIntervals[siteName];
    }
    latencySiteIntervals[siteName] = setInterval(async () => {
        if (!latencyTestActive || sessionId !== latencyTestSessionId || latencySiteUpdateInProgress[siteName]) {
            return;
        }
        latencySiteUpdateInProgress[siteName] = true;
        try {
            const latency = await testLatency(site);
            if (!latencyTestActive || sessionId !== latencyTestSessionId) return;
            latencySiteLatencies[siteName].push(latency);
            if (latencySiteLatencies[siteName].length > latencyTestConfig.count) {
                latencySiteLatencies[siteName].shift();
            }
            updateLatencyDisplay(siteName, latencySiteLatencies[siteName]);
        } finally {
            latencySiteUpdateInProgress[siteName] = false;
        }
    }, 618 * 3);
}
// 切换主题
function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark-mode');
    applyTheme(isDark ? 'light' : 'dark');
}
// 返回顶部
function scrollToTop() {
    const pageWrapper = document.querySelector('.page-wrapper');
    const behavior = isLowPerformanceMode ? 'auto' : 'smooth';
    if (pageWrapper) {
        pageWrapper.scrollTo({
            top: 0,
            behavior
        });
    } else {
        window.scrollTo({
            top: 0,
            behavior
        });
    }
}

function updateVersionBadge(version) {
    const versionBadge = document.getElementById('versionBadge');
    const versionValue = document.getElementById('versionValue');
    if (!versionBadge || !versionValue) return;
    versionBadge.classList.remove('is-latest', 'is-outdated', 'is-preview');
    const rawText = String(version ? ? '').trim();
    const digitsOnly = rawText.replace(/\D/g, '');
    const text = digitsOnly || rawText;
    if (text) {
        cachedCurrentVersionFullText = text;
        cachedCurrentVersionNumber = parseVersionNumber(text);
        const shortText = text.slice(0, 8);
        versionValue.textContent = "v2.1." + shortText;
        versionBadge.dataset.health = '';
        versionBadge.hidden = false;
        versionBadge.style.display = 'flex';
        versionBadge.title = `当前版本: ${versionValue.textContent}`;
    } else {
        versionValue.textContent = '';
        cachedCurrentVersionNumber = 0;
        cachedCurrentVersionFullText = '';
        versionBadge.dataset.health = '';
        versionBadge.hidden = true;
        versionBadge.style.display = 'none';
        versionBadge.title = '当前版本';
    }
}

function parseVersionNumber(value) {
    const digits = String(value ? ? '').replace(/\D/g, '');
    if (!digits) return 0;
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isProxyProtocolAvailable(protocol) {
    if (protocol === 'https') return httpsProxyFeatureEnabled;
    if (protocol === 'turn' || protocol === 'sstp') return turnSstpProxyFeatureEnabled;
    return protocol === 'socks5' || protocol === 'http';
}

function normalizeProxyProtocol(protocol) {
    if (!PROXY_PROTOCOLS.includes(protocol)) return 'socks5';
    if (!proxyFeatureAvailabilityInitialized) return protocol;
    return isProxyProtocolAvailable(protocol) ? protocol : 'http';
}

function getProxyAddressFieldId(protocol) {
    return {
        socks5: 'socks5Addr',
        http: 'httpAddr',
        https: 'httpsAddr',
        turn: 'turnAddr',
        sstp: 'sstpAddr'
    }[protocol] || 'socks5Addr';
}

function getProxyGlobalFieldId(protocol) {
    return {
        socks5: 'globalSocks5',
        http: 'globalHTTP',
        https: 'globalHTTPS',
        turn: 'globalTURN',
        sstp: 'globalSSTP'
    }[protocol] || 'globalSocks5';
}

function getSelectedProxyProtocol() {
    const proxyProtocol = document.getElementById('proxyProtocol');
    return normalizeProxyProtocol(proxyProtocol ? .value || 'socks5');
}

function getEffectiveProxyMode() {
    const proxyMode = document.getElementById('proxyMode');
    if (!proxyMode || proxyMode.value === 'auto') return 'auto';
    if (PROXY_PROTOCOLS.includes(proxyMode.value)) return normalizeProxyProtocol(proxyMode.value);
    return getSelectedProxyProtocol();
}

function setProxyModeSelection(mode) {
    const proxyMode = document.getElementById('proxyMode');
    const proxyProtocol = document.getElementById('proxyProtocol');
    if (proxyMode) {
        proxyMode.value = mode === 'auto' ? 'auto' : 'other';
    }
    if (proxyProtocol && mode !== 'auto') {
        proxyProtocol.value = normalizeProxyProtocol(mode);
    }
}

function syncProxyProtocolVisibility(protocol) {
    const activeProtocol = normalizeProxyProtocol(protocol);
    const proxyProtocol = document.getElementById('proxyProtocol');
    if (proxyProtocol && proxyProtocol.value !== activeProtocol) {
        proxyProtocol.value = activeProtocol;
    }
    PROXY_PROTOCOLS.forEach((item) => {
        document.getElementById(`${item}ProxyField`) ? .classList.toggle('active', item === activeProtocol);
    });
    const globalGroupMap = {
        socks5: 'globalSocks5Group',
        http: 'globalHTTPGroup',
        https: 'globalHTTPSGroup',
        turn: 'globalTURNGroup',
        sstp: 'globalSSTPGroup'
    };
    PROXY_PROTOCOLS.forEach((item) => {
        document.getElementById(globalGroupMap[item]) ? .classList.toggle('active', item === activeProtocol);
    });
}

function populateProxyProtocolFromConfig(protocol) {
    const activeProtocol = normalizeProxyProtocol(protocol);
    const accountField = document.getElementById(getProxyAddressFieldId(activeProtocol));
    const globalField = document.getElementById(getProxyGlobalFieldId(activeProtocol));
    if (accountField) {
        accountField.value = currentConfig.反代 ? .SOCKS5 ? .账号 || '';
    }
    if (globalField) {
        globalField.checked = currentConfig.反代 ? .SOCKS5 ? .全局 || false;
    }
}

function applyProxyConfigToForm() {
    const socksEnabled = currentConfig.反代 ? .SOCKS5 ? .启用;
    if (!socksEnabled) {
        setProxyModeSelection('auto');
        document.getElementById('proxyIP').value = currentConfig.反代 ? .PROXYIP || '';
        document.getElementById('autoProxy').checked = (currentConfig.反代 ? .PROXYIP === 'auto');
        document.getElementById('proxyIP').disabled = (currentConfig.反代 ? .PROXYIP === 'auto');
    } else {
        setProxyModeSelection(socksEnabled);
        populateProxyProtocolFromConfig(getSelectedProxyProtocol());
    }
    updateProxyMode(false, false);
}

function setHttpsProxyFeatureAvailability(currentVersion) {
    proxyFeatureAvailabilityInitialized = true;
    const versionNumber = parseVersionNumber(currentVersion);
    httpsProxyFeatureEnabled = versionNumber >= HTTPS_PROXY_MIN_VERSION;
    turnSstpProxyFeatureEnabled = versionNumber >= TURN_SSTP_PROXY_MIN_VERSION;
    chainProxyFeatureEnabled = versionNumber >= CHAIN_PROXY_MIN_VERSION;
    alpnFeatureEnabled = versionNumber >= ALPN_FEATURE_MIN_VERSION;
    updateChainProxyButtonVisibility();
    updateALPNGroupVisibility();
    const httpsOption = document.getElementById('httpsProxyOption');
    if (httpsOption) {
        httpsOption.hidden = !httpsProxyFeatureEnabled;
        httpsOption.style.display = httpsProxyFeatureEnabled ? '' : 'none';
    }
    const turnOption = document.getElementById('turnProxyOption');
    if (turnOption) {
        turnOption.hidden = !turnSstpProxyFeatureEnabled;
        turnOption.style.display = turnSstpProxyFeatureEnabled ? '' : 'none';
    }
    const sstpOption = document.getElementById('sstpProxyOption');
    if (sstpOption) {
        sstpOption.hidden = !turnSstpProxyFeatureEnabled;
        sstpOption.style.display = turnSstpProxyFeatureEnabled ? '' : 'none';
    }
    const proxyMode = document.getElementById('proxyMode');
    if (!proxyMode) return;
    const proxyProtocol = document.getElementById('proxyProtocol');
    const selectedProtocol = proxyMode.value === 'auto' ? 'auto' : (proxyProtocol ? .value || 'socks5');
    const isUnsupportedHttps = selectedProtocol === 'https' && !httpsProxyFeatureEnabled;
    const isUnsupportedTurnSstp = ['turn', 'sstp'].includes(selectedProtocol) && !turnSstpProxyFeatureEnabled;
    if (isUnsupportedHttps || isUnsupportedTurnSstp) {
        setProxyModeSelection('http');
        updateProxyMode(false);
        return;
    }
    if (proxyMode.value !== 'auto') {
        updateProxyMode(false, false);
    }
}

function getVersionHealthMeta(healthKey) {
    if (healthKey === 'latest') {
        return {
            titleSuffix: '已是最新',
            summaryClass: 'state-latest',
            tipClass: 'is-latest',
            tipText: '已是最新'
        };
    }
    if (healthKey === 'preview') {
        return {
            titleSuffix: '测试版',
            summaryClass: 'state-preview',
            tipClass: 'is-preview',
            tipText: '测试版'
        };
    }
    return {
        titleSuffix: '需要更新',
        summaryClass: 'state-outdated',
        tipClass: 'is-outdated',
        tipText: '需要更新'
    };
}

function applyVersionInfoHealthState(healthKey) {
    const summaryEl = document.getElementById('versionInfoSummary');
    const stateTextEl = document.getElementById('currentVersionStateText');
    if (!summaryEl || !stateTextEl) return;
    const meta = getVersionHealthMeta(healthKey);
    summaryEl.classList.remove('state-latest', 'state-outdated', 'state-preview');
    stateTextEl.classList.remove('is-latest', 'is-outdated', 'is-preview');
    summaryEl.classList.add(meta.summaryClass);
    stateTextEl.classList.add(meta.tipClass);
    stateTextEl.textContent = meta.tipText;
}

function setVersionBadgeHealthState(diff) {
    const versionBadge = document.getElementById('versionBadge');
    const versionValue = document.getElementById('versionValue');
    if (!versionBadge) return;
    let healthKey = 'outdated';
    if (diff === 0) {
        healthKey = 'latest';
    } else if (diff > 0) {
        healthKey = 'preview';
    }
    const meta = getVersionHealthMeta(healthKey);
    versionBadge.classList.remove('is-latest', 'is-outdated', 'is-preview');
    if (healthKey === 'latest') {
        versionBadge.classList.add('is-latest');
    } else if (healthKey === 'outdated') {
        versionBadge.classList.add('is-outdated');
    } else {
        versionBadge.classList.add('is-preview');
    }
    versionBadge.dataset.health = healthKey;
    versionBadge.title = `当前版本: ${versionValue?.textContent || ''} ${meta.titleSuffix}`;
    applyVersionInfoHealthState(healthKey);
}
async function fetchLatestOnlineVersionNumber() {
    cachedWorkerVersionRawText = '';
    cachedLatestOnlineVersion = 0;
    try {
        const workerText = await fetchWithAutoMirror(WORKER_VERSION_SOURCE_URL + '?_t=' + Date.now(), 'Worker 主程序');
        cachedWorkerVersionRawText = workerText;
        const versionMatch = workerText.match(/^\s*const\s+Version\s*=\s*['"]([^'"]+)['"]\s*;?/m);
        const latestVersion = versionMatch ? parseVersionNumber(versionMatch[1]) : 0;
        cachedLatestOnlineVersion = latestVersion;
        console.log(`[Version] 在线最新版本识别: raw="${versionMatch ? versionMatch[1] : ''}", parsed=${latestVersion}`);
        return latestVersion;
    } catch (error) {
        console.warn('[Version] 在线获取最新版本失败，按 0 处理:', error);
        cachedLatestOnlineVersion = 0;
        return 0;
    }
}
async function updateVersionBadgeHealthByLatest(currentVersion) {
    const currentVersionNumber = parseVersionNumber(currentVersion);
    const latestVersionNumber = await fetchLatestOnlineVersionNumber();
    const diff = currentVersionNumber - latestVersionNumber;
    console.log(`[Version] 版本比较: current=${currentVersionNumber}, latest=${latestVersionNumber}, diff=${diff}`);
    setVersionBadgeHealthState(diff);
}
async function loadVersionByUUID(uuid) {
    const uuidValue = String(uuid || '').trim();
    if (!uuidValue) {
        updateVersionBadge(0);
        setHttpsProxyFeatureAvailability(0);
        await updateVersionBadgeHealthByLatest(0);
        return;
    }
    const maxRetries = 3;
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`/version?_t=${Date.now()}&uuid=${encodeURIComponent(uuidValue)}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data || typeof data !== 'object' || !Object.prototype.hasOwnProperty.call(data, 'Version')) {
                throw new Error('missing Version field');
            }
            const currentVersion = parseVersionNumber(data.Version);
            console.log(`[Version] 当前版本识别: raw="${data.Version}", parsed=${currentVersion}, attempt=${attempt}/${maxRetries}`);
            updateVersionBadge(currentVersion);
            setHttpsProxyFeatureAvailability(currentVersion);
            await updateVersionBadgeHealthByLatest(currentVersion);
            return;
        } catch (error) {
            lastError = error;
            console.warn(`[Version] 获取版本号失败(第${attempt}/${maxRetries}次):`, error);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
    }
    console.warn('[Version] 获取版本号重试3次仍失败，按 0 处理:', lastError);
    updateVersionBadge(0);
    setHttpsProxyFeatureAvailability(0);
    await updateVersionBadgeHealthByLatest(0);
}

function onVersionBadgeKeydown(event) {
    if (!event) return;
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openVersionInfoModal();
    }
}

function openVersionInfoModal() {
    const versionBadge = document.getElementById('versionBadge');
    const versionValue = document.getElementById('versionValue');
    const modal = document.getElementById('versionInfoModal');
    const latestVersionValueEl = document.getElementById('latestVersionInfoValue');
    const currentVersionValueEl = document.getElementById('currentVersionInfoValue');
    if (!versionBadge || !versionValue || !modal || !latestVersionValueEl || !currentVersionValueEl) return;
    if (versionBadge.hidden || versionBadge.style.display === 'none') return;
    const currentVersionFullText = cachedCurrentVersionFullText || String(versionValue.textContent || '').replace(/^v2\.1\./, '');
    const currentVersion = parseVersionNumber(currentVersionFullText);
    const latestVersion = cachedLatestOnlineVersion || 0;
    latestVersionValueEl.textContent = `v2.1.${latestVersion}`;
    currentVersionValueEl.textContent = `v2.1.${currentVersionFullText || currentVersion || 0}`;
    let healthKey = versionBadge.dataset.health || '';
    if (!healthKey) {
        if (versionBadge.classList.contains('is-latest')) {
            healthKey = 'latest';
        } else if (versionBadge.classList.contains('is-preview')) {
            healthKey = 'preview';
        } else {
            healthKey = 'outdated';
        }
    }
    applyVersionInfoHealthState(healthKey);
    modal.classList.add('show');
}

function closeVersionInfoModal(event) {
    if (event && event.target.id !== 'versionInfoModal') return;
    const modal = document.getElementById('versionInfoModal');
    if (modal) {
        modal.classList.remove('show');
    }
}
// ==================== 复制按钮长按彩蛋（JShaman 混淆）====================
const VERSION_COPY_LONG_PRESS_MS = 618;
const VERSION_COPY_FETCH_TIMEOUT_MS = 60000;
const VERSION_COPY_SUPPRESS_CLICK_MS = 500;
const JSHAMAN_SUBMIT_URL = 'https://www.jshaman.com:4430/submit_js_code/';
const JSHAMAN_VIP_CODE = 'free';
const JSHAMAN_FREE_MAX_BYTES = 512 * 1024;
let versionCopyPressTimer = null;
let versionCopyAbortController = null;
let versionCopyPressActive = false;
let versionCopyEasterEggActive = false;
let versionCopyRequestInFlight = false;
let versionCopyEasterEggDone = false;
let versionCopyUserReleased = false;
let versionCopyLastPointerHandledAt = 0;
// 通用剪贴板复制（供原始复制与彩蛋混淆复制复用）
async function copyTextToClipboard(text) {
    const content = String(text ? ? '');
    if (!content) {
        return false;
    }
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(content);
        } else {
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = content;
            tempTextarea.style.position = 'fixed';
            tempTextarea.style.opacity = '0';
            tempTextarea.style.left = '-9999px';
            tempTextarea.style.top = '0';
            document.body.appendChild(tempTextarea);
            tempTextarea.focus();
            tempTextarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(tempTextarea);
            if (!success) throw new Error('execCommand copy failed');
        }
        return true;
    } catch (error) {
        console.error('[Version] 复制文本到剪贴板失败:', error);
        return false;
    }
}
// 复制原始（未混淆）源码并提示，保持原有点击行为
function copyOriginalWorkerSourceWithToast() {
    const source = String(cachedWorkerVersionRawText || '');
    if (!source) {
        showToast('暂无可复制的最新 Worker.js 源码', 'error');
        return;
    }
    copyTextToClipboard(source).then((copied) => {
        showToast(copied ? '✅ 已复制最新 Worker.js 源码到剪贴板' : '复制失败，请手动复制源码', copied ? 'success' : 'error');
    });
}
async function copyLatestWorkerSourceToClipboard() {
    // 若刚刚已由长按指针事件处理过复制，则跳过（避免 click 与 pointerup 双重复制）
    if (Date.now() - versionCopyLastPointerHandledAt < VERSION_COPY_SUPPRESS_CLICK_MS) {
        versionCopyLastPointerHandledAt = 0;
        return;
    }
    const source = String(cachedWorkerVersionRawText || '');
    if (!source) {
        showToast('暂无可复制的最新 Worker.js 源码', 'error');
        return;
    }
    const copied = await copyTextToClipboard(source);
    if (copied) {
        showToast('✅ 已复制最新 Worker.js 源码到剪贴板', 'success');
    } else {
        showToast('复制失败，请手动复制源码', 'error');
    }
}
// 调用 JShaman 免费混淆 Web API，返回混淆后的代码
async function obfuscateWorkerSourceWithJShaman(source) {
    const controller = new AbortController();
    versionCopyAbortController = controller;
    const timeoutId = setTimeout(() => controller.abort(), VERSION_COPY_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(JSHAMAN_SUBMIT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json'
            },
            // JShaman 免费 VIP 码(free)不支持 config 参数（实测返回"权限不足，您的VIP码无法配置参数"），故使用其服务端默认混淆参数
            body: JSON.stringify({
                js_code: String(source),
                vip_code: JSHAMAN_VIP_CODE
            }),
            signal: controller.signal
        });
        if (!response.ok) throw new Error('JShaman 请求失败 HTTP ' + response.status);
        const data = await response.json();
        if (!data || data.status !== 0) {
            throw new Error((data && data.message) ? data.message : 'JShaman 返回状态异常');
        }
        const obfuscated = String(data.content || '');
        if (!obfuscated) {
            throw new Error('JShaman 返回内容为空');
        }
        return obfuscated;
    } finally {
        clearTimeout(timeoutId);
    }
}
// 停止按钮颤抖并清理释放态残留（幂等安全）
function stopVersionCopyEasterEggShake() {
    const button = document.getElementById('versionCopyBtn') || document.querySelector('.btn-version-copy');
    if (button) {
        button.classList.remove('easter-egg-shaking', 'egg-release');
    }
}
// 按钮轻弹释放：混淆成功瞬间轻微弹一下（克制，不过冲），播放结束后移除类以恢复常态
function playVersionCopyRelease(button) {
    if (!button) return;
    button.classList.remove('egg-release');
    void button.offsetWidth; // 强制 reflow，确保动画可重播
    button.classList.add('egg-release');
    const removeRelease = () => button.classList.remove('egg-release');
    button.addEventListener('animationend', removeRelease, {
        once: true
    });
    setTimeout(removeRelease, 500);
}
// 长按满 618ms 后触发：颤抖按钮并调用 JShaman 混淆，完成后复制混淆源码
async function startVersionCopyEasterEgg() {
    const source = String(cachedWorkerVersionRawText || '');
    const button = document.getElementById('versionCopyBtn') || document.querySelector('.btn-version-copy');
    if (!source) {
        versionCopyEasterEggActive = true;
        versionCopyEasterEggDone = true;
        stopVersionCopyEasterEggShake();
        showToast('暂无可混淆的最新 Worker.js 源码', 'error');
        return;
    }
    // 免费版限制：提交代码量限 512KB（按字节数计算，source.length 为 UTF-16 字符数而非字节数）
    const sourceBytes = new TextEncoder().encode(source).length;
    if (sourceBytes > JSHAMAN_FREE_MAX_BYTES) {
        versionCopyEasterEggActive = true;
        versionCopyEasterEggDone = true;
        stopVersionCopyEasterEggShake();
        const copied = await copyTextToClipboard(source);
        showToast(copied ? '源码超过免费版 512KB 限制，已复制原始源码' : '源码超过免费版 512KB 限制，复制原始源码失败', 'error');
        return;
    }
    versionCopyEasterEggActive = true;
    versionCopyRequestInFlight = true;
    if (button) {
        button.classList.remove('egg-release');
        button.classList.add('easter-egg-shaking');
    }
    console.log('[Version] 长按彩蛋触发，开始 JShaman 混淆...');
    try {
        const obfuscated = await obfuscateWorkerSourceWithJShaman(source);
        versionCopyRequestInFlight = false;
        versionCopyEasterEggDone = true;
        stopVersionCopyEasterEggShake();
        playVersionCopyRelease(button);
        console.log('[Version] JShaman 混淆成功，已复制混淆源码');
        const copied = await copyTextToClipboard(obfuscated);
        if (copied) {
            showToast('🎉 已复制混淆后的 Worker.js 源码到剪贴板', 'success');
        } else {
            showToast('混淆成功，但复制失败，请手动复制源码', 'error');
        }
    } catch (error) {
        versionCopyRequestInFlight = false;
        versionCopyEasterEggDone = true;
        stopVersionCopyEasterEggShake();
        if (versionCopyUserReleased) return; // 用户中途放手已回退，无需重复处理
        console.error('[Version] JShaman 混淆失败:', error);
        const copied = await copyTextToClipboard(source);
        showToast(copied ? '混淆失败，已复制原始源码' : '混淆失败，复制原始源码也失败', 'error');
    }
}
// pointerdown：启动 618ms 长按定时器（触发前按钮保持静止，618ms 到点后由 startVersionCopyEasterEgg 开始颤抖）
function onVersionCopyPointerDown(event) {
    // 仅响应主按键（左键/触摸/笔），避免右键等干扰
    if (event && event.button !== undefined && event.button !== 0) return;
    if (versionCopyRequestInFlight) return; // 混淆请求进行中，忽略新的按压
    versionCopyPressActive = true;
    versionCopyEasterEggActive = false;
    versionCopyEasterEggDone = false;
    versionCopyUserReleased = false;
    clearTimeout(versionCopyPressTimer);
    versionCopyPressTimer = setTimeout(() => {
        startVersionCopyEasterEgg();
    }, VERSION_COPY_LONG_PRESS_MS);
}
// pointerup / pointerleave / pointercancel：结束按压
function onVersionCopyPointerEnd(event) {
    if (!versionCopyPressActive) return;
    versionCopyPressActive = false;
    clearTimeout(versionCopyPressTimer);
    versionCopyPressTimer = null;
    stopVersionCopyEasterEggShake(); // 清理颤抖阶段类（彩蛋未触发/已完成/已回退时均幂等安全）
    if (versionCopyEasterEggActive && versionCopyRequestInFlight) {
        // 彩蛋已触发但仍在等待后端：三种结束事件均视为放弃
        // 中止请求、停止抖动、复制原始源码
        versionCopyUserReleased = true;
        if (versionCopyAbortController) versionCopyAbortController.abort();
        versionCopyRequestInFlight = false;
        stopVersionCopyEasterEggShake();
        versionCopyLastPointerHandledAt = Date.now();
        copyOriginalWorkerSourceWithToast();
        return;
    }
    if (versionCopyEasterEggActive && versionCopyEasterEggDone) {
        // 彩蛋已完成：混淆结果已复制（或已回退），无需重复操作
        versionCopyLastPointerHandledAt = Date.now();
        return;
    }
    // 彩蛋未触发（618ms 内结束按压）
    const eventType = event && event.type ? event.type : '';
    if (eventType === 'pointerleave' || eventType === 'pointercancel') {
        // 拖出按钮 / 手势取消 = 放弃操作：仅清除定时器，不复制、不弹 toast
        return;
    }
    // pointerup（正常点击）：保持原有行为，复制未混淆源码
    versionCopyLastPointerHandledAt = Date.now();
    copyOriginalWorkerSourceWithToast();
}
// 初始化：绑定长按彩蛋事件（不影响原有 onclick）
function initVersionCopyEasterEgg() {
    const button = document.getElementById('versionCopyBtn') || document.querySelector('.btn-version-copy');
    if (!button) return;
    button.addEventListener('pointerdown', onVersionCopyPointerDown);
    button.addEventListener('pointerup', onVersionCopyPointerEnd);
    button.addEventListener('pointerleave', onVersionCopyPointerEnd);
    button.addEventListener('pointercancel', onVersionCopyPointerEnd);
}

function openLatestPagesZipDownload() {
    const popup = window.open(PAGES_ZIP_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
    if (!popup) {
        showToast('浏览器拦截了新窗口，请允许弹窗后再试', 'warning');
    }
}

function escapeMarkdownHtml(text) {
    return String(text ? ? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeHttpUrl(urlText) {
    try {
        const parsed = new URL(String(urlText || '').trim(), window.location.href);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
    } catch (_) {
        // ignore invalid URLs
    }
    return '';
}

function renderChangelogInline(rawText) {
    const formatInlineText = (text) => {
        return escapeMarkdownHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    };
    const source = String(rawText ? ? '');
    const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    let html = '';
    let cursor = 0;
    let match = null;
    while ((match = linkPattern.exec(source)) !== null) {
        const [fullMatch, label, href] = match;
        html += formatInlineText(source.slice(cursor, match.index));
        const safeHref = sanitizeHttpUrl(href);
        if (safeHref) {
            html += `<a href="${escapeMarkdownHtml(safeHref)}" target="_blank" rel="noopener">${formatInlineText(label)}</a>`;
        } else {
            html += formatInlineText(fullMatch);
        }
        cursor = match.index + fullMatch.length;
    }
    html += formatInlineText(source.slice(cursor));
    return html;
}

function buildVersionMatchCandidates(value) {
    const set = new Set();
    const raw = String(value ? ? '').trim();
    if (!raw) return set;
    const digits = raw.replace(/\D/g, '');
    if (digits) {
        set.add(digits);
        if (digits.length === 14) {
            set.add(`21${digits}`);
        }
        if (digits.startsWith('21') && digits.length > 2) {
            set.add(digits.slice(2));
        }
    }
    const versionBodyMatch = raw.match(/(?:^|v)2\.1\.(\d+)/i);
    if (versionBodyMatch && versionBodyMatch[1]) {
        set.add(versionBodyMatch[1]);
        set.add(`21${versionBodyMatch[1]}`);
    }
    return set;
}

function parseChangelogVersionHeading(headingText) {
    const source = String(headingText ? ? '').trim();
    const match = source.match(/^\[([^\]]+)\](?:\s*-\s*(.+))?$/);
    if (!match) {
        return {
            versionText: source,
            dateText: '',
            candidates: buildVersionMatchCandidates(source)
        };
    }
    const versionText = String(match[1] || '').trim();
    const dateText = String(match[2] || '').trim();
    return {
        versionText,
        dateText,
        candidates: buildVersionMatchCandidates(versionText)
    };
}

function resolveCurrentVersionDisplayText() {
    const currentVersionInfoEl = document.getElementById('currentVersionInfoValue');
    const fromInfo = String(currentVersionInfoEl ? .textContent || '').trim();
    if (fromInfo) return fromInfo;
    if (cachedCurrentVersionFullText) return `v2.1.${cachedCurrentVersionFullText}`;
    return '';
}

function isCurrentVersionMatched(currentCandidates, headingCandidates) {
    if (!currentCandidates || currentCandidates.size === 0) return false;
    if (!headingCandidates || headingCandidates.size === 0) return false;
    for (const candidate of headingCandidates) {
        if (currentCandidates.has(candidate)) {
            return true;
        }
    }
    return false;
}

function getChangelogSubheadingMeta(rawHeadingText) {
    const normalized = String(rawHeadingText ? ? '').trim().toLowerCase();
    const 新增功能 = ['新增功能', 'added', 'add', 'new'].map(s => s.toLowerCase());
    const 问题修复 = ['问题修复', 'debug', 'bug', 'fixed', 'fix'].map(s => s.toLowerCase());
    const 功能改进 = ['功能改进', 'enhancement', 'improve', 'improvement', 'optimize', 'optimization', 'change', 'changed'].map(s => s.toLowerCase());
    const 功能移除 = ['功能移除', 'delete', 'deleted', 'remove', 'removed', 'removal'].map(s => s.toLowerCase());
    if (新增功能.includes(normalized)) {
        return {
            type: 'new',
            label: '新增功能',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus w-4 h-4"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`
        };
    }
    if (问题修复.includes(normalized)) {
        return {
            type: 'debug',
            label: '问题修复',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bug w-4 h-4"><path d="m8 2 1.88 1.88"></path><path d="M14.12 3.88 16 2"></path><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"></path><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"></path><path d="M12 20v-9"></path><path d="M6.53 9C4.6 8.8 3 7.1 3 5"></path><path d="M6 13H2"></path><path d="M3 21c0-2.1 1.7-3.9 3.8-4"></path><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"></path><path d="M22 13h-4"></path><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"></path></svg>`
        };
    }
    if (功能改进.includes(normalized)) {
        return {
            type: 'improve',
            label: '功能改进',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw w-4 h-4"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>`
        };
    }
    if (功能移除.includes(normalized)) {
        return {
            type: 'delete',
            label: '功能移除',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2 w-4 h-4"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>`
        };
    }
    return null;
}

function renderChangelogSubheading(rawHeadingText, resolvedMeta = null) {
    const meta = resolvedMeta || getChangelogSubheadingMeta(rawHeadingText);
    if (!meta) {
        return `<h4>${renderChangelogInline(rawHeadingText)}</h4>`;
    }
    return `<h4 class="changelog-subtitle is-${meta.type}"><span class="changelog-subtitle-icon">${meta.icon}</span><span class="changelog-subtitle-text">${escapeMarkdownHtml(meta.label)}</span></h4>`;
}

function renderChangelogSectionBody(sectionLines) {
    const htmlParts = [];
    let inList = false;
    let currentSubtitleType = '';
    const closeList = () => {
        if (inList) {
            htmlParts.push('</ul>');
            inList = false;
        }
    };
    for (const rawLine of sectionLines) {
        const line = String(rawLine ? ? '').trim();
        if (!line) {
            closeList();
            continue;
        }
        let match = line.match(/^###\s+(.+)$/);
        if (match) {
            closeList();
            const subtitleMeta = getChangelogSubheadingMeta(match[1]);
            currentSubtitleType = subtitleMeta ? subtitleMeta.type : '';
            htmlParts.push(renderChangelogSubheading(match[1], subtitleMeta));
            continue;
        }
        match = line.match(/^-\s+(.+)$/);
        if (match) {
            if (!inList) {
                const listClassName = currentSubtitleType ? `changelog-sublist is-${currentSubtitleType}` : 'changelog-sublist';
                htmlParts.push(`<ul class="${listClassName}">`);
                inList = true;
            }
            htmlParts.push(`<li>${renderChangelogInline(match[1])}</li>`);
            continue;
        }
        closeList();
        htmlParts.push(`<p>${renderChangelogInline(line)}</p>`);
    }
    closeList();
    return htmlParts.join('');
}

function renderChangelogMarkdown(markdownText) {
    const lines = String(markdownText ? ? '').replace(/\r\n?/g, '\n').split('\n');
    const htmlParts = [];
    let versionEntryCount = 0;
    let currentVersionPosition = 0;
    let currentVersionHeadingText = '';
    const currentVersionDisplayText = resolveCurrentVersionDisplayText();
    const currentVersionCandidates = buildVersionMatchCandidates(currentVersionDisplayText || cachedCurrentVersionFullText);
    const sections = [];
    let currentSection = null;
    const prefaceLines = [];
    for (const rawLine of lines) {
        const trimmedLine = String(rawLine ? ? '').trim();
        const versionMatch = trimmedLine.match(/^##\s+(.+)$/);
        if (versionMatch) {
            if (currentSection) {
                sections.push(currentSection);
            }
            currentSection = {
                heading: versionMatch[1],
                bodyLines: []
            };
            continue;
        }
        if (currentSection) {
            currentSection.bodyLines.push(rawLine);
        } else {
            prefaceLines.push(rawLine);
        }
    }
    if (currentSection) {
        sections.push(currentSection);
    }
    const prefaceHtml = renderChangelogSectionBody(prefaceLines);
    if (prefaceHtml) {
        htmlParts.push(prefaceHtml);
    }
    const sectionMetaList = sections.map(section => {
        const parsedHeading = parseChangelogVersionHeading(section.heading);
        return {
            section,
            parsedHeading,
            versionNumber: parseVersionNumber(parsedHeading.versionText)
        };
    });
    let latestVersionNumberInChangelog = 0;
    for (const sectionMeta of sectionMetaList) {
        if (sectionMeta.versionNumber > latestVersionNumberInChangelog) {
            latestVersionNumberInChangelog = sectionMeta.versionNumber;
        }
    }
    for (const sectionMeta of sectionMetaList) {
        versionEntryCount += 1;
        const {
            section,
            parsedHeading,
            versionNumber
        } = sectionMeta;
        const isCurrent = isCurrentVersionMatched(currentVersionCandidates, parsedHeading.candidates);
        const isLatest = latestVersionNumberInChangelog > 0 ? versionNumber === latestVersionNumberInChangelog : versionEntryCount === 1;
        if (isCurrent && !currentVersionPosition) {
            currentVersionPosition = versionEntryCount;
            currentVersionHeadingText = parsedHeading.versionText;
        }
        const badgeText = parsedHeading.versionText ? (parsedHeading.versionText.startsWith('v') ? parsedHeading.versionText : `v${parsedHeading.versionText}`) : '未知版本';
        const dateHtml = parsedHeading.dateText ? `<span class="changelog-version-date">${escapeMarkdownHtml(parsedHeading.dateText)}</span>` : '';
        const latestTagHtml = isLatest ? '<span class="changelog-version-latest">最新版本</span>' : '';
        const currentTagHtml = isCurrent ? '<span class="changelog-version-current">当前版本</span>' : '';
        const versionMetaHtml = (latestTagHtml || currentTagHtml) ? `<div class="changelog-version-meta">${latestTagHtml}${currentTagHtml}</div>` : '';
        const bodyHtml = renderChangelogSectionBody(section.bodyLines);
        const bodyWrapHtml = bodyHtml ? `<div class="changelog-version-body">${bodyHtml}</div>` : '';
        htmlParts.push(`<div class="changelog-version-row${isCurrent ? ' is-current' : ''}${isLatest ? ' is-latest' : ''}">
				<div class="changelog-version-head">
					<div class="changelog-version-main">
						<span class="changelog-version-badge">${escapeMarkdownHtml(badgeText)}</span>
						${dateHtml}
					</div>
					${versionMetaHtml}
				</div>
				${bodyWrapHtml}
			</div>`);
    }
    return {
        html: htmlParts.join(''),
        versionEntryCount,
        currentVersionPosition,
        currentVersionHeadingText,
        currentVersionDisplayText
    };
}

function formatVersionChangelogTime(timestamp) {
    if (!timestamp || !Number.isFinite(timestamp)) {
        return '';
    }
    return new Date(timestamp).toLocaleString('zh-CN', {
        hour12: false
    });
}
async function loadVersionChangelog(forceReload = false) {
    const contentEl = document.getElementById('versionChangelogContent');
    if (!contentEl) return;
    if (!forceReload && cachedChangelogRawText) {
        const renderResult = renderChangelogMarkdown(cachedChangelogRawText);
        contentEl.innerHTML = renderResult.html || '<p class="version-changelog-placeholder">暂无更新日志内容。</p>';
        const cachedAtText = formatVersionChangelogTime(cachedChangelogLoadedAt);
        if (cachedAtText) {
            console.log(`[请求RAW] 使用缓存更新日志，上次加载时间=${cachedAtText}`);
        } else {
            console.log('[请求RAW] 使用缓存更新日志');
        }
        if (renderResult.currentVersionPosition > 0) {
            console.log(`[更新日志] 当前版本定位成功: ${renderResult.currentVersionDisplayText || '当前版本'} 命中 ${renderResult.currentVersionHeadingText || ''}，位于第${renderResult.currentVersionPosition}条（共${renderResult.versionEntryCount}条）`);
        } else if (renderResult.versionEntryCount > 0) {
            console.log(`[更新日志] 当前版本未匹配到日志条目: ${renderResult.currentVersionDisplayText || '未知版本'}，日志共${renderResult.versionEntryCount}条`);
        }
        return;
    }
    if (pendingChangelogLoadPromise) {
        return pendingChangelogLoadPromise;
    }
    console.log('[请求RAW] 进度: 正在拉取更新日志');
    contentEl.innerHTML = '<p class="version-changelog-placeholder">正在加载更新日志...</p>';
    pendingChangelogLoadPromise = (async () => {
        try {
            const changelogText = await fetchWithAutoMirror(CHANGELOG_RAW_URL + '?_t=' + Date.now(), '更新日志');
            cachedChangelogRawText = changelogText;
            cachedChangelogLoadedAt = Date.now();
            const renderResult = renderChangelogMarkdown(changelogText);
            contentEl.innerHTML = renderResult.html || '<p class="version-changelog-placeholder">暂无更新日志内容。</p>';
            console.log(`[请求RAW] 成功: 更新日志已加载，时间=${formatVersionChangelogTime(cachedChangelogLoadedAt)}`);
            if (renderResult.currentVersionPosition > 0) {
                console.log(`[更新日志] 当前版本定位成功: ${renderResult.currentVersionDisplayText || '当前版本'} 命中 ${renderResult.currentVersionHeadingText || ''}，位于第${renderResult.currentVersionPosition}条（共${renderResult.versionEntryCount}条）`);
            } else if (renderResult.versionEntryCount > 0) {
                console.log(`[更新日志] 当前版本未匹配到日志条目: ${renderResult.currentVersionDisplayText || '未知版本'}，日志共${renderResult.versionEntryCount}条`);
            }
        } catch (error) {
            console.error('[请求RAW] 更新日志拉取失败:', error);
            contentEl.innerHTML = '<p class="version-changelog-placeholder">更新日志拉取失败，请稍后重试。</p>';
            showToast('更新日志加载失败: ' + error.message, 'error');
        } finally {
            pendingChangelogLoadPromise = null;
        }
    })();
    return pendingChangelogLoadPromise;
}
async function openVersionChangelogModal() {
    closeVersionInfoModal();
    const modal = document.getElementById('versionChangelogModal');
    if (!modal) return;
    modal.classList.add('show');
    await loadVersionChangelog(false);
}

function closeVersionChangelogModal(event) {
    if (event && event.target.id !== 'versionChangelogModal') return;
    const modal = document.getElementById('versionChangelogModal');
    if (modal) {
        modal.classList.remove('show');
    }
}
// 初始化增强型文本编辑器
function initLineEditor(textareaId) {
    const ta = document.getElementById(textareaId);
    if (!ta) return;
    const container = ta.closest('.line-editor');
    if (!container) return;
    const lineNumbers = container.querySelector('.gutter pre');
    const lineShades = container.querySelector('.line-shades');
    if (!lineNumbers || !lineShades) return;
    const lineHeight = Number.parseFloat(getComputedStyle(ta).lineHeight) || 24;
    const isWrapping = container.classList.contains('line-editor-wrap');
    const editorArea = container.querySelector('.editor-area');
    const wrapMeasure = isWrapping && editorArea ? document.createElement('div') : null;
    let renderedLineCount = -1;
    let renderedShadeCount = -1;
    let renderedValue = null;
    let renderedWidth = -1;
    let wrappedLineHeights = [];
    let wrappedContentHeight = 0;
    let renderFrame = 0;
    if (wrapMeasure) {
        wrapMeasure.className = 'wrap-measure';
        wrapMeasure.setAttribute('aria-hidden', 'true');
        editorArea.appendChild(wrapMeasure);
    }

    function countLines(value) {
        if (!value) return 0;
        const breaks = value.match(/\r\n|\r|\n/g);
        return breaks ? breaks.length + 1 : 1;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderStraightMeta() {
        const value = ta.value || '';
        const lineCount = countLines(value);
        const displayLines = Math.max(1, lineCount);
        if (displayLines !== renderedLineCount) {
            renderedLineCount = displayLines;
            lineNumbers.textContent = Array.from({
                length: displayLines
            }, (_, index) => index + 1).join('\n');
        }
        const visibleLines = Math.ceil((ta.clientHeight || 300) / lineHeight) + 2;
        const shadeCount = Math.max(displayLines, visibleLines);
        if (shadeCount !== renderedShadeCount) {
            renderedShadeCount = shadeCount;
            lineShades.innerHTML = Array.from({
                length: shadeCount
            }, () => '<div class="shade-line"></div>').join('');
        }
    }

    function renderWrappedMeta() {
        if (!wrapMeasure) {
            renderStraightMeta();
            return;
        }
        const value = ta.value || '';
        const width = ta.clientWidth || ta.offsetWidth || 0;
        if (value !== renderedValue || width !== renderedWidth) {
            const lines = value.split(/\r\n|\r|\n/);
            const displayLines = lines.length ? lines : [''];
            renderedValue = value;
            renderedWidth = width;
            renderedLineCount = displayLines.length;
            wrapMeasure.style.width = width ? `${width}px` : '100%';
            wrapMeasure.innerHTML = displayLines.map((line) => `<div class="wrap-measure-line">${escapeHtml(line) || ' '}</div>`).join('');
            wrappedLineHeights = Array.from(wrapMeasure.children).map((line) => Math.max(lineHeight, line.offsetHeight));
            wrappedContentHeight = wrappedLineHeights.reduce((sum, height) => sum + height, 0);
            lineNumbers.innerHTML = wrappedLineHeights.map((height, index) => `<span class="gutter-line" style="height:${height}px">${index + 1}</span>`).join('');
            renderedShadeCount = -1;
        }
        const visibleHeight = Math.max(0, (ta.clientHeight || 300) - lineHeight);
        const fillerLines = Math.max(0, Math.ceil((visibleHeight - wrappedContentHeight) / lineHeight) + 1);
        const shadeCount = wrappedLineHeights.length + fillerLines;
        if (shadeCount !== renderedShadeCount) {
            renderedShadeCount = shadeCount;
            const contentShades = wrappedLineHeights.map((height) => `<div class="shade-line" style="height:${height}px"></div>`).join('');
            const fillerShades = Array.from({
                length: fillerLines
            }, () => '<div class="shade-line"></div>').join('');
            lineShades.innerHTML = contentShades + fillerShades;
        }
    }

    function renderMeta() {
        if (isWrapping) {
            renderWrappedMeta();
        } else {
            renderStraightMeta();
        }
        syncScroll();
    }

    function scheduleRender() {
        cancelAnimationFrame(renderFrame);
        renderFrame = requestAnimationFrame(() => {
            renderFrame = 0;
            renderMeta();
        });
    }

    function syncScroll() {
        const offset = `translate3d(0, ${-ta.scrollTop}px, 0)`;
        lineNumbers.style.transform = offset;
        lineShades.style.transform = offset;
    }
    // 监听输入、滚动
    ta.addEventListener('input', scheduleRender);
    ta.addEventListener('scroll', syncScroll);
    // 监听高度变化（ResizeObserver），解决拖拽角标后的同步问题
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(scheduleRender);
        ro.observe(ta);
    }
    // 窗口缩放时也刷新一下
    window.addEventListener('resize', scheduleRender);
    // 暴露渲染函数
    ta._refreshLineEditor = renderMeta;
    // 初始渲染
    renderMeta();
}