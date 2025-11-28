const libc = Process.getModuleByName("libSystem.B.dylib");

// 2. 拦截 memcpy
const memcpy_ptr = libc.findExportByName("memcpy");

if (memcpy_ptr) {
    console.log("[+] Hooking memcpy.");
    Interceptor.attach(memcpy_ptr, {
        onEnter(args) {
            // args[0] = destination (目标缓冲区)
            // args[1] = source (源数据)
            // args[2] = length
            this.src = args[1];
            this.len = args[2].toInt32();
        },
        onLeave(retval) {
            // 只检查长度适中的数据块 (防止日志爆炸)
            if (this.len > 5 && this.len < 500) {
                try {
                    // 尝试将源数据读取为 C 字符串
                    const message = this.src.readCString();

                    if (message && message.length > 1) {
                        console.log(`\n======================================================`);
                        console.log(`[+] ⚠️ 明文捕获于 memcpy!`);
                        console.log(`[+] 长度: ${this.len} 字节`);
                        console.log(`[+] 消息内容 (ASCII): ${message}`);

                        // 打印 Hexdump 验证
                        console.log(`--- Hexdump 验证 ---`);
                        console.log(hexdump(this.src, { length: this.len > 128 ? 128 : this.len }));

                        console.log(`======================================================`);
                    }
                } catch (e) {
                    // 忽略读取错误
                }
            }
        }
    });
} else {
    console.log("[!] memcpy symbol not found.");
}