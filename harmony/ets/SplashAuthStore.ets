/**
 * SplashAuthStore - 隐私协议授权状态持久化
 * 用 preferences 存储 isAuth，对齐 iOS UserDefaults("isAuth") / Android SharedPreferences。
 * 首次启动 isAuth=false 显示隐私弹窗；agree 后存 true，后续启动跳过弹窗直接进 RN。
 */

import { preferences } from '@kit.ArkData';
import { Context } from '@kit.AbilityKit';

const STORE_NAME = 'SplashAuthStore';
const KEY_IS_AUTH = 'isAuth';

class SplashAuthStore {
  private store: preferences.Preferences | null = null;

  async init(context: Context): Promise<void> {
    try {
      this.store = await preferences.getPreferences(context, STORE_NAME);
    } catch (error) {
      console.error('[SplashAuthStore] init failed:', error);
    }
  }

  async getIsAuth(): Promise<boolean> {
    if (!this.store) {
      return false;
    }
    try {
      const val = await this.store.get(KEY_IS_AUTH, false) as boolean;
      return val === true;
    } catch (error) {
      console.error('[SplashAuthStore] getIsAuth failed:', error);
      return false;
    }
  }

  async setAuth(authed: boolean): Promise<void> {
    if (!this.store) {
      return;
    }
    try {
      await this.store.put(KEY_IS_AUTH, authed);
      await this.store.flush();
    } catch (error) {
      console.error('[SplashAuthStore] setAuth failed:', error);
    }
  }
}

export const splashAuthStore = new SplashAuthStore();
