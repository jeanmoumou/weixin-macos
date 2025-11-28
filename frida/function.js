// ====== 配置：你想 Hook 的 WeChat 函数偏移 ======
const WECHAT_OFFSETS = [
    0x4565b2c,
    0x4566f1c,
    0x4564860,
    0x4591ff8,
    0x45d09cc,
    0x45cebbc,
    0x4591fa0,
    0x4581834,
    0x4581760,
    0x4387d08,
    0x4334e88,
    0x4328ebc,
    0x4384764,
    0x43811e8
];

// ====== 统一安全打印函数 ======
function safePrintRegister(args) {
    for (let i = 0; i < 8; i++) {
        try {
            console.log(`x${i}: ${args[i]}`);
        } catch (e) {
            console.log(`x${i}: <无法读取> (${e})`);
        }
    }
}

function safePrintBacktrace(context) {
    try {
        let bt = Thread.backtrace(
            context,
            Backtracer.FUZZY       // 更稳定，遇到系统函数更不容易崩
        ).map(DebugSymbol.fromAddress)
            .join("\n");

        console.log("\n--- 调用堆栈 ---");
        console.log(bt);
        console.log("-----------------\n");

    } catch (e) {
        console.log("无法获取堆栈：" + e);
    }
}

// ====== 主逻辑：Hook 偏移量函数 ======
function hook_wechat_internal_functions() {
    const wechatModule = Process.findModuleByName("WeChat");
    if (!wechatModule) {
        console.error("❌ 找不到 WeChat 模块");
        return;
    }

    const base = wechatModule.base;
    console.log("📌 WeChat Base:", base);

    WECHAT_OFFSETS.forEach(offset => {
        const target = base.add(offset);

        // 尝试符号化
        let funcName = `WeChat!0x${offset.toString(16)}`;
        try {
            const sym = DebugSymbol.fromAddress(target);
            if (sym && sym.name) funcName = sym.name;
        } catch (_) {}

        console.log(`\n🔧 准备 Hook: ${funcName} @ 0x${target}`);

        try {
            Interceptor.attach(target, {
                onEnter(args) {
                    console.log("\n==============================================");
                    console.log(`🚀 进入函数: ${funcName}`);
                    console.log(`📍 地址: 0x${target}`);

                    console.log("\n--- 🧩 寄存器参数 x0-x7 ---");
                    safePrintRegister(args);

                    console.log("\n--- 🧵 调用堆栈 ---");
                    safePrintBacktrace(this.context);

                    console.log("==============================================\n");
                },

                onLeave(retval) {
                    // 如果需要打印返回值，可打开：
                    // console.log("返回值:", retval);
                }
            });

            console.log(`✅ 已 Hook: ${funcName}`);

        } catch (e) {
            console.error(`❌ Hook 失败 @ 0x${target} ：${e}`);
        }
    });
}

// ====== 入口 ======
setImmediate(() => {
    hook_wechat_internal_functions();
});
