package expo.modules.splashhtml

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.facebook.react.bridge.ReactMarker
import com.facebook.react.bridge.ReactMarkerConstants

class SplashScreen2Module : Module() {
  // Mark whether user manually called preventAutoHideAsync
  // If user called it, don't auto-hide, wait for user to manually call hideAsync
  private var userControlledAutoHideEnabled: Boolean = false
  
  // Mark whether preventAutoHideAsync has been called (including internal calls)
  private var preventAutoHideCalled: Boolean = false

  // Listen to React Native content appearance event
  private val contentAppearedListener = ReactMarker.MarkerListener { name, _, _ ->
    if (name == ReactMarkerConstants.CONTENT_APPEARED) {
      // RN content has appeared, if user didn't call preventAutoHideAsync, auto-hide
      if (!preventAutoHideCalled) {
        hideInternal(force = true)
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoSplashHtml")

    OnCreate {
      // Register React Marker listener
      ReactMarker.addListener(contentAppearedListener)
    }

    OnDestroy {
      // Remove listener
      ReactMarker.removeListener(contentAppearedListener)
    }

    // User-called preventAutoHideAsync
    AsyncFunction("preventAutoHideAsync") {
      // Mark that user manually controlled auto-hide behavior
      userControlledAutoHideEnabled = true
      preventAutoHideCalled = true
      
      // Call native Activity's preventAutoHide method
      callActivityPreventAutoHide()
      
      return@AsyncFunction true
    }

    // Internally called preventAutoHideAsync (for libraries like expo-router)
    AsyncFunction("internalPreventAutoHideAsync") {
      preventAutoHideCalled = true
      callActivityPreventAutoHide()
    }

    // User-called hideAsync
    AsyncFunction("hideAsync") {
      hideInternal(force = true)
      return@AsyncFunction true
    }

    // Internally called maybeHideAsync (hide if user hasn't manually controlled)
    AsyncFunction("internalMaybeHideAsync") {
      if (!userControlledAutoHideEnabled) {
        hideInternal(force = true)
      }
    }
  }

  /**
   * Call Activity's preventAutoHide method
   */
  private fun callActivityPreventAutoHide() {
    try {
      val activity = appContext.currentActivity ?: return
      
      // First try to call preventAutoHide from current Activity
      try {
        val activityClass = activity.javaClass
        val method = activityClass.getMethod("preventAutoHide")
        method.invoke(activity)
        return
      } catch (e: NoSuchMethodException) {
        // Current Activity doesn't have preventAutoHide method, continue trying other ways
      } catch (e: Exception) {
        // Call failed, continue trying other ways
      }
      
      // Try to get from SplashScreen2Activity
      try {
        val customSplashClass = Class.forName("${activity.packageName}.SplashScreen2Activity")
        val getInstanceMethod = customSplashClass.getMethod("getInstance")
        val instance = getInstanceMethod.invoke(null)
        if (instance != null) {
          val method = instance.javaClass.getMethod("preventAutoHide")
          method.invoke(instance)
          return
        }
      } catch (e: Exception) {
        // Ignore error, continue trying MainActivity
      }
      
      // Try to get from MainActivity
      try {
        val mainActivityClass = Class.forName("${activity.packageName}.MainActivity")
        if (mainActivityClass.isInstance(activity)) {
          val method = mainActivityClass.getMethod("preventAutoHide")
          method.invoke(activity)
        }
      } catch (e: Exception) {
        // Ignore error
      }
    } catch (e: Exception) {
      // Ignore error
    }
  }

  /**
   * Internal hide method
   */
  private fun hideInternal(force: Boolean = false) {
    try {
      val activity = appContext.currentActivity ?: return
      val activityClass = activity.javaClass
      val packageName = activity.packageName
      
      // Strategy: Try to hide all possible containers simultaneously to ensure all are hidden
      
      // 1. Try current Activity's image mode method
      try {
        val method = activityClass.getMethod("hideSplashImageViewContainer", Boolean::class.java)
        method.invoke(activity, force)
      } catch (e: NoSuchMethodException) {
        try {
          val method = activityClass.getMethod("hideSplashImageViewContainer")
          method.invoke(activity)
        } catch (e2: Exception) {
          // Continue
        }
      } catch (e: Exception) {
        // Continue
      }
      
      // 2. Try current Activity's WebView mode method
      try {
        val method = activityClass.getMethod("hideWebViewContainer", Boolean::class.java)
        method.invoke(activity, force)
      } catch (e: NoSuchMethodException) {
        try {
          val method = activityClass.getMethod("hideWebViewContainer")
          method.invoke(activity)
        } catch (e2: Exception) {
          // Continue
        }
      } catch (e: Exception) {
        // Continue
      }
      
      // 3. Try SplashScreen2Activity
      try {
        val customSplashClass = Class.forName("$packageName.SplashScreen2Activity")
        val getInstanceMethod = customSplashClass.getMethod("getInstance")
        val instance = getInstanceMethod.invoke(null)
        if (instance != null) {
          try {
            val method = instance.javaClass.getMethod("hideWebViewContainer", Boolean::class.java)
            method.invoke(instance, force)
          } catch (e: NoSuchMethodException) {
            try {
              val method = instance.javaClass.getMethod("hideWebViewContainer")
              method.invoke(instance)
            } catch (e2: Exception) {
              // Continue
            }
          } catch (e: Exception) {
            // Continue
          }
        }
      } catch (e: Exception) {
        // SplashScreen2Activity doesn't exist or has been destroyed, continue
      }
    } catch (e: Exception) {
      // Ignore error
    }
  }
}
