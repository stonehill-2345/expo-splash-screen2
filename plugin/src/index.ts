import {
  AndroidManifest,
  BaseMods,
  ConfigPlugin,
  IOSConfig,
  withAndroidManifest,
  withAndroidStyles,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withMainActivity,
  withMod,
  withXcodeProject,
  XcodeProject
} from 'expo/config-plugins';
// Note: withAndroidStyles automatically handles writing, we only need to modify modResults
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { ANDROID_TEMPLATES, replaceTemplatePlaceholders } from './templates/android';
import { IOS_TEMPLATES, replaceIosTemplatePlaceholders } from './templates/ios';

interface SplashHtmlConfig {
  mode?: 'webview' | 'responsiveImage' | 'normal' | 'blend';
  backgroundColor?: string;
  image?: string;
  imageWidth?: number;
  localHtmlPath?: string;
  // Dark mode configuration (only valid in normal mode)
  dark?: {
    image?: string;           // Dark mode image path
    backgroundColor?: string; // Dark mode background color
    imageWidth?: number;     // Dark mode image width (default 100)
  };
}

const CUSTOM_SPLASH_ACTIVITY_NAME = 'SplashScreen2Activity';

// iOS SplashScreen.storyboard related constants
const STORYBOARD_FILE_PATH = './SplashScreen.storyboard';
const STORYBOARD_MOD_NAME = 'splashScreenStoryboard';
const IMAGE_ID = 'EXPO-SplashScreen';
const CONTAINER_ID = 'EXPO-ContainerView';

/**
 * Get plugin configuration
 */
function getSplashHtmlConfig(config: any): SplashHtmlConfig | null {
  const plugins = config.plugins || [];
  for (const plugin of plugins) {
    if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen2') {
      return plugin[1] || {};
    }
  }
  return null;
}

function safeResolve(projectRoot: string, p: string): string {
  if (!p) return '';
  if (path.isAbsolute(p)) return p;
  return path.resolve(projectRoot, p);
}

/**
 * Execute expo-splash-web/build-splash-web.js script to bundle HTML
 */
function executeBuildSplashWeb(projectRoot: string): void {
  const sourceDir = 'expo-splash-web';
  const splashWebDir = path.join(projectRoot, sourceDir);
  const buildScript = path.join(splashWebDir, 'build-splash-web.js');
  
  if (!fs.existsSync(buildScript)) {
    throw new Error(`[expo-splash-screen2] build-splash-web.js not found in ${sourceDir}. Please ensure the build script exists.`);
  }
  
  console.log(`[expo-splash-screen2] Executing build-splash-web.js in ${sourceDir}...`);
  
  const result = spawnSync('node', ['build-splash-web.js'], {
    cwd: splashWebDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  if (result.error) {
    throw new Error(`[expo-splash-screen2] Failed to execute build-splash-web.js: ${result.error.message}`);
  }
  
  if (result.status !== 0) {
    throw new Error(`[expo-splash-screen2] build-splash-web.js exited with code ${result.status}`);
  }
  
  console.log('[expo-splash-screen2] Build completed successfully.');
}

/**
 * Bundle expo-splash-web directory and return the built HTML path
 */
async function bundleSplashWeb(projectRoot: string): Promise<string> {
  const sourceDir = 'expo-splash-web';
  const dir = path.join(projectRoot, sourceDir);
  
  // Check if directory exists
  if (!fs.existsSync(dir)) {
    throw new Error(`[expo-splash-screen2] Directory "${sourceDir}" not found in project root. Please create the "${sourceDir}" directory with your HTML, CSS, and JavaScript files.`);
  }
  
  // Execute build-splash-web.js script
  executeBuildSplashWeb(projectRoot);
  
  // Return the built HTML path
  const outPath = path.join(projectRoot, sourceDir, 'dist', 'index.html');
  if (!fs.existsSync(outPath)) {
    throw new Error(`[expo-splash-screen2] Build failed: ${outPath} not found. Please check the build script output.`);
  }
  
  return outPath;
}

/**
 * Resolve HTML file path
 * In webview mode:
 * - If localHtmlPath is provided, use localHtmlPath
 * - If localHtmlPath is not provided, bundle expo-splash-web
 */
async function resolveHtmlPath(projectRoot: string, pluginConfig: SplashHtmlConfig | null): Promise<string | null> {
  if (!pluginConfig) return null;
  
  // If localHtmlPath is configured, return the path directly
  if (pluginConfig.localHtmlPath) {
    return safeResolve(projectRoot, pluginConfig.localHtmlPath);
  }
  
  // If localHtmlPath is not configured, bundle expo-splash-web
  return await bundleSplashWeb(projectRoot);
}

/**
 * Normalize color value to Android-recognizable format
 * Android supports #RGB, #RRGGBB, #AARRGGBB formats
 */
function normalizeAndroidColor(color: string): string {
  // Remove all spaces
  color = color.trim();
  
  // If there's no # prefix, add it
  if (!color.startsWith('#')) {
    color = '#' + color;
  }
  
  // Remove # for processing
  let hex = color.substring(1).toUpperCase();
  
  // If it's a 3-digit hex, expand to 6 digits
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // Ensure it's 6 or 8 digit hex
  if (hex.length === 6) {
    // 6-digit format: RRGGBB (opaque)
    return '#' + hex;
  } else if (hex.length === 8) {
    // 8-digit format: AARRGGBB (with alpha)
    return '#' + hex;
  } else {
    // If format is incorrect, return default color
    console.warn(`[expo-splash-screen2] Invalid color format: ${color}, using #FFFFFF`);
    return '#FFFFFF';
  }
}

/**
 * Convert color value to format with alpha (prepend FF)
 * Input: #RRGGBB or #AARRGGBB
 * Output: #FFRRGGBB (if input is 6 digits) or #AARRGGBB (if input is already 8 digits)
 */
function addAlphaToColor(color: string): string {
  const normalized = normalizeAndroidColor(color);
  const hex = normalized.substring(1).toUpperCase();
  
  // If already 8 digits (with alpha), return directly
  if (hex.length === 8) {
    return normalized;
  }
  
  // If 6 digits, prepend FF (fully opaque)
  if (hex.length === 6) {
    return '#FF' + hex;
  }
  
  // Otherwise return original value
  return normalized;
}

/**
 * Create Android color resource file (for system splash screen background color)
 * Define splashscreen_background in values/colors.xml and values-night/colors.xml
 * This way the system splash screen (Android 12+) will automatically switch background color based on dark/light mode
 */
function createSplashColorsXml(
  androidMainPath: string,
  backgroundColor: string,
  darkBackgroundColor?: string
): void {
  try {
    // Create values/colors.xml (light mode)
    const valuesPath = path.join(androidMainPath, 'res', 'values');
    if (!fs.existsSync(valuesPath)) {
      fs.mkdirSync(valuesPath, { recursive: true });
    }
    
    const colorsXmlPath = path.join(valuesPath, 'colors.xml');
    const normalizedLightColor = normalizeAndroidColor(backgroundColor);
    
    // Check if colors.xml already exists
    let existingColors = '';
    let hasColorPrimary = false;
    if (fs.existsSync(colorsXmlPath)) {
      existingColors = fs.readFileSync(colorsXmlPath, 'utf-8');
      hasColorPrimary = existingColors.includes('colorPrimary');
    }
    
    // If splashscreen_background already exists, update it; otherwise add it
    if (existingColors.includes('splashscreen_background')) {
      existingColors = existingColors.replace(
        /<color name="splashscreen_background">[^<]*<\/color>/,
        `<color name="splashscreen_background">${normalizedLightColor}</color>`
      );
      fs.writeFileSync(colorsXmlPath, existingColors);
    } else if (existingColors.includes('<resources>')) {
      // Add to existing resources
      existingColors = existingColors.replace(
        '</resources>',
        `    <color name="splashscreen_background">${normalizedLightColor}</color>\n</resources>`
      );
      fs.writeFileSync(colorsXmlPath, existingColors);
    } else {
      // Create new file, preserve colorPrimary (if Expo needs it)
      const lightColorsXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splashscreen_background">${normalizedLightColor}</color>
    <color name="colorPrimary">#023c69</color>
</resources>
`;
      fs.writeFileSync(colorsXmlPath, lightColorsXmlContent);
    }
    console.log(`[expo-splash-screen2] Created/updated values/colors.xml with splashscreen_background: ${normalizedLightColor}`);
    
    // If dark mode is configured, create values-night/colors.xml
    if (darkBackgroundColor) {
      const valuesNightPath = path.join(androidMainPath, 'res', 'values-night');
      if (!fs.existsSync(valuesNightPath)) {
        fs.mkdirSync(valuesNightPath, { recursive: true });
      }
      
      const normalizedDarkColor = normalizeAndroidColor(darkBackgroundColor);
      const nightColorsXmlPath = path.join(valuesNightPath, 'colors.xml');
      
      // Check if it already exists
      let existingNightColors = '';
      if (fs.existsSync(nightColorsXmlPath)) {
        existingNightColors = fs.readFileSync(nightColorsXmlPath, 'utf-8');
      }
      
      if (existingNightColors.includes('splashscreen_background')) {
        existingNightColors = existingNightColors.replace(
          /<color name="splashscreen_background">[^<]*<\/color>/,
          `<color name="splashscreen_background">${normalizedDarkColor}</color>`
        );
        fs.writeFileSync(nightColorsXmlPath, existingNightColors);
      } else if (existingNightColors.includes('<resources>')) {
        existingNightColors = existingNightColors.replace(
          '</resources>',
          `    <color name="splashscreen_background">${normalizedDarkColor}</color>\n</resources>`
        );
        fs.writeFileSync(nightColorsXmlPath, existingNightColors);
      } else {
        const nightColorsXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splashscreen_background">${normalizedDarkColor}</color>
</resources>
`;
        fs.writeFileSync(nightColorsXmlPath, nightColorsXmlContent);
      }
      console.log(`[expo-splash-screen2] Created/updated values-night/colors.xml with splashscreen_background: ${normalizedDarkColor}`);
    }
  } catch (error) {
    console.error(`[expo-splash-screen2] Error creating splash colors.xml: ${error}`);
  }
}

/**
 * Update ic_launcher_background.xml file
 * Background color uses color resource @color/splashscreen_background (supports automatic dark mode switching)
 * Logo uses @drawable/splashscreen_logo, size set to imageWidth dp x imageWidth dp
 */
function updateIcLauncherBackground(
  androidResPath: string,
  backgroundColor: string,
  imageWidth: number = 100
): void {
  try {
    const drawableDir = path.join(androidResPath, 'res', 'drawable');
    const xmlPath = path.join(drawableDir, 'ic_launcher_background.xml');
    
    // Ensure directory exists
    if (!fs.existsSync(drawableDir)) {
      fs.mkdirSync(drawableDir, { recursive: true });
    }
    
    // Use color resource reference, supports automatic dark mode switching
    // Color values are defined in values/colors.xml and values-night/colors.xml
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <color android:color="@color/splashscreen_background" />
    </item>
    <item
        android:width="${imageWidth}dp"
        android:height="${imageWidth}dp"
        android:gravity="center">
        <bitmap
            android:gravity="center"
            android:src="@drawable/splashscreen_logo" />
    </item>
</layer-list>`;

    fs.writeFileSync(xmlPath, xmlContent);
  } catch (error) {
    console.error(`[expo-splash-screen2] Error updating ic_launcher_background.xml: ${error}`);
  }
}

/**
 * Update ic_launcher_background.xml file (image mode)
 * Only display background image (.9 patch), do not display icon
 */
function updateIcLauncherBackgroundForImageMode(
  androidResPath: string,
  imageResourceName: string
): void {
  try {
    const drawableDir = path.join(androidResPath, 'res', 'drawable');
    const xmlPath = path.join(drawableDir, 'ic_launcher_background.xml');
    
    // Ensure directory exists
    if (!fs.existsSync(drawableDir)) {
      fs.mkdirSync(drawableDir, { recursive: true });
    }
    
    // Create new ic_launcher_background.xml, only display background image (.9 patch)
    // For .9 patch images, use drawable attribute directly, Android will automatically recognize and handle stretching correctly
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@drawable/${imageResourceName}" />
</layer-list>`;

    fs.writeFileSync(xmlPath, xmlContent);
  } catch (error) {
    console.error(`[expo-splash-screen2] Error updating ic_launcher_background.xml for image mode: ${error}`);
  }
}

/**
 * Copy icon to Android resource directory, save as splashscreen_logo.png
 * Create a drawable XML to limit display size to imageWidth dp x imageWidth dp, and include background color
 * Also copy icon to various density directories (hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi)
 */
function copyIcon(
  projectRoot: string,
  iconPath: string,
  androidResPath: string,
  backgroundColor: string,
  imageWidth: number = 100
): void {
  try {
    const sourcePath = path.resolve(projectRoot, iconPath);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[expo-splash-screen2] Icon file not found: ${sourcePath}`);
      return;
    }

    // Normalize color value to ensure Android can recognize it
    const normalizedColor = normalizeAndroidColor(backgroundColor);

    // Get source file extension
    const sourceExt = path.extname(sourcePath).toLowerCase();
    const drawableDir = path.join(androidResPath, 'res', 'drawable');

    // Ensure directory exists
    if (!fs.existsSync(drawableDir)) {
      fs.mkdirSync(drawableDir, { recursive: true });
    }

    // Solution: Save image file as splashscreen_logo_raw.png, XML as splashscreen_logo.xml
    // This way styles.xml references @drawable/splashscreen_logo will use XML
    // XML internally references @drawable/splashscreen_logo_raw uses image file
    // This avoids resource name conflicts, and XML can limit display size to imageWidth dp x imageWidth dp
    const rawImageFileName = sourceExt === '.png' ? 'splashscreen_logo_raw.png' : `splashscreen_logo_raw${sourceExt}`;
    const rawImagePath = path.join(drawableDir, rawImageFileName);
    
    // Copy image file with original filename
    fs.copyFileSync(sourcePath, rawImagePath);
    
    // Then create XML file, reference original image file, and include background color
    const xmlPath = path.join(drawableDir, 'splashscreen_logo.xml');
    const rawImageResourceName = sourceExt === '.png' ? 'splashscreen_logo_raw' : `splashscreen_logo_raw${sourceExt.replace('.', '_')}`;
    
    // Create layer-list, include background color and centered imageWidth dp x imageWidth dp logo
    // Use normalized color value
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <color android:color="${normalizedColor}" />
    </item>
    <item
        android:width="${imageWidth}dp"
        android:height="${imageWidth}dp"
        android:gravity="center">
        <bitmap
            android:gravity="center"
            android:src="@drawable/${rawImageResourceName}" />
    </item>
</layer-list>`;

    fs.writeFileSync(xmlPath, xmlContent);
    
    // Copy icon to various density directories (hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi)
    // File name uses splashscreen_logo.png (without _raw suffix), for ic_launcher_background.xml reference
    const densityDirs = ['drawable-hdpi', 'drawable-mdpi', 'drawable-xhdpi', 'drawable-xxhdpi', 'drawable-xxxhdpi'];
    const targetFileName = sourceExt === '.png' ? 'splashscreen_logo.png' : `splashscreen_logo${sourceExt}`;
    
    densityDirs.forEach((densityDir) => {
      const densityPath = path.join(androidResPath, 'res', densityDir);
      
      // Ensure directory exists
      if (!fs.existsSync(densityPath)) {
        fs.mkdirSync(densityPath, { recursive: true });
      }
      
      // Copy icon file to density directory
      const targetPath = path.join(densityPath, targetFileName);
      fs.copyFileSync(sourcePath, targetPath);
    });
  } catch (error) {
    console.error(`[expo-splash-screen2] Error copying icon: ${error}`);
  }
}

/**
 * Create splashscreen_logo resource for Normal mode (supports dark mode)
 * Light mode: use backgroundColor + image
 * Dark mode: use dark.backgroundColor + dark.image (if configured)
 */
function createSplashScreenLogoForNormalMode(
  projectRoot: string,
  androidMainPath: string,
  imagePath: string,
  backgroundColor: string,
  imageWidth: number,
  darkImagePath?: string,
  darkBackgroundColor?: string,
  darkImageWidth?: number
): void {
  try {
    const sourcePath = path.resolve(projectRoot, imagePath);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[expo-splash-screen2] Image file not found: ${sourcePath}`);
      return;
    }

    // Normalize color values
    const normalizedLightColor = normalizeAndroidColor(backgroundColor);
    const normalizedDarkColor = darkBackgroundColor ? normalizeAndroidColor(darkBackgroundColor) : normalizedLightColor;

    // Get source file extension
    const sourceExt = path.extname(sourcePath).toLowerCase();
    
    // ========== Light mode: create drawable/splashscreen_logo.xml ==========
    const drawableDir = path.join(androidMainPath, 'res', 'drawable');
    if (!fs.existsSync(drawableDir)) {
      fs.mkdirSync(drawableDir, { recursive: true });
    }

    // Save image file as splashscreen_logo_raw.png
    const rawImageFileName = sourceExt === '.png' ? 'splashscreen_logo_raw.png' : `splashscreen_logo_raw${sourceExt}`;
    const rawImagePath = path.join(drawableDir, rawImageFileName);
    fs.copyFileSync(sourcePath, rawImagePath);

    // Create XML file, reference original image file, and include background color
    const xmlPath = path.join(drawableDir, 'splashscreen_logo.xml');
    const rawImageResourceName = sourceExt === '.png' ? 'splashscreen_logo_raw' : `splashscreen_logo_raw${sourceExt.replace('.', '_')}`;
    
    const lightXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <color android:color="${normalizedLightColor}" />
    </item>
    <item
        android:width="${imageWidth}dp"
        android:height="${imageWidth}dp"
        android:gravity="center">
        <bitmap
            android:gravity="center"
            android:src="@drawable/${rawImageResourceName}" />
    </item>
</layer-list>`;

    fs.writeFileSync(xmlPath, lightXmlContent);
    console.log('[expo-splash-screen2] Created splashscreen_logo.xml for light mode');

    // ========== Dark mode: create drawable-night/splashscreen_logo.xml ==========
    if (darkImagePath) {
      // darkImagePath is a relative path, need to resolve to absolute path
      const darkSourcePath = path.resolve(projectRoot, darkImagePath);
      if (fs.existsSync(darkSourcePath)) {
        const drawableNightDir = path.join(androidMainPath, 'res', 'drawable-night');
        if (!fs.existsSync(drawableNightDir)) {
          fs.mkdirSync(drawableNightDir, { recursive: true });
        }

        // Save dark mode image file as splashscreen_logo_raw.png
        const darkRawImagePath = path.join(drawableNightDir, rawImageFileName);
        fs.copyFileSync(darkSourcePath, darkRawImagePath);

        // Use dark mode imageWidth (if configured), otherwise use light mode imageWidth
        const finalDarkImageWidth = darkImageWidth !== undefined ? darkImageWidth : imageWidth;

        // Create dark mode XML file
        const darkXmlPath = path.join(drawableNightDir, 'splashscreen_logo.xml');
        const darkXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <color android:color="${normalizedDarkColor}" />
    </item>
    <item
        android:width="${finalDarkImageWidth}dp"
        android:height="${finalDarkImageWidth}dp"
        android:gravity="center">
        <bitmap
            android:gravity="center"
            android:src="@drawable/${rawImageResourceName}" />
    </item>
</layer-list>`;

        fs.writeFileSync(darkXmlPath, darkXmlContent);
        console.log('[expo-splash-screen2] Created splashscreen_logo.xml for dark mode');
      } else {
        console.warn(`[expo-splash-screen2] Dark image file not found: ${darkSourcePath}`);
      }
    }
  } catch (error) {
    console.error(`[expo-splash-screen2] Error creating splashscreen_logo for normal mode: ${error}`);
  }
}

/**
 * Create background drawable XML (includes centered icon)
 */
function createBackgroundDrawable(
  androidResPath: string,
  backgroundColor: string
): void {
  const drawableDir = path.join(androidResPath, 'res', 'drawable');
  if (!fs.existsSync(drawableDir)) {
    fs.mkdirSync(drawableDir, { recursive: true });
  }

  const xmlPath = path.join(drawableDir, 'splash_html_background.xml');
  const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <color android:color="${backgroundColor}" />
    </item>
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash_icon" />
    </item>
</layer-list>
`;

    try {
      fs.writeFileSync(xmlPath, xmlContent);
    } catch (error) {
      console.error(`[expo-splash-screen2] Error creating background drawable: ${error}`);
    }
}

/**
 * Remove hash from filename (e.g., top.69f4b826e4179e7f210f17d37f6d128d.png -> top.png)
 */
function removeHashFromFileName(fileName: string): string {
  // Match format: name.hash.ext (hash is 32-digit hexadecimal string)
  const hashPattern = /^(.+)\.([0-9a-f]{32,})\.([^.]+)$/i;
  const match = fileName.match(hashPattern);
  if (match) {
    return `${match[1]}.${match[3]}`;
  }
  return fileName;
}

/**
 * Extract all image paths from HTML content (returns original path string and corresponding absolute path)
 * Supports filenames with hash (e.g., top.69f4b826e4179e7f210f17d37f6d128d.png)
 */
function extractImagePaths(htmlContent: string, htmlDir: string): Array<{ original: string; absolute: string }> {
  const imagePaths: Array<{ original: string; absolute: string }> = [];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
  const seen = new Set<string>();
  
  // Match <img src="..."> tags
  const imgSrcRegex = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = imgSrcRegex.exec(htmlContent)) !== null) {
    const imagePath = match[1];
    if (imagePath && !imagePath.startsWith('http') && !imagePath.startsWith('data:') && !seen.has(imagePath)) {
      seen.add(imagePath);
      // Convert to absolute path
      let absolutePath: string;
      if (path.isAbsolute(imagePath)) {
        absolutePath = imagePath;
      } else if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
        absolutePath = path.resolve(htmlDir, imagePath);
      } else {
        absolutePath = path.resolve(htmlDir, imagePath);
      }
      
      // If file doesn't exist, try removing hash from filename
      if (!fs.existsSync(absolutePath)) {
        const fileName = path.basename(absolutePath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        if (fileNameWithoutHash !== fileName) {
          const dir = path.dirname(absolutePath);
          const newPath = path.join(dir, fileNameWithoutHash);
          if (fs.existsSync(newPath)) {
            absolutePath = newPath;
          }
        }
      }
      
      imagePaths.push({ original: imagePath, absolute: absolutePath });
    }
  }
  
  // Match url() references in CSS
  const urlRegex = /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((match = urlRegex.exec(htmlContent)) !== null) {
    const imagePath = match[1];
    if (imagePath && !imagePath.startsWith('http') && !imagePath.startsWith('data:') && !seen.has(imagePath)) {
      // Check if it's an image file
      const lowerPath = imagePath.toLowerCase();
      if (imageExtensions.some(ext => lowerPath.includes(ext))) {
        seen.add(imagePath);
        // Convert to absolute path
        let absolutePath: string;
        if (path.isAbsolute(imagePath)) {
          absolutePath = imagePath;
        } else if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
          absolutePath = path.resolve(htmlDir, imagePath);
        } else {
          absolutePath = path.resolve(htmlDir, imagePath);
        }
        
        // If file doesn't exist, try removing hash from filename
        if (!fs.existsSync(absolutePath)) {
          const fileName = path.basename(absolutePath);
          const fileNameWithoutHash = removeHashFromFileName(fileName);
          if (fileNameWithoutHash !== fileName) {
            const dir = path.dirname(absolutePath);
            const newPath = path.join(dir, fileNameWithoutHash);
            if (fs.existsSync(newPath)) {
              absolutePath = newPath;
            }
          }
        }
        
        imagePaths.push({ original: imagePath, absolute: absolutePath });
      }
    }
  }
  
  // Match image paths in JavaScript code (e.g., "./assets/expo-splash-web/src/images/top.69f4b826e4179e7f210f17d37f6d128d.png")
  const jsImageRegex = /(["'])(\.\/assets\/[^"']+\.(png|jpg|jpeg|gif|svg|webp|ico))(["'])/gi;
  while ((match = jsImageRegex.exec(htmlContent)) !== null) {
    const imagePath = match[2];
    if (imagePath && !seen.has(imagePath)) {
      seen.add(imagePath);
      let absolutePath: string;
      if (path.isAbsolute(imagePath)) {
        absolutePath = imagePath;
      } else {
        absolutePath = path.resolve(htmlDir, imagePath);
      }
      
      // If file doesn't exist, try removing hash from filename
      if (!fs.existsSync(absolutePath)) {
        const fileName = path.basename(absolutePath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        if (fileNameWithoutHash !== fileName) {
          const dir = path.dirname(absolutePath);
          const newPath = path.join(dir, fileNameWithoutHash);
          if (fs.existsSync(newPath)) {
            absolutePath = newPath;
          }
        }
      }
      
      imagePaths.push({ original: imagePath, absolute: absolutePath });
    }
  }
  
  // Scan assets directory, find all image files (including those with hash)
  const assetsDir = path.join(htmlDir, 'assets');
  if (fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory()) {
    const scanDir = (dir: string, relativePath: string = '') => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativeFilePath = path.join(relativePath, entry.name).replace(/\\/g, '/');
          
          if (entry.isDirectory()) {
            scanDir(fullPath, relativeFilePath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (imageExtensions.includes(ext)) {
              const originalPath = `./assets/${relativeFilePath}`;
              if (!seen.has(originalPath)) {
                seen.add(originalPath);
                imagePaths.push({ original: originalPath, absolute: fullPath });
              }
            }
          }
        }
      } catch (error) {
        // Ignore errors, continue scanning
      }
    };
    scanDir(assetsDir);
  }
  
  return imagePaths;
}

/**
 * Copy image file to Android assets directory
 */
function copyImageFile(
  sourceImagePath: string,
  targetAssetsDir: string,
  relativePath: string
): boolean {
  try {
    if (!fs.existsSync(sourceImagePath)) {
      console.warn(`[expo-splash-screen2] Image file not found: ${sourceImagePath}`);
      return false;
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetAssetsDir)) {
      fs.mkdirSync(targetAssetsDir, { recursive: true });
    }

    // Get filename
    const fileName = path.basename(relativePath);
    const targetPath = path.join(targetAssetsDir, fileName);

    // Copy file
    fs.copyFileSync(sourceImagePath, targetPath);
    return true;
  } catch (error) {
    console.error(`[expo-splash-screen2] Error copying image file ${sourceImagePath}:`, error);
    return false;
  }
}

/**
 * Copy HTML file to Android assets directory and process referenced images
 */
function copyHtmlFile(
  projectRoot: string,
  androidMainPath: string,
  localHtmlPath: string
): void {
  try {
    console.log(`[expo-splash-screen2] [Android] copyHtmlFile called`);
    console.log(`[expo-splash-screen2] [Android] projectRoot: ${projectRoot}`);
    console.log(`[expo-splash-screen2] [Android] localHtmlPath: ${localHtmlPath}`);
    
    const sourcePath = path.resolve(projectRoot, localHtmlPath);
    console.log(`[expo-splash-screen2] [Android] sourcePath: ${sourcePath}`);
    
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[expo-splash-screen2] [Android] HTML file not found: ${sourcePath}`);
      return;
    }

    const targetDir = path.join(androidMainPath, 'assets');
    console.log(`[expo-splash-screen2] [Android] targetDir: ${targetDir}`);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Read HTML content
    const htmlContent = fs.readFileSync(sourcePath, 'utf-8');
    const htmlDir = path.dirname(sourcePath);
    console.log(`[expo-splash-screen2] [Android] htmlDir: ${htmlDir}`);
    
    // Extract all image paths (from HTML tags and CSS)
    const imagePaths = extractImagePaths(htmlContent, htmlDir);
    console.log(`[expo-splash-screen2] [Android] extractImagePaths found: ${imagePaths.length} images`);
    imagePaths.forEach(({ original, absolute }) => {
      console.log(`[expo-splash-screen2] [Android]   - original: ${original}, absolute: ${absolute}`);
    });
    
    // Check if HTML file directory has assets subdirectory (built image directory)
    const assetsDir = path.join(htmlDir, 'assets');
    console.log(`[expo-splash-screen2] [Android] checking assetsDir: ${assetsDir}`);
    console.log(`[expo-splash-screen2] [Android] assetsDir exists: ${fs.existsSync(assetsDir)}`);
    
    if (fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory()) {
      // Read all image files from assets directory
      const allFiles = fs.readdirSync(assetsDir);
      console.log(`[expo-splash-screen2] [Android] assetsDir all files: ${allFiles.join(', ')}`);
      
      const imageFiles = allFiles.filter(f => 
        /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f)
      );
      console.log(`[expo-splash-screen2] [Android] assetsDir image files: ${imageFiles.join(', ')}`);
      
      imageFiles.forEach(imgFile => {
        const srcPath = path.join(assetsDir, imgFile);
        const absolutePath = srcPath;
        // Add to imagePaths, use ./assets/ as original path
        imagePaths.push({ original: `./assets/${imgFile}`, absolute: absolutePath });
        console.log(`[expo-splash-screen2] [Android] added from assets: ./assets/${imgFile} -> ${absolutePath}`);
      });
    }
    
    // Compatibility: also check images subdirectory
    const imagesDir = path.join(htmlDir, 'images');
    console.log(`[expo-splash-screen2] [Android] checking imagesDir: ${imagesDir}`);
    console.log(`[expo-splash-screen2] [Android] imagesDir exists: ${fs.existsSync(imagesDir)}`);
    
    if (fs.existsSync(imagesDir) && fs.statSync(imagesDir).isDirectory()) {
      const imageFiles = fs.readdirSync(imagesDir).filter(f => 
        /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f)
      );
      console.log(`[expo-splash-screen2] [Android] imagesDir image files: ${imageFiles.join(', ')}`);
      
      imageFiles.forEach(imgFile => {
        const srcPath = path.join(imagesDir, imgFile);
        const absolutePath = srcPath;
        imagePaths.push({ original: `./images/${imgFile}`, absolute: absolutePath });
      });
    }
    
    console.log(`[expo-splash-screen2] [Android] total imagePaths after scanning: ${imagePaths.length}`);
    
    // Create image path mapping (original path -> new path)
    const imagePathMap = new Map<string, string>();
    
    // Copy image files and update path mapping (remove hash)
    imagePaths.forEach(({ original, absolute }) => {
      // Remove hash from filename (e.g., top.69f4b826e4179e7f210f17d37f6d128d.png -> top.png)
      const fileNameWithHash = path.basename(absolute);
      const fileNameWithoutHash = removeHashFromFileName(fileNameWithHash);
      const newPath = `./${fileNameWithoutHash}`;
      console.log(`[expo-splash-screen2] [Android] processing: ${original} -> ${newPath} (file: ${absolute})`);
      
      // Copy image to assets directory (using filename without hash)
      if (copyImageFile(absolute, targetDir, fileNameWithoutHash)) {
        // Update path mapping: original path (may have hash) -> new path (without hash)
        // Handle various possible path formats
        imagePathMap.set(original, newPath);
        
        // Normalize path format (remove ./ prefix if exists)
        const normalizedOriginal = original.startsWith('./') ? original : `./${original}`;
        imagePathMap.set(normalizedOriginal, newPath);
        
        // Also handle cases without ./
        if (original.startsWith('./')) {
          imagePathMap.set(original.substring(2), newPath);
        }
        
        // Handle ./images/ path format
        if (original.startsWith('./images/')) {
          imagePathMap.set(original, newPath);
          imagePathMap.set(original.substring(2), newPath); // Remove ./
          imagePathMap.set(original.substring(10), newPath); // Remove ./images/
        }
        
        // Handle ./assets/ path format (expo export generated path)
        if (original.startsWith('./assets/')) {
          imagePathMap.set(original, newPath);
          imagePathMap.set(original.substring(2), newPath); // Remove ./
          // Also match filenames with hash
          const originalFileName = path.basename(original);
          if (originalFileName !== fileNameWithoutHash) {
            imagePathMap.set(original.replace(originalFileName, fileNameWithoutHash), newPath);
          }
        }
      }
    });
    
    // Update image paths in HTML content
    let updatedHtmlContent = htmlContent;
    
    // Update paths in <img src="..."> tags
    updatedHtmlContent = updatedHtmlContent.replace(
      /<img([^>]+)src\s*=\s*["']([^"']+)["']/gi,
      (match, attrs, srcPath) => {
        if (srcPath.startsWith('http') || srcPath.startsWith('data:')) {
          return match; // Skip network images and base64 images
        }
        const newPath = imagePathMap.get(srcPath) || imagePathMap.get(`./${srcPath}`) || imagePathMap.get(srcPath.replace(/^\.\//, ''));
        if (newPath) {
          return `<img${attrs}src="${newPath}"`;
        }
        return match;
      }
    );
    
    // Update url() references in CSS
    updatedHtmlContent = updatedHtmlContent.replace(
      /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi,
      (match, urlPath) => {
        if (urlPath.startsWith('http') || urlPath.startsWith('data:')) {
          return match; // Skip network images and base64 images
        }
        // Check if it's an image file
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
        const lowerPath = urlPath.toLowerCase();
        if (!imageExtensions.some(ext => lowerPath.includes(ext))) {
          return match; // Not an image file, skip
        }
        const newPath = imagePathMap.get(urlPath) || imagePathMap.get(`./${urlPath}`) || imagePathMap.get(urlPath.replace(/^\.\//, ''));
        if (newPath) {
          return `url("${newPath}")`;
        }
        return match;
      }
    );
    
    // Update image paths in JavaScript code (match "./images/xxx.png" or './images/xxx.png' or "/images/xxx.png")
    updatedHtmlContent = updatedHtmlContent.replace(
      /(["'])(\.\/images\/[^"']+\.(png|jpg|jpeg|gif|svg|webp|ico))(["'])/gi,
      (match, quote1, imgPath, ext, quote2) => {
        const fileName = path.basename(imgPath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        const newPath = imagePathMap.get(`./images/${fileName}`) || 
                       imagePathMap.get(`./images/${fileNameWithoutHash}`) || 
                       imagePathMap.get(`./${fileName}`) || 
                       imagePathMap.get(`./${fileNameWithoutHash}`) || 
                       `./${fileNameWithoutHash}`;
        return `${quote1}${newPath}${quote2}`;
      }
    );
    
    // Update image paths in JavaScript code (match "./assets/xxx.png" format, expo export generated path)
    updatedHtmlContent = updatedHtmlContent.replace(
      /(["'])(\.\/assets\/[^"']+\.(png|jpg|jpeg|gif|svg|webp|ico))(["'])/gi,
      (match, quote1, imgPath, ext, quote2) => {
        const fileName = path.basename(imgPath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        const newPath = imagePathMap.get(imgPath) || 
                       imagePathMap.get(`./assets/${imgPath.substring(2)}`) ||
                       `./${fileNameWithoutHash}`;
        return `${quote1}${newPath}${quote2}`;
      }
    );
    
    // Also match paths without quotes (in JavaScript code)
    updatedHtmlContent = updatedHtmlContent.replace(
      /(\.\/images\/[^\s"'`;,\)]+\.(png|jpg|jpeg|gif|svg|webp|ico))/gi,
      (match, imgPath) => {
        const fileName = path.basename(imgPath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        const newPath = imagePathMap.get(`./images/${fileName}`) || 
                       imagePathMap.get(`./images/${fileNameWithoutHash}`) || 
                       imagePathMap.get(`./${fileName}`) || 
                       imagePathMap.get(`./${fileNameWithoutHash}`) || 
                       `./${fileNameWithoutHash}`;
        return newPath;
      }
    );
    
    // Also match assets paths without quotes
    updatedHtmlContent = updatedHtmlContent.replace(
      /(\.\/assets\/[^\s"'`;,\)]+\.(png|jpg|jpeg|gif|svg|webp|ico))/gi,
      (match, imgPath) => {
        const fileName = path.basename(imgPath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        const newPath = imagePathMap.get(imgPath) || 
                       imagePathMap.get(`./assets/${imgPath.substring(2)}`) ||
                       `./${fileNameWithoutHash}`;
        return newPath;
      }
    );

    // Write updated HTML file
    const targetPath = path.join(targetDir, 'index.html');
    fs.writeFileSync(targetPath, updatedHtmlContent, 'utf-8');
  } catch (error) {
    console.error(`[expo-splash-screen2] Error copying HTML file: ${error}`);
  }
}

/**
 * Generate SplashScreen2Activity.kt file
 */
function generateCustomSplashActivity(
  packageName: string,
  projectRoot: string,
  androidMainPath: string,
  backgroundColor: string
): void {
  const javaDir = path.join(
    androidMainPath,
    'java',
    ...packageName.split('.')
  );

  if (!fs.existsSync(javaDir)) {
    fs.mkdirSync(javaDir, { recursive: true });
  }

  const activityPath = path.join(javaDir, `SplashScreen2Activity.kt`);

  // Use template to replace hardcoded strings
  const activityContent = replaceTemplatePlaceholders(ANDROID_TEMPLATES.customSplashActivity, {
    packageName,
    activityName: CUSTOM_SPLASH_ACTIVITY_NAME,
    backgroundColor,
  });

  try {
    fs.writeFileSync(activityPath, activityContent);
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to generate SplashScreen2Activity.kt:`, error);
    throw error;
  }
}

/**
 * Generate SplashScreen2Activity.kt file for Blend mode (WebView container background uses .9 image)
 */
function generateCustomSplashActivityForBlendMode(
  packageName: string,
  projectRoot: string,
  androidMainPath: string,
  imageResourceName: string
): void {
  const javaDir = path.join(
    androidMainPath,
    'java',
    ...packageName.split('.')
  );

  if (!fs.existsSync(javaDir)) {
    fs.mkdirSync(javaDir, { recursive: true });
  }

  const activityPath = path.join(javaDir, `SplashScreen2Activity.kt`);

  // Use template and modify WebView container background to use .9 image
  let activityContent = replaceTemplatePlaceholders(ANDROID_TEMPLATES.customSplashActivity, {
    packageName,
    activityName: CUSTOM_SPLASH_ACTIVITY_NAME,
    backgroundColor: '#ffffff', // Not used in blend mode, but required by template
  });

  // Replace WebView container background setting: set .9 image as background
  // Find the webViewContainer creation code and add background image setting
  // Match up to fitsSystemWindows = false, then insert code before the closing brace of .apply {}
  const containerBackgroundPattern = /(webViewContainer = object : ViewGroup\(this\) \{[\s\S]*?fitsSystemWindows = false\s*)(\})/;
  const backgroundImageCode = `$1
        // Set background to .9 patch image for blend mode, ensure consistency with system splash screen
        try {
          val drawable = resources.getDrawable(
            resources.getIdentifier("${imageResourceName}", "drawable", packageName),
            null
          )
          this.background = drawable
        } catch (e: Exception) {
          Log.e("${CUSTOM_SPLASH_ACTIVITY_NAME}", "Error setting background drawable", e)
        }
      $2`;
  
  activityContent = activityContent.replace(containerBackgroundPattern, backgroundImageCode);

  try {
    fs.writeFileSync(activityPath, activityContent);
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to generate SplashScreen2Activity.kt for blend mode:`, error);
    throw error;
  }
}

/**
 * Copy backgroundImage to Android resource directory
 * Preserve .9 suffix to ensure .9 patch format works in Android native
 */
function copyBackgroundImage(
  projectRoot: string,
  backgroundImagePath: string,
  androidMainPath: string
): string | null {
  try {
    const sourcePath = path.resolve(projectRoot, backgroundImagePath);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[expo-splash-screen2] Background image file not found: ${sourcePath}`);
      return null;
    }

    const drawableDir = path.join(androidMainPath, 'res', 'drawable-xxhdpi');
    if (!fs.existsSync(drawableDir)) {
      fs.mkdirSync(drawableDir, { recursive: true });
    }

    // Get filename and extension
    const sourceFileName = path.basename(sourcePath);
    const sourceExt = path.extname(sourcePath).toLowerCase();
    const sourceNameWithoutExt = path.basename(sourcePath, sourceExt);
    
    // Check if it's a .9 patch image (filename contains .9)
    const isNinePatch = sourceNameWithoutExt.endsWith('.9');
    
    // If source file is .9 patch, preserve .9 suffix
    // Example: cover_image.9.png -> splash_background_image.9.png
    // If not .9 patch, normal processing: cover_image.png -> splash_background_image.png
    let targetFileName: string;
    if (isNinePatch) {
      // Remove .9 suffix, then add splash_background_image.9
      const nameWithoutNine = sourceNameWithoutExt.replace(/\.9$/, '');
      targetFileName = 'splash_background_image.9' + sourceExt;
    } else {
      targetFileName = 'splash_background_image' + sourceExt;
    }
    
    const targetPath = path.join(drawableDir, targetFileName);

    // Copy file
    fs.copyFileSync(sourcePath, targetPath);
    
    // Return resource name (without extension, but preserve .9 suffix)
    // Android resource reference uses @drawable/splash_background_image (will automatically recognize .9 suffix)
    return 'splash_background_image';
  } catch (error) {
    console.error(`[expo-splash-screen2] Error copying background image: ${error}`);
    return null;
  }
}

/**
 * Modify MainActivity.kt, add ImageView container logic for image background mode
 */
function modifyMainActivityForImageMode(
  content: string,
  packageName: string,
  imageResourceName: string
): string {
  // Check if image container related code already exists
  if (content.includes('splashImageViewContainer') || content.includes('setupSplashImageView')) {
    return content;
  }

  const classMatch = content.match(/class\s+MainActivity\s*[^:]*:/);
  if (!classMatch) {
    console.warn('[expo-splash-screen2] MainActivity class not found');
    return content;
  }

  // Add necessary imports
  const importsToAdd = `
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.graphics.drawable.Drawable`;
  
  // Check if these imports are already included (check all imports that need to be added)
  let hasImports = content.includes('import android.os.Handler') &&
                   content.includes('import android.os.Looper') &&
                   content.includes('import android.view.View') &&
                   content.includes('import android.view.ViewGroup') &&
                   content.includes('import android.widget.ImageView') &&
                   content.includes('import android.graphics.drawable.Drawable');
  
  let modifiedContent = content;
  
  // Add imports (only add missing imports)
  if (!hasImports) {
    // Check each import if it already exists, only add missing ones
    const importsToAddList = [
      'import android.os.Handler',
      'import android.os.Looper',
      'import android.view.View',
      'import android.view.ViewGroup',
      'import android.widget.ImageView',
      'import android.graphics.drawable.Drawable'
    ];
    
    const missingImports = importsToAddList.filter(imp => !content.includes(imp));
    
    if (missingImports.length > 0) {
      const lastImportIndex = modifiedContent.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const nextLineIndex = modifiedContent.indexOf('\n', lastImportIndex);
        if (nextLineIndex !== -1) {
          const missingImportsText = missingImports.join('\n') + '\n';
          modifiedContent = modifiedContent.substring(0, nextLineIndex + 1) +
                           missingImportsText +
                           modifiedContent.substring(nextLineIndex + 1);
        }
      }
    }
  }

  // Add image container related properties and methods
  const imageViewCode = `
  private var splashImageViewContainer: ViewGroup? = null
  private var preventAutoHide = false
  
  private fun setupSplashImageView() {
    try {
      // If container already exists, return directly
      if (splashImageViewContainer != null) {
        android.util.Log.d("MainActivity", "Splash ImageView container already exists")
        return
      }
      
      android.util.Log.d("MainActivity", "Creating splash ImageView container")
      
      // Create container
      splashImageViewContainer = object : ViewGroup(this) {
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
        // Set background to .9 patch image, ensure consistency with system splash screen
        try {
          val drawable = resources.getDrawable(
            resources.getIdentifier("${imageResourceName}", "drawable", packageName),
            null
          )
          background = drawable
        } catch (e: Exception) {
          android.util.Log.e("MainActivity", "Error setting background drawable", e)
        }
      }
      
      // Create ImageView, display .9 patch background
      // Use FIT_XY scaleType to ensure .9 patch correctly stretches and fills, completely consistent with system splash screen
      val imageView = ImageView(this).apply {
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        // For .9 patch images, use FIT_XY to ensure complete fill, .9 patch stretch areas will work correctly
        scaleType = ImageView.ScaleType.FIT_XY
        try {
          val drawable = resources.getDrawable(
            resources.getIdentifier("${imageResourceName}", "drawable", packageName),
            null
          )
          setImageDrawable(drawable)
        } catch (e: Exception) {
          android.util.Log.e("MainActivity", "Error setting image drawable", e)
        }
        visibility = View.VISIBLE
      }
      
      splashImageViewContainer?.addView(imageView)
      
      // Use window.decorView to ensure on top layer
      val decorView = window.decorView as? ViewGroup
      if (decorView != null) {
        decorView.addView(splashImageViewContainer)
        splashImageViewContainer?.bringToFront()
        splashImageViewContainer?.visibility = View.VISIBLE
        splashImageViewContainer?.elevation = Float.MAX_VALUE // Ensure on top layer
        android.util.Log.d("MainActivity", "Splash ImageView container added to decorView")
      }
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error creating splash ImageView container", e)
    }
  }
  
  fun preventAutoHide() {
    preventAutoHide = true
    android.util.Log.d("MainActivity", "preventAutoHide called, preventAutoHide: $preventAutoHide")
  }
  
  fun hideSplashImageViewContainer(force: Boolean = false) {
    try {
      // If preventAutoHide is true and not force hide, don't execute hide operation
      if (preventAutoHide && !force) {
        android.util.Log.d("MainActivity", "hideSplashImageViewContainer prevented by preventAutoHide flag")
        return
      }
      
      val parent = splashImageViewContainer?.parent as? ViewGroup
      parent?.removeView(splashImageViewContainer)
      
      splashImageViewContainer?.visibility = View.GONE
      splashImageViewContainer?.removeAllViews()
      splashImageViewContainer = null
      preventAutoHide = false
      android.util.Log.d("MainActivity", "Splash ImageView container hidden")
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error hiding splash ImageView container", e)
    }
  }`;

  // Add setupSplashImageView call in onCreate
  const onCreateMatch = modifiedContent.match(/override\s+fun\s+onCreate\s*\([^)]*\)\s*\{/);
  if (onCreateMatch) {
    const onCreateIndex = modifiedContent.indexOf(onCreateMatch[0]);
    
    // Use smarter method to find onCreate method end position (match nested braces)
    let braceCount = 0;
    let onCreateEndIndex = onCreateIndex + onCreateMatch[0].length;
    let foundStart = false;
    
    for (let i = onCreateIndex; i < modifiedContent.length; i++) {
      if (modifiedContent[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (modifiedContent[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          onCreateEndIndex = i + 1;
          break;
        }
      }
    }
    
    const onCreateContent = modifiedContent.substring(onCreateIndex, onCreateEndIndex);
    
    if (!onCreateContent.includes('setupSplashImageView')) {
      // Add setupSplashImageView call after super.onCreate
      const superOnCreateIndex = onCreateContent.indexOf('super.onCreate');
      if (superOnCreateIndex !== -1) {
        const superOnCreateEndIndex = onCreateContent.indexOf('\n', superOnCreateIndex);
        if (superOnCreateEndIndex !== -1) {
          const setupCall = `
    // Immediately show background image ImageView container in onCreate
    Handler(Looper.getMainLooper()).post {
      setupSplashImageView()
    }`;
          
          modifiedContent = modifiedContent.substring(0, onCreateIndex + superOnCreateEndIndex + 1) +
                           setupCall + '\n' +
                           modifiedContent.substring(onCreateIndex + superOnCreateEndIndex + 1);
        }
      }
    }
  }

  const classIndex = modifiedContent.indexOf(classMatch[0]) + classMatch[0].length;
  const firstMethodMatch = modifiedContent.substring(classIndex).match(/\s+(override\s+)?fun\s+/);

  if (firstMethodMatch) {
    const insertIndex = classIndex + firstMethodMatch.index!;
    return (
      modifiedContent.substring(0, insertIndex) +
      imageViewCode +
      '\n' +
      modifiedContent.substring(insertIndex)
    );
  } else {
    const lastBraceIndex = modifiedContent.lastIndexOf('}');
    return (
      modifiedContent.substring(0, lastBraceIndex) +
      imageViewCode +
      '\n' +
      modifiedContent.substring(lastBraceIndex)
    );
  }
}

/**
 * Modify MainActivity.kt, add fixed-width image container logic for Normal mode (with main thread protection and dark mode support)
 */
function modifyMainActivityForNormalMode(
  content: string,
  packageName: string,
  backgroundColor: string,
  imageWidth: number,
  hasDarkMode: boolean = false,
  darkBackgroundColor: string = ''
): string {
  // Check if complete Normal mode code already exists (including dark mode support)
  const hasBasicCode = content.includes('splashNormalImageContainer') && content.includes('setupSplashNormalImage');
  const hasDarkModeCode = content.includes('isDarkMode()') && content.includes('getCurrentBackgroundColor()');
  const hasOnMeasure = content.includes('override fun onMeasure');
  const hasPostInit = content.includes('window.decorView.post');
  
  // If complete code already exists (including dark mode, onMeasure, post initialization), skip
  if (hasBasicCode && (!hasDarkMode || hasDarkModeCode) && hasOnMeasure && hasPostInit) {
    console.log('[expo-splash-screen2] MainActivity already has complete Normal mode code, skipping');
    return content;
  }
  
  // If old code exists but missing new features, need to remove old code first
  if (hasBasicCode) {
    console.log('[expo-splash-screen2] Removing old Normal mode code to inject updated version...');
    // Remove old splashNormalImageContainer related code
    content = content.replace(/\s*private var splashNormalImageContainer[\s\S]*?hideSplashImageViewContainerInternal[\s\S]*?\}\s*\}/m, '');
    // Remove old onWindowFocusChanged if exists
    content = content.replace(/\s*override fun onWindowFocusChanged[\s\S]*?\}\s*\}/m, '');
    // Remove old dark mode related functions
    content = content.replace(/\s*private fun isDarkMode[\s\S]*?\}\s*\}/m, '');
    content = content.replace(/\s*private fun getCurrentBackgroundColor[\s\S]*?\}\s*\}/m, '');
    content = content.replace(/\s*private fun updateSplashAppearance[\s\S]*?\}\s*\}/m, '');
    content = content.replace(/\s*override fun onConfigurationChanged[\s\S]*?\}\s*\}/m, '');
  }

  const classMatch = content.match(/class\s+MainActivity\s*[^:]*:/);
  if (!classMatch) {
    console.warn('[expo-splash-screen2] MainActivity class not found');
    return content;
  }

  // Add necessary imports
  const importsToAdd = [
    'import android.os.Handler',
    'import android.os.Looper',
    'import android.view.View',
    'import android.view.ViewGroup',
    'import android.widget.ImageView',
    'import android.graphics.drawable.Drawable',
    'import android.graphics.Color',
    'import android.content.res.Configuration',
    'import androidx.core.content.ContextCompat'
  ];
  
  let modifiedContent = content;
  
  // Check and add missing imports
  const missingImports = importsToAdd.filter(imp => !content.includes(imp));
  
  if (missingImports.length > 0) {
    const lastImportIndex = modifiedContent.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const nextLineIndex = modifiedContent.indexOf('\n', lastImportIndex);
      if (nextLineIndex !== -1) {
        const missingImportsText = missingImports.join('\n') + '\n';
        modifiedContent = modifiedContent.substring(0, nextLineIndex + 1) +
                         missingImportsText +
                         modifiedContent.substring(nextLineIndex + 1);
      }
    }
  }

  // Convert backgroundColor to hexadecimal color value
  const bgColorHex = backgroundColor.startsWith('#') ? backgroundColor : '#ffffff';
  const darkBgColorHex = darkBackgroundColor.startsWith('#') ? darkBackgroundColor : bgColorHex;

  // Generate dark mode related code
  const darkModeCode = hasDarkMode ? `
  // Detect if dark mode
  private fun isDarkMode(): Boolean {
    return (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
  }
  
  // Get background color corresponding to current mode
  private fun getCurrentBackgroundColor(): Int {
    return if (isDarkMode()) {
      Color.parseColor("${darkBgColorHex}")
    } else {
      Color.parseColor("${bgColorHex}")
    }
  }
  
  // Update splash container appearance (called when dark mode switches)
  private fun updateSplashAppearance() {
    splashNormalImageContainer?.let { container ->
      container.setBackgroundColor(getCurrentBackgroundColor())
      // Image resources will automatically load from drawable-night, but if already loaded need to manually update
      val imageView = container.getChildAt(0) as? ImageView
      imageView?.let {
        try {
          val drawable = resources.getDrawable(
            resources.getIdentifier("splash_icon", "drawable", packageName),
            null
          )
          it.setImageDrawable(drawable)
        } catch (e: Exception) {
          android.util.Log.e("MainActivity", "Error updating image drawable", e)
        }
      }
      android.util.Log.d("MainActivity", "Splash appearance updated for " + (if (isDarkMode()) "dark" else "light") + " mode")
    }
  }
  
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    // Listen to system theme changes, switch dark/light mode at runtime
    updateSplashAppearance()
  }
` : '';

  // Generate background color setting code
  const bgColorCode = hasDarkMode 
    ? 'setBackgroundColor(getCurrentBackgroundColor())'
    : `setBackgroundColor(Color.parseColor("${bgColorHex}"))`;

  // Add fixed-width image container related properties and methods (with main thread protection)
  const normalImageViewCode = `
  private var splashNormalImageContainer: ViewGroup? = null
  private var preventAutoHideNormal = false
  ${darkModeCode}
  private fun setupSplashNormalImage() {
    try {
      // If container already exists, return directly
      if (splashNormalImageContainer != null) {
        android.util.Log.d("MainActivity", "Splash Normal Image container already exists")
        return
      }
      
      android.util.Log.d("MainActivity", "Creating splash Normal Image container")
      
      // Create container, set background color
      splashNormalImageContainer = object : ViewGroup(this) {
        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
          super.onMeasure(widthMeasureSpec, heightMeasureSpec)
          // Measure all child views
          for (i in 0 until childCount) {
            val child = getChildAt(i)
            measureChild(child, widthMeasureSpec, heightMeasureSpec)
          }
        }
        
        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
          val childCount = childCount
          val width = r - l
          val height = b - t
          for (i in 0 until childCount) {
            val child = getChildAt(i)
            // Center ImageView
            val childWidth = child.measuredWidth
            val childHeight = child.measuredHeight
            val left = (width - childWidth) / 2
            val top = (height - childHeight) / 2
            child.layout(left, top, left + childWidth, top + childHeight)
          }
        }
      }.apply {
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        // Set background color${hasDarkMode ? ' (automatically select based on current mode)' : ''}
        ${bgColorCode}
        // Key: Let touch events pass through to bottom layer, don't block React Native initialization
        isClickable = false
        isFocusable = false
      }
      
      // Create ImageView, display fixed-width image
      val imageView = ImageView(this).apply {
        // Fixed width, height auto-adapts
        val density = resources.displayMetrics.density
        val widthInPx = (${imageWidth} * density).toInt()
        layoutParams = ViewGroup.LayoutParams(
          widthInPx,
          ViewGroup.LayoutParams.WRAP_CONTENT
        )
        scaleType = ImageView.ScaleType.FIT_CENTER
        adjustViewBounds = true
        
        // Load image resource
        var imageLoaded = false
        val appPackageName = applicationContext.packageName
        
        // Method 1: Try loading via getIdentifier (using applicationContext.packageName)
        try {
          val resId = resources.getIdentifier("splash_icon", "drawable", appPackageName)
          android.util.Log.d("MainActivity", "splash_icon resource ID: $resId, appPackageName: $appPackageName")
          if (resId != 0) {
            val drawable = ContextCompat.getDrawable(this@MainActivity, resId)
            if (drawable != null) {
              setImageDrawable(drawable)
              imageLoaded = true
              android.util.Log.d("MainActivity", "Image loaded via getIdentifier with appPackageName")
            }
          }
        } catch (e: Exception) {
          android.util.Log.e("MainActivity", "Error loading image via getIdentifier", e)
        }
        
        // Method 2: Try using mipmap (sometimes resources may be in mipmap)
        if (!imageLoaded) {
          try {
            val mipmapResId = resources.getIdentifier("splash_icon", "mipmap", appPackageName)
            android.util.Log.d("MainActivity", "splash_icon mipmap resource ID: $mipmapResId")
            if (mipmapResId != 0) {
              val drawable = ContextCompat.getDrawable(this@MainActivity, mipmapResId)
              if (drawable != null) {
                setImageDrawable(drawable)
                imageLoaded = true
                android.util.Log.d("MainActivity", "Image loaded from mipmap")
              }
            }
          } catch (e: Exception) {
            android.util.Log.d("MainActivity", "Image not found in mipmap: \${e.message}")
          }
        }
        
        // Method 3: Try loading from assets
        if (!imageLoaded) {
          try {
            val inputStream = assets.open("splash_icon.png")
            val bitmap = android.graphics.BitmapFactory.decodeStream(inputStream)
            inputStream.close()
            if (bitmap != null) {
              setImageBitmap(bitmap)
              imageLoaded = true
              android.util.Log.d("MainActivity", "Image loaded from assets")
            }
          } catch (e: Exception) {
            android.util.Log.d("MainActivity", "Image not found in assets: \${e.message}")
          }
        }
        
        if (!imageLoaded) {
          android.util.Log.e("MainActivity", "Failed to load splash_icon image from any source. Please run 'npx expo prebuild --clean' to regenerate resources.")
        }
        
        visibility = View.VISIBLE
      }
      
      splashNormalImageContainer?.addView(imageView)
      
      // Use window.decorView to ensure on top layer
      val decorView = window.decorView as? ViewGroup
      if (decorView != null) {
        decorView.addView(splashNormalImageContainer)
        splashNormalImageContainer?.bringToFront()
        splashNormalImageContainer?.visibility = View.VISIBLE
        splashNormalImageContainer?.elevation = Float.MAX_VALUE // Ensure on top layer
        android.util.Log.d("MainActivity", "Splash Normal Image container added to decorView")
      }
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error creating splash Normal Image container", e)
    }
  }
  
  fun preventAutoHide() {
    // Ensure execution on main thread
    if (Looper.myLooper() == Looper.getMainLooper()) {
      preventAutoHideNormal = true
      android.util.Log.d("MainActivity", "preventAutoHide called, preventAutoHideNormal: $preventAutoHideNormal")
    } else {
      runOnUiThread {
        preventAutoHideNormal = true
        android.util.Log.d("MainActivity", "preventAutoHide called, preventAutoHideNormal: $preventAutoHideNormal")
      }
    }
  }
  
  fun hideSplashImageViewContainer(force: Boolean = false) {
    // Ensure all UI operations execute on main thread
    if (Looper.myLooper() == Looper.getMainLooper()) {
      hideSplashImageViewContainerInternal(force)
    } else {
      runOnUiThread {
        hideSplashImageViewContainerInternal(force)
      }
    }
  }
  
  private fun hideSplashImageViewContainerInternal(force: Boolean = false) {
    try {
      // If preventAutoHideNormal is true and not force hide, don't execute hide operation
      if (preventAutoHideNormal && !force) {
        android.util.Log.d("MainActivity", "hideSplashImageViewContainer prevented by preventAutoHideNormal flag")
        return
      }
      
      val parent = splashNormalImageContainer?.parent as? ViewGroup
      parent?.removeView(splashNormalImageContainer)
      
      splashNormalImageContainer?.visibility = View.GONE
      splashNormalImageContainer?.removeAllViews()
      splashNormalImageContainer = null
      preventAutoHideNormal = false
      android.util.Log.d("MainActivity", "Splash Normal Image container hidden")
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error hiding splash Normal Image container", e)
    }
  }`;

  // Use post to delay initialize splash screen in onCreate
  // Avoid using onWindowFocusChanged (will conflict with React Native causing SoftException)
  const onCreateMatch = modifiedContent.match(/override\s+fun\s+onCreate\s*\([^)]*\)\s*\{[\s\S]*?super\.onCreate\([^)]*\)/);
  if (onCreateMatch && !modifiedContent.includes('setupSplashNormalImage')) {
    const splashInitCode = `
    
    // Use post to initialize splash screen when main thread is idle, avoid conflicts with React Native initialization
    window.decorView.post {
      if (splashNormalImageContainer == null) {
        setupSplashNormalImage()
      }
    }`;
    
    // Insert code after super.onCreate
    const insertPosition = modifiedContent.indexOf(onCreateMatch[0]) + onCreateMatch[0].length;
    modifiedContent = modifiedContent.substring(0, insertPosition) + 
                     splashInitCode + 
                     modifiedContent.substring(insertPosition);
  }

  // Find inside MainActivity class, add properties and methods
  const classIndex = modifiedContent.indexOf(classMatch[0]) + classMatch[0].length;
  const afterClass = modifiedContent.substring(classIndex);
  
  const firstMethodMatch = afterClass.match(/(override|fun|var|val|private|public|protected|internal)/);
  
  if (firstMethodMatch) {
    const insertIndex = classIndex + firstMethodMatch.index!;
    return (
      modifiedContent.substring(0, insertIndex) +
      normalImageViewCode +
      '\n' +
      modifiedContent.substring(insertIndex)
    );
  } else {
    const lastBraceIndex = modifiedContent.lastIndexOf('}');
    return (
      modifiedContent.substring(0, lastBraceIndex) +
      normalImageViewCode +
      '\n' +
      modifiedContent.substring(lastBraceIndex)
    );
  }
}

/**
 * Modify MainActivity.kt, add actionStart static method and WebView container logic
 */
function modifyMainActivity(content: string, packageName: string, backgroundColor: string): string {
  const classMatch = content.match(/class\s+MainActivity\s*[^:]*:/);
  if (!classMatch) {
    console.warn('[expo-splash-screen2] MainActivity class not found');
    return content;
  }

  // Check if WebView container related code already exists
  const hasWebViewCode = content.includes('setupWebViewContainer') || content.includes('webViewContainer');
  const hasCompanionObject = content.includes('companion object') && content.includes('actionStart');

  // Add necessary imports
  const importsToAdd = `
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.WindowCompat`;
  
  // Check if these imports are already included (check all imports that need to be added)
  let hasImports = content.includes('import android.os.Build') &&
                   content.includes('import android.os.Handler') && 
                   content.includes('import android.os.Looper') &&
                   content.includes('import android.view.View') &&
                   content.includes('import android.view.ViewGroup') &&
                   content.includes('import android.webkit.WebView') &&
                   content.includes('import android.webkit.WebViewClient') &&
                   content.includes('import androidx.core.view.WindowCompat');
  
  let modifiedContent = content;
  
  // Add imports (only add missing imports)
  if (!hasImports) {
    // Check each import if it already exists, only add missing ones
    const importsToAddList = [
      'import android.os.Build',
      'import android.os.Handler',
      'import android.os.Looper',
      'import android.view.View',
      'import android.view.ViewGroup',
      'import android.webkit.WebView',
      'import android.webkit.WebViewClient',
      'import androidx.core.view.WindowCompat'
    ];
    
    const missingImports = importsToAddList.filter(imp => !content.includes(imp));
    
    if (missingImports.length > 0) {
      const lastImportIndex = modifiedContent.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const nextLineIndex = modifiedContent.indexOf('\n', lastImportIndex);
        if (nextLineIndex !== -1) {
          const missingImportsText = missingImports.join('\n') + '\n';
          modifiedContent = modifiedContent.substring(0, nextLineIndex + 1) +
                           missingImportsText +
                           modifiedContent.substring(nextLineIndex + 1);
        }
      }
    }
  }

  // Use template to replace hardcoded strings
  const companionObjectCode = ANDROID_TEMPLATES.mainActivityCompanionObject;

  // Use template to replace hardcoded strings
  const webViewCode = replaceTemplatePlaceholders(ANDROID_TEMPLATES.mainActivityWebViewCode, {
    backgroundColor,
  });

  // Remove setupWebViewContainer call in onCreate (if exists)
  // Also remove setTheme(R.style.AppTheme) call
  const onCreateMatch = modifiedContent.match(/override\s+fun\s+onCreate\s*\([^)]*\)\s*\{/);
  if (onCreateMatch) {
    const onCreateIndex = modifiedContent.indexOf(onCreateMatch[0]);
    
    // Use smarter method to find onCreate method end position (match nested braces)
    let braceCount = 0;
    let onCreateEndIndex = onCreateIndex + onCreateMatch[0].length;
    let foundStart = false;
    
    for (let i = onCreateIndex; i < modifiedContent.length; i++) {
      if (modifiedContent[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (modifiedContent[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          onCreateEndIndex = i + 1;
          break;
        }
      }
    }
    
    // Check if onCreate contains setupWebViewContainer call, remove if exists
    // onCreateContent contains complete content from method signature to closing brace
    const onCreateContent = modifiedContent.substring(onCreateIndex, onCreateEndIndex);
    let cleanedOnCreateContent = onCreateContent;
    
    if (onCreateContent.includes('setupWebViewContainer')) {
      // Remove setupWebViewContainer call (including Handler code block)
      const setupCallRegex = /(\s*\/\/\s*[^\n]*\n)?\s*Handler\([^}]*setupWebViewContainer\(\)[^}]*\}/g;
      cleanedOnCreateContent = cleanedOnCreateContent.replace(setupCallRegex, '');
    }
    
    // Remove setTheme(R.style.AppTheme) call and its comments
    // Match setTheme and its preceding comments (if any), but ensure it doesn't match method signature
    const setThemeRegex = /(\s*\/\/\s*[^\n]*\n)*\s*setTheme\s*\(\s*R\.style\.AppTheme\s*\)\s*;?\s*\n?/g;
    cleanedOnCreateContent = cleanedOnCreateContent.replace(setThemeRegex, '');
    
    if (cleanedOnCreateContent !== onCreateContent) {
      // Directly replace entire onCreate method content (including method signature)
      modifiedContent = modifiedContent.substring(0, onCreateIndex) + 
                       cleanedOnCreateContent + 
                       modifiedContent.substring(onCreateEndIndex);
    }
  }

  // Add setupWebViewContainer call in onCreate (use Handler.post to execute immediately)
  if (onCreateMatch) {
    const onCreateIndex = modifiedContent.indexOf(onCreateMatch[0]);
    
    // Use smarter method to find onCreate method end position (match nested braces)
    let braceCount = 0;
    let onCreateEndIndex = onCreateIndex + onCreateMatch[0].length;
    let foundStart = false;
    
    for (let i = onCreateIndex; i < modifiedContent.length; i++) {
      if (modifiedContent[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (modifiedContent[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          onCreateEndIndex = i + 1;
          break;
        }
      }
    }
    
    const onCreateContent = modifiedContent.substring(onCreateIndex, onCreateEndIndex);
    
    if (!onCreateContent.includes('setupWebViewContainer')) {
      // Add setupWebViewContainer call after super.onCreate
      const superOnCreateIndex = onCreateContent.indexOf('super.onCreate');
      if (superOnCreateIndex !== -1) {
        const superOnCreateEndIndex = onCreateContent.indexOf('\n', superOnCreateIndex);
        if (superOnCreateEndIndex !== -1) {
          // Use template to replace hardcoded strings
          const setupCall = ANDROID_TEMPLATES.mainActivityOnCreateCode;
          
          modifiedContent = modifiedContent.substring(0, onCreateIndex + superOnCreateEndIndex + 1) +
                           setupCall + '\n' +
                           modifiedContent.substring(onCreateIndex + superOnCreateEndIndex + 1);
        }
      }
    }
  }

  // No longer add WebView container related code in onResume
  // Remove WebView container logic in onResume to avoid container being shown again after being hidden
  const onResumeMatch = modifiedContent.match(/override\s+fun\s+onResume\s*\([^)]*\)\s*\{/);
  if (onResumeMatch) {
    // If onResume already exists, check if it contains setupWebViewContainer call
    const onResumeIndex = modifiedContent.indexOf(onResumeMatch[0]);
    
    // Use smarter method to find onResume method end position (match nested braces)
    let braceCount = 0;
    let onResumeEndIndex = onResumeIndex + onResumeMatch[0].length;
    let foundStart = false;
    
    for (let i = onResumeIndex; i < modifiedContent.length; i++) {
      if (modifiedContent[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (modifiedContent[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          onResumeEndIndex = i + 1;
          break;
        }
      }
    }
    
    const onResumeContent = modifiedContent.substring(onResumeIndex, onResumeEndIndex);
    
    // Remove all code related to webViewContainer
    if (onResumeContent.includes('setupWebViewContainer') || onResumeContent.includes('webViewContainer')) {
      // Remove setupWebViewContainer call and related logic
      let cleanedOnResumeContent = onResumeContent;
      // Remove if (webViewContainer == null) { setupWebViewContainer() } else { ... } block
      cleanedOnResumeContent = cleanedOnResumeContent.replace(/(\s*\/\/\s*[^\n]*\n)?\s*if\s*\(webViewContainer\s*==\s*null[^}]*\{[\s\S]*?setupWebViewContainer\(\)[\s\S]*?\}[\s\S]*?(else\s*\{[\s\S]*?\})?/g, '');
      // Remove individual webViewContainer related calls
      cleanedOnResumeContent = cleanedOnResumeContent.replace(/(\s*\/\/\s*[^\n]*\n)?\s*webViewContainer\?\.(bringToFront|elevation)[^\n]*\n/g, '');
      // Remove preventAutoHide related logs and logic
      cleanedOnResumeContent = cleanedOnResumeContent.replace(/(\s*\/\/\s*[^\n]*\n)?\s*android\.util\.Log\.d\("MainActivity",\s*"onResume:[^"]*"\)[^\n]*\n/g, '');
      
      modifiedContent = modifiedContent.substring(0, onResumeIndex) + 
                       cleanedOnResumeContent + 
                       modifiedContent.substring(onResumeIndex + onResumeContent.length);
    }
  }

  // Only add new code if WebView code doesn't exist
  if (!hasWebViewCode || !hasCompanionObject) {
  const classIndex = modifiedContent.indexOf(classMatch[0]) + classMatch[0].length;
  const firstMethodMatch = modifiedContent.substring(classIndex).match(/\s+(override\s+)?fun\s+/);

  if (firstMethodMatch) {
    const insertIndex = classIndex + firstMethodMatch.index!;
      modifiedContent = (
      modifiedContent.substring(0, insertIndex) +
      companionObjectCode +
      webViewCode +
      '\n' +
      modifiedContent.substring(insertIndex)
    );
  } else {
    const lastBraceIndex = modifiedContent.lastIndexOf('}');
      modifiedContent = (
      modifiedContent.substring(0, lastBraceIndex) +
      companionObjectCode +
      webViewCode +
      '\n' +
      modifiedContent.substring(lastBraceIndex)
    );
  }
  }

  // Delete background color setting code in createWebViewContainer (if exists)
  // First try looser matching (handle multi-line and nesting), because try-catch blocks may have nested if-else
  if (modifiedContent.includes('设置背景色为传入的 backgroundColor')) {
    // Use looser matching, match all content from comment start to catch block end
    // Match pattern: comment + try { ... } catch (e: Exception) { ... }
    const looseRegex = /(\s*\/\/\s*设置背景色为传入的 backgroundColor[\s\S]*?catch\s*\([^)]*\)\s*\{[\s\S]*?setBackgroundColor[\s\S]*?\})/g;
    modifiedContent = modifiedContent.replace(looseRegex, '');
    
    // If there's still residue, try more precise matching
    if (modifiedContent.includes('设置背景色为传入的 backgroundColor')) {
      // Match entire try-catch block, including comments, use non-greedy matching to handle nesting
      const backgroundColorRegex = /(\s*\/\/\s*设置背景色为传入的 backgroundColor[^\n]*\n\s*\/\/\s*将十六进制颜色转换为 Android Color[^\n]*\n\s*try\s*\{[\s\S]*?setBackgroundColor[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?setBackgroundColor[\s\S]*?\})/g;
      modifiedContent = modifiedContent.replace(backgroundColorRegex, '');
    }
  }

  return modifiedContent;
}

/**
 * Modify MainActivity.kt for Blend mode (WebView container background uses .9 image)
 */
function modifyMainActivityForBlendMode(content: string, packageName: string, imageResourceName: string): string {
  // Use modifyMainActivity as base, then modify WebView container background
  const baseContent = modifyMainActivity(content, packageName, '#ffffff'); // backgroundColor not used in blend mode
  
  // Modify WebView container background to use .9 image
  // Find the webViewContainer creation code in createWebViewContainer function
  // Match up to fitsSystemWindows = false, then insert code before the closing brace of .apply {}
  const containerPattern = /(webViewContainer = object : ViewGroup\(this\) \{[\s\S]*?fitsSystemWindows = false\s*)(\})/;
  
  if (containerPattern.test(baseContent)) {
    const backgroundImageCode = `$1
        // Set background to .9 patch image for blend mode, ensure consistency with system splash screen
        try {
          val drawable = resources.getDrawable(
            resources.getIdentifier("${imageResourceName}", "drawable", packageName),
            null
          )
          this.background = drawable
        } catch (e: Exception) {
          android.util.Log.e("MainActivity", "Error setting background drawable", e)
        }
      $2`;
    
    return baseContent.replace(containerPattern, backgroundImageCode);
  }
  
  return baseContent;
}

/**
 * Generate SplashScreen2PrivacyPolicyActivity.kt file
 */
function generatePrivacyPolicyActivity(
  packageName: string,
  projectRoot: string,
  androidMainPath: string
): void {
  const javaDir = path.join(
    androidMainPath,
    'java',
    ...packageName.split('.')
  );

  if (!fs.existsSync(javaDir)) {
    fs.mkdirSync(javaDir, { recursive: true });
  }

  const activityPath = path.join(javaDir, 'SplashScreen2PrivacyPolicyActivity.kt');

  // Use template to replace hardcoded strings
  const activityContent = replaceTemplatePlaceholders(ANDROID_TEMPLATES.privacyPolicyActivity, {
    packageName,
  });

  try {
    fs.writeFileSync(activityPath, activityContent, 'utf-8');
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to generate SplashScreen2PrivacyPolicyActivity.kt:`, error);
  }
}

/**
 * Modify AndroidManifest.xml for Blend mode (MainActivity uses Theme.App.SplashScreen)
 */
function modifyAndroidManifestForBlendMode(
  manifest: AndroidManifest,
  packageName: string
): AndroidManifest {
  const application = manifest.manifest.application?.[0];
  const mainApplication =
    application && typeof application === 'object' && 'activity' in application
      ? application
      : null;

  if (!mainApplication || !mainApplication.activity) {
    return manifest;
  }

  

  const mainActivityIndex = mainApplication.activity.findIndex((activity: any) => {
    const name = activity.$?.['android:name'];
    return (
      name === '.MainActivity' ||
      name === 'MainActivity' ||
      name?.endsWith('.MainActivity') ||
      name === `${packageName}.MainActivity`
    );
  });

  if (mainActivityIndex === -1) {
    console.warn('[expo-splash-screen2] MainActivity not found in AndroidManifest');
    return manifest;
  }

  const mainActivity = mainApplication.activity[mainActivityIndex];
  
  // Set MainActivity's theme to Theme.App.SplashScreen (for blend mode, use same theme as splash screen)
  if (mainActivity && mainActivity.$) {
    mainActivity.$['android:theme'] = '@style/Theme.App.SplashScreen';
  }

  const customSplashActivityIndex = mainApplication.activity.findIndex((activity: any) => {
    const name = activity.$?.['android:name'];
    return (
      name === `.SplashScreen2Activity` ||
      name === 'SplashScreen2Activity' ||
      name?.endsWith(`.SplashScreen2Activity`) ||
      name === `${packageName}.SplashScreen2Activity`
    );
  });

  const hasCustomSplash = customSplashActivityIndex !== -1;

  if (!hasCustomSplash) {
    const customSplashActivity: any = {
      $: {
        'android:name': `.SplashScreen2Activity`,
        'android:configChanges':
          'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode',
        'android:launchMode': 'singleTask',
        'android:windowSoftInputMode': 'adjustResize',
        'android:theme': '@style/Theme.App.SplashScreen',
        'android:exported': 'true' as any,
        'android:screenOrientation': 'portrait',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.LAUNCHER' } },
          ],
        },
      ],
    };

    // Remove MainActivity's LAUNCHER intent-filter to ensure SplashScreen2Activity is the launch Activity
    if (mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(
        (filter: any) => {
          const action = filter.action?.[0]?.$?.['android:name'];
          const category = filter.category?.[0]?.$?.['android:name'];
          return !(
            action === 'android.intent.action.MAIN' &&
            category === 'android.intent.category.LAUNCHER'
          );
        }
      );
    }

    mainApplication.activity.push(customSplashActivity);
  } else {
    const existingCustomSplashActivity = mainApplication.activity[customSplashActivityIndex];
    if (existingCustomSplashActivity && existingCustomSplashActivity.$) {
      existingCustomSplashActivity.$['android:theme'] = '@style/Theme.App.SplashScreen';
    }

    // Also remove MainActivity's LAUNCHER intent-filter if SplashScreen2Activity already exists
    // This ensures SplashScreen2Activity remains the launch Activity
    if (mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(
        (filter: any) => {
          const action = filter.action?.[0]?.$?.['android:name'];
          const category = filter.category?.[0]?.$?.['android:name'];
          return !(
            action === 'android.intent.action.MAIN' &&
            category === 'android.intent.category.LAUNCHER'
          );
        }
      );
    }
  }

  // Add SplashScreen2PrivacyPolicyActivity
  const hasPrivacyPolicy = mainApplication.activity.some((activity: any) => {
    const name = activity.$?.['android:name'];
    return (
      name === '.SplashScreen2PrivacyPolicyActivity' ||
      name === 'SplashScreen2PrivacyPolicyActivity' ||
      name?.endsWith('.SplashScreen2PrivacyPolicyActivity') ||
      name === `${packageName}.SplashScreen2PrivacyPolicyActivity`
    );
  });

  if (!hasPrivacyPolicy) {
    const privacyPolicyActivity: any = {
      $: {
        'android:name': '.SplashScreen2PrivacyPolicyActivity',
      },
    };
    

    mainApplication.activity.push(privacyPolicyActivity);
  }

  return manifest;
}

/**
 * Modify AndroidManifest.xml, set SplashScreen2Activity as launch Activity
 */
function modifyAndroidManifest(
  manifest: AndroidManifest,
  packageName: string
): AndroidManifest {
  const application = manifest.manifest.application?.[0];
  const mainApplication =
    application && typeof application === 'object' && 'activity' in application
      ? application
      : null;

  if (!mainApplication || !mainApplication.activity) {
    return manifest;
  }

  // Modify application's android:icon attribute
  // if (mainApplication.$) {
  //   mainApplication.$['android:icon'] = '@drawable/splashscreen_logo';
  // }

  const mainActivityIndex = mainApplication.activity.findIndex((activity: any) => {
    const name = activity.$?.['android:name'];
    return (
      name === '.MainActivity' ||
      name === 'MainActivity' ||
      name?.endsWith('.MainActivity') ||
      name === `${packageName}.MainActivity`
    );
  });

  if (mainActivityIndex === -1) {
    console.warn('[expo-splash-screen2] MainActivity not found in AndroidManifest');
    return manifest;
  }

  const mainActivity = mainApplication.activity[mainActivityIndex];
  
  // Set MainActivity's theme to Theme.App.MainActivity (using backgroundColor solid background)
  if (mainActivity && mainActivity.$) {
    mainActivity.$['android:theme'] = '@style/Theme.App.MainActivity';
  }

  const customSplashActivityIndex = mainApplication.activity.findIndex((activity: any) => {
    const name = activity.$?.['android:name'];
    return (
      name === `.SplashScreen2Activity` ||
      name === 'SplashScreen2Activity' ||
      name?.endsWith(`.SplashScreen2Activity`) ||
      name === `${packageName}.SplashScreen2Activity`
    );
  });

  const hasCustomSplash = customSplashActivityIndex !== -1;

  if (!hasCustomSplash) {
    const customSplashActivity: any = {
      $: {
        'android:name': `.SplashScreen2Activity`,
        'android:configChanges':
          'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode',
        'android:launchMode': 'singleTask',
        'android:windowSoftInputMode': 'adjustResize',
        'android:theme': '@style/Theme.App.SplashScreen',
        'android:exported': 'true' as any,
        'android:screenOrientation': 'portrait',
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'android.intent.action.MAIN',
              },
            },
          ],
          category: [
            {
              $: {
                'android:name': 'android.intent.category.LAUNCHER',
              },
            },
          ],
        },
      ],
    };

    if (mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(
        (filter: any) => {
          const action = filter.action?.[0]?.$?.['android:name'];
          const category = filter.category?.[0]?.$?.['android:name'];
          return !(
            action === 'android.intent.action.MAIN' &&
            category === 'android.intent.category.LAUNCHER'
          );
        }
      );
    }

    mainApplication.activity.push(customSplashActivity);
  } else {
    // If SplashScreen2Activity already exists, update its theme
    const existingCustomSplashActivity = mainApplication.activity[customSplashActivityIndex];
    if (existingCustomSplashActivity && existingCustomSplashActivity.$) {
      existingCustomSplashActivity.$['android:theme'] = '@style/Theme.App.SplashScreen';
    }
  }

  // Add SplashScreen2PrivacyPolicyActivity
  const hasPrivacyPolicy = mainApplication.activity.some((activity: any) => {
    const name = activity.$?.['android:name'];
    return (
      name === '.SplashScreen2PrivacyPolicyActivity' ||
      name === 'SplashScreen2PrivacyPolicyActivity' ||
      name?.endsWith('.SplashScreen2PrivacyPolicyActivity') ||
      name === `${packageName}.SplashScreen2PrivacyPolicyActivity`
    );
  });

  if (!hasPrivacyPolicy) {
    const privacyPolicyActivity: any = {
      $: {
        'android:name': '.SplashScreen2PrivacyPolicyActivity',
        'android:configChanges':
          'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode',
        'android:windowSoftInputMode': 'adjustResize',
        'android:theme': '@style/AppTheme',
        'android:exported': 'false' as any,
        'android:screenOrientation': 'portrait',
      },
    };

    mainApplication.activity.push(privacyPolicyActivity);
  }

  return manifest;
}

/**
 * Modify styles JSON (image mode) - use AndroidConfig.Resources API
 * Set Theme.App.SplashScreen's android:windowBackground directly to @drawable/splash_background_image
 */
function modifyStylesForImageMode(styles: any[]): any[] {
  const styleName = 'Theme.App.SplashScreen';
  const drawableName = 'splash_background_image';

  // Ensure styles is an array
  if (!Array.isArray(styles)) {
    styles = [];
  }

  // Find existing Theme.App.SplashScreen style
  const existingStyleIndex = styles.findIndex(
    (style) => style?.$?.name === styleName
  );

  const windowBackgroundItem = {
    $: { name: 'android:windowBackground' },
    _: `@drawable/${drawableName}`,
  };

  const statusBarColorItem = {
    $: { name: 'android:statusBarColor' },
    _: '#00000000',
  };

  if (existingStyleIndex > -1) {
    // If style exists, update or add windowBackground item
    const existingStyle = styles[existingStyleIndex];
    if (!existingStyle.item) {
      existingStyle.item = [];
    }

    // Find existing windowBackground item
    const windowBgIndex = existingStyle.item.findIndex(
      (item: any) => item.$?.name === 'android:windowBackground'
    );

    if (windowBgIndex > -1) {
      // Replace existing windowBackground
      existingStyle.item[windowBgIndex] = windowBackgroundItem;
    } else {
      // Add new windowBackground
      existingStyle.item.push(windowBackgroundItem);
    }

    // Find existing statusBarColor item
    const statusBarColorIndex = existingStyle.item.findIndex(
      (item: any) => item.$?.name === 'android:statusBarColor'
    );

    if (statusBarColorIndex > -1) {
      // Replace existing statusBarColor
      existingStyle.item[statusBarColorIndex] = statusBarColorItem;
    } else {
      // Add new statusBarColor
      existingStyle.item.push(statusBarColorItem);
    }
  } else {
    // If style doesn't exist, create new style
    const newStyle = {
      $: { name: styleName, parent: 'AppTheme' },
      item: [windowBackgroundItem, statusBarColorItem],
    };
    styles.push(newStyle);
  }

  return styles;
}


/**
 * Modify styles.xml, update Theme.App.SplashScreen's android:windowBackground
 * and add Theme.App.MainActivity theme, use backgroundColor as solid background
 */
function modifyStylesXml(content: string, backgroundColor: string = '#ffffff'): string {
  const styleName = 'Theme.App.SplashScreen';
  const drawableName = 'splashscreen_logo';

  // Find Theme.App.SplashScreen style
  // Use more precise regular expression, escape all dots
  const escapedStyleName = styleName.replace(/\./g, '\\.');
  const styleRegex = new RegExp(
    `(<style\\s+name="${escapedStyleName}"[^>]*>)([\\s\\S]*?)(<\\/style>)`,
    'i'
  );
  
  if (styleRegex.test(content)) {
    // Replace android:windowBackground and android:statusBarColor
    content = content.replace(
      styleRegex,
      (match, styleStart, styleContent, styleEnd) => {
        // Replace or add android:windowBackground
        // Use more robust regular expression, match cases that may include newlines and spaces
        const windowBackgroundRegex = /<item\s+name\s*=\s*["']android:windowBackground["']\s*>[\s\S]*?<\/item>/i;
        
        if (windowBackgroundRegex.test(styleContent)) {
          // Replace existing android:windowBackground
          styleContent = styleContent.replace(
            windowBackgroundRegex,
            `    <item name="android:windowBackground">@drawable/${drawableName}</item>`
          );
        } else {
          // Add android:windowBackground
          styleContent = styleContent.trim() + `\n    <item name="android:windowBackground">@drawable/${drawableName}</item>`;
        }

        // Replace or add android:statusBarColor
        const statusBarColorRegex = /<item\s+name\s*=\s*["']android:statusBarColor["']\s*>[\s\S]*?<\/item>/i;
        
        if (statusBarColorRegex.test(styleContent)) {
          // Replace existing android:statusBarColor
          styleContent = styleContent.replace(
            statusBarColorRegex,
            `    <item name="android:statusBarColor">#00000000</item>`
          );
        } else {
          // Add android:statusBarColor
          styleContent = styleContent.trim() + `\n    <item name="android:statusBarColor">#00000000</item>`;
        }

        return styleStart + styleContent + styleEnd;
      }
    );
  } else {
    console.warn(`[expo-splash-screen2] Style ${styleName} not found in styles.xml`);
  }

  // Add Theme.App.MainActivity theme, use backgroundColor as solid background
  const mainActivityStyleName = 'Theme.App.MainActivity';
  const escapedMainActivityStyleName = mainActivityStyleName.replace(/\./g, '\\.');
  const mainActivityStyleRegex = new RegExp(
    `(<style\\s+name="${escapedMainActivityStyleName}"[^>]*>)([\\s\\S]*?)(<\\/style>)`,
    'i'
  );

  // Normalize color value
  const normalizedColor = normalizeAndroidColor(backgroundColor);
  const colorWithAlpha = addAlphaToColor(normalizedColor);

  if (!mainActivityStyleRegex.test(content)) {
    // If theme doesn't exist, add new theme
    // Add before </resources>
    const resourcesEndRegex = /<\/resources>/i;
    if (resourcesEndRegex.test(content)) {
      const mainActivityStyle = `
  <style name="${mainActivityStyleName}" parent="AppTheme">
    <item name="android:windowBackground">#${colorWithAlpha.substring(1)}</item>
    <item name="android:statusBarColor">#00000000</item>
  </style>`;
      content = content.replace(resourcesEndRegex, mainActivityStyle + '\n</resources>');
    }
  } else {
    // If theme already exists, update windowBackground and statusBarColor
    content = content.replace(
      mainActivityStyleRegex,
      (match, styleStart, styleContent, styleEnd) => {
        const windowBackgroundRegex = /<item\s+name\s*=\s*["']android:windowBackground["']\s*>[\s\S]*?<\/item>/i;
        
        if (windowBackgroundRegex.test(styleContent)) {
          styleContent = styleContent.replace(
            windowBackgroundRegex,
            `    <item name="android:windowBackground">#${colorWithAlpha.substring(1)}</item>`
          );
        } else {
          styleContent = styleContent.trim() + `\n    <item name="android:windowBackground">#${colorWithAlpha.substring(1)}</item>`;
        }

        // Replace or add android:statusBarColor
        const statusBarColorRegex = /<item\s+name\s*=\s*["']android:statusBarColor["']\s*>[\s\S]*?<\/item>/i;
        
        if (statusBarColorRegex.test(styleContent)) {
          // Replace existing android:statusBarColor
          styleContent = styleContent.replace(
            statusBarColorRegex,
            `    <item name="android:statusBarColor">#00000000</item>`
          );
        } else {
          // Add android:statusBarColor
          styleContent = styleContent.trim() + `\n    <item name="android:statusBarColor">#00000000</item>`;
        }

        return styleStart + styleContent + styleEnd;
      }
    );
  }

  return content;
}

/**
 * Copy HTML file and images to iOS bundle
 */
function copyHtmlFileForIOS(
  projectRoot: string,
  iosPath: string,
  localHtmlPath: string
): void {
  try {
    console.log(`[expo-splash-screen2] [iOS] copyHtmlFileForIOS called`);
    console.log(`[expo-splash-screen2] [iOS] projectRoot: ${projectRoot}`);
    console.log(`[expo-splash-screen2] [iOS] localHtmlPath: ${localHtmlPath}`);
    
    const sourcePath = path.resolve(projectRoot, localHtmlPath);
    console.log(`[expo-splash-screen2] [iOS] sourcePath: ${sourcePath}`);
    
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[expo-splash-screen2] [iOS] HTML file not found: ${sourcePath}`);
      return;
    }

    let targetDir = path.join(iosPath, 'MyNewExpoSplashDemo');
    try {
      const entries = fs.readdirSync(iosPath, { withFileTypes: true });
      const projectDir = entries
        .filter((e:any) => e.isDirectory())
        .map((e:any) => e.name)
        .find((d:string) => fs.existsSync(path.join(iosPath, `${d}.xcodeproj`)));
      if (projectDir) {
        targetDir = path.join(iosPath, projectDir);
      }
    } catch {}
    console.log(`[expo-splash-screen2] [iOS] targetDir: ${targetDir}`);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Read HTML content
    const htmlContent = fs.readFileSync(sourcePath, 'utf-8');
    const htmlDir = path.dirname(sourcePath);
    console.log(`[expo-splash-screen2] [iOS] htmlDir: ${htmlDir}`);
    
    // Extract all image paths (from HTML tags and CSS)
    const imagePaths = extractImagePaths(htmlContent, htmlDir);
    console.log(`[expo-splash-screen2] [iOS] extractImagePaths found: ${imagePaths.length} images`);
    imagePaths.forEach(({ original, absolute }) => {
      console.log(`[expo-splash-screen2] [iOS]   - original: ${original}, absolute: ${absolute}`);
    });
    
    // Check if HTML file directory has assets subdirectory (built image directory)
    const assetsDir = path.join(htmlDir, 'assets');
    console.log(`[expo-splash-screen2] [iOS] checking assetsDir: ${assetsDir}`);
    console.log(`[expo-splash-screen2] [iOS] assetsDir exists: ${fs.existsSync(assetsDir)}`);
    
    if (fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory()) {
      // Read all image files from assets directory
      const allFiles = fs.readdirSync(assetsDir);
      console.log(`[expo-splash-screen2] [iOS] assetsDir all files: ${allFiles.join(', ')}`);
      
      const imageFiles = allFiles.filter(f => 
        /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f)
      );
      console.log(`[expo-splash-screen2] [iOS] assetsDir image files: ${imageFiles.join(', ')}`);
      
      imageFiles.forEach(imgFile => {
        const srcPath = path.join(assetsDir, imgFile);
        const absolutePath = srcPath;
        // Add to imagePaths, use ./assets/ as original path
        imagePaths.push({ original: `./assets/${imgFile}`, absolute: absolutePath });
        console.log(`[expo-splash-screen2] [iOS] added from assets: ./assets/${imgFile} -> ${absolutePath}`);
      });
    }
    
    // Compatibility: also check images subdirectory
    const imagesDir = path.join(htmlDir, 'images');
    console.log(`[expo-splash-screen2] [iOS] checking imagesDir: ${imagesDir}`);
    console.log(`[expo-splash-screen2] [iOS] imagesDir exists: ${fs.existsSync(imagesDir)}`);
    
    if (fs.existsSync(imagesDir) && fs.statSync(imagesDir).isDirectory()) {
      const imageFiles = fs.readdirSync(imagesDir).filter(f => 
        /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f)
      );
      console.log(`[expo-splash-screen2] [iOS] imagesDir image files: ${imageFiles.join(', ')}`);
      
      imageFiles.forEach(imgFile => {
        const srcPath = path.join(imagesDir, imgFile);
        const absolutePath = srcPath;
        imagePaths.push({ original: `./images/${imgFile}`, absolute: absolutePath });
      });
    }
    
    console.log(`[expo-splash-screen2] [iOS] total imagePaths after scanning: ${imagePaths.length}`);
    
    // Create image path mapping
    const imagePathMap = new Map<string, string>();
    
    // Copy image files and update path mapping (remove hash)
    imagePaths.forEach(({ original, absolute }) => {
      // Remove hash from filename (e.g., top.69f4b826e4179e7f210f17d37f6d128d.png -> top.png)
      const fileNameWithHash = path.basename(absolute);
      const fileNameWithoutHash = removeHashFromFileName(fileNameWithHash);
      const newPath = `./${fileNameWithoutHash}`;
      console.log(`[expo-splash-screen2] [iOS] processing: ${original} -> ${newPath} (file: ${absolute})`);
      
      // Copy image to iOS bundle (using filename without hash)
      const targetImagePath = path.join(targetDir, fileNameWithoutHash);
      console.log(`[expo-splash-screen2] [iOS] copying to: ${targetImagePath}`);
      
      if (fs.existsSync(absolute)) {
        fs.copyFileSync(absolute, targetImagePath);
        console.log(`[expo-splash-screen2] [iOS] copied successfully: ${fileNameWithoutHash}`);
        
        imagePathMap.set(original, newPath);
        const normalizedOriginal = original.startsWith('./') ? original : `./${original}`;
        imagePathMap.set(normalizedOriginal, newPath);
        
        if (original.startsWith('./')) {
          imagePathMap.set(original.substring(2), newPath);
        }
        
        // Handle ./images/ path format
        if (original.startsWith('./images/')) {
          imagePathMap.set(original, newPath);
          imagePathMap.set(original.substring(2), newPath); // Remove ./
          imagePathMap.set(original.substring(10), newPath); // Remove ./images/
        }
        
        // Handle ./assets/ path format (expo export generated path)
        if (original.startsWith('./assets/')) {
          imagePathMap.set(original, newPath);
          imagePathMap.set(original.substring(2), newPath); // Remove ./
          // Also match filenames with hash
          const originalFileName = path.basename(original);
          if (originalFileName !== fileNameWithoutHash) {
            imagePathMap.set(original.replace(originalFileName, fileNameWithoutHash), newPath);
          }
        }
      }
    });
    
    // Update image paths in HTML content
    let updatedHtmlContent = htmlContent;
    
    // Update paths in <img src="..."> tags
    updatedHtmlContent = updatedHtmlContent.replace(
      /<img([^>]+)src\s*=\s*["']([^"']+)["']/gi,
      (match, attrs, srcPath) => {
        if (srcPath.startsWith('http') || srcPath.startsWith('data:')) {
          return match;
        }
        const newPath = imagePathMap.get(srcPath) || imagePathMap.get(`./${srcPath}`) || imagePathMap.get(srcPath.replace(/^\.\//, ''));
        if (newPath) {
          return `<img${attrs}src="${newPath}"`;
        }
        return match;
      }
    );
    
    // Update url() references in CSS
    updatedHtmlContent = updatedHtmlContent.replace(
      /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi,
      (match, urlPath) => {
        if (urlPath.startsWith('http') || urlPath.startsWith('data:')) {
          return match;
        }
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
        const lowerPath = urlPath.toLowerCase();
        if (!imageExtensions.some(ext => lowerPath.includes(ext))) {
          return match;
        }
        const newPath = imagePathMap.get(urlPath) || imagePathMap.get(`./${urlPath}`) || imagePathMap.get(urlPath.replace(/^\.\//, ''));
        if (newPath) {
          return `url("${newPath}")`;
        }
        return match;
      }
    );
    
    // Update image paths in JavaScript code (match "./images/xxx.png" or './images/xxx.png' or "/images/xxx.png")
    updatedHtmlContent = updatedHtmlContent.replace(
      /(["'])(\.\/images\/[^"']+\.(png|jpg|jpeg|gif|svg|webp|ico))(["'])/gi,
      (match, quote1, imgPath, ext, quote2) => {
        const fileName = path.basename(imgPath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        const newPath = imagePathMap.get(`./images/${fileName}`) || 
                       imagePathMap.get(`./images/${fileNameWithoutHash}`) || 
                       imagePathMap.get(`./${fileName}`) || 
                       imagePathMap.get(`./${fileNameWithoutHash}`) || 
                       `./${fileNameWithoutHash}`;
        return `${quote1}${newPath}${quote2}`;
      }
    );
    
    // Update image paths in JavaScript code (match "./assets/xxx.png" format, expo export generated path)
    updatedHtmlContent = updatedHtmlContent.replace(
      /(["'])(\.\/assets\/[^"']+\.(png|jpg|jpeg|gif|svg|webp|ico))(["'])/gi,
      (match, quote1, imgPath, ext, quote2) => {
        const fileName = path.basename(imgPath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        const newPath = imagePathMap.get(imgPath) || 
                       imagePathMap.get(`./assets/${imgPath.substring(2)}`) ||
                       `./${fileNameWithoutHash}`;
        return `${quote1}${newPath}${quote2}`;
      }
    );
    
    // Also match paths without quotes (in JavaScript code)
    updatedHtmlContent = updatedHtmlContent.replace(
      /(\.\/images\/[^\s"'`;,\)]+\.(png|jpg|jpeg|gif|svg|webp|ico))/gi,
      (match, imgPath) => {
        const fileName = path.basename(imgPath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        const newPath = imagePathMap.get(`./images/${fileName}`) || 
                       imagePathMap.get(`./images/${fileNameWithoutHash}`) || 
                       imagePathMap.get(`./${fileName}`) || 
                       imagePathMap.get(`./${fileNameWithoutHash}`) || 
                       `./${fileNameWithoutHash}`;
        return newPath;
      }
    );
    
    // Also match assets paths without quotes
    updatedHtmlContent = updatedHtmlContent.replace(
      /(\.\/assets\/[^\s"'`;,\)]+\.(png|jpg|jpeg|gif|svg|webp|ico))/gi,
      (match, imgPath) => {
        const fileName = path.basename(imgPath);
        const fileNameWithoutHash = removeHashFromFileName(fileName);
        const newPath = imagePathMap.get(imgPath) || 
                       imagePathMap.get(`./assets/${imgPath.substring(2)}`) ||
                       `./${fileNameWithoutHash}`;
        return newPath;
      }
    );

    // Write updated HTML file
    const targetPath = path.join(targetDir, 'index.html');
    fs.writeFileSync(targetPath, updatedHtmlContent, 'utf-8');
  } catch (error) {
    console.error(`[expo-splash-screen2] Error copying HTML file for iOS: ${error}`);
  }
}

/**
 * Generate SplashScreen2Service.swift file (similar to EXSplashScreenService)
 */
function generateSplashScreen2Service(
  bundleIdentifier: string,
  projectRoot: string,
  iosPath: string,
  projectName: string
): void {
  // Generate directly to iOS project directory
  const targetDir = path.join(iosPath, projectName);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const servicePath = path.join(targetDir, 'SplashScreen2Service.swift');

  const serviceContent = `import UIKit
import WebKit

// Protocol definition, used to replace AppDelegate type
@objc public protocol AppDelegateProtocol {
  @objc func startReactNativeIfNeeded()
}

// Similar to EXSplashScreenService, manages splash screen display and hiding
public class SplashScreen2Service: NSObject {
  private var splashScreenControllers: [UIViewController: SplashScreen2ViewController] = [:]
  private weak var observingRootViewController: UIViewController?
  // Global preventAutoHide state, applied to newly created splash screens
  private var globalPreventAutoHide: Bool = false
  private static let sharedInstance = SplashScreen2Service()
  
  public static var shared: SplashScreen2Service {
    return sharedInstance
  }
  
  private override init() {
    super.init()
  }
  
  // Show splash screen (similar to EXSplashScreenService.showSplashScreenFor)
  public func showSplashScreenFor(_ viewController: UIViewController) {
    print("[SplashScreen2Service] showSplashScreenFor called for viewController: \\(viewController)")
    print("[SplashScreen2Service] showSplashScreenFor - globalPreventAutoHide: \\(globalPreventAutoHide)")
    
    // If already exists, clean up old one first
    // Note: Using force=true here because we want to replace the old splash screen
    // But if globalPreventAutoHide=true, we should keep the old one instead of cleaning it up
    if let existingController = splashScreenControllers[viewController] {
      if globalPreventAutoHide {
        print("[SplashScreen2Service] showSplashScreenFor - globalPreventAutoHide is true, keeping existing splash screen")
        // If preventAutoHide is already set, no need to recreate
        // Ensure splash screen is on top layer and visible
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
    
    // Create SplashScreen2ViewController instance
    let splashVC = SplashScreen2ViewController()
    let splashScreenController = SplashScreen2ViewController(splashViewController: splashVC)
    
    // If global preventAutoHide state is true, apply immediately
    if globalPreventAutoHide {
      print("[SplashScreen2Service] showSplashScreenFor - Applying global preventAutoHide state")
      splashScreenController.preventAutoHide()
      // Ensure splash screen is visible (set before adding to parent view)
      splashVC.view.isHidden = false
      splashVC.view.alpha = 1.0
    }
    
    // Set view's frame first, ensure correct size
    // This must be done before adding to parent view
    splashVC.view.frame = viewController.view.bounds
    
    // Print size information for debugging
    print("[SplashScreen2Service] showSplashScreenFor - viewController.view.frame: \\(viewController.view.frame)")
    print("[SplashScreen2Service] showSplashScreenFor - viewController.view.bounds: \\(viewController.view.bounds)")
    print("[SplashScreen2Service] showSplashScreenFor - UIScreen.main.bounds: \\(UIScreen.main.bounds)")
    print("[SplashScreen2Service] showSplashScreenFor - splashVC.view.frame (before addSubview): \\(splashVC.view.frame)")
    
    // Add SplashScreen2ViewController as child view controller (maintain lifecycle)
    // This must be called before addSubview to ensure viewDidLoad is called at the right time
    viewController.addChild(splashVC)
    
    // Add SplashScreen2ViewController's view to target view controller's view
    viewController.view.addSubview(splashVC.view)
    splashVC.view.translatesAutoresizingMaskIntoConstraints = false
    
    // Set constraints to ensure full screen display
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
    
    // 打印约束后的尺寸
    print("[SplashScreen2Service] showSplashScreenFor - After constraints, splashVC.view.frame: \\(splashVC.view.frame)")
    print("[SplashScreen2Service] showSplashScreenFor - After constraints, splashVC.view.bounds: \\(splashVC.view.bounds)")
    print("[SplashScreen2Service] showSplashScreenFor - splashVC.view.superview: \\(String(describing: splashVC.view.superview))")
    print("[SplashScreen2Service] showSplashScreenFor - splashVC.view.window: \\(String(describing: splashVC.view.window))")
    
    // 确保 WebView 已经正确挂载
    // 延迟一点时间，确保 viewDidLoad 和 setupWebView 已经完成
    DispatchQueue.main.async {
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.frame: \\(splashVC.view.frame)")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.subviews.count: \\(splashVC.view.subviews.count)")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.isHidden: \\(splashVC.view.isHidden)")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.alpha: \\(splashVC.view.alpha)")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.superview: \\(String(describing: splashVC.view.superview))")
      print("[SplashScreen2Service] showSplashScreenFor - After async, splashVC.view.window: \\(String(describing: splashVC.view.window))")
      
      // 检查是否有其他视图遮挡
      if let superview = splashVC.view.superview {
        print("[SplashScreen2Service] showSplashScreenFor - superview.subviews.count: \\(superview.subviews.count)")
        for (index, subview) in superview.subviews.enumerated() {
          print("[SplashScreen2Service] showSplashScreenFor - superview.subview[\\(index)]: \\(type(of: subview)), frame: \\(subview.frame), isHidden: \\(subview.isHidden), alpha: \\(subview.alpha)")
        }
      }
      
      for (index, subview) in splashVC.view.subviews.enumerated() {
        print("[SplashScreen2Service] showSplashScreenFor - subview[\\(index)]: \\(type(of: subview)), frame: \\(subview.frame), isHidden: \\(subview.isHidden), alpha: \\(subview.alpha)")
        
        // 确保 WebView 可见
        if let webView = subview as? WKWebView {
          webView.isHidden = false
          webView.alpha = 1.0
          print("[SplashScreen2Service] showSplashScreenFor - WebView visibility set: isHidden=\\(webView.isHidden), alpha=\\(webView.alpha)")
        }
      }
      
      // 确保 view 在最上层
      if let superview = splashVC.view.superview {
        superview.bringSubviewToFront(splashVC.view)
        print("[SplashScreen2Service] showSplashScreenFor - Brought splashVC.view to front")
      }
    }
    
    splashScreenControllers[viewController] = splashScreenController
    splashScreenController.show()
  }
  
  // 隐藏 splash screen（类似 EXSplashScreenService.hideSplashScreenFor）
  public func hideSplashScreenFor(_ viewController: UIViewController, force: Bool = false) {
    print("[SplashScreen2Service] hideSplashScreenFor called for viewController: \\(viewController), force: \\(force)")
    print("[SplashScreen2Service] hideSplashScreenFor - globalPreventAutoHide: \\(globalPreventAutoHide)")
    
    guard let controller = splashScreenControllers[viewController] else {
      print("[SplashScreen2Service] No splash screen found for view controller")
      return
    }
    
    // 如果 globalPreventAutoHide 为 true 且 force 为 false，不执行隐藏操作
    if globalPreventAutoHide && !force {
      print("[SplashScreen2Service] hideSplashScreenFor - globalPreventAutoHide is true and force is false, ignoring hide call")
      print("[SplashScreen2Service] hideSplashScreenFor - Stack trace: \\(Thread.callStackSymbols.prefix(5).joined(separator: "\\n"))")
      // 确保 splash screen 仍然可见且在最上层
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
    
    print("[SplashScreen2Service] hideSplashScreenFor - Proceeding with hide, force: \\(force)")
    // 使用 force=true 强制隐藏，即使 preventAutoHide 被调用
    controller.hide(force: force)
    splashScreenControllers.removeValue(forKey: viewController)
  }
  
  // 隐藏所有 splash screen（用于强制隐藏所有已知的 splash screen）
  public func hideAllSplashScreens(force: Bool = true) {
    print("[SplashScreen2Service] hideAllSplashScreens called, force: \\(force)")
    print("[SplashScreen2Service] hideAllSplashScreens - splashScreenControllers count: \\(splashScreenControllers.count)")
    
    // 复制字典的键，因为我们在迭代过程中会修改字典
    let allViewControllers = Array(splashScreenControllers.keys)
    
    for viewController in allViewControllers {
      print("[SplashScreen2Service] hideAllSplashScreens - Hiding splash screen for: \\(viewController)")
      hideSplashScreenFor(viewController, force: force)
    }
    
    print("[SplashScreen2Service] hideAllSplashScreens - Completed, remaining count: \\(splashScreenControllers.count)")
  }
  
  // 防止自动隐藏（类似 EXSplashScreenService.preventSplashScreenAutoHideFor）
  public func preventAutoHideFor(_ viewController: UIViewController) {
    print("[SplashScreen2Service] preventAutoHideFor called for viewController: \\(viewController)")
    print("[SplashScreen2Service] preventAutoHideFor - Stack trace: \\(Thread.callStackSymbols.prefix(5).joined(separator: "\\n"))")
    
    // 设置全局 preventAutoHide 状态（必须在最开始设置）
    globalPreventAutoHide = true
    print("[SplashScreen2Service] preventAutoHideFor - Set globalPreventAutoHide to true")
    
    // 如果还没有 splash screen，先创建一个
    if splashScreenControllers[viewController] == nil {
      print("[SplashScreen2Service] preventAutoHideFor - No splash screen found, creating one first")
      showSplashScreenFor(viewController)
    }
    
    // 对所有现有的 splash screen 应用 preventAutoHide
    for (vc, controller) in splashScreenControllers {
      print("[SplashScreen2Service] preventAutoHideFor - Applying preventAutoHide to existing splash screen for viewController: \\(vc)")
      controller.preventAutoHide()
      // 确保 splash screen 可见且在最上层
      if let splashVC = controller.splashViewControllerInstance {
        splashVC.view.isHidden = false
        splashVC.view.alpha = 1.0
        if let parent = splashVC.parent {
          parent.view.bringSubviewToFront(splashVC.view)
        } else if let superview = splashVC.view.superview {
          superview.bringSubviewToFront(splashVC.view)
        }
        print("[SplashScreen2Service] preventAutoHideFor - Ensured splash screen is visible and on top for viewController: \\(vc)")
      }
    }
    
    guard let controller = splashScreenControllers[viewController] else {
      print("[SplashScreen2Service] preventAutoHideFor - Failed to create or find splash screen")
      return
    }
    
    print("[SplashScreen2Service] preventAutoHideFor - Calling preventAutoHide on controller")
    controller.preventAutoHide()
    
    // 确保 splash screen 可见且在最上层
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
  
  // 添加 rootViewController 监听（类似 EXSplashScreenService.addRootViewControllerListener）
  public func addRootViewControllerListener() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in
        self?.addRootViewControllerListener()
      }
      return
    }
    
    // 如果已经有监听器，先移除旧的
    if observingRootViewController != nil {
      print("[SplashScreen2Service] addRootViewControllerListener: Already observing, removing old listener first")
      removeRootViewControllerListener()
    }
    
    if let window = UIApplication.shared.keyWindow {
      window.addObserver(self, forKeyPath: "rootViewController", options: .new, context: nil)
      
      // 如果已经有 rootViewController，立即显示 splash screen
      if let rootViewController = window.rootViewController {
        print("[SplashScreen2Service] addRootViewControllerListener: Found existing rootViewController: \\(rootViewController)")
        print("[SplashScreen2Service] addRootViewControllerListener - globalPreventAutoHide: \\(globalPreventAutoHide)")
        
        // 只有当 rootViewController 不是当前观察的对象时才添加监听器
        if rootViewController != observingRootViewController {
          rootViewController.addObserver(self, forKeyPath: "view", options: .new, context: nil)
          observingRootViewController = rootViewController
          
          // 立即显示 splash screen（只有当还没有显示时才显示）
          // 如果 globalPreventAutoHide 为 true，且已经存在 splash screen，不需要重新创建
          if splashScreenControllers[rootViewController] == nil {
            if globalPreventAutoHide {
              print("[SplashScreen2Service] addRootViewControllerListener - globalPreventAutoHide is true but no splash screen found, this should not happen")
            }
            showSplashScreenFor(rootViewController)
          } else {
            print("[SplashScreen2Service] addRootViewControllerListener: Splash screen already exists for rootViewController, skipping")
            // 如果 globalPreventAutoHide 为 true，确保 splash screen 在最上层
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
        print("[SplashScreen2Service] rootViewController changed from \\(String(describing: observingRootViewController)) to \\(newRootViewController)")
        print("[SplashScreen2Service] rootViewController changed - globalPreventAutoHide: \\(globalPreventAutoHide)")
        
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
        print("[SplashScreen2Service] view changed for viewController: \\(viewController)")
        print("[SplashScreen2Service] view changed - globalPreventAutoHide: \\(globalPreventAutoHide)")
        
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
public class SplashScreen2ViewController {
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
    print("[SplashScreen2ViewController] show() - splashVC.view.isHidden: \\(splashVC.view.isHidden)")
    print("[SplashScreen2ViewController] show() - splashVC.view.alpha: \\(splashVC.view.alpha)")
    print("[SplashScreen2ViewController] show() - splashVC.view.superview: \\(String(describing: splashVC.view.superview))")
    print("[SplashScreen2ViewController] show() - splashVC.view.window: \\(String(describing: splashVC.view.window))")
    
    // 确保 view 可见
    splashVC.view.isHidden = false
    splashVC.view.alpha = 1.0
    
    // 确保 WebView 也可见
    for subview in splashVC.view.subviews {
      if let webView = subview as? WKWebView {
        webView.isHidden = false
        webView.alpha = 1.0
        print("[SplashScreen2ViewController] show() - WebView visibility set: isHidden=\\(webView.isHidden), alpha=\\(webView.alpha)")
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
    
    print("[SplashScreen2ViewController] show() - After show, splashVC.view.isHidden: \\(splashVC.view.isHidden)")
    print("[SplashScreen2ViewController] show() - After show, splashVC.view.alpha: \\(splashVC.view.alpha)")
    print("[SplashScreen2ViewController] show() - After show, splashVC.view.subviews.count: \\(splashVC.view.subviews.count)")
    
    splashScreenShown = true
  }
  
  func hide(force: Bool = false) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in
        self?.hide(force: force)
      }
      return
    }
    
    print("[SplashScreen2ViewController] hide called, force: \\(force), autoHideEnabled: \\(autoHideEnabled)")
    print("[SplashScreen2ViewController] hide - Stack trace: \\(Thread.callStackSymbols.prefix(5).joined(separator: "\\n"))")
    
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
    
    print("[SplashScreen2ViewController] hide - Proceeding with hide animation")
    
    UIView.animate(withDuration: 0.3, animations: {
      splashVC.view.alpha = 0.0
    }) { _ in
      print("[SplashScreen2ViewController] hide - Animation completed, removing from superview")
      splashVC.view.removeFromSuperview()
      splashVC.willMove(toParent: nil)
      if let parent = splashVC.parent {
        splashVC.removeFromParent()
      }
    }
    
    splashScreenShown = false
    // 注意：只有在强制隐藏时才重置 autoHideEnabled
    // 如果 preventAutoHide 被调用，autoHideEnabled 应该保持为 false
    if force {
      autoHideEnabled = true
    }
  }
  
  func preventAutoHide() {
    print("[SplashScreen2ViewController] preventAutoHide called, autoHideEnabled: \\(autoHideEnabled)")
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
`;

  try {
    fs.writeFileSync(servicePath, serviceContent);
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to generate SplashScreen2Service.swift:`, error);
    throw error;
  }
}

/**
 * 生成 SplashScreen2ViewController.swift 文件（简化版，只用于 WebView 显示 HTML）
 */
function generateSplashScreen2ViewController(
  bundleIdentifier: string,
  projectRoot: string,
  iosPath: string,
  backgroundColor: string,
  projectName: string
): void {
  // 直接生成到 iOS 项目目录
  const targetDir = path.join(iosPath, projectName);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const viewControllerPath = path.join(targetDir, 'SplashScreen2ViewController.swift');

  const viewControllerContent = `import UIKit
import WebKit

// 简化版 SplashScreen2ViewController，只用于 WebView 显示 HTML
// 参考 expo-splash-screen 的架构，但使用 WebView 显示 HTML
public class SplashScreen2ViewController: UIViewController {
  private var webView: WKWebView?
  private var webViewContainer: UIView?
  private let userDefaults = UserDefaults.standard
  
  public static weak var appDelegate: AppDelegateProtocol?
  
  public override func viewDidLoad() {
    super.viewDidLoad()
    
    print("[SplashScreen2ViewController] viewDidLoad called")
    print("[SplashScreen2ViewController] viewDidLoad - view.frame: \\(view.frame)")
    print("[SplashScreen2ViewController] viewDidLoad - view.bounds: \\(view.bounds)")
    print("[SplashScreen2ViewController] viewDidLoad - view.superview: \\(String(describing: view.superview))")
    print("[SplashScreen2ViewController] viewDidLoad - view.window: \\(String(describing: view.window))")
    
    // 设置 view 的背景色为传入的 backgroundColor
    // 将十六进制颜色转换为 UIColor
    let hexColor = "${backgroundColor}".uppercased().replacingOccurrences(of: "#", with: "")
    if hexColor.count == 6 {
      let r = CGFloat(Int(hexColor.prefix(2), radix: 16) ?? 0) / 255.0
      let g = CGFloat(Int(String(hexColor.dropFirst(2).prefix(2)), radix: 16) ?? 0) / 255.0
      let b = CGFloat(Int(hexColor.suffix(2), radix: 16) ?? 0) / 255.0
      view.backgroundColor = UIColor(red: r, green: g, blue: b, alpha: 1.0)
    } else {
      view.backgroundColor = .clear
    }
    
    // 确保全屏显示
    edgesForExtendedLayout = .all
    
    // 如果 view 已经有 superview，确保 frame 正确
    if let superview = view.superview {
      view.frame = superview.bounds
      print("[SplashScreen2ViewController] viewDidLoad - Updated view.frame to superview.bounds: \\(view.frame)")
    } else {
      // 如果没有 superview，使用屏幕尺寸
      view.frame = UIScreen.main.bounds
      print("[SplashScreen2ViewController] viewDidLoad - Set view.frame to UIScreen.main.bounds: \\(view.frame)")
    }
    
    // 注册通知监听
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
    // 移除通知监听
    NotificationCenter.default.removeObserver(self)
  }
  
  @objc private func handlePreventAutoHide() {
    print("[SplashScreen2ViewController] handlePreventAutoHide called")
    // 通过 SplashScreen2Service 防止自动隐藏
    // 需要传递 parent view controller（通常是 rootViewController）
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
    // 通过 SplashScreen2Service 隐藏开屏
    // 需要传递 parent view controller（通常是 rootViewController）
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
    
    // 强制设置 view 的 frame 为全屏
    if let window = view.window {
      view.frame = window.bounds
    } else {
      view.frame = UIScreen.main.bounds
    }
    
    print("[SplashScreen2ViewController] viewWillAppear - view.frame: \\(view.frame)")
    print("[SplashScreen2ViewController] viewWillAppear - view.bounds: \\(view.bounds)")
    print("[SplashScreen2ViewController] viewWillAppear - UIScreen.main.bounds: \\(UIScreen.main.bounds)")
  }
  
  public override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    
    // 强制设置 view 的 frame 为全屏
    if let window = view.window {
      view.frame = window.bounds
    } else {
      view.frame = UIScreen.main.bounds
    }
    
    // 确保 webView 也是全屏
    if let webView = webView {
      webView.frame = view.bounds
      print("[SplashScreen2ViewController] viewDidLayoutSubviews - webView.frame: \\(webView.frame)")
      print("[SplashScreen2ViewController] viewDidLayoutSubviews - webView.bounds: \\(webView.bounds)")
    }
  }
  
  private func setupWebView() {
    let config = WKWebViewConfiguration()
    config.preferences.javaScriptEnabled = true
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    
    // 添加 JavaScript 接口
    let contentController = WKUserContentController()
    contentController.add(self, name: "agreePrivacyPolicy")
    contentController.add(self, name: "disagreePrivacyPolicy")
    contentController.add(self, name: "openPrivacyPolicy")
    config.userContentController = contentController
    
    webView = WKWebView(frame: view.bounds, configuration: config)
    // 设置透明背景
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
    
    // 确保 view 的 frame 正确
    if view.frame == .zero {
      if let superview = view.superview {
        view.frame = superview.bounds
      } else {
        view.frame = UIScreen.main.bounds
      }
      print("[SplashScreen2ViewController] setupWebView - view.frame was zero, updated to: \\(view.frame)")
    }
    
    // 确保 webView 的 frame 正确
    if webView.frame == .zero {
      webView.frame = view.bounds
      print("[SplashScreen2ViewController] setupWebView - webView.frame was zero, updated to: \\(webView.frame)")
    }
    
    // 将 WebView 添加到 view 上
    view.addSubview(webView)
    print("[SplashScreen2ViewController] setupWebView - WebView added to view, view.subviews.count: \\(view.subviews.count)")
    
    webView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      webView.topAnchor.constraint(equalTo: view.topAnchor),
      webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
    
    // 强制布局更新
    view.setNeedsLayout()
    view.layoutIfNeeded()
    webView.setNeedsLayout()
    webView.layoutIfNeeded()
    
    // 打印尺寸信息用于调试
    print("[SplashScreen2ViewController] setupWebView - view.frame: \\(view.frame)")
    print("[SplashScreen2ViewController] setupWebView - view.bounds: \\(view.bounds)")
    print("[SplashScreen2ViewController] setupWebView - view.superview: \\(String(describing: view.superview))")
    print("[SplashScreen2ViewController] setupWebView - view.window: \\(String(describing: view.window))")
    print("[SplashScreen2ViewController] setupWebView - view.isHidden: \\(view.isHidden)")
    print("[SplashScreen2ViewController] setupWebView - view.alpha: \\(view.alpha)")
    print("[SplashScreen2ViewController] setupWebView - webView.frame: \\(webView.frame)")
    print("[SplashScreen2ViewController] setupWebView - webView.bounds: \\(webView.bounds)")
    print("[SplashScreen2ViewController] setupWebView - webView.superview: \\(String(describing: webView.superview))")
    print("[SplashScreen2ViewController] setupWebView - webView.isHidden: \\(webView.isHidden)")
    print("[SplashScreen2ViewController] setupWebView - webView.alpha: \\(webView.alpha)")
    print("[SplashScreen2ViewController] setupWebView - webView.isOpaque: \\(webView.isOpaque)")
    print("[SplashScreen2ViewController] setupWebView - webView.backgroundColor: \\(String(describing: webView.backgroundColor))")
    print("[SplashScreen2ViewController] setupWebView - UIScreen.main.bounds: \\(UIScreen.main.bounds)")
    
    // 确保 WebView 可见
    webView.isHidden = false
    webView.alpha = 1.0
    view.isHidden = false
    view.alpha = 1.0
    
    print("[SplashScreen2ViewController] setupWebView - After setting visibility, webView.isHidden: \\(webView.isHidden), webView.alpha: \\(webView.alpha)")
    
    webView.navigationDelegate = self
    
    // 加载 HTML 文件
    if let htmlPath = Bundle.main.path(forResource: "index", ofType: "html") {
      if let htmlString = try? String(contentsOfFile: htmlPath, encoding: .utf8) {
        let baseURL = URL(fileURLWithPath: htmlPath).deletingLastPathComponent()
        webView.loadHTMLString(htmlString, baseURL: baseURL)
      }
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
    
    // 先尝试通过 JS 隐藏弹框，等结果返回后再启动 RN
    webView?.evaluateJavaScript(hideDialogJS) { _, error in
      if let error = error {
        print("[SplashScreen2ViewController] hide dialog JS error: \\(error)")
      }
      startReactNative()
    } ?? startReactNative()
  }
  
  // 公共方法：确保隐私弹框被隐藏（用于迁移后重新注入状态）
  public func ensurePrivacyDialogHidden() {
    let isAuth = userDefaults.bool(forKey: "isAuth")
    guard isAuth else {
      print("[SplashScreen2ViewController] ensurePrivacyDialogHidden - isAuth is false, skipping")
      return
    }
    
    let hideDialogJS = """
      (function() {
        try {
          // 重新注入 isAuth 状态
          window.isAuth = true;
          if (window.iOS) {
            window.iOS.getIsAuth = function() {
              return true;
            };
          }
          
          // 确保弹框被隐藏
          if (typeof closePrivacyDialog === 'function') {
            closePrivacyDialog();
          }
          if (typeof hidePrivacyDialog === 'function') {
            hidePrivacyDialog();
          }
          
          // 强制设置弹框状态为隐藏（如果 HTML 中有状态变量）
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
        print("[SplashScreen2ViewController] ensurePrivacyDialogHidden JS error: \\(error)")
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
    // 确保 WebView 和 view 都可见
    webView.isHidden = false
    webView.alpha = 1.0
    view.isHidden = false
    view.alpha = 1.0
    
    // 确保在最上层
    if let superview = view.superview {
      superview.bringSubviewToFront(view)
    }
    
    // 获取 isAuth 状态并注入到 HTML
    let isAuth = userDefaults.bool(forKey: "isAuth")
    
    // 注入 CSS 确保内容全屏显示，但不覆盖 HTML 中的背景色
    let css = """
    (function() {
      var style = document.createElement('style');
      style.innerHTML = "html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; position: fixed !important; top: 0 !important; left: 0 !important; }";
      document.head.appendChild(style);
    })();
    """
    webView.evaluateJavaScript(css, completionHandler: nil)
    
    // 延迟执行，确保 HTML 中的函数已经定义
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
      guard let self = self else { return }
      
      // 首先检查 HTML 中是否存在隐私协议相关的函数
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
          print("[SplashScreen2ViewController] Error checking privacy functions: \\(error)")
          // 如果检查出错，默认认为没有隐私协议，设置 isAuth 为 true
          self.userDefaults.set(true, forKey: "isAuth")
          // 直接启动 React Native
          SplashScreen2ViewController.appDelegate?.startReactNativeIfNeeded()
          return
        }
        
        let hasPrivacyFunctions = (result as? Bool) ?? false
        print("[SplashScreen2ViewController] HTML has privacy functions: \\(hasPrivacyFunctions)")
        
        if !hasPrivacyFunctions {
          // 如果 HTML 中没有隐私协议相关代码，默认 isAuth 为 true
          print("[SplashScreen2ViewController] No privacy functions found, setting isAuth to true")
          
          // 将 isAuth 设置为 true 并保存
          self.userDefaults.set(true, forKey: "isAuth")
          
          // 注入 isAuth=true 到 HTML，并执行 isAuth=true 的逻辑
          let jsCode = """
            (function() {
              console.log('No privacy functions found, setting isAuth to true');
              // 注入 isAuth 状态为 true
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
              print("[SplashScreen2ViewController] Error evaluating JavaScript: \\(error)")
            }
            // 启动 React Native（isAuth=true 的逻辑）
            print("[SplashScreen2ViewController] Starting React Native with isAuth=true")
            SplashScreen2ViewController.appDelegate?.startReactNativeIfNeeded()
          })
        } else {
          // 如果存在隐私协议相关代码，按原来的逻辑处理
          let jsCode = """
            (function() {
              // 注入 isAuth 状态
              window.isAuth = \\(isAuth);
              window.iOS = {
                getIsAuth: function() {
                  return \\(isAuth);
                }
              };
              
              // 根据 isAuth 状态决定显隐弹框
              if (window.isAuth) {
                // 如果已同意，隐藏弹框
                if (typeof hidePrivacyDialog === 'function') {
                  hidePrivacyDialog();
                }
              } else {
                // 如果未同意，显示弹框
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
              print("[SplashScreen2ViewController] Error evaluating JavaScript: \\(error)")
            } else {
              // 在 JavaScript 执行完成后，根据 isAuth 状态决定是否启动 React Native
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
`;

  try {
    fs.writeFileSync(viewControllerPath, viewControllerContent);
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to generate SplashScreen2ViewController.swift:`, error);
    throw error;
  }
}

/**
 * 生成 SplashScreen2PrivacyPolicyViewController.swift 文件
 */
function generateSplashScreen2PrivacyPolicyViewController(
  bundleIdentifier: string,
  projectRoot: string,
  iosPath: string,
  projectName: string
): void {
  // 直接生成到 iOS 项目目录
  const targetDir = path.join(iosPath, projectName);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const viewControllerPath = path.join(targetDir, 'SplashScreen2PrivacyPolicyViewController.swift');

  // 使用模板替换硬编码字符串
  const viewControllerContent = IOS_TEMPLATES.privacyPolicyViewController;

  try {
    fs.writeFileSync(viewControllerPath, viewControllerContent);
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to generate SplashScreen2PrivacyPolicyViewController.swift:`, error);
  }
}

/**
 * 生成 SplashScreen2Module.swift 文件（iOS 原生模块）
 */
function generateSplashScreen2Module(
  bundleIdentifier: string,
  projectRoot: string,
  iosPath: string,
  projectName: string
): void {
  // 直接生成到 iOS 项目目录
  const targetDir = path.join(iosPath, projectName);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const modulePath = path.join(targetDir, 'SplashScreen2Module.swift');

  // 使用模板替换硬编码字符串
  const moduleContent = IOS_TEMPLATES.splashHtmlModule;

  try {
    fs.writeFileSync(modulePath, moduleContent);
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to generate SplashScreen2Module.swift:`, error);
    throw error;
  }
}

/**
 * 复制 backgroundImage 到 iOS bundle
 */
function copyBackgroundImageToIOS(
  projectRoot: string,
  backgroundImagePath: string,
  iosPath: string,
  projectName: string
): string | null {
  try {
    const sourcePath = path.resolve(projectRoot, backgroundImagePath);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[expo-splash-screen2] Background image file not found: ${sourcePath}`);
      return null;
    }

    const targetDir = path.join(iosPath, projectName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 获取文件扩展名
    const ext = path.extname(sourcePath);
    const targetFileName = `splash_background_image${ext}`;
    const targetPath = path.join(targetDir, targetFileName);

    fs.copyFileSync(sourcePath, targetPath);
    return targetFileName;
  } catch (error) {
    console.error(`[expo-splash-screen2] Error copying background image: ${error}`);
    return null;
  }
}

/**
 * 修改 AppDelegate.swift，添加图片背景模式的 ImageView 容器逻辑
 * @param content - AppDelegate 内容
 * @param imageFileName - 图片文件名
 * @param imageWidth - 图片宽度（0 表示全屏背景图模式，>0 表示固定宽度居中模式）
 * @param backgroundColor - 背景色（十六进制，如 #10021F）
 * @param hasDarkMode - 是否启用深色模式
 * @param darkBackgroundColor - 深色模式背景色
 * @param darkImageFileName - 深色模式图片文件名
 */
function modifyAppDelegateForImageMode(
  content: string, 
  imageFileName: string, 
  imageWidth: number = 0, 
  backgroundColor: string = '#ffffff',
  hasDarkMode: boolean = false,
  darkBackgroundColor: string = '',
  darkImageFileName: string = ''
): string {
  // Image 模式下不需要 checkHtmlForPrivacyFunctions，移除它（如果存在）
  // 这可以防止从 webview 模式切换到 image 模式时出现重复声明错误
  // 匹配 checkHtmlForPrivacyFunctions 函数的完整定义（包括注释）
  const checkHtmlFunctionRegex = /\/\/ 检查 HTML 文件中是否有隐私协议相关函数\s*private func checkHtmlForPrivacyFunctions\(\) -> Bool \{[\s\S]*?\n  \}/g;
  content = content.replace(checkHtmlFunctionRegex, '');
  
  // 移除对 checkHtmlForPrivacyFunctions 的调用和相关逻辑（如果存在）
  // 匹配从调用到 if 块结束的整个代码块
  const checkHtmlCallRegex = /\s*\/\/ 检查 HTML 文件中是否有隐私协议相关代码\s*let hasPrivacyFunctions = self\.checkHtmlForPrivacyFunctions\(\)\s*print\("\[AppDelegate\] HTML has privacy functions: \\\(hasPrivacyFunctions\)"\)\s*if !hasPrivacyFunctions \{[\s\S]*?UserDefaults\.standard\.set\(true, forKey: "isAuth"\)[\s\S]*?\}\s*/g;
  content = content.replace(checkHtmlCallRegex, '');
  
  // 清理多余的空行
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  // 检查是否已经包含图片容器相关代码
  const ourEnablePreventAutoHidePattern = /@objc func enablePreventAutoHide\(\) \{[\s\S]*?preventAutoHide = true[\s\S]*?print\("\[AppDelegate\] enablePreventAutoHide called"\)[\s\S]*?\}/;
  const hasOurEnablePreventAutoHide = ourEnablePreventAutoHidePattern.test(content);
  const hasSplashImageViewContainer = content.includes('splashImageViewContainer');
  const hasSetupSplashImageView = content.includes('setupSplashImageView');
  const hasHideSplashImageViewContainer = content.includes('hideSplashImageViewContainer');
  
  // 如果所有必要的代码都已存在，直接返回
  if (hasSplashImageViewContainer && 
      hasSetupSplashImageView && 
      hasHideSplashImageViewContainer && 
      hasOurEnablePreventAutoHide) {
    return content;
  }
  
  // 如果检测到格式错误，先清理已插入的代码
  const hasFormatError = /}\s*var\s+window/.test(content) && (content.includes('enablePreventAutoHide()') || content.includes('preventAutoHide()'));
  if (hasFormatError) {
    content = content.replace(/}\s*var\s+window/g, '}\n\n  var window');
    const codeBlockPattern = /\/\/ Splash ImageView 容器[\s\S]*?@objc func (enablePreventAutoHide|preventAutoHide)\(\) \{[\s\S]*?print\("\[AppDelegate\] (enablePreventAutoHide|preventAutoHide) called"\)[\s\S]*?\}\s*/;
    content = content.replace(codeBlockPattern, '');
    if (/}\s*var\s+window/.test(content)) {
      content = content.replace(/}\s*var\s+window/g, '}\n\n  var window');
    }
    content = content.replace(/\n\n\n+/g, '\n\n');
  }
  
  // 如果已经存在 enablePreventAutoHide 方法但不是我们的版本，需要移除
  const hasEnablePreventAutoHide = /func\s+enablePreventAutoHide\s*\(\)/.test(content);
  const hasPreventAutoHide = /func\s+preventAutoHide\s*\(\)/.test(content);
  if ((hasEnablePreventAutoHide && !hasOurEnablePreventAutoHide) || (hasPreventAutoHide && !hasOurEnablePreventAutoHide)) {
    const preventAutoHideRegex = /(@objc\s+)?func\s+(preventAutoHide|enablePreventAutoHide)\s*\(\)/g;
    let match;
    const toRemove: Array<{ start: number; end: number }> = [];
    
    while ((match = preventAutoHideRegex.exec(content)) !== null) {
      const startIndex = match.index;
      let braceIndex = startIndex + match[0].length;
      while (braceIndex < content.length && content[braceIndex] !== '{') {
        braceIndex++;
      }
      
      if (braceIndex < content.length) {
        let braceCount = 0;
        let foundStart = false;
        let endIndex = braceIndex;
        
        for (let i = braceIndex; i < content.length; i++) {
          if (content[i] === '{') {
            braceCount++;
            foundStart = true;
          } else if (content[i] === '}') {
            braceCount--;
            if (foundStart && braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
        
        const methodContent = content.substring(startIndex, endIndex);
        if (!ourEnablePreventAutoHidePattern.test(methodContent)) {
          toRemove.push({ start: startIndex, end: endIndex });
        }
      }
    }
    
    toRemove.reverse().forEach(({ start, end }) => {
      content = content.substring(0, start) + content.substring(end);
    });
    content = content.replace(/\n\n\n+/g, '\n\n');
  }
  
  // 再次检查是否已经存在完整的代码块（在清理之后）
  if (content.includes('splashImageViewContainer') && 
      content.includes('setupSplashImageView') && 
      content.includes('hideSplashImageViewContainer') && 
      ourEnablePreventAutoHidePattern.test(content)) {
    return content;
  }

  // 查找 class AppDelegate 或 public class AppDelegate
  const classMatch = content.match(/(public\s+)?class\s+AppDelegate[^{]*\{/);
  if (!classMatch) {
    console.warn('[expo-splash-screen2] AppDelegate class not found');
    return content;
  }

  const classIndex = content.indexOf(classMatch[0]) + classMatch[0].length;
  const afterClass = content.substring(classIndex);
  
  // 查找第一个方法或属性
  const firstMethodMatch = afterClass.match(/(var|let|func|override|public|private|internal)/);
  if (firstMethodMatch) {
    const firstMethodIndex = classIndex + firstMethodMatch.index!;
    const beforeFirstMethod = content.substring(0, firstMethodIndex);
    const afterFirstMethod = content.substring(firstMethodIndex);
    
    // 生成深色模式相关代码
    const darkModeSwiftCode = hasDarkMode ? `
  // 检测是否为深色模式
  private func isDarkMode() -> Bool {
    if #available(iOS 13.0, *) {
      return UITraitCollection.current.userInterfaceStyle == .dark
    }
    return false
  }
  
  // 获取当前模式对应的背景色
  private func getCurrentBackgroundColor() -> UIColor {
    let colorHex = isDarkMode() ? "${darkBackgroundColor || backgroundColor}" : "${backgroundColor}"
    return parseHexColor(colorHex)
  }
  
  // 获取当前模式对应的图片名称
  private func getCurrentImageNames() -> [String] {
    if isDarkMode() {
      return ["${darkImageFileName || imageFileName}", "${imageFileName}", "splash_background_image", "splash-icon"]
    } else {
      return ["${imageFileName}", "splash_background_image", "splash-icon"]
    }
  }
  
  // 解析十六进制颜色
  private func parseHexColor(_ hex: String) -> UIColor {
    var colorHex = hex
    if colorHex.hasPrefix("#") {
      colorHex = String(colorHex.dropFirst())
    }
    if colorHex.count == 6, let hexValue = Int(colorHex, radix: 16) {
      let red = CGFloat((hexValue >> 16) & 0xFF) / 255.0
      let green = CGFloat((hexValue >> 8) & 0xFF) / 255.0
      let blue = CGFloat(hexValue & 0xFF) / 255.0
      return UIColor(red: red, green: green, blue: blue, alpha: 1.0)
    }
    return UIColor.white
  }
  
  // 更新 splash 容器的外观（深色模式切换时调用）
  private func updateSplashAppearance() {
    guard let container = splashImageViewContainer else { return }
    
    // 更新背景色
    container.backgroundColor = getCurrentBackgroundColor()
    
    // 更新图片
    if let imageView = container.subviews.first as? UIImageView {
      let imageNames = getCurrentImageNames()
      for imageName in imageNames {
        let resourceName = (imageName as NSString).deletingPathExtension
        let ext = (imageName as NSString).pathExtension
        
        if !ext.isEmpty {
          if let imagePath = Bundle.main.path(forResource: resourceName, ofType: ext),
             let image = UIImage(contentsOfFile: imagePath) {
            imageView.image = image
            print("[AppDelegate] Dark mode: image updated to \\(imageName)")
            break
          }
        }
        
        if let image = UIImage(named: imageName) {
          imageView.image = image
          print("[AppDelegate] Dark mode: image updated using UIImage(named:) \\(imageName)")
          break
        }
      }
    }
    
    print("[AppDelegate] Splash appearance updated for \\(isDarkMode() ? "dark" : "light") mode")
  }
  
  // 记录上一次的深色模式状态，用于检测变化
  private var lastDarkModeState: Bool?
  
  // 检查深色模式是否发生变化
  @objc private func checkDarkModeChange() {
    let currentDarkMode = isDarkMode()
    if lastDarkModeState != currentDarkMode {
      lastDarkModeState = currentDarkMode
      updateSplashAppearance()
    }
  }
` : '';

    // 在第一个方法之前插入属性
    const propertyCode = `
  // Splash ImageView 容器
  private var splashImageViewContainer: UIView?
  private var preventAutoHide: Bool = false
  // 定时器，用于持续确保容器在最上层（当 preventAutoHide 为 true 时）
  private var splashTopCheckTimer: Timer?
  ${darkModeSwiftCode}
  // 设置 Splash ImageView 容器
  private func setupSplashImageView() {
    guard let window = window else {
      print("[AppDelegate] setupSplashImageView - window is nil")
      return
    }
    
    // 如果容器已经存在，确保它在最上层且不阻止交互
    if let existingContainer = splashImageViewContainer {
      print("[AppDelegate] Splash ImageView container already exists, ensuring it's on top")
      existingContainer.isUserInteractionEnabled = false
      window.bringSubviewToFront(existingContainer)
      return
    }
    
    print("[AppDelegate] Creating splash ImageView container")
    
    // 创建容器 - 展示背景色
    let container = UIView(frame: window.bounds)
    // 设置背景色${hasDarkMode ? '（根据当前模式自动选择）' : ''}
    ${hasDarkMode ? 'container.backgroundColor = getCurrentBackgroundColor()' : `// 解析并设置背景色
    let bgColorHex = "${backgroundColor}"
    var bgRed: CGFloat = 1.0, bgGreen: CGFloat = 1.0, bgBlue: CGFloat = 1.0
    if bgColorHex.hasPrefix("#") {
      let hex = String(bgColorHex.dropFirst())
      if hex.count == 6, let hexValue = Int(hex, radix: 16) {
        bgRed = CGFloat((hexValue >> 16) & 0xFF) / 255.0
        bgGreen = CGFloat((hexValue >> 8) & 0xFF) / 255.0
        bgBlue = CGFloat(hexValue & 0xFF) / 255.0
      }
    }
    container.backgroundColor = UIColor(red: bgRed, green: bgGreen, blue: bgBlue, alpha: 1.0)`}
    container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    // 设置一个非常高的 zPosition，确保始终在最上层
    container.layer.zPosition = CGFloat.greatestFiniteMagnitude
    // 关键：禁用用户交互，让触摸事件穿透到底层的 RN 视图
    // 这样容器只起到视觉遮盖作用，不影响 RN 容器的正常加载和交互
    container.isUserInteractionEnabled = false
    
    // 创建 ImageView，根据 imageWidth 决定显示方式
    let imageView: UIImageView
    let imageWidth: CGFloat = ${imageWidth}  // 从参数传入
    
    if imageWidth > 0 {
      // Normal 模式：固定宽度居中显示
      imageView = UIImageView()
      imageView.contentMode = .scaleAspectFit
      imageView.clipsToBounds = true
      // ImageView 不需要交互
      imageView.isUserInteractionEnabled = false
    } else {
      // ResponsiveImage 模式：全屏背景图
      imageView = UIImageView(frame: window.bounds)
      imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      imageView.contentMode = .scaleAspectFill
      imageView.clipsToBounds = true
      // ImageView 不需要交互
      imageView.isUserInteractionEnabled = false
    }
    
    // 加载图片${hasDarkMode ? '（根据当前模式自动选择）' : ''}
    ${hasDarkMode ? 'let imageNames = getCurrentImageNames()' : `let imageNames = ["${imageFileName}", "splash_background_image", "splash-icon"]`}
    var imageLoaded = false
    
    for imageName in imageNames {
      // 移除扩展名，因为 Bundle.main.path 需要分离资源名和扩展名
      let resourceName = (imageName as NSString).deletingPathExtension
      let ext = (imageName as NSString).pathExtension
      
      if !ext.isEmpty {
        // 有扩展名，尝试使用 path(forResource:ofType:)
        if let imagePath = Bundle.main.path(forResource: resourceName, ofType: ext) {
          if let image = UIImage(contentsOfFile: imagePath) {
            imageView.image = image
            print("[AppDelegate] Image loaded successfully: \\(imageName)")
            imageLoaded = true
            break
          }
        }
      }
      
      // 尝试直接使用文件名（UIImage 会自动处理 @2x @3x）
      if let imagePath = Bundle.main.path(forResource: imageName, ofType: nil) {
        if let image = UIImage(contentsOfFile: imagePath) {
          imageView.image = image
          print("[AppDelegate] Image loaded successfully: \\(imageName)")
          imageLoaded = true
          break
        }
      }
      
      // 尝试 UIImage(named:)
      if let image = UIImage(named: imageName) {
        imageView.image = image
        print("[AppDelegate] Image loaded using UIImage(named:) \\(imageName)")
        imageLoaded = true
        break
      }
    }
    
    if !imageLoaded {
      print("[AppDelegate] Failed to load splash image, tried names: \\(imageNames)")
    }
    
    // 如果是 Normal 模式（固定宽度），设置图片尺寸和居中
    if imageWidth > 0, let image = imageView.image {
      let aspectRatio = image.size.height / image.size.width
      let imageHeight = imageWidth * aspectRatio
      imageView.frame = CGRect(
        x: (window.bounds.width - imageWidth) / 2,
        y: (window.bounds.height - imageHeight) / 2,
        width: imageWidth,
        height: imageHeight
      )
      print("[AppDelegate] Normal mode: image size set to \\(imageWidth)x\\(imageHeight), centered")
    }
    
    container.addSubview(imageView)
    splashImageViewContainer = container
    
    // 添加到 window 的最上层
    window.addSubview(container)
    window.bringSubviewToFront(container)
    
    // 强制渲染，确保容器立即可见（优化 release schema 下的显示时机）
    container.setNeedsLayout()
    container.layoutIfNeeded()
    window.setNeedsLayout()
    window.layoutIfNeeded()
    // 强制渲染 imageView
    imageView.setNeedsDisplay()
    
    // 监听通知：支持 preventAutoHideAsync 和 hideAsync
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(enablePreventAutoHide),
      name: NSNotification.Name("SplashHtmlPreventAutoHide"),
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleSplashHide),
      name: NSNotification.Name("SplashHtmlHide"),
      object: nil
    )
    ${hasDarkMode ? `
    // 监听应用变为活跃状态，检查深色模式是否变化
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(checkDarkModeChange),
      name: UIApplication.didBecomeActiveNotification,
      object: nil
    )
    
    // 记录初始深色模式状态
    lastDarkModeState = isDarkMode()
    ` : ''}
    print("[AppDelegate] Splash ImageView container added to window")
  }
  
  // 隐藏 Splash ImageView 容器（与协议 SplashImageViewContainerHiding 匹配）
  @objc func hideSplashImageViewContainer(force: Bool = false) {
    print("[AppDelegate] hideSplashImageViewContainer called, force: \\(force), preventAutoHide: \\(preventAutoHide)")
    
    // 如果 preventAutoHide 为 true 且不是强制隐藏，不执行隐藏操作
    guard !preventAutoHide || force else {
      print("[AppDelegate] hideSplashImageViewContainer prevented by preventAutoHide flag")
      // 确保容器仍然可见且在最上层
      if let window = window, let container = splashImageViewContainer {
        window.bringSubviewToFront(container)
        container.alpha = 1.0
        container.isHidden = false
        print("[AppDelegate] hideSplashImageViewContainer - Ensured container is still visible and on top")
      }
      return
    }
    
    guard let container = splashImageViewContainer else {
      print("[AppDelegate] Splash ImageView container is nil")
      return
    }
    
    print("[AppDelegate] hideSplashImageViewContainer - Proceeding with hide animation")
    
    // 停止定时器
    stopSplashTopCheckTimer()
    
    UIView.animate(withDuration: 0.3, animations: {
      container.alpha = 0.0
    }) { _ in
      print("[AppDelegate] hideSplashImageViewContainer - Animation completed, removing from superview")
      container.removeFromSuperview()
      self.splashImageViewContainer = nil
      print("[AppDelegate] Splash ImageView container hidden")
    }
  }
  
  // 防止自动隐藏（与协议 SplashImageViewContainerHiding 匹配）
  @objc func enablePreventAutoHide() {
    preventAutoHide = true
    print("[AppDelegate] enablePreventAutoHide called, preventAutoHide set to true")
    
    // 确保 imageView 容器存在且在最上层
    if let window = window {
      if let container = splashImageViewContainer {
        // 确保容器在最上层
        window.bringSubviewToFront(container)
        container.alpha = 1.0
        container.isHidden = false
        print("[AppDelegate] enablePreventAutoHide - Ensured splash container is visible and on top")
      } else {
        // 如果容器不存在，重新创建
        print("[AppDelegate] enablePreventAutoHide - Container is nil, recreating...")
        setupSplashImageView()
      }
      
      // 启动定时器，持续确保容器在最上层
      ensureSplashOnTop()
    }
  }
  
  // 持续确保 splash 容器在最上层（当 preventAutoHide 为 true 时）
  private func ensureSplashOnTop() {
    // 如果 preventAutoHide 为 false，不需要持续检查
    guard preventAutoHide else {
      stopSplashTopCheckTimer()
      return
    }
    
    // 如果定时器已经存在，不需要重复创建
    if splashTopCheckTimer != nil {
      return
    }
    
    print("[AppDelegate] ensureSplashOnTop - Starting timer to keep splash container on top")
    
    // 每 0.1 秒检查一次，确保容器始终在最上层
    splashTopCheckTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
      guard let self = self, self.preventAutoHide else {
        self?.stopSplashTopCheckTimer()
        return
      }
      
      guard let window = self.window, let container = self.splashImageViewContainer else {
        // 如果容器不存在，尝试重新创建
        if self.preventAutoHide {
          print("[AppDelegate] ensureSplashOnTop - Container is nil but preventAutoHide is true, recreating...")
          self.setupSplashImageView()
        }
        return
      }
      
      // 确保容器可见且在最上层
      window.bringSubviewToFront(container)
      container.alpha = 1.0
      container.isHidden = false
      container.layer.zPosition = CGFloat.greatestFiniteMagnitude
    }
  }
  
  // 停止定时器
  private func stopSplashTopCheckTimer() {
    splashTopCheckTimer?.invalidate()
    splashTopCheckTimer = nil
  }
  
`;
    
    content = beforeFirstMethod + propertyCode + afterFirstMethod;
  }

  // 在 didFinishLaunchingWithOptions 中添加 setupSplashImageView 调用
  // 查找 window = UIWindow 这一行
  const windowLineMatch = content.match(/window\s*=\s*UIWindow\([^)]*\)/);
  if (windowLineMatch) {
    const windowLineIndex = content.indexOf(windowLineMatch[0]);
    const windowLineEnd = windowLineIndex + windowLineMatch[0].length;
    
    // 找到这一行的末尾（下一个换行符）
    let lineEndIndex = content.indexOf('\n', windowLineEnd);
    if (lineEndIndex === -1) {
      lineEndIndex = windowLineEnd;
    }
    
    // 检查 window 创建之后是否已经有 setupSplashImageView() 调用
    // 优先在 window 创建后立即调用，确保图片容器在 window.makeKeyAndVisible() 和 factory.startReactNative() 之前就准备好（优化 release schema）
    const makeKeyAndVisibleMatch = content.indexOf('window?.makeKeyAndVisible()', lineEndIndex);
    const factoryStartMatch = content.indexOf('factory.startReactNative', lineEndIndex);
    
    // 确定插入位置：优先在 window 创建后立即插入，其次在 makeKeyAndVisible() 之前，最后在 factory.startReactNative() 之前
    let insertIndex = lineEndIndex;
    let insertBefore = 'window creation';
    
    // 检查 window 创建后到下一个关键位置之间是否已有调用
    const checkEndIndex = makeKeyAndVisibleMatch > 0 
      ? (factoryStartMatch > 0 ? Math.min(makeKeyAndVisibleMatch, factoryStartMatch) : makeKeyAndVisibleMatch)
      : (factoryStartMatch > 0 ? factoryStartMatch : lineEndIndex + 500);
    
    const contentBetween = content.substring(lineEndIndex, checkEndIndex);
    const hasSetupCallInLaunchMethod = contentBetween.includes('setupSplashImageView()');
    
    if (!hasSetupCallInLaunchMethod) {
      // 在 window 创建后立即插入（最优先，确保最早显示）
      const setupCall = `
    
    // 立即设置 Splash ImageView 容器（在 window 创建后立即调用，优化 release schema 下的显示时机，避免 RN 内容一闪而过）
    setupSplashImageView()`;
      
      content = content.substring(0, lineEndIndex) +
               setupCall +
               content.substring(lineEndIndex);
      
      console.log('[expo-splash-screen2] Added setupSplashImageView() call immediately after window creation');
    }
  } else {
    console.warn('[expo-splash-screen2] Could not find window = UIWindow pattern to insert setupSplashImageView call');
  }

  // 添加处理 hideAsync 通知的方法
  if (!content.includes('@objc func handleSplashHide')) {
    // 在 enablePreventAutoHide 方法之后添加 handleSplashHide 方法
    const enablePreventAutoHideMatch = content.match(/@objc func enablePreventAutoHide\(\) \{[\s\S]*?\n  \}/);
    if (enablePreventAutoHideMatch) {
      const enablePreventAutoHideEnd = enablePreventAutoHideMatch.index! + enablePreventAutoHideMatch[0].length;
      const handleSplashHideMethod = `
  
  // 处理 hideAsync 通知
  @objc func handleSplashHide() {
    print("[AppDelegate] handleSplashHide called from notification")
    hideSplashImageViewContainer(force: true)
  }
  
`;
      content = content.substring(0, enablePreventAutoHideEnd) + handleSplashHideMethod + content.substring(enablePreventAutoHideEnd);
    }
  }

  return content;
}

/**
 * Modify AppDelegate.swift for Blend mode (WebView container background uses .9 image)
 */
function modifyAppDelegateForBlendMode(content: string, imageFileName: string, backgroundColor: string): string {
  // Use modifyAppDelegate as base
  let modifiedContent = modifyAppDelegate(content);
  
  // Modify SplashScreen2ViewController's view background to use .9 image
  // Since SplashScreen2ViewController is in the pod, we need to add code in AppDelegate
  // to set the background image after the splash screen is shown
  
  // First, add helper function to find SplashScreen2ViewController
  const classMatch = modifiedContent.match(/(public\s+)?class\s+AppDelegate[^{]*\{/);
  if (classMatch) {
    const classIndex = modifiedContent.indexOf(classMatch[0]) + classMatch[0].length;
    const afterClass = modifiedContent.substring(classIndex);
    const firstMethodMatch = afterClass.match(/(var|let|func|override|public|private|internal)/);
    
    if (firstMethodMatch) {
      const firstMethodIndex = classIndex + firstMethodMatch.index!;
      const helperFunctionCode = `
  
  // Helper function to find SplashScreen2ViewController in view hierarchy
  private func findSplashViewController(in viewController: UIViewController) -> SplashScreen2ViewController? {
    // Check if this is the SplashScreen2ViewController
    if let splashVC = viewController as? SplashScreen2ViewController {
      return splashVC
    }
    
    // Check child view controllers
    for childVC in viewController.children {
      if let splashVC = findSplashViewController(in: childVC) {
        return splashVC
      }
    }
    
    // Check presented view controller
    if let presentedVC = viewController.presentedViewController {
      if let splashVC = findSplashViewController(in: presentedVC) {
        return splashVC
      }
    }
    
    return nil
  }
`;
      
      modifiedContent = modifiedContent.substring(0, firstMethodIndex) + helperFunctionCode + modifiedContent.substring(firstMethodIndex);
    }
  }
  
  // Look for SplashScreen2Service.shared.showSplashScreenFor call
  // Add code to set background image after showing splash screen
  const splashServicePattern = /(SplashScreen2Service\.shared\.showSplashScreenFor\([^)]+\))/;
  
  if (splashServicePattern.test(modifiedContent)) {
    // Add code to set background image after showing splash screen
    // Use DispatchQueue to ensure view is ready
    const backgroundImageCode = `
    // Set .9 image as background for blend mode
    let workItem = DispatchWorkItem { [weak self, weak splashViewController] in
      guard let self = self, let parentVC = splashViewController else { return }
      // Get splash view controller from the view hierarchy
      // Since we just called showSplashScreenFor, the splash screen should be available as a child
      if let splashVC = self.findSplashViewController(in: parentVC) {
        // Remove existing background color/image
        splashVC.view.backgroundColor = .clear
        
        // Add .9 image as background
        if let image = UIImage(named: "${imageFileName}") {
          let imageView = UIImageView(image: image)
          imageView.contentMode = .scaleAspectFill
          imageView.clipsToBounds = true
          imageView.frame = splashVC.view.bounds
          imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
          splashVC.view.insertSubview(imageView, at: 0)
          print("[AppDelegate] Set .9 image background for blend mode: ${imageFileName}")
        } else {
          print("[AppDelegate] Failed to load .9 image for blend mode: ${imageFileName}")
        }
      }
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: workItem)`;
    
    modifiedContent = modifiedContent.replace(splashServicePattern, `$1${backgroundImageCode}`);
  }
  
  return modifiedContent;
}

/**
 * 修改 AppDelegate.swift，添加自定义开屏逻辑
 */
function modifyAppDelegate(content: string): string {
  // 检查是否已经包含自定义开屏代码
  // 检查是否包含 SplashScreen2Service.shared.showSplashScreenFor，如果包含则说明已经修改过
  if (content.includes('SplashScreen2Service.shared.showSplashScreenFor') || 
      content.includes('SplashScreen2ViewController.appDelegate = self')) {
    return content;
  }

  // 添加 import ExpoSplashHtml，因为这些文件现在在插件的 pod 中
  // 检查是否已经导入
  if (!content.includes('import ExpoSplashHtml')) {
    // 在 import 语句之后添加
    const importMatch = content.match(/(import\s+\w+[\s\S]*?\n)+/);
    if (importMatch) {
      const importIndex = importMatch.index! + importMatch[0].length;
      content = content.substring(0, importIndex) + 'import ExpoSplashHtml\n' + content.substring(importIndex);
    } else {
      // 如果没有找到 import 语句，在文件开头添加
      content = 'import ExpoSplashHtml\n' + content;
    }
  }
  
  // 在 AppDelegate 类中添加属性，用于保存 React Native 的 rootViewController
  // 查找 class AppDelegate 或 public class AppDelegate
  const classMatch = content.match(/(public\s+)?class\s+AppDelegate[^{]*\{/);
  if (classMatch) {
    // 确保 AppDelegate 实现了 AppDelegateProtocol 协议
    let classDeclaration = classMatch[0];
    if (!classDeclaration.includes('AppDelegateProtocol')) {
      // 在类声明中添加协议实现
      // 如果类已经继承了其他类，在继承之后添加协议
      if (classDeclaration.includes(':')) {
        classDeclaration = classDeclaration.replace(/(\{|$)/, ', AppDelegateProtocol$1');
      } else {
        classDeclaration = classDeclaration.replace(/(\{|$)/, ': AppDelegateProtocol$1');
      }
      content = content.substring(0, classMatch.index!) + classDeclaration + content.substring(classMatch.index! + classMatch[0].length);
    }
    
    const classIndex = content.indexOf(classDeclaration) + classDeclaration.length;
    const afterClass = content.substring(classIndex);
    
    // 查找第一个方法或属性
    const firstMethodMatch = afterClass.match(/(var|let|func|override|public|private|internal)/);
    if (firstMethodMatch) {
      const firstMethodIndex = classIndex + firstMethodMatch.index!;
      const beforeFirstMethod = content.substring(0, firstMethodIndex);
      const afterFirstMethod = content.substring(firstMethodIndex);
      
      // 在第一个方法之前插入属性
      const propertyCode = `
  // 保存 React Native 的 rootViewController，用于后续切换
  private var rnRootViewController: UIViewController?
  
  // 保存 factory 和 delegate，用于后续启动 RN（当 isAuth 为 false 时，延迟启动 RN）
  private var savedFactory: RCTReactNativeFactory?
  private var savedLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?
  
  // 标记 React Native 是否正在启动，防止重复启动
  private var isReactNativeStarting: Bool = false
  
  // 启动 React Native（在用户同意隐私政策后调用）
  @objc public func startReactNativeIfNeeded() {
    print("[AppDelegate] startReactNativeIfNeeded called")
    print("[AppDelegate] startReactNativeIfNeeded - savedFactory: \\(savedFactory != nil)")
    print("[AppDelegate] startReactNativeIfNeeded - savedLaunchOptions: \\(savedLaunchOptions != nil)")
    print("[AppDelegate] startReactNativeIfNeeded - reactNativeFactory: \\(reactNativeFactory != nil)")
    print("[AppDelegate] startReactNativeIfNeeded - window: \\(window != nil)")
    print("[AppDelegate] startReactNativeIfNeeded - rnRootViewController: \\(rnRootViewController != nil)")
    print("[AppDelegate] startReactNativeIfNeeded - isReactNativeStarting: \\(isReactNativeStarting)")
    
    // 如果 RN 已经启动，不需要再次启动
    if rnRootViewController != nil {
      print("[AppDelegate] startReactNativeIfNeeded: RN already started (rnRootViewController exists)")
      return
    }
    
    // 如果 RN 正在启动，不需要再次启动
    if isReactNativeStarting {
      print("[AppDelegate] startReactNativeIfNeeded: RN is already starting, skipping")
      return
    }
    
    // 检查 window.rootViewController 是否已经是 React Native 的视图控制器
    // 如果 window.rootViewController 存在且不是临时的 splash view controller，说明 React Native 已经初始化
    if let window = window, let rootVC = window.rootViewController {
      // 检查 rootViewController 是否是 React Native 的视图控制器
      // React Native 的视图控制器通常是 RCTRootViewController 或类似的类型
      let rootVCTypeName = String(describing: type(of: rootVC))
      if rootVCTypeName.contains("RCT") || rootVCTypeName.contains("React") {
        print("[AppDelegate] startReactNativeIfNeeded: RN already initialized (window.rootViewController is React Native VC)")
        // 保存 rootViewController 以便后续使用
        self.rnRootViewController = rootVC
        return
      }
    }
    
    // 优先使用 savedFactory，如果没有则使用 reactNativeFactory
    let factory = savedFactory ?? reactNativeFactory
    let launchOptions = savedLaunchOptions ?? [:]
    
    guard let factory = factory,
          let window = window else {
      print("[AppDelegate] startReactNativeIfNeeded: factory or window is nil")
      print("[AppDelegate] startReactNativeIfNeeded - factory: \\(factory != nil), window: \\(window != nil)")
      return
    }
    
    print("[AppDelegate] startReactNativeIfNeeded: Starting React Native")
    
    // 设置标志，防止重复启动
    isReactNativeStarting = true
    
    // 启动 React Native
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    
    // 保存 React Native 的 rootViewController 并重置标志
    // 使用更长的延迟，确保 React Native 完全初始化
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
      guard let self = self, let window = self.window else { return }
      if let rnVC = window.rootViewController {
        print("[AppDelegate] startReactNativeIfNeeded: RN rootViewController created, migrating splash view")
        self.rnRootViewController = rnVC
        self.isReactNativeStarting = false
        
        // SplashScreen2Service 的 addRootViewControllerListener 已经设置了监听
        // 当 rootViewController 改变时，会自动迁移开屏视图
        // 这里只需要确保监听器正常工作即可
        print("[AppDelegate] startReactNativeIfNeeded: SplashScreen2Service will handle splash view migration automatically")
      } else {
        print("[AppDelegate] startReactNativeIfNeeded: RN rootViewController is nil, retrying...")
        // 如果 rootViewController 还是 nil，再等一会儿重试
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
          guard let self = self, let window = self.window else { return }
          if let rnVC = window.rootViewController {
            print("[AppDelegate] startReactNativeIfNeeded: RN rootViewController created on retry")
            self.rnRootViewController = rnVC
            self.isReactNativeStarting = false
          } else {
            print("[AppDelegate] startReactNativeIfNeeded: RN rootViewController still nil after retry")
            self.isReactNativeStarting = false
          }
        }
      }
    }
  }
  
  // 检查 HTML 文件中是否有隐私协议相关函数
  private func checkHtmlForPrivacyFunctions() -> Bool {
    guard let htmlPath = Bundle.main.path(forResource: "index", ofType: "html") else {
      print("[AppDelegate] HTML file not found, defaulting to show splash")
      return true // 如果文件不存在，默认显示开屏（安全起见）
    }
    
    do {
      let htmlContent = try String(contentsOfFile: htmlPath, encoding: .utf8)
      
      // 检查是否包含隐私协议相关的函数名
      let privacyFunctionNames = [
        "checkAuthStatus",
        "showPrivacyDialog",
        "hidePrivacyDialog",
        "closePrivacyDialog",
        "agreePrivacyPolicy",
        "disagreePrivacyPolicy"
      ]
      
      let hasPrivacyFunctions = privacyFunctionNames.contains { functionName in
        if !htmlContent.contains(functionName) {
          return false
        }
        // 检查是否是函数定义（更精确的匹配）
        let patterns = [
          "function " + functionName,
          functionName + "\\\\s*\\\\(",
          "const " + functionName + "\\\\s*=",
          "let " + functionName + "\\\\s*=",
          "var " + functionName + "\\\\s*="
        ]
        return patterns.contains { pattern in
          return htmlContent.range(of: pattern, options: .regularExpression) != nil
        }
      }
      
      print("[AppDelegate] HTML content check result: \\(hasPrivacyFunctions)")
      return hasPrivacyFunctions
    } catch {
      print("[AppDelegate] Error reading HTML file, defaulting to show splash: \\(error)")
      return true // 如果读取失败，默认显示开屏（安全起见）
    }
  }
  
`;
      content = beforeFirstMethod + propertyCode + afterFirstMethod;
    }
  }

  // 修改 #if 块中的 factory.startReactNative 调用，让它根据 isAuth 状态决定是否启动
  // 查找 #if os(iOS) || os(tvOS) 块中的 factory.startReactNative 调用
  // 使用更精确的匹配，确保只匹配 #if 块内的内容
  const ifBlockStartPattern = /#if\s+os\(iOS\)\s*\|\|\s*os\(tvOS\)/;
  const ifBlockEndPattern = /#endif/;
  const factoryCallPattern = /factory\.startReactNative\s*\([^)]*\)/;
  
  const ifBlockStartMatch = content.match(ifBlockStartPattern);
  const ifBlockEndMatch = content.match(ifBlockEndPattern);
  
  if (ifBlockStartMatch && ifBlockEndMatch) {
    const ifBlockStartIndex = ifBlockStartMatch.index!;
    const ifBlockEndIndex = ifBlockEndMatch.index! + ifBlockEndMatch[0].length;
    
    // 确保 #endif 在 #if 之后
    if (ifBlockEndIndex > ifBlockStartIndex) {
      const beforeIfBlock = content.substring(0, ifBlockStartIndex);
      const ifBlockContent = content.substring(ifBlockStartIndex, ifBlockEndIndex);
      const afterIfBlock = content.substring(ifBlockEndIndex);
      
      // 在 ifBlockContent 中查找 factory.startReactNative 调用
      const factoryCallMatch = ifBlockContent.match(factoryCallPattern);
      if (factoryCallMatch) {
        const factoryCallIndex = factoryCallMatch.index!;
        const beforeFactory = ifBlockContent.substring(0, factoryCallIndex);
        const afterFactory = ifBlockContent.substring(factoryCallIndex + factoryCallMatch[0].length);
        
        // 立即创建并显示自定义开屏（在应用启动的最早时刻）
        // 使用 SplashScreen2Service 显示开屏视图
        const modifiedFactoryCall = `// 创建 window
    window = UIWindow(frame: UIScreen.main.bounds)
    
    // 检查 HTML 文件中是否有隐私协议相关代码
    let hasPrivacyFunctions = self.checkHtmlForPrivacyFunctions()
    print("[AppDelegate] HTML has privacy functions: \\(hasPrivacyFunctions)")
    
    if !hasPrivacyFunctions {
      // 如果没有隐私协议代码，设置 isAuth 为 true，但仍然显示静态 HTML 开屏
      print("[AppDelegate] No privacy functions found, setting isAuth to true and showing splash screen")
      // 设置 isAuth 为 true
      UserDefaults.standard.set(true, forKey: "isAuth")
      // 注意：不直接启动 React Native，而是继续显示开屏页面
      // 开屏页面会因为 isAuth=true 而不显示隐私弹框，并自动启动 React Native
    }
    
    // 设置 AppDelegate 的引用，以便 SplashScreen2ViewController 可以调用 startReactNativeIfNeeded
    SplashScreen2ViewController.appDelegate = self
    
    // 立即创建并显示自定义开屏（在应用启动的最早时刻）
    // 创建一个临时的 rootViewController 来承载开屏视图
    let splashViewController = UIViewController()
    splashViewController.view.backgroundColor = .white
    window?.rootViewController = splashViewController
    window?.makeKeyAndVisible()
    
    // 强制加载 view（通过访问 view 属性来触发 viewDidLoad）
    // 这确保 view 已经加载完成，然后再显示开屏
    _ = splashViewController.view
    
    // 立即显示自定义 HTML 开屏（同步执行，不等待任何异步操作）
    // 这确保开屏在应用启动时立即显示，而不是等 jsbundle 加载
    // didFinishLaunchingWithOptions 已经在主线程上，所以可以直接调用
    SplashScreen2Service.shared.showSplashScreenFor(splashViewController)
    
    // 添加 rootViewController 监听，用于在 React Native 启动后迁移开屏视图
    SplashScreen2Service.shared.addRootViewControllerListener()
    
    // 强制渲染当前视图层级，确保开屏视图立即可见
    window?.rootViewController?.view.setNeedsLayout()
    window?.rootViewController?.view.layoutIfNeeded()
    window?.setNeedsLayout()
    window?.layoutIfNeeded()
    
    // 始终保存 factory 和 launchOptions，以便在用户点击同意时使用
    self.savedFactory = factory
    self.savedLaunchOptions = launchOptions
    
    // 注意：不在 AppDelegate 中检查 isAuth，统一在 SplashScreen2ViewController 中处理
    // 这样可以确保：
    // 1. isAuth=false 时，一定不会启动 React Native
    // 2. 隐私协议弹框一定会显示
    // 3. 只有用户点击同意后，才会启动 React Native
    print("[AppDelegate] didFinishLaunchingWithOptions - Saved factory and launchOptions, waiting for user agreement")
    `;
        
        const modifiedIfBlock = beforeFactory + modifiedFactoryCall + afterFactory;
        content = beforeIfBlock + modifiedIfBlock + afterIfBlock;
      }
    }
  }

  // 在 factory.startReactNative 之后、return super.application 之前添加自定义开屏逻辑
  // 查找 #endif 之后的位置
  const endifMatch = content.match(/#endif/);
  if (endifMatch) {
    const endifIndex = content.indexOf(endifMatch[0]) + endifMatch[0].length;
    const afterEndif = content.substring(endifIndex);
    
    // 查找 return super.application
    const returnSuperMatch = afterEndif.match(/return\s+super\.application\(/);
    if (returnSuperMatch) {
      const returnSuperIndex = endifIndex + returnSuperMatch.index!;
      const beforeReturn = content.substring(0, returnSuperIndex);
      const afterReturn = content.substring(returnSuperIndex);
      
      // 在 return super.application 之前插入自定义开屏代码
      // 注意：开屏视图的显示逻辑已经在 #if 块中处理，这里不需要重复代码
      // 如果 #if 块中没有找到 factory.startReactNative，说明可能没有匹配成功，这里作为备用
      const splashCode = `
    
`;
      
      return beforeReturn + splashCode + afterReturn;
    }
  }

  // 如果上面的匹配失败，尝试在 return super.application 之前插入
  const returnSuperMatch = content.match(/return\s+super\.application\(/);
  if (returnSuperMatch) {
    const returnSuperIndex = content.indexOf(returnSuperMatch[0]);
    const beforeReturn = content.substring(0, returnSuperIndex);
    const afterReturn = content.substring(returnSuperIndex);
    
    const splashCode = `
    // 显示自定义开屏（覆盖在 React Native 视图之上）
    let splashVC = SplashScreen2ViewController()
    splashVC.view.frame = window?.bounds ?? UIScreen.main.bounds
    window?.rootViewController = splashVC
    window?.makeKeyAndVisible()
    
`;
    
    return beforeReturn + splashCode + afterReturn;
  }

  return content;
}

/**
 * 将十六进制颜色转换为 storyboard 需要的格式
 */
function hexToStoryboardColor(hex: string): { red: number; green: number; blue: number; alpha: number } {
  // 移除 # 号
  hex = hex.replace('#', '');
  
  // 处理 3 位十六进制颜色
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // 解析 RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
  
  return { red: r, green: g, blue: b, alpha: a };
}

/**
 * 复制 icon 到 iOS bundle
 */
function copyIconToIOS(
  projectRoot: string,
  iconPath: string,
  iosPath: string,
  projectName: string
): string | null {
  try {
    const sourcePath = path.resolve(projectRoot, iconPath);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[expo-splash-screen2] Icon file not found: ${sourcePath}`);
      return null;
    }

    const targetDir = path.join(iosPath, projectName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 获取文件扩展名
    const ext = path.extname(sourcePath);
    const targetFileName = `splash-icon${ext}`;
    const targetPath = path.join(targetDir, targetFileName);

    fs.copyFileSync(sourcePath, targetPath);
    return targetFileName;
  } catch (error) {
    console.error(`[expo-splash-screen2] Error copying icon: ${error}`);
    return null;
  }
}

/**
 * 获取 storyboard 模板
 */
async function getTemplateAsync(): Promise<any> {
  const contents = `<?xml version="1.0" encoding="UTF-8"?>
    <document
      type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB"
      version="3.0"
      toolsVersion="16096"
      targetRuntime="iOS.CocoaTouch"
      propertyAccessControl="none"
      useAutolayout="YES"
      launchScreen="YES"
      useTraitCollections="YES"
      useSafeAreas="YES"
      colorMatched="YES"
      initialViewController="EXPO-VIEWCONTROLLER-1"
    >
      <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="16087"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
      </dependencies>
      <scenes>
        <scene sceneID="EXPO-SCENE-1">
          <objects>
            <viewController
              storyboardIdentifier="SplashScreenViewController"
              id="EXPO-VIEWCONTROLLER-1"
              sceneMemberID="viewController"
            >
              <view
                key="view"
                userInteractionEnabled="NO"
                contentMode="scaleToFill"
                insetsLayoutMarginsFromSafeArea="NO"
                id="EXPO-ContainerView"
                userLabel="ContainerView"
              >
                <rect key="frame" x="0.0" y="0.0" width="414" height="736"/>
                <autoresizingMask key="autoresizingMask" flexibleMaxX="YES" flexibleMaxY="YES"/>
                <subviews>
                  <imageView
                    userInteractionEnabled="NO"
                    contentMode="scaleAspectFill"
                    horizontalHuggingPriority="251"
                    verticalHuggingPriority="251"
                    insetsLayoutMarginsFromSafeArea="NO"
                    image="SplashScreenBackground"
                    translatesAutoresizingMaskIntoConstraints="NO"
                    id="EXPO-SplashScreenBackground"
                    userLabel="SplashScreenBackground"
                  >
                    <rect key="frame" x="0.0" y="0.0" width="414" height="736"/>
                  </imageView>
                </subviews>
                <color key="backgroundColor" systemColor="systemBackgroundColor"/>
                <constraints>
                  <constraint firstItem="EXPO-SplashScreenBackground" firstAttribute="top" secondItem="EXPO-ContainerView" secondAttribute="top" id="1gX-mQ-vu6"/>
                  <constraint firstItem="EXPO-SplashScreenBackground" firstAttribute="leading" secondItem="EXPO-ContainerView" secondAttribute="leading" id="6tX-OG-Sck"/>
                  <constraint firstItem="EXPO-SplashScreenBackground" firstAttribute="trailing" secondItem="EXPO-ContainerView" secondAttribute="trailing" id="ABX-8g-7v4"/>
                  <constraint firstItem="EXPO-SplashScreenBackground" firstAttribute="bottom" secondItem="EXPO-ContainerView" secondAttribute="bottom" id="jkI-2V-eW5"/>
                </constraints>
                <viewLayoutGuide key="safeArea" id="EXPO-SafeArea"/>
              </view>
            </viewController>
            <placeholder placeholderIdentifier="IBFirstResponder" id="EXPO-PLACEHOLDER-1" userLabel="First Responder" sceneMemberID="firstResponder"/>
          </objects>
        </scene>
      </scenes>
      <resources>
        <image name="SplashScreenBackground" width="1" height="1"/>
      </resources>
    </document>`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Parser } = require('xml2js');
    return await new Parser().parseStringPromise(contents);
  } catch {
    console.warn('[expo-splash-screen2] xml2js not available, returning empty storyboard template');
    return {} as any;
  }
}

/**
 * 解析颜色值（参考 expo-splash-screen 的 parseColor）
 */
function parseColor(value: string): { hex: string; rgb: { red: string; green: string; blue: string } } {
  const color = value.toUpperCase().replace(/[^0-9A-F]/g, '');
  if (color.length !== 3 && color.length !== 6) {
    console.error(`"${value}" value is not a valid hexadecimal color.`);
    throw new Error(`Invalid color: ${value}`);
  }
  const hex = color.length === 3 ? '#' + color[0] + color[0] + color[1] + color[1] + color[2] + color[2] : '#' + color;
  
  // 将 RGB 值转换为 0-1 范围的浮点数，并格式化为 6 位小数（iOS storyboard 标准格式）
  const formatColorValue = (val: number): string => {
    const normalized = val / 255;
    // 使用 toFixed(6) 确保 6 位小数，符合 iOS storyboard 格式要求
    return normalized.toFixed(6);
  };
  
  const rgb = {
    red: formatColorValue(parseInt(hex.substring(1, 3), 16)),
    green: formatColorValue(parseInt(hex.substring(3, 5), 16)),
    blue: formatColorValue(parseInt(hex.substring(5, 7), 16))
  };
  return { hex, rgb };
}

/**
 * 创建约束
 */
function createConstraint(
  [firstItem, firstAttribute]: [string, string],
  [secondItem, secondAttribute]: [string, string],
  constant?: string
): any {
  const constraint: any = {
    $: {
      firstItem,
      firstAttribute,
      secondItem,
      secondAttribute,
      id: `${firstItem}-${firstAttribute}-${secondItem}-${secondAttribute}`
    }
  };
  if (constant !== undefined) {
    constraint.$.constant = constant;
  }
  return constraint;
}

/**
 * 确保数组中的元素唯一（通过 id）
 */
function ensureUniquePush(array: any[], item: any): void {
  if (!array) return;
  const id = item.$?.id;
  if (id) {
    const existingIndex = array.findIndex((existingItem: any) => existingItem.$?.id === id);
    if (existingIndex > -1) {
      array.splice(existingIndex, 1);
    }
  }
  array.push(item);
}

/**
 * 将 XML 对象转换为字符串
 */
function toString(xml: any): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Builder } = require('xml2js');
    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '    ' }
    });
    return builder.buildObject(xml);
  } catch (e) {
    console.warn('[expo-splash-screen2] xml2js not available, skipping XML serialization');
    return '';
  }
}

/**
 * 创建 Asset Catalog imageset 用于支持深色模式
 */
function createAssetCatalogImageset(
  iosPath: string,
  projectName: string,
  lightImagePath: string,
  darkImagePath: string | null,
  imagesetName: string = 'splash-icon'
): void {
  const imagesetDir = path.join(iosPath, projectName, 'Images.xcassets', `${imagesetName}.imageset`);
  
  // 创建 imageset 目录
  if (!fs.existsSync(imagesetDir)) {
    fs.mkdirSync(imagesetDir, { recursive: true });
  }
  
  // 复制浅色模式图片
  const lightImageFileName = path.basename(lightImagePath);
  const lightImageTarget = path.join(imagesetDir, lightImageFileName);
  if (fs.existsSync(lightImagePath)) {
    fs.copyFileSync(lightImagePath, lightImageTarget);
  }
  
  // 复制深色模式图片（如果存在）
  let darkImageFileName: string | null = null;
  if (darkImagePath && fs.existsSync(darkImagePath)) {
    darkImageFileName = path.basename(darkImagePath);
    const darkImageTarget = path.join(imagesetDir, darkImageFileName);
    fs.copyFileSync(darkImagePath, darkImageTarget);
  }
  
  // 创建 Contents.json
  const contentsJson: any = {
    images: [
      {
        filename: lightImageFileName,
        idiom: 'universal'
      }
    ],
    info: {
      author: 'xcode',
      version: 1
    }
  };
  
  // 如果有深色模式图片，添加深色模式配置
  if (darkImageFileName) {
    contentsJson.images.push({
      appearances: [
        {
          appearance: 'luminosity',
          value: 'dark'
        }
      ],
      filename: darkImageFileName,
      idiom: 'universal'
    });
  }
  
  // 写入 Contents.json
  const contentsJsonPath = path.join(imagesetDir, 'Contents.json');
  fs.writeFileSync(contentsJsonPath, JSON.stringify(contentsJson, null, 2));
  
  console.log(`[expo-splash-screen2] Created Asset Catalog imageset: ${imagesetName}.imageset`);
}

/**
 * 创建 Asset Catalog colorset 用于支持深色模式背景色
 */
function createAssetCatalogColorset(
  iosPath: string,
  projectName: string,
  lightBackgroundColor: string,
  darkBackgroundColor: string | null,
  colorsetName: string = 'SplashScreenBackground'
): void {
  const colorsetDir = path.join(iosPath, projectName, 'Images.xcassets', `${colorsetName}.colorset`);
  
  // 创建 colorset 目录
  if (!fs.existsSync(colorsetDir)) {
    fs.mkdirSync(colorsetDir, { recursive: true });
  }
  
  // 解析浅色模式颜色
  const lightColor = parseColor(lightBackgroundColor);
  
  // 创建 Contents.json
  const contentsJson: any = {
    colors: [
      {
        idiom: 'universal',
        color: {
          'color-space': 'srgb',
          components: {
            red: lightColor.rgb.red,
            green: lightColor.rgb.green,
            blue: lightColor.rgb.blue,
            alpha: '1.000'
          }
        }
      }
    ],
    info: {
      author: 'xcode',
      version: 1
    }
  };
  
  // 如果有深色模式背景色，添加深色模式配置
  if (darkBackgroundColor) {
    const darkColor = parseColor(darkBackgroundColor);
    contentsJson.colors.push({
      idiom: 'universal',
      appearances: [
        {
          appearance: 'luminosity',
          value: 'dark'
        }
      ],
      color: {
        'color-space': 'srgb',
        components: {
          red: darkColor.rgb.red,
          green: darkColor.rgb.green,
          blue: darkColor.rgb.blue,
          alpha: '1.000'
        }
      }
    });
  }
  
  // 写入 Contents.json
  const contentsJsonPath = path.join(colorsetDir, 'Contents.json');
  fs.writeFileSync(contentsJsonPath, JSON.stringify(contentsJson, null, 2));
  
  console.log(`[expo-splash-screen2] Created Asset Catalog colorset: ${colorsetName}.colorset`);
}

/**
 * 应用 splash screen 配置到 storyboard XML（参考 expo-splash-screen 的 applyImageToSplashScreenXML）
 */
function applySplashScreenStoryboard(
  xml: any,
  backgroundColor: string,
  iconFileName: string | null,
  imageWidth: number = 100,
  mode: 'normal' | 'webview' | 'responsiveImage' = 'webview',
  darkIconFileName: string | null = null,
  darkBackgroundColor: string | null = null,
  darkImageWidth: number = 100
): any {
  // 安全检查 XML 结构 - 如果结构不完整，直接返回，让 read 函数处理
  if (!xml || !xml.document) {
    console.error('[expo-splash-screen2] Invalid XML structure: xml.document is missing');
    return xml;
  }
  
  if (!xml.document.scenes || !Array.isArray(xml.document.scenes) || !xml.document.scenes[0]) {
    console.error('[expo-splash-screen2] Invalid XML structure: xml.document.scenes is missing or empty');
    return xml;
  }
  
  if (!xml.document.scenes[0].scene || !Array.isArray(xml.document.scenes[0].scene) || !xml.document.scenes[0].scene[0]) {
    console.error('[expo-splash-screen2] Invalid XML structure: xml.document.scenes[0].scene is missing or empty');
    return xml;
  }
  
  if (!xml.document.scenes[0].scene[0].objects || !Array.isArray(xml.document.scenes[0].scene[0].objects) || !xml.document.scenes[0].scene[0].objects[0]) {
    console.error('[expo-splash-screen2] Invalid XML structure: xml.document.scenes[0].scene[0].objects is missing or empty');
    return xml;
  }
  
  if (!xml.document.scenes[0].scene[0].objects[0].viewController || !Array.isArray(xml.document.scenes[0].scene[0].objects[0].viewController) || !xml.document.scenes[0].scene[0].objects[0].viewController[0]) {
    console.error('[expo-splash-screen2] Invalid XML structure: xml.document.scenes[0].scene[0].objects[0].viewController is missing or empty');
    return xml;
  }
  
  if (!xml.document.scenes[0].scene[0].objects[0].viewController[0].view || !Array.isArray(xml.document.scenes[0].scene[0].objects[0].viewController[0].view) || !xml.document.scenes[0].scene[0].objects[0].viewController[0].view[0]) {
    console.error('[expo-splash-screen2] Invalid XML structure: xml.document.scenes[0].scene[0].objects[0].viewController[0].view is missing or empty');
    return xml;
  }
  
  const mainView = xml.document.scenes[0].scene[0].objects[0].viewController[0].view[0];
  
  // 确保 subviews 数组存在（如果不存在，创建它）
  // 注意：xml2js 解析时，如果原始 XML 没有 <subviews> 标签，subviews 可能是 undefined
  if (!mainView.subviews) {
    mainView.subviews = [{ imageView: [] }];
  } else if (!mainView.subviews[0]) {
    mainView.subviews[0] = { imageView: [] };
  } else if (!mainView.subviews[0].imageView) {
    mainView.subviews[0].imageView = [];
  }
  
  // 确保 constraints 数组存在（如果不存在，创建它）
  if (!mainView.constraints) {
    mainView.constraints = [{}];
  }
  if (!mainView.constraints[0]) {
    mainView.constraints[0] = {};
  }
  if (!mainView.constraints[0].constraint) {
    mainView.constraints[0].constraint = [];
  }
  
  // 确保 resources 数组存在
  if (!xml.document.resources) {
    xml.document.resources = [{}];
  }
  if (!xml.document.resources[0]) {
    xml.document.resources[0] = {};
  }
  
  // 如果有 icon 或背景图，添加 ImageView
  if (iconFileName) {
    // 使用完整的文件名（包含扩展名），因为 Xcode 需要完整的文件名
    const iconName = path.basename(iconFileName);
    const iconNameWithoutExt = path.basename(iconFileName, path.extname(iconFileName));
    
    // 判断是背景图模式（imageWidth === 0）还是 icon 模式
    const isBackgroundImageMode = imageWidth === 0;
    
    // 安全获取 view 的尺寸，如果 rect 不存在，使用默认值
    let viewWidth = 414; // 默认宽度
    let viewHeight = 736; // 默认高度
    if (mainView.rect && Array.isArray(mainView.rect) && mainView.rect[0] && mainView.rect[0].$) {
      viewWidth = parseFloat(mainView.rect[0].$.width) || viewWidth;
      viewHeight = parseFloat(mainView.rect[0].$.height) || viewHeight;
    }
    
    let imageView: any;
    
    if (isBackgroundImageMode) {
      // 背景图模式：全屏显示
      // 配置 imageView，支持深色模式 appearance
      imageView = {
        $: {
          id: IMAGE_ID,
          userLabel: iconNameWithoutExt,
          contentMode: 'scaleAspectFill', // 全屏填充
          clipsSubviews: 'YES',
          userInteractionEnabled: 'NO',
          translatesAutoresizingMaskIntoConstraints: 'NO'
        },
        rect: [{
          $: {
            key: 'frame',
            x: '0.0',
            y: '0.0',
            width: viewWidth.toString(),
            height: viewHeight.toString()
          }
        }]
      };
      
      // 使用 Asset Catalog imageset 名称（不包含扩展名）
      // 如果配置了深色模式，imageset 会自动处理 appearance 切换
      const imagesetName = iconNameWithoutExt; // 使用不带扩展名的名称作为 imageset 名称
      imageView.$['image'] = imagesetName;
      
      // 添加 ImageView
      ensureUniquePush(mainView.subviews[0].imageView, imageView);
      
      // 清空现有约束并添加全屏约束
      mainView.constraints[0].constraint = [];
      ensureUniquePush(
        mainView.constraints[0].constraint,
        createConstraint([IMAGE_ID, 'top'], [CONTAINER_ID, 'top'])
      );
      ensureUniquePush(
        mainView.constraints[0].constraint,
        createConstraint([IMAGE_ID, 'leading'], [CONTAINER_ID, 'leading'])
      );
      ensureUniquePush(
        mainView.constraints[0].constraint,
        createConstraint([IMAGE_ID, 'trailing'], [CONTAINER_ID, 'trailing'])
      );
      ensureUniquePush(
        mainView.constraints[0].constraint,
        createConstraint([IMAGE_ID, 'bottom'], [CONTAINER_ID, 'bottom'])
      );
    } else {
      // Icon 模式：居中显示
      const width = imageWidth;
      const height = imageWidth;
      const x = (viewWidth - width) / 2;
      const y = (viewHeight - height) / 2;
      
      // 配置 imageView，支持深色模式 appearance
      imageView = {
        $: {
          id: IMAGE_ID,
          userLabel: iconNameWithoutExt,
          contentMode: 'scaleAspectFit',
          clipsSubviews: 'YES',
          userInteractionEnabled: 'NO',
          translatesAutoresizingMaskIntoConstraints: 'NO'
        },
        rect: [{
          $: {
            key: 'frame',
            x: x.toString(),
            y: y.toString(),
            width: width.toString(),
            height: height.toString()
          }
        }]
      };
      
      // 使用 Asset Catalog imageset 名称（不包含扩展名）
      // 如果配置了深色模式，imageset 会自动处理 appearance 切换
      const imagesetName = iconNameWithoutExt; // 使用不带扩展名的名称作为 imageset 名称
      imageView.$['image'] = imagesetName;
      
      // 添加 ImageView
      ensureUniquePush(mainView.subviews[0].imageView, imageView);
      
      // 清空现有约束并添加新的居中约束和尺寸约束
      mainView.constraints[0].constraint = [];
      ensureUniquePush(
        mainView.constraints[0].constraint,
        createConstraint([IMAGE_ID, 'centerX'], [CONTAINER_ID, 'centerX'])
      );
      ensureUniquePush(
        mainView.constraints[0].constraint,
        createConstraint([IMAGE_ID, 'centerY'], [CONTAINER_ID, 'centerY'])
      );
      // 添加宽度约束
      ensureUniquePush(
        mainView.constraints[0].constraint,
        {
          $: {
            firstItem: IMAGE_ID,
            firstAttribute: 'width',
            constant: width.toString(),
            id: `${IMAGE_ID}-width`
          }
        }
      );
      // 添加高度约束
      ensureUniquePush(
        mainView.constraints[0].constraint,
        {
          $: {
            firstItem: IMAGE_ID,
            firstAttribute: 'height',
            constant: height.toString(),
            id: `${IMAGE_ID}-height`
          }
        }
      );
    }
    
    // 添加图片资源（引用 Asset Catalog imageset，使用不带扩展名的名称）
    // 确保 resources 数组和第一个元素存在
    if (!xml.document.resources) {
      xml.document.resources = [{}];
    }
    if (!xml.document.resources[0]) {
      xml.document.resources[0] = {};
    }
    if (!xml.document.resources[0].image) {
      xml.document.resources[0].image = [];
    }
    // 移除同名的图片资源（如果存在）
    const imagesetName = iconNameWithoutExt; // 使用不带扩展名的名称作为 imageset 名称
    xml.document.resources[0].image = xml.document.resources[0].image.filter(
      (img: any) => img.$?.name !== imagesetName
    );
    // 添加 imageset 资源引用（Asset Catalog 会自动处理深色模式）
    const imageResource: any = {
      $: {
        name: imagesetName
      }
    };
    if (!isBackgroundImageMode) {
      // Icon 模式才需要设置尺寸
      imageResource.$.width = imageWidth.toString();
      imageResource.$.height = imageWidth.toString();
    }
    xml.document.resources[0].image.push(imageResource);
  } else {
    // 如果没有 icon，移除 ImageView
    if (mainView.subviews && mainView.subviews[0] && mainView.subviews[0].imageView) {
      mainView.subviews[0].imageView = mainView.subviews[0].imageView.filter(
        (img: any) => img.$?.id !== IMAGE_ID
      );
    }
    // 移除相关约束
    if (mainView.constraints && mainView.constraints[0] && mainView.constraints[0].constraint) {
      mainView.constraints[0].constraint = mainView.constraints[0].constraint.filter(
        (c: any) => c.$?.firstItem !== IMAGE_ID && c.$?.secondItem !== IMAGE_ID
      );
    }
  }
  
  // 设置背景色 - 仅在非 responsiveImage 模式下设置
  // responsiveImage 模式只显示图片，不设置背景色
  if (mode !== 'responsiveImage') {
    // 设置背景色引用 namedColor（namedColor 在 Asset Catalog 中定义，不在 storyboard XML 中定义）
    // normal 模式下，colorset 会在 withDangerousMod 中创建
    // webview 模式下，使用浅色背景色（不支持深色模式）
    mainView.color = [{
      $: {
        key: 'backgroundColor',
        name: 'SplashScreenBackground'
      }
    }];
  }
  
  return xml;
}

/**
 * 提供 SplashScreen.storyboard 的 BaseMod
 */
const withIosSplashScreenStoryboard = (config: any, action: (config: any) => any) => {
  return withMod(config, {
    platform: 'ios',
    mod: STORYBOARD_MOD_NAME,
    action
  });
};

/**
 * 注册 SplashScreen.storyboard 的 BaseMod provider
 */
const withIosSplashScreenStoryboardBaseMod = (config: any) => {
  return BaseMods.withGeneratedBaseMods(config, {
    platform: 'ios',
    saveToInternal: true,
    skipEmptyMod: false,
    providers: {
      [STORYBOARD_MOD_NAME]: BaseMods.provider({
        isIntrospective: true,
        async getFilePath({ modRequest }) {
          return path.join(
            modRequest.platformProjectRoot,
            modRequest.projectName || 'MyNewExpoSplashDemo',
            STORYBOARD_FILE_PATH
          );
        },
        async read(filePath) {
          try {
            const contents = await fs.promises.readFile(filePath, 'utf8');
            try {
              const { Parser } = require('xml2js');
              const xml = await new Parser().parseStringPromise(contents);
              
              // 验证 XML 结构是否完整
              if (!xml || !xml.document) {
                console.warn('[expo-splash-screen2] Invalid XML structure: xml.document is missing, using template');
                return getTemplateAsync();
              }
              
              // 验证关键结构是否存在
              if (!xml.document.scenes || !Array.isArray(xml.document.scenes) || !xml.document.scenes[0]) {
                console.warn('[expo-splash-screen2] Invalid XML structure: scenes missing, using template');
                return getTemplateAsync();
              }
              
              // 确保 resources 结构完整（修复而不是返回模板）
              if (!xml.document.resources) {
                xml.document.resources = [{}];
              }
              if (!Array.isArray(xml.document.resources)) {
                xml.document.resources = [xml.document.resources];
              }
              if (!xml.document.resources[0]) {
                xml.document.resources[0] = {};
              }
              
              // 确保 resources[0] 有必要的属性
              if (!xml.document.resources[0].image) {
                xml.document.resources[0].image = [];
              }
              if (!xml.document.resources[0].namedColor) {
                xml.document.resources[0].namedColor = [];
              }
              
              return xml;
            } catch (parseError) {
              console.warn(`[expo-splash-screen2] Failed to parse XML: ${parseError}, using template`);
              return getTemplateAsync();
            }
          } catch (readError) {
            // 文件不存在或读取失败，使用模板
            console.warn(`[expo-splash-screen2] Failed to read storyboard file: ${readError}, using template`);
            return getTemplateAsync();
          }
        },
        async write(filePath, { modResults, modRequest: { introspect } }) {
          if (introspect) {
            return;
          }
          await fs.promises.writeFile(filePath, toString(modResults));
        }
      })
    }
  });
};


/**
 * 修改 Info.plist
 * 参考 expo-splash-screen 的实现方式，添加状态栏隐藏等配置
 */
function modifyInfoPlist(plist: any): any {
  // 确保 HTML 文件被包含在 bundle 中
  // Info.plist 不需要特殊修改，文件会自动包含在 bundle 中
  
  // 添加状态栏隐藏配置（可选，因为代码中已经设置了 prefersStatusBarHidden）
  // 如果需要全局隐藏状态栏，可以取消下面的注释
  // if (!plist.UIStatusBarHidden) {
  //   plist.UIStatusBarHidden = true;
  // }
  
  return plist;
}

/**
 * 修改 Xcode 项目，添加自定义 Splash 文件引用
 * 参考 expo withXcodeProject 的标准实现
 */
/**
 * 添加 Swift 源文件到 Xcode 项目
 * 参考 Realm 插件的实现方式
 */
const addSplashSourceFiles = (
  proj: XcodeProject,
  projectName: string,
  iosPath: string,
  projectRoot: string
) => {
  const sourceFiles = [
    'SplashScreen2ViewController.swift',
    'SplashScreen2PrivacyPolicyViewController.swift',
    'SplashScreen2Module.swift',
    'SplashScreen2Service.swift'
  ];

  sourceFiles.forEach((fileName) => {
    // 文件直接生成在 iOS 项目目录
    const filePath = path.join(iosPath, projectName, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`[expo-splash-screen2] Swift file ${fileName} does not exist at ${filePath}, skipping`);
      return;
    }
    
    // 文件路径相对于 group（与 AppDelegate.swift 等文件保持一致）
    const relativeFilePath = `${projectName}/${fileName}`;
    
    // 检查文件是否已存在（尝试两种路径格式）
    if (proj.hasFile(relativeFilePath) || proj.hasFile(`../${projectName}/${fileName}`)) {
      return;
    }

    try {
      // 获取 target 和 group
      const target = proj.getFirstTarget();
      if (!target) {
        console.error(`[expo-splash-screen2] Failed to find target for source file ${fileName}`);
        return;
      }
      const groupUuid = proj.findPBXGroupKey({ name: projectName });
      if (!groupUuid) {
        console.error(`[expo-splash-screen2] Failed to find group "${projectName}" for source file ${fileName}`);
        return;
      }
      
      // 使用 proj.addSourceFile 添加源文件
      proj.addSourceFile(
        `${projectName}/${fileName}`,
        { target: target.uuid },
        groupUuid
      );
    } catch (error) {
      console.error(`[expo-splash-screen2] Error adding source file ${fileName}:`, error);
    }
  });
};

/**
 * 添加资源文件到 Xcode 项目
 * 参考 Realm 插件的实现方式
 */
const addSplashResourceFiles = (
  proj: XcodeProject,
  projectName: string,
  iosPath: string,
  projectRoot: string,
  pluginConfig: SplashHtmlConfig | null | undefined,
  config?: any
) => {
  // 基础资源文件
  const resourceFiles = ['index.html'];
  
  // 添加 icon 文件（如果配置了 icon）
  if (config?.icon) {
    const iconPath = path.resolve(projectRoot, config.icon);
    if (fs.existsSync(iconPath)) {
      const iconExt = path.extname(iconPath);
      const iconFileName = `splash-icon${iconExt}`;
      const iconTargetPath = path.join(iosPath, projectName, iconFileName);
      if (fs.existsSync(iconTargetPath)) {
        resourceFiles.push(iconFileName);
      }
    }
  }
  
  // 直接扫描 iOS 项目目录中已复制的图片文件
  // copyHtmlFileForIOS 已经将图片复制到 ios/projectName/ 目录下
  const iosProjectDir = path.join(iosPath, projectName);
  console.log(`[expo-splash-screen2] Scanning iOS project directory for images: ${iosProjectDir}`);
  
  if (fs.existsSync(iosProjectDir)) {
    try {
      const allFiles = fs.readdirSync(iosProjectDir);
      const imageFiles = allFiles.filter(f => 
        /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f)
      );
      console.log(`[expo-splash-screen2] Found image files in iOS project: ${imageFiles.join(', ') || 'none'}`);
      
      // 添加图片文件到资源列表（去重）
      imageFiles.forEach(imgFile => {
        if (!resourceFiles.includes(imgFile)) {
          resourceFiles.push(imgFile);
        }
      });
    } catch (error) {
      console.warn(`[expo-splash-screen2] Error scanning iOS project directory: ${error}`);
    }
  }
  
  // 备用：从 HTML 中提取图片文件
  // 优先使用构建后的 HTML 文件路径（dist/index.html）
  const sourceDir = 'expo-splash-web';
  const distHtmlPath = path.join(projectRoot, sourceDir, 'dist', 'index.html');
  const htmlSourcePath = fs.existsSync(distHtmlPath) 
    ? distHtmlPath 
    : path.resolve(projectRoot, pluginConfig?.localHtmlPath || 'assets/html/index.html');
  
  if (fs.existsSync(htmlSourcePath)) {
    const htmlContent = fs.readFileSync(htmlSourcePath, 'utf-8');
    const htmlDir = path.dirname(htmlSourcePath);
    const imagePaths = extractImagePaths(htmlContent, htmlDir);
    
    // 检查 HTML 文件所在目录是否有 assets 子目录（构建后的图片目录）
    const assetsDir = path.join(htmlDir, 'assets');
    if (fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory()) {
      // 从 assets 目录中读取所有图片文件
      const imageFiles = fs.readdirSync(assetsDir).filter(f => 
        /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f)
      );
      imageFiles.forEach(imgFile => {
        if (!resourceFiles.includes(imgFile)) {
          resourceFiles.push(imgFile);
        }
      });
    }
    
    // 兼容：也检查 images 子目录
    const imagesDir = path.join(htmlDir, 'images');
    if (fs.existsSync(imagesDir) && fs.statSync(imagesDir).isDirectory()) {
      const imageFiles = fs.readdirSync(imagesDir).filter(f => 
        /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f)
      );
      imageFiles.forEach(imgFile => {
        if (!resourceFiles.includes(imgFile)) {
          resourceFiles.push(imgFile);
        }
      });
    }
    
    // 如果 assets 和 images 目录都没有，使用从 HTML 中提取的图片路径
    if (!fs.existsSync(assetsDir) && !fs.existsSync(imagesDir)) {
      const imageFiles = imagePaths.map(({ absolute }) => path.basename(absolute));
      imageFiles.forEach(imgFile => {
        if (!resourceFiles.includes(imgFile)) {
          resourceFiles.push(imgFile);
        }
      });
    }
  }
  
  console.log(`[expo-splash-screen2] Final resource files to add to Xcode: ${resourceFiles.join(', ')}`);
  

  resourceFiles.forEach((fileName) => {
    const filePath = path.join(iosPath, projectName, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`[expo-splash-screen2] Resource file ${fileName} does not exist, skipping`);
      return;
    }

    // 文件路径相对于 group（与 AppDelegate.swift 等文件保持一致）
    // 当 sourceTree = "<group>" 时，路径应该是相对于 group 的，格式为：projectName/fileName
    const relativeFilePath = `${projectName}/${fileName}`;
    
    // 检查文件是否已存在（尝试两种路径格式）
    if (proj.hasFile(relativeFilePath) || proj.hasFile(`../${projectName}/${fileName}`)) {
      return;
    }

    try {
      // 使用 IOSConfig.XcodeUtils 添加资源文件
      // PNG 和 HTML 这类静态资源文件应该使用 addResourceFileToGroup
      // 路径格式应该与 AppDelegate.swift 等文件保持一致：projectName/fileName
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: relativeFilePath,
        groupName: projectName,
        project: proj,
        isBuildFile: true,
      });
    } catch (error) {
      console.error(`[expo-splash-screen2] Error adding resource file ${fileName}:`, error);
    }
  });
};

/**
 * 修改 Xcode 项目，添加自定义 Splash 文件引用
 * 参考 Realm 插件的实现方式
 */
function modifyXcodeProject(
  config: { modResults: XcodeProject; modRequest: { projectRoot: string; projectName?: string } },
  pluginConfig?: SplashHtmlConfig | null,
  appConfig?: any
): XcodeProject {
  const proj = config.modResults;
  const projectRoot = config.modRequest.projectRoot;
  const projectName = config.modRequest.projectName;
  
  if (!projectName) {
    console.warn('[expo-splash-screen2] Project name not found, skipping file addition');
    return proj;
  }
  
  const iosPath = path.join(projectRoot, 'ios');
  
  try {
    // 不再添加 Swift 源文件到 Xcode 项目，因为这些文件现在在插件的 pod 中
    // 通过 ExpoSplashHtml pod 自动包含，不需要手动添加到项目
    // addSplashSourceFiles(proj, projectName, iosPath, projectRoot);
    
    // 添加资源文件（包括 icon）
    addSplashResourceFiles(proj, projectName, iosPath, projectRoot, pluginConfig, appConfig);
  } catch (error) {
    console.error('[expo-splash-screen2] Error modifying Xcode project:', error);
  }
  
  return proj;
}

export const withSplashHtml: ConfigPlugin<SplashHtmlConfig> = (config, props) => {
  const pluginConfig = props || getSplashHtmlConfig(config);

  if (!pluginConfig) {
    return config;
  }

  // 判断模式：默认为 normal 模式
  const mode = pluginConfig.mode || 'normal';
  
  let resultConfig: any;
  if (mode === 'responsiveImage') {
    // 响应式图片模式
    resultConfig = setupImageMode(config, pluginConfig);
  } else if (mode === 'normal') {
    // 普通图片模式（新增）
    resultConfig = setupNormalMode(config, pluginConfig);
  } else if (mode === 'webview') {
    // WebView HTML 模式
    // 如果传了 localHtmlPath，使用 localHtmlPath
    // 如果没传 localHtmlPath，对 expo-splash-web 进行打包
    resultConfig = setupWebViewMode(config, pluginConfig);
  } else if (mode === 'blend') {
    // Blend 模式：.9图背景 + WebView自定义开屏
    resultConfig = setupBlendMode(config, pluginConfig);
  } else {
    console.warn(`[expo-splash-screen2] Unknown mode: ${mode}`);
    return config;
  }
  
  // 在最后再次确保 storyboard 被修改（在所有其他插件之后运行）
  // 这样可以覆盖 expo-splash-screen 等插件的默认配置
  // 注意：responsiveImage 和 normal 模式已经在各自的 setup 函数中处理了 storyboard
  if (mode === 'webview' && resultConfig) {
    const backgroundColor = pluginConfig?.backgroundColor || 
                            config.splash?.backgroundColor || 
                            '#ffffff';
    const imagePath = pluginConfig?.image;
    const imageWidth = pluginConfig?.imageWidth ?? 100;
    
    // 如果配置了 image，先复制 icon 到 iOS bundle
    // 同时创建 colorset 用于背景色（webview 模式只支持浅色模式）
    resultConfig = withDangerousMod(resultConfig, [
      'ios',
      async (cfg) => {
        const projectRoot = cfg.modRequest.projectRoot || '';
        const iosPath = path.join(projectRoot, 'ios');
        const projectName = cfg.modRequest.projectName || 'MyNewExpoSplashDemo';
        
        if (imagePath) {
          copyIconToIOS(projectRoot, imagePath, iosPath, projectName);
        }
        
        // 创建 colorset 用于背景色（webview 模式只支持浅色模式）
        // 确保 Images.xcassets 目录存在
        const xcassetsPath = path.join(iosPath, projectName, 'Images.xcassets');
        if (!fs.existsSync(xcassetsPath)) {
          fs.mkdirSync(xcassetsPath, { recursive: true });
          // 创建 Contents.json
          const xcassetsContents = {
            info: {
              version: 1,
              author: 'xcode'
            }
          };
          fs.writeFileSync(
            path.join(xcassetsPath, 'Contents.json'),
            JSON.stringify(xcassetsContents, null, 2)
          );
        }
        
        // 创建 colorset（只包含浅色模式）
        createAssetCatalogColorset(
          iosPath,
          projectName,
          backgroundColor,
          null, // webview 模式不支持深色模式
          'SplashScreenBackground'
        );
        
        return cfg;
      },
    ]);
    
    resultConfig = withIosSplashScreenStoryboard(resultConfig, async (cfg) => {
      console.log('[expo-splash-screen2] Final storyboard modification (WebView mode), backgroundColor:', backgroundColor);
      const xml = cfg.modResults;
      const projectRoot = cfg.modRequest.projectRoot || '';
      
      // 如果配置了 image，使用复制后的文件名；否则传 null
      let iconFileName: string | null = null;
      if (imagePath) {
        const ext = path.extname(imagePath);
        iconFileName = `splash-icon${ext}`;
        console.log('[expo-splash-screen2] WebView mode: using image from config, iconFileName:', iconFileName);
      } else {
        console.log('[expo-splash-screen2] WebView mode: no icon, pure backgroundColor only');
      }
      
      // webview 模式：backgroundColor + image（可选）+ imageWidth（默认100，居中）
      // 不支持深色模式
      const finalImageWidth = imageWidth || 100;
      const modifiedXml = applySplashScreenStoryboard(
        xml,
        backgroundColor,
        iconFileName,
        finalImageWidth,
        'webview'
      );
      
      cfg.modResults = modifiedXml;
      return cfg;
    });
  }

  // 最终修复：使用 withAndroidStyles 确保在所有插件之后执行（防止被其他插件覆盖）
  if (mode === 'responsiveImage' && resultConfig) {
    resultConfig = withAndroidStyles(resultConfig, (config) => {
      // withAndroidStyles 提供 modResults，直接使用它
      if (!config.modResults) {
        return config;
      }

      const stylesJSON = config.modResults;

      // 确保 resources 和 style 数组存在
      if (!stylesJSON.resources) {
        stylesJSON.resources = {};
      }
      if (!stylesJSON.resources.style) {
        stylesJSON.resources.style = [];
      }

      // 确保 style 是数组
      if (!Array.isArray(stylesJSON.resources.style)) {
        stylesJSON.resources.style = [];
      }

      // 检查是否已经被覆盖
      const hasCorrectValue = stylesJSON.resources.style.some(
        (style: any) =>
          style?.$?.name === 'Theme.App.SplashScreen' &&
          style.item?.some(
            (item: any) =>
              item.$?.name === 'android:windowBackground' &&
              item._ === '@drawable/splash_background_image'
          )
      );

      if (!hasCorrectValue) {
        // 修改 styles
        stylesJSON.resources.style = modifyStylesForImageMode(
          stylesJSON.resources.style
        );
      }

      return config;
    });
  }

  return resultConfig || config;
};

/**
 * 设置图片背景模式
 */
function setupImageMode(config: any, pluginConfig: SplashHtmlConfig): any {
  const packageName = config.android?.package || 'com.anonymous.MyNewExpoSplashDemo';
  const bundleIdentifier = config.ios?.bundleIdentifier || 'com.anonymous.MyNewExpoSplashDemo';
  
  if (!pluginConfig.image) {
    console.warn('[expo-splash-screen2] image is required for responsiveImage mode');
    return config;
  }
  
  // 注意：不注册 BaseMod provider，因为 Expo 的默认插件已经注册了
  // 我们直接使用 withIosSplashScreenStoryboard 修改 storyboard

  // ========== Android 图片模式 ==========
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const androidMainPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main'
      );

      const androidDir = path.join(projectRoot, 'android');
      if (!fs.existsSync(androidDir)) {
        console.warn('[expo-splash-screen2] Android directory does not exist yet. Skipping setup.');
        return config;
      }

      if (!fs.existsSync(androidMainPath)) {
        fs.mkdirSync(androidMainPath, { recursive: true });
      }

      // 复制背景图到 Android 资源目录
      const imageResourceName = copyBackgroundImage(
        projectRoot,
        pluginConfig.image!,
        androidMainPath
      );

      if (!imageResourceName) {
        console.warn('[expo-splash-screen2] Failed to copy background image, skipping Android setup');
        return config;
      }

      // 更新 ic_launcher_background.xml，只显示背景图（.9 图），不显示 icon
      updateIcLauncherBackgroundForImageMode(androidMainPath, imageResourceName);

      // 创建颜色资源文件（支持系统启动画面深色模式）
      // responsiveImage 模式目前不支持 dark 配置，所以只设置浅色模式背景色
      createSplashColorsXml(androidMainPath, pluginConfig.backgroundColor || '#ffffff');

      return config;
    },
  ]);

  // 使用 withAndroidStyles 修改 styles.xml（推荐方式，不会被其他插件覆盖）
  config = withAndroidStyles(config, (config) => {
    // withAndroidStyles 提供 modResults，直接使用它
    if (!config.modResults) {
      return config;
    }

    const stylesJSON = config.modResults;

    // 确保 resources 和 style 数组存在
    if (!stylesJSON.resources) {
      stylesJSON.resources = {};
    }
    if (!stylesJSON.resources.style) {
      stylesJSON.resources.style = [];
    }

    // 确保 style 是数组
    if (!Array.isArray(stylesJSON.resources.style)) {
      stylesJSON.resources.style = [];
    }

    // 修改 styles
    stylesJSON.resources.style = modifyStylesForImageMode(
      stylesJSON.resources.style
    );

    return config;
  });

  // 修改 MainActivity.kt，添加图片容器
  config = withMainActivity(config, (config) => {
    const imageResourceName = 'splash_background_image';
    config.modResults.contents = modifyMainActivityForImageMode(
      config.modResults.contents,
      packageName,
      imageResourceName
    );
    return config;
  });

  // ========== iOS 图片模式 ==========
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const iosPath = path.join(projectRoot, 'ios');
      const projectName = config.modRequest.projectName || 'MyNewExpoSplashDemo';

      const iosDir = path.join(projectRoot, 'ios');
      if (!fs.existsSync(iosDir)) {
        console.warn('[expo-splash-screen2] iOS directory does not exist yet. Skipping setup.');
        return config;
      }

      // 复制背景图到 iOS bundle
      const imageFileName = copyBackgroundImageToIOS(
        projectRoot,
        pluginConfig.image!,
        iosPath,
        projectName
      );

      if (!imageFileName) {
        console.warn('[expo-splash-screen2] Failed to copy background image, skipping iOS setup');
        return config;
      }

      // 不再生成 SplashScreen2Module 到项目目录，因为该文件现在在插件的 pod 中
      // if (projectRoot) {
      //   generateSplashScreen2Module(bundleIdentifier, projectRoot, iosPath, projectName);
      // }
      return config;
    },
  ]);

  // 修改 SplashScreen.storyboard，设置背景图（responsiveImage 模式必须修改 storyboard，不能依赖 backgroundColor 条件）
  try {
    config = withIosSplashScreenStoryboard(config, async (config) => {
      const xml = config.modResults;
      const projectRoot = config.modRequest.projectRoot || '';
      const iosPath = path.join(projectRoot, 'ios');
      const projectName = config.modRequest.projectName || 'MyNewExpoSplashDemo';
      
      // 获取背景图文件名
      const backgroundImagePath = path.resolve(projectRoot, pluginConfig.image!);
      const ext = path.extname(backgroundImagePath);
      const imageFileName = `splash_background_image${ext}`;
      
      // responsiveImage 模式：图片全屏填充，不设置背景色
      const modifiedXml = applySplashScreenStoryboard(
        xml,
        pluginConfig.backgroundColor || '#ffffff',
        imageFileName,
        0, // imageWidth = 0 表示全屏填充
        'responsiveImage'
      );
      config.modResults = modifiedXml;
      return config;
    });
  } catch (error) {
    config = withDangerousMod(config, [
      'ios',
      async (config) => {
        const projectRoot = config.modRequest.projectRoot || '';
        const iosPath = path.join(projectRoot, 'ios');
        const projectName = config.modRequest.projectName || 'MyNewExpoSplashDemo';
        const storyboardPath = path.join(iosPath, projectName, 'SplashScreen.storyboard');
        
        if (fs.existsSync(storyboardPath)) {
          const backgroundImagePath = path.resolve(projectRoot, pluginConfig.image!);
          const ext = path.extname(backgroundImagePath);
          const imageFileName = `splash_background_image${ext}`;
          
          const contents = await fs.promises.readFile(storyboardPath, 'utf8');
          const { Parser } = require('xml2js');
          const xml = await new Parser().parseStringPromise(contents);
          // responsiveImage 模式：图片全屏填充，不设置背景色
          const modifiedXml = applySplashScreenStoryboard(
            xml,
            pluginConfig.backgroundColor || '#ffffff',
            imageFileName,
            0, // imageWidth = 0 表示全屏填充
            'responsiveImage'
          );
          const output = toString(modifiedXml);
          await fs.promises.writeFile(storyboardPath, output, 'utf-8');
        }
        return config;
      },
    ]);
  }

  // 修改 AppDelegate.swift，添加图片容器
  config = withAppDelegate(config, (config) => {
    if (config.modResults.language === 'swift') {
      const backgroundImagePath = path.resolve(
        config.modRequest.projectRoot || '',
        pluginConfig.image!
      );
      const ext = path.extname(backgroundImagePath);
      const imageFileName = `splash_background_image${ext}`;
      config.modResults.contents = modifyAppDelegateForImageMode(
        config.modResults.contents,
        imageFileName,
        0,  // responsiveImage 模式使用 0（全屏背景图）
        pluginConfig.backgroundColor || '#ffffff'
      );
    }
    return config;
  });

  // 修改 Xcode 项目，添加背景图文件引用
  config = withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const projectRoot = config.modRequest.projectRoot || '';
    const projectName = config.modRequest.projectName;
    const iosPath = path.join(projectRoot, 'ios');
    
    if (!projectName) {
      return config;
    }

    const backgroundImagePath = path.resolve(projectRoot, pluginConfig.image!);
    const ext = path.extname(backgroundImagePath);
    const imageFileName = `splash_background_image${ext}`;
    const filePath = path.join(iosPath, projectName, imageFileName);
    
    if (fs.existsSync(filePath)) {
      const relativeFilePath = `${projectName}/${imageFileName}`;
      if (!proj.hasFile(relativeFilePath) && !proj.hasFile(`../${projectName}/${imageFileName}`)) {
        try {
          IOSConfig.XcodeUtils.addResourceFileToGroup({
            filepath: relativeFilePath,
            groupName: projectName,
            project: proj,
            isBuildFile: true,
          });
        } catch (error) {
          console.error(`[expo-splash-screen2] Error adding background image file: ${error}`);
        }
      }
    }
    
    return config;
  });

  return config;
}

/**
 * 设置 Normal 模式：固定宽度的图片 + 背景色
 * 与 responsiveImage 的区别：不使用响应式布局，imageWidth 为固定像素值
 */
function setupNormalMode(config: any, pluginConfig: SplashHtmlConfig): any {
  const packageName = config.android?.package || 'com.anonymous.MyNewExpoSplashDemo';
  const bundleIdentifier = config.ios?.bundleIdentifier || 'com.anonymous.MyNewExpoSplashDemo';
  
  // 必填字段检查
  if (!pluginConfig.image) {
    throw new Error('[expo-splash-screen2] image is required for normal mode');
  }
  
  const backgroundColor = pluginConfig.backgroundColor || '#ffffff';
  const imageWidth = pluginConfig.imageWidth || 100; // 默认 100px
  
  // 深色模式配置
  const hasDarkMode = !!(pluginConfig.dark?.image || pluginConfig.dark?.backgroundColor);
  
  // 如果配置了深色模式，dark.image 是必填的
  if (hasDarkMode && !pluginConfig.dark?.image) {
    throw new Error('[expo-splash-screen2] dark.image is required when dark mode is enabled in normal mode');
  }
  
  const darkBackgroundColor = pluginConfig.dark?.backgroundColor || backgroundColor;
  const darkImage = pluginConfig.dark?.image;
  const darkImageWidth = pluginConfig.dark?.imageWidth || 100; // 深色模式默认 100px，如果配置了则使用配置值
  
  console.log('[expo-splash-screen2] Setting up Normal mode');
  console.log('  - backgroundColor:', backgroundColor);
  console.log('  - image:', pluginConfig.image);
  console.log('  - imageWidth:', imageWidth, 'px (fixed)');
  if (hasDarkMode) {
    console.log('  - dark mode enabled');
    console.log('  - dark backgroundColor:', darkBackgroundColor);
    console.log('  - dark image:', darkImage);
    console.log('  - dark imageWidth:', darkImageWidth, 'px (fixed)');
  }
  
  // ========== Android Normal 模式 ==========
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const androidMainPath = path.join(projectRoot, 'android', 'app', 'src', 'main');
      const androidDir = path.join(projectRoot, 'android');
      
      if (!fs.existsSync(androidDir)) {
        console.warn('[expo-splash-screen2] Android directory does not exist yet. Skipping setup.');
        return config;
      }

      // 1. 复制图片资源到 drawable-xxhdpi (浅色模式)
      const imagePath = path.resolve(projectRoot, pluginConfig.image!);
      const ext = path.extname(imagePath);
      const targetFileName = `splash_icon${ext}`;
      const drawableXxhdpiPath = path.join(androidMainPath, 'res', 'drawable-xxhdpi');
      
      if (!fs.existsSync(drawableXxhdpiPath)) {
        fs.mkdirSync(drawableXxhdpiPath, { recursive: true });
      }
      
      if (fs.existsSync(imagePath)) {
        fs.copyFileSync(imagePath, path.join(drawableXxhdpiPath, targetFileName));
        console.log('[expo-splash-screen2] Copied splash icon to Android drawable-xxhdpi');
      } else {
        console.warn(`[expo-splash-screen2] Image file not found: ${imagePath}`);
      }

      // 2. 如果配置了深色模式，复制深色图片到 drawable-night-xxhdpi
      if (hasDarkMode && darkImage) {
        const darkImagePath = path.resolve(projectRoot, darkImage);
        const darkExt = path.extname(darkImagePath);
        const darkTargetFileName = `splash_icon${darkExt}`;
        const drawableNightXxhdpiPath = path.join(androidMainPath, 'res', 'drawable-night-xxhdpi');
        
        if (!fs.existsSync(drawableNightXxhdpiPath)) {
          fs.mkdirSync(drawableNightXxhdpiPath, { recursive: true });
        }
        
        if (fs.existsSync(darkImagePath)) {
          fs.copyFileSync(darkImagePath, path.join(drawableNightXxhdpiPath, darkTargetFileName));
          console.log('[expo-splash-screen2] Copied dark splash icon to Android drawable-night-xxhdpi');
        } else {
          console.warn(`[expo-splash-screen2] Dark image file not found: ${darkImagePath}`);
        }
      }

      // 3. 创建 splashscreen_logo 资源（用于系统启动画面 Theme.App.SplashScreen）
      // 浅色模式：backgroundColor + image
      // 深色模式：dark.backgroundColor + dark.image（如果配置了）
      createSplashScreenLogoForNormalMode(
        projectRoot,
        androidMainPath,
        pluginConfig.image!,
        backgroundColor,
        imageWidth,
        darkImage, // 传递相对路径，函数内部会解析
        hasDarkMode ? darkBackgroundColor : undefined,
        hasDarkMode ? darkImageWidth : undefined // 传递深色模式的 imageWidth
      );

      // 4. 创建颜色资源文件（支持系统启动画面深色模式）
      // 无论是否配置深色模式，都需要创建浅色模式的 colors.xml（因为 ic_launcher_background.xml 引用了 @color/splashscreen_background）
      createSplashColorsXml(
        androidMainPath,
        backgroundColor,
        hasDarkMode ? darkBackgroundColor : undefined
      );

      return config;
    },
  ]);

  // 修改 MainActivity.kt，添加固定宽度的图片容器（支持深色模式）
  config = withMainActivity(config, (config) => {
    config.modResults.contents = modifyMainActivityForNormalMode(
      config.modResults.contents,
      packageName,
      backgroundColor,
      imageWidth,
      hasDarkMode,
      darkBackgroundColor
    );
    return config;
  });

  // ========== iOS Normal 模式 ==========
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot || '';
      const iosPath = path.join(projectRoot, 'ios');
      const projectName = cfg.modRequest.projectName || 'MyNewExpoSplashDemo';
      
      // 创建 Asset Catalog imageset 用于支持深色模式
      const imagePath = path.resolve(projectRoot, pluginConfig.image!);
      const darkImagePath = hasDarkMode && darkImage ? path.resolve(projectRoot, darkImage) : null;
      
      // 确保 Images.xcassets 目录存在
      const xcassetsPath = path.join(iosPath, projectName, 'Images.xcassets');
      if (!fs.existsSync(xcassetsPath)) {
        fs.mkdirSync(xcassetsPath, { recursive: true });
        // 创建 Contents.json
        const xcassetsContents = {
          info: {
            version: 1,
            author: 'xcode'
          }
        };
        fs.writeFileSync(
          path.join(xcassetsPath, 'Contents.json'),
          JSON.stringify(xcassetsContents, null, 2)
        );
      }
      
      // 创建 imageset
      if (fs.existsSync(imagePath)) {
        createAssetCatalogImageset(
          iosPath,
          projectName,
          imagePath,
          darkImagePath && fs.existsSync(darkImagePath) ? darkImagePath : null,
          'splash-icon'
        );
      } else {
        console.warn(`[expo-splash-screen2] Image file not found: ${imagePath}`);
      }
      
      // 创建 colorset 用于支持深色模式背景色
      createAssetCatalogColorset(
        iosPath,
        projectName,
        backgroundColor,
        hasDarkMode ? darkBackgroundColor : null,
        'SplashScreenBackground'
      );
      
      return cfg;
    }
  ]);
  
  // 修改 iOS Storyboard
  config = withIosSplashScreenStoryboard(config, async (cfg) => {
    console.log('[expo-splash-screen2] Modifying iOS storyboard for Normal mode222');
    const xml = cfg.modResults;
    const imagePath = pluginConfig.image!;
    const ext = path.extname(imagePath);
    // 使用 imageset 名称（不带扩展名），Asset Catalog 会自动处理深色模式
    const iconFileName = `splash-icon${ext}`; // 用于获取文件名，但实际引用使用不带扩展名的名称
    
    // 深色模式图片路径（用于创建 imageset，但不在 storyboard 中直接引用）
    let darkIconFileName: string | null = null;
    if (hasDarkMode && darkImage) {
      const darkExt = path.extname(darkImage);
      darkIconFileName = `splash-icon-dark${darkExt}`;
    }
    
    // normal 模式：支持深色模式
    // 非深色模式：backgroundColor + image + imageWidth（默认100，居中）
    // 深色模式：dark.backgroundColor + dark.image + dark.imageWidth（默认100，居中）
    const finalImageWidth = imageWidth || 100;
    const finalDarkImageWidth = pluginConfig.dark?.imageWidth ?? 100;
    
    const modifiedXml = applySplashScreenStoryboard(
      xml,
      backgroundColor,
      iconFileName,
      finalImageWidth,
      'normal',
      darkIconFileName,  // 深色模式图片文件名（用于创建 imageset）
      hasDarkMode ? darkBackgroundColor : null,  // 深色模式背景色
      finalDarkImageWidth  // 深色模式图片宽度
    );
    
    cfg.modResults = modifiedXml;
    return cfg;
  });
  
  // 修改 AppDelegate.swift，添加图片容器（normal 模式使用固定宽度，支持深色模式）
  config = withAppDelegate(config, (config) => {
    if (config.modResults.language === 'swift') {
      const imagePath = path.resolve(
        config.modRequest.projectRoot || '',
        pluginConfig.image!
      );
      const ext = path.extname(imagePath);
      const iconFileName = `splash-icon${ext}`;
      
      // 深色模式图片文件名
      let darkIconFileName = '';
      if (hasDarkMode && darkImage) {
        const darkExt = path.extname(darkImage);
        darkIconFileName = `splash-icon-dark${darkExt}`;
      }
      
      // normal 模式传入 imageWidth、backgroundColor 和深色模式参数
      config.modResults.contents = modifyAppDelegateForImageMode(
        config.modResults.contents,
        iconFileName,
        imageWidth,  // 传入实际的 imageWidth（默认 100）
        backgroundColor,  // 传入背景色
        hasDarkMode,  // 是否启用深色模式
        darkBackgroundColor,  // 深色模式背景色
        darkIconFileName  // 深色模式图片文件名
      );
    }
    return config;
  });
  
  // 注意：Asset Catalog imageset 文件不需要手动添加到 Xcode 项目
  // Xcode 会自动识别 Images.xcassets 目录中的内容
  // 如果需要，可以在这里添加其他资源文件的引用逻辑
  
  return config;
}

/**
 * 设置 WebView HTML 模式（原有逻辑）
 */
function setupWebViewMode(config: any, pluginConfig: SplashHtmlConfig): any {
  const packageName = config.android?.package || 'com.anonymous.MyNewExpoSplashDemo';
  
  // 注意：不注册 BaseMod provider，因为 Expo 的默认插件已经注册了
  // 我们直接使用 withIosSplashScreenStoryboard 修改 storyboard

  // 预先打包 expo-splash-web（只执行一次，避免 Android 和 iOS 各打包一次）
  // 使用闭包变量来缓存构建结果，避免重复构建
  let prebuiltHtmlPath: string | null = null;
  let prebuildPromise: Promise<string | null> | null = null;
  
  // 创建预构建函数（延迟执行，在第一个需要的地方执行）
  const doPrebuild = async (projectRoot: string): Promise<string | null> => {
    if (prebuiltHtmlPath) {
      return prebuiltHtmlPath; // 已经构建过，直接返回
    }
    
    if (prebuildPromise) {
      return prebuildPromise; // 正在构建，等待结果
    }
    
    // 如果配置了 localHtmlPath，不需要构建
    if (pluginConfig.localHtmlPath) {
      return null;
    }
    
    prebuildPromise = (async () => {
      try {
        const sourceDir = 'expo-splash-web';
        const splashWebDir = path.join(projectRoot, sourceDir);
        const buildScript = path.join(splashWebDir, 'build-splash-web.js');
        
        if (fs.existsSync(buildScript)) {
          console.log(`[expo-splash-screen2] Pre-building expo-splash-web (will be reused for Android and iOS)...`);
          const result = spawnSync('node', ['build-splash-web.js'], {
            cwd: splashWebDir,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' }
          });
          
          if (result.error) {
            throw new Error(`Failed to execute build-splash-web.js: ${result.error.message}`);
          }
          
          if (result.status !== 0) {
            throw new Error(`build-splash-web.js exited with code ${result.status}`);
          }
          
          const outPath = path.join(projectRoot, sourceDir, 'dist', 'index.html');
          if (fs.existsSync(outPath)) {
            prebuiltHtmlPath = outPath;
            console.log(`[expo-splash-screen2] Pre-build completed: ${prebuiltHtmlPath}`);
            return prebuiltHtmlPath;
          }
        }
      } catch (error) {
        console.warn(`[expo-splash-screen2] Pre-build failed, will build during platform setup: ${error}`);
      }
      return null;
    })();
    
    return prebuildPromise;
  };

  // 1. 复制 HTML 文件
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const androidMainPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main'
      );

      const androidDir = path.join(projectRoot, 'android');
      if (!fs.existsSync(androidDir)) {
        console.warn(
          '[expo-splash-screen2] Android directory does not exist yet. Skipping setup.'
        );
        return config;
      }

      if (!fs.existsSync(androidMainPath)) {
        fs.mkdirSync(androidMainPath, { recursive: true });
      }

      // 复制 HTML 文件（使用预构建的结果，如果存在）
      const prebuilt = await doPrebuild(projectRoot);
      let resolvedHtml: string | null = null;
      if (prebuilt && fs.existsSync(prebuilt)) {
        resolvedHtml = prebuilt;
        console.log(`[expo-splash-screen2] Android: Using pre-built HTML: ${resolvedHtml}`);
      } else {
        // 如果预构建失败或配置了 localHtmlPath，使用 resolveHtmlPath
        resolvedHtml = await resolveHtmlPath(projectRoot, pluginConfig);
      }
      
      if (resolvedHtml) {
        copyHtmlFile(projectRoot, androidMainPath, resolvedHtml);
      }

      // 复制 icon 文件（优先使用 pluginConfig.image，其次使用 config.icon）
      const iconPath = pluginConfig.image || config.icon;
      const imageWidth = pluginConfig.imageWidth ?? 100;
      if (iconPath) {
        // androidMainPath 已经是 android/app/src/main，所以直接使用
        copyIcon(projectRoot, iconPath, androidMainPath, pluginConfig.backgroundColor || '#ffffff', imageWidth);
      } else {
        console.log('[expo-splash-screen2] No image or icon configured, skipping icon copy');
      }

      // 更新 ic_launcher_background.xml
      updateIcLauncherBackground(androidMainPath, pluginConfig.backgroundColor || '#ffffff', imageWidth);

      // 创建颜色资源文件（支持系统启动画面深色模式）
      // WebView 模式目前不支持 dark 配置，所以只设置浅色模式背景色
      createSplashColorsXml(androidMainPath, pluginConfig.backgroundColor || '#ffffff');

      // 生成 CustomSplashActivity
      if (projectRoot) {
        generateCustomSplashActivity(packageName, projectRoot, androidMainPath, pluginConfig.backgroundColor || '#ffffff');
        generatePrivacyPolicyActivity(packageName, projectRoot, androidMainPath);
      } else {
        console.warn('[expo-splash-screen2] projectRoot is undefined, skipping activity generation');
      }
      return config;
    },
  ]);

  // 2. 修改 AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    config.modResults = modifyAndroidManifest(config.modResults, packageName);
    return config;
  });

  // 3. 修改 MainActivity.kt
  config = withMainActivity(config, (config) => {
    config.modResults.contents = modifyMainActivity(
      config.modResults.contents,
      packageName,
      pluginConfig.backgroundColor || '#ffffff'
    );
    return config;
  });

  // 4. 修改 styles.xml，更新 Theme.App.SplashScreen 的 android:windowBackground
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const stylesPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'values',
        'styles.xml'
      );

      // 修改 styles.xml，更新 Theme.App.SplashScreen 的 android:windowBackground
      // 并添加 Theme.App.MainActivity 主题
      if (fs.existsSync(stylesPath)) {
        let stylesContent = fs.readFileSync(stylesPath, 'utf-8');
        stylesContent = modifyStylesXml(stylesContent, pluginConfig.backgroundColor || '#ffffff');
        fs.writeFileSync(stylesPath, stylesContent);
      } else {
        console.warn('[expo-splash-screen2] styles.xml not found, skipping modification');
      }

      // 5. 修改 build.gradle，添加 splashscreen 依赖
      const buildGradlePath = path.join(
        projectRoot,
        'android',
        'app',
        'build.gradle'
      );

      if (fs.existsSync(buildGradlePath)) {
        let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8');
        if (!buildGradleContent.includes('androidx.core:core-splashscreen')) {
          // 在 dependencies 块中添加依赖
          const dependenciesRegex = /(dependencies\s*\{)/;
          if (dependenciesRegex.test(buildGradleContent)) {
            buildGradleContent = buildGradleContent.replace(
              dependenciesRegex,
              `$1
    // Splash screen library for Android 12+
    implementation("androidx.core:core-splashscreen:1.0.1")`
            );
            fs.writeFileSync(buildGradlePath, buildGradleContent);
          }
        }
      }

      return config;
    },
  ]);

  // ========== iOS 支持 ==========
  const bundleIdentifier = config.ios?.bundleIdentifier || 'com.anonymous.MyNewExpoSplashDemo';
  const iconPath = config.icon; // 从 app.json 中获取 icon 路径

  // 1. 根据 pluginConfig.image 和 backgroundColor 生成默认的 SplashScreen.storyboard
  // 注意：BaseMod provider 已经在 5520 行注册了
  // 始终修改 storyboard，即使 backgroundColor 未配置，也使用默认值
  // 获取 backgroundColor：优先使用 pluginConfig.backgroundColor，其次使用 app.json 的 splash.backgroundColor，最后使用 #ffffff
  const backgroundColor = pluginConfig?.backgroundColor || 
                          config.splash?.backgroundColor || 
                          '#ffffff';
  
  // 如果配置了 image，复制 icon 到 iOS bundle
  const imagePath = pluginConfig?.image;
  const imageWidth = pluginConfig?.imageWidth ?? 100;
  if (imagePath) {
    config = withDangerousMod(config, [
      'ios',
      async (config) => {
        const projectRoot = config.modRequest.projectRoot || '';
        const iosPath = path.join(projectRoot, 'ios');
        const projectName = config.modRequest.projectName || 'MyNewExpoSplashDemo';
        copyIconToIOS(projectRoot, imagePath, iosPath, projectName);
        return config;
      },
    ]);
  }

  // 使用 withIosSplashScreenStoryboard 修改 storyboard
  // webview 模式：backgroundColor + image（可选）+ imageWidth（默认100，居中）
  // 不支持深色模式
  config = withIosSplashScreenStoryboard(config, async (config) => {
    const xml = config.modResults;
    const projectRoot = config.modRequest.projectRoot || '';
    
    // 如果配置了 image，使用复制后的文件名；否则传 null
    let iconFileName: string | null = null;
    if (imagePath) {
      const ext = path.extname(imagePath);
      iconFileName = `splash-icon${ext}`;
    }
    
    const finalImageWidth = imageWidth || 100;
    const modifiedXml = applySplashScreenStoryboard(
      xml,
      backgroundColor,
      iconFileName,
      finalImageWidth,
      'webview'
    );
    
    config.modResults = modifiedXml;
    return config;
  });

  // 2. 复制 HTML 文件和图片到 iOS bundle
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const iosPath = path.join(projectRoot, 'ios');
      const projectName = config.modRequest.projectName || 'MyNewExpoSplashDemo';

      const iosDir = path.join(projectRoot, 'ios');
      if (!fs.existsSync(iosDir)) {
        console.warn(
          '[expo-splash-screen2] iOS directory does not exist yet. Skipping setup.'
        );
        return config;
      }

      // 复制 HTML 文件（使用预构建的结果，如果存在）
      const prebuilt = await doPrebuild(projectRoot);
      let resolvedHtml: string | null = null;
      if (prebuilt && fs.existsSync(prebuilt)) {
        resolvedHtml = prebuilt;
        console.log(`[expo-splash-screen2] iOS: Using pre-built HTML: ${resolvedHtml}`);
      } else {
        // 如果预构建失败或配置了 localHtmlPath，使用 resolveHtmlPath
        resolvedHtml = await resolveHtmlPath(projectRoot, pluginConfig);
      }
      
      if (resolvedHtml) {
        copyHtmlFileForIOS(projectRoot, iosPath, resolvedHtml);
      }

      // 不再生成 Swift 文件到项目目录，因为这些文件现在在插件的 pod 中
      // Swift 文件位于插件的 ios/ 目录下，通过 ExpoSplashHtml pod 提供
      if (projectRoot) {
        // 不再生成这些 Swift 文件，因为它们现在在插件的 pod 中
        // generateSplashScreen2Service(bundleIdentifier, projectRoot, iosPath, projectName);
        // generateSplashScreen2ViewController(bundleIdentifier, projectRoot, iosPath, pluginConfig.backgroundColor || '#ffffff', projectName);
        // generateSplashScreen2PrivacyPolicyViewController(bundleIdentifier, projectRoot, iosPath, projectName);
        // generateSplashScreen2Module(bundleIdentifier, projectRoot, iosPath, projectName);
        
        // 生成 ExpoSplashHtml.podspec 文件
        const podspecPath = path.join(iosPath, 'ExpoSplashHtml.podspec');
        const podspecContent = `require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoSplashHtml'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = 'Expo module for displaying HTML splash screens with WebView'
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '13.4', :tvos => '13.4' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "*.swift"
  
  # 确保模块可以被正确导入
  s.module_name = "ExpoSplashHtml"
end
`;
        try {
          fs.writeFileSync(podspecPath, podspecContent);
          console.log('[expo-splash-screen2] Generated ExpoSplashHtml.podspec');
        } catch (error) {
          console.error('[expo-splash-screen2] Failed to generate ExpoSplashHtml.podspec:', error);
        }
        
        // 生成 fix-splash-module.sh 脚本
        const scriptPath = path.join(iosPath, 'fix-splash-module.sh');
        const scriptContent = `#!/bin/bash

# 在每次 Xcode Build 前自动添加 SplashScreen2Module 到 ExpoModulesProvider.swift

# 确定项目根目录
if [ -z "$SRCROOT" ]; then
  # 从命令行运行，使用脚本所在目录
  SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
  PROVIDER_FILE="$SCRIPT_DIR/Pods/Target Support Files/Pods-${projectName}/ExpoModulesProvider.swift"
else
  # 从 Xcode Build Phase 运行
  PROVIDER_FILE="\${SRCROOT}/Pods/Target Support Files/Pods-${projectName}/ExpoModulesProvider.swift"
fi

echo "📍 Checking: $PROVIDER_FILE"

if [ -f "$PROVIDER_FILE" ]; then
  # 检查是否已经包含 SplashScreen2Module
  if grep -q "SplashScreen2Module.self" "$PROVIDER_FILE"; then
    echo "✅ SplashScreen2Module already registered"
  else
    echo "🔧 Adding SplashScreen2Module to ExpoModulesProvider..."
    # 在 WebBrowserModule.self 后添加 SplashScreen2Module.self
    sed -i '' 's/WebBrowserModule\\.self$/WebBrowserModule.self,\\
      SplashScreen2Module.self/' "$PROVIDER_FILE"
    
    # 验证是否成功
    if grep -q "SplashScreen2Module.self" "$PROVIDER_FILE"; then
      echo "✅ SplashScreen2Module added successfully"
    else
      echo "❌ Failed to add SplashScreen2Module"
      exit 1
    fi
  fi
else
  echo "⚠️  ExpoModulesProvider.swift not found at:"
  echo "    $PROVIDER_FILE"
  echo ""
  echo "💡 This is normal if you haven't run 'pod install' yet."
  echo "    Run: cd ios && pod install"
fi
`;
        
        try {
          fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
          console.log('[expo-splash-screen2] Generated fix-splash-module.sh');
        } catch (error) {
          console.error('[expo-splash-screen2] Failed to generate fix-splash-module.sh:', error);
        }
      } else {
        console.warn('[expo-splash-screen2] projectRoot is undefined, skipping Swift file generation');
      }
      
      return config;
    },
  ]);

  // 修改 Podfile 添加 post_install 钩子
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const iosPath = path.join(projectRoot, 'ios');
      const projectName = config.modRequest.projectName || 'MyNewExpoSplashDemo';
      const podfilePath = path.join(iosPath, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.warn('[expo-splash-screen2] Podfile not found, skipping post_install hook');
        return config;
      }

      try {
        let podfileContent = fs.readFileSync(podfilePath, 'utf-8');
        
        // 检查是否已经添加了 post_install 钩子
        if (podfileContent.includes('SplashScreen2Module.self')) {
          console.log('[expo-splash-screen2] Podfile post_install hook already exists');
          return config;
        }

        // 查找 post_install 块（匹配到对应的 end）
        const postInstallRegex = /(post_install\s+do\s+\|installer\|[\s\S]*?)(\n\s+end)/;
        const match = podfileContent.match(postInstallRegex);

        if (match) {
          // 在现有的 post_install 块的 end 之前添加代码
          const postInstallStart = match[1];
          const postInstallEnd = match[2];
          
          const newCode = `
    # 自动添加 SplashScreen2Module 到 ExpoModulesProvider
    provider_file = File.join(__dir__, 'Pods/Target Support Files/Pods-${projectName}/ExpoModulesProvider.swift')
    if File.exist?(provider_file)
      content = File.read(provider_file)
      unless content.include?('SplashScreen2Module.self')
        puts "🔧 Adding SplashScreen2Module to ExpoModulesProvider..."
        modified_content = content.gsub(
          /WebBrowserModule\\.self$/,
          "WebBrowserModule.self,\\n      SplashScreen2Module.self"
        )
        File.write(provider_file, modified_content)
        puts "✅ SplashScreen2Module added successfully"
      else
        puts "✅ SplashScreen2Module already registered"
      end
    end`;
          
          // 在 end 之前插入新代码
          podfileContent = podfileContent.replace(
            postInstallRegex,
            `${postInstallStart}${newCode}${postInstallEnd}`
          );
        } else {
          // 如果没有 post_install 块，在 target 块的最后一个 end 之前添加
          // 查找 target 块的结束位置（最后一个 end，但要在 target 块内）
          const targetBlockRegex = /(target\s+['"][^'"]+['"]\s+do[\s\S]*?)(\n\s+end\s*\nend)/;
          const targetMatch = podfileContent.match(targetBlockRegex);
          
          if (targetMatch) {
            const targetContent = targetMatch[1];
            const targetEnd = targetMatch[2];
            
            const postInstallBlock = `
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )

    # 自动添加 SplashScreen2Module 到 ExpoModulesProvider
    provider_file = File.join(__dir__, 'Pods/Target Support Files/Pods-${projectName}/ExpoModulesProvider.swift')
    if File.exist?(provider_file)
      content = File.read(provider_file)
      unless content.include?('SplashScreen2Module.self')
        puts "🔧 Adding SplashScreen2Module to ExpoModulesProvider..."
        modified_content = content.gsub(
          /WebBrowserModule\\.self$/,
          "WebBrowserModule.self,\\n      SplashScreen2Module.self"
        )
        File.write(provider_file, modified_content)
        puts "✅ SplashScreen2Module added successfully"
      else
        puts "✅ SplashScreen2Module already registered"
      end
    end
  end`;
            
            podfileContent = podfileContent.replace(
              targetBlockRegex,
              `${targetContent}${postInstallBlock}${targetEnd}`
            );
          } else {
            // 如果找不到 target 块，在文件末尾添加
            const newPostInstall = `
  post_install do |installer|
    # 自动添加 SplashScreen2Module 到 ExpoModulesProvider
    provider_file = File.join(__dir__, 'Pods/Target Support Files/Pods-${projectName}/ExpoModulesProvider.swift')
    if File.exist?(provider_file)
      content = File.read(provider_file)
      unless content.include?('SplashScreen2Module.self')
        puts "🔧 Adding SplashScreen2Module to ExpoModulesProvider..."
        modified_content = content.gsub(
          /WebBrowserModule\\.self$/,
          "WebBrowserModule.self,\\n      SplashScreen2Module.self"
        )
        File.write(provider_file, modified_content)
        puts "✅ SplashScreen2Module added successfully"
      else
        puts "✅ SplashScreen2Module already registered"
      end
    end
  end
end`;
            podfileContent = podfileContent.trimEnd() + newPostInstall;
          }
        }

        fs.writeFileSync(podfilePath, podfileContent);
        console.log('[expo-splash-screen2] Added post_install hook to Podfile');
      } catch (error) {
        console.error('[expo-splash-screen2] Failed to modify Podfile:', error);
      }

      return config;
    },
  ]);

  // 2. 修改 AppDelegate.swift
  config = withAppDelegate(config, (config) => {
    if (config.modResults.language === 'swift') {
      config.modResults.contents = modifyAppDelegate(config.modResults.contents);
    }
    return config;
  });

  // 3. 修改 Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults = modifyInfoPlist(config.modResults);
    return config;
  });

  // 4. 修改 Xcode 项目文件，添加文件引用和 Build Phase
  config = withXcodeProject(config, (config) => {
    // 传递 icon 路径给 modifyXcodeProject
    const configWithIcon = { ...config, icon: iconPath };
    config.modResults = modifyXcodeProject(configWithIcon, pluginConfig, configWithIcon);
    
    // 添加 Build Phase 来运行 fix-splash-module.sh
    const proj = config.modResults;
    
    try {
      // 查找 [CP] Copy Pods Resources 的 UUID
      const buildPhases = proj.hash.project.objects.PBXShellScriptBuildPhase || {};
      let copyPodsResourcesUuid: string | null = null;
      
      for (const [uuid, phase] of Object.entries(buildPhases)) {
        if (phase && typeof phase === 'object' && 'name' in phase) {
          if (phase.name === '"[CP] Copy Pods Resources"') {
            copyPodsResourcesUuid = uuid;
            break;
          }
        }
      }
      
      // 检查是否已经存在 Fix Splash Module Registration
      const buildPhaseExists = Object.values(buildPhases).some((phase: any) => 
        phase && phase.name === '"Fix SplashScreen2Module Registration"'
      );
      
      if (!buildPhaseExists) {
        // 创建新的 Build Phase
        const buildPhaseUuid = 'AA11BB22CC33DD44EE55FF66'; // 使用固定的 UUID
        const buildPhase = {
          isa: 'PBXShellScriptBuildPhase',
          alwaysOutOfDate: 1,
          buildActionMask: 2147483647,
          files: [],
          inputPaths: [],
          name: '"Fix SplashScreen2Module Registration"',
          outputPaths: [],
          runOnlyForDeploymentPostprocessing: 0,
          shellPath: '/bin/sh',
          shellScript: '"bash \\"${SRCROOT}/fix-splash-module.sh\\"\\n"',
          showEnvVarsInLog: 0
        };
        
        proj.hash.project.objects.PBXShellScriptBuildPhase[buildPhaseUuid] = buildPhase;
        proj.hash.project.objects.PBXShellScriptBuildPhase[buildPhaseUuid + '_comment'] = 'Fix SplashScreen2Module Registration';
        
        // 获取 target
        const target = proj.getFirstTarget();
        if (target && target.pbxNativeTarget && target.pbxNativeTarget.buildPhases) {
          // 找到 [CP] Copy Pods Resources 的位置
          const copyPodsIndex = target.pbxNativeTarget.buildPhases.findIndex((phase: any) => 
            phase.value === copyPodsResourcesUuid
          );
          
          // 在 [CP] Copy Pods Resources 之后插入
          if (copyPodsIndex !== -1) {
            target.pbxNativeTarget.buildPhases.splice(copyPodsIndex + 1, 0, {
              value: buildPhaseUuid,
              comment: 'Fix SplashScreen2Module Registration'
            });
            console.log('[expo-splash-screen2] Added Build Phase after [CP] Copy Pods Resources');
          } else {
            // 如果找不到，就添加到最后
            target.pbxNativeTarget.buildPhases.push({
              value: buildPhaseUuid,
              comment: 'Fix SplashScreen2Module Registration'
            });
            console.log('[expo-splash-screen2] Added Build Phase at the end');
          }
        } else {
          console.warn('[expo-splash-screen2] Target or buildPhases not found, skipping Build Phase');
        }
      } else {
        console.log('[expo-splash-screen2] Build Phase already exists');
      }
    } catch (error) {
      console.error('[expo-splash-screen2] Failed to add Build Phase:', error);
    }
    
    return config;
  });

  // 5. Final check for SplashScreen.storyboard（已禁用）
  // 不再检查和修改 SplashScreen.storyboard 文件

  return config;
};

/**
 * 设置 Blend 模式：.9图背景 + WebView自定义开屏
 */
function setupBlendMode(config: any, pluginConfig: SplashHtmlConfig): any {
  const packageName = config.android?.package || 'com.anonymous.MyNewExpoSplashDemo';
  const bundleIdentifier = config.ios?.bundleIdentifier || 'com.anonymous.MyNewExpoSplashDemo';
  
  if (!pluginConfig.image) {
    console.warn('[expo-splash-screen2] image is required for blend mode');
    return config;
  }

  // 预先打包 expo-splash-web（只执行一次，避免 Android 和 iOS 各打包一次）
  let prebuiltHtmlPath: string | null = null;
  let prebuildPromise: Promise<string | null> | null = null;
  
  const doPrebuild = async (projectRoot: string): Promise<string | null> => {
    if (prebuiltHtmlPath) {
      return prebuiltHtmlPath;
    }
    
    if (prebuildPromise) {
      return prebuildPromise;
    }
    
    if (pluginConfig.localHtmlPath) {
      return null;
    }
    
    prebuildPromise = (async () => {
      try {
        const sourceDir = 'expo-splash-web';
        const splashWebDir = path.join(projectRoot, sourceDir);
        const buildScript = path.join(splashWebDir, 'build-splash-web.js');
        
        if (fs.existsSync(buildScript)) {
          console.log(`[expo-splash-screen2] Pre-building expo-splash-web for blend mode...`);
          const result = spawnSync('node', ['build-splash-web.js'], {
            cwd: splashWebDir,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' }
          });
          
          if (result.error) {
            throw new Error(`Failed to execute build-splash-web.js: ${result.error.message}`);
          }
          
          if (result.status !== 0) {
            throw new Error(`build-splash-web.js exited with code ${result.status}`);
          }
          
          const outPath = path.join(projectRoot, sourceDir, 'dist', 'index.html');
          if (fs.existsSync(outPath)) {
            prebuiltHtmlPath = outPath;
            console.log(`[expo-splash-screen2] Pre-build completed: ${prebuiltHtmlPath}`);
            return prebuiltHtmlPath;
          }
        }
      } catch (error) {
        console.warn(`[expo-splash-screen2] Pre-build failed, will build during platform setup: ${error}`);
      }
      return null;
    })();
    
    return prebuildPromise;
  };

  // ========== Android Blend 模式 ==========
  // 保存imageResourceName供后续使用
  let savedImageResourceName: string = 'splash_background_image';
  
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const androidMainPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main'
      );

      const androidDir = path.join(projectRoot, 'android');
      if (!fs.existsSync(androidDir)) {
        console.warn('[expo-splash-screen2] Android directory does not exist yet. Skipping setup.');
        return config;
      }

      if (!fs.existsSync(androidMainPath)) {
        fs.mkdirSync(androidMainPath, { recursive: true });
      }

      // 复制.9图到drawable-xxhdpi（类似responsiveImage模式）
      const imageResourceName = copyBackgroundImage(
        projectRoot,
        pluginConfig.image!,
        androidMainPath
      );

      if (!imageResourceName) {
        console.warn('[expo-splash-screen2] Failed to copy background image, skipping Android setup');
        return config;
      }

      // 保存imageResourceName供后续使用
      savedImageResourceName = imageResourceName;

      // 复制 HTML 文件
      const prebuilt = await doPrebuild(projectRoot);
      let resolvedHtml: string | null = null;
      if (prebuilt && fs.existsSync(prebuilt)) {
        resolvedHtml = prebuilt;
        console.log(`[expo-splash-screen2] Android: Using pre-built HTML: ${resolvedHtml}`);
      } else {
        resolvedHtml = await resolveHtmlPath(projectRoot, pluginConfig);
      }
      
      if (resolvedHtml) {
        copyHtmlFile(projectRoot, androidMainPath, resolvedHtml);
      }

      // 创建颜色资源文件（用于系统启动画面）
      createSplashColorsXml(androidMainPath, pluginConfig.backgroundColor || '#ffffff');

      // 生成 CustomSplashActivity（WebView容器背景使用.9图）
      if (projectRoot) {
        generateCustomSplashActivityForBlendMode(packageName, projectRoot, androidMainPath, imageResourceName);
        generatePrivacyPolicyActivity(packageName, projectRoot, androidMainPath);
      } else {
        console.warn('[expo-splash-screen2] projectRoot is undefined, skipping activity generation');
      }
      return config;
    },
  ]);

  // 修改 AndroidManifest.xml（blend模式下MainActivity使用Theme.App.SplashScreen）
  config = withAndroidManifest(config, (config) => {
    config.modResults = modifyAndroidManifestForBlendMode(config.modResults, packageName);
    return config;
  });

  // 修改 MainActivity.kt（WebView容器背景使用.9图）
  config = withMainActivity(config, (config) => {
    config.modResults.contents = modifyMainActivityForBlendMode(
      config.modResults.contents,
      packageName,
      savedImageResourceName
    );
    return config;
  });

  // 修改 styles.xml，设置windowBackground为.9图（类似responsiveImage模式）
  config = withAndroidStyles(config, (config) => {
    if (!config.modResults) {
      return config;
    }

    const stylesJSON = config.modResults;

    if (!stylesJSON.resources) {
      stylesJSON.resources = {};
    }
    if (!stylesJSON.resources.style) {
      stylesJSON.resources.style = [];
    }

    if (!Array.isArray(stylesJSON.resources.style)) {
      stylesJSON.resources.style = [];
    }

    const hasCorrectValue = stylesJSON.resources.style.some(
      (style: any) =>
        style?.$?.name === 'Theme.App.SplashScreen' &&
        style.item?.some(
          (item: any) =>
            item.$?.name === 'android:windowBackground' &&
            item._ === '@drawable/splash_background_image'
        )
    );

    if (!hasCorrectValue) {
      stylesJSON.resources.style = modifyStylesForImageMode(
        stylesJSON.resources.style
      );
    }

    return config;
  });

  // 修改 build.gradle，添加 splashscreen 依赖
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const buildGradlePath = path.join(
        projectRoot,
        'android',
        'app',
        'build.gradle'
      );

      if (fs.existsSync(buildGradlePath)) {
        let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8');
        if (!buildGradleContent.includes('androidx.core:core-splashscreen')) {
          // 在 dependencies 块中添加依赖
          const dependenciesRegex = /(dependencies\s*\{)/;
          if (dependenciesRegex.test(buildGradleContent)) {
            buildGradleContent = buildGradleContent.replace(
              dependenciesRegex,
              `$1
    // Splash screen library for Android 12+
    implementation("androidx.core:core-splashscreen:1.0.1")`
            );
            fs.writeFileSync(buildGradlePath, buildGradleContent);
          }
        }
      }

      return config;
    },
  ]);

  // ========== iOS Blend 模式 ==========
  // 保存imageFileName供后续使用
  let savedImageFileName: string = 'splash_background_image';
  
  // 复制.9图到iOS bundle（类似responsiveImage模式）
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || '';
      const iosPath = path.join(projectRoot, 'ios');
      const projectName = config.modRequest.projectName || 'MyNewExpoSplashDemo';
      
      const imageFileName = copyBackgroundImageToIOS(
        projectRoot,
        pluginConfig.image!,
        iosPath,
        projectName
      );

      if (!imageFileName) {
        console.warn('[expo-splash-screen2] Failed to copy background image to iOS, skipping iOS setup');
        return config;
      }

      // 保存imageFileName供后续使用
      savedImageFileName = imageFileName;

      // 复制 HTML 文件
      const prebuilt = await doPrebuild(projectRoot);
      let resolvedHtml: string | null = null;
      if (prebuilt && fs.existsSync(prebuilt)) {
        resolvedHtml = prebuilt;
        console.log(`[expo-splash-screen2] iOS: Using pre-built HTML: ${resolvedHtml}`);
      } else {
        resolvedHtml = await resolveHtmlPath(projectRoot, pluginConfig);
      }
      
      if (resolvedHtml) {
        copyHtmlFileForIOS(projectRoot, iosPath, resolvedHtml);
      }

      return config;
    },
  ]);

  // 修改 Storyboard，设置背景为.9图（类似responsiveImage模式）
  config = withIosSplashScreenStoryboard(config, async (config) => {
    const xml = config.modResults;
    const projectRoot = config.modRequest.projectRoot || '';
    
    // blend模式：使用.9图作为背景（和responsiveImage模式一样）
    // 获取.9图文件名（应该已经在withDangerousMod中复制了）
    const backgroundImagePath = path.resolve(projectRoot, pluginConfig.image!);
    const ext = path.extname(backgroundImagePath);
    const imageFileName = `splash_background_image${ext}`;
    
    const modifiedXml = applySplashScreenStoryboard(
      xml,
      pluginConfig.backgroundColor || '#ffffff',
      imageFileName, // 使用.9图作为背景
      0, // imageWidth为0表示全屏背景图
      'responsiveImage' // 使用responsiveImage模式的处理逻辑
    );
    
    config.modResults = modifiedXml;
    return config;
  });

  // 修改 AppDelegate.swift（WebView容器背景使用.9图）
  config = withAppDelegate(config, (config) => {
    if (config.modResults.language === 'swift') {
      config.modResults.contents = modifyAppDelegateForBlendMode(
        config.modResults.contents,
        savedImageFileName,
        pluginConfig.backgroundColor || '#ffffff'
      );
    }
    return config;
  });

  // 修改 Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults = modifyInfoPlist(config.modResults);
    return config;
  });

  // 修改 Xcode 项目文件
  config = withXcodeProject(config, (config) => {
    const configWithIcon = { ...config, icon: pluginConfig.image };
    modifyXcodeProject(configWithIcon, pluginConfig, configWithIcon);
    return configWithIcon;
  });

  return config;
}

export default withSplashHtml;

