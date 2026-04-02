const { JSDOM } = require("jsdom");
const fs = require("fs");
const vm = require("vm");

// 1. 深度模拟淘宝浏览器环境
const dom = new JSDOM(`<!DOCTYPE html><html><head>
    <script id="kissy-seed" src="https://g.alicdn.com/??kissy/k/6.2.4/seed-min.js,kg/global-util/1.0.7/index-min.js"></script>
</head><body><div id="J_SiteNav"></div></body></html>`, {
    url: "https://www.taobao.com/", 
    referrer: "https://www.taobao.com/",
    runScripts: "dangerously"
});

const { window } = dom;

// 2. 伪装 Navigator
Object.defineProperties(window.navigator, {
    webdriver: { get: () => undefined },
    languages: { get: () => ['zh-CN', 'zh'] },
    platform: { get: () => 'MacIntel' }
});

// ★ 核心修复：伪造完美的 performance.timing，防止 VMP 初始化崩溃 ★
const now = Date.now();
const mockPerformance = window.performance || {};
mockPerformance.timing = {
    navigationStart: now - 5000,
    fetchStart: now - 5000,
    domainLookupStart: now - 4000,
    domainLookupEnd: now - 3900,
    connectStart: now - 3800,
    connectEnd: now - 3700,
    requestStart: now - 3600,
    responseStart: now - 3500,
    responseEnd: now - 3400,
    domLoading: now - 3000,
    domInteractive: now - 2000,
    domContentLoadedEventStart: now - 1500,
    domContentLoadedEventEnd: now - 1500,
    domComplete: now - 500,
    loadEventStart: now - 100, // 刚才就是死在这里
    loadEventEnd: now
};
mockPerformance.getEntriesByType = () => [];
mockPerformance.getEntriesByName = () => [];
mockPerformance.getEntries = () => [];

// 3. 构建沙箱上下文
const context = {
    window: window,
    document: window.document,
    navigator: window.navigator,
    location: window.location,
    screen: window.screen,
    performance: mockPerformance, // 使用伪造的 performance
    history: window.history,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    MutationObserver: window.MutationObserver,
    console: console,
    Image: window.Image,
    Date: Date,
    Math: Math,
    
    "currentScript": window.document.getElementById("kissy-seed"),

    define: function(id, deps, factory) {
        let f = typeof factory === 'function' ? factory : (typeof deps === 'function' ? deps : id);
        if (typeof f === 'function') { try { f(); } catch(e) {} }
    },

    PerformanceObserver: class {
        constructor(cb) { this.cb = cb; }
        observe() { if(this.cb) this.cb({ getEntries: () => [] }); }
        disconnect() {}
        takeRecords() { return []; }
    },

    MessageChannel: class {
        constructor() {
            this.port1 = { onmessage: null, close: () => {} };
            this.port2 = { postMessage: (d) => { if(this.port1.onmessage) this.port1.onmessage({data:d}); } };
        }
    },

    AWSC: {
        use: (n, cb) => setTimeout(() => cb("timeout", null), 10),
        configFY: () => {},
        configFYSync: () => ({})
    }
};

window.define = context.define;
window.PerformanceObserver = context.PerformanceObserver;

const taobaoCode = fs.readFileSync("./taobao_assets.js", "utf-8");

const patch = `
    window.process = undefined;
    window.Buffer = undefined;
    (function(){
        var _toString = Function.prototype.toString;
        Function.prototype.toString = function() {
            if (this === Function.prototype.toString) return "function toString() { [native code] }";
            return _toString.call(this);
        };
    })();
`;

console.log("🚀 正在注入沙箱并启动逻辑...");

try {
    vm.createContext(context);
    vm.runInContext(patch + taobaoCode, context, {
        filename: 'taobao_assets.js',
        timeout: 10000
    });
    
    console.log("✅ 脚本注入成功。已补全 timing 数据，等待 VMP 激活 (预留 3 秒)...");

    setTimeout(() => {
        console.log("\n--- 提取测试结果 ---");
        
        const testToken = "1234567890abcdef1234567890abcdef";
        const testT = Date.now().toString();
        const testAppKey = "12574478";
        const testData = '{"itemId":"10001"}';

        if (context.window.LTKSign) {
            const res = context.window.LTKSign(testToken, testT, testAppKey, testData);
            console.log("LTKSign (Sign):", res);
        }

        if (context.window.etSign) {
            const res = context.window.etSign("event_id_123");
            const strRes = String(res);
            console.log("etSign (bx-et):", strRes.length > 60 ? strRes.substring(0, 60) + "..." : strRes);
        }

        console.log("ISG:", context.window.isg || "未生成");
    }, 3000);

} catch (e) {
    console.error("❌ 运行时异常:", e.message);
}