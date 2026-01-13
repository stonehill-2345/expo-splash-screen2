# 示例

## 在全局作用域中调用 `SplashScreen.preventAutoHideAsync()`

`App.tsx`

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen2';

// 在 App 组件声明之前阻止原生启动屏幕自动隐藏
SplashScreen.preventAutoHideAsync()
  .then((result) => console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`))
  .catch(console.warn); // 最好显式捕获并检查任何错误

export default class App extends React.Component {
  componentDidMount() {
    // 2 秒后隐藏原生启动屏幕
    setTimeout(async () => {
      await SplashScreen.hideAsync();
    }, 2000);
  }

  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>SplashScreen Demo! 👋</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#aabbcc',
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
  },
});
```

## 基本用法

```tsx
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
    <View style={styles.container}>
      <Text>您的应用内容</Text>
    </View>
  );
}
```

## 使用 Expo Router

```tsx
// app/_layout.tsx
import * as SplashScreen from 'expo-splash-screen2';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // 初始渲染后隐藏启动屏幕
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

## 演示

查看启动屏幕模式的实际效果：

### `webview` 模式

在 WebView 中显示 HTML 内容，支持完整的 JavaScript/CSS。

<table>
  <thead><tr><td>Android</td><td>iOS</td></tr></thead>
  <tbody><tr>
<td>

![WebView Android](../assets/demo/webview-a.gif)

</td>
<td>

![WebView iOS](../assets/demo/webview-i.gif)

</td>
    </tr>
  </tbody>
</table>

### `responsiveImage` 模式

显示全屏背景图片，缩放以覆盖整个屏幕。

<table>
  <thead><tr><td>Android</td><td>iOS</td></tr></thead>
  <tbody><tr>
<td>

![ResponsiveImage Android](../assets/demo/reponsiveimg-a.gif)

</td>
<td>

![ResponsiveImage iOS](../assets/demo/reponsive-i.gif)

</td>
    </tr>
  </tbody>
</table>

### `normal` 模式

显示固定宽度的居中图片，保持宽高比。支持深色模式。

<table>
  <thead><tr><td>Android</td><td>iOS</td></tr></thead>
  <tbody><tr>
<td>

![Normal Android](../assets/demo/normal-a.gif)

</td>
<td>

![Normal iOS](../assets/demo/normal-i.gif)

</td>
    </tr>
  </tbody>
</table>

### `blend` 模式

结合 `.9.png` 背景图片和 WebView HTML 内容，增强开屏体验。系统启动屏幕使用 `.9.png` 图片作为背景，WebView 容器使用透明背景（推荐），实现无缝过渡。

**注意**：Blend 模式结合了 `responsiveImage` 模式的视觉效果（`.9.png` 背景）和 `webview` 模式的功能（HTML 内容覆盖层）。这实现了从系统启动屏幕到自定义动画启动屏幕的平滑过渡。

<table>
  <thead><tr><td>Android</td><td>iOS</td></tr></thead>
  <tbody><tr>
<td>

![Blend Android](../assets/demo/blend-a.mp4)

</td>
<td>

![Blend iOS](../assets/demo/blend-i.mp4)

</td>
    </tr>
  </tbody>
</table>
