# expo-splash-screen2 鸿蒙（HarmonyOS）适配

鸿蒙平台的原生开屏适配，对齐 iOS/Android blend 模式：背景图 + 透明 WebView 加载 index.html（logo + 动画 + 隐私协议弹窗）。

鸿蒙构建**不跑 Expo config-plugin**，故鸿蒙的原生代码需手动集成，插件的 `setupHarmonyMode` 由 `scripts/setup-splash-harmony.js` 显式调用。

## 目录结构

```
harmony/
├── ets/                              # ArkTS 原生层
│   ├── SplashScreen2TurboModule.ets  # TurboModule: preventAutoHide/hideAsync
│   ├── SplashScreen2Package.ets      # RNPackage 注册（模块名 'ExpoSplashHtml'，与包 JS 入口对齐）
│   ├── SplashScreen2View.ets        # 全屏遮罩：背景图 + 透明 Web 加载 index.html
│   ├── SplashAuthStore.ets          # 隐私授权状态持久化（preferences）
│   └── SplashBridge.ets             # JS 桥接 window.Android: agree/disagree/openPrivacy
├── cpp/                              # C++ 桥接层（RNOH TurboModule 必需）
│   ├── SplashScreen2TurboModule.h/.cpp
│   ├── SplashScreen2Package.h
│   └── CMakeLists.txt
└── scripts/
    └── setup-splash-harmony.js      # 生成鸿蒙开屏资源（读 app.config.ts）
```


## 集成步骤（到鸿蒙 RN 项目）

### 1. 拷贝原生代码
- `ets/` 内容拷到 `harmony/entry/src/main/ets/expo-splash-screen2/`
- `cpp/` 内容拷到 `harmony/entry/src/main/cpp/expo-splash-screen2/`

### 2. 注册 TurboModule（三层模块名统一 `'ExpoSplashHtml'`，由 Package 内部已设）
- **ArkTS** `RNPackagesFactory.ets`：import + `new SplashScreen2Package(ctx)`
- **C++** `PackageProvider.cpp`：include + `std::make_shared<SplashScreen2Package>(ctx)`
- **C++** `CMakeLists.txt`：`add_subdirectory` + `target_link_libraries` 加 `rnoh_splash_screen2`

### 3. Index.ets 接入开屏遮罩
- import `SplashScreen2View`
- `Stack` 顶层放 `SplashScreen2View({ uiAbilityContext: this.rnohCoreContext?.uiAbilityContext })`
- `aboutToAppear` 读 isAuth（`SplashAuthStore`），未授权不启动 RN，agree 后 `@Watch` 触发 `connectMetro`

### 4. 生成开屏资源
- 将 `setup-splash-harmony.js` 接入 `postinstall`，生成鸿蒙原生开屏资源（详见下方「构建脚本」章节）

## 配置（app.config.ts）

```ts
['expo-splash-screen2', {
  mode: 'blend',
  image: './assets/images/cover_img.9.png',
  backgroundColor: '#000000',
  // 可选：鸿蒙专用配置（默认 fallback 到 image/backgroundColor）
  harmony: {
    image: './assets/images/expo_splash.png',  // 普通PNG（鸿蒙不支持.9黑边）
    backgroundColor: '#000000',
  },
}]
```

## 构建脚本 `setup-splash-harmony.js`

鸿蒙构建**不跑 Expo config-plugin**，插件的 `setupHarmonyMode` 不会随 prebuild 自动执行。`setup-splash-harmony.js` 补这个缺口：读取 `app.config.ts` 的 `expo-splash-screen2` 配置，显式调用 `setupHarmonyMode` 生成鸿蒙原生开屏资源，并拷贝 WebView 资源。

### 产物（写入 `harmony/entry/src/main/resources/`）

| 产物 | 来源 |
|---|---|
| `rawfile/expo_splash.png` | `harmony.image`，未配则回退 `image` |
| `base/element/color.json` 的 `expo_splash_background` | `harmony.backgroundColor`，未配则回退 `backgroundColor` |
| `rawfile/splash/index.html` + assets | `expo-splash-web` 构建产物（脚本会先跑 `build-splash-web.js` 重新构建，再拷贝） |

### 用法

接入鸿蒙项目 `package.json` 的 `postinstall`（依赖安装后自动生成资源）：

```json
{
  "scripts": {
    "postinstall": "node scripts/setup-splash-harmony.js"
  }
}
```

也可手动运行（改完 `app.config.ts` 或 `expo-splash-web` 后重新生成资源）：

```bash
node scripts/setup-splash-harmony.js
```

### 路径约定

> ⚠️ **重要：脚本中的路径是写死的，接入前必须按你的项目实际目录结构替换。**
> 脚本用 `__dirname/..` 推导 `ohrnRoot`、同级 `native/` 工程和 monorepo 根（见 [setup-splash-harmony.js:17-19](../scripts/setup-splash-harmony.js#L17-L19)）。**这套推导只匹配脚本的原始开发布局**，你的项目布局若不同，路径会解析错位、找不到 `app.config.ts`，最终静默跳过（不生成资源也不报错）。接入时请逐项核对、按实际路径改写脚本，或自行调用 `setupHarmonyMode`。

脚本假定如下相对布局（脚本位于鸿蒙工程根的 `scripts/` 下）：

```
<鸿蒙工程>/
├── scripts/setup-splash-harmony.js      # 脚本自身
├── harmony/                             # 原生代码 + 资源写入目标（entry/src/main/resources/...）
└── ../native/                           # 同级 native 工程（含 app.config.ts + expo-splash-web/）
        ├── app.config.ts                # 配置来源
        └── node_modules/expo-splash-screen2/plugin/build/   # 插件实例（已构建）
```

需要按实际项目替换的写死路径：

- `ohrnRoot = __dirname/..` —— 鸿蒙工程根（资源写入目标，写死为脚本上一级目录）
- 同级 `native/` 工程 —— `app.config.ts` 配置来源
- `native/node_modules/expo-splash-screen2/plugin/build` —— 插件实例（已构建）
- `@expo/config` —— 在 `native/node_modules` 或 monorepo 根解析

> 若上述任一路径与你的项目不符，**必须改写脚本对应常量后再接入**，否则脚本会因找不到配置/插件而静默跳过。

### 降级行为

每个失败点（配置缺失、插件未找到、`expo-splash-web` 构建失败等）均 `console.warn` 后跳过对应步骤，**不中断安装或构建**。

## 约束

1. **RNOH TurboModule 必须 C++ 侧**：`ArkTSTurboModule` proxy + `methodMap_`，JS 才能经 `NativeModules` 访问，ArkTS-only 不够。
2. **鸿蒙 ArkUI 不支持 .9 黑边**：开屏图用普通 PNG + `objectFit(ImageFit.Cover)`，或沿用配置的 .9 图（黑边被 Cover 裁掉）。
3. **JS 桥接名 `Android`**：`SplashScreenView.tsx` 先查 `window.webkit` 再 fallback `window.Android`，鸿蒙注册 `Android` 即走 Android 分支，无需改 HTML。
