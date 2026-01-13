# 已知问题

## iOS 缓存

iOS 上的启动屏幕有时会遇到缓存问题，在显示新图片之前会闪烁之前的图片。当发生这种情况时，请尝试：
1. 重启设备
2. 卸载并重新安装应用程序
3. 运行 `npx expo prebuild --clean`

## Node Modules 缓存

如果插件更改未生效，请尝试：

```bash
cd your-project
rm -rf node_modules/expo-splash-screen2
npm install  # 或 pnpm install
npx expo prebuild --clean
```

## 深色模式不工作

确保：
1. 您的 `app.json` 在 `normal` 模式中具有 `dark` 配置
2. 配置更改后已运行 `npx expo prebuild --clean`
3. 浅色和深色图片都存在于指定路径

## Android 12+ 系统默认启动屏幕

**注意：Android 12+ 系统默认行为**

如果您的应用在 Android 12 或更高版本上运行，且您的 `targetSdkVersion` 不低于 30，系统将显示默认启动屏幕。这是 Android 的默认行为，可能会导致出现两个启动屏幕（系统默认启动屏幕 + 自定义启动屏幕）。

如果您不想显示系统默认启动屏幕，可以使用以下任一方法：

**方法 1：使默认启动屏幕透明**

在 `AndroidManifest.xml` 中的 Activity 主题中添加以下内容：

```xml
<item name="android:windowIsTranslucent">true</item>
```

**方法 2：调整 targetSdkVersion**

将 `androidTargetSdkVersion` 设置为 30 或更低以隐藏系统默认启动屏幕。
