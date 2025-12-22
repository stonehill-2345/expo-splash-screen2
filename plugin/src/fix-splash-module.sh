#!/bin/bash

# 自动注册 SplashScreen2Module 到 ExpoModulesProvider.swift
# 这个脚本会在每次构建前运行，确保模块被正确注册

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# 如果在 Xcode 构建环境中，使用 SRCROOT；否则使用脚本所在目录
if [ -n "${SRCROOT}" ]; then
  EXPO_MODULES_PROVIDER="${SRCROOT}/Pods/Target Support Files/Pods-demomodal/ExpoModulesProvider.swift"
else
  EXPO_MODULES_PROVIDER="${SCRIPT_DIR}/Pods/Target Support Files/Pods-demomodal/ExpoModulesProvider.swift"
fi

echo "[fix-splash-module] Checking ExpoModulesProvider.swift..."
echo "[fix-splash-module] File path: $EXPO_MODULES_PROVIDER"

if [ ! -f "$EXPO_MODULES_PROVIDER" ]; then
  echo "[fix-splash-module] ExpoModulesProvider.swift not found, skipping"
  exit 0
fi

# 检查是否已经导入 SplashScreen2Module
if grep -q "import SplashScreen2Module" "$EXPO_MODULES_PROVIDER"; then
  echo "[fix-splash-module] SplashScreen2Module import already exists"
else
  echo "[fix-splash-module] Adding SplashScreen2Module import"
  # 在最后一个 import 之后添加
  sed -i '' '/^import ExpoWebBrowser$/a\
import SplashScreen2Module
' "$EXPO_MODULES_PROVIDER"
fi

# 检查是否已经注册 SplashScreen2Module.self
if grep -q "SplashScreen2Module.self" "$EXPO_MODULES_PROVIDER"; then
  echo "[fix-splash-module] SplashScreen2Module.self already registered"
else
  echo "[fix-splash-module] Adding SplashScreen2Module.self to module list"
  # 先在 WebBrowserModule.self 后面添加逗号（如果没有的话）
  sed -i '' 's/WebBrowserModule\.self$/WebBrowserModule.self,/' "$EXPO_MODULES_PROVIDER"
  # 然后在 WebBrowserModule.self, 之后添加 SplashScreen2Module.self
  sed -i '' '/WebBrowserModule.self,$/a\
      SplashScreen2Module.self
' "$EXPO_MODULES_PROVIDER"
fi

echo "[fix-splash-module] Done"
