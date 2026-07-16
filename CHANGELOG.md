# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.3] - 2026-07-15

### Added

- **HarmonyOS 平台开屏支持**：新增鸿蒙原生开屏栈，对齐 iOS/Android blend 模式（背景图 + 透明 WebView 加载开屏 HTML + 隐私协议弹窗）。
  - ArkTS 原生层：`SplashScreen2View`（全屏遮罩：背景图 + 透明 WebView）、`SplashBridge`（JS 桥接 `window.Android`：agree/disagree/openPrivacy）、`SplashAuthStore`（隐私授权状态持久化）。
  - C++ TurboModule（`SplashScreen2TurboModule`），模块名 `'ExpoSplashHtml'`，与包 JS 入口 `requireOptionalNativeModule('ExpoSplashHtml')` 对齐。
  - 插件新增 `setupHarmonyMode`：拷贝背景图到 `rawfile`、写背景色到 `color.json`。
  - `SplashHtmlConfig` 新增 `android` / `ios` / `harmony` 按平台覆盖 `image` 字段；鸿蒙可用 `harmony.image` 指定普通 PNG（ArkUI 不支持 .9 黑边）。
  - 构建脚本 `harmony/scripts/setup-splash-harmony.js`：鸿蒙不跑 config-plugin，由 postinstall 显式调用 `setupHarmonyMode` 生成原生资源。
  - 新增鸿蒙入口 `src/index.harmony.ts` 及构建产物 `build/index.harmony.*`；`package.json` 的 `files` 加入 `harmony`。

### Fixed

- 修复按平台拆分 `image` 后，仅配置单一平台（如只配 `android.image`）时另一平台 prebuild 崩溃（`path.resolve(undefined)` / `copyBackgroundImage(undefined)`）及运行时引用不存在 drawable 的问题：各平台 mod 回调内增加平台判空早退（`responsiveImage` / `normal` / `blend` 三种模式）。
