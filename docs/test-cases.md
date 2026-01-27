# Test Cases

This document describes comprehensive test cases for all four modes of `expo-splash-screen2`.

## Test Environment Setup

### Prerequisites
- Node.js >= 16
- Expo CLI installed
- iOS Simulator / Android Emulator or physical devices
- `react-native-web` installed (for webview and blend modes)

### Test Project Setup
```bash
# Create test project
npx create-expo-app test-splash-screen2
cd test-splash-screen2

# Install expo-splash-screen2
npm install expo-splash-screen2
npm install react-native-web  # Required for webview/blend modes
```

## Mode 1: WebView Mode

### Test Case 1.1: Basic WebView Configuration
**Objective**: Verify basic WebView mode setup works correctly

**Configuration**:
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

**Test Steps**:
1. Configure `app.json` with above configuration
2. Run `npx expo prebuild`
3. Build and run app on iOS
4. Build and run app on Android
5. Verify splash screen displays HTML content
6. Verify background color is white (#FFFFFF)

**Expected Results**:
- ✅ Prebuild completes without errors
- ✅ iOS app builds successfully
- ✅ Android app builds successfully
- ✅ Splash screen shows HTML content from `expo-splash-web`
- ✅ Background color matches configuration
- ✅ No console errors

**Test Files to Verify**:
- `ios/[Project]/SplashScreen2ViewController.swift` exists
- `android/app/src/main/assets/index.html` exists
- `expo-splash-web/dist/index.html` exists

---

### Test Case 1.2: Custom HTML Path
**Objective**: Verify custom HTML file path works

**Configuration**:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "webview",
          "backgroundColor": "#FF0000",
          "localHtmlPath": "./custom-splash.html"
        }
      ]
    ]
  }
}
```

**Test Steps**:
1. Create `custom-splash.html` in project root
2. Configure `app.json` with above configuration
3. Run `npx expo prebuild`
4. Build and run app
5. Verify custom HTML is displayed

**Expected Results**:
- ✅ Custom HTML file is copied to assets
- ✅ Splash screen displays custom HTML content
- ✅ Background color is red (#FF0000)

---

### Test Case 1.3: WebView JavaScript Bridge
**Objective**: Verify JavaScript bridge communication works

**Test Steps**:
1. Configure WebView mode
2. In HTML, call `window.ReactNativeWebView.postMessage()`
3. Verify native side receives messages
4. Test `SplashScreen.preventAutoHideAsync()` and `SplashScreen.hideAsync()`

**Expected Results**:
- ✅ JavaScript can communicate with native code
- ✅ `preventAutoHideAsync()` prevents auto-hide
- ✅ `hideAsync()` hides splash screen correctly

---

## Mode 2: ResponsiveImage Mode

### Test Case 2.1: Basic ResponsiveImage Configuration
**Objective**: Verify responsive image mode displays full-screen background

**Configuration**:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "responsiveImage",
          "backgroundColor": "#000000",
          "image": "./assets/splash-background.png"
        }
      ]
    ]
  }
}
```

**Test Steps**:
1. Add background image to `assets/splash-background.png`
2. Configure `app.json` with above configuration
3. Run `npx expo prebuild`
4. Build and run on iOS
5. Build and run on Android
6. Verify image covers entire screen
7. Verify image scales correctly on different screen sizes

**Expected Results**:
- ✅ Prebuild completes successfully
- ✅ Image is copied to native resources
- ✅ Image covers entire screen (scaleAspectFill)
- ✅ Image scales correctly on different devices
- ✅ Background color is black (#000000)

**Test Files to Verify**:
- iOS: `ios/[Project]/Images.xcassets/SplashScreen.imageset/` contains image
- Android: `android/app/src/main/res/drawable/splash_background_image.png` exists

---

### Test Case 2.2: Android .9 Patch Image Support
**Objective**: Verify .9 patch image format works on Android

**Configuration**:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "responsiveImage",
          "image": "./assets/splash-background.9.png"
        }
      ]
    ]
  }
}
```

**Test Steps**:
1. Create `.9.png` image file
2. Configure `app.json` with above configuration
3. Run `npx expo prebuild`
4. Build and run on Android
5. Verify .9 patch scaling works correctly
6. Test on different screen sizes

**Expected Results**:
- ✅ .9.png file is recognized and copied
- ✅ Android uses .9 patch scaling
- ✅ Image scales correctly without distortion
- ✅ Works on various screen sizes

---

## Mode 3: Normal Mode

### Test Case 3.1: Basic Normal Mode Configuration
**Objective**: Verify centered image with background color displays correctly

**Configuration**:
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

**Test Steps**:
1. Add icon image to `assets/splash-icon.png`
2. Configure `app.json` with above configuration
3. Run `npx expo prebuild`
4. Build and run on iOS
5. Build and run on Android
6. Verify image is centered
7. Verify image width is 100dp/pt
8. Verify background color matches

**Expected Results**:
- ✅ Image is centered on screen
- ✅ Image width is 100dp/pt
- ✅ Image maintains aspect ratio
- ✅ Background color is #10021F
- ✅ Image scales correctly

---

### Test Case 3.2: Custom Image Width
**Objective**: Verify custom image width works

**Configuration**:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "normal",
          "image": "./assets/splash-icon.png",
          "imageWidth": 200
        }
      ]
    ]
  }
}
```

**Test Steps**:
1. Configure with `imageWidth: 200`
2. Run prebuild and build app
3. Verify image width is 200dp/pt

**Expected Results**:
- ✅ Image width is 200dp/pt
- ✅ Image maintains aspect ratio

---

### Test Case 3.3: Dark Mode Support
**Objective**: Verify dark mode configuration works

**Configuration**:
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

**Test Steps**:
1. Add dark mode image `splash-icon-dark.png`
2. Configure with dark mode settings
3. Run prebuild
4. Test on iOS with system appearance set to Dark
5. Test on Android with system theme set to Dark
6. Verify dark mode images and colors are used
7. Test runtime theme switching (if supported)

**Expected Results**:
- ✅ Light mode uses light background and image
- ✅ Dark mode uses dark background and image
- ✅ iOS detects system appearance correctly
- ✅ Android uses drawable-night resources
- ✅ Runtime theme switching works (if supported)

**Test Files to Verify**:
- iOS: Images in `Images.xcassets` with dark mode variants
- Android: `drawable/` and `drawable-night/` directories contain images

---

## Mode 4: Blend Mode

### Test Case 4.1: Basic Blend Mode Configuration
**Objective**: Verify blend mode combines .9 image background with WebView

**Configuration**:
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

**Test Steps**:
1. Add .9.png background image
2. Configure `app.json` with above configuration
3. Run `npx expo prebuild`
4. Build and run on iOS
5. Build and run on Android
6. Verify system splash screen shows .9 image
7. Verify WebView container displays HTML content
8. Verify smooth transition between system and WebView splash

**Expected Results**:
- ✅ Prebuild completes successfully
- ✅ System splash screen uses .9 image background
- ✅ WebView container displays HTML content
- ✅ No flickering during transition
- ✅ Smooth visual continuity

**Test Files to Verify**:
- `android/app/src/main/res/drawable/splash_background_image.9.png` exists
- `android/app/src/main/res/values/styles.xml` contains Theme.App.SplashScreen
- `android/app/src/main/java/.../MainActivity.kt` has webview container with background
- `ios/[Project]/SplashScreen2ViewController.swift` configured correctly

---

### Test Case 4.2: Blend Mode WebView Container Background
**Objective**: Verify webview container has .9 image background

**Test Steps**:
1. Configure blend mode
2. Run prebuild
3. Check `MainActivity.kt` for webview container background setting
4. Verify background drawable is set correctly
5. Test app and verify no background color flashing

**Expected Results**:
- ✅ Webview container has .9 image background set
- ✅ No white/black background flash
- ✅ Smooth transition from system splash

---

### Test Case 4.3: Blend Mode Custom HTML
**Objective**: Verify custom HTML path works in blend mode

**Configuration**:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen2",
        {
          "mode": "blend",
          "image": "./assets/splash-background.9.png",
          "localHtmlPath": "./custom-blend.html"
        }
      ]
    ]
  }
}
```

**Test Steps**:
1. Create custom HTML file
2. Configure with `localHtmlPath`
3. Run prebuild and build app
4. Verify custom HTML is displayed

**Expected Results**:
- ✅ Custom HTML is used instead of default
- ✅ Background .9 image still works
- ✅ Smooth transition maintained

---

## Cross-Mode Tests

### Test Case 5.1: Mode Switching
**Objective**: Verify switching between modes works correctly

**Test Steps**:
1. Configure with mode A, run prebuild, build app
2. Change to mode B, run prebuild, build app
3. Verify old mode files are cleaned up
4. Verify new mode files are created correctly

**Expected Results**:
- ✅ Old mode files are removed
- ✅ New mode files are created
- ✅ No conflicts or errors

---

### Test Case 5.2: API Functions
**Objective**: Verify API functions work across all modes

**Test Steps**:
1. Test `SplashScreen.preventAutoHideAsync()` in each mode
2. Test `SplashScreen.hideAsync()` in each mode
3. Verify functions work correctly in all modes

**Expected Results**:
- ✅ `preventAutoHideAsync()` works in all modes
- ✅ `hideAsync()` works in all modes
- ✅ No mode-specific API issues

---

### Test Case 5.3: Prebuild Cleanup
**Objective**: Verify prebuild cleans up correctly

**Test Steps**:
1. Run prebuild with mode A
2. Switch to mode B
3. Run prebuild again
4. Verify no leftover files from mode A

**Expected Results**:
- ✅ Old files are cleaned up
- ✅ No conflicting configurations
- ✅ Clean build state

---

## Platform-Specific Tests

### iOS Specific

#### Test Case 6.1: iOS Storyboard Generation
**Objective**: Verify iOS storyboard is generated correctly

**Test Steps**:
1. Run prebuild
2. Check `ios/[Project]/SplashScreen.storyboard` exists
3. Verify storyboard contains correct configuration
4. Build iOS app

**Expected Results**:
- ✅ Storyboard file exists
- ✅ Storyboard configuration is correct
- ✅ App builds successfully

---

#### Test Case 6.2: iOS View Controller
**Objective**: Verify SplashScreen2ViewController works correctly

**Test Steps**:
1. Check `SplashScreen2ViewController.swift` exists
2. Verify view controller logic is correct
3. Test app launch and splash screen display

**Expected Results**:
- ✅ View controller exists
- ✅ View controller displays correctly
- ✅ No crashes or errors

---

### Android Specific

#### Test Case 7.1: Android Manifest Configuration
**Objective**: Verify AndroidManifest.xml is configured correctly

**Test Steps**:
1. Run prebuild
2. Check `AndroidManifest.xml` for splash activity configuration
3. Verify theme configuration
4. Build Android app

**Expected Results**:
- ✅ Manifest contains splash activity
- ✅ Theme is configured correctly
- ✅ App builds successfully

---

#### Test Case 7.2: Android Styles Configuration
**Objective**: Verify styles.xml is configured correctly

**Test Steps**:
1. Run prebuild
2. Check `res/values/styles.xml`
3. Verify Theme.App.SplashScreen configuration
4. Verify windowBackground is set correctly

**Expected Results**:
- ✅ Styles.xml contains Theme.App.SplashScreen
- ✅ windowBackground is configured correctly
- ✅ Works in all modes

---

#### Test Case 7.3: Android MainActivity Modification
**Objective**: Verify MainActivity is modified correctly

**Test Steps**:
1. Run prebuild
2. Check `MainActivity.kt` or `MainActivity.java`
3. Verify WebView container code (for webview/blend modes)
4. Verify image container code (for normal/responsiveImage modes)

**Expected Results**:
- ✅ MainActivity contains required code
- ✅ Code is correct for selected mode
- ✅ No syntax errors

---

## Performance Tests

### Test Case 8.1: Splash Screen Display Time
**Objective**: Verify splash screen displays quickly

**Test Steps**:
1. Measure time from app launch to splash screen display
2. Test on different devices
3. Verify display time is acceptable (< 500ms)

**Expected Results**:
- ✅ Splash screen displays quickly
- ✅ No noticeable delay
- ✅ Consistent across devices

---

### Test Case 8.2: Memory Usage
**Objective**: Verify splash screen doesn't cause memory issues

**Test Steps**:
1. Monitor memory usage during splash screen display
2. Check for memory leaks
3. Verify memory is released after splash screen hides

**Expected Results**:
- ✅ No memory leaks
- ✅ Memory is released correctly
- ✅ Acceptable memory usage

---

## Error Handling Tests

### Test Case 9.1: Missing Image File
**Objective**: Verify graceful handling of missing image files

**Test Steps**:
1. Configure with non-existent image path
2. Run prebuild
3. Verify appropriate error message or fallback

**Expected Results**:
- ✅ Clear error message
- ✅ Prebuild fails gracefully
- ✅ No crashes

---

### Test Case 9.2: Invalid Configuration
**Objective**: Verify invalid configuration is handled

**Test Steps**:
1. Configure with invalid mode value
2. Configure with missing required fields
3. Run prebuild
4. Verify appropriate error handling

**Expected Results**:
- ✅ Clear error messages
- ✅ Prebuild fails gracefully
- ✅ Helpful error guidance

---

## Integration Tests

### Test Case 10.1: Expo Router Integration
**Objective**: Verify works with Expo Router

**Test Steps**:
1. Create Expo Router project
2. Configure splash screen plugin
3. Use `SplashScreen.preventAutoHideAsync()` in `_layout.tsx`
4. Test app navigation and splash screen

**Expected Results**:
- ✅ Works with Expo Router
- ✅ Splash screen displays correctly
- ✅ Navigation works after splash screen

---

### Test Case 10.2: React Navigation Integration
**Objective**: Verify works with React Navigation

**Test Steps**:
1. Create React Navigation project
2. Configure splash screen plugin
3. Test navigation and splash screen interaction

**Expected Results**:
- ✅ Works with React Navigation
- ✅ No conflicts
- ✅ Smooth integration

---

## Test Execution Checklist

- [ ] All WebView mode tests pass
- [ ] All ResponsiveImage mode tests pass
- [ ] All Normal mode tests pass
- [ ] All Blend mode tests pass
- [ ] Cross-mode tests pass
- [ ] iOS-specific tests pass
- [ ] Android-specific tests pass
- [ ] Performance tests pass
- [ ] Error handling tests pass
- [ ] Integration tests pass
