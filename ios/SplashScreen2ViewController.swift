import UIKit
import WebKit

// Simplified SplashScreen2ViewController, only for WebView to display HTML
// Reference expo-splash-screen architecture, but use WebView to display HTML
public class SplashScreen2ViewController: UIViewController {
  private var webView: WKWebView?
  private var webViewContainer: UIView?
  private let userDefaults = UserDefaults.standard
  
  public static weak var appDelegate: AppDelegateProtocol?
  
  public override func viewDidLoad() {
    super.viewDidLoad()
    
    print("[SplashScreen2ViewController] viewDidLoad called")
    print("[SplashScreen2ViewController] viewDidLoad - view.frame: \(view.frame)")
    print("[SplashScreen2ViewController] viewDidLoad - view.bounds: \(view.bounds)")
    print("[SplashScreen2ViewController] viewDidLoad - view.superview: \(String(describing: view.superview))")
    print("[SplashScreen2ViewController] viewDidLoad - view.window: \(String(describing: view.window))")
    
    // Set view's background color to the passed backgroundColor
    // Convert hexadecimal color to UIColor
    let hexColor = "#10021F".uppercased().replacingOccurrences(of: "#", with: "")
    if hexColor.count == 6 {
      let r = CGFloat(Int(hexColor.prefix(2), radix: 16) ?? 0) / 255.0
      let g = CGFloat(Int(String(hexColor.dropFirst(2).prefix(2)), radix: 16) ?? 0) / 255.0
      let b = CGFloat(Int(hexColor.suffix(2), radix: 16) ?? 0) / 255.0
      view.backgroundColor = UIColor(red: r, green: g, blue: b, alpha: 1.0)
    } else {
      view.backgroundColor = .clear
    }
    
    // Ensure full screen display
    edgesForExtendedLayout = .all
    
    // If view already has superview, ensure frame is correct
    if let superview = view.superview {
      view.frame = superview.bounds
      print("[SplashScreen2ViewController] viewDidLoad - Updated view.frame to superview.bounds: \(view.frame)")
    } else {
      // If no superview, use screen size
      view.frame = UIScreen.main.bounds
      print("[SplashScreen2ViewController] viewDidLoad - Set view.frame to UIScreen.main.bounds: \(view.frame)")
    }
    
    // Register notification observers
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handlePreventAutoHide),
      name: NSNotification.Name("SplashHtmlPreventAutoHide"),
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleHide),
      name: NSNotification.Name("SplashHtmlHide"),
      object: nil
    )
    
    setupWebView()
  }
  
  deinit {
    // Remove notification observers
    NotificationCenter.default.removeObserver(self)
  }
  
  @objc private func handlePreventAutoHide() {
    print("[SplashScreen2ViewController] handlePreventAutoHide called")
    // Prevent auto-hide through SplashScreen2Service
    // Need to pass parent view controller (usually rootViewController)
    if let parentVC = parent {
      SplashScreen2Service.shared.preventAutoHideFor(parentVC)
    } else if let rootVC = view.window?.rootViewController {
      SplashScreen2Service.shared.preventAutoHideFor(rootVC)
    } else {
      print("[SplashScreen2ViewController] handlePreventAutoHide - No parent or rootViewController found")
    }
  }
  
  @objc private func handleHide() {
    print("[SplashScreen2ViewController] handleHide called")
    // Hide splash screen through SplashScreen2Service
    // Need to pass parent view controller (usually rootViewController)
    if let parentVC = parent {
      SplashScreen2Service.shared.hideSplashScreenFor(parentVC, force: true)
    } else if let rootVC = view.window?.rootViewController {
      SplashScreen2Service.shared.hideSplashScreenFor(rootVC, force: true)
    } else {
      print("[SplashScreen2ViewController] handleHide - No parent or rootViewController found")
    }
  }
  
  public override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    
    // Force set view's frame to full screen
    if let window = view.window {
      view.frame = window.bounds
    } else {
      view.frame = UIScreen.main.bounds
    }
    
    print("[SplashScreen2ViewController] viewWillAppear - view.frame: \(view.frame)")
    print("[SplashScreen2ViewController] viewWillAppear - view.bounds: \(view.bounds)")
    print("[SplashScreen2ViewController] viewWillAppear - UIScreen.main.bounds: \(UIScreen.main.bounds)")
  }
  
  public override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    
    // Force set view's frame to full screen
    if let window = view.window {
      view.frame = window.bounds
    } else {
      view.frame = UIScreen.main.bounds
    }
    
    // Ensure webView is also full screen
    if let webView = webView {
      webView.frame = view.bounds
      print("[SplashScreen2ViewController] viewDidLayoutSubviews - webView.frame: \(webView.frame)")
      print("[SplashScreen2ViewController] viewDidLayoutSubviews - webView.bounds: \(webView.bounds)")
    }
  }
  
  private func setupWebView() {
    let config = WKWebViewConfiguration()
    config.preferences.javaScriptEnabled = true
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    
    // Add JavaScript interface
    let contentController = WKUserContentController()
    contentController.add(self, name: "agreePrivacyPolicy")
    contentController.add(self, name: "disagreePrivacyPolicy")
    contentController.add(self, name: "openPrivacyPolicy")
    config.userContentController = contentController
    
    webView = WKWebView(frame: view.bounds, configuration: config)
    // Set transparent background
    webView?.backgroundColor = .clear
    webView?.isOpaque = false
    webView?.scrollView.backgroundColor = .clear
    webView?.scrollView.showsVerticalScrollIndicator = false
    webView?.scrollView.showsHorizontalScrollIndicator = false
    webView?.scrollView.bounces = false
    webView?.scrollView.isScrollEnabled = false
    webView?.allowsLinkPreview = false
    webView?.allowsBackForwardNavigationGestures = false
    
    if #available(iOS 11.0, *) {
      webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }
    
    guard let webView = webView else { return }
    
    // Ensure view's frame is correct
    if view.frame == .zero {
      if let superview = view.superview {
        view.frame = superview.bounds
      } else {
        view.frame = UIScreen.main.bounds
      }
      print("[SplashScreen2ViewController] setupWebView - view.frame was zero, updated to: \(view.frame)")
    }
    
    // Ensure webView's frame is correct
    if webView.frame == .zero {
      webView.frame = view.bounds
      print("[SplashScreen2ViewController] setupWebView - webView.frame was zero, updated to: \(webView.frame)")
    }
    
    // Add WebView to view
    view.addSubview(webView)
    print("[SplashScreen2ViewController] setupWebView - WebView added to view, view.subviews.count: \(view.subviews.count)")
    
    webView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      webView.topAnchor.constraint(equalTo: view.topAnchor),
      webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
    
    // Force layout update
    view.setNeedsLayout()
    view.layoutIfNeeded()
    webView.setNeedsLayout()
    webView.layoutIfNeeded()
    
    // Print size information for debugging
    print("[SplashScreen2ViewController] setupWebView - view.frame: \(view.frame)")
    print("[SplashScreen2ViewController] setupWebView - view.bounds: \(view.bounds)")
    print("[SplashScreen2ViewController] setupWebView - view.superview: \(String(describing: view.superview))")
    print("[SplashScreen2ViewController] setupWebView - view.window: \(String(describing: view.window))")
    print("[SplashScreen2ViewController] setupWebView - view.isHidden: \(view.isHidden)")
    print("[SplashScreen2ViewController] setupWebView - view.alpha: \(view.alpha)")
    print("[SplashScreen2ViewController] setupWebView - webView.frame: \(webView.frame)")
    print("[SplashScreen2ViewController] setupWebView - webView.bounds: \(webView.bounds)")
    print("[SplashScreen2ViewController] setupWebView - webView.superview: \(String(describing: webView.superview))")
    print("[SplashScreen2ViewController] setupWebView - webView.isHidden: \(webView.isHidden)")
    print("[SplashScreen2ViewController] setupWebView - webView.alpha: \(webView.alpha)")
    print("[SplashScreen2ViewController] setupWebView - webView.isOpaque: \(webView.isOpaque)")
    print("[SplashScreen2ViewController] setupWebView - webView.backgroundColor: \(String(describing: webView.backgroundColor))")
    print("[SplashScreen2ViewController] setupWebView - UIScreen.main.bounds: \(UIScreen.main.bounds)")
    
    // Ensure WebView is visible
    webView.isHidden = false
    webView.alpha = 1.0
    view.isHidden = false
    view.alpha = 1.0
    
    print("[SplashScreen2ViewController] setupWebView - After setting visibility, webView.isHidden: \(webView.isHidden), webView.alpha: \(webView.alpha)")
    
    webView.navigationDelegate = self
    
    // Load HTML file (plugin will copy bundled index.html from expo-splash-web to iOS bundle)
    if let htmlPath = Bundle.main.path(forResource: "index", ofType: "html") {
      if let htmlString = try? String(contentsOfFile: htmlPath, encoding: .utf8) {
        let baseURL = URL(fileURLWithPath: htmlPath).deletingLastPathComponent()
        webView.loadHTMLString(htmlString, baseURL: baseURL)
        print("[SplashScreen2ViewController] Loaded HTML from: \(htmlPath)")
      } else {
        print("[SplashScreen2ViewController] Failed to read HTML file content from: \(htmlPath)")
      }
    } else {
      print("[SplashScreen2ViewController] HTML file not found in bundle (index.html)")
    }
  }
  
  private func handleAgreePrivacyPolicy() {
    userDefaults.set(true, forKey: "isAuth")
    userDefaults.synchronize()
    
    let hideDialogJS = """
      (function() {
        try {
          if (typeof closePrivacyDialog === 'function') {
            closePrivacyDialog();
          }
          if (typeof hidePrivacyDialog === 'function') {
            hidePrivacyDialog();
          }
          return true;
        } catch (e) {
          return false;
        }
      })();
    """
    
    let startReactNative: () -> Void = {
      DispatchQueue.main.async {
        if let appDelegate = SplashScreen2ViewController.appDelegate {
          appDelegate.startReactNativeIfNeeded()
        }
      }
    }
    
    // First try to hide dialog via JS, wait for result before starting RN
    webView?.evaluateJavaScript(hideDialogJS) { _, error in
      if let error = error {
        print("[SplashScreen2ViewController] hide dialog JS error: \(error)")
      }
      startReactNative()
    } ?? startReactNative()
  }
  
  // Public method: Ensure privacy dialog is hidden (for re-injecting state after migration)
  public func ensurePrivacyDialogHidden() {
    let isAuth = userDefaults.bool(forKey: "isAuth")
    guard isAuth else {
      print("[SplashScreen2ViewController] ensurePrivacyDialogHidden - isAuth is false, skipping")
      return
    }
    
    let hideDialogJS = """
      (function() {
        try {
          // Re-inject isAuth state
          window.isAuth = true;
          if (window.iOS) {
            window.iOS.getIsAuth = function() {
              return true;
            };
          }
          
          // Ensure dialog is hidden
          if (typeof closePrivacyDialog === 'function') {
            closePrivacyDialog();
          }
          if (typeof hidePrivacyDialog === 'function') {
            hidePrivacyDialog();
          }
          
          // Force set dialog state to hidden (if there's a state variable in HTML)
          if (typeof setShowModal === 'function') {
            setShowModal(false);
          }
          
          return true;
        } catch (e) {
          console.error('Error hiding privacy dialog:', e);
          return false;
        }
      })();
    """
    
    webView?.evaluateJavaScript(hideDialogJS) { result, error in
      if let error = error {
        print("[SplashScreen2ViewController] ensurePrivacyDialogHidden JS error: \(error)")
      } else {
        print("[SplashScreen2ViewController] ensurePrivacyDialogHidden - Privacy dialog hidden successfully")
      }
    }
  }
  
  private func handleDisagreePrivacyPolicy() {
    exit(0)
  }
  
  private func handleOpenPrivacyPolicy(url: String) {
    DispatchQueue.main.async {
      let privacyVC = SplashScreen2PrivacyPolicyViewController()
      privacyVC.url = url
      self.present(privacyVC, animated: true, completion: nil)
    }
  }
}

extension SplashScreen2ViewController: WKNavigationDelegate {
  public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    // Ensure WebView and view are both visible
    webView.isHidden = false
    webView.alpha = 1.0
    view.isHidden = false
    view.alpha = 1.0
    
    // Ensure on top layer
    if let superview = view.superview {
      superview.bringSubviewToFront(view)
    }
    
    // Get isAuth state and inject into HTML
    let isAuth = userDefaults.bool(forKey: "isAuth")
    
    // Inject CSS to ensure content displays full screen, but don't override background color in HTML
    let css = """
    (function() {
      var style = document.createElement('style');
      style.innerHTML = "html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; position: fixed !important; top: 0 !important; left: 0 !important; }";
      document.head.appendChild(style);
    })();
    """
    webView.evaluateJavaScript(css, completionHandler: nil)
    
    // Delay execution to ensure functions in HTML are already defined
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
      guard let self = self else { return }
      
      // First check if privacy-related functions exist in HTML
      let checkPrivacyFunctionsJS = """
        (function() {
          var hasPrivacyFunctions = 
            typeof checkAuthStatus === 'function' ||
            typeof showPrivacyDialog === 'function' ||
            typeof hidePrivacyDialog === 'function' ||
            typeof closePrivacyDialog === 'function' ||
            typeof agreePrivacyPolicy === 'function' ||
            typeof disagreePrivacyPolicy === 'function';
          return hasPrivacyFunctions;
        })();
      """
      
      self.webView?.evaluateJavaScript(checkPrivacyFunctionsJS) { result, error in
        if let error = error {
          print("[SplashScreen2ViewController] Error checking privacy functions: \(error)")
          // If check fails, default to no privacy policy, set isAuth to true
          self.userDefaults.set(true, forKey: "isAuth")
          // Directly start React Native
          SplashScreen2ViewController.appDelegate?.startReactNativeIfNeeded()
          return
        }
        
        let hasPrivacyFunctions = (result as? Bool) ?? false
        print("[SplashScreen2ViewController] HTML has privacy functions: \(hasPrivacyFunctions)")
        
        if !hasPrivacyFunctions {
          // If HTML has no privacy-related code, default isAuth to true
          print("[SplashScreen2ViewController] No privacy functions found, setting isAuth to true")
          
          // Set isAuth to true and save
          self.userDefaults.set(true, forKey: "isAuth")
          
          // Inject isAuth=true into HTML and execute isAuth=true logic
          let jsCode = """
            (function() {
              console.log('No privacy functions found, setting isAuth to true');
              // Inject isAuth state as true
              window.isAuth = true;
              window.iOS = {
                getIsAuth: function() {
                  return true;
                }
              };
              
              // 执行 isAuth=true 的逻辑：隐藏弹框（如果存在）
              if (typeof hidePrivacyDialog === 'function') {
                console.log('Calling hidePrivacyDialog');
                hidePrivacyDialog();
              }
              if (typeof closePrivacyDialog === 'function') {
                console.log('Calling closePrivacyDialog');
                closePrivacyDialog();
              }
            })();
          """
          self.webView?.evaluateJavaScript(jsCode, completionHandler: { result, error in
            if let error = error {
              print("[SplashScreen2ViewController] Error evaluating JavaScript: \(error)")
            }
            // Start React Native (isAuth=true logic)
            print("[SplashScreen2ViewController] Starting React Native with isAuth=true")
            SplashScreen2ViewController.appDelegate?.startReactNativeIfNeeded()
          })
        } else {
          // If privacy-related code exists, handle with original logic
          let jsCode = """
            (function() {
              // Inject isAuth state
              window.isAuth = \(isAuth);
              window.iOS = {
                getIsAuth: function() {
                  return \(isAuth);
                }
              };
              
              // Decide to show/hide dialog based on isAuth state
              if (window.isAuth) {
                // If already agreed, hide dialog
                if (typeof hidePrivacyDialog === 'function') {
                  hidePrivacyDialog();
                }
              } else {
                // If not agreed, show dialog
                if (typeof checkAuthStatus === 'function') {
                  checkAuthStatus();
                } else if (typeof showPrivacyDialog === 'function') {
                  showPrivacyDialog();
                }
              }
            })();
          """
          self.webView?.evaluateJavaScript(jsCode, completionHandler: { result, error in
            if let error = error {
              print("[SplashScreen2ViewController] Error evaluating JavaScript: \(error)")
            } else {
              // After JavaScript execution completes, decide whether to start React Native based on isAuth state
              if isAuth {
                SplashScreen2ViewController.appDelegate?.startReactNativeIfNeeded()
              }
            }
          })
        }
      }
    }
  }
}

extension SplashScreen2ViewController: WKScriptMessageHandler {
  public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    switch message.name {
    case "agreePrivacyPolicy":
      handleAgreePrivacyPolicy()
    case "disagreePrivacyPolicy":
      handleDisagreePrivacyPolicy()
    case "openPrivacyPolicy":
      if let url = message.body as? String {
        handleOpenPrivacyPolicy(url: url)
      }
    default:
      break
    }
  }
}


