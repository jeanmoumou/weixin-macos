注意点
1. 需要让frida启动微信才能通过内存地址找到代码位置        
```
MemoryAccessMonitor.enable(
    {
        base: ptr("0x60000173BCDA"),
        size: 0x200  // buffer 大小
    },
    {
        onAccess(details) {
            console.log("Access by:", DebugSymbol.fromAddress(details.from));
            console.log("Operation:", details.operation);
        }
    }
);
```

2. 通过ce确定内存位置        
![image](https://github.com/user-attachments/assets/5980e46a-d5b7-4556-b291-a9beca0cbf47)


3. 可以看到打印日志        
```
Access by: 0x10dc28ccc libGLESv2.dylib!0x250ccc (0x250ccc)
Operation: read
Access by: 0x10a08083c WeChat!0x580883c (0x10580883c)
Operation: read
7                  Access by: 0x18b233444 libsystem_malloc.dylib!nanov2_malloc
Operation: read
Access by: 0x10a08083c WeChat!0x580883c (0x10580883c)
Operation: read
```
