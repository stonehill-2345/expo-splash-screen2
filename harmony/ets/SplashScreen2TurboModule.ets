/**
 * SplashScreen2 TurboModule for HarmonyOS
 * 控制 ArkTS 原生开屏遮罩的显隐，通过 AppStorage 驱动 Index.ets 的 @StorageLink。
 * 对齐 expo-splash-screen2 JS API：preventAutoHideAsync / hideAsync / setAutoHideAsync。
 */

import { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';

const SPLASH_VISIBLE_KEY = 'expo_splash_visible';

export class SplashScreen2TurboModule extends TurboModule {
  constructor(ctx: TurboModuleContext) {
    super(ctx);
    // 模块加载即视为开屏可见（由 Index.ets 的 @StorageLink 读取）
    AppStorage.setOrCreate(SPLASH_VISIBLE_KEY, true);
  }

  preventAutoHideAsync(): Promise<void> {
    AppStorage.setOrCreate(SPLASH_VISIBLE_KEY, true);
    return Promise.resolve();
  }

  hideAsync(): Promise<boolean> {
    AppStorage.setOrCreate(SPLASH_VISIBLE_KEY, false);
    return Promise.resolve(true);
  }

  setAutoHideAsync(_autoHide: boolean): void {
    // 自动隐藏策略暂不支持，保留接口对齐 JS API
  }
}
