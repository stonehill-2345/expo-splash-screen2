/**
 * SplashScreen2View for HarmonyOS
 * ArkTS 原生开屏遮罩：底层背景图 + 顶层透明 WebView 加载 index.html。
 * 对齐 iOS/Android blend 模式：背景图 + logo + 动画 + 隐私协议弹窗。
 * - 遮罩显隐：AppStorage('expo_splash_visible')，由 SplashScreen2TurboModule.hideAsync() 控制
 * - 隐私授权状态：AppStorage('expo_splash_is_auth')，由 Index.ets 从 preferences 读后注入
 * - JS 桥接：window.Android（agree/disagree/openPrivacy），注册名与 SplashScreenView.tsx 的 Android 分支对齐
 */

import webview from '@ohos.web.webview';
import { common } from '@kit.AbilityKit';
import { SplashBridge } from './SplashBridge';

@Component
export struct SplashScreen2View {
  @StorageLink('expo_splash_visible') visible: boolean = true;
  @StorageProp('expo_splash_is_auth') isAuth: boolean = false;
  // 由 Index.ets 渲染时传入（避免在 View 内从 AppStorage 取弱类型值）
  uiAbilityContext: common.UIAbilityContext | undefined = undefined;
  private controller: webview.WebviewController = new webview.WebviewController();
  private bridge: SplashBridge | null = null;

  build() {
    if (this.visible) {
      Stack() {
        // 底层：背景色（由插件 writeHarmonySplashColor 写入 color.json）
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor($r('app.color.expo_splash_background'))

        // 背景图：由插件 copySplashImageToHarmony 拷入 rawfile/expo_splash.png。
        // 鸿蒙 ArkUI 不解析 .9 标记，objectFit(Cover) 填充并裁掉 1px 黑边。
        Image($rawfile('expo_splash.png'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)

        // 顶层：透明 WebView 加载开屏 HTML（top/bottom logo + 动画 + 隐私弹窗）
        Web({ src: $rawfile('splash/index.html'), controller: this.controller })
          .width('100%')
          .height('100%')
          .javaScriptAccess(true)
          .backgroundColor(Color.Transparent)
          .onControllerAttached(() => {
            this.registerBridge();
          })
          .onPageEnd(() => {
            this.injectAuthState();
          })
      }
      .width('100%')
      .height('100%')
    }
  }

  private registerBridge() {
    try {
      if (this.uiAbilityContext) {
        this.bridge = new SplashBridge(this.uiAbilityContext, this.controller);
        this.controller.registerJavaScriptProxy(
          this.bridge,
          'Android',
          ['agreePrivacyPolicy', 'disagreePrivacyPolicy', 'openPrivacyPolicy']
        );
      } else {
        console.warn('[SplashScreen2View] uiAbilityContext not available, bridge not registered');
      }
    } catch (e) {
      console.error('[SplashScreen2View] registerBridge failed:', e);
    }
  }

  private injectAuthState() {
    try {
      // 注入 window.isAuth 并触发 HTML 内的 checkAuthStatus 决定弹窗显隐
      this.controller.runJavaScript(
        `window.isAuth=${this.isAuth}; if(window.checkAuthStatus){checkAuthStatus();}`
      );
    } catch (e) {
      console.error('[SplashScreen2View] injectAuthState failed:', e);
    }
  }
}
