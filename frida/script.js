// 1. 获取微信主模块的基地址
var baseAddr = Process.getModuleByName("WeChat").base;
if (!baseAddr) {
    console.log("[!] 找不到 WeChat 模块基址，请检查进程名。");
}
console.log("[*] WeChat base address: " + baseAddr);

// 假设 0x10444A99C 是相对于 0x100000000 的地址
const triggerFuncAddr = baseAddr.add(0x444A99C);

// 定义一个全局变量用于保存 X0 的指针
var globalMessagePtr = ptr(0);

var cgiAddr = ptr(0);
var callBackFuncAddr = ptr(0);
var sendMessageAddr = ptr(0);
var messageAddr = ptr(0);
var messageContentAddr = ptr(0);
var messageAddrAddr = ptr(0);
var contentAddr = ptr(0);

var insertMsgAddr = ptr(0);

var taskId = 0x20000090

function printAddr() {
    console.log("[*] Addresses:");
    console.log("    - cgiAddr: " + cgiAddr);
    console.log("    - callBackFuncAddr: " + callBackFuncAddr);
    console.log("    - sendMessageAddr: " + sendMessageAddr);
    console.log("    - messageAddr: " + messageAddr);
    console.log("    - messageContentAddr: " + messageContentAddr);
    console.log("    - messageAddrAddr: " + messageAddrAddr);
    console.log("    - contentAddr: " + contentAddr);
    console.log("    - globalMessagePtr: " + globalMessagePtr);
}

// 辅助函数：写入 Hex 字符串
function patchHex(addr, hexStr) {
    const bytes = hexStr.split(' ').map(h => parseInt(h, 16));
    addr.writeByteArray(bytes);
    addr.add(bytes.length).writeU8(0); // 终止符
}

function setupSendMessageDynamic() {
    console.log("[*] Starting Dynamic Message Patching...");

    // 1. 动态分配内存块（按需分配大小）
    // 分配原则：字符串给 64-128 字节，结构体按实际大小分配
    cgiAddr = Memory.alloc(128);
    callBackFuncAddr = Memory.alloc(16);
    sendMessageAddr = Memory.alloc(256);
    messageAddr = Memory.alloc(512);
    messageContentAddr = Memory.alloc(32);
    messageAddrAddr = Memory.alloc(32);
    contentAddr = Memory.alloc(255);


    // A. 写入字符串内容
    patchHex(cgiAddr, "2F 63 67 69 2D 62 69 6E 2F 6D 69 63 72 6F 6D 73 67 2D 62 69 6E 2F 6E 65 77 73 65 6E 64 6D 73 67");
    patchHex(contentAddr, " ");

    // B. 构建 SendMessage 结构体 (X24 基址位置)
    sendMessageAddr.add(0x00).writeU64(0);
    sendMessageAddr.add(0x08).writeU64(0);
    sendMessageAddr.add(0x10).writePointer(baseAddr.add(0xEDB4678)); // 虚表地址通常仍需硬编码或从模块基址计算
    sendMessageAddr.add(0x18).writeU64(1);
    sendMessageAddr.add(0x20).writeU32(taskId);
    sendMessageAddr.add(0x28).writePointer(messageAddr); // 指向动态分配的 Message

    console.log(" [+] sendMessageAddr Object: ", hexdump(sendMessageAddr,  {
        offset: 0,
        length: 48,
        header: true,
        ansi: true
    }));

    // C. 构建 Message 结构体
    messageAddr.add(0x00).writePointer(baseAddr.add(0x7f04f70));
    messageAddr.add(0x08).writeU32(taskId);
    messageAddr.add(0x0c).writeU32(0x20a);
    messageAddr.add(0x10).writeU64(0x3);
    messageAddr.add(0x18).writePointer(cgiAddr);

    // 设置一些固定值
    messageAddr.add(0x20).writeU64(uint64("0x20"));
    messageAddr.add(0x28).writeU64(uint64("0x8000000000000030"));
    messageAddr.add(0x30).writeU64(uint64("0x0000000001010100"));
    messageAddr.add(0x58).writeU64(uint64("0x0101010100000001"));

    // 处理回调地址
    callBackFuncAddr.writePointer(baseAddr.add(0x7f04fc8));
    messageAddr.add(0x98).writePointer(callBackFuncAddr);

    // 设置内容指针
    messageAddr.add(0xb8).writePointer(baseAddr.add(0x7f96918));
    messageAddr.add(0xc0).writePointer(messageContentAddr);
    messageAddr.add(0xc8).writeU64(uint64("0x0000000100000001"));
    messageAddr.add(0xd0).writeU64(0x4);
    messageAddr.add(0xd8).writeU64(0x1);
    messageAddr.add(0xe0).writeU64(0x1);
    messageAddr.add(0xe8).writePointer(baseAddr.add(0x7f96a08));


    messageContentAddr.writePointer(messageAddrAddr);
    messageAddrAddr.writePointer(baseAddr.add(0x7f968a0));
    messageAddrAddr.add(0x08).writePointer(contentAddr);

    console.log(" [+] messageAddr Object: ", hexdump(messageAddr,  {
        offset: 0,
        length: 200,
        header: true,
        ansi: true
    }));

    console.log(" [+] Dynamic Memory Setup Complete. - Message Object: " + messageAddr);
}

setImmediate(setupSendMessageDynamic);


function setTriggerAttach() {
    var targetAddr = baseAddr.add(0x444A99C);

    console.log("[*] WeChat Base: " + baseAddr + "[*] Attaching to: " + targetAddr);

    // 3. 开始拦截
    Interceptor.attach(targetAddr, {
        onEnter: function (args) {
            console.log("[*] Entered Function: 0x10444A99C");

            if (!globalMessagePtr.isNull()) {
                return;
            }

            globalMessagePtr = this.context.x0;
            console.log("[+] globalMessagePtr 当前 X0 的指针值: " + globalMessagePtr);
        },
        onLeave: function (retval) {
        }
    });
}

// 使用 setImmediate 确保在模块加载后执行
setImmediate(setTriggerAttach);


/**
 * 手动触发函数调用：模拟 IDA Appcall 逻辑
 */

function manualTrigger() {
    console.log("[*] Manual Trigger Started...");

    const payloadBase = ptr("0x175ED6600");

    // 获取当前时间戳 (秒)
    const timestamp = Math.floor(Date.now() / 1000);

    // 2. 执行基础的 Patch (Dword/Qword)
    messageAddr.add(0x08).writeU32(taskId);
    sendMessageAddr.add(0x20).writeU32(taskId);
    messageAddrAddr.add(0x18).writeU32(timestamp);

    // 3. 构造并填充 Payload
    // 注意：Frida 的 writeByteArray 不会自动处理长度，需确保数据完整
    const payloadData = [
        0x0A, 0x02, 0x00, 0x00,                         // 0x00
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x08
        0x03, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, // 0x10
        0x40, 0xec, 0x0e, 0x12, 0x01, 0x00, 0x00, 0x00, // 0x18
        0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x20
        0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, // 0x28
        0x00, 0x01, 0x01, 0x01, 0x00, 0xAA, 0xAA, 0xAA, // 0x30
        0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, // 0x38
        0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, // 0x40
        0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0xAA, 0xAA, 0xAA, // 0x48
        0xFF, 0xFF, 0xFF, 0xFF, 0xAA, 0xAA, 0xAA, 0xAA, // 0x50
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x58
        0x0A, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x60
        0x64, 0x65, 0x66, 0x61, 0x75, 0x6C, 0x74, 0x2D, // 0x68 default-
        0x6C, 0x6F, 0x6E, 0x67, 0x6C, 0x69, 0x6E, 0x6B, // 0x70 longlink
        0x00, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0x10, // 0x78
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x80
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x88
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x90
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x98
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xA0
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xA8
        0x00, 0x00, 0x00, 0x00, 0xAA, 0xAA, 0xAA, 0xAA, // 0xB0
        0xC0, 0x66, 0xED, 0x75, 0x01, 0x00, 0x00, 0x00, // 0xB8
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xC0
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xC8
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xD0
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xD8
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xE0
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xE8
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xF0
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0xF8
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x100
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x108
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x110
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x118
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x120
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x128
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x130
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x138
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x140
        0x01, 0x00, 0x00, 0x00, 0xAA, 0xAA, 0xAA, 0xAA, // 0x148
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x150
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x158
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x160
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x168
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x170
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x178
        0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x180
        0x00, 0x00, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, // 0x188
        0x98, 0x67, 0xED, 0x75, 0x01, 0x00, 0x00, 0x00, // 0x190
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 0x198
    ];

    // 从 0x175ED6604 开始写入 Payload
    payloadBase.writeU32(taskId);
    payloadBase.add(0x04).writeByteArray(payloadData);
    payloadBase.add(0x18).writePointer(cgiAddr);
    console.log("[+] Payload trigger function written to memory.");

    const sub_10444A99C = new NativeFunction(triggerFuncAddr, 'uint64', ['pointer', 'pointer']);

    // 5. 调用函数
    try {
        const arg1 = globalMessagePtr; // 第一个指针参数
        const arg2 = payloadBase;        // 第二个参数 0x175ED6600

        console.log(`[*] Calling trigger function  at ${triggerFuncAddr} with args: (${arg1}, ${arg2})`);

        const result = sub_10444A99C(arg1, arg2);

        console.log("[+] Execution trigger function  Success. Return value: " + result);
    } catch (e) {
        console.log("[!] Error trigger function  during execution: " + e);
    }
}


/**
 * 拦截特定地址并重定向结构体指针
 */

function attachReq2buf() {
    // 1. 计算运行时地址
    // 假设 IDA 地址 1033EE8E8 对应的偏移是 0x33EE8E8 (基于基址 0x100000000)
    const targetAddr = baseAddr.add(0x33EE8E8);
    console.log("[*] Target Req2buf enter Address: " + targetAddr);

    // 2. 开始拦截
    Interceptor.attach(targetAddr, {
        onEnter: function(args) {
            if (!this.context.x1.equals(taskId)) {
                return;
            }

            console.log("[+] 已命中目标Req2Buf地址:0x1033EE8E8 taskId:" + taskId + "base:" + baseAddr);

            // 3. 获取 X24 寄存器的值
            const x24_base = this.context.x24;
            insertMsgAddr = x24_base.add(0x60);

            console.log("[*] 当前 Req2Buf X24 基址: " + x24_base);
            console.log("[*] 准备修改位置 Req2Buf (X24 + 0x60): " + insertMsgAddr , hexdump(insertMsgAddr, {
                offset: 0,
                length: 16,
                header: true,
                ansi: true
            }));

            if (typeof sendMessageAddr !== 'undefined') {
                insertMsgAddr.writePointer(sendMessageAddr);
                console.log("[!] 成功! Req2Buf 已将 X24+0x60 指向新地址: " + sendMessageAddr +
                    "[+] Req2Buf 写入后内存预览: " + insertMsgAddr, hexdump(insertMsgAddr, {
                    offset: 0,
                    length: 16,
                    header: true,
                    ansi: true
                }));
            } else {
                console.log("[?] 错误: 变量 sendMessageAddr 未定义，请确保已运行分配逻辑。");
            }
        }
    });

    const returnAddr = baseAddr.add(0x33EFA00);
    console.log("[*] Target Req2buf leave Address: " + targetAddr);

    Interceptor.attach(returnAddr, {
        onEnter: function(args) {
            if (!this.context.x25.equals(taskId)) {
                return;
            }
            insertMsgAddr.writeU64(0x0);
            console.log("[+] 0x1033EFA00 清空写入后内存预览: " + insertMsgAddr.readPointer());
        }
    });
}

// 确保在初始化后执行
setImmediate(attachReq2buf);

// 辅助函数：Protobuf Varint 编码 (对应 get_varint_timestamp_bytes)
function getVarintTimestampBytes() {
    let ts = Math.floor(Date.now() / 1000);
    let encodedBytes = [];
    let tempTs = ts >>> 0; // 强制转为 32位 无符号整数

    while (true) {
        let byte = tempTs & 0x7F;
        tempTs >>>= 7;
        if (tempTs !== 0) {
            encodedBytes.push(byte | 0x80);
        } else {
            encodedBytes.push(byte);
            break;
        }
    }
    return encodedBytes;
}

/**
 * 模拟 run_patch_script 逻辑的 Frida 脚本
 * 当命中 10223EF58 时触发内存写入和寄存器修改
 */
function attachProto() {
    const targetHookAddr = baseAddr.add(0x223EF58);
    console.log("[*] proto注入拦截目标地址: " + targetHookAddr);
    // 2. 预先分配一块持久内存用于存放 Payload (对应 x1_addr)
    // Memory.alloc 会返回一个在脚本运行期间有效的地址
    const x1_custom_addr = Memory.alloc(256);
    console.log("[*] Frida 分配的 Payload 地址: " + x1_custom_addr);

    Interceptor.attach(targetHookAddr, {
        onEnter: function(args) {
            // --- 构造动态 Payload ---
            const prefix = [
                0x08, 0x01, 0x12, 0x5E, 0x0A, 0x15, 0x0A, 0x13, // 0x00
                0x77, 0x78, 0x69, 0x64, 0x5F, 0x37, 0x77, 0x64, // 0x08
                0x31, 0x65, 0x63, 0x65, 0x39, 0x39, 0x66, 0x37, // 0x10
                0x69, 0x32, 0x31, 0x12, 0x03, 0x38, 0x38, 0x38, // 0x18
                0x18, 0x01, 0x20                                // 0x20
            ];

            const tsBytes = getVarintTimestampBytes();

            const suffix = [
                0x28, 0xD1, 0xF7, 0xA6, 0xE6, 0x0C,             // 某个id头部
                0x32, 0x32, 0x3C,                               // 0x28 头部
                0x6D, 0x73, 0x67, 0x73, 0x6F, 0x73, 0x75, 0x72, // 0x30 msgsour
                0x63, 0x65, 0x3E, 0x3C, 0x61, 0x6C, 0x6E, 0x6F, // 0x38 ce><alno
                0x64, 0x65, 0x3E, 0x3C, 0x66, 0x72, 0x3E, 0x31, // 0x40 de><fr>1
                0x3C, 0x2F, 0x66, 0x72, 0x3E, 0x3C, 0x2F, 0x61, // 0x48 </fr></a
                0x6C, 0x6E, 0x6F, 0x64, 0x65, 0x3E, 0x3C, 0x2F, // 0x50 lnode></
                0x6D, 0x73, 0x67, 0x73, 0x6F, 0x73, 0x75, 0x72, // 0x58 msgsour
                0x63, 0x65, 0x3E, 0x00                          // 0x60 ce>.
            ];

            // 合并数组
            const finalPayload = prefix.concat(tsBytes).concat(suffix);

            // --- 写入内存 ---
            x1_custom_addr.writeByteArray(finalPayload);
            console.log("[*] Payload 已写入，长度: " + finalPayload.length);

            this.context.x1 = x1_custom_addr;
            this.context.x2 = ptr(0x62);

            console.log("[+] 寄存器修改完成: X1=" + this.context.x1 + ", X2=" + this.context.x2, hexdump(x1_custom_addr, {
                offset: 0,
                length: 160,
                header: true,
                ansi: true
            }));
        }
    });
}

// 启动
setImmediate(attachProto);
