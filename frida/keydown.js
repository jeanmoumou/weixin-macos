// 警告：仅为演示AppKit Hooking概念，实际类名和方法可能不同
// 尝试 Hook NSResponder 的 keyDown: 方法，所有接收键盘事件的对象都会经过它
var NSResponder = ObjC.classes.NSResponder;

if (NSResponder) {
    console.log("NSResponder class found.");
    Interceptor.attach(NSResponder['- keyDown:'].implementation, {
        onEnter: function(args) {
            // args[2] 是 NSEvent* 键盘事件对象
            console.log("Hooked keyDown: 方法被调用");
            var event = new ObjC.Object(args[2]);
            var type = event.type().toString();
            console.log("捕获到键盘事件，类型: " + type);

            // 检查是否为按键按下事件 (NSKeyDown = 10)
            if (type === '10') {
                var chars = event.charactersIgnoringModifiers().toString();
                // 检查按键是否为回车 (通常chars是"\r"或"\n")
                if (chars === '\r' || chars === '\n') {
                    console.log('>>> 🌟 捕获到 AppKit 层的回车键事件！🌟 <<<');
                    // 可以在这里执行您的自定义代码
                }
            }
        }
    });
    console.log("AppKit NSResponder hook loaded.");
} else {
    console.log("Failed to find NSResponder class.");
}