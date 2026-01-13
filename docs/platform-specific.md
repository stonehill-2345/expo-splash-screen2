# Platform-Specific Details

## iOS Configuration

The plugin automatically:

1. Copies splash images to the iOS bundle
2. Modifies `AppDelegate.swift` to display the splash screen
3. Sets up dark mode detection using `UITraitCollection`
4. Adds `UIApplication.didBecomeActiveNotification` observer for runtime theme changes

### Resource Locations

- Light mode image: `ios/{projectName}/splash-icon.{ext}`
- Dark mode image: `ios/{projectName}/splash-icon-dark.{ext}`

### Manual iOS Configuration

The plugin automatically handles iOS configuration, but if you need to manually configure or understand how it works, here are the details for each mode:

#### WebView Mode

For WebView mode, the plugin:

1. **Modifies `SplashScreen.storyboard`**: Sets background color and optional centered image (if `image` is configured)
2. **Copies HTML file**: Places HTML file from `expo-splash-web/dist/index.html` or `localHtmlPath` to `ios/{projectName}/index.html`
3. **Copies icon** (optional): If `image` is configured, copies icon to `ios/{projectName}/splash-icon.{ext}`
4. **Creates Asset Catalog colorset**: Creates `SplashScreenBackground` colorset in `Images.xcassets` (if `image` is configured)
5. **Modifies `AppDelegate.swift`**: Adds WebView container code with `SplashScreen2Service.shared.showSplashScreenFor()` call
6. **Generates ExpoSplashHtml.podspec**: Creates podspec file in `ios/` directory
7. **Generates fix-splash-module.sh**: Creates script to auto-register module in ExpoModulesProvider

**Manual steps** (if needed):

1. Copy HTML file to `ios/{projectName}/index.html`
2. If `image` is configured:
   - Copy icon to `ios/{projectName}/splash-icon.{ext}`
   - Create `SplashScreenBackground` colorset in `Images.xcassets` with background color
3. Modify `SplashScreen.storyboard`:
   - Set background color using `SplashScreenBackground` colorset (if created)
   - If `image` is configured, add Image View with `splash-icon` image, Content Mode `Aspect Fit`, and width constraint (default 100pt)
4. Modify `AppDelegate.swift`:
   - Add import: `import ExpoSplashHtml`
   - Add protocol conformance: `AppDelegateProtocol`
   - Add properties: `rnRootViewController`, `savedFactory`, `savedLaunchOptions`, `isReactNativeStarting`
   - Add `startReactNativeIfNeeded()` method
   - Add code in `didFinishLaunchingWithOptions` to create temporary rootViewController and call `SplashScreen2Service.shared.showSplashScreenFor()`
   - Add code to set `SplashScreen2ViewController.appDelegate = self`
5. Ensure `SplashScreen.storyboard` is set as Launch Screen File in Xcode project settings
6. Add `ExpoSplashHtml` pod reference (if not automatically added)

#### ResponsiveImage Mode

For ResponsiveImage mode, the plugin:

1. **Copies background image**: Places image file as `splash_background_image.{ext}` in `ios/{projectName}/` directory (supports `.9.png`)
2. **Modifies `SplashScreen.storyboard`**: Sets full-screen background image with `scaleAspectFill` content mode
3. **Modifies `AppDelegate.swift`**: Adds image container view (`splashImageViewContainer`) with `setupSplashImageView()` method
4. **Adds file reference**: Adds image file to Xcode project

**Manual steps** (if needed):

1. Copy background image to `ios/{projectName}/splash_background_image.{ext}` (supports `.9.png` format)
2. Modify `SplashScreen.storyboard`:
   - Set Image View to use `splash_background_image` image
   - Set Content Mode to `Aspect Fill` for full-screen coverage
   - Set background color (fallback)
3. Modify `AppDelegate.swift`:
   - Add imports: `UIKit`, `WebKit` (if needed)
   - Add `splashImageViewContainer` property and `setupSplashImageView()` method
   - Add `enablePreventAutoHide()` and `hideSplashImageViewContainer()` methods
   - Add code in `didFinishLaunchingWithOptions` to call `setupSplashImageView()` using `Handler.post`
4. Add image file to Xcode project file references

#### Normal Mode

For Normal mode, the plugin:

1. **Creates Asset Catalog imageset**: Creates `splash-icon` imageset in `Images.xcassets` (supports dark mode if configured)
2. **Creates Asset Catalog colorset**: Creates `SplashScreenBackground` colorset in `Images.xcassets` (supports dark mode if configured)
3. **Modifies `SplashScreen.storyboard`**: Sets background color using `SplashScreenBackground` colorset and centered image with fixed width (default 100pt)
4. **Modifies `AppDelegate.swift`**: Adds image container view (`splashNormalImageContainer`) with fixed width constraints and dark mode support

**Manual steps** (if needed):

1. Create `splash-icon` imageset in `Images.xcassets`:
   - Add light mode image to `splash-icon.imageset/`
   - If dark mode enabled, add dark mode image in `Any, Dark` appearance
2. Create `SplashScreenBackground` colorset in `Images.xcassets`:
   - Set light mode color
   - If dark mode enabled, set dark mode color in `Any, Dark` appearance
3. Modify `SplashScreen.storyboard`:
   - Set Image View to use `splash-icon` image from Asset Catalog
   - Set Content Mode to `Aspect Fit`
   - Set background to use `SplashScreenBackground` colorset
   - Add width constraint (default 100pt) to Image View
4. Modify `AppDelegate.swift`:
   - Add imports: `UIKit` (if needed)
   - Add `splashNormalImageContainer` property
   - Add `setupSplashNormalImage()`, `hideSplashImageViewContainerInternal()`, `isDarkMode()`, `getCurrentBackgroundColor()`, and `updateSplashAppearance()` methods
   - Add `onConfigurationChanged()` override for dark mode switching
   - Add code in `didFinishLaunchingWithOptions` to call `setupSplashNormalImage()` using `Handler.post`

#### Blend Mode

For Blend mode, the plugin:

1. **Copies background image**: Places `.9.png` image file as `splash_background_image.{ext}` in `ios/{projectName}/` directory
2. **Copies HTML file**: Places HTML file from `expo-splash-web/dist/index.html` or `localHtmlPath` to `ios/{projectName}/index.html`
3. **Modifies `SplashScreen.storyboard`**: Sets full-screen background image with `scaleAspectFill` content mode (same as ResponsiveImage mode)
4. **Modifies `AppDelegate.swift`**: Adds WebView overlay code using `SplashScreen2Service.shared.showSplashScreenFor()` with transparent background (recommended)

**Manual steps** (if needed):

1. Copy `.9.png` background image to `ios/{projectName}/splash_background_image.{ext}`
2. Copy HTML file to `ios/{projectName}/index.html`
3. Modify `SplashScreen.storyboard`:
   - Set Image View to use `splash_background_image` image
   - Set Content Mode to `Aspect Fill` for full-screen coverage
   - Set background color (fallback)
4. Modify `AppDelegate.swift`:
   - Add import: `import ExpoSplashHtml`
   - Add protocol conformance: `AppDelegateProtocol`
   - Add properties: `rnRootViewController`, `savedFactory`, `savedLaunchOptions`, `isReactNativeStarting`
   - Add `startReactNativeIfNeeded()` method
   - Add code in `didFinishLaunchingWithOptions` to create temporary rootViewController and call `SplashScreen2Service.shared.showSplashScreenFor()`
   - Set WebView container background to transparent (recommended) for seamless transition
5. Add image and HTML files to Xcode project file references
6. Ensure `SplashScreen.storyboard` is set as Launch Screen File in Xcode project settings

## Android Configuration

The plugin automatically:

1. Copies splash images to Android drawable directories
2. Modifies `MainActivity.kt` to display the splash screen
3. Creates `values/colors.xml` and `values-night/colors.xml` for dark mode
4. Sets up `Configuration.UI_MODE_NIGHT_MASK` detection

### Resource Locations

- Light mode image: `android/app/src/main/res/drawable/splash_icon.png`
- Dark mode image: `android/app/src/main/res/drawable-night/splash_icon.png`
- Light colors: `android/app/src/main/res/values/colors.xml`
- Dark colors: `android/app/src/main/res/values-night/colors.xml`

### Manual Android Configuration

The plugin automatically handles Android configuration, but if you need to manually configure or understand how it works, here are the details for each mode:

#### WebView Mode

For WebView mode, the plugin:

1. **Copies HTML file**: Places HTML file from `expo-splash-web/dist/index.html` or `localHtmlPath` to `android/app/src/main/assets/index.html`
2. **Copies icon** (optional): If `image` is configured, copies icon to multiple density directories and creates `splashscreen_logo.xml` in `res/drawable/`
3. **Updates ic_launcher_background.xml**: Updates to show background color and optional centered icon
4. **Creates colors.xml**: Creates `splashscreen_background` color resource in `res/values/colors.xml`
5. **Generates SplashScreen2Activity.kt**: Creates `SplashScreen2Activity.kt` in `android/app/src/main/java/{packageName}/` for displaying WebView
6. **Generates SplashScreen2PrivacyPolicyActivity.kt**: Creates privacy policy activity
7. **Modifies AndroidManifest.xml**: Adds `SplashScreen2Activity` as launcher activity, sets `MainActivity` theme to `Theme.App.MainActivity`
8. **Modifies MainActivity.kt**: Adds WebView container code with `setupWebViewContainer()`, `hideWebViewContainer()`, and `preventAutoHide()` methods
9. **Modifies styles.xml**: Updates `Theme.App.SplashScreen` to use `@drawable/splashscreen_logo` and adds `Theme.App.MainActivity` with solid background color
10. **Updates build.gradle**: Adds `androidx.core:core-splashscreen:1.0.1` dependency

**Manual steps** (if needed):

1. Copy HTML file to `android/app/src/main/assets/index.html`
2. If `image` is configured:
   - Copy icon to `android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png` (and other density directories)
   - Create `res/drawable/splashscreen_logo.xml` referencing the icon with fixed width
3. Update `res/drawable/ic_launcher_background.xml` to show background color and optional icon
4. Create `res/values/colors.xml` with `splashscreen_background` color
5. Create `SplashScreen2Activity.kt` in `android/app/src/main/java/{packageName}/` (see plugin templates in `plugin/src/templates/android.ts`)
6. Create `SplashScreen2PrivacyPolicyActivity.kt` in the same directory
7. Modify `AndroidManifest.xml`:
   - Add `SplashScreen2Activity` as launcher activity with `android:theme="@style/Theme.App.SplashScreen"`
   - Remove launcher intent-filter from `MainActivity`
   - Set `MainActivity` theme to `Theme.App.MainActivity`
8. Modify `MainActivity.kt`:
   - Add imports: `android.os.Build`, `android.os.Handler`, `android.os.Looper`, `android.view.View`, `android.view.ViewGroup`, `android.webkit.WebView`, `android.webkit.WebViewClient`, `androidx.core.view.WindowCompat`
   - Add companion object with `actionStart()` method
   - Add WebView container properties and methods (see plugin templates)
   - Add code in `onCreate()` to set up WebView container
9. Update `res/values/styles.xml`:
   - Update `Theme.App.SplashScreen` to use `@drawable/splashscreen_logo` as `android:windowBackground`
   - Add `Theme.App.MainActivity` with solid background color
10. Add `androidx.core:core-splashscreen:1.0.1` dependency to `android/app/build.gradle`

#### ResponsiveImage Mode

For ResponsiveImage mode, the plugin:

1. **Copies background image**: Places image as `splash_background_image.{ext}` in `android/app/src/main/res/drawable/` (supports `.9.png`)
2. **Updates ic_launcher_background.xml**: Modifies to show background image only (removes icon layer)
3. **Creates colors.xml**: Creates `splashscreen_background` color resource in `res/values/colors.xml`
4. **Modifies styles.xml**: Updates `Theme.App.SplashScreen` to use `@drawable/splash_background_image` as `android:windowBackground`
5. **Modifies MainActivity.kt**: Adds image container view (`splashImageViewContainer`) with full-screen display using `setupSplashImageView()` method

**Manual steps** (if needed):

1. Copy background image to `android/app/src/main/res/drawable/splash_background_image.{ext}` (supports `.9.png` format)
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
     <item name="android:windowBackground">@drawable/splash_background_image</item>
     <item name="android:statusBarColor">#00000000</item>
   </style>
   ```
5. Modify `MainActivity.kt`:
   - Add imports: `android.os.Handler`, `android.os.Looper`, `android.view.View`, `android.view.ViewGroup`, `android.widget.ImageView`, `android.graphics.drawable.Drawable`
   - Add `splashImageViewContainer` property and `setupSplashImageView()` method
   - Add code in `onCreate()` to call `setupSplashImageView()` using `Handler.post`

#### Normal Mode

For Normal mode, the plugin:

1. **Copies icon image**: Places image as `splash_icon.{ext}` in `android/app/src/main/res/drawable-xxhdpi/`
2. **Copies dark icon** (if dark mode enabled): Places dark image in `android/app/src/main/res/drawable-night-xxhdpi/`
3. **Creates splashscreen_logo**: Creates `splashscreen_logo_raw.{ext}` image file and `splashscreen_logo.xml` in `res/drawable/` (and `res/drawable-night/` for dark mode)
4. **Creates colors.xml**: Creates `splashscreen_background` color in `res/values/colors.xml` (and `res/values-night/colors.xml` for dark mode)
5. **Modifies styles.xml**: Updates `Theme.App.SplashScreen` to use `@drawable/splashscreen_logo` as `android:windowBackground`
6. **Modifies MainActivity.kt**: Adds image container view (`splashNormalImageContainer`) with fixed width constraints and dark mode support

**Manual steps** (if needed):

1. Copy icon image to `android/app/src/main/res/drawable-xxhdpi/splash_icon.{ext}`
2. If dark mode enabled, copy dark icon to `android/app/src/main/res/drawable-night-xxhdpi/splash_icon.{ext}`
3. Create `res/drawable/splashscreen_logo_raw.{ext}` by copying the icon image
4. Create `res/drawable/splashscreen_logo.xml`:
   ```xml
   <layer-list xmlns:android="http://schemas.android.com/apk/res/android">
     <item>
       <color android:color="@color/splashscreen_background" />
     </item>
     <item
         android:width="100dp"
         android:height="100dp"
         android:gravity="center">
       <bitmap
           android:gravity="center"
           android:src="@drawable/splashscreen_logo_raw" />
     </item>
   </layer-list>
   ```
5. If dark mode enabled, create `res/drawable-night/splashscreen_logo_raw.{ext}` and `res/drawable-night/splashscreen_logo.xml` with dark mode colors and image
6. Create `res/values/colors.xml`:
   ```xml
   <resources>
     <color name="splashscreen_background">#FFFFFF</color>
   </resources>
   ```
7. If dark mode enabled, create `res/values-night/colors.xml`:
   ```xml
   <resources>
     <color name="splashscreen_background">#000000</color>
   </resources>
   ```
8. Update `res/values/styles.xml`:
   ```xml
   <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
     <item name="android:windowBackground">@drawable/splashscreen_logo</item>
   </style>
   ```
9. Modify `MainActivity.kt`:
   - Add imports: `android.os.Handler`, `android.os.Looper`, `android.view.View`, `android.view.ViewGroup`, `android.widget.ImageView`, `android.graphics.drawable.Drawable`, `android.graphics.Color`, `android.content.res.Configuration`, `androidx.core.content.ContextCompat`
   - Add `splashNormalImageContainer` property
   - Add `setupSplashNormalImage()`, `hideSplashImageViewContainerInternal()`, `isDarkMode()`, `getCurrentBackgroundColor()`, and `updateSplashAppearance()` methods
   - Add `onConfigurationChanged()` override for dark mode switching
   - Add code in `onCreate()` to call `setupSplashNormalImage()` using `Handler.post`

#### Blend Mode

For Blend mode, the plugin:

1. **Copies background image**: Places `.9.png` image as `splash_background_image.{ext}` in `android/app/src/main/res/drawable/`
2. **Copies HTML file**: Places HTML file from `expo-splash-web/dist/index.html` or `localHtmlPath` to `android/app/src/main/assets/index.html`
3. **Creates colors.xml**: Creates `splashscreen_background` color resource in `res/values/colors.xml`
4. **Generates SplashScreen2Activity.kt**: Creates `SplashScreen2Activity.kt` with WebView container (background uses `.9.png` image)
5. **Generates SplashScreen2PrivacyPolicyActivity.kt**: Creates privacy policy activity
6. **Modifies AndroidManifest.xml**: Adds `SplashScreen2Activity` as launcher activity, sets `MainActivity` theme to `Theme.App.SplashScreen`
7. **Modifies MainActivity.kt**: Adds WebView container code with transparent background (recommended for seamless transition)
8. **Modifies styles.xml**: Updates `Theme.App.SplashScreen` to use `@drawable/splash_background_image` as `android:windowBackground`
9. **Updates build.gradle**: Adds `androidx.core:core-splashscreen:1.0.1` dependency

**Manual steps** (if needed):

1. Copy `.9.png` background image to `android/app/src/main/res/drawable/splash_background_image.{ext}`
2. Copy HTML file to `android/app/src/main/assets/index.html`
3. Create `res/values/colors.xml` with `splashscreen_background` color
4. Create `SplashScreen2Activity.kt` in `android/app/src/main/java/{packageName}/` (see plugin templates in `plugin/src/templates/android.ts`)
5. Create `SplashScreen2PrivacyPolicyActivity.kt` in the same directory
6. Modify `AndroidManifest.xml`:
   - Add `SplashScreen2Activity` as launcher activity with `android:theme="@style/Theme.App.SplashScreen"`
   - Remove launcher intent-filter from `MainActivity`
   - Set `MainActivity` theme to `Theme.App.SplashScreen` (same as splash screen theme)
7. Modify `MainActivity.kt`:
   - Add imports: `android.os.Build`, `android.os.Handler`, `android.os.Looper`, `android.view.View`, `android.view.ViewGroup`, `android.webkit.WebView`, `android.webkit.WebViewClient`, `androidx.core.view.WindowCompat`
   - Add companion object with `actionStart()` method
   - Add WebView container properties and methods (see plugin templates)
   - Add code in `onCreate()` to set up WebView container with transparent background (recommended)
8. Update `res/values/styles.xml`:
   ```xml
   <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
     <item name="android:windowBackground">@drawable/splash_background_image</item>
     <item name="android:statusBarColor">#00000000</item>
   </style>
   ```
9. Add `androidx.core:core-splashscreen:1.0.1` dependency to `android/app/build.gradle`

## Manual Regeneration

If you need to regenerate native projects with the latest plugin changes:

```bash
# Clean and regenerate
npx expo prebuild --clean

# Or for specific platform
npx expo prebuild --clean --platform android
npx expo prebuild --clean --platform ios
```

## StatusBar Customization

`expo-splash-screen2` allows customization of the StatusBar according to the [React Native StatusBar API](https://reactnative.dev/docs/statusbar). You can control StatusBar visibility, style, and background color during the splash screen display.

