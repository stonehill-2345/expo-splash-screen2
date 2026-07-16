/**
 * HarmonyOS platform implementation.
 *
 * 鸿蒙 RNOH 0.77 未注入 expo-modules-core 的 JSI proxy（globalThis.expo），也未注入
 * TurboModule 的 `__turboModuleProxy`；但注入了 `global.nativeModuleProxy`（NativeModules
 * 底层即它），它走 RNOH 的 hasTurboModule 注册名。故从 nativeModuleProxy 取 'ExpoSplashHtml'。
 * 用 globalThis 避免 import 'react-native' 的类型依赖。
 */

// 原生模块类型定义
interface SplashHtmlNativeModule {
  preventAutoHideAsync: () => Promise<boolean>;
  hideAsync: () => Promise<boolean>;
  internalPreventAutoHideAsync: () => Promise<void>;
  internalMaybeHideAsync: () => Promise<void>;
}

// RNOH 注入的 NativeModules JSI proxy（NativeModules 底层即 global.nativeModuleProxy）
const nativeModuleProxy: Record<string, SplashHtmlNativeModule> | undefined =
  (globalThis as Record<string, unknown>).nativeModuleProxy as
    Record<string, SplashHtmlNativeModule> | undefined;

// 诊断：排查鸿蒙原生模块解析链路
console.info('[expo-splash-screen2] nativeModuleProxy exists:', !!nativeModuleProxy);
let SplashHtmlModule: SplashHtmlNativeModule | null = null;
try {
  if (nativeModuleProxy) {
    const mod = nativeModuleProxy['ExpoSplashHtml'];
    SplashHtmlModule = mod ?? null;
    console.info('[expo-splash-screen2] nativeModuleProxy["ExpoSplashHtml"]:', mod ? 'object' : 'null/undefined');
    if (mod) {
      console.info('[expo-splash-screen2] module methods:', Object.keys(mod).join(', ') || '(none)');
    }
  } else {
    console.warn('[expo-splash-screen2] nativeModuleProxy 不存在，RNOH 未注入原生模块 JSI');
  }
} catch (e) {
  console.error('[expo-splash-screen2] proxy 调用异常:', e);
}

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
