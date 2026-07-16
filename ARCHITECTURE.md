# React Native Splash Screen (expo-splash-screen2) Architecture Document

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Module Division and Responsibilities](#2-module-division-and-responsibilities)
3. [Data Flow and Call Relationships](#3-data-flow-and-call-relationships)
4. [Key Design Decisions](#4-key-design-decisions)
5. [Module Dependency Analysis](#5-module-dependency-analysis)
6. [Technical Debt and Architecture Risks](#6-technical-debt-and-architecture-risks)
7. [Architecture Improvement Recommendations](#7-architecture-improvement-recommendations)

---

## 1. System Architecture Overview

### 1.1 Project Positioning

`expo-splash-screen2` is a React Native/Expo library designed to provide a highly customizable splash screen solution. It extends the functionality of the official `expo-splash-screen` by supporting multiple display modes:

- **WebView Mode**: Display custom HTML content via WebView
- **ResponsiveImage Mode**: Display .9.png responsive images
- **Normal Mode**: Traditional centered image with background color
- **Blend Mode**: Combine .9.png background with WebView HTML overlay

### 1.2 Technology Stack

| Layer | Technology |
|-------|------------|
| JavaScript API | TypeScript |
| Android Native | Kotlin + Expo Modules SDK |
| iOS Native | Swift + Expo Modules Core |
| Build System | Expo Config Plugins |
| WebView Content | React Native Web + esbuild |

### 1.3 Architecture Diagram

```
+------------------------------------------------------------------+
|                          User Application                          |
+------------------------------------------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                     JavaScript API Layer                          |
|  (src/index.native.ts, src/index.ts)                             |
|  - preventAutoHideAsync()                                        |
|  - hideAsync()                                                   |
|  - _internal_preventAutoHideAsync()                             |
|  - _internal_maybeHideAsync()                                    |
+------------------------------------------------------------------+
                                |
                    +-----------+-----------+
                    |                       |
                    v                       v
+----------------------------+   +----------------------------+
|    Android Native Module   |   |     iOS Native Module      |
|  (SplashScreen2Module.kt)  |   |  (SplashScreen2Module.swift)|
+----------------------------+   +----------------------------+
                    |                       |
                    v                       v
+----------------------------+   +----------------------------+
|    Android Splash Views    |   |    iOS Splash Service      |
|  - SplashScreen2Activity   |   |  - SplashScreen2Service    |
|  - MainActivity (modified) |   |  - SplashScreen2ViewController|
|  - WebView Container       |   |  - SplashScreen2Wrapper    |
+----------------------------+   +----------------------------+
                    |                       |
                    +-----------+-----------+
                                |
                                v
+------------------------------------------------------------------+
|                    Expo Config Plugin Layer                       |
|  (plugin/src/index.ts)                                           |
|  - Build-time code generation                                    |
|  - Native file modification                                      |
|  - Resource management                                           |
+------------------------------------------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                    expo-splash-web Layer                          |
|  - React Native Web components                                   |
|  - HTML/CSS/JS bundling                                          |
|  - Build scripts (build-splash-web.js)                           |
+------------------------------------------------------------------+
```

---

## 2. Module Division and Responsibilities

### 2.1 JavaScript Layer

#### `/src/index.native.ts` - Native Platform Entry
**Responsibility**: Provides the API interface for iOS and Android platforms

```typescript
// Key exports:
export async function preventAutoHideAsync(): Promise<boolean>
export async function hideAsync(): Promise<boolean>
export async function _internal_preventAutoHideAsync(): Promise<void>
export async function _internal_maybeHideAsync(): Promise<void>
```

**Design Pattern**: Facade Pattern - Simplifies native module calls, providing a unified interface

#### `/src/index.ts` - Web Platform Stub
**Responsibility**: Provides no-op implementations for web platform compatibility

**Design Pattern**: Null Object Pattern - Avoids runtime errors on web platform

### 2.2 Android Native Layer

#### `/android/src/main/java/expo/modules/splashhtml/SplashScreen2Module.kt`
**Responsibility**:
- Expo Modules SDK integration
- JavaScript to native communication bridge
- React lifecycle event listening (ReactMarker)
- State management (userControlledAutoHideEnabled, preventAutoHideCalled)

**Key State Variables**:
```kotlin
private var userControlledAutoHideEnabled: Boolean = false
private var preventAutoHideCalled: Boolean = false
```

**Design Pattern**: Observer Pattern - Listens to ReactMarker events to trigger auto-hide

#### Android Splash Views (Generated by Plugin)
**Location**: Generated in project's `android/app/src/main/java/[package]/`

| Class | Responsibility |
|-------|---------------|
| `SplashScreen2Activity` | WebView container Activity, handles privacy dialogs and HTML loading |
| `MainActivity` (modified) | Adds splash screen container management methods |

**Design Pattern**: Template Method Pattern - Activity lifecycle management with hooks for splash control

### 2.3 iOS Native Layer

#### `/ios/SplashScreen2Module.swift`
**Responsibility**:
- Expo Modules Core integration
- Notification-based communication with service layer
- State management

**Key State Variables**:
```swift
var userControlledAutoHideEnabled = false
var preventAutoHideCalled = false
```

**Design Pattern**: Observer Pattern - Uses NotificationCenter for inter-component communication

#### `/ios/SplashScreen2Service.swift`
**Responsibility**:
- Singleton service managing splash screen lifecycle
- RootViewController monitoring via KVO
- Splash screen migration during controller transitions
- Multi-controller splash screen state synchronization

**Key Components**:
```swift
public class SplashScreen2Service: NSObject {
  private var splashScreenControllers: [UIViewController: SplashScreen2ViewControllerWrapper] = [:]
  private weak var observingRootViewController: UIViewController?
  private var globalPreventAutoHide: Bool = false
}
```

**Design Pattern**:
- Singleton Pattern - Shared service instance
- Observer Pattern - KVO for rootViewController changes
- Wrapper/Decorator Pattern - SplashScreen2ViewControllerWrapper adds state management

#### `/ios/SplashScreen2ViewController.swift`
**Responsibility**:
- WebView container management
- HTML loading and JavaScript bridge
- Privacy policy dialog handling
- Blend mode background image support

**Key Features**:
- WKWebView configuration
- JavaScript message handler
- Dark mode and blend mode detection

**Design Pattern**: MVC Pattern - ViewController manages WebView view and handles user interactions

### 2.4 Config Plugin Layer

#### `/plugin/src/index.ts`
**Responsibility**:
- Build-time native code generation
- AndroidManifest, MainActivity, AppDelegate modifications
- Resource file management (images, colors, XMLs)
- Mode-specific configuration handling

**Key Functions**:
```typescript
function getSplashHtmlConfig(config: any): SplashHtmlConfig | null
async function bundleSplashWeb(projectRoot: string): Promise<string>
function createSplashColorsXml(...)
function copyIcon(...)
```

**Design Pattern**:
- Builder Pattern - Constructs native configuration step by step
- Strategy Pattern - Different handling for different modes (webview, normal, responsiveImage, blend)

#### `/plugin/src/templates/android.ts` & `/plugin/src/templates/ios.ts`
**Responsibility**: Provide template code for native files

**Design Pattern**: Template Method Pattern - Placeholder replacement for code generation

### 2.5 expo-splash-web Layer

#### `/expo-splash-web/src/SplashScreenView.tsx`
**Responsibility**:
- React Native Web splash screen component
- Privacy dialog UI
- Animation handling
- Native bridge integration (window.Android, window.iOS)

**Design Pattern**: Component Pattern - Self-contained React component with state management

#### `/expo-splash-web/build-splash-web.js`
**Responsibility**:
- Bundle React Native Web components to static HTML/JS/CSS
- Optimize output for WebView loading

---

## 3. Data Flow and Call Relationships

### 3.1 Initialization Flow (WebView Mode)

```
App Launch
    |
    v
[Android] SplashScreen2Activity.onCreate()  OR  [iOS] AppDelegate.application(_:didFinishLaunchingWithOptions:)
    |
    v
Load HTML into WebView
    |
    v
HTML loads and executes JavaScript
    |
    v
Native code injects isAuth state
    |
    +--[has privacy functions]--+
    |                           |
    v                           v
Show Privacy Dialog      Skip Dialog (isAuth=true)
    |
    v
User agrees -> Call native bridge
    |
    v
[Android] startMainActivity()  OR  [iOS] startReactNativeIfNeeded()
    |
    v
React Native initializes
    |
    v
RCTContentDidAppearNotification fires
    |
    +--[preventAutoHideCalled=false]--+
    |                                 |
    v                                 v
Auto-hide splash              Wait for hideAsync()
    |
    v
Splash screen fades out (300ms animation)
```

### 3.2 Hide Control Flow

```
JavaScript Call
    |
    v
preventAutoHideAsync()
    |
    v
[Android] SplashScreen2Module.preventAutoHideAsync()
    OR
[iOS] NotificationCenter.post("SplashHtmlPreventAutoHide")
    |
    v
[Android] callActivityPreventAutoHide()
    OR
[iOS] SplashScreen2Service.preventAutoHideFor()
    |
    v
Set preventAutoHide = true
    |
    v
Splash screen stays visible
    |
    v
hideAsync() called by app
    |
    v
[Android] hideInternal(force=true)
    OR
[iOS] NotificationCenter.post("SplashHtmlHide", force=true)
    |
    v
Splash screen fades out and removes
```

### 3.3 Blend Mode Visual Flow

```
System Splash Screen (.9.png background)
    |
    v
Transition to WebView
    |
    v
WebView (transparent background)
    |  -- Shows .9.png background from system splash
    v
HTML Overlay Content
    |
    v
Seamless visual transition
```

### 3.4 Build-time Flow

```
npx expo prebuild
    |
    v
app.plugin.js loads
    |
    v
plugin/src/index.ts executes
    |
    v
Read app.json configuration
    |
    v
[webview/blend mode]
    |   |
    |   v
    |   bundleSplashWeb() -> Build expo-splash-web
    |   |
    |   v
    |   Copy index.html to native assets
    |
    v
Generate/Modify native files:
    - Android: SplashScreen2Activity.kt, MainActivity.kt, styles.xml, colors.xml
    - iOS: AppDelegate.swift, SplashScreen2Service.swift, etc.
    |
    v
Copy image resources to appropriate directories
```

---

## 4. Key Design Decisions

### 4.1 Why WebView for Complex Splash Screens?

**Decision**: Use WebView instead of native views for complex splash screens

**Rationale**:
- HTML/CSS/JS provides rich animation capabilities
- Easier to maintain and update splash screen content
- Cross-platform consistency in rendering
- Leverages existing web development skills
- React Native Web allows component reuse

**Trade-offs**:
- Slightly slower initial load compared to pure native
- Requires careful memory management
- WebView initialization overhead

### 4.2 Why Blend Mode Architecture?

**Decision**: Combine system splash screen (.9.png) with WebView overlay

**Rationale**:
- Android 12+ requires system splash screen API
- .9.png provides native stretching performance
- WebView allows dynamic content (privacy dialogs, animations)
- Seamless transition between system and custom splash

**Trade-offs**:
- More complex implementation
- Requires coordination between two rendering layers

### 4.3 Why Singleton Service Pattern on iOS?

**Decision**: Use SplashScreen2Service as singleton

**Rationale**:
- Centralized state management across view controllers
- Handles rootViewController transitions gracefully
- Maintains global preventAutoHide state
- Single point of splash screen lifecycle management

### 4.4 Why Notification-based Communication on iOS?

**Decision**: Use NotificationCenter for Module-Service communication

**Rationale**:
- Decouples module from service implementation
- Works across different execution contexts
- Standard iOS IPC mechanism
- Easy to add new observers

### 4.5 Why Template-based Code Generation?

**Decision**: Generate native code from templates at build time

**Rationale**:
- Avoids runtime reflection overhead
- Type-safe generated code
- Customizable per-project configuration
- IDE-friendly (generated code is readable)

---

## 5. Module Dependency Analysis

### 5.1 External Dependencies

```json
{
  "dependencies": {
    "@expo/prebuild-config": "^54.0.6",
    "react-native-web": "^0.21.2",
    "xml2js": "^0.6.0",
    "xmlbuilder": "^15.1.1"
  },
  "peerDependencies": {
    "expo": "*"
  }
}
```

### 5.2 Internal Module Dependencies

```
expo-splash-screen2
    |
    +-- src/
    |   +-- index.native.ts  -----> expo-modules-core (requireOptionalNativeModule)
    |   +-- index.ts         -----> (no dependencies)
    |
    +-- android/
    |   +-- SplashScreen2Module.kt  --> expo-modules-kotlin, react-android
    |
    +-- ios/
    |   +-- SplashScreen2Module.swift  --> ExpoModulesCore, UIKit
    |   +-- SplashScreen2Service.swift --> UIKit, WebKit
    |   +-- SplashScreen2ViewController.swift --> UIKit, WebKit
    |
    +-- plugin/
    |   +-- index.ts  ---------> expo/config-plugins, fs, path
    |   +-- templates/
    |       +-- android.ts -----> (template strings)
    |       +-- ios.ts ---------> (template strings)
    |
    +-- expo-splash-web/
        +-- src/
        |   +-- SplashScreenView.tsx --> react-native, react
        |   +-- index.ts -------------> react-native
        +-- build-splash-web.js ------> child_process, fs, path
```

### 5.3 Dependency Graph

```
                    +-------------------+
                    |   User App        |
                    +-------------------+
                            |
            +---------------+---------------+
            |                               |
    +-------v-------+               +-------v-------+
    | JavaScript API |               | Expo Config   |
    | (index.native) |               | Plugin        |
    +-------+-------+               +-------+-------+
            |                               |
    +-------v-------+               +-------v-------+
    | expo-modules- |               | expo/config-  |
    | core          |               | plugins       |
    +-------+-------+               +-------+-------+
            |                               |
    +-------v-------------------------------v-------+
    |              Native Modules                    |
    |  (SplashScreen2Module - Android/iOS)          |
    +-------------------+---------------------------+
                        |
    +-------------------v---------------------------+
    |              Platform SDKs                    |
    |  Android: AppCompatActivity, WebView         |
    |  iOS: UIViewController, WKWebView            |
    +-----------------------------------------------+
```

---

## 6. Technical Debt and Architecture Risks

### 6.1 Identified Technical Debt

#### 6.1.1 Large Plugin File
**Issue**: `/plugin/src/index.ts` is 293KB with ~7000+ lines

**Impact**:
- Difficult to maintain and navigate
- Slow IDE performance
- Risk of merge conflicts

**Recommendation**: Split into smaller, focused modules

#### 6.1.2 Duplicate Code Between Platforms
**Issue**: Similar logic exists in both Android and iOS implementations

**Examples**:
- Privacy function detection logic
- Auto-hide state management
- JavaScript bridge handling

**Recommendation**: Define shared interfaces and document expected behavior

#### 6.1.3 Debug Logging in Production Code
**Issue**: Extensive `print()` and `Log.d()` statements in production code

**Impact**:
- Performance overhead
- Potential information leakage
- Cluttered logs

**Recommendation**: Implement debug flag or logging utility

#### 6.1.4 Error Handling Inconsistency
**Issue**: Some errors are silently caught with `// Ignore error` comments

**Impact**:
- Difficult debugging
- Potential state corruption

**Recommendation**: Implement proper error reporting mechanism

### 6.2 Architecture Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Android Activity Lifecycle Complexity | Memory leaks, race conditions | Container reuse, careful state tracking |
| iOS RootViewController KVO | Crashes if observer not removed | Weak references, proper cleanup |
| WebView Memory Management | Memory leaks on rapid app relaunch | Explicit cleanup in deinit/onDestroy |
| Expo SDK Version Compatibility | Breaking changes in updates | Version peer dependencies, test matrix |

---

## 7. Architecture Improvement Recommendations

### 7.1 Short-term Improvements

1. **Modularize Plugin Code** - Split the large plugin file into focused modules
2. **Add Logging Utility** - Create unified logging with debug flag
3. **Implement Error Boundaries** - Add proper error handling

### 7.2 Medium-term Improvements

1. **Abstract Platform Differences** - Create platform abstraction layer
2. **Add State Machine** - Define clear splash lifecycle states
3. **Improve Test Infrastructure** - Add unit, integration, and E2E tests

### 7.3 Long-term Improvements

1. **Consider New Architecture** - Evaluate Fabric/TurboModules migration
2. **Extract Core as Separate Package** - Monorepo structure
3. **Add Telemetry Hooks** - Allow apps to track splash performance

---

## Appendix A: File Structure Overview

```
expo-splash-screen2/
    android/
        build.gradle
        src/main/java/expo/modules/splashhtml/
            SplashScreen2Module.kt
    ios/
        ExpoSplashHtml.podspec
        SplashScreen2Module.swift
        SplashScreen2Service.swift
        SplashScreen2ViewController.swift
        SplashScreen2PrivacyPolicyViewController.swift
    src/
        index.ts              (Web stub)
        index.native.ts       (Native API)
    plugin/
        src/
            index.ts          (Main plugin logic)
            templates/
                android.ts    (Android code templates)
                ios.ts        (iOS code templates)
                loader.ts     (Template loader)
        build/                (Compiled plugin)
    expo-splash-web/
        src/
            SplashScreenView.tsx
            index.ts
            images/
        dist/                 (Built HTML/JS/CSS)
        build-splash-web.js
        dev-splash-web.js
        app.config.js
    build/                    (Compiled TypeScript)
    docs/                     (Documentation)
```

---

## Appendix B: Configuration Interface

```typescript
interface SplashHtmlConfig {
  mode?: 'webview' | 'responsiveImage' | 'normal' | 'blend';
  backgroundColor?: string;
  image?: string;
  imageWidth?: number;
  localHtmlPath?: string;
  dark?: {
    image?: string;
    backgroundColor?: string;
    imageWidth?: number;
  };
}
```

---

*Document Version: 1.0*
*Last Updated: 2026-03-10*
*Author: Architecture Analysis Team*
