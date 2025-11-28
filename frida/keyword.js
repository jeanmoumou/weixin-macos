const keyword = "7.7";
const addrs = ["6000033DDE48"]
console.log(keyword);
console.log(addrs);

function memoGet(p) {
    p = "0x" + p;
    const idaAddr = ptr(p);
    MemoryAccessMonitor.enable(
        {
            base: idaAddr,
            size: 0x40  // buffer 大小
        },
        {
            onAccess(details) {
                console.log("Access by:", details.from);
                attach(details.from)
                console.log(hexdump(idaAddr, {length: 0x40}));
            }
        }
    );

}

function attach(from) {
    const realAddr = ptr(from);

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
                        const buf = args[i].readByteArray(128)
                        if (!buf) {
                            continue;
                        }
                        let s = "";
                        const u8 = new Uint8Array(buf);
                        for (let b of u8) {
                            if (b >= 0x20 && b <= 0x7E) {
                                s += String.fromCharCode(b);
                            } else {
                                s += ".";
                            }
                        }

                        if (keyword === "" || s.includes(keyword)) {
                            console.log(`\n[+] arg${i} ${args[i]} ${s}`);
                            console.log(hexdump(args[i], {length: 128}));
                            console.log(
                                Thread.backtrace(this.context, Backtracer.ACCURATE)
                                    .map(DebugSymbol.fromAddress).join('\n'));
                            return;
                        }
                    }
                } catch (e) {
                    console.log("Enter Error:", e);
                }
            }

        },

        onLeave(retval) {
            console.log("===== sub_105808800 LEAVE =====");
            console.log("Return value:", retval);
            try {
                if (retval.compare(ptr("0x600000000000")) >= 0 && retval.compare(ptr("0x700000000000")) < 0 && retval.and(0x7).isNull()) {
                    console.log(hexdump(retval, {
                        offset: 0,
                        length: 40
                    }));
                }
            } catch (_) {
            }
        }
    });
}


for (let addr of addrs) {
    memoGet(addr);
}