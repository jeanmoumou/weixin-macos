const mod = Process.getModuleByName("WeChat");
console.log("[+] Base Address:", mod.base);
var counterMap = new Map();

function checkValid(p) {
    if (p.isNull()) {
        return false;
    }

    if (!p.and(0x7).isNull()) {
        return false;
    }
    if (p.compare(ptr("0x600000000000")) >= 0 && p.compare(ptr("0x700000000000")) < 0) {
        return true;
    }
    return false;
}

function handlePr(addr, keyword) {
    const realAddr = ptr("0x" + addr).sub("0x100000000").add(mod.base);
    console.log("[+] real Address:", realAddr)

    Interceptor.attach(realAddr, {
        onEnter(args) {
            const currentCount = counterMap.get(addr) || 0;
            counterMap.set(addr, currentCount + 1);
            console.log(`${addr} called ${currentCount} times`);

            if (args[0].isNull()) {
                console.log("args[0] is NULL, skipping hexdump.");
                return;
            }

            try {
                console.log("[*] Hexdump of args[0]:");
                console.log(hexdump(args[0], {
                    offset: 0,
                    length: 256,
                    header: true,
                    ansi: true  // 在支持彩色输出的终端（如 macOS 终端）中效果很好
                }));
            } catch (e) {
                console.log("[!] 无法读取内存: " + e.message);
            }
        },

        onLeave(retval) {
        }
    });

}

const prs = ["10438958c", "10434ce6c", "10433c754"]
const k = "";
for (let pr of prs) {
    handlePr(pr, k);
}

function ShowCount() {
    for (let [addr, count] of counterMap) {
        console.log(`${addr}: ${count}`);
    }
}

function clearCount() {
    counterMap.clear();
    console.log("Counter cleared.");
}


