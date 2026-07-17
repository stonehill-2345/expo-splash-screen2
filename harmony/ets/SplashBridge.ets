/**
 * SplashBridge - Web 组件的 JS 桥接对象
 * 注册为 window.Android（与 SplashScreenView.tsx 的 Android 分支对齐，无需改 HTML）。
 * 三个方法由开屏 HTML 内的隐私弹窗按钮调用：
 * - agreePrivacyPolicy: 存 isAuth=true + 设 auth_agreed 触发 RN 启动 + 注入 hidePrivacyDialog
 * - disagreePrivacyPolicy: 退出应用
 * - openPrivacyPolicy(url): 系统浏览器打开协议链接
 */

import { common } from '@kit.AbilityKit';
import { splashAuthStore } from './SplashAuthStore';
import webview from '@ohos.web.webview';

const KEY_AUTH_AGREED = 'expo_splash_auth_agreed';

export class SplashBridge {
  private ctx: common.UIAbilityContext;
  private controller: webview.WebviewController;

  constructor(ctx: common.UIAbilityContext, controller: webview.WebviewController) {
    this.ctx = ctx;
    this.controller = controller;
  }

  agreePrivacyPolicy(): void {
    console.info('[SplashBridge] agreePrivacyPolicy');
    // 1. 持久化 isAuth=true
    splashAuthStore.setAuth(true);
    // 2. 设 auth_agreed=true，Index.ets 的 @Watch 触发 connectMetro 启动 RN
    AppStorage.setOrCreate(KEY_AUTH_AGREED, true);
    // 3. 注入 JS 关闭弹窗
    this.controller.runJavaScript(
      'if(window.hidePrivacyDialog){hidePrivacyDialog();}'
    );
  }

  disagreePrivacyPolicy(): void {
    console.info('[SplashBridge] disagreePrivacyPolicy, exiting app');
    this.ctx.terminateSelf();
  }

  openPrivacyPolicy(url: string): void {
    console.info('[SplashBridge] openPrivacyPolicy:', url);
    try {
      this.ctx.openLink(url);
    } catch (e) {
      console.error('[SplashBridge] openLink failed, fallback startAbility:', e);
      const want: Record<string, string> = { 'action': 'ohos.want.action.viewData', 'entity': 'entity.system.browsable', 'uri': url };
      this.ctx.startAbility(want).catch((err: Error) => {
        console.error('[SplashBridge] startAbility failed:', err);
      });
    }
  }
}
