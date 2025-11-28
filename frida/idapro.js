const mod = Process.getModuleByName("WeChat");
const realAddr = ptr("0x1057ee3a8").sub("0x100000000").add(mod.base);

console.log("[+] Real Function Address:", realAddr);

Interceptor.attach(realAddr, {
    onEnter(args) {
        for (let i = 0; i < 10; i++) {
            try {
                if (args[i].isNull()) {
                    continue;
                }
                console.log(`\n[+] arg${i} ${args[i]}`);

                if (args[i].compare(ptr("0x600000000000")) >= 0 && args[i].compare(ptr("0x700000000000")) < 0 && args[i].and(0x7).isNull()) {
                    console.log(hexdump(args[i], {
                        offset: 0,
                        length: 128
                    }));
                }
            } catch (e) {
                console.log("Enter Error:", e);
            }
        }

        console.log(
            Thread.backtrace(this.context, Backtracer.ACCURATE)
                .map(DebugSymbol.fromAddress).join('\n'));

    },

    onLeave(retval) {
        console.log("===== sub_105808800 LEAVE =====");
        console.log("Return value:", retval);
        try {
            console.log("Return hexdump:");
            console.log(hexdump(retval, {
                offset: 0,
                length: 128
            }));
        } catch (_) {
        }
    }
});

