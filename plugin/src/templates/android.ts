/**
 * Android native code templates
 * Use placeholders {{key}} to replace variables
 */

export const ANDROID_TEMPLATES = {
  /**
   * SplashScreen2Activity.kt template
   */
  customSplashActivity: `package {{packageName}}

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat

class {{activityName}} : AppCompatActivity() {
  private var webView: WebView? = null
  private var webViewContainer: ViewGroup? = null
  private var sharedPreferences: SharedPreferences? = null
  private var loaded = false
  private var keepSplashScreen = true
  private var preventAutoHide = false
  private var containerReused = false // Mark if container has been reused by MainActivity
  
  companion object {
    private var instance: {{activityName}}? = null
    
    fun getInstance(): {{activityName}}? {
      return instance
    }
    
    fun getWebViewContainer(): ViewGroup? {
      val container = instance?.webViewContainer
      if (container != null) {
        // Mark container as reused to avoid destroying it in onDestroy
        instance?.containerReused = true
        Log.d("{{activityName}}", "WebView container marked as reused")
      }
      return container
    }
    
    fun actionStart(context: Context) {
      val intent = Intent(context, {{activityName}}::class.java)
      context.startActivity(intent)
      // Add fade-in animation effect
      if (context is Activity) {
        context.overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
      }
    }
  }
  
  override fun onCreate(savedInstanceState: Bundle?) {
    instance = this
    Log.d("{{activityName}}", "onCreate called, savedInstanceState: $savedInstanceState")
    
    // Reset loaded flag to ensure onCreate executes every time
    loaded = false
    
    super.onCreate(savedInstanceState)
    sharedPreferences = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
    
    // Check if HTML file has privacy-related code
    val hasPrivacyFunctions = checkHtmlForPrivacyFunctions()
    Log.d("{{activityName}}", "HTML has privacy functions: $hasPrivacyFunctions")
    
    if (!hasPrivacyFunctions) {
      // If no privacy code, directly start MainActivity, don't show CustomSplashActivity
      Log.d("{{activityName}}", "No privacy functions found, starting MainActivity directly")
      // Set isAuth to true
      val editor = sharedPreferences?.edit()
      editor?.putBoolean("isAuth", true)
      editor?.apply()
      // Ensure no WebView container is created (return before check to avoid creating container)
      // If container already exists (theoretically shouldn't), clean it up first
      if (webViewContainer != null) {
        Log.d("{{activityName}}", "Cleaning up WebView container before finishing")
        try {
          val parent = webViewContainer?.parent as? ViewGroup
          parent?.removeView(webViewContainer)
          webViewContainer?.removeAllViews()
          webView?.destroy()
          webView = null
          webViewContainer = null
        } catch (e: Exception) {
          Log.e("{{activityName}}", "Error cleaning up WebView container", e)
        }
      }
      // Directly start MainActivity
      startMainActivity()
      // Clear instance reference to avoid MainActivity trying to hide non-existent container
      instance = null
      finish()
      return
    }
    
    // Install Splash Screen on Android 12+ and extend display time
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val splashScreen = installSplashScreen()
      splashScreen.setKeepOnScreenCondition { keepSplashScreen }
    }
    
    // Let content extend below status bar and navigation bar instead of hiding them
    WindowCompat.setDecorFitsSystemWindows(window, false)
    
    // Set transparent status bar and navigation bar
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT
    
    // Call directly in onCreate to ensure it always executes
    Log.d("{{activityName}}", "Calling showCustomSplashPage from onCreate")
    showCustomSplashPage()
  }
  
  private fun parseJavascriptBoolean(result: String?): Boolean {
    if (result.isNullOrBlank()) {
      return false
    }
    val normalized = result.trim().removeSurrounding("\\\"").lowercase()
    return normalized == "true"
  }

  
  // Check if HTML file has privacy-related functions
  private fun checkHtmlForPrivacyFunctions(): Boolean {
    return try {
      val inputStream = assets.open("index.html")
      val htmlContent = inputStream.bufferedReader().use { it.readText() }
      inputStream.close()
      
      // Check if it contains privacy-related function names
      val privacyFunctionNames = listOf(
        "checkAuthStatus",
        "showPrivacyDialog",
        "hidePrivacyDialog",
        "closePrivacyDialog",
        "agreePrivacyPolicy",
        "disagreePrivacyPolicy"
      )
      
      val hasPrivacyFunctions = privacyFunctionNames.any { functionName ->
        htmlContent.contains(functionName) && 
        (htmlContent.contains("function $functionName") || 
         htmlContent.contains("$functionName()") ||
         htmlContent.contains("const $functionName") ||
         htmlContent.contains("let $functionName"))
      }
      
      Log.d("{{activityName}}", "HTML content check result: $hasPrivacyFunctions")
      hasPrivacyFunctions
    } catch (e: Exception) {
      Log.e("{{activityName}}", "Error reading HTML file, defaulting to show splash", e)
      // If read fails, default to show splash screen (for safety)
      true
    }
  }
  
  override fun onResume() {
    super.onResume()
    Log.d("{{activityName}}", "onResume called, loaded: $loaded")
    // If onCreate didn't execute (shouldn't happen), execute in onResume
    if (!loaded) {
      loaded = true
      Log.d("{{activityName}}", "Calling showCustomSplashPage from onResume")
      showCustomSplashPage()
    }
  }
  
  private fun showCustomSplashPage() {
    Log.d("{{activityName}}", "showCustomSplashPage called")
    // Prevent duplicate execution
    if (loaded) {
      Log.d("{{activityName}}", "showCustomSplashPage already executed, skipping")
      return
    }
    loaded = true
    
    try {
      // Create container
      webViewContainer = object : ViewGroup(this) {
        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
          // Full screen layout, ensure WebView fills entire container
          val childCount = childCount
          val width = r - l
          val height = b - t
          Log.d("{{activityName}}", "Container onLayout: width=$width, height=$height, childCount=$childCount")
          for (i in 0 until childCount) {
            val child = getChildAt(i)
            child.layout(0, 0, width, height)
            Log.d("{{activityName}}", "Child $i laid out: width=\${child.width}, height=\${child.height}")
          }
        }
      }.apply {
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        // Ensure container is not affected by system window insets, can extend to status bar and navigation bar areas
        fitsSystemWindows = false
      }
      
      webView = WebView(this).apply {
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
        // Use hardware acceleration to improve rendering performance
        setLayerType(View.LAYER_TYPE_HARDWARE, null)
        
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true
        
        // Ensure WebView is visible
        visibility = View.VISIBLE
        
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        
        addJavascriptInterface(WebAppInterface(), "Android")
        
        webViewClient = object : WebViewClient() {
          override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
            super.onPageStarted(view, url, favicon)
            Log.d("{{activityName}}", "WebView page started loading: $url")
          }
          
          override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            Log.d("{{activityName}}", "WebView page finished loading: $url")
            
            // After WebView finishes loading, close system splash screen on Android 12+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
              keepSplashScreen = false
            }
            
            // Get isAuth state and inject into HTML
            val isAuth = sharedPreferences?.getBoolean("isAuth", false) ?: false
            Log.d("{{activityName}}", "Injecting isAuth status: $isAuth")
            
            // Delay execution to ensure functions in HTML are already defined
            Handler(Looper.getMainLooper()).postDelayed({
              // First check if privacy-related functions exist in HTML
              val checkPrivacyFunctionsJS = """
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
              """.trimIndent()
              
              evaluateJavascript(checkPrivacyFunctionsJS) { result ->
                val hasPrivacyFunctions = parseJavascriptBoolean(result)
                Log.d("{{activityName}}", "HTML has privacy functions (JS): $hasPrivacyFunctions")
                
                if (!hasPrivacyFunctions) {
                  // If HTML has no privacy-related code, default isAuth to true
                  Log.d("{{activityName}}", "No privacy functions found, setting isAuth to true")
                  
                  // Set isAuth to true and save
                  val editor = sharedPreferences?.edit()
                  editor?.putBoolean("isAuth", true)
                  editor?.apply()
                  
                  // Inject isAuth=true into HTML and execute isAuth=true logic
                  val jsCode = """
                    (function() {
                      console.log('No privacy functions found, setting isAuth to true');
                      // Inject isAuth state as true
                      window.isAuth = true;
                      
                      // Execute isAuth=true logic: hide dialog (if exists)
                      if (typeof hidePrivacyDialog === 'function') {
                        console.log('Calling hidePrivacyDialog');
                        hidePrivacyDialog();
                      }
                      if (typeof closePrivacyDialog === 'function') {
                        console.log('Calling closePrivacyDialog');
                        closePrivacyDialog();
                      }
                    })();
                  """.trimIndent()
                  evaluateJavascript(jsCode, null)
                  
                  // Start MainActivity (isAuth=true logic)
                  Log.d("{{activityName}}", "Starting MainActivity with isAuth=true")
                  startMainActivity()
                } else {
                  // If privacy-related code exists, handle with original logic
                  val jsCode = """
                    (function() {
                      console.log('Injecting isAuth: $isAuth');
                      // Inject isAuth state
                      window.isAuth = $isAuth;
                      
                      // Show/hide dialog based on isAuth state
                      if (typeof checkAuthStatus === 'function') {
                        console.log('Calling checkAuthStatus');
                        checkAuthStatus();
                      } else if (window.isAuth) {
                        if (typeof closePrivacyDialog === 'function') {
                          console.log('Calling closePrivacyDialog');
                          closePrivacyDialog();
                        } else {
                          console.log('closePrivacyDialog function not found');
                        }
                      } else {
                        if (typeof showPrivacyDialog === 'function') {
                          console.log('Calling showPrivacyDialog');
                          showPrivacyDialog();
                        } else {
                          console.log('showPrivacyDialog function not found');
                        }
                      }
                    })();
                  """.trimIndent()
                  evaluateJavascript(jsCode, null)
                  
                  // If isAuth is already true, directly start MainActivity
                  // WebView container remains visible until hideAsync() is called to close
                  if (isAuth) {
                    Log.d("{{activityName}}", "isAuth is true, starting MainActivity immediately")
                    startMainActivity()
                  }
                }
              }
            }, 200)
          }
          
          override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
            super.onReceivedError(view, errorCode, description, failingUrl)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
              keepSplashScreen = false
            }
            startMainActivity()
          }
        }
      }
      
      // Ensure container is visible
      webViewContainer?.visibility = View.VISIBLE
      webViewContainer?.addView(webView)
      
      // Use window.decorView to ensure on top layer, covering status bar
      val decorView = window.decorView as? ViewGroup
      if (decorView != null) {
        decorView.addView(webViewContainer)
        webViewContainer?.bringToFront()
        webViewContainer?.visibility = View.VISIBLE
        webViewContainer?.elevation = Float.MAX_VALUE // Ensure on top layer
      } else {
        // If decorView is not available, fallback to setContentView
        setContentView(webViewContainer)
      }
      
      Log.d("{{activityName}}", "WebView container added to decorView")
      Log.d("{{activityName}}", "WebView visibility: \${webView?.visibility}")
      Log.d("{{activityName}}", "WebView container visibility: \${webViewContainer?.visibility}")
      Log.d("{{activityName}}", "WebView width: \${webView?.width}, height: \${webView?.height}")
      
      // Force refresh layout
      webViewContainer?.requestLayout()
      webView?.requestLayout()
      
      // Delay loading HTML to ensure layout is complete
      Handler(Looper.getMainLooper()).postDelayed({
        // Load HTML file - use loadUrl to directly load to ensure relative paths are correctly resolved
        try {
          webView?.loadUrl("file:///android_asset/index.html")
          Log.d("{{activityName}}", "Loading HTML file from assets using loadUrl")
        } catch (e: Exception) {
          Log.e("{{activityName}}", "Error loading HTML file", e)
          e.printStackTrace()
        }
      }, 100)
      
    } catch (e: Exception) {
      Log.e("{{activityName}}", "Error in showCustomSplashPage", e)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        keepSplashScreen = false
      }
      startMainActivity()
    }
  }
  
  private fun startMainActivity() {
    try {
      // Start MainActivity and finish current Activity
      MainActivity.actionStart(this)
      finish()
    } catch (e: Exception) {
      Log.e("{{activityName}}", "Error starting MainActivity", e)
    }
  }
  
  fun preventAutoHide() {
    preventAutoHide = true
    Log.d("{{activityName}}", "preventAutoHide called, preventAutoHide: $preventAutoHide")
  }
  
  fun hideWebViewContainer(force: Boolean = false) {
    // Ensure all UI operations execute on main thread
    if (Looper.myLooper() == Looper.getMainLooper()) {
      // Already on main thread, execute directly
      hideWebViewContainerInternal(force)
    } else {
      // Not on main thread, switch to main thread to execute
      runOnUiThread {
        hideWebViewContainerInternal(force)
      }
    }
  }
  
  private fun hideWebViewContainerInternal(force: Boolean = false) {
    try {
      Log.d("{{activityName}}", "hideWebViewContainer called, force=$force, preventAutoHide=$preventAutoHide, webViewContainer=\${webViewContainer != null}")
      // If preventAutoHide is true and not force hide, don't execute hide operation
      if (preventAutoHide && !force) {
        Log.d("{{activityName}}", "hideWebViewContainer prevented by preventAutoHide flag")
        return
      }
      
      // If WebView container has parent view, remove from parent view first
      if (webViewContainer != null) {
        val parent = webViewContainer?.parent as? ViewGroup
        parent?.removeView(webViewContainer)
        
        webViewContainer?.visibility = View.GONE
        webViewContainer?.removeAllViews()
        webView?.destroy()
        webView = null
        webViewContainer = null
        preventAutoHide = false
        Log.d("{{activityName}}", "WebView container hidden")
      } else {
        Log.d("{{activityName}}", "WebView container is null, skipping")
      }
    } catch (e: Exception) {
      Log.e("{{activityName}}", "Error hiding WebView container", e)
      e.printStackTrace()
    }
  }
  
  private fun handleAgreePrivacyPolicy() {
    try {
      val editor = sharedPreferences?.edit()
      editor?.putBoolean("isAuth", true)
      val saved = editor?.commit() ?: false
      Log.d("{{activityName}}", "Saved isAuth=true, result: $saved")
      
      // Verify if save was successful
      val verifyAuth = sharedPreferences?.getBoolean("isAuth", false) ?: false
      Log.d("{{activityName}}", "Verified isAuth after save: $verifyAuth")
      
      // Immediately close dialog and start MainActivity
      // Note: Don't wait for JS execution to complete, because evaluateJavascript is asynchronous
      // MainActivity will ensure dialog is closed again when reusing WebView
      webView?.evaluateJavascript("""
        (function() {
          console.log('[SplashScreen2Activity] Closing privacy dialog after agreement');
          window.isAuth = true;
          if (typeof closePrivacyDialog === 'function') {
            closePrivacyDialog();
          }
        })();
      """.trimIndent(), null)
      
      // Immediately start MainActivity, don't wait for JS execution
      // MainActivity will re-inject isAuth state to ensure dialog doesn't show again
      Log.d("{{activityName}}", "Starting MainActivity after privacy agreement")
      startMainActivity()
    } catch (e: Exception) {
      Log.e("{{activityName}}", "Error in handleAgreePrivacyPolicy", e)
      startMainActivity()
    }
  }
  
  private fun handleDisagreePrivacyPolicy() {
    try {
      finishAffinity()
    } catch (e: Exception) {
      finish()
    }
  }
  
  private fun handleOpenPrivacyPolicy(url: String) {
    try {
      Log.d("{{activityName}}", "Opening privacy policy: $url")
      // Use SplashScreen2PrivacyPolicyActivity's WebView container to open online URL
      val intent = Intent(this, SplashScreen2PrivacyPolicyActivity::class.java).apply {
        putExtra("url", url)
      }
      startActivity(intent)
    } catch (e: Exception) {
      Log.e("{{activityName}}", "Error opening privacy policy in WebView", e)
      // No longer fallback to browser, only log error
    }
  }
  
  override fun onDestroy() {
    super.onDestroy()
    instance = null
    
    // If container has been reused by MainActivity, don't destroy WebView
    if (!containerReused) {
      Log.d("{{activityName}}", "Destroying WebView (container not reused)")
      webView?.destroy()
      webView = null
      webViewContainer = null
    } else {
      Log.d("{{activityName}}", "Skipping WebView destruction (container reused by MainActivity)")
      // Only clear references, don't destroy WebView, let MainActivity continue using it
      webView = null
      webViewContainer = null
    }
  }
  
  inner class WebAppInterface {
    @JavascriptInterface
    fun getIsAuth(): Boolean {
      return sharedPreferences?.getBoolean("isAuth", false) ?: false
    }
    
    @JavascriptInterface
    fun agreePrivacyPolicy() {
      runOnUiThread {
        handleAgreePrivacyPolicy()
      }
    }
    
    @JavascriptInterface
    fun disagreePrivacyPolicy() {
      runOnUiThread {
        handleDisagreePrivacyPolicy()
      }
    }
    
    @JavascriptInterface
    fun openPrivacyPolicy(url: String) {
      runOnUiThread {
        handleOpenPrivacyPolicy(url)
      }
    }
  }
}
`,

  /**
   * SplashScreen2PrivacyPolicyActivity.kt template
   */
  privacyPolicyActivity: `package {{packageName}}

import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class SplashScreen2PrivacyPolicyActivity : AppCompatActivity() {
  private var webView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    val url = intent.getStringExtra("url") ?: ""
    Log.d("SplashScreen2PrivacyPolicyActivity", "Opening URL: $url")
    
    if (url.isEmpty()) {
      Log.e("SplashScreen2PrivacyPolicyActivity", "URL is empty")
      finish()
      return
    }
    
    // Create WebView
    webView = WebView(this).apply {
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.allowFileAccess = true
      settings.allowContentAccess = true
      settings.allowFileAccessFromFileURLs = true
      settings.allowUniversalAccessFromFileURLs = true
      settings.loadWithOverviewMode = true
      settings.useWideViewPort = true
      settings.builtInZoomControls = false
      settings.displayZoomControls = false
      
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      
      webViewClient = object : WebViewClient() {
        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
          super.onPageStarted(view, url, favicon)
          Log.d("SplashScreen2PrivacyPolicyActivity", "Page started loading: $url")
        }
        
        override fun onPageFinished(view: WebView?, url: String?) {
          super.onPageFinished(view, url)
          Log.d("SplashScreen2PrivacyPolicyActivity", "Page finished loading: $url")
        }
        
        override fun onReceivedError(
          view: WebView?,
          request: WebResourceRequest?,
          error: WebResourceError?
        ) {
          super.onReceivedError(view, request, error)
          Log.e("SplashScreen2PrivacyPolicyActivity", "Error loading page: \${error?.description}")
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Log.e("SplashScreen2PrivacyPolicyActivity", "Error code: \${error?.errorCode}")
          }
        }
        
        override fun shouldOverrideUrlLoading(
          view: WebView?,
          request: WebResourceRequest?
        ): Boolean {
          // Load all links in current WebView
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            view?.loadUrl(request?.url.toString())
          }
          return true
        }
      }
    }
    
    setContentView(webView)
    
    // Load URL
    try {
      webView?.loadUrl(url)
      Log.d("SplashScreen2PrivacyPolicyActivity", "Loading URL: $url")
    } catch (e: Exception) {
      Log.e("SplashScreen2PrivacyPolicyActivity", "Error loading URL", e)
      finish()
    }
  }
  
  override fun onBackPressed() {
    if (webView?.canGoBack() == true) {
      webView?.goBack()
    } else {
      super.onBackPressed()
    }
  }
  
  override fun onDestroy() {
    super.onDestroy()
    webView?.destroy()
    webView = null
  }
}
`,

  /**
   * MainActivity modification code snippet - companion object
   */
  mainActivityCompanionObject: `
  companion object {
    fun actionStart(context: android.content.Context) {
      val intent = android.content.Intent(context, MainActivity::class.java)
      context.startActivity(intent)
      // Add fade-in fade-out animation effect
      if (context is android.app.Activity) {
        context.overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
      }
    }
  }`,

  /**
   * MainActivity modification code snippet - WebView container related code
   */
  mainActivityWebViewCode: `
  private var webViewContainer: ViewGroup? = null
  private var preventAutoHide = false
  
  private fun setupWebViewContainer() {
    try {
      // Directly create new WebView container, don't reuse previous one
      android.util.Log.d("MainActivity", "Creating new WebView container in MainActivity")
      createWebViewContainer()
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error setting up WebView container", e)
      createWebViewContainer()
    }
  }
  
   fun preventAutoHide() {
    runOnUiThread {
      preventAutoHide = true
      android.util.Log.d("MainActivity", "preventAutoHide called, preventAutoHide: $preventAutoHide")
      // If WebView container doesn't exist, create it (when there's no privacy code, container may not be created yet)
      if (webViewContainer == null) {
        android.util.Log.d("MainActivity", "WebView container is null, creating it")
        setupWebViewContainer()
      }
    }
  }
  
  private fun createWebViewContainer() {
    try {
      // Create container
      webViewContainer = object : ViewGroup(this) {
        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
          val childCount = childCount
          val width = r - l
          val height = b - t
          for (i in 0 until childCount) {
            val child = getChildAt(i)
            child.layout(0, 0, width, height)
          }
        }
      }.apply {
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        // Ensure container is not affected by system window insets, can extend to status bar and navigation bar areas
        fitsSystemWindows = false
      }
      
      // Create WebView
      val webView = WebView(this).apply {
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
        setLayerType(View.LAYER_TYPE_HARDWARE, null)
        
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true
        
        visibility = View.VISIBLE
        
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        
        webViewClient = object : WebViewClient() {
          override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            android.util.Log.d("MainActivity", "WebView page finished loading: $url")
            
            // Get isAuth state and inject into HTML
            val sharedPreferences = getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
            val isAuth = sharedPreferences.getBoolean("isAuth", false)
            android.util.Log.d("MainActivity", "Injecting isAuth status: $isAuth")
            
            // Delay execution to ensure functions in HTML are already defined
            Handler(Looper.getMainLooper()).postDelayed({
              val jsCode = """
                (function() {
                  console.log('[MainActivity] Injecting isAuth: $isAuth');
                  window.isAuth = $isAuth;
                  
                  // Show/hide dialog based on isAuth state
                  if (typeof checkAuthStatus === 'function') {
                    console.log('[MainActivity] Calling checkAuthStatus');
                    checkAuthStatus();
                  } else if (window.isAuth) {
                    if (typeof closePrivacyDialog === 'function') {
                      console.log('[MainActivity] Calling closePrivacyDialog');
                      closePrivacyDialog();
                    } else {
                      console.log('[MainActivity] closePrivacyDialog function not found');
                    }
                  } else {
                    if (typeof showPrivacyDialog === 'function') {
                      console.log('[MainActivity] Calling showPrivacyDialog');
                      showPrivacyDialog();
                    } else {
                      console.log('[MainActivity] showPrivacyDialog function not found');
                    }
                  }
                })();
              """.trimIndent()
              view?.evaluateJavascript(jsCode, null)
            }, 200)
          }
        }
      }
      
      webViewContainer?.addView(webView)
      
      // Use window.decorView to ensure on top layer
      val decorView = window.decorView as? ViewGroup
      if (decorView != null) {
        decorView.addView(webViewContainer)
        webViewContainer?.bringToFront()
        webViewContainer?.visibility = View.VISIBLE
        webViewContainer?.elevation = Float.MAX_VALUE // Ensure on top layer
        
        loadSplashHtmlWithoutPrivacyFlash(webView)
      }
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error creating WebView container", e)
    }
  }
  
  private fun loadSplashHtmlWithoutPrivacyFlash(webView: WebView) {
    try {
      val inputStream = assets.open("index.html")
      val originalHtml = inputStream.bufferedReader().use { it.readText() }
      inputStream.close()
      
      // Inject CSS styles to immediately hide Modal dialog, prevent flickering
      // Inject JS script to set isAuth state
      val injectionScript = """
        <style>
          /* Immediately hide Modal dialog, prevent flickering */
          /* React Native Web's Modal uses role="dialog" */
          [role="dialog"],
          [aria-modal="true"],
          /* Hide elements with modalOverlay style */
          [style*="background-color: rgba(0, 0, 0"],
          [style*="backgroundColor: rgba(0, 0, 0"] {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        </style>
        <script>
          window.isAuth = true;
          window.__fromMainActivity = true;
          window.skipPrivacyDialog = true;
          document.addEventListener('DOMContentLoaded', function () {
            if (typeof hidePrivacyDialog === 'function') {
              hidePrivacyDialog();
            }
            if (typeof closePrivacyDialog === 'function') {
              closePrivacyDialog();
            }
          });
        </script>
      """.trimIndent()
      
      val headMatch = Regex("(?i)<head>").find(originalHtml)
      val finalHtml = if (headMatch != null) {
        val end = headMatch.range.last + 1
        buildString {
          append(originalHtml.substring(0, end))
          append('\\n')
          append(injectionScript)
          append('\\n')
          append(originalHtml.substring(end))
        }
      } else {
        "$injectionScript\\n$originalHtml"
      }
      
      webView.loadDataWithBaseURL(
        "file:///android_asset/",
        finalHtml,
        "text/html",
        "utf-8",
        null
      )
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error loading HTML without privacy flash", e)
      try {
        webView.loadUrl("file:///android_asset/index.html")
      } catch (inner: Exception) {
        android.util.Log.e("MainActivity", "Fallback loading HTML failed", inner)
      }
    }
  }
  
  fun hideWebViewContainer(force: Boolean = false) {
    // Ensure all UI operations execute on main thread
    if (Looper.myLooper() == Looper.getMainLooper()) {
      // Already on main thread, execute directly
      hideWebViewContainerInternal(force)
    } else {
      // Not on main thread, switch to main thread to execute
      Handler(Looper.getMainLooper()).post {
        hideWebViewContainerInternal(force)
      }
    }
  }
  
  private fun hideWebViewContainerInternal(force: Boolean = false) {
    try {
      android.util.Log.d("MainActivity", "hideWebViewContainer called, force=$force, preventAutoHide=$preventAutoHide, webViewContainer=\${webViewContainer != null}")
      
      // If preventAutoHide is true and not force hide, don't execute hide operation
      if (preventAutoHide && !force) {
        android.util.Log.d("MainActivity", "hideWebViewContainer prevented by preventAutoHide flag")
        return
      }
      
      // Hide MainActivity's WebView container
      if (webViewContainer != null) {
        android.util.Log.d("MainActivity", "Hiding MainActivity WebView container")
        
        // First set visibility to GONE to ensure invisible
        webViewContainer?.visibility = View.GONE
        
        // Try to remove from parent view
        val parent = webViewContainer?.parent as? ViewGroup
        if (parent != null) {
          try {
            parent.removeView(webViewContainer)
            android.util.Log.d("MainActivity", "WebView container removed from parent")
          } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error removing WebView container from parent", e)
          }
        } else {
          android.util.Log.d("MainActivity", "WebView container has no parent, trying to remove from decorView")
          // If parent is null, try to remove directly from decorView
          try {
            val decorView = window.decorView as? ViewGroup
            decorView?.removeView(webViewContainer)
            android.util.Log.d("MainActivity", "WebView container removed from decorView")
          } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error removing WebView container from decorView", e)
          }
        }
        
        // Clean up all child views
        webViewContainer?.removeAllViews()
        
        // Clear reference
        webViewContainer = null
        android.util.Log.d("MainActivity", "MainActivity WebView container hidden and removed")
      } else {
        android.util.Log.d("MainActivity", "MainActivity WebView container is null, skipping")
      }
      
      // Also hide SplashScreen2Activity's WebView container
      // Even if SplashScreen2Activity has finish(), instance may still exist, container may still be on window
      try {
        val customSplashActivity = SplashScreen2Activity.getInstance()
        if (customSplashActivity != null) {
          android.util.Log.d("MainActivity", "Hiding SplashScreen2Activity WebView container")
          customSplashActivity.hideWebViewContainer(force)
        } else {
          android.util.Log.d("MainActivity", "SplashScreen2Activity instance is null (already finished or not created)")
        }
      } catch (e: Exception) {
        android.util.Log.d("MainActivity", "SplashScreen2Activity not available: \${e.message}")
      }
      
      // Reset preventAutoHide flag (regardless of whether hide was successful)
      preventAutoHide = false
      android.util.Log.d("MainActivity", "preventAutoHide reset to false")
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error hiding WebView container", e)
      e.printStackTrace()
      // Even if error occurs, reset preventAutoHide
      preventAutoHide = false
    }
  }`,

  /**
   * MainActivity onCreate code snippet to add
   */
  mainActivityOnCreateCode: `
    // Let content extend below status bar and navigation bar
    WindowCompat.setDecorFitsSystemWindows(window, false)
    
    // Set transparent status bar and navigation bar
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT
    
    // Immediately try to set up WebView container in onCreate, use Handler to ensure view hierarchy is ready
    // This avoids flickering in onResume
    Handler(Looper.getMainLooper()).post {
      setupWebViewContainer()
    }`,
};

/**
 * Replace placeholders in template
 */
export function replaceTemplatePlaceholders(
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

