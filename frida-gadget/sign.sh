#!/bin/bash

APP_PATH="/Applications/WeChat.app"
GADGET_PATH="$APP_PATH/Contents/Frameworks/FridaGadget.dylib"
ENTITLEMENTS="temp.entitlements" # 确保你已经创建了这个文件

echo "开始对 Gadget 签名..."
codesign -f -s - --timestamp=none "$GADGET_PATH"

echo "开始对所有子框架进行深层签名..."
# 遍历微信内部所有的 Frameworks 和 dylib 进行签名
find "$APP_PATH/Contents" \( -name "*.framework" -o -name "*.dylib" -o -name "*.bundle" \) -print0 \
  | xargs -0 codesign -f -s - --timestamp=none

echo "最后对主程序进行签名并注入 Entitlements..."
codesign -f -s - --timestamp=none --entitlements "$ENTITLEMENTS" --force "$APP_PATH"

echo "完成！"
