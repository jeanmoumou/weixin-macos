// ======================
// 安全参数打印
// ======================
function safePrintArg(ptr) {
    try {
        if (!ptr || ptr.isNull()) return "<null>";

        // 如果能包装成 ObjC 对象
        try {
            try {
                let o = new ObjC.Object(args[0]);
                console.log(o.$className);

                desc = o.toString();
                if (desc.length > 300) desc = desc.slice(0, 300) + "...<truncated>";
                return `[${cls}] ${desc}`;
            } catch (_) {
                console.log("raw:", args[0]);
            }
        } catch (_) {
            // 不能包装成 OC 对象，则返回 pointer 地址
            return ptr.toString();
        }

    } catch (e) {
        return `<print-error: ${e}>`;
    }
}

// ======================
// Hook 方法工具
// ======================
function hookMethod(clsName, methodName) {
    try {
        const cls = ObjC.classes[clsName];
        if (!cls) return;

        const method = cls[methodName];
        if (!method || !method.implementation) return;

        console.log(`\n🔥 Hooking ${clsName} ${methodName}`);
        Interceptor.attach(method.implementation, {
            onEnter(args) {
                console.log(`\n🚀 ${clsName} ${methodName} called`);

                // 打印参数 x0~x5
                for (let i = 0; i < 6; i++) {
                    try {
                        console.log(`arg[${i}]: ${safePrintArg(args[i])}`);
                    } catch (e) {
                        console.log(`arg[${i}]: <error ${e}>`);
                    }
                }
            },
            onLeave(retval) {
                console.log(`⬅️ return: ${safePrintArg(retval)}`);
            }
        });
    } catch (e) {
        console.log(`❌ Hook ${clsName} ${methodName} failed: ${e}`);
    }
}

// ======================
// WeChat 消息加密关键入口列表
// ======================
const HOOK_TARGETS = [
    ["WCMessageWrap", "- protobufEncode"],
    ["WCMessageWrap", "- serialize"],

    // 发送消息必走
    ["WCProtoBuf", "- encodeMessage:"],
    ["WCProtoBuf", "- data"],

    // 尝试抓取 key/data
    ["MMEncryptMessage", "- encryptMessage:key:"],
    ["WCEncryptHelper", "- encrypt:withKey:"],
    ["WCEncryptHelper", "- encryptData:key:"],

    // 发送消息必走路径
    ["WCMessageMgr", "- SendAppMsg:"],
    ["WCMessageMgr", "- SendTextMessage:"],
    ["WCMessageMgr", "- SendImageMessage:"],

    // 底层 protobuf builder
    ["PBGeneratedMessage", "- data"],
    ["PBGeneratedMessage", "- serialize"],

    // 经常出现的 encode 函数
    ["MMProtoBase", "- serialize"],
    ["MMProtoBase", "- encode"]
];

// ======================
// 挂钩所有关键点
// ======================
function hookAll() {
    console.log("🚀 WeChat 上层加密 Hook 正在启动...\n");

    HOOK_TARGETS.forEach(([cls, method]) => {
        hookMethod(cls, method);
    });

    // 额外扫描所有类名包含 Encode 或 Message 的 class
    console.log("\n🔍 自动扫描 Encode / Message 类...");
    for (const name in ObjC.classes) {
        if (!name.includes("Encode") && !name.includes("Message")) continue;

        const cls = ObjC.classes[name];
        const methods = cls.$ownMethods;

        methods.forEach(m => {
            if (m.includes("encode") || m.includes("Encrypt") || m.includes("serialize")) {
                hookMethod(name, m);
            }
        });
    }

    console.log("\n🎉 Hook 完成，开始抓取 WeChat 消息明文 / proto / encrypt 信息...\n");
}

// ======================
if (ObjC.available) {
    hookAll();
} else {
    setTimeout(hookAll, 1000);
}
