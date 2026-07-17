/**
 * HarmonyOS platform implementation.
 *
 * 鸿蒙 RNOH 0.77 未注入 expo-modules-core 的 JSI proxy（globalThis.expo），也未注入
 * TurboModule 的 `__turboModuleProxy`；但注入了 `global.nativeModuleProxy`（NativeModules
 * 底层即它），它走 RNOH 的 hasTurboModule 注册名。故从 nativeModuleProxy 取 'ExpoSplashHtml'。
 * 用 globalThis 避免 import 'react-native' 的类型依赖。
 */
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
export declare function preventAutoHideAsync(): Promise<boolean>;
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
export declare function hideAsync(): Promise<boolean>;
/**
 * @private
 * Internal method for libraries like expo-router.
 * Prevents auto-hide without marking user control.
 */
export declare function _internal_preventAutoHideAsync(): Promise<void>;
/**
 * @private
 * Internal method for libraries like expo-router.
 * Hides the splash screen only if user hasn't called preventAutoHideAsync.
 */
export declare function _internal_maybeHideAsync(): Promise<void>;
