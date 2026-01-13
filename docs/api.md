# API Reference

```tsx
import * as SplashScreen from 'expo-splash-screen2';
```

The native splash screen that is controlled via this module autohides once the React Native-controlled view hierarchy is mounted. This means that when your app first `render`s view component, the native splash screen will hide. This default behavior can be prevented by calling [`SplashScreen.preventAutoHideAsync()`](#splashscreenpreventautohideasync) and later on [`SplashScreen.hideAsync()`](#splashscreenhideasync).

## `SplashScreen.preventAutoHideAsync()`

This method makes the native splash screen stay visible until [`SplashScreen.hideAsync()`](#splashscreenhideasync) is called. This must be called before any React Native-controlled view hierarchy is rendered (either in the global scope of your main component, or when the component renders `null` at the beginning - see [Examples section](./examples.md)).

Preventing default autohiding might come in handy if your application needs to prepare/download some resources and/or make some API calls before first rendering some actual view hierarchy.

> **Important**: It is recommended to call this in global scope without awaiting, rather than inside React components or hooks.

### Returns

A `Promise` that resolves to `true` when preventing autohiding succeeded and to `false` if the native splash screen is already prevented from autohiding (for instance, if you've already called this method). `Promise` rejection most likely means that native splash screen cannot be prevented from autohiding (it's already hidden when this method was executed).

## `SplashScreen.hideAsync()`

Hides the native splash screen. Only works if the native splash screen has been previously prevented from autohiding by calling [`SplashScreen.preventAutoHideAsync()`](#splashscreenpreventautohideasync) method.

### Returns

A `Promise` that resolves to `true` once the splash screen becomes hidden and to `false` if the splash screen is already hidden.
