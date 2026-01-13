# Configuration

Add the plugin to your `app.json` or `app.config.js`:

## WebView Mode

Display HTML content in a WebView, allowing for complex animations and interactive splash screens.

- Full JavaScript/CSS support
- React component support (with esbuild bundler)
- Perfect for animated splash screens
- JavaScript bridge for native communication

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

### WebView Mode Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `mode` | `"webview"` | Yes | Enable WebView HTML mode |
| `backgroundColor` | `string` | No | Background color (default: `#ffffff`) |
| `localHtmlPath` | `string` | No | Path to custom HTML file |

## ResponsiveImage Mode

Display a full-screen background image that scales to cover the entire screen.

- Supports `.9.png` (Nine-patch) format on Android
- `scaleAspectFill` content mode
- Best for photographic or detailed backgrounds

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

### ResponsiveImage Mode Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `mode` | `"responsiveImage"` | Yes | Enable responsive image mode |
| `backgroundColor` | `string` | No | Background color (default: `#ffffff`) |
| `image` | `string` | Yes | Path to background image (supports `.9.png`) |

## Normal Mode

Display a centered image with fixed width (default 100px), maintaining aspect ratio.

- Fixed width, auto height
- Centered on screen with background color
- **Supports dark mode** with separate image and background color
- Best for logo-centric splash screens

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

### Normal Mode Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `mode` | `"normal"` | Yes | Enable normal (centered image) mode |
| `backgroundColor` | `string` | No | Background color (default: `#ffffff`) |
| `image` | `string` | Yes | Path to splash icon image |
| `imageWidth` | `number` | No | Image width in dp/pt (default: `100`) |
| `dark` | `object` | No | Dark mode configuration |

## Blend Mode

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

### Blend Mode Options

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

## Dark Mode Support

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

### Dark Mode Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dark.backgroundColor` | `string` | No | Dark mode background color |
| `dark.image` | `string` | No | Dark mode image (can be same as light mode) |

When dark mode is enabled:
- **Android**: Images are placed in `drawable/` and `drawable-night/` directories
- **iOS**: App detects system appearance and switches colors/images accordingly
- **Runtime switching**: Both platforms support runtime theme changes
