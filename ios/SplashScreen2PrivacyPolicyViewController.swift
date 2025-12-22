import UIKit
import WebKit

public class SplashScreen2PrivacyPolicyViewController: UIViewController {
  private var webView: WKWebView?
  public var url: String = ""
  
  public override func viewDidLoad() {
    super.viewDidLoad()
    
    title = "隐私政策"
    
    // 添加关闭按钮
    navigationItem.leftBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .close,
      target: self,
      action: #selector(closeButtonTapped)
    )
    
    // 创建 WebView
    let config = WKWebViewConfiguration()
    config.preferences.javaScriptEnabled = true
    config.allowsInlineMediaPlayback = true
    
    webView = WKWebView(frame: view.bounds, configuration: config)
    webView?.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    webView?.navigationDelegate = self
    
    view.addSubview(webView!)
    
    // 加载 URL
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
  public func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    print("[SplashScreen2PrivacyPolicyViewController] Started loading: \(webView.url?.absoluteString ?? "")")
  }
  
  public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    print("[SplashScreen2PrivacyPolicyViewController] Finished loading: \(webView.url?.absoluteString ?? "")")
  }
  
  public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    print("[SplashScreen2PrivacyPolicyViewController] Failed to load: \(error.localizedDescription)")
  }
}


