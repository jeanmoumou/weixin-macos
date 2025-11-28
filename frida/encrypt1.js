/**
 * wechat_method_finder.js
 * 目标: 批量挂钩微信主程序 (WeChat.app) 中所有与消息/加密相关的 Objective-C 方法。
 * 作用: 找到微信内部封装的消息发送、接收、加解密逻辑的“入口”类和方法。
 */

// 定义您认为可能包含消息处理或加解密逻辑的类名关键词
const TARGET_KEYWORDS = [
    "Message", "Data", "Encry", "Crypt",
    "Send", "Recv", "Net", "Session",
    "Pack", "Unpack", "PB" // Protobuf相关的类
];

// -------------------------------------------------------------------
// 核心挂钩逻辑
// -------------------------------------------------------------------

function hookWeChatMethods() {
    if (!ObjC.available) {
        console.error("[-] Objective-C 运行时不可用，无法进行 ObjC 方法挂钩。");
        return;
    }

    let hooksCount = 0;
    const targetModule = Process.findModuleByName("WeChat"); // 仅关注主二进制文件

    if (!targetModule) {
        console.error("[-] 微信主模块 'WeChat' 未找到。");
        return;
    }

    console.log(`[+] 目标模块: ${targetModule.name} (${targetModule.base})`);
    console.log(`[+] 正在筛选包含关键词的 Objective-C 类: ${TARGET_KEYWORDS.join(', ')}...`);

    // 遍历所有已加载的 Objective-C 类
    Object.keys(ObjC.classes).forEach(className => {
        // 确保类位于 'WeChat' 主模块内 (避免挂钩系统库)
        const classPtr = ObjC.classes[className].handle;
        if (!targetModule.base.le(classPtr) || !targetModule.base.add(targetModule.size).gt(classPtr)) {
            return; // 跳过不在 WeChat 模块内的类
        }

        // 筛选包含关键词的类
        const matchesKeyword = TARGET_KEYWORDS.some(keyword => className.includes(keyword));
        if (matchesKeyword) {

            const targetClass = ObjC.classes[className];
            console.log(`\n[*** FOUND CLASS ***] ${className}`);

            // 遍历并挂钩该类的所有方法 (包括实例方法和类方法)
            [...targetClass.$methods].forEach(methodName => {

                try {
                    const method = targetClass[methodName];
                    const methodSignature = (methodName.startsWith('+')) ? `[Class] ${methodName}` : `[Instance] ${methodName}`;

                    Interceptor.attach(method.implementation, {

                        onEnter: function (args) {
                            // 使用 this.className 和 this.methodName 存储信息以便 onLeave 使用
                            this.className = className;
                            this.methodName = methodName;

                            console.log(`\n${"~".repeat(80)}`);
                            console.log(`[CALL] Class: **${this.className}**`);
                            console.log(`[CALL] Method: **${methodSignature}**`);

                            // 打印回溯，这正是找到函数入口的关键
                            console.log("[ENTRY POINT] Call Stack (寻找更上层的业务逻辑入口):");
                            console.log(
                                Thread.backtrace(this.context, Backtracer.ACCURATE)
                                    .map(DebugSymbol.fromAddress).join('\n')
                            );
                            // 打印参数 (由于参数类型未知，我们只打印前几个指针)
                            // 注意：args[0] = self (this), args[1] = _cmd (selector)
                            console.log(`[ARGS] Argument 3 (args[2]): ${args[2]}`);
                            if (args.length > 3) {
                                console.log(`[ARGS] Argument 4 (args[3]): ${args[3]}`);
                            }
                        },

                        onLeave: function (retval) {
                            console.log(`[EXIT POINT] ${methodSignature} Returned: ${retval}`);
                            console.log("~".repeat(80));
                        }
                    });

                    hooksCount++;

                } catch (e) {
                    // console.error(`Error hooking ${className}.${methodName}: ${e.message}`);
                }
            });
        }
    });

    console.log(`[+] 总共挂钩了 ${hooksCount} 个方法。开始在微信中发送/接收消息。`);
}

// 启动挂钩
hookWeChatMethods();