const { JSDOM } = require("jsdom");
const fs = require("fs");

// 1. 初始化 JSDOM (加入 seed.js 消除 KISSY 警告)
const dom = new JSDOM(`<!DOCTYPE html><html><head>
    <title>Taobao</title>
    <script src="https://g.alicdn.com/kissy/k/6.2.4/seed.js"></script>
</head><body><div id="J_SiteNav"></div></body></html>`, {
    url: "https://s.taobao.com/search?q=%E6%89%8B%E6%9C%BA",
    referrer: "https://www.taobao.com/",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    runScripts: "dangerously",
    pretendToBeVisual: true 
});

const { window } = dom;

// 2. 深度特征伪造
Object.defineProperty(window.navigator, 'webdriver', { get: () => false });
Object.defineProperty(window.navigator, 'languages', { get: () => ['zh-CN', 'zh'] });
Object.defineProperty(window.navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
window.chrome = { app: {}, runtime: {} };

Object.defineProperties(window.screen, {
    width: { get: () => 1920 }, height: { get: () => 1080 },
    availWidth: { get: () => 1920 }, availHeight: { get: () => 1040 },
    colorDepth: { get: () => 24 }, pixelDepth: { get: () => 24 }
});

// WebGL 伪造
const originalGetContext = window.HTMLCanvasElement.prototype.getContext;
window.HTMLCanvasElement.prototype.getContext = function(type, attributes) {
    if (type === 'webgl' || type === 'experimental-webgl') {
        return {
            getParameter: function(p) {
                if (p === 37445) return "Apple Inc."; 
                if (p === 37446) return "Apple M3";    
                if (p === 7937) return "WebGL 1.0 (OpenGL ES 2.0 Chromium)";
                if (p === 35661) return 128; 
                if (p === 34047) return 16;  
                return 0;
            },
            getExtension: function(ext) {
                if (ext === 'WEBGL_debug_renderer_info') return {};
                return { loseContext: () => {} };
            },
            getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
            createBuffer: () => ({}), bindBuffer: () => {}, bufferData: () => {},
            clearColor: () => {}, clear: () => {}, enable: () => {}, depthFunc: () => {}
        };
    }
    return originalGetContext.apply(this, arguments);
};

const originalToString = window.Function.prototype.toString;
window.Function.prototype.toString = function() {
    if (this === window.Function.prototype.toString) return "function toString() { [native code] }";
    if (this.name && ['getContext', 'getParameter', 'getExtension'].includes(this.name)) {
        return `function ${this.name}() { [native code] }`;
    }
    return originalToString.call(this);
};

// 3. 读取并执行代码
const taobaoCode = fs.readFileSync("./taobao_assets.js", "utf-8");

console.log("🚀 启动纯净沙箱，正在加载 VMP 引擎...");

try {
    // 运行淘宝脚本
    window.eval(taobaoCode);

    console.log("📡 触发 DOMContentLoaded，注入真人轨迹...");
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    window.dispatchEvent(new window.Event('load'));
    
    // 注入鼠标轨迹熵值
    let moveCount = 0;
    const moveTimer = setInterval(() => {
        const x = 100 + moveCount * 10;
        const y = 200 + Math.random() * 50;
        window.document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
        
        if (++moveCount > 20) {
            clearInterval(moveTimer);
            window.document.dispatchEvent(new window.MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
        }
    }, 50);

    // 轮询提取 ISG
    let checkCount = 0;
    const checkISG = setInterval(() => {
        checkCount++;
        const cookie = window.document.cookie || "";
        const isgMatch = cookie.match(/isg=([^;]+)/);
        const currentIsg = isgMatch ? isgMatch[1] : window.isg;

        if (currentIsg && currentIsg.length > 20) {
            console.log("\n✅ --- 签名矩阵解冻成功 --- ✅");
            console.log("🎯 成功获取 ISG 令牌:");
            console.log("\x1b[32m%s\x1b[0m", currentIsg); // 绿色高亮打印
            console.log("\n(注: 此脚本为 sufei_data，仅负责生成 isg。LTKSign 需加载 awsc.js)");
            
            clearInterval(checkISG);
            process.exit(0);
        }

        if (checkCount > 20) {
            console.log("⚠️ 提取超时，请检查网络或脚本完整性");
            clearInterval(checkISG);
            process.exit(1);
        }
    }, 500);

} catch (e) {
    console.error("❌ 执行崩溃:", e);
}