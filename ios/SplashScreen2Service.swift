import UIKit
import WebKit

// 协议定义，用于替代 AppDelegate 类型
@objc public protocol AppDelegateProtocol {
  @objc func startReactNativeIfNeeded()
}

// 类似 EXSplashScreenService，管理 splash screen 的显示和隐藏
public class SplashScreen2Service: NSObject {
  private var splashScreenControllers: [UIViewController: SplashScreen2ViewControllerWrapper] = [:]
  private weak var observingRootViewController: UIViewController?
  // 全局的 preventAutoHide 状态，用于在新创建的 splash screen 上应用
  private var globalPreventAutoHide: Bool = false
  private static let sharedInstance = SplashScreen2Service()
  
  public static var shared: SplashScreen2Service {
    return sharedInstance
  }
  
  private override init() {
    super.init()
  }
  
  // 显示 splash screen（类似 EXSplashScreenService.showSplashScreenFor）
  public func showSplashScreenFor(_ viewController: UIViewController) {
    print("[SplashScreen2Service] showSplashScreenFor called for viewController: \(viewController)")
    print("[SplashScreen2Service] showSplashScreenFor - globalPreventAutoHide: \(globalPreventAutoHide)")
    
    // 如果已经存在，先清理旧的
    // 注意：这里使用 force=true 是因为我们要替换旧的 splash screen
    // 但如果 globalPreventAutoHide=true，我们应该保留旧的，而不是清理它
    if let existingController = splashScreenControllers[viewController] {
      if globalPreventAutoHide {
        print("[SplashScreen2Service] showSplashScreenFor - globalPreventAutoHide is true, keeping existing splash screen")
        // 如果 preventAutoHide 已经设置，不需要重新创建
        // 确保 splash screen 在最上层且可见
        if let splashVC = existingController.splashViewControllerInstance {
          splashVC.view.isHidden = false
          splashVC.view.alpha = 1.0
          viewController.view.bringSubviewToFront(splashVC.view)
          print("[SplashScreen2Service] showSplashScreenFor - Brought existing splash screen to front and ensured visibility")
        }
        return
      } else {
        print("[SplashScreen2Service] Splash screen already exists for view controller, cleaning up old one")
        existingController.hide(force: true)
        splashScreenControllers.removeValue(forKey: viewController)
      }
    }
    
    // 创建 SplashScreen2ViewController 实例
    let splashVC = SplashScreen2ViewController()
    let splashScreenController = SplashScreen2ViewControllerWrapper(splashViewController: splashVC)
    
    // 如果全局 preventAutoHide 状态为 true，立即应用
    if globalPreventAutoHide {
      print("[SplashScreen2Service] showSplashScreenFor - Applying global preventAutoHide state")
      splashScreenController.preventAutoHide()
      // 确保 splash screen 可见（在添加到父视图之前设置）
      splashVC.view.isHidden = false
      splashVC.view.alpha = 1.0
    }
    
    // 先设置 view 的 frame，确保有正确的尺寸
    // 这必须在添加到父视图之前完成
    splashVC.view.frame = viewController.view.bounds
    
    // 打印尺寸信息用于调试
    print("[SplashScreen2Service] showSplashScreenFor - viewController.view.frame: \(viewController.view.frame)")
    print("[SplashScreen2Service] showSplashScreenFor - viewController.view.bounds: \(viewController.view.bounds)")
    print("[SplashScreen2Service] showSplashScreenFor - UIScreen.main.bounds: \(UIScreen.main.bounds)")
    print("[SplashScreen2Service] showSplashScreenFor - splashVC.view.frame (before addSubview): \(splashVC.view.frame)")
    
    // 将 SplashScreen2ViewController 添加为子 view controller（保持生命周期）
    // 这必须在 addSubview 之前调用，以确保 viewDidLoad 在正确的时机被调用
    viewController.addChild(splashVC)
    
    // 将 SplashScreen2ViewController 的 view 添加到目标 view controller 的 view 上
    viewController.view.addSubview(splashVC.view)
    splashVC.view.translatesAutoresizingMaskIntoConstraints = false
    
    // 设置约束，确保全屏显示
    NSLayoutConstraint.activate([
      splashVC.view.topAnchor.constraint(equalTo: viewController.view.topAnchor),
      splashVC.view.leadingAnchor.constraint(equalTo: viewController.view.leadingAnchor),
      splashVC.view.trailingAnchor.constraint(equalTo: viewController.view.trailingAnchor),
      splashVC.view.bottomAnchor.constraint(equalTo: viewController.view.bottomAnchor)
    ])
    
    // 确保在最上层
    viewController.view.bringSubviewToFront(splashVC.view)
    
    // 完成子 view controller 的添加
    splashVC.didMove(toParent: viewController)
    
    // 强制布局更新，确保约束生效
    viewController.view.setNeedsLayout()
    viewController.view.layoutIfNeeded()
    splashVC.view.setNeedsLayout()
    splashVC.view.layoutIfNeeded()
    
    // Print size after constraints
    print("[SplashScreen2Service] showSplashScreenFor - After constraints, splashVC.view.frame: \(splashVC.view.frame)")
    print("[SplashScreen2Service] showSplashScreenFor - After constraints, splashVC.view.bounds: \(splashVC.view.bounds)")
    print("[SplashScreen2Service] showSplashScreenFor - splashVC.view.superview: \(String(describing: splashVC.view.superview))")
    print("[SplashScreen2Service] showSplashScreenFor - splashVC.view.window: \(String(describing: splashVC.view.window))")
    
    // Ensure WebView is properly mounted
    // Delay a bit to ensure viewDidLoad and setupWebView have completed
    DispatchQueue.main.async {
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.frame: \(splashVC.view.frame)")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.subviews.count: \(splashVC.view.subviews.count)")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.isHidden: \(splashVC.view.isHidden)")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.alpha: \(splashVC.view.alpha)")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.superview: \(String(describing: splashVC.view.superview))")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.window: \(String(describing: splashVC.view.window))")
      
      // Check if other views are blocking
      if let superview = splashVC.view.superview {
        print("[SplashScreen2Service] showSplashScreenFor - superview.subviews.count: \(superview.subviews.count)")
        for (index, subview) in superview.subviews.enumerated() {
          print("[SplashScreen2Service] showSplashScreenFor - superview.subview[\(index)]: \(type(of: subview)), frame: \(subview.frame), isHidden: \(subview.isHidden), alpha: \(subview.alpha)")
        }
      }
      
      for (index, subview) in splashVC.view.subviews.enumerated() {
        print("[SplashScreen2Service] showSplashScreenFor - subview[\(index)]: \(type(of: subview)), frame: \(subview.frame), isHidden: \(subview.isHidden), alpha: \(subview.alpha)")
        
        // Ensure WebView is visible
        if let webView = subview as? WKWebView {
          webView.isHidden = false
          webView.alpha = 1.0
          print("[SplashScreen2Service] showSplashScreenFor - WebView visibility set: isHidden=\(webView.isHidden), alpha=\(webView.alpha)")
        }
      }
      
      // Ensure view is on top layer
      if let superview = splashVC.view.superview {
        superview.bringSubviewToFront(splashVC.view)
        print("[SplashScreen2Service] showSplashScreenFor - Brought splashVC.view to front")
      }
    }
    
    splashScreenControllers[viewController] = splashScreenController
    splashScreenController.show()
  }
  
  // Hide splash screen (similar to EXSplashScreenService.hideSplashScreenFor)
  public func hideSplashScreenFor(_ viewController: UIViewController, force: Bool = false) {
    print("[SplashScreen2Service] hideSplashScreenFor called for viewController: \(viewController), force: \(force)")
    print("[SplashScreen2Service] hideSplashScreenFor - globalPreventAutoHide: \(globalPreventAutoHide)")
    
    guard let controller = splashScreenControllers[viewController] else {
      print("[SplashScreen2Service] No splash screen found for view controller")
      return
    }
    
    // If globalPreventAutoHide is true and force is false, don't execute hide operation
    if globalPreventAutoHide && !force {
      print("[SplashScreen2Service] hideSplashScreenFor - globalPreventAutoHide is true and force is false, ignoring hide call")
      print("[SplashScreen2Service] hideSplashScreenFor - Stack trace: \(Thread.callStackSymbols.prefix(5).joined(separator: "\n"))")
      // Ensure splash screen is still visible and on top
      if let splashVC = controller.splashViewControllerInstance {
        splashVC.view.isHidden = false
        splashVC.view.alpha = 1.0
        if let parent = splashVC.parent {
          parent.view.bringSubviewToFront(splashVC.view)
        } else if let superview = splashVC.view.superview {
          superview.bringSubviewToFront(splashVC.view)
        }
        print("[SplashScreen2Service] hideSplashScreenFor - Ensured splash screen is still visible and on top")
      }
      return
    }
    
    print("[SplashScreen2Service] hideSplashScreenFor - Proceeding with hide, force: \(force)")
    // Use force=true to force hide, even if preventAutoHide was called
    controller.hide(force: force)
    splashScreenControllers.removeValue(forKey: viewController)
  }
  
  // Hide all splash screens (for forcing hide of all known splash screens)
  public func hideAllSplashScreens(force: Bool = true) {
    print("[SplashScreen2Service] hideAllSplashScreens called, force: \(force)")
    print("[SplashScreen2Service] hideAllSplashScreens - splashScreenControllers count: \(splashScreenControllers.count)")
    
    // Copy dictionary keys because we'll modify the dictionary during iteration
    let allViewControllers = Array(splashScreenControllers.keys)
    
    for viewController in allViewControllers {
      print("[SplashScreen2Service] hideAllSplashScreens - Hiding splash screen for: \(viewController)")
      hideSplashScreenFor(viewController, force: force)
    }
    
    print("[SplashScreen2Service] hideAllSplashScreens - Completed, remaining count: \(splashScreenControllers.count)")
  }
  
  // Prevent auto-hide (similar to EXSplashScreenService.preventSplashScreenAutoHideFor)
  public func preventAutoHideFor(_ viewController: UIViewController) {
    print("[SplashScreen2Service] preventAutoHideFor called for viewController: \(viewController)")
    print("[SplashScreen2Service] preventAutoHideFor - Stack trace: \(Thread.callStackSymbols.prefix(5).joined(separator: "\n"))")
    
    // Set global preventAutoHide state (must be set at the very beginning)
    globalPreventAutoHide = true
    print("[SplashScreen2Service] preventAutoHideFor - Set globalPreventAutoHide to true")
    
    // If no splash screen yet, create one first
    if splashScreenControllers[viewController] == nil {
      print("[SplashScreen2Service] preventAutoHideFor - No splash screen found, creating one first")
      showSplashScreenFor(viewController)
    }
    
    // Apply preventAutoHide to all existing splash screens
    for (vc, controller) in splashScreenControllers {
      print("[SplashScreen2Service] preventAutoHideFor - Applying preventAutoHide to existing splash screen for viewController: \(vc)")
      controller.preventAutoHide()
      // Ensure splash screen is visible and on top
      if let splashVC = controller.splashViewControllerInstance {
        splashVC.view.isHidden = false
        splashVC.view.alpha = 1.0
        if let parent = splashVC.parent {
          parent.view.bringSubviewToFront(splashVC.view)
        } else if let superview = splashVC.view.superview {
          superview.bringSubviewToFront(splashVC.view)
        }
        print("[SplashScreen2Service] preventAutoHideFor - Ensured splash screen is visible and on top for viewController: \(vc)")
      }
    }
    
    guard let controller = splashScreenControllers[viewController] else {
      print("[SplashScreen2Service] preventAutoHideFor - Failed to create or find splash screen")
      return
    }
    
    print("[SplashScreen2Service] preventAutoHideFor - Calling preventAutoHide on controller")
    controller.preventAutoHide()
    
    // Ensure splash screen is visible and on top
    if let splashVC = controller.splashViewControllerInstance {
      splashVC.view.isHidden = false
      splashVC.view.alpha = 1.0
      if let parent = splashVC.parent {
        parent.view.bringSubviewToFront(splashVC.view)
      } else if let superview = splashVC.view.superview {
        superview.bringSubviewToFront(splashVC.view)
      }
      print("[SplashScreen2Service] preventAutoHideFor - Ensured splash screen is visible and on top")
    }
    
    print("[SplashScreen2Service] preventAutoHideFor - preventAutoHide called successfully")
  }
  
  // Add rootViewController listener (similar to EXSplashScreenService.addRootViewControllerListener)
  public func addRootViewControllerListener() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in
        self?.addRootViewControllerListener()
      }
      return
    }
    
    // If listener already exists, remove old one first
    if observingRootViewController != nil {
      print("[SplashScreen2Service] addRootViewControllerListener: Already observing, removing old listener first")
      removeRootViewControllerListener()
    }
    
    if let window = UIApplication.shared.keyWindow {
      window.addObserver(self, forKeyPath: "rootViewController", options: .new, context: nil)
      
      // If rootViewController already exists, show splash screen immediately
      if let rootViewController = window.rootViewController {
        print("[SplashScreen2Service] addRootViewControllerListener: Found existing rootViewController: \(rootViewController)")
        print("[SplashScreen2Service] addRootViewControllerListener - globalPreventAutoHide: \(globalPreventAutoHide)")
        
        // Only add listener if rootViewController is not the currently observed object
        if rootViewController != observingRootViewController {
          rootViewController.addObserver(self, forKeyPath: "view", options: .new, context: nil)
          observingRootViewController = rootViewController
          
          // Show splash screen immediately (only if not already shown)
          // If globalPreventAutoHide is true and splash screen already exists, no need to recreate
          if splashScreenControllers[rootViewController] == nil {
            if globalPreventAutoHide {
              print("[SplashScreen2Service] addRootViewControllerListener - globalPreventAutoHide is true but no splash screen found, this should not happen")
            }
            showSplashScreenFor(rootViewController)
          } else {
            print("[SplashScreen2Service] addRootViewControllerListener: Splash screen already exists for rootViewController, skipping")
            // If globalPreventAutoHide is true, ensure splash screen is on top
            if globalPreventAutoHide, let controller = splashScreenControllers[rootViewController] {
              print("[SplashScreen2Service] addRootViewControllerListener - Ensuring splash screen is on top")
              if let splashVC = controller.splashViewControllerInstance {
                rootViewController.view.bringSubviewToFront(splashVC.view)
              }
            }
          }
        }
      } else {
        // 如果没有 rootViewController，创建一个临时的 view controller 来显示 splash screen
        // 这确保在 RN 启动之前就能看到 splash screen
        print("[SplashScreen2Service] addRootViewControllerListener: No rootViewController, creating temp one")
        let tempViewController = UIViewController()
        tempViewController.view.backgroundColor = .clear
        window.rootViewController = tempViewController
        window.makeKeyAndVisible()
        
        tempViewController.addObserver(self, forKeyPath: "view", options: .new, context: nil)
        observingRootViewController = tempViewController
        
        // 立即显示 splash screen
        showSplashScreenFor(tempViewController)
      }
    } else {
      print("[SplashScreen2Service] addRootViewControllerListener: No keyWindow found")
    }
  }
  
  // 移除 rootViewController 监听（类似 EXSplashScreenService.removeRootViewControllerListener）
  public func removeRootViewControllerListener() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in
        self?.removeRootViewControllerListener()
      }
      return
    }
    
    if let rootViewController = observingRootViewController {
      if let window = rootViewController.view.window {
        window.removeObserver(self, forKeyPath: "rootViewController")
      }
      rootViewController.removeObserver(self, forKeyPath: "view")
      observingRootViewController = nil
    }
  }
  
  // KVO 监听（类似 EXSplashScreenService.observeValueForKeyPath）
  public override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
    if let window = object as? UIWindow, keyPath == "rootViewController" {
      if let newRootViewController = change?[.newKey] as? UIViewController,
         newRootViewController != observingRootViewController {
        print("[SplashScreen2Service] rootViewController changed from \(String(describing: observingRootViewController)) to \(newRootViewController)")
        print("[SplashScreen2Service] rootViewController changed - globalPreventAutoHide: \(globalPreventAutoHide)")
        
        // 尝试复用已有的 splash screen（无论是否调用 preventAutoHide）
        if let oldRootViewController = observingRootViewController,
           let oldController = splashScreenControllers[oldRootViewController],
           let splashVC = oldController.splashViewControllerInstance {
          print("[SplashScreen2Service] rootViewController changed - Reusing existing splash screen instance")
          
          // 更新字典中的引用
          splashScreenControllers.removeValue(forKey: oldRootViewController)
          splashScreenControllers[newRootViewController] = oldController
          
          // 从旧的父控制器分离
          splashVC.view.removeFromSuperview()
          splashVC.willMove(toParent: nil)
          if let oldParent = splashVC.parent {
            splashVC.removeFromParent()
          }
          
          // 添加到新的 rootViewController
          newRootViewController.addChild(splashVC)
          newRootViewController.view.addSubview(splashVC.view)
          splashVC.view.translatesAutoresizingMaskIntoConstraints = false
          NSLayoutConstraint.activate([
            splashVC.view.topAnchor.constraint(equalTo: newRootViewController.view.topAnchor),
            splashVC.view.leadingAnchor.constraint(equalTo: newRootViewController.view.leadingAnchor),
            splashVC.view.trailingAnchor.constraint(equalTo: newRootViewController.view.trailingAnchor),
            splashVC.view.bottomAnchor.constraint(equalTo: newRootViewController.view.bottomAnchor)
          ])
          newRootViewController.view.bringSubviewToFront(splashVC.view)
          splashVC.didMove(toParent: newRootViewController)
          splashVC.view.isHidden = false
          splashVC.view.alpha = 1.0
          
          // 迁移完成后，确保隐私弹框被隐藏（如果用户已同意）
          splashVC.ensurePrivacyDialogHidden()
          
          print("[SplashScreen2Service] rootViewController changed - Splash screen reused successfully")
        } else if let oldRootViewController = observingRootViewController,
                  splashScreenControllers[oldRootViewController] == nil {
          // 旧 rootViewController 没有记录，说明之前没有成功创建 splash screen
          print("[SplashScreen2Service] rootViewController changed - No existing splash screen to reuse, creating new one")
          showSplashScreenFor(newRootViewController)
        }
        
        // 先移除旧的监听器
        removeRootViewControllerListener()
        
        // 重新添加监听器（这会设置新的 observingRootViewController 并显示 splash screen）
        // 注意：addRootViewControllerListener() 内部会调用 showSplashScreenFor，所以不需要在这里单独调用
        // 但如果 globalPreventAutoHide 为 true，且已经迁移了 splash screen，不需要重新添加监听器
        if !globalPreventAutoHide || splashScreenControllers[newRootViewController] == nil {
          addRootViewControllerListener()
        } else {
          print("[SplashScreen2Service] rootViewController changed - globalPreventAutoHide is true and splash screen already migrated, skipping addRootViewControllerListener")
          // 仍然需要更新 observingRootViewController 和添加监听器
          if let window = UIApplication.shared.keyWindow {
            window.addObserver(self, forKeyPath: "rootViewController", options: .new, context: nil)
            newRootViewController.addObserver(self, forKeyPath: "view", options: .new, context: nil)
            observingRootViewController = newRootViewController
            // 确保 splash screen 在最上层且可见
            if let controller = splashScreenControllers[newRootViewController],
               let splashVC = controller.splashViewControllerInstance {
              splashVC.view.isHidden = false
              splashVC.view.alpha = 1.0
              newRootViewController.view.bringSubviewToFront(splashVC.view)
              print("[SplashScreen2Service] rootViewController changed - Brought migrated splash screen to front and ensured visibility")
            }
          }
        }
      }
    } else if let rootViewController = object as? UIViewController, keyPath == "view" {
      if let newView = change?[.newKey] as? UIView,
         let viewController = newView.next as? UIViewController {
        print("[SplashScreen2Service] view changed for viewController: \(viewController)")
        print("[SplashScreen2Service] view changed - globalPreventAutoHide: \(globalPreventAutoHide)")
        
        // 如果 globalPreventAutoHide 为 true，确保现有的 splash screen 保持显示
        if globalPreventAutoHide {
          if let controller = splashScreenControllers[viewController] {
            print("[SplashScreen2Service] view changed - globalPreventAutoHide is true, ensuring splash screen is visible")
            if let splashVC = controller.splashViewControllerInstance {
              splashVC.view.isHidden = false
              splashVC.view.alpha = 1.0
              viewController.view.bringSubviewToFront(splashVC.view)
            }
            return
          } else {
            // 如果 globalPreventAutoHide 为 true 但没有 splash screen，创建一个
            print("[SplashScreen2Service] view changed - globalPreventAutoHide is true but no splash screen, creating one")
            showSplashScreenFor(viewController)
            return
          }
        }
        
        // 只有当 view 真正加载完成时才重新显示 splash screen
        // 避免在 view 创建过程中重复调用
        if viewController.view.superview != nil && splashScreenControllers[viewController] == nil {
          print("[SplashScreen2Service] View loaded, showing splash screen")
          showSplashScreenFor(viewController)
        } else if splashScreenControllers[viewController] != nil {
          print("[SplashScreen2Service] Splash screen already exists for this view controller, skipping")
        }
      }
    }
  }
}

// 类似 EXSplashScreenViewController，管理单个 splash screen 的显示和隐藏
public class SplashScreen2ViewControllerWrapper {
  private weak var splashViewController: SplashScreen2ViewController?
  private var autoHideEnabled: Bool = true
  private var splashScreenShown: Bool = false
  private var appContentAppeared: Bool = false
  
  // 添加一个属性来访问 splashViewController，用于迁移
  var splashViewControllerInstance: SplashScreen2ViewController? {
    return splashViewController
  }
  
  init(splashViewController: SplashScreen2ViewController) {
    self.splashViewController = splashViewController
  }
  
  func show() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in
        self?.show()
      }
      return
    }
    
    guard let splashVC = splashViewController else { return }
    
    print("[SplashScreen2ViewController] show() called")
    print("[SplashScreen2ViewController] show() - splashVC.view.isHidden: \(splashVC.view.isHidden)")
    print("[SplashScreen2ViewController] show() - splashVC.view.alpha: \(splashVC.view.alpha)")
    print("[SplashScreen2ViewController] show() - splashVC.view.superview: \(String(describing: splashVC.view.superview))")
    print("[SplashScreen2ViewController] show() - splashVC.view.window: \(String(describing: splashVC.view.window))")
    
    // 确保 view 可见
    splashVC.view.isHidden = false
    splashVC.view.alpha = 1.0
    
    // 确保 WebView 也可见
    for subview in splashVC.view.subviews {
      if let webView = subview as? WKWebView {
        webView.isHidden = false
        webView.alpha = 1.0
        print("[SplashScreen2ViewController] show() - WebView visibility set: isHidden=\(webView.isHidden), alpha=\(webView.alpha)")
      }
    }
    
    // 确保在最上层
    if let parent = splashVC.parent {
      parent.view.bringSubviewToFront(splashVC.view)
      print("[SplashScreen2ViewController] show() - Brought splashVC.view to front in parent")
    } else if let superview = splashVC.view.superview {
      superview.bringSubviewToFront(splashVC.view)
      print("[SplashScreen2ViewController] show() - Brought splashVC.view to front in superview")
    }
    
    // 强制布局更新
    splashVC.view.setNeedsLayout()
    splashVC.view.layoutIfNeeded()
    
    print("[SplashScreen2ViewController] show() - After show, splashVC.view.isHidden: \(splashVC.view.isHidden)")
    print("[SplashScreen2ViewController] show() - After show, splashVC.view.alpha: \(splashVC.view.alpha)")
    print("[SplashScreen2ViewController] show() - After show, splashVC.view.subviews.count: \(splashVC.view.subviews.count)")
    
    splashScreenShown = true
  }
  
  func hide(force: Bool = false) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in
        self?.hide(force: force)
      }
      return
    }
    
    print("[SplashScreen2ViewController] hide called, force: \(force), autoHideEnabled: \(autoHideEnabled)")
    print("[SplashScreen2ViewController] hide - Stack trace: \(Thread.callStackSymbols.prefix(5).joined(separator: "\n"))")
    
    // 如果 preventAutoHide 被调用，且不是强制隐藏，则不执行隐藏操作
    if !force && !autoHideEnabled {
      print("[SplashScreen2ViewController] Auto hide is prevented, ignoring hide call (use force=true to override)")
      // 确保 splash screen 仍然可见
      if let splashVC = splashViewController {
        splashVC.view.isHidden = false
        splashVC.view.alpha = 1.0
        if let parent = splashVC.parent {
          parent.view.bringSubviewToFront(splashVC.view)
        } else if let superview = splashVC.view.superview {
          superview.bringSubviewToFront(splashVC.view)
        }
      }
      return
    }
    
    guard let splashVC = splashViewController else {
      print("[SplashScreen2ViewController] hide - splashViewController is nil")
      return
    }
    
    print("[SplashScreen2ViewController] hide - Starting fade out animation")
    
    // 使用渐隐动画（300ms）隐藏开屏页
    UIView.animate(withDuration: 0.3, animations: {
      splashVC.view.alpha = 0.0
    }) { _ in
      print("[SplashScreen2ViewController] hide - Fade out animation completed, removing from superview")
      splashVC.view.removeFromSuperview()
      splashVC.willMove(toParent: nil)
      if let parent = splashVC.parent {
        splashVC.removeFromParent()
      }
      print("[SplashScreen2ViewController] hide - Splash screen removed")
    }
    
    splashScreenShown = false
    // 注意：只有在强制隐藏时才重置 autoHideEnabled
    // 如果 preventAutoHide 被调用，autoHideEnabled 应该保持为 false
    if force {
      autoHideEnabled = true
    }
  }
  
  func preventAutoHide() {
    print("[SplashScreen2ViewController] preventAutoHide called, autoHideEnabled: \(autoHideEnabled)")
    guard autoHideEnabled else {
      print("[SplashScreen2ViewController] preventAutoHide - Already prevented, skipping")
      return
    }
    autoHideEnabled = false
    print("[SplashScreen2ViewController] preventAutoHide - Set autoHideEnabled to false")
  }
  
  func needsHideOnAppContentDidAppear() -> Bool {
    if !appContentAppeared && autoHideEnabled {
      appContentAppeared = true
      return true
    }
    return false
  }
  
  func needsShowOnAppContentWillReload() -> Bool {
    if !appContentAppeared {
      // 注意：如果 preventAutoHide 已经被调用，不应该重置 autoHideEnabled
      // 只有在 preventAutoHide 没有被调用时才重置
      if autoHideEnabled {
        autoHideEnabled = true
      }
      appContentAppeared = false
      return true
    }
    return false
  }
}


