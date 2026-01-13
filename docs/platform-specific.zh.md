# 平台特定详情

## iOS 配置

插件自动：

1. 将启动图片复制到 iOS bundle
2. 修改 `AppDelegate.swift` 以显示启动屏幕
3. 使用 `UITraitCollection` 设置深色模式检测
4. 添加 `UIApplication.didBecomeActiveNotification` 观察者以支持运行时主题更改

### 资源位置

- 浅色模式图片：`ios/{projectName}/splash-icon.{ext}`
- 深色模式图片：`ios/{projectName}/splash-icon-dark.{ext}`

### iOS 手动配置

插件会自动处理 iOS 配置，但如果您需要手动配置或了解其工作原理，以下是每种模式的详细信息：

#### WebView 模式

对于 WebView 模式，插件：

1. **修改 `SplashScreen.storyboard`**：设置背景颜色和可选的居中图片（如果配置了 `image`）
2. **复制 HTML 文件**：将 HTML 文件从 `expo-splash-web/dist/index.html` 或 `localHtmlPath` 放置到 `ios/{projectName}/index.html`
3. **复制图标**（可选）：如果配置了 `image`，将图标复制到 `ios/{projectName}/splash-icon.{ext}`
4. **创建 Asset Catalog colorset**：在 `Images.xcassets` 中创建 `SplashScreenBackground` colorset（如果配置了 `image`）
5. **修改 `AppDelegate.swift`**：添加 WebView 容器代码，调用 `SplashScreen2Service.shared.showSplashScreenFor()`
6. **生成 ExpoSplashHtml.podspec**：在 `ios/` 目录下创建 podspec 文件
7. **生成 fix-splash-module.sh**：创建脚本以在 ExpoModulesProvider 中自动注册模块

**手动步骤**（如需要）：

1. 将 HTML 文件复制到 `ios/{projectName}/index.html`
2. 如果配置了 `image`：
   - 将图标复制到 `ios/{projectName}/splash-icon.{ext}`
   - 在 `Images.xcassets` 中创建 `SplashScreenBackground` colorset，设置背景颜色
3. 修改 `SplashScreen.storyboard`：
   - 使用 `SplashScreenBackground` colorset 设置背景颜色（如果已创建）
   - 如果配置了 `image`，添加 Image View，使用 `splash-icon` 图片，Content Mode 设置为 `Aspect Fit`，并添加宽度约束（默认 100pt）
4. 修改 `AppDelegate.swift`：
   - 添加导入：`import ExpoSplashHtml`
   - 添加协议遵循：`AppDelegateProtocol`
   - 添加属性：`rnRootViewController`、`savedFactory`、`savedLaunchOptions`、`isReactNativeStarting`
   - 添加 `startReactNativeIfNeeded()` 方法
   - 在 `didFinishLaunchingWithOptions` 中添加代码，创建临时 rootViewController 并调用 `SplashScreen2Service.shared.showSplashScreenFor()`
   - 添加代码设置 `SplashScreen2ViewController.appDelegate = self`
5. 确保在 Xcode 项目设置中将 `SplashScreen.storyboard` 设置为 Launch Screen File
6. 添加 `ExpoSplashHtml` pod 引用（如果未自动添加）

#### ResponsiveImage 模式

对于 ResponsiveImage 模式，插件：

1. **复制背景图片**：将图片文件作为 `splash_background_image.{ext}` 放置在 `ios/{projectName}/` 目录（支持 `.9.png`）
2. **修改 `SplashScreen.storyboard`**：设置全屏背景图片，使用 `scaleAspectFill` 内容模式
3. **修改 `AppDelegate.swift`**：添加图片容器视图（`splashImageViewContainer`），包含 `setupSplashImageView()` 方法
4. **添加文件引用**：将图片文件添加到 Xcode 项目

**手动步骤**（如需要）：

1. 将背景图片复制到 `ios/{projectName}/splash_background_image.{ext}`（支持 `.9.png` 格式）
2. 修改 `SplashScreen.storyboard`：
   - 将 Image View 设置为使用 `splash_background_image` 图片
   - 将 Content Mode 设置为 `Aspect Fill` 以实现全屏覆盖
   - 设置背景颜色（备用）
3. 修改 `AppDelegate.swift`：
   - 添加导入：`UIKit`、`WebKit`（如需要）
   - 添加 `splashImageViewContainer` 属性和 `setupSplashImageView()` 方法
   - 添加 `enablePreventAutoHide()` 和 `hideSplashImageViewContainer()` 方法
   - 在 `didFinishLaunchingWithOptions` 中添加代码，使用 `Handler.post` 调用 `setupSplashImageView()`
4. 将图片文件添加到 Xcode 项目文件引用

#### Normal 模式

对于 Normal 模式，插件：

1. **创建 Asset Catalog imageset**：在 `Images.xcassets` 中创建 `splash-icon` imageset（如果配置了深色模式，则支持深色模式）
2. **创建 Asset Catalog colorset**：在 `Images.xcassets` 中创建 `SplashScreenBackground` colorset（如果配置了深色模式，则支持深色模式）
3. **修改 `SplashScreen.storyboard`**：使用 `SplashScreenBackground` colorset 设置背景颜色，并设置固定宽度（默认 100pt）的居中图片
4. **修改 `AppDelegate.swift`**：添加图片容器视图（`splashNormalImageContainer`），包含固定宽度约束和深色模式支持

**手动步骤**（如需要）：

1. 在 `Images.xcassets` 中创建 `splash-icon` imageset：
   - 将浅色模式图片添加到 `splash-icon.imageset/`
   - 如果启用了深色模式，在 `Any, Dark` 外观中添加深色模式图片
2. 在 `Images.xcassets` 中创建 `SplashScreenBackground` colorset：
   - 设置浅色模式颜色
   - 如果启用了深色模式，在 `Any, Dark` 外观中设置深色模式颜色
3. 修改 `SplashScreen.storyboard`：
   - 将 Image View 设置为使用 Asset Catalog 中的 `splash-icon` 图片
   - 将 Content Mode 设置为 `Aspect Fit`
   - 将背景设置为使用 `SplashScreenBackground` colorset
   - 为 Image View 添加宽度约束（默认 100pt）
4. 修改 `AppDelegate.swift`：
   - 添加导入：`UIKit`（如需要）
   - 添加 `splashNormalImageContainer` 属性
   - 添加 `setupSplashNormalImage()`、`hideSplashImageViewContainerInternal()`、`isDarkMode()`、`getCurrentBackgroundColor()` 和 `updateSplashAppearance()` 方法
   - 添加 `onConfigurationChanged()` 重写以支持深色模式切换
   - 在 `didFinishLaunchingWithOptions` 中添加代码，使用 `Handler.post` 调用 `setupSplashNormalImage()`

#### Blend 模式

对于 Blend 模式，插件：

1. **复制背景图片**：将 `.9.png` 图片文件作为 `splash_background_image.{ext}` 放置在 `ios/{projectName}/` 目录
2. **复制 HTML 文件**：将 HTML 文件从 `expo-splash-web/dist/index.html` 或 `localHtmlPath` 放置到 `ios/{projectName}/index.html`
3. **修改 `SplashScreen.storyboard`**：设置全屏背景图片，使用 `scaleAspectFill` 内容模式（与 ResponsiveImage 模式相同）
4. **修改 `AppDelegate.swift`**：添加 WebView 覆盖层代码，使用 `SplashScreen2Service.shared.showSplashScreenFor()`，WebView 容器背景使用透明（推荐）

**手动步骤**（如需要）：

1. 将 `.9.png` 背景图片复制到 `ios/{projectName}/splash_background_image.{ext}`
2. 将 HTML 文件复制到 `ios/{projectName}/index.html`
3. 修改 `SplashScreen.storyboard`：
   - 将 Image View 设置为使用 `splash_background_image` 图片
   - 将 Content Mode 设置为 `Aspect Fill` 以实现全屏覆盖
   - 设置背景颜色（备用）
4. 修改 `AppDelegate.swift`：
   - 添加导入：`import ExpoSplashHtml`
   - 添加协议遵循：`AppDelegateProtocol`
   - 添加属性：`rnRootViewController`、`savedFactory`、`savedLaunchOptions`、`isReactNativeStarting`
   - 添加 `startReactNativeIfNeeded()` 方法
   - 在 `didFinishLaunchingWithOptions` 中添加代码，创建临时 rootViewController 并调用 `SplashScreen2Service.shared.showSplashScreenFor()`
   - 将 WebView 容器背景设置为透明（推荐），实现无缝过渡
5. 将图片和 HTML 文件添加到 Xcode 项目文件引用
6. 确保在 Xcode 项目设置中将 `SplashScreen.storyboard` 设置为 Launch Screen File

## Android 配置

插件自动：

1. 将启动图片复制到 Android drawable 目录
2. 修改 `MainActivity.kt` 以显示启动屏幕
3. 为深色模式创建 `values/colors.xml` 和 `values-night/colors.xml`
4. 设置 `Configuration.UI_MODE_NIGHT_MASK` 检测

### 资源位置

- 浅色模式图片：`android/app/src/main/res/drawable/splash_icon.png`
- 深色模式图片：`android/app/src/main/res/drawable-night/splash_icon.png`
- 浅色颜色：`android/app/src/main/res/values/colors.xml`
- 深色颜色：`android/app/src/main/res/values-night/colors.xml`

### Android 手动配置

插件会自动处理 Android 配置，但如果您需要手动配置或了解其工作原理，以下是每种模式的详细信息：

#### WebView 模式

对于 WebView 模式，插件：

1. **复制 HTML 文件**：将 HTML 文件从 `expo-splash-web/dist/index.html` 或 `localHtmlPath` 放置到 `android/app/src/main/assets/index.html`
2. **复制图标**（可选）：如果配置了 `image`，将图标复制到多个密度目录并创建 `res/drawable/splashscreen_logo.xml`
3. **更新 ic_launcher_background.xml**：更新以显示背景颜色和可选的居中图标
4. **创建 colors.xml**：在 `res/values/colors.xml` 中创建 `splashscreen_background` 颜色资源
5. **生成 SplashScreen2Activity.kt**：在 `android/app/src/main/java/{packageName}/` 中创建用于显示 WebView 的活动
6. **生成 SplashScreen2PrivacyPolicyActivity.kt**：创建隐私政策活动
7. **修改 AndroidManifest.xml**：将 `SplashScreen2Activity` 添加为启动活动，将 `MainActivity` 主题设置为 `Theme.App.MainActivity`
8. **修改 MainActivity.kt**：添加 WebView 容器代码，包含 `setupWebViewContainer()`、`hideWebViewContainer()` 和 `preventAutoHide()` 方法
9. **修改 styles.xml**：更新 `Theme.App.SplashScreen` 以使用 `@drawable/splashscreen_logo`，并添加使用纯色背景的 `Theme.App.MainActivity`
10. **更新 build.gradle**：添加 `androidx.core:core-splashscreen:1.0.1` 依赖

**手动步骤**（如需要）：

1. 将 HTML 文件复制到 `android/app/src/main/assets/index.html`
2. 如果配置了 `image`：
   - 将图标复制到 `android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png`（以及其他密度目录）
   - 创建 `res/drawable/splashscreen_logo.xml`，引用图标并设置固定宽度
3. 更新 `res/drawable/ic_launcher_background.xml` 以显示背景颜色和可选图标
4. 创建 `res/values/colors.xml`，包含 `splashscreen_background` 颜色
5. 在 `android/app/src/main/java/{packageName}/` 中创建 `SplashScreen2Activity.kt`（参见插件模板 `plugin/src/templates/android.ts`）
6. 在同一目录中创建 `SplashScreen2PrivacyPolicyActivity.kt`
7. 修改 `AndroidManifest.xml`：
   - 将 `SplashScreen2Activity` 添加为启动活动，设置 `android:theme="@style/Theme.App.SplashScreen"`
   - 从 `MainActivity` 中移除 launcher intent-filter
   - 将 `MainActivity` 主题设置为 `Theme.App.MainActivity`
8. 修改 `MainActivity.kt`：
   - 添加导入：`android.os.Build`、`android.os.Handler`、`android.os.Looper`、`android.view.View`、`android.view.ViewGroup`、`android.webkit.WebView`、`android.webkit.WebViewClient`、`androidx.core.view.WindowCompat`
   - 添加包含 `actionStart()` 方法的 companion object
   - 添加 WebView 容器属性和方法（参见插件模板）
   - 在 `onCreate()` 中添加代码以设置 WebView 容器
9. 更新 `res/values/styles.xml`：
   - 更新 `Theme.App.SplashScreen`，将 `android:windowBackground` 设置为 `@drawable/splashscreen_logo`
   - 添加使用纯色背景的 `Theme.App.MainActivity`
10. 在 `android/app/build.gradle` 中添加 `androidx.core:core-splashscreen:1.0.1` 依赖

#### ResponsiveImage 模式

对于 ResponsiveImage 模式，插件：

1. **复制背景图片**：将图片作为 `splash_background_image.{ext}` 放置在 `android/app/src/main/res/drawable/`（支持 `.9.png`）
2. **更新 ic_launcher_background.xml**：修改为仅显示背景图片（移除图标层）
3. **创建 colors.xml**：在 `res/values/colors.xml` 中创建 `splashscreen_background` 颜色资源
4. **修改 styles.xml**：更新 `Theme.App.SplashScreen`，将 `android:windowBackground` 设置为 `@drawable/splash_background_image`
5. **修改 MainActivity.kt**：添加图片容器视图（`splashImageViewContainer`），包含 `setupSplashImageView()` 方法，用于全屏显示

**手动步骤**（如需要）：

1. 将背景图片复制到 `android/app/src/main/res/drawable/splash_background_image.{ext}`（支持 `.9.png` 格式）
2. 更新 `res/drawable/ic_launcher_background.xml`：
   ```xml
   <layer-list xmlns:android="http://schemas.android.com/apk/res/android">
     <item android:drawable="@drawable/splash_background_image"/>
   </layer-list>
   ```
3. 创建 `res/values/colors.xml`：
   ```xml
   <resources>
     <color name="splashscreen_background">#FFFFFF</color>
   </resources>
   ```
4. 更新 `res/values/styles.xml`：
   ```xml
   <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
     <item name="android:windowBackground">@drawable/splash_background_image</item>
     <item name="android:statusBarColor">#00000000</item>
   </style>
   ```
5. 修改 `MainActivity.kt`：
   - 添加导入：`android.os.Handler`、`android.os.Looper`、`android.view.View`、`android.view.ViewGroup`、`android.widget.ImageView`、`android.graphics.drawable.Drawable`
   - 添加 `splashImageViewContainer` 属性和 `setupSplashImageView()` 方法
   - 在 `onCreate()` 中添加代码，使用 `Handler.post` 调用 `setupSplashImageView()`

#### Normal 模式

对于 Normal 模式，插件：

1. **复制图标图片**：将图片作为 `splash_icon.{ext}` 放置在 `android/app/src/main/res/drawable-xxhdpi/`
2. **复制深色图标**（如果启用了深色模式）：将深色图片放置在 `android/app/src/main/res/drawable-night-xxhdpi/`
3. **创建 splashscreen_logo**：创建 `splashscreen_logo_raw.{ext}` 图片文件和 `splashscreen_logo.xml` 在 `res/drawable/`（深色模式在 `res/drawable-night/`）
4. **创建 colors.xml**：在 `res/values/colors.xml` 中创建 `splashscreen_background` 颜色（深色模式在 `res/values-night/colors.xml`）
5. **修改 styles.xml**：更新 `Theme.App.SplashScreen`，将 `android:windowBackground` 设置为 `@drawable/splashscreen_logo`
6. **修改 MainActivity.kt**：添加图片容器视图（`splashNormalImageContainer`），包含固定宽度约束和深色模式支持

**手动步骤**（如需要）：

1. 将图标图片复制到 `android/app/src/main/res/drawable-xxhdpi/splash_icon.{ext}`
2. 如果启用了深色模式，将深色图标复制到 `android/app/src/main/res/drawable-night-xxhdpi/splash_icon.{ext}`
3. 通过复制图标图片创建 `res/drawable/splashscreen_logo_raw.{ext}`
4. 创建 `res/drawable/splashscreen_logo.xml`：
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
5. 如果启用了深色模式，创建 `res/drawable-night/splashscreen_logo_raw.{ext}` 和 `res/drawable-night/splashscreen_logo.xml`，使用深色模式颜色和图片
6. 创建 `res/values/colors.xml`：
   ```xml
   <resources>
     <color name="splashscreen_background">#FFFFFF</color>
   </resources>
   ```
7. 如果启用了深色模式，创建 `res/values-night/colors.xml`：
   ```xml
   <resources>
     <color name="splashscreen_background">#000000</color>
   </resources>
   ```
8. 更新 `res/values/styles.xml`：
   ```xml
   <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
     <item name="android:windowBackground">@drawable/splashscreen_logo</item>
   </style>
   ```
9. 修改 `MainActivity.kt`：
   - 添加导入：`android.os.Handler`、`android.os.Looper`、`android.view.View`、`android.view.ViewGroup`、`android.widget.ImageView`、`android.graphics.drawable.Drawable`、`android.graphics.Color`、`android.content.res.Configuration`、`androidx.core.content.ContextCompat`
   - 添加 `splashNormalImageContainer` 属性
   - 添加 `setupSplashNormalImage()`、`hideSplashImageViewContainerInternal()`、`isDarkMode()`、`getCurrentBackgroundColor()` 和 `updateSplashAppearance()` 方法
   - 添加 `onConfigurationChanged()` 重写以支持深色模式切换
   - 在 `onCreate()` 中添加代码，使用 `Handler.post` 调用 `setupSplashNormalImage()`

#### Blend 模式

对于 Blend 模式，插件：

1. **复制背景图片**：将 `.9.png` 图片作为 `splash_background_image.{ext}` 放置在 `android/app/src/main/res/drawable/`
2. **复制 HTML 文件**：将 HTML 文件从 `expo-splash-web/dist/index.html` 或 `localHtmlPath` 放置到 `android/app/src/main/assets/index.html`
3. **创建 colors.xml**：在 `res/values/colors.xml` 中创建 `splashscreen_background` 颜色资源
4. **生成 SplashScreen2Activity.kt**：在 `android/app/src/main/java/{packageName}/` 中创建活动，WebView 容器背景使用 `.9.png` 图片
5. **生成 SplashScreen2PrivacyPolicyActivity.kt**：创建隐私政策活动
6. **修改 AndroidManifest.xml**：将 `SplashScreen2Activity` 添加为启动活动，将 `MainActivity` 主题设置为 `Theme.App.SplashScreen`
7. **修改 MainActivity.kt**：添加 WebView 容器代码，使用透明背景（推荐，实现无缝过渡）
8. **修改 styles.xml**：更新 `Theme.App.SplashScreen`，将 `android:windowBackground` 设置为 `@drawable/splash_background_image`
9. **更新 build.gradle**：添加 `androidx.core:core-splashscreen:1.0.1` 依赖

**手动步骤**（如需要）：

1. 将 `.9.png` 背景图片复制到 `android/app/src/main/res/drawable/splash_background_image.{ext}`
2. 将 HTML 文件复制到 `android/app/src/main/assets/index.html`
3. 创建 `res/values/colors.xml`，包含 `splashscreen_background` 颜色
4. 在 `android/app/src/main/java/{packageName}/` 中创建 `SplashScreen2Activity.kt`（参见插件模板 `plugin/src/templates/android.ts`）
5. 在同一目录中创建 `SplashScreen2PrivacyPolicyActivity.kt`
6. 修改 `AndroidManifest.xml`：
   - 将 `SplashScreen2Activity` 添加为启动活动，设置 `android:theme="@style/Theme.App.SplashScreen"`
   - 从 `MainActivity` 中移除 launcher intent-filter
   - 将 `MainActivity` 主题设置为 `Theme.App.SplashScreen`（与启动屏幕主题相同）
7. 修改 `MainActivity.kt`：
   - 添加导入：`android.os.Build`、`android.os.Handler`、`android.os.Looper`、`android.view.View`、`android.view.ViewGroup`、`android.webkit.WebView`、`android.webkit.WebViewClient`、`androidx.core.view.WindowCompat`
   - 添加包含 `actionStart()` 方法的 companion object
   - 添加 WebView 容器属性和方法（参见插件模板）
   - 在 `onCreate()` 中添加代码以设置 WebView 容器，使用透明背景（推荐）
8. 更新 `res/values/styles.xml`：
   ```xml
   <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
     <item name="android:windowBackground">@drawable/splash_background_image</item>
     <item name="android:statusBarColor">#00000000</item>
   </style>
   ```
9. 在 `android/app/build.gradle` 中添加 `androidx.core:core-splashscreen:1.0.1` 依赖

## 手动重新生成

如果您需要使用最新的插件更改重新生成原生项目：

```bash
# 清理并重新生成
npx expo prebuild --clean

# 或针对特定平台
npx expo prebuild --clean --platform android
npx expo prebuild --clean --platform ios
```

## StatusBar 自定义

`expo-splash-screen2` 允许根据 [React Native StatusBar API](https://reactnative.dev/docs/statusbar) 自定义 StatusBar。您可以在启动屏幕显示期间控制 StatusBar 的可见性、样式和背景颜色。
