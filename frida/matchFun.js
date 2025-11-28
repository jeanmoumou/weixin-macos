[
    "sendmsg",
    "newsendmsg",
    "SendMsg",
    "SendMsgFH"
].forEach(sig => {
    let arr = DebugSymbol.findFunctionsMatching("*" + sig + "*");
    arr.forEach(target => {
        console.log("Hooking:", target);

        Interceptor.attach(ptr(target), {
            onEnter(args) {
                console.log("🚀 Called:", target);

                // 打印调用堆栈
                console.log(
                    Thread.backtrace(this.context, Backtracer.ACCURATE)
                        .map(DebugSymbol.fromAddress)
                        .join("\n")
                );

                // 打印第 1 个参数，一般就是 protobuf buffer
                try {
                    console.log("arg0:", args[0]);
                    console.log(hexdump(args[0], { length: 256 }));
                } catch(e){}

                // 打印第 2 个参数（通常是长度）
                console.log("arg1:", args[1]);
            },
            onLeave(retval) {
                console.log("⬅️ return:", retval);
            }
        });
    });
});
