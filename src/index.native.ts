import { requireOptionalNativeModule } from 'expo-modules-core';

// 原生模块类型定义
interface SplashHtmlNativeModule {
  preventAutoHideAsync: () => Promise<boolean>;
  hideAsync: () => Promise<boolean>;
  internalPreventAutoHideAsync: () => Promise<void>;
  internalMaybeHideAsync: () => Promise<void>;
}

// 获取原生模块
const SplashHtmlModule = requireOptionalNativeModule<SplashHtmlNativeModule>('ExpoSplashHtml');

/**
 * Makes the HTML splash screen remain visible until `hideAsync` is called.
 *
 * > **Important note**: It is recommended to call this in global scope without awaiting, rather than
 * > inside React components or hooks, because otherwise this might be called too late,
 * > when the splash screen is already hidden.
 *
 * @example
 * ```ts
 * import * as SplashHtml from 'expo-splash-screen2';
 *
 * SplashHtml.preventAutoHideAsync();
 *
 * export default function App() {
 *   // ...
 * }
 * ```
 */
export async function preventAutoHideAsync(): Promise<boolean> {
  if (!SplashHtmlModule) {
    return false;
  }
  return SplashHtmlModule.preventAutoHideAsync();
}

/**
 * Hides the HTML splash screen immediately.
 *
 * @example
 * ```ts
 * import * as SplashHtml from 'expo-splash-screen2';
 *
 * // Hide the splash screen when ready
 * await SplashHtml.hideAsync();
 * ```
 */
export async function hideAsync(): Promise<boolean> {
  if (!SplashHtmlModule) {
    return false;
  }
  return SplashHtmlModule.hideAsync();
}

/**
 * @private
 * Internal method for libraries like expo-router.
 * Prevents auto-hide without marking user control.
 */
export async function _internal_preventAutoHideAsync(): Promise<void> {
  if (!SplashHtmlModule) {
    return;
  }
  return SplashHtmlModule.internalPreventAutoHideAsync();
}

/**
 * @private
 * Internal method for libraries like expo-router.
 * Hides the splash screen only if user hasn't called preventAutoHideAsync.
 */
export async function _internal_maybeHideAsync(): Promise<void> {
  if (!SplashHtmlModule) {
    return;
  }
  return SplashHtmlModule.internalMaybeHideAsync();
}
