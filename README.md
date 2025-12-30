# expo-splash-screen2

`expo-splash-screen2` allows you to customize your app's splash screen with multiple display modes including WebView HTML, responsive background image, and fixed-width centered image. It supports dark mode and provides a seamless transition experience.

>  **English** | [中文文档](./README.zh.md)

- [⚡ Quick Start](#-quick-start)
- [🚀 Features](#-features)
- [📚 API](#-api)
- [🗒 Examples](#-examples)
- [💻 Installation](#-installation)
  - [Installation in managed Expo projects](#-installation-in-managed-expo-projects)
  - [Installation in bare React Native projects](#-installation-in-bare-react-native-projects)
- [⚙️ Configuration](#️-configuration)
  - [WebView Mode](#webview-mode)
  - [ResponsiveImage Mode](#responsiveimage-mode)
  - [Normal Mode](#normal-mode)
  - [Blend Mode](#blend-mode)
  - [Dark Mode Support](#dark-mode-support)
- [📱 Platform-Specific Details](#-platform-specific-details)
  - [iOS Configuration](#-ios-configuration)
  - [Android Configuration](#-android-configuration)
- [👏 Contributing](#-contributing)
- [❓ Known Issues](#-known-issues)
- [📄 License](#-license)
- [🏅 Hall of Fame](#-hall-of-fame)

## ⚡ Quick Start

Get started with `expo-splash-screen2` in minutes using WebView mode.

### Step 1: Install the Package

```bash
# Remove expo-splash-screen if installed (they are mutually exclusive)
npm uninstall expo-splash-screen

# Install expo-splash-screen2
npm install expo-splash-screen2
# or
pnpm add expo-splash-screen2
# or
yarn add expo-splash-screen2
```

> **Note**: If you're using `pnpm` and see a warning about ignored build scripts, run `pnpm approve-builds` to allow the package to execute its postinstall script.

### Step 2: Configure app.json

Add the plugin to your `app.json` or `app.config.js` with WebView mode:

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

### Step 3: Run Prebuild

After installation, run prebuild to apply native modifications:

```bash
npx expo prebuild
```

### Step 4: Use in Your App

In your main component (e.g., `App.tsx`), prevent the splash screen from auto-hiding and control when to hide it:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
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
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Your App Content</Text>
    </View>
  );
}
```

### Step 5: Customize Your Splash Screen HTML

The plugin automatically copies the `expo-splash-web` folder to your project root. You can customize the HTML splash screen by editing files in `expo-splash-web/src/`:

```bash
# Build the splash web assets
npm run build:expo-splash-web

# Or run in development mode with hot reload
npm run dev:expo-splash-web
```

After making changes, rebuild and run prebuild again:

```bash
npm run build:expo-splash-web
npx expo prebuild
```

### That's It! 🎉

Your app now has a custom WebView-based splash screen. For more advanced configurations and other display modes, see the [Configuration](#️-configuration) section below.

## 🚀 Features

### Display Modes

`expo-splash-screen2` provides four splash screen modes to fit different use cases:

#### `webview` Mode

Display HTML content in a WebView, allowing for complex animations and interactive splash screens.

- Full JavaScript/CSS support
- React component support (with esbuild bundler)
- Perfect for animated splash screens
- JavaScript bridge for native communication

#### `responsiveImage` Mode

Display a full-screen background image that scales to cover the entire screen.

- Supports `.9.png` (Nine-patch) format on Android
- `scaleAspectFill` content mode
- Best for photographic or detailed backgrounds

#### `normal` Mode

Display a centered image with fixed width (default 100px), maintaining aspect ratio.

- Fixed width, auto height
- Centered on screen with background color
- **Supports dark mode** with separate image and background color
- Best for logo-centric splash screens

#### `blend` Mode

Combine a `.9.png` background image with WebView HTML content for enhanced splash screen experience.

- Uses `.9.png` image as system splash screen background
- WebView container uses transparent background (recommended) for seamless transition
- Full HTML/JavaScript/CSS support in WebView overlay
- Perfect for achieving smooth transition from system splash to custom animated splash
- Best for apps requiring both native performance and rich animations

### Dark Mode Support (Normal Mode)

`expo-splash-screen2` supports per-appearance splash screens that respond to system appearance changes on iOS 13+ and Android 10+.

<table>
  <thead><tr><td>Light Mode</td><td>Dark Mode</td></tr></thead>
  <tbody><tr>
    <td>Background: Custom color<br>Image: Light mode image</td>
    <td>Background: Custom dark color<br>Image: Dark mode image</td>
  </tr></tbody>
</table>

### Cross-Platform Support

- **Android**: Full support for Android 12+ system splash screen, custom activities, and seamless transitions
- **iOS**: Native UIView integration, storyboard support, and smooth animations

### StatusBar Customization

`expo-splash-screen2` allows customization of the StatusBar according to the [React Native StatusBar API](https://reactnative.dev/docs/statusbar). You can control StatusBar visibility, style, and background color during the splash screen display.

## 📚 API

```tsx
import * as SplashScreen from 'expo-splash-screen2';
```

The native splash screen that is controlled via this module autohides once the React Native-controlled view hierarchy is mounted. This means that when your app first `render`s view component, the native splash screen will hide. This default behavior can be prevented by calling [`SplashScreen.preventAutoHideAsync()`](#splashscreenpreventautohideasync) and later on [`SplashScreen.hideAsync()`](#splashscreenhideasync).

### `SplashScreen.preventAutoHideAsync()`

This method makes the native splash screen stay visible until [`SplashScreen.hideAsync()`](#splashscreenhideasync) is called. This must be called before any React Native-controlled view hierarchy is rendered (either in the global scope of your main component, or when the component renders `null` at the beginning - see [Examples section](#-examples)).

Preventing default autohiding might come in handy if your application needs to prepare/download some resources and/or make some API calls before first rendering some actual view hierarchy.

> **Important**: It is recommended to call this in global scope without awaiting, rather than inside React components or hooks.

#### Returns

A `Promise` that resolves to `true` when preventing autohiding succeeded and to `false` if the native splash screen is already prevented from autohiding (for instance, if you've already called this method). `Promise` rejection most likely means that native splash screen cannot be prevented from autohiding (it's already hidden when this method was executed).

### `SplashScreen.hideAsync()`

Hides the native splash screen. Only works if the native splash screen has been previously prevented from autohiding by calling [`SplashScreen.preventAutoHideAsync()`](#splashscreenpreventautohideasync) method.

#### Returns

A `Promise` that resolves to `true` once the splash screen becomes hidden and to `false` if the splash screen is already hidden.

## 🗒 Examples

### `SplashScreen.preventAutoHideAsync()` in global scope

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

### Basic Usage

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

### With Expo Router

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

### Demo

See the splash screen modes in action:

#### `webview` Mode

Display HTML content in a WebView with full JavaScript/CSS support.

<table>
  <thead><tr><td>Android</td><td>iOS</td></tr></thead>
  <tbody><tr>
<td>

![WebView Android](./assets/demo/webview-a.gif)

</td>
<td>

![WebView iOS](./assets/demo/webview-i.gif)

</td>
    </tr>
  </tbody>
</table>

#### `responsiveImage` Mode

Display a full-screen background image that scales to cover the entire screen.

<table>
  <thead><tr><td>Android</td><td>iOS</td></tr></thead>
  <tbody><tr>
<td>

![ResponsiveImage Android](./assets/demo/reponsiveimg-a.gif)

</td>
<td>

![ResponsiveImage iOS](./assets/demo/reponsive-i.gif)

</td>
    </tr>
  </tbody>
</table>

#### `normal` Mode

Display a centered image with fixed width, maintaining aspect ratio. Supports dark mode.

<table>
  <thead><tr><td>Android</td><td>iOS</td></tr></thead>
  <tbody><tr>
<td>

![Normal Android](./assets/demo/normal-a.gif)

</td>
<td>

![Normal iOS](./assets/demo/normal-i.gif)

</td>
    </tr>
  </tbody>
</table>

#### `blend` Mode

Combine a `.9.png` background image with WebView HTML content for enhanced splash screen experience. The system splash screen uses the `.9.png` image as background, and the WebView container uses transparent background (recommended) for seamless transition.

**Note**: Blend mode combines the visual appearance of `responsiveImage` mode (`.9.png` background) with the functionality of `webview` mode (HTML content overlay). This creates a smooth transition from the system splash screen to the custom animated splash screen.

## 💻 Installation

### Installation in managed Expo projects

For managed Expo projects, follow the standard installation process:

```bash
# Remove expo-splash-screen if installed (they are mutually exclusive)
npm uninstall expo-splash-screen

# Install expo-splash-screen2
npm install expo-splash-screen2
# or
pnpm add expo-splash-screen2
# or
yarn add expo-splash-screen2
```

> **Note**: `expo-splash-screen` and `expo-splash-screen2` are mutually exclusive. You can only use one of them in your project.

### Installation in bare React Native projects

For bare React Native projects, you must ensure that you have [installed and configured the `expo` package](https://docs.expo.dev/bare/installing-expo-modules/) before continuing.

#### Add the package to your dependencies

```bash
npm install expo-splash-screen2
# or
pnpm add expo-splash-screen2
# or
yarn add expo-splash-screen2
```

#### iOS Setup

Run `npx pod-install` after installing the package:

```bash
npx pod-install
```

#### Android Setup

No additional setup required. The plugin will automatically configure Android during prebuild.

### pnpm Build Script Approval

If you're using `pnpm` and encounter a warning about ignored build scripts:

```
╭ Warning ────────────────────────────────────────────────────────────────────────╮
│                                                                                 │
│   Ignored build scripts: expo-splash-screen2, unrs-resolver.           │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed to     │
│   run scripts.                                                                  │
```

Follow the prompt and run `pnpm approve-builds` to allow `expo-splash-screen2` to execute its postinstall script:

```bash
pnpm approve-builds
```

This will allow the package to run its postinstall script, which is necessary for proper setup.

### Post-installation Setup

After installation, the plugin will automatically:
1. Copy `expo-splash-web` folder to your project root
2. Add build commands to your `package.json`
3. Update your `app.json` with plugin configuration
4. Remove `expo-splash-screen` dependency from `package.json`

**If you're using pnpm and the postinstall script doesn't run automatically**, you can manually run the setup script:

```bash
# From your project root directory
node node_modules/expo-splash-screen2/scripts/setup.js
```

After installation (or manual setup), run prebuild to apply native modifications:

```bash
npx expo prebuild
```

## ⚙️ Configuration

Add the plugin to your `app.json` or `app.config.js`:

### WebView Mode

Display HTML content with full JavaScript/CSS support:

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

> **Note**: For `webview` and `blend` modes, you must install `react-native-web` to build web files:
> ```bash
> npm install react-native-web
> # or
> pnpm add react-native-web
> # or
> yarn add react-native-web
> ```

#### WebView Mode Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `mode` | `"webview"` | Yes | Enable WebView HTML mode |
| `backgroundColor` | `string` | No | Background color (default: `#ffffff`) |
| `localHtmlPath` | `string` | No | Path to custom HTML file |

### ResponsiveImage Mode

Display a full-screen background image:

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

#### ResponsiveImage Mode Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `mode` | `"responsiveImage"` | Yes | Enable responsive image mode |
| `backgroundColor` | `string` | No | Background color (default: `#ffffff`) |
| `image` | `string` | Yes | Path to background image (supports `.9.png`) |

### Normal Mode

Display a centered image with fixed width:

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

#### Normal Mode Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `mode` | `"normal"` | Yes | Enable normal (centered image) mode |
| `backgroundColor` | `string` | No | Background color (default: `#ffffff`) |
| `image` | `string` | Yes | Path to splash icon image |
| `imageWidth` | `number` | No | Image width in dp/pt (default: `100`) |
| `dark` | `object` | No | Dark mode configuration |

### Blend Mode

Combine a `.9.png` background image with WebView HTML content for enhanced splash screen experience:

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

> **Note**: For `webview` and `blend` modes, you must install `react-native-web` to build web files:
> ```bash
> npm install react-native-web
> # or
> pnpm add react-native-web
> # or
> yarn add react-native-web
> ```

#### Blend Mode Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `mode` | `"blend"` | Yes | Enable blend mode (`.9.png` background + WebView) |
| `image` | `string` | Yes | Path to background image (supports `.9.png`) |
| `localHtmlPath` | `string` | No | Path to custom HTML file |

**How Blend Mode Works:**

- **System Splash Screen**: Uses `.9.png` image as background (Android 12+ system splash screen)
- **WebView Container**: Uses transparent background (recommended) to show the system splash screen background for seamless visual continuity
- **HTML Overlay**: Displays custom HTML content in WebView on top of the background
- **Transition**: Smooth transition from system splash to WebView splash without visual gaps

This mode is ideal when you want:
- Native performance of system splash screen
- Rich animations and interactivity from HTML/WebView
- Seamless visual transition between system and custom splash screens

### Dark Mode Support

Enable dark mode support in `normal` mode by adding the `dark` configuration:

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

#### Dark Mode Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dark.backgroundColor` | `string` | No | Dark mode background color |
| `dark.image` | `string` | No | Dark mode image (can be same as light mode) |

When dark mode is enabled:
- **Android**: Images are placed in `drawable/` and `drawable-night/` directories
- **iOS**: App detects system appearance and switches colors/images accordingly
- **Runtime switching**: Both platforms support runtime theme changes

## 📱 Platform-Specific Details

### 📱 iOS Configuration

The plugin automatically:

1. Copies splash images to the iOS bundle
2. Modifies `AppDelegate.swift` to display the splash screen
3. Sets up dark mode detection using `UITraitCollection`
4. Adds `UIApplication.didBecomeActiveNotification` observer for runtime theme changes

#### Resource Locations

- Light mode image: `ios/{projectName}/splash-icon.{ext}`
- Dark mode image: `ios/{projectName}/splash-icon-dark.{ext}`

### Manual iOS Configuration

The plugin automatically handles iOS configuration, but if you need to manually configure or understand how it works, here are the details for each mode:

#### WebView Mode

For WebView mode, the plugin:

1. **Modifies `SplashScreen.storyboard`**: Sets background color and optional centered image
2. **Copies HTML files**: Places HTML files from `expo-splash-web/dist` or `localHtmlPath` to `ios/{projectName}/` directory
3. **Modifies `AppDelegate.swift`**: Adds code to display WebView overlay with HTML content
4. **Creates Asset Catalog**: Creates `SplashScreenBackground` colorset for background color

**Manual steps** (if needed):

1. Copy HTML file to `ios/{projectName}/index.html`
2. Modify `SplashScreen.storyboard` to set background color using `SplashScreenBackground` colorset
3. Modify `AppDelegate.swift` to add WebView container code (see plugin source for template)
4. Ensure `SplashScreen.storyboard` is set as Launch Screen File in Xcode project settings

#### ResponsiveImage Mode

For ResponsiveImage mode, the plugin:

1. **Copies background image**: Places image file as `splash_background_image.{ext}` in `ios/{projectName}/` directory
2. **Modifies `SplashScreen.storyboard`**: Sets full-screen background image with `scaleAspectFill` content mode
3. **Modifies `AppDelegate.swift`**: Adds image container view
4. **Adds file reference**: Adds image file to Xcode project

**Manual steps** (if needed):

1. Copy background image to `ios/{projectName}/splash_background_image.{ext}`
2. Modify `SplashScreen.storyboard`:
   - Set Image View to use `splash_background_image` image
   - Set Content Mode to `Aspect Fill` for full-screen coverage
   - Set background color (fallback)
3. Modify `AppDelegate.swift` to add image container view
4. Add image file to Xcode project file references

#### Normal Mode

For Normal mode, the plugin:

1. **Creates Asset Catalog imageset**: Creates `splash-icon` imageset in `Images.xcassets` (supports dark mode if configured)
2. **Creates Asset Catalog colorset**: Creates `SplashScreenBackground` colorset (supports dark mode if configured)
3. **Modifies `SplashScreen.storyboard`**: Sets background color and centered image with fixed width
4. **Modifies `AppDelegate.swift`**: Adds image container view with fixed width constraints

**Manual steps** (if needed):

1. Create `splash-icon` imageset in `Images.xcassets`:
   - Add light mode image
   - If dark mode enabled, add dark mode image in `Any, Dark` appearance
2. Create `SplashScreenBackground` colorset in `Images.xcassets`:
   - Set light mode color
   - If dark mode enabled, set dark mode color in `Any, Dark` appearance
3. Modify `SplashScreen.storyboard`:
   - Set Image View to use `splash-icon` image
   - Set Content Mode to `Aspect Fit`
   - Set background to use `SplashScreenBackground` colorset
   - Add width constraint (default 100pt) to Image View
4. Modify `AppDelegate.swift` to add image container view with width constraints

#### Blend Mode

For Blend mode, the plugin:

1. **Copies background image**: Places `.9.png` image file as `splash_background_image.{ext}` in `ios/{projectName}/` directory
2. **Copies HTML files**: Places HTML files from `expo-splash-web/dist` or `localHtmlPath` to `ios/{projectName}/` directory
3. **Modifies `SplashScreen.storyboard`**: Sets full-screen background image with `scaleAspectFill` content mode (same as ResponsiveImage mode)
4. **Modifies `AppDelegate.swift`**: Adds WebView overlay code with transparent background (recommended)

**Manual steps** (if needed):

1. Copy `.9.png` background image to `ios/{projectName}/splash_background_image.{ext}`
2. Copy HTML file to `ios/{projectName}/index.html`
3. Modify `SplashScreen.storyboard`:
   - Set Image View to use `splash_background_image` image
   - Set Content Mode to `Aspect Fill` for full-screen coverage
   - Set background color (fallback)
4. Modify `AppDelegate.swift`:
   - Add WebView container code (see plugin source for template)
   - Set WebView container background to transparent (recommended) for seamless transition
5. Add image and HTML files to Xcode project file references

### 🤖 Android Configuration

The plugin automatically:

1. Copies splash images to Android drawable directories
2. Modifies `MainActivity.kt` to display the splash screen
3. Creates `values/colors.xml` and `values-night/colors.xml` for dark mode
4. Sets up `Configuration.UI_MODE_NIGHT_MASK` detection

#### Resource Locations

- Light mode image: `android/app/src/main/res/drawable/splash_icon.png`
- Dark mode image: `android/app/src/main/res/drawable-night/splash_icon.png`
- Light colors: `android/app/src/main/res/values/colors.xml`
- Dark colors: `android/app/src/main/res/values-night/colors.xml`

### Manual Android Configuration

The plugin automatically handles Android configuration, but if you need to manually configure or understand how it works, here are the details for each mode:

#### WebView Mode

For WebView mode, the plugin:

1. **Copies HTML file**: Places HTML file from `expo-splash-web/dist/index.html` or `localHtmlPath` to `android/app/src/main/assets/index.html`
2. **Copies icon** (optional): If `image` is configured, copies icon to `android/app/src/main/res/drawable-xxhdpi/ic_splash_icon.png`
3. **Creates CustomSplashActivity**: Generates `SplashScreen2Activity.kt` for displaying WebView
4. **Modifies AndroidManifest.xml**: Adds `SplashScreen2Activity` as launcher activity
5. **Modifies MainActivity.kt**: Adds WebView container code and methods
6. **Modifies styles.xml**: Updates `Theme.App.SplashScreen` and adds `Theme.App.MainActivity`
7. **Creates colors.xml**: Creates color resources for background color
8. **Updates build.gradle**: Adds `androidx.core:core-splashscreen` dependency

**Manual steps** (if needed):

1. Copy HTML file to `android/app/src/main/assets/index.html`
2. Create `SplashScreen2Activity.kt` in `android/app/src/main/java/{packageName}/` (see plugin templates)
3. Modify `AndroidManifest.xml`:
   - Add `SplashScreen2Activity` as launcher activity
   - Set `MainActivity` theme to `Theme.App.MainActivity`
4. Modify `MainActivity.kt` to add WebView container code
5. Update `res/values/styles.xml` with splash screen themes
6. Create `res/values/colors.xml` with `splashscreen_background` color
7. Add `androidx.core:core-splashscreen:1.0.1` dependency to `build.gradle`

#### ResponsiveImage Mode

For ResponsiveImage mode, the plugin:

1. **Copies background image**: Places image as `splash_background_image.{ext}` in `android/app/src/main/res/drawable/` (supports `.9.png`)
2. **Updates ic_launcher_background.xml**: Modifies to show background image only
3. **Creates colors.xml**: Creates `splashscreen_background` color resource
4. **Modifies styles.xml**: Updates `Theme.App.SplashScreen` to use background image
5. **Modifies MainActivity.kt**: Adds image container view for full-screen display

**Manual steps** (if needed):

1. Copy background image to `android/app/src/main/res/drawable/splash_background_image.{ext}`
2. Update `res/drawable/ic_launcher_background.xml`:
   ```xml
   <layer-list xmlns:android="http://schemas.android.com/apk/res/android">
     <item android:drawable="@drawable/splash_background_image"/>
   </layer-list>
   ```
3. Create `res/values/colors.xml`:
   ```xml
   <resources>
     <color name="splashscreen_background">#FFFFFF</color>
   </resources>
   ```
4. Update `res/values/styles.xml`:
   ```xml
   <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
     <item name="android:windowBackground">@drawable/ic_launcher_background</item>
   </style>
   ```
5. Modify `MainActivity.kt` to add image container view

#### Normal Mode

For Normal mode, the plugin:

1. **Copies icon image**: Places image as `splash_icon.{ext}` in `android/app/src/main/res/drawable-xxhdpi/`
2. **Copies dark icon** (if dark mode enabled): Places dark image in `android/app/src/main/res/drawable-night-xxhdpi/`
3. **Creates splashscreen_logo**: Creates drawable resource for system splash screen
4. **Creates colors.xml**: Creates `splashscreen_background` color (supports dark mode in `values-night/colors.xml`)
5. **Modifies MainActivity.kt**: Adds image container view with fixed width constraints

**Manual steps** (if needed):

1. Copy icon image to `android/app/src/main/res/drawable-xxhdpi/splash_icon.{ext}`
2. If dark mode enabled, copy dark icon to `android/app/src/main/res/drawable-night-xxhdpi/splash_icon.{ext}`
3. Create `res/drawable/splashscreen_logo.xml`:
   ```xml
   <layer-list xmlns:android="http://schemas.android.com/apk/res/android">
     <item android:drawable="@color/splashscreen_background"/>
     <item>
       <bitmap android:gravity="center" android:src="@drawable/splash_icon"/>
     </item>
   </layer-list>
   ```
4. Create `res/values/colors.xml`:
   ```xml
   <resources>
     <color name="splashscreen_background">#FFFFFF</color>
   </resources>
   ```
5. If dark mode enabled, create `res/values-night/colors.xml`:
   ```xml
   <resources>
     <color name="splashscreen_background">#000000</color>
   </resources>
   ```
6. Update `res/values/styles.xml`:
   ```xml
   <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
     <item name="android:windowBackground">@drawable/splashscreen_logo</item>
   </style>
   ```
7. Modify `MainActivity.kt` to add image container view with fixed width (default 100dp)

#### Blend Mode

For Blend mode, the plugin:

1. **Copies background image**: Places `.9.png` image as `splash_background_image.{ext}` in `android/app/src/main/res/drawable/`
2. **Copies HTML file**: Places HTML file from `expo-splash-web/dist/index.html` or `localHtmlPath` to `android/app/src/main/assets/index.html`
3. **Creates CustomSplashActivity**: Generates `SplashScreen2Activity.kt` with transparent WebView container background (recommended)
4. **Modifies AndroidManifest.xml**: Adds `SplashScreen2Activity` as launcher activity, sets `MainActivity` theme to `Theme.App.SplashScreen`
5. **Modifies MainActivity.kt**: Adds WebView container code with transparent background (recommended)
6. **Modifies styles.xml**: Updates `Theme.App.SplashScreen` to use `.9.png` background image
7. **Creates colors.xml**: Creates `splashscreen_background` color resource
8. **Updates build.gradle**: Adds `androidx.core:core-splashscreen` dependency

**Manual steps** (if needed):

1. Copy `.9.png` background image to `android/app/src/main/res/drawable/splash_background_image.{ext}`
2. Copy HTML file to `android/app/src/main/assets/index.html`
3. Create `SplashScreen2Activity.kt` in `android/app/src/main/java/{packageName}/`:
   - Set WebView container background to transparent (recommended, see plugin templates)
4. Modify `AndroidManifest.xml`:
   - Add `SplashScreen2Activity` as launcher activity
   - Set `MainActivity` theme to `Theme.App.SplashScreen` (same as splash screen theme)
5. Modify `MainActivity.kt`:
   - Add WebView container code
   - Set WebView container background to transparent (recommended) for seamless transition
6. Update `res/values/styles.xml`:
   ```xml
   <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
     <item name="android:windowBackground">@drawable/splash_background_image</item>
   </style>
   ```
7. Create `res/values/colors.xml`:
   ```xml
   <resources>
     <color name="splashscreen_background">#FFFFFF</color>
   </resources>
   ```
8. Add `androidx.core:core-splashscreen:1.0.1` dependency to `build.gradle`

### Manual Regeneration

If you need to regenerate native projects with the latest plugin changes:

```bash
# Clean and regenerate
npx expo prebuild --clean

# Or for specific platform
npx expo prebuild --clean --platform android
npx expo prebuild --clean --platform ios
```

## 👏 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## ❓ Known Issues

### iOS Caching

Splash screens on iOS can sometimes encounter a caching issue where the previous image will flash before showing the new image. When this occurs, try:
1. Power cycling your device
2. Uninstalling and re-installing the application
3. Running `npx expo prebuild --clean`

### Node Modules Caching

If plugin changes aren't being applied, try:

```bash
cd your-project
rm -rf node_modules/expo-splash-screen2
npm install  # or pnpm install
npx expo prebuild --clean
```

### Dark Mode Not Working

Ensure:
1. Your `app.json` has the `dark` configuration in `normal` mode
2. You've run `npx expo prebuild --clean` after configuration changes
3. Both light and dark images exist at the specified paths

### Android 12+ System Default Splash Screen


**Note: Android 12+ System Default Behavior**

If your app runs on Android 12 or higher and your `targetSdkVersion` is not below 30, the system will display a default splash screen. This is the default behavior of Android and may result in two splash screens appearing (system default splash + custom splash).

If you don't want to show the system default splash screen, you can use either of the following methods:

**Method 1: Make the default splash transparent**

Add the following to your Activity theme in `AndroidManifest.xml`:

```xml
<item name="android:windowIsTranslucent">true</item>
```

**Method 2: Adjust targetSdkVersion**

Set `androidTargetSdkVersion` to 30 or lower to hide the system default splash screen.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

This module is based on [expo-splash-screen](https://github.com/expo/expo/tree/main/packages/expo-splash-screen), which is also licensed under the MIT License.

## 🏅 Hall of Fame

This module is based on a solid work from (many thanks for that 👏):

- [expo-splash-screen](https://github.com/expo/expo/tree/main/packages/expo-splash-screen)

