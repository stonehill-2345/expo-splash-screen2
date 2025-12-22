/**
 * iOS native code templates
 * Use placeholders {{key}} to replace variables
 * 
 * Note: Due to the large size of iOS template files, some large templates (such as SplashScreen2Service, SplashScreen2ViewController)
 * are still kept in index.ts, but organized through function extraction for easier maintenance
 */

export const IOS_TEMPLATES = {
  /**
   * SplashScreen2Module.swift template
   */
  splashHtmlModule: `import ExpoModulesCore
import UIKit

public class SplashScreen2Module: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoSplashHtml")

    AsyncFunction("preventAutoHideAsync") { (promise: Promise) in
      DispatchQueue.main.async {
        print("[SplashScreen2Module] preventAutoHideAsync called")
        
        // Communicate with SplashScreen2ViewController via notification
        NotificationCenter.default.post(
          name: NSNotification.Name("SplashHtmlPreventAutoHide"),
          object: nil
        )
        
        promise.resolve(true)
      }
    }

    AsyncFunction("hideAsync") { (promise: Promise) in
      DispatchQueue.main.async {
        print("[SplashScreen2Module] hideAsync called")
        
        // Communicate with SplashScreen2ViewController via notification
        NotificationCenter.default.post(
          name: NSNotification.Name("SplashHtmlHide"),
          object: nil
        )
        
        promise.resolve(true)
      }
    }
  }
}
`,

  /**
   * SplashScreen2PrivacyPolicyViewController.swift template
   */
  privacyPolicyViewController: `import UIKit
import WebKit

class SplashScreen2PrivacyPolicyViewController: UIViewController {
  private var webView: WKWebView?
  var url: String = ""
  
  override func viewDidLoad() {
    super.viewDidLoad()
    
    title = "Privacy Policy"
    
    // Add close button
    navigationItem.leftBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .close,
      target: self,
      action: #selector(closeButtonTapped)
    )
    
    // Create WebView
    let config = WKWebViewConfiguration()
    config.preferences.javaScriptEnabled = true
    config.allowsInlineMediaPlayback = true
    
    webView = WKWebView(frame: view.bounds, configuration: config)
    webView?.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    webView?.navigationDelegate = self
    
    view.addSubview(webView!)
    
    // Load URL
    if !url.isEmpty {
      if let urlToLoad = URL(string: url) {
        webView?.load(URLRequest(url: urlToLoad))
      }
    }
  }
  
  @objc private func closeButtonTapped() {
    dismiss(animated: true, completion: nil)
  }
}

extension SplashScreen2PrivacyPolicyViewController: WKNavigationDelegate {
  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    print("[SplashScreen2PrivacyPolicyViewController] Started loading: \\(webView.url?.absoluteString ?? "")")
  }
  
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    print("[SplashScreen2PrivacyPolicyViewController] Finished loading: \\(webView.url?.absoluteString ?? "")")
  }
  
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    print("[SplashScreen2PrivacyPolicyViewController] Failed to load: \\(error.localizedDescription)")
  }
}
`,
};

/**
 * Replace placeholders in template
 */
export function replaceIosTemplatePlaceholders(
  template: string,
  replacements: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

