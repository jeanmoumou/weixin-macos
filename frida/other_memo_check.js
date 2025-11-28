const idaAddr = ptr("0x6000025A96DA");
console.log("start monitor");

MemoryAccessMonitor.enable(
    {
        base: idaAddr,
        size: 0x40  // buffer 大小
    },
    {
        onAccess(details) {
            console.log("0x6000029C6DF0 Details:", JSON.stringify(details));
            // console.log("0x6000029C6DF0 Access by:", DebugSymbol.fromAddress(details.from));
            console.log(hexdump(idaAddr, { length: 0x40 }));
        }
    }
);

