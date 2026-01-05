# 克隆源码
git clone https://github.com/Tyilo/insert_dylib

# 进入目录
cd insert_dylib

# 使用 Xcode 命令行工具进行编译
xcodebuild

# 将生成的二进制文件移动到系统路径，方便全局调用
cp build/Release/insert_dylib /usr/local/bin/           
wget https://github.com/frida/frida/releases/download/17.5.2/frida-gadget-17.5.2-macos-universal.dylib.xz       
xz -d frida-gadget-17.5.2-macos-universal.dylib.xz      
cp frida-gadget-17.5.2-macos-universal.dylib /Applications/WeChat.app/Contents/Frameworks//FridaGadget.dylib        
cd /Applications/WeChat.app/Contents/MacOS/            
/usr/local/bin/insert_dylib --inplace --strip-codesig "@executable_path/../Frameworks/FridaGadget.dylib" WeChat            
./sign.sh           
cp frida-gadget/FridaGadget.config /Applications/WeChat.app/Contents/Frameworks/        
frida -H 127.0.0.1:27042 -n Gadget -l ./frida/script.js   
