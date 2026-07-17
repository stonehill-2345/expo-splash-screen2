/**
 * SplashScreen2 Package for HarmonyOS
 * 注册 TurboModule（模块名 'ExpoSplashHtml'，与包 JS 入口 requireOptionalNativeModule('ExpoSplashHtml') 对齐，
 * 需与 C++ 侧一致）。
 */

import { RNPackage, TurboModulesFactory } from '@rnoh/react-native-openharmony/ts';
import type { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { SplashScreen2TurboModule } from './SplashScreen2TurboModule';

class SplashScreen2TurboModulesFactory extends TurboModulesFactory {
  createTurboModule(name: string): TurboModule | null {
    if (name === 'ExpoSplashHtml') {
      return new SplashScreen2TurboModule(this.ctx);
    }
    return null;
  }

  hasTurboModule(name: string): boolean {
    return name === 'ExpoSplashHtml';
  }
}

export class SplashScreen2Package extends RNPackage {
  createTurboModulesFactory(ctx: TurboModuleContext): TurboModulesFactory {
    return new SplashScreen2TurboModulesFactory(ctx);
  }
}
