import ExpoModulesCore
import UIKit

public class SplashScreen2Module: Module {
  // Mark whether user manually called preventAutoHideAsync
  // If user called it, don't auto-hide, wait for user to manually call hideAsync
  var userControlledAutoHideEnabled = false
  
  // Mark whether preventAutoHideAsync has been called (including internal calls)
  var preventAutoHideCalled = false

  public func definition() -> ModuleDefinition {
    Name("ExpoSplashHtml")

    OnCreate {
      // Listen to React Native content appearance event
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(onContentDidAppear),
        name: NSNotification.Name("RCTContentDidAppearNotification"),
        object: nil
      )
    }

    OnDestroy {
      // Remove observer
      NotificationCenter.default.removeObserver(
        self,
        name: NSNotification.Name("RCTContentDidAppearNotification"),
        object: nil
      )
    }

    // User-called preventAutoHideAsync
    AsyncFunction("preventAutoHideAsync") { () -> Bool in
      // Mark that user manually controlled auto-hide behavior
      self.userControlledAutoHideEnabled = true
      self.preventAutoHideCalled = true
      
      print("[SplashScreen2Module] preventAutoHideAsync called, userControlledAutoHideEnabled = true")
      
      // Communicate with SplashScreen2Service via notification
      DispatchQueue.main.async {
        NotificationCenter.default.post(
          name: NSNotification.Name("SplashHtmlPreventAutoHide"),
          object: nil
        )
      }
      
      return true
    }

    // Internally called preventAutoHideAsync (for libraries like expo-router)
    AsyncFunction("internalPreventAutoHideAsync") {
      self.preventAutoHideCalled = true
      
      print("[SplashScreen2Module] internalPreventAutoHideAsync called")
      
      DispatchQueue.main.async {
        NotificationCenter.default.post(
          name: NSNotification.Name("SplashHtmlPreventAutoHide"),
          object: nil
        )
      }
    }

    // User-called hideAsync
    AsyncFunction("hideAsync") { () -> Bool in
      print("[SplashScreen2Module] hideAsync called")
      
      DispatchQueue.main.async {
        NotificationCenter.default.post(
          name: NSNotification.Name("SplashHtmlHide"),
          object: nil,
          userInfo: ["force": true]
        )
      }
      
      return true
    }

    // Internally called maybeHideAsync (hide if user hasn't manually controlled)
    AsyncFunction("internalMaybeHideAsync") {
      print("[SplashScreen2Module] internalMaybeHideAsync called, userControlledAutoHideEnabled = \(self.userControlledAutoHideEnabled)")
      
      if !self.userControlledAutoHideEnabled {
        DispatchQueue.main.async {
          NotificationCenter.default.post(
            name: NSNotification.Name("SplashHtmlHide"),
            object: nil,
            userInfo: ["force": true]
          )
        }
      }
    }
  }

  // Callback when RN content appears
  @objc private func onContentDidAppear() {
    print("[SplashScreen2Module] RCTContentDidAppearNotification received, preventAutoHideCalled = \(preventAutoHideCalled)")
    
    // If user didn't call preventAutoHideAsync, auto-hide
    if !preventAutoHideCalled {
      print("[SplashScreen2Module] Auto-hiding splash screen because preventAutoHideAsync was not called")
      
      DispatchQueue.main.async {
        NotificationCenter.default.post(
          name: NSNotification.Name("SplashHtmlHide"),
          object: nil,
          userInfo: ["force": true]
        )
      }
    }
  }
}
