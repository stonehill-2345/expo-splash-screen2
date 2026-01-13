# expo-splash-screen2

`expo-splash-screen2` allows you to customize your app's splash screen with multiple display modes including WebView HTML, .9 image, background+WebView blend mode, and icon+background color mode. It supports dark mode and provides a seamless transition experience.

> **English** | [中文文档](./README.zh.md)

### Key features

- 🎨 **Multiple Display Modes**: WebView HTML, .9 image, background+WebView blend mode, and icon+background color mode
- 🚀 **Custom Complex Splash**: Use WebView or Blend mode to create complex splash screens (privacy dialogs, animations, etc.)
- 📦 **Ready-to-Use Templates**: Complete WebView HTML template files with dev and build support
- 🎯 **Easy Integration**: Simple configuration with automatic native code generation

### Installation

#### Quick Start

1. **Install the package:**

```bash
# Remove expo-splash-screen if installed (they are mutually exclusive)
npm uninstall expo-splash-screen

# Install expo-splash-screen2
yarn add expo-splash-screen2
# or
npm install expo-splash-screen2
# or
pnpm add expo-splash-screen2
```

> **Note**: If using `pnpm` and you see a warning about ignored build scripts, run `pnpm approve-builds`.

2. **Configure `app.json`:**

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

3. **Run prebuild:**

```bash
npx expo prebuild
```

4. **Use in your app:**

```tsx
import * as SplashScreen from 'expo-splash-screen2';

// Prevent native splash screen from autohiding
SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    // Hide splash screen when ready
    SplashScreen.hideAsync();
  }, []);

  return <YourAppContent />;
}
```

For detailed setup instructions and other modes, check out the [installation guide](./docs/installation.md).

### Documentation

Full API reference and guides available at:

- [Installation Guide](./docs/installation.md)
- [Configuration](./docs/configuration.md)
- [API Reference](./docs/api.md)
- [Examples](./docs/examples.md)
- [Platform-Specific Details](./docs/platform-specific.md)
- [Known Issues](./docs/known-issues.md)

### Contributing

See the [contributing guide](./CONTRIBUTING.md) to learn how to contribute to the repo and development workflow.

### License

MIT

This module is based on [expo-splash-screen](https://github.com/expo/expo/tree/main/packages/expo-splash-screen), which is also licensed under the MIT License.

### Hall of Fame

This module is based on a solid work from (many thanks for that 👏):

- [expo-splash-screen](https://github.com/expo/expo/tree/main/packages/expo-splash-screen)
