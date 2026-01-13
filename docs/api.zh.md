# API 参考

```tsx
import * as SplashScreen from 'expo-splash-screen2';
```

通过此模块控制的原生启动屏幕会在 React Native 控制的视图层次结构挂载后自动隐藏。这意味着当您的应用首次 `render` 视图组件时，原生启动屏幕将隐藏。可以通过调用 [`SplashScreen.preventAutoHideAsync()`](#splashscreenpreventautohideasync) 来阻止此默认行为，然后稍后调用 [`SplashScreen.hideAsync()`](#splashscreenhideasync)。

## `SplashScreen.preventAutoHideAsync()`

此方法使原生启动屏幕保持可见，直到调用 [`SplashScreen.hideAsync()`](#splashscreenhideasync)。这必须在渲染任何 React Native 控制的视图层次结构之前调用（在您的主组件的全局作用域中，或者在组件开始时渲染 `null` - 请参阅[示例部分](./examples.zh.md)）。

如果您的应用程序需要在首次渲染实际视图层次结构之前准备/下载某些资源和/或进行一些 API 调用，阻止默认自动隐藏可能会很有用。

> **重要**：建议在全局作用域中调用此方法而不等待，而不是在 React 组件或钩子内部调用。

### 返回值

一个 `Promise`，当成功阻止自动隐藏时解析为 `true`，如果原生启动屏幕已经被阻止自动隐藏（例如，如果您已经调用过此方法），则解析为 `false`。`Promise` 拒绝很可能意味着无法阻止原生启动屏幕自动隐藏（执行此方法时它已经隐藏）。

## `SplashScreen.hideAsync()`

隐藏原生启动屏幕。仅当通过调用 [`SplashScreen.preventAutoHideAsync()`](#splashscreenpreventautohideasync) 方法先前阻止了原生启动屏幕自动隐藏时才有效。

### 返回值

一个 `Promise`，一旦启动屏幕隐藏就解析为 `true`，如果启动屏幕已经隐藏则解析为 `false`。
