# Demo Modal Usage Guide

This example project demonstrates how to use the `expo-splash-screen2` plugin to implement custom splash screen functionality. The project supports two modes: **Image Mode** and **WebView Mode**.

## Quick Start

### 1. Install Dependencies

First, install all required dependencies for the project:

```bash
npm install
```

### 2. Configure Splash Mode

Choose a splash screen mode based on your needs and execute the corresponding script to switch configurations:

#### Image Mode

Use a static image as the splash screen background:

```bash
npm run switch:app-image
```

This command will switch `app.json` to image mode configuration, using the `backgroundImage` property to specify the background image.

#### WebView Mode

Use HTML/WebView as the splash screen (supports animations and interactions):

```bash
npm run switch:app-webview
```

This command will switch `app.json` to WebView mode configuration, using HTML files from the `splash-web` directory.

### 3. Configure Splash Screen Content (WebView Mode)

If you've chosen WebView mode, you need to select a splash screen example template:

#### No Modal Example

Use a splash screen template without a privacy agreement modal:

```bash
npm run switch:splash-animate
```

This command will copy the contents of the `splash-web-animate` directory to the `splash-web` directory.

#### With Modal Example

Use a splash screen template with a privacy agreement modal:

```bash
npm run switch:splash-modal
```

This command will copy the contents of the `splash-web-modal` directory to the `splash-web` directory.

### 4. Preview and Build Splash Screen (WebView Mode)

In WebView mode, you can preview and build the splash screen HTML content:

#### Development Mode Preview

Start the development server to preview the splash screen in real-time:

```bash
npm run dev:splash
```

#### Build Production Version

Build optimized splash screen files:

```bash
npm run build:splash
```

After building, files will be output to the `splash-web/dist` directory.

### 5. Generate Native Projects

Use the Expo prebuild command to generate iOS and Android native projects:

```bash
npx expo prebuild
```

> **Note**: If you've already generated native projects before, it's recommended to use the `--clean` parameter to clean and regenerate:
> ```bash
> npx expo prebuild --clean
> ```

### 6. Build and Run

After generating native projects, you can build and run the application:

#### iOS

```bash
npm run ios
```

#### Android

```bash
npm run android
```

## Script Reference

The project provides the following convenient scripts for switching configurations:

| Script | Description |
|--------|-------------|
| `switch:app-image` | Switch to image mode configuration |
| `switch:app-webview` | Switch to WebView mode configuration |
| `switch:splash-animate` | Use splash screen template without modal |
| `switch:splash-modal` | Use splash screen template with modal |
| `dev:splash` | Start splash screen development server (WebView mode) |
| `build:splash` | Build splash screen files (WebView mode) |

## Notes

1. **Mode Switching**: After switching modes, it's recommended to re-run `npx expo prebuild --clean` to ensure native code is generated correctly.

2. **Image Mode**: Image mode doesn't require the `splash-web` directory and directly uses the configured `backgroundImage` path.

3. **WebView Mode**: WebView mode requires ensuring the `splash-web` directory exists and contains valid HTML files.

4. **Configuration Backup**: Switching scripts automatically backup the current `app.json` as `app.json.backup`. You can use the backup file to restore if needed.

## Project Structure

```
demo-modal/
├── app.json                 # Expo configuration file
├── app-image.json          # Image mode configuration template
├── app-webview.json        # WebView mode configuration template
├── splash-web/             # WebView mode splash screen files (generated at runtime)
├── splash-web-animate/     # Splash screen template without modal
├── splash-web-modal/       # Splash screen template with modal
├── switch-app.js           # Script to switch app.json configuration
└── switch-splash.js        # Script to switch splash screen template
```

## More Information

For detailed configuration options and usage methods of the plugin, please refer to the main project documentation.
