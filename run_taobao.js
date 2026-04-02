const { JSDOM } = require("jsdom");
const fs = require("fs");

// 1. 初始化 JSDOM (移除 ResourceLoader，使用 pretendToBeVisual 模拟视觉特征)
const dom = new JSDOM(`<!DOCTYPE html><html><head><title>Taobao</title></head><body><div id="J_SiteNav"></div></body></html>`, {
    url: "https://s.taobao.com/search?q=%E6%89%8B%E6%9C%BA",
    referrer: "https://www.taobao.com/",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    runScripts: "dangerously",
    pretendToBeVisual: true 
});

const { window } = dom;

// 2. 深度特征伪造 (直接挂载到 JSDOM 的 window 上)
// 伪造 webdriver (必须是 false，不能抛出异常)
Object.defineProperty(window.navigator, 'webdriver', { get: () => false });
Object.defineProperty(window.navigator, 'languages', { get: () => ['zh-CN', 'zh'] });
Object.defineProperty(window.navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
window.chrome = { app: {}, runtime: {} };

// 伪造 Screen
Object.defineProperties(window.screen, {
    width: { get: () => 1920 },
    height: { get: () => 1080 },
    availWidth: { get: () => 1920 },
    availHeight: { get: () => 1040 },
    colorDepth: { get: () => 24 },
    pixelDepth: { get: () => 24 }
});

// 伪造 WebGL (VMP 重点检测的硬件指纹)
const originalGetContext = window.HTMLCanvasElement.prototype.getContext;
window.HTMLCanvasElement.prototype.getContext = function(type, attributes) {
    if (type === 'webgl' || type === 'experimental-webgl') {
        return {
            getParameter: function(p) {
                if (p === 37445) return "Apple Inc."; // UNMASKED_VENDOR_WEBGL
                if (p === 37446) return "Apple M3";    // UNMASKED_RENDERER_WEBGL
                if (p === 7937) return "WebGL 1.0 (OpenGL ES 2.0 Chromium)";
                if (p === 35661) return 128; // MAX_COMBINED_TEXTURE_IMAGE_UNITS
                if (p === 34047) return 16;  // MAX_DRAW_BUFFERS
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

// 伪造 toString 防止原生函数被检测出是 Mock 的
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

console.log("🚀 加密引擎初始化中...");

try {
    // 【核心秘诀】：放弃 vm 模块，直接使用 window.eval！
    // 保证所有的原型链 (Prototype Chain) 都在 JSDOM 内部，不触发 VMP 的跨上下文检测！
    window.eval(taobaoCode);

    // 触发加载事件，激活 VMP 状态机
    console.log("📡 触发 DOMContentLoaded...");
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    window.dispatchEvent(new window.Event('load'));
    
    // 模拟鼠标轨迹 (Sufei 算法需要收集鼠标熵值来生成加密矩阵)
    let moveCount = 0;
    const moveTimer = setInterval(() => {
        const x = 100 + moveCount * 10;
        const y = 200 + Math.random() * 50;
        const ev = new window.MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true });
        window.document.dispatchEvent(ev);
        
        if (++moveCount > 20) {
            clearInterval(moveTimer);
            const clickEv = new window.MouseEvent('click', { clientX: x, clientY: y, bubbles: true });
            window.document.dispatchEvent(clickEv);
        }
    }, 50);

    // 轮询检查 ISG 是否生成成功
    let checkCount = 0;
    const checkISG = setInterval(() => {
        checkCount++;
        const cookie = window.document.cookie || "";
        const isgMatch = cookie.match(/isg=([^;]+)/);
        const currentIsg = isgMatch ? isgMatch[1] : window.isg;

        if (currentIsg && currentIsg.length > 20) {
            console.log("\n--- ✨ 签名矩阵已激活 ---");
            console.log("ISG (Security Guard):", currentIsg);
            
            if (window.LTKSign) {
                const token = "abcdef1234567890abcdef1234567890";
                const t = Date.now().toString();
                const appKey = "12574478";
                const data = '{"item":"1"}';
                const sig = window.LTKSign(token, t, appKey, data);
                console.log("LTKSign Result:", sig);
            }
            
            if (window.etSign) {
                const et = window.etSign("event_123");
                console.log("etSign (bx-et):", String(et).substring(0, 50) + "...");
            }

            clearInterval(checkISG);
            process.exit(0);
        }

        if (checkCount > 20) { // 10秒超时
            console.log("⚠️ 超过 10 秒未捕获到 ISG，可能存在环境指纹泄露");
            console.log("当前 Cookie:", cookie);
            
            if (window.LTKSign) {
                console.log("LTKSign 状态码:", window.LTKSign("1", "2", "3", "4"));
            }
            clearInterval(checkISG);
            process.exit(1);
        }
    }, 500);

} catch (e) {
    console.error("❌ 执行崩溃:", e);
}