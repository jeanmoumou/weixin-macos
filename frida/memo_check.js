MemoryAccessMonitor.enable(
    {
        base: ptr("0x6000034c1000"),
        size: 0x40  // buffer 大小
    },
    {
        onAccess(details) {
            console.log("Access by:", details.from);
            console.log("Operation:", details.operation);
            console.log(hexdump(idaAddr, { length: 0x40 }));
        }
    }
);
