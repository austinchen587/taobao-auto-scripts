const { JSDOM } = require("jsdom");
const fs = require("fs");

// 1. 建立基础环境
const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
    url: "https://www.taobao.com/",
    referrer: "https://www.taobao.com/"
});

const { window } = dom;

// 2. 关键：彻底伪装 Node 痕迹，防止递归陷阱
// 删除 Node 特有的全局变量，让脚本以为自己在纯净浏览器里
delete global.process;
delete global.global;
delete global.Buffer;
delete global.setImmediate;
delete global.clearImmediate;

// 3. 补全浏览器核心对象
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.location = window.location;
global.screen = window.screen;
global.performance = window.performance;
global.Image = window.Image;
global.history = window.history;

// 屏蔽某些可能被检测的函数
global.console.debug = function(){};

// 4. 解决 KISSY 的加载校验
const scriptTag = document.createElement("script");
scriptTag.src = "https://g.alicdn.com/??kissy/k/6.2.4/seed.js";
document.head.appendChild(scriptTag);

// 5. 模拟 define (简化版，减少递归风险)
global.define = function(name, deps, factory) {
    // 很多模块其实不需要立即执行，我们先记录下来
    if (typeof factory === 'function') {
        // 只有核心模块才尝试运行，或者干脆空转
    }
};

// 6. 模拟淘宝配置
global.g_config = { jstracker2: { sampling: 1 } };

console.log("🚀 正在注入代码 (尝试跳过检测陷阱)...");

try {
    const code = fs.readFileSync("./taobao_assets.js", "utf-8");
    
    // 注入一段前置代码，防止它检测到我们是模拟器
    const prefix = `
        (function() {
            var _toString = Function.prototype.toString;
            Function.prototype.toString = function() {
                if (this === Function.prototype.toString) return _toString.call(_toString);
                return _toString.call(this);
            };
        })();
    `;
    
    // 执行代码
    const finalCode = prefix + code;
    
    // 使用 Function 构造器运行，避免作用域污染导致的递归
    new Function(finalCode)();
    
    console.log("✅ 代码执行完毕");
} catch (e) {
    console.error("❌ 报错详情:", e.stack.split('\n').slice(0, 5).join('\n'));
}

// 7. 提取结果
setTimeout(() => {
    // 淘宝代码运行后，会尝试在 window 下挂载各种对象
    const results = {
        isg: window.isg,
        _m_h5_tk: document.cookie.match(/_m_h5_tk=([^;]+)/),
        KISSY: !!global.KISSY
    };
    console.log("--- 提取到的指纹/变量 ---");
    console.log(results);
}, 1000);