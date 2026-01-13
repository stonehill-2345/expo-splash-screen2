# expo-splash-screen2

`expo-splash-screen2` 允许您通过多种显示模式自定义应用的启动屏幕，包括 WebView HTML、.9图片、背景+webview和图标+背景颜色四种模式。支持深色模式，并提供无缝的过渡体验。

> [English](./README.md) | **中文文档**

### 主要特性

- 🎨 **多种显示模式**：WebView HTML、.9 图片、背景+WebView 混合模式和图标+背景颜色模式
- 🚀 **自定义复杂开屏**：使用 WebView 或 Blend 模式可自定义复杂开屏（协议弹框、动画效果等）
- 📦 **开箱即用的模板**：提供完整的 WebView HTML 模板文件，支持开发模式（dev）和生产构建（build）
- 🎯 **易于集成**：简单配置即可自动添加原生代码，无需手动修改


### 安装

#### 快速开始

1. **安装包：**

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

> **注意**：如果使用 `pnpm` 并看到关于忽略构建脚本的警告，请运行 `pnpm approve-builds`。

2. **配置 `app.json`：**

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

3. **运行 prebuild：**

```bash
npx expo prebuild
```

4. **在应用中使用：**

```tsx
import * as SplashScreen from 'expo-splash-screen2';

// 阻止原生启动屏幕自动隐藏
SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    // 准备就绪后隐藏启动屏幕
    SplashScreen.hideAsync();
  }, []);

  return <YourAppContent />;
}
```

有关详细的设置说明和其他模式，请查看[安装指南](./docs/installation.zh.md)。

### 文档

完整的 API 参考和指南：

- [安装指南](./docs/installation.zh.md)
- [配置](./docs/configuration.zh.md)
- [API 参考](./docs/api.zh.md)
- [示例](./docs/examples.zh.md)
- [平台特定详情](./docs/platform-specific.zh.md)
- [已知问题](./docs/known-issues.zh.md)

### 贡献

查看[贡献指南](./CONTRIBUTING.md)了解如何为仓库做出贡献和开发工作流程。

### 许可证

MIT

此模块基于 [expo-splash-screen](https://github.com/expo/expo/tree/main/packages/expo-splash-screen)，该模块同样采用 MIT 许可证。

### 致谢

此模块基于以下优秀工作（非常感谢 👏）：

- [expo-splash-screen](https://github.com/expo/expo/tree/main/packages/expo-splash-screen)
