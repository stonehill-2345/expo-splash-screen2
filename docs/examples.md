# Examples

## `SplashScreen.preventAutoHideAsync()` in global scope

`App.tsx`

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen2';

// Prevent native splash screen from autohiding before App component declaration
SplashScreen.preventAutoHideAsync()
  .then((result) => console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`))
  .catch(console.warn); // it's good to explicitly catch and inspect any error

export default class App extends React.Component {
  componentDidMount() {
    // Hides native splash screen after 2s
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

## Basic Usage

```tsx
import * as SplashScreen from 'expo-splash-screen2';

// Prevent native splash screen from autohiding before App component declaration
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make API calls, etc.
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
      <Text>Your App Content</Text>
    </View>
  );
}
```

## With Expo Router

```tsx
// app/_layout.tsx
import * as SplashScreen from 'expo-splash-screen2';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after initial render
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

## Demo

See the splash screen modes in action:

### `webview` Mode

Display HTML content in a WebView with full JavaScript/CSS support.

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

### `responsiveImage` Mode

Display a full-screen background image that scales to cover the entire screen.

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

### `normal` Mode

Display a centered image with fixed width, maintaining aspect ratio. Supports dark mode.

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

### `blend` Mode

Combine a `.9.png` background image with WebView HTML content for enhanced splash screen experience. The system splash screen uses the `.9.png` image as background, and the WebView container uses transparent background (recommended) for seamless transition.

**Note**: Blend mode combines the visual appearance of `responsiveImage` mode (`.9.png` background) with the functionality of `webview` mode (HTML content overlay). This creates a smooth transition from the system splash screen to the custom animated splash screen.

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
