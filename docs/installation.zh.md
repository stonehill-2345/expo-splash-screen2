# 安装

## 在托管 Expo 项目中安装

对于托管 Expo 项目，请按照标准安装流程：

```bash
# 如果已安装 expo-splash-screen，请先卸载（它们互斥）
npm uninstall expo-splash-screen

# 安装 expo-splash-screen2
yarn add expo-splash-screen2
# 或
npm install expo-splash-screen2
# 或
pnpm add expo-splash-screen2

```

> **注意**：`expo-splash-screen` 和 `expo-splash-screen2` 互斥。您只能在项目中使用其中一个。

## 在裸 React Native 项目中安装

对于裸 React Native 项目，您必须确保在继续之前已[安装并配置了 `expo` 包](https://docs.expo.dev/bare/installing-expo-modules/)。

### 将包添加到依赖项

```bash

yarn add expo-splash-screen2
# 或
npm install expo-splash-screen2
# 或
pnpm add expo-splash-screen2


```

### iOS 设置

安装包后运行 `npx pod-install`：

```bash
npx pod-install
```

### Android 设置

无需额外设置。插件将在 prebuild 期间自动配置 Android。

## pnpm 构建脚本批准

如果您使用 `pnpm` 并遇到关于忽略构建脚本的警告：

```
╭ Warning ────────────────────────────────────────────────────────────────────────╮
│                                                                                 │
│   Ignored build scripts: expo-splash-screen2, unrs-resolver.           │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed to     │
│   run scripts.                                                                  │
```

按照提示运行 `pnpm approve-builds` 以允许 `expo-splash-screen2` 执行其 postinstall 脚本：

```bash
pnpm approve-builds
```

这将允许包运行其 postinstall 脚本，这对于正确设置是必要的。

## 安装后设置

安装后，插件将自动：
1. 将 `expo-splash-web` 文件夹复制到您的项目根目录
2. 将构建命令添加到您的 `package.json`
3. 使用插件配置更新您的 `app.json`
4. 从 `package.json` 中删除 `expo-splash-screen` 依赖

**如果您使用 pnpm 且 postinstall 脚本未自动运行**，您可以手动运行设置脚本：

```bash
# 从项目根目录
node node_modules/expo-splash-screen2/scripts/setup.js
```

安装（或手动设置）后，运行 prebuild 以应用原生修改：

```bash
npx expo prebuild
```

## 快速开始

使用 WebView 模式快速开始使用 `expo-splash-screen2`。

### 步骤 1: 安装包

```bash
# 如果已安装 expo-splash-screen，请先卸载（它们互斥）
npm uninstall expo-splash-screen
# 安装 expo-splash-screen2
yarn add expo-splash-screen2
# 或
npm install expo-splash-screen2
# 或
pnpm add expo-splash-screen2


```

> **注意**：如果您使用 `pnpm` 并看到关于忽略构建脚本的警告，请运行 `pnpm approve-builds` 以允许包执行其 postinstall 脚本。

### 步骤 2: 配置 app.json

在您的 `app.json` 或 `app.config.js` 中添加插件，使用 WebView 模式：

```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "webview",
          "backgroundColor": "#FFFFFF"
        }
      ]
    ]
  }
}
```

### 步骤 3: 运行 Prebuild

安装后，运行 prebuild 以应用原生修改：

```bash
npx expo prebuild
```

### 步骤 4: 在应用中使用

在您的主组件中（例如 `App.tsx`），阻止启动屏幕自动隐藏并控制何时隐藏它：

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen2';

// 在 App 组件声明之前阻止原生启动屏幕自动隐藏
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // 预加载字体、进行 API 调用等
        await loadFonts();
        await loadInitialData();
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>您的应用内容</Text>
    </View>
  );
}
```

### 步骤 5: 自定义启动屏幕 HTML

插件会自动将 `expo-splash-web` 文件夹复制到您的项目根目录。您可以通过编辑 `expo-splash-web/src/` 中的文件来自定义 HTML 启动屏幕：

```bash
# 构建启动屏幕 Web 资源
npm run build:expo-splash-web

# 或在开发模式下运行（支持热重载）
npm run dev:expo-splash-web
```

进行更改后，重新构建并再次运行 prebuild：

```bash
npm run build:expo-splash-web
npx expo prebuild
```

### 完成！🎉

您的应用现在拥有了一个基于 WebView 的自定义启动屏幕。有关更高级的配置和其他显示模式，请参阅[配置](./configuration.zh.md)指南。
