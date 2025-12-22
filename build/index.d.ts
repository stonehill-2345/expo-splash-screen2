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
