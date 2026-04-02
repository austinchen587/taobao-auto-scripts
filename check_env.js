const { JSDOM } = require("jsdom");
try {
    const { createCanvas } = require("canvas");
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext('2d');
    ctx.fillText("Check", 50, 50);
    
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    console.log("✅ [Canvas] 渲染测试通过");
    console.log("✅ [JSDOM] 浏览器环境模拟通过");
    console.log("🚀 你的 MacBook M3 已经准备好处理淘宝的 VMP 逻辑了！");
} catch (e) {
    console.error("❌ 环境检测失败:", e.message);
}