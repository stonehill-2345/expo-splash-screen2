# 配置

将插件添加到您的 `app.json` 或 `app.config.js`：

## WebView 模式

在 WebView 中显示 HTML 内容，允许复杂的动画和交互式启动屏幕。

- 完整的 JavaScript/CSS 支持
- React 组件支持（使用 esbuild 打包器）
- 非常适合动画启动屏幕
- JavaScript 桥接用于原生通信

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

> **注意**：对于 `webview` 和 `blend` 模式，必须安装 `react-native-web` 来打包 web 文件：
> ```bash
> npm install react-native-web
> # 或
> pnpm add react-native-web
> # 或
> yarn add react-native-web
> ```

### WebView 模式选项

| 选项 | 类型 | 必需 | 描述 |
|--------|------|----------|-------------|
| `mode` | `"webview"` | 是 | 启用 WebView HTML 模式 |
| `backgroundColor` | `string` | 否 | 背景颜色（默认：`#ffffff`） |
| `localHtmlPath` | `string` | 否 | 自定义 HTML 文件的路径 |

## ResponsiveImage 模式

显示全屏背景图片，缩放以覆盖整个屏幕。

- 在 Android 上支持 `.9.png`（九宫格）格式
- `scaleAspectFill` 内容模式
- 最适合照片或详细背景

```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "responsiveImage",
          "backgroundColor": "#FFFFFF",
          "image": "./assets/splash-background.png"
        }
      ]
    ]
  }
}
```

### ResponsiveImage 模式选项

| 选项 | 类型 | 必需 | 描述 |
|--------|------|----------|-------------|
| `mode` | `"responsiveImage"` | 是 | 启用响应式图片模式 |
| `backgroundColor` | `string` | 否 | 背景颜色（默认：`#ffffff`） |
| `image` | `string` | 是 | 背景图片路径（支持 `.9.png`） |

## Normal 模式

显示固定宽度（默认 100px）的居中图片，保持宽高比。

- 固定宽度，自动高度
- 在屏幕上居中显示，带背景颜色
- **支持深色模式**，具有独立的图片和背景颜色
- 最适合以 Logo 为中心的启动屏幕

```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "normal",
          "backgroundColor": "#10021F",
          "image": "./assets/splash-icon.png",
          "imageWidth": 100
        }
      ]
    ]
  }
}
```

### Normal 模式选项

| 选项 | 类型 | 必需 | 描述 |
|--------|------|----------|-------------|
| `mode` | `"normal"` | 是 | 启用普通（居中图片）模式 |
| `backgroundColor` | `string` | 否 | 背景颜色（默认：`#ffffff`） |
| `image` | `string` | 是 | 启动图标图片路径 |
| `imageWidth` | `number` | 否 | 图片宽度（单位：dp/pt，默认：`100`） |
| `dark` | `object` | 否 | 深色模式配置 |

## Blend 模式

结合 `.9.png` 背景图片和 WebView HTML 内容，增强开屏体验：

```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "blend",
          "image": "./assets/splash-background.9.png"
        }
      ]
    ]
  }
}
```

> **注意**：对于 `webview` 和 `blend` 模式，必须安装 `react-native-web` 来打包 web 文件：
> ```bash
> npm install react-native-web
> # 或
> pnpm add react-native-web
> # 或
> yarn add react-native-web
> ```

### Blend 模式选项

| 选项 | 类型 | 必需 | 描述 |
|--------|------|----------|-------------|
| `mode` | `"blend"` | 是 | 启用混合模式（`.9.png` 背景 + WebView） |
| `image` | `string` | 是 | 背景图片路径（支持 `.9.png`） |
| `localHtmlPath` | `string` | 否 | 自定义 HTML 文件路径 |

**Blend 模式工作原理：**

- **系统启动屏幕**：使用 `.9.png` 图片作为背景（Android 12+ 系统启动屏幕）
- **WebView 容器**：使用透明背景（推荐），以显示系统启动屏幕背景，实现视觉连续性
- **HTML 覆盖层**：在背景之上显示自定义 HTML 内容
- **过渡效果**：从系统启动屏幕到 WebView 启动屏幕的平滑过渡，无视觉间隙

此模式适用于以下场景：
- 需要系统启动屏幕的原生性能
- 需要 HTML/WebView 的丰富动画和交互性
- 需要系统启动屏幕和自定义启动屏幕之间的无缝视觉过渡

## 深色模式支持

通过在 `normal` 模式中添加 `dark` 配置来启用深色模式支持：

```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "normal",
          "backgroundColor": "#FFFFFF",
          "image": "./assets/splash-icon.png",
          "imageWidth": 100,
          "dark": {
            "backgroundColor": "#000000",
            "image": "./assets/splash-icon-dark.png"
          }
        }
      ]
    ]
  }
}
```

### 深色模式选项

| 选项 | 类型 | 必需 | 描述 |
|--------|------|----------|-------------|
| `dark.backgroundColor` | `string` | 否 | 深色模式背景颜色 |
| `dark.image` | `string` | 否 | 深色模式图片（可以与浅色模式相同） |

启用深色模式后：
- **Android**：图片放置在 `drawable/` 和 `drawable-night/` 目录中
- **iOS**：应用检测系统外观并相应地切换颜色/图片
- **运行时切换**：两个平台都支持运行时主题更改
