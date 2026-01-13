# Installation

## Installation in managed Expo projects

For managed Expo projects, follow the standard installation process:

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

> **Note**: `expo-splash-screen` and `expo-splash-screen2` are mutually exclusive. You can only use one of them in your project.

## Installation in bare React Native projects

For bare React Native projects, you must ensure that you have [installed and configured the `expo` package](https://docs.expo.dev/bare/installing-expo-modules/) before continuing.

### Add the package to your dependencies

```bash

yarn add expo-splash-screen2
# or
npm install expo-splash-screen2
# or
pnpm add expo-splash-screen2


```

### iOS Setup

Run `npx pod-install` after installing the package:

```bash
npx pod-install
```

### Android Setup

No additional setup required. The plugin will automatically configure Android during prebuild.

## pnpm Build Script Approval

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

## Post-installation Setup

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

## Quick Start

Get started with `expo-splash-screen2` in minutes using WebView mode.

### Step 1: Install the Package

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

Your app now has a custom WebView-based splash screen. For more advanced configurations and other display modes, see the [Configuration](./configuration.md) guide.
