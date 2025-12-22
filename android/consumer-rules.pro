# expo-splash-screen2 ProGuard 规则
# ================================================

# 保留 Expo 模块核心类
-keep class expo.modules.splashhtml.** { *; }
-keep class expo.modules.kotlin.** { *; }

# 保留 SplashScreen2Activity 及其静态方法（用于反射调用）
-keep class **.SplashScreen2Activity {
    public static *** getInstance();
    public void preventAutoHide();
    public void hideWebViewContainer();
    public void hideWebViewContainer(boolean);
}

# 保留 MainActivity 中的开屏相关方法（用于反射调用）
-keepclassmembers class **.MainActivity {
    public void preventAutoHide();
    public void hideSplashImageViewContainer();
    public void hideSplashImageViewContainer(boolean);
    public void hideWebViewContainer();
    public void hideWebViewContainer(boolean);
}

# 保留任何 Activity 中可能存在的开屏方法（兼容自定义 Activity）
-keepclassmembers class * extends android.app.Activity {
    public void preventAutoHide();
    public void hideSplashImageViewContainer();
    public void hideSplashImageViewContainer(boolean);
    public void hideWebViewContainer();
    public void hideWebViewContainer(boolean);
}
