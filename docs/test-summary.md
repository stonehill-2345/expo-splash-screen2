# Test Cases Summary

Quick reference for test cases covering all four modes of `expo-splash-screen2`.

## Test Coverage Overview

| Mode | Test Cases | Status |
|------|-----------|--------|
| WebView | 3 | ✅ |
| ResponsiveImage | 2 | ✅ |
| Normal | 3 | ✅ |
| Blend | 3 | ✅ |
| Cross-Mode | 2 | ✅ |
| Platform-Specific | 3 | ✅ |
| Error Handling | 2 | ✅ |
| **Total** | **18** | ✅ |

## Quick Test Reference

### WebView Mode (3 tests)

1. **Basic WebView Configuration** (`webview_001`)
   - Verify basic setup works
   - Check file generation
   - Test build process

2. **Custom HTML Path** (`webview_002`)
   - Test custom HTML file support
   - Verify file copying

3. **JavaScript Bridge** (`webview_003`)
   - Test API functions
   - Verify native communication

### ResponsiveImage Mode (2 tests)

1. **Basic ResponsiveImage Configuration** (`responsive_001`)
   - Verify full-screen image display
   - Check image scaling
   - Test file copying

2. **Android .9 Patch Support** (`responsive_002`)
   - Test .9.png format
   - Verify Android scaling

### Normal Mode (3 tests)

1. **Basic Normal Configuration** (`normal_001`)
   - Verify centered image display
   - Test image width configuration
   - Check background color

2. **Custom Image Width** (`normal_002`)
   - Test custom width setting
   - Verify aspect ratio maintenance

3. **Dark Mode Support** (`normal_003`)
   - Test dark mode configuration
   - Verify iOS/Android dark mode support
   - Test runtime theme switching

### Blend Mode (3 tests)

1. **Basic Blend Configuration** (`blend_001`)
   - Verify .9 image + WebView combination
   - Check file generation
   - Test smooth transition

2. **WebView Container Background** (`blend_002`)
   - Verify .9 image background on container
   - Test no flickering
   - Check MainActivity modification

3. **Custom HTML in Blend Mode** (`blend_003`)
   - Test custom HTML with blend mode
   - Verify both features work together

### Cross-Mode Tests (2 tests)

1. **Mode Switching** (`cross_001`)
   - Test switching between modes
   - Verify cleanup of old files

2. **API Functions** (`cross_002`)
   - Test API across all modes
   - Verify consistency

### Platform-Specific Tests (3 tests)

1. **iOS Storyboard** (`platform_ios_001`)
   - Verify storyboard generation

2. **Android Manifest** (`platform_android_001`)
   - Verify manifest configuration

3. **Android Styles** (`platform_android_002`)
   - Verify styles.xml configuration

### Error Handling (2 tests)

1. **Missing Image File** (`error_001`)
   - Test graceful error handling

2. **Invalid Configuration** (`error_002`)
   - Test invalid mode handling

## Test Execution

### Manual Testing

Follow detailed test cases in [test-cases.md](./test-cases.md)

### Automated Testing

Use YAML test suite: `tests/test-suite.yaml`

```bash
# Run test suite (requires test runner implementation)
node tests/test-runner-example.js
```

## Key Test Scenarios

### Critical Path Tests

These tests must pass for basic functionality:

- ✅ WebView basic configuration
- ✅ ResponsiveImage basic configuration  
- ✅ Normal basic configuration
- ✅ Blend basic configuration
- ✅ API functions work in all modes

### Platform Coverage

- ✅ iOS: Storyboard, View Controller, Images
- ✅ Android: Manifest, Styles, MainActivity, Drawables

### Feature Coverage

- ✅ Custom HTML paths
- ✅ .9 patch images
- ✅ Dark mode
- ✅ Custom image widths
- ✅ Error handling

## Test Files

- **Test Cases**: `docs/test-cases.md` - Detailed test case descriptions
- **YAML Suite**: `tests/test-suite.yaml` - Automated test configuration
- **Test Runner**: `tests/test-runner-example.js` - Example test runner
- **Test Docs**: `tests/README.md` - Test documentation

## Next Steps

1. Implement full test runner based on `test-runner-example.js`
2. Integrate with CI/CD pipeline
3. Add visual regression tests
4. Add performance benchmarks
5. Expand error handling coverage
