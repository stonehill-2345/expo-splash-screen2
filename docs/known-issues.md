# Known Issues

## iOS Caching

Splash screens on iOS can sometimes encounter a caching issue where the previous image will flash before showing the new image. When this occurs, try:
1. Power cycling your device
2. Uninstalling and re-installing the application
3. Running `npx expo prebuild --clean`

## Node Modules Caching

If plugin changes aren't being applied, try:

```bash
cd your-project
rm -rf node_modules/expo-splash-screen2
npm install  # or pnpm install
npx expo prebuild --clean
```

## Dark Mode Not Working

Ensure:
1. Your `app.json` has the `dark` configuration in `normal` mode
2. You've run `npx expo prebuild --clean` after configuration changes
3. Both light and dark images exist at the specified paths

## Android 12+ System Default Splash Screen

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
