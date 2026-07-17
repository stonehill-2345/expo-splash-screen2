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
  android?: {
    image?: string;
  };
  ios?: {
    image?: string;
  };
  harmony?: {
    image?: string;
    backgroundColor?: string;
  };
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
  console.log('[expo-splash-screen8] bundleSplashWeb dir:', dir);
  
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
  backgroundColor: string,
  edgeToEdgeEnabled?: boolean
): void {
  console.log(`[expo-splash-screen5]  666:`, edgeToEdgeEnabled);
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
  let activityContent = replaceTemplatePlaceholders(ANDROID_TEMPLATES.customSplashActivity, {
    packageName,
    activityName: CUSTOM_SPLASH_ACTIVITY_NAME,
    backgroundColor,
  });


    console.error(`[expo-splash-screen3]  8888:`, edgeToEdgeEnabled);
  // If edgeToEdgeEnabled is true, remove WindowCompat import and call
  if (edgeToEdgeEnabled === true) {
    // Remove import androidx.core.view.WindowCompat
    activityContent = activityContent.replace(/import androidx\.core\.view\.WindowCompat\s*\n/, '');
    // Remove WindowCompat.setDecorFitsSystemWindows(window, false) and its comment
    activityContent = activityContent.replace(/\s*\/\/\s*Let content extend below status bar and navigation bar instead of hiding them\s*\n\s*WindowCompat\.setDecorFitsSystemWindows\(window,\s*false\)\s*\n/, '');
  }

  try {
    fs.writeFileSync(activityPath, activityContent);
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to generate SplashScreen2Activity.kt:`, error);
    throw error;
  }
}

/**
 * Generate SplashScreen2Activity.kt file for Blend mode
 */
function generateCustomSplashActivityForBlendMode(
  packageName: string,
  projectRoot: string,
  androidMainPath: string,
  imageResourceName: string,
  edgeToEdgeEnabled?: boolean
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

  // Use template to generate activity content
  let activityContent = replaceTemplatePlaceholders(ANDROID_TEMPLATES.customSplashActivity, {
    packageName,
    activityName: CUSTOM_SPLASH_ACTIVITY_NAME,
    backgroundColor: '#ffffff', // Not used in blend mode, but required by template
  });

  // If edgeToEdgeEnabled is true, remove WindowCompat import and call
  if (edgeToEdgeEnabled === true) {
    // Remove import androidx.core.view.WindowCompat
    activityContent = activityContent.replace(/import androidx\.core\.view\.WindowCompat\s*\n/, '');
    // Remove WindowCompat.setDecorFitsSystemWindows(window, false) and its comment
    activityContent = activityContent.replace(/\s*\/\/\s*Let content extend below status bar and navigation bar instead of hiding them\s*\n\s*WindowCompat\.setDecorFitsSystemWindows\(window,\s*false\)\s*\n/, '');
  }

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
    // Show splash image view when preventAutoHide is called
    Handler(Looper.getMainLooper()).post {
      setupSplashImageView()
    }
  }
  
  override fun onContentChanged() {
    super.onContentChanged()
    // Show splash image view when content changed
    Handler(Looper.getMainLooper()).post {
      setupSplashImageView()
    }
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

  // Remove "Set the theme to AppTheme" comments and any setTheme calls from onCreate
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
    let cleanedOnCreateContent = onCreateContent;
    
    // Remove "Set the theme to AppTheme" comments
    const themeCommentRegex = /(\s*\/\/\s*Set the theme to AppTheme[^\n]*\n)+(\s*\/\/\s*[^\n]*\n)*(\s*\/\/\s*This is required for expo-splash-screen[^\n]*\n)?/g;
    cleanedOnCreateContent = cleanedOnCreateContent.replace(themeCommentRegex, '');
    
    // Remove setTheme(R.style.AppTheme) call and its comments
    const setThemeRegex = /(\s*\/\/\s*[^\n]*\n)*\s*setTheme\s*\(\s*R\.style\.AppTheme\s*\)\s*;?\s*\n?/g;
    cleanedOnCreateContent = cleanedOnCreateContent.replace(setThemeRegex, '');
    
    // Remove setupSplashImageView call if exists
    const setupSplashRegex = /(\s*\/\/\s*[^\n]*\n)*\s*Handler\s*\(\s*Looper\.getMainLooper\(\)\s*\)\.post\s*\{[\s\S]*?setupSplashImageView\s*\(\)[\s\S]*?\}\s*/g;
    cleanedOnCreateContent = cleanedOnCreateContent.replace(setupSplashRegex, '');
    
    if (cleanedOnCreateContent !== onCreateContent) {
      modifiedContent = modifiedContent.substring(0, onCreateIndex) + 
                       cleanedOnCreateContent + 
                       modifiedContent.substring(onCreateEndIndex);
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
function modifyMainActivity(content: string, packageName: string, backgroundColor: string, edgeToEdgeEnabled?: boolean): string {
  const classMatch = content.match(/class\s+MainActivity\s*[^:]*:/);
  if (!classMatch) {
    console.warn('[expo-splash-screen2] MainActivity class not found');
    return content;
  }

  // Check if WebView container related code already exists
  const hasWebViewCode = content.includes('setupWebViewContainer') || content.includes('webViewContainer');
  const hasCompanionObject = content.includes('companion object') && content.includes('actionStart');

 
  
  // Check if these imports are already included (check all imports that need to be added)
  // WindowCompat import is only needed if edgeToEdgeEnabled is false or undefined
  const needsWindowCompat = edgeToEdgeEnabled !== true;
  let hasImports = content.includes('import android.os.Build') &&
                   content.includes('import android.os.Handler') && 
                   content.includes('import android.os.Looper') &&
                   content.includes('import android.view.View') &&
                   content.includes('import android.view.ViewGroup') &&
                   content.includes('import android.webkit.WebView') &&
                   content.includes('import android.webkit.WebViewClient') &&
                   (!needsWindowCompat || content.includes('import androidx.core.view.WindowCompat'));
  
  let modifiedContent = content;
  
  // Remove WindowCompat import if edgeToEdgeEnabled is true
  if (edgeToEdgeEnabled === true && content.includes('import androidx.core.view.WindowCompat')) {
    modifiedContent = modifiedContent.replace(/import androidx\.core\.view\.WindowCompat\s*\n/, '');
  }
  
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
    ];
    
    // Only add WindowCompat import if edgeToEdgeEnabled is false or undefined
    if (needsWindowCompat) {
      importsToAddList.push('import androidx.core.view.WindowCompat');
    }
    
    const missingImports = importsToAddList.filter(imp => !modifiedContent.includes(imp));
    
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
    
    // Check if onCreate contains the complete code block, remove if exists
    // onCreateContent contains complete content from method signature to closing brace
    const onCreateContent = modifiedContent.substring(onCreateIndex, onCreateEndIndex);
    let cleanedOnCreateContent = onCreateContent;
    
    // Check if the complete code block exists (WindowCompat + setupWebViewContainer + Handler)
    const hasWindowCompat = onCreateContent.includes('WindowCompat.setDecorFitsSystemWindows');
    const hasSetupWebViewContainer = onCreateContent.includes('setupWebViewContainer');
    const hasHandlerPost = onCreateContent.includes('Handler(Looper.getMainLooper()).post');
    const codeBlockExists = hasWindowCompat && hasSetupWebViewContainer && hasHandlerPost;
    
    // If edgeToEdgeEnabled is true and WindowCompat call exists, remove only the WindowCompat line
    if (edgeToEdgeEnabled === true && hasWindowCompat) {
      // Remove only WindowCompat line and its comment, keep other window settings
      cleanedOnCreateContent = cleanedOnCreateContent.replace(/\s*\/\/\s*Let content extend below status bar and navigation bar\s*\n\s*WindowCompat\.setDecorFitsSystemWindows\(window,\s*false\)\s*\n\s*/, '');
    } else if (codeBlockExists && edgeToEdgeEnabled !== true) {
      // If edgeToEdgeEnabled is false/undefined and code block exists, remove the complete code block
      // Then add only WindowCompat and window settings (without Handler.post and setupWebViewContainer)
      const lines = onCreateContent.split('\n');
      const filteredLines: string[] = [];
      let inCodeBlock = false;
      let handlerBraceCount = 0;
      let foundHandlerStart = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this line starts the code block
        if (!inCodeBlock && (line.includes('WindowCompat.setDecorFitsSystemWindows') || 
            line.includes('Let content extend below status bar'))) {
          inCodeBlock = true;
          // Skip this line and continue to process the block
          continue;
        }
        
        if (inCodeBlock) {
          // Check if we've reached the Handler block
          if (line.includes('Handler(Looper.getMainLooper()).post')) {
            foundHandlerStart = true;
          }
          
          // Count braces to find the end of Handler block
          if (foundHandlerStart) {
            handlerBraceCount += (line.match(/\{/g) || []).length;
            handlerBraceCount -= (line.match(/\}/g) || []).length;
            
            // If we've closed all braces (Handler block is complete), end the code block
            if (handlerBraceCount <= 0) {
              inCodeBlock = false;
              handlerBraceCount = 0;
              foundHandlerStart = false;
              // Skip this line (the closing brace of Handler)
              continue;
            }
          }
          
          // Skip this line (it's part of the code block)
          continue;
        }
        
        // Keep lines that are not part of the code block
        filteredLines.push(line);
      }
      
      cleanedOnCreateContent = filteredLines.join('\n');
      
      // After removing the code block, add only WindowCompat and window settings (without Handler.post and setupWebViewContainer)
      const superOnCreateIndex = cleanedOnCreateContent.indexOf('super.onCreate');
      if (superOnCreateIndex !== -1) {
        // Find the end of super.onCreate line (could be on same line as { or on next line)
        let superOnCreateEndIndex = cleanedOnCreateContent.indexOf('\n', superOnCreateIndex);
        if (superOnCreateEndIndex === -1) {
          // If no newline found, find the closing brace or end of line
          superOnCreateEndIndex = cleanedOnCreateContent.length;
        } else {
          superOnCreateEndIndex = superOnCreateEndIndex + 1; // Include the newline
        }
        
        // Only add WindowCompat and window settings (with isNavigationBarContrastEnforced), not Handler.post and setupWebViewContainer
        const windowSettingsCode = `
    WindowCompat.setDecorFitsSystemWindows(window, false)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT`;
        
        cleanedOnCreateContent = cleanedOnCreateContent.substring(0, superOnCreateEndIndex) +
                         windowSettingsCode + '\n' +
                         cleanedOnCreateContent.substring(superOnCreateEndIndex);
      }
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
    
    // Check if the code block already exists by checking for key markers from the template
    // The template includes: WindowCompat.setDecorFitsSystemWindows, setupWebViewContainer, and Handler(Looper.getMainLooper()).post
    const hasWindowCompat = onCreateContent.includes('WindowCompat.setDecorFitsSystemWindows');
    const hasSetupWebViewContainer = onCreateContent.includes('setupWebViewContainer');
    const hasHandlerPost = onCreateContent.includes('Handler(Looper.getMainLooper()).post');
    
    // Check if the complete code block exists (all three markers together)
    const codeBlockExists = hasWindowCompat && hasSetupWebViewContainer && hasHandlerPost;
    
    // Check if only WindowCompat and window settings exist (without Handler.post and setupWebViewContainer)
    // This happens when codeBlockExists && edgeToEdgeEnabled !== true, we removed the code block and added only WindowCompat and window settings
    const hasOnlyWindowSettings = hasWindowCompat && !hasSetupWebViewContainer && !hasHandlerPost;
    
    // If edgeToEdgeEnabled is false/undefined and WindowCompat is missing, we need to add it
    // If edgeToEdgeEnabled is true and WindowCompat exists, we need to remove it (handled in earlier code)
    // If hasOnlyWindowSettings is true, we already added WindowCompat and window settings, don't add Handler.post and setupWebViewContainer
    const needsWindowCompat = edgeToEdgeEnabled !== true;
    // Only add complete code block if:
    // 1. Complete code block doesn't exist (!codeBlockExists)
    // 2. We don't have only window settings (!hasOnlyWindowSettings) - this means we need to add Handler.post and setupWebViewContainer
    // 3. We need WindowCompat and don't have it, OR we need to add setupWebViewContainer and Handler.post
    const shouldAddCode = !codeBlockExists && !hasOnlyWindowSettings && (needsWindowCompat && !hasWindowCompat || (!hasSetupWebViewContainer || !hasHandlerPost));
    
    if (shouldAddCode) {
      // Before adding, remove any existing window color settings and WindowCompat that might conflict
      // This ensures we don't have duplicate window.statusBarColor, window.navigationBarColor, or WindowCompat
      let cleanedOnCreateForAdd = onCreateContent;
      const hasExistingWindowColors = cleanedOnCreateForAdd.includes('window.statusBarColor') || cleanedOnCreateForAdd.includes('window.navigationBarColor');
      const hasExistingWindowCompat = cleanedOnCreateForAdd.includes('WindowCompat.setDecorFitsSystemWindows');
      if (hasExistingWindowColors) {
        // Remove existing window color settings and related code
        cleanedOnCreateForAdd = cleanedOnCreateForAdd.replace(/\s*if\s*\(Build\.VERSION\.SDK_INT\s*>=\s*Build\.VERSION_CODES\.Q\)\s*\{\s*\n\s*window\.isNavigationBarContrastEnforced\s*=\s*false\s*\n\s*\}\s*\n?/g, '');
        cleanedOnCreateForAdd = cleanedOnCreateForAdd.replace(/\s*window\.statusBarColor\s*=\s*android\.graphics\.Color\.TRANSPARENT\s*\n?/g, '');
        cleanedOnCreateForAdd = cleanedOnCreateForAdd.replace(/\s*window\.navigationBarColor\s*=\s*android\.graphics\.Color\.TRANSPARENT\s*\n?/g, '');
      }
      if (hasExistingWindowCompat) {
        // Remove existing WindowCompat call and its comment
        cleanedOnCreateForAdd = cleanedOnCreateForAdd.replace(/\s*\/\/\s*Let content extend below status bar and navigation bar\s*\n\s*WindowCompat\.setDecorFitsSystemWindows\(window,\s*false\)\s*\n\s*/, '');
      }
      
      // Add setupWebViewContainer call after super.onCreate
      const superOnCreateIndex = cleanedOnCreateForAdd.indexOf('super.onCreate');
      if (superOnCreateIndex !== -1) {
        // Find the end of super.onCreate line (could be on same line as { or on next line)
        let superOnCreateEndIndex = cleanedOnCreateForAdd.indexOf('\n', superOnCreateIndex);
        if (superOnCreateEndIndex === -1) {
          // If no newline found, find the closing brace or end of line
          superOnCreateEndIndex = cleanedOnCreateForAdd.length;
        } else {
          superOnCreateEndIndex = superOnCreateEndIndex + 1; // Include the newline
        }
        
        // Use template to replace hardcoded strings
        let setupCall = ANDROID_TEMPLATES.mainActivityOnCreateCode;
        
        // If edgeToEdgeEnabled is true, remove WindowCompat call but keep other window settings and Handler.post
        if (edgeToEdgeEnabled === true) {
          // Remove WindowCompat line and its comment, keep other window settings
          setupCall = setupCall.replace(/\s*\/\/\s*Let content extend below status bar and navigation bar\s*\n\s*WindowCompat\.setDecorFitsSystemWindows\(window,\s*false\)\s*\n\s*/, '');
        }
        
        // Replace the onCreate content with cleaned version + new code
        const newOnCreateContent = cleanedOnCreateForAdd.substring(0, superOnCreateEndIndex) +
                         setupCall + '\n' +
                         cleanedOnCreateForAdd.substring(superOnCreateEndIndex);
        
        // Replace the entire onCreate method in modifiedContent
        modifiedContent = modifiedContent.substring(0, onCreateIndex) + 
                         newOnCreateContent + 
                         modifiedContent.substring(onCreateEndIndex);
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

    // Insert webViewCode (properties and methods) at the beginning of the class (before first method)
    if (!hasWebViewCode) {
      if (firstMethodMatch) {
        const insertIndex = classIndex + firstMethodMatch.index!;
        modifiedContent = (
          modifiedContent.substring(0, insertIndex) +
          webViewCode +
          '\n' +
          modifiedContent.substring(insertIndex)
        );
      } else {
        const lastBraceIndex = modifiedContent.lastIndexOf('}');
        modifiedContent = (
          modifiedContent.substring(0, lastBraceIndex) +
          webViewCode +
          '\n' +
          modifiedContent.substring(lastBraceIndex)
        );
      }
    }

    // Insert companion object at the end of the class (before the closing brace)
    if (!hasCompanionObject) {
      // Find the last closing brace of the class (before any nested classes or companion objects)
      // Match the closing brace that matches the class opening brace
      let braceCount = 0;
      let classStartIndex = modifiedContent.indexOf(classMatch[0]);
      let foundClassStart = false;
      let classEndIndex = -1;
      
      for (let i = classStartIndex; i < modifiedContent.length; i++) {
        if (modifiedContent[i] === '{') {
          braceCount++;
          foundClassStart = true;
        } else if (modifiedContent[i] === '}') {
          braceCount--;
          if (foundClassStart && braceCount === 0) {
            classEndIndex = i;
            break;
          }
        }
      }
      
      if (classEndIndex !== -1) {
        // Insert companion object before the closing brace
        modifiedContent = (
          modifiedContent.substring(0, classEndIndex) +
          '\n' +
          companionObjectCode +
          '\n' +
          modifiedContent.substring(classEndIndex)
        );
      } else {
        // Fallback: use last brace
        const lastBraceIndex = modifiedContent.lastIndexOf('}');
        modifiedContent = (
          modifiedContent.substring(0, lastBraceIndex) +
          '\n' +
          companionObjectCode +
          '\n' +
          modifiedContent.substring(lastBraceIndex)
        );
      }
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
 * Helper function: Find method position and insertion point after super call (incremental overlay mode)
 * Returns method info with insertion position, or null if method not found
 */
function findMethodInsertPosition(
  content: string,
  methodPattern: RegExp,
  superCallPattern: RegExp
): { methodStart: number; methodEnd: number; methodContent: string; insertAfterSuper: number } | null {
  const methodMatch = content.match(methodPattern);
  if (!methodMatch) return null;
  
  // Find all matches to get the correct one (use last match, most likely in MainActivity class)
  let methodStart = -1;
  const allMatches: number[] = [];
  let searchStart = 0;
  while (true) {
    const match = content.substring(searchStart).match(methodPattern);
    if (!match) break;
    const matchIndex = searchStart + match.index!;
    allMatches.push(matchIndex);
    searchStart = matchIndex + match[0].length;
  }
  if (allMatches.length > 0) {
    methodStart = allMatches[allMatches.length - 1];
  } else {
    methodStart = content.indexOf(methodMatch[0]);
  }
  
  // Find method end using brace matching
  let braceCount = 0;
  let methodEnd = methodStart + methodMatch[0].length;
  let foundStart = false;
  
  for (let i = methodStart; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
      foundStart = true;
    } else if (content[i] === '}') {
      braceCount--;
      if (foundStart && braceCount === 0) {
        methodEnd = i + 1;
        break;
      }
    }
  }
  
  const methodContent = content.substring(methodStart, methodEnd);
  const superMatch = methodContent.match(superCallPattern);
  if (!superMatch) return null;
  
  // Find insertion point after super call
  const superIndex = methodContent.indexOf(superMatch[0]);
  const superEnd = superIndex + superMatch[0].length;
  const nextLineIndex = methodContent.indexOf('\n', superEnd);
  const insertAfterSuper = methodStart + (nextLineIndex !== -1 ? nextLineIndex + 1 : superEnd);
  
  return { methodStart, methodEnd, methodContent, insertAfterSuper };
}

/**
 * Modify MainActivity.kt for Blend mode (Incremental Overlay Mode)
 * Blend mode: ImageView container (.9图背景) + WebView container (透明背景，在ImageView之上)
 * 
 * Strategy:
 * 1. Identify system methods (onCreate, onContentChanged)
 * 2. If not exists, add complete method
 * 3. If exists, insert plugin code after super call (incremental overlay, don't replace entire method)
 * 4. For plugin methods, add if not exists
 */
function modifyMainActivityForBlendMode(content: string, packageName: string, imageResourceName: string, edgeToEdgeEnabled?: boolean): string {
  // Check if blend mode code already exists
  if (content.includes('splashImageViewContainer') && content.includes('setupSplashImageView') && 
      content.includes('onContentChanged') && content.includes('setupWebViewContainer')) {
    return content;
  }

  let modifiedContent = content;
  
  // Step 1: Add necessary imports (incremental - only add missing ones)
  const importsToAdd = [
    'import android.os.Build',
    'import android.os.Handler',
    'import android.os.Looper',
    'import android.view.View',
    'import android.view.ViewGroup',
    'import android.webkit.WebView',
    'import android.webkit.WebViewClient',
    'import android.widget.ImageView'
  ];
  
  if (edgeToEdgeEnabled !== true) {
    importsToAdd.push('import androidx.core.view.WindowCompat');
  }
  
  const missingImports = importsToAdd.filter(imp => !modifiedContent.includes(imp));
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
  
  // Step 2: Check MainActivity class exists
  const classMatch = modifiedContent.match(/class\s+MainActivity\s*[^:]*:/);
  if (!classMatch) {
    console.warn('[expo-splash-screen2] MainActivity class not found');
    return modifiedContent;
  }
  
  // Step 3: Add WebView container code (if not exists) - use template
  const hasWebViewCode = modifiedContent.includes('setupWebViewContainer') || modifiedContent.includes('webViewContainer');
  if (!hasWebViewCode) {
    const webViewCode = replaceTemplatePlaceholders(ANDROID_TEMPLATES.mainActivityWebViewCode, {
      backgroundColor: '#ffffff', // Not used in blend mode, but required by template
    });
    
    // Insert WebView code into MainActivity class
    const classIndex = modifiedContent.indexOf(classMatch[0]) + classMatch[0].length;
    const afterClass = modifiedContent.substring(classIndex);
    const companionObjectMatch = afterClass.match(/companion\s+object\s*\{/);
    
    if (companionObjectMatch) {
      const companionIndex = classIndex + companionObjectMatch.index!;
      modifiedContent = modifiedContent.substring(0, companionIndex) +
                       webViewCode +
                       '\n' +
                       modifiedContent.substring(companionIndex);
    } else {
      const firstMethodMatch = afterClass.match(/\s+(override\s+)?fun\s+/);
      if (firstMethodMatch) {
        const insertIndex = classIndex + firstMethodMatch.index!;
        modifiedContent = modifiedContent.substring(0, insertIndex) +
                         webViewCode +
                         '\n' +
                         modifiedContent.substring(insertIndex);
      } else {
        const lastBraceIndex = modifiedContent.lastIndexOf('}');
        modifiedContent = modifiedContent.substring(0, lastBraceIndex) +
                         webViewCode +
                         '\n' +
                         modifiedContent.substring(lastBraceIndex);
      }
    }
  }
  
  // Step 4: Handle onCreate method (incremental overlay mode)
  const onCreatePattern = /override\s+fun\s+onCreate\s*\([^)]*\)\s*\{/;
  const onCreateInfo = findMethodInsertPosition(modifiedContent, onCreatePattern, /super\.onCreate\([^)]*\)/);
  
  if (!onCreateInfo) {
    // onCreate doesn't exist, add complete method (blend mode: no setTheme, only window settings)
    let onCreateCode = `
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT
  }`;
    
    // Fix onCreate format after insertion if needed
    // This will be handled in the else block below
    
    // Find insertion point (before getMainComponentName or before companion object, but inside class)
    const getMainComponentMatch = modifiedContent.match(/override\s+fun\s+getMainComponentName/);
    const companionObjectMatch = modifiedContent.match(/companion\s+object\s*\{/);
    
    // Find class end brace (the closing brace of MainActivity class)
    let classEndIndex = -1;
    const classMatchForOnCreate = modifiedContent.match(/class\s+MainActivity\s*[^:]*:/);
    if (classMatchForOnCreate) {
      let braceCount = 0;
      const classStartIndex = modifiedContent.indexOf(classMatchForOnCreate[0]);
      let foundClassStart = false;
      
      for (let i = classStartIndex; i < modifiedContent.length; i++) {
        if (modifiedContent[i] === '{') {
          braceCount++;
          foundClassStart = true;
        } else if (modifiedContent[i] === '}') {
          braceCount--;
          if (foundClassStart && braceCount === 0) {
            classEndIndex = i;
            break;
          }
        }
      }
    }
    
    if (getMainComponentMatch) {
      const insertPos = modifiedContent.indexOf(getMainComponentMatch[0]);
      // Ensure insertPos is before class end
      if (classEndIndex === -1 || insertPos < classEndIndex) {
        modifiedContent = modifiedContent.substring(0, insertPos) +
                         onCreateCode + '\n\n' +
                         modifiedContent.substring(insertPos);
      } else {
        // Insert before class end
        modifiedContent = modifiedContent.substring(0, classEndIndex) +
                         onCreateCode + '\n\n' +
                         modifiedContent.substring(classEndIndex);
      }
    } else if (companionObjectMatch) {
      // Insert before companion object but inside class
      const companionIndex = modifiedContent.indexOf(companionObjectMatch[0]);
      if (classEndIndex === -1 || companionIndex < classEndIndex) {
        modifiedContent = modifiedContent.substring(0, companionIndex) +
                         onCreateCode + '\n\n' +
                         modifiedContent.substring(companionIndex);
      } else {
        // Insert before class end
        modifiedContent = modifiedContent.substring(0, classEndIndex) +
                         onCreateCode + '\n\n' +
                         modifiedContent.substring(classEndIndex);
      }
    } else if (classEndIndex !== -1) {
      // Insert before class end brace
      modifiedContent = modifiedContent.substring(0, classEndIndex) +
                       onCreateCode + '\n\n' +
                       modifiedContent.substring(classEndIndex);
    } else {
      // Fallback: find last method before class end
      const lastMethodMatch = modifiedContent.match(/(override\s+fun\s+\w+[^}]*\{[^}]*\})/);
      if (lastMethodMatch) {
        const lastMethodEnd = modifiedContent.indexOf(lastMethodMatch[0]) + lastMethodMatch[0].length;
        modifiedContent = modifiedContent.substring(0, lastMethodEnd) +
                         '\n\n' + onCreateCode + '\n' +
                         modifiedContent.substring(lastMethodEnd);
      } else {
        // Last resort: use last brace but ensure it's inside class
        const lastBraceIndex = modifiedContent.lastIndexOf('}');
        // Check if this brace is likely the class end
        const beforeLastBrace = modifiedContent.substring(Math.max(0, lastBraceIndex - 100), lastBraceIndex);
        if (beforeLastBrace.includes('class MainActivity') || beforeLastBrace.includes('override fun')) {
          modifiedContent = modifiedContent.substring(0, lastBraceIndex) +
                           onCreateCode + '\n' +
                           modifiedContent.substring(lastBraceIndex);
        } else {
          // Find the class end brace more carefully
          const classMatch = modifiedContent.match(/class\s+MainActivity\s*[^:]*:/);
          if (classMatch) {
            let braceCount = 0;
            const classStart = modifiedContent.indexOf(classMatch[0]);
            for (let i = classStart; i < modifiedContent.length; i++) {
              if (modifiedContent[i] === '{') braceCount++;
              if (modifiedContent[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  modifiedContent = modifiedContent.substring(0, i) +
                                   onCreateCode + '\n' +
                                   modifiedContent.substring(i);
                  break;
                }
              }
            }
          }
        }
      }
    }
  } else {
    // onCreate exists, insert plugin code after super.onCreate() if not exists (incremental overlay)
    const onCreateContent = onCreateInfo.methodContent;
    
    // Remove setTheme(R.style.AppTheme) if exists (blend mode doesn't need it in onCreate)
    const hasSetTheme = onCreateContent.includes('setTheme(R.style.AppTheme)');
    if (hasSetTheme) {
      const setThemeRegex = /(\s*\/\/\s*[^\n]*\n)*\s*setTheme\s*\(\s*R\.style\.AppTheme\s*\)\s*;?\s*\n?/g;
      const cleanedOnCreateContent = onCreateContent.replace(setThemeRegex, '');
      const onCreateStart = onCreateInfo.methodStart;
      const onCreateEnd = onCreateStart + onCreateContent.length;
      modifiedContent = modifiedContent.substring(0, onCreateStart) +
                       cleanedOnCreateContent +
                       modifiedContent.substring(onCreateEnd);
      
      // Recalculate onCreateInfo after removing setTheme
      const updatedOnCreateInfo = findMethodInsertPosition(modifiedContent, onCreatePattern, /super\.onCreate\([^)]*\)/);
      if (updatedOnCreateInfo) {
        const updatedOnCreateContent = updatedOnCreateInfo.methodContent;
        const needsWindowSettings = 
          (!updatedOnCreateContent.includes('window.statusBarColor') || 
           !updatedOnCreateContent.includes('window.navigationBarColor'));
        
        if (needsWindowSettings) {
          const windowSettingsCode = `
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT`;
          
          modifiedContent = modifiedContent.substring(0, updatedOnCreateInfo.insertAfterSuper) +
                           windowSettingsCode + '\n' +
                           modifiedContent.substring(updatedOnCreateInfo.insertAfterSuper);
        }
      }
    } else {
      // No setTheme, just check and add window settings if needed
      const needsWindowSettings = 
        (!onCreateContent.includes('window.statusBarColor') || 
         !onCreateContent.includes('window.navigationBarColor'));
      
      if (needsWindowSettings) {
        const windowSettingsCode = `
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT`;
        
        modifiedContent = modifiedContent.substring(0, onCreateInfo.insertAfterSuper) +
                         windowSettingsCode + '\n' +
                         modifiedContent.substring(onCreateInfo.insertAfterSuper);
      }
    }
    
    // Fix onCreate format: ensure super.onCreate(null) is on a new line after {
    const onCreateMatch = modifiedContent.match(/override\s+fun\s+onCreate\s*\([^)]*\)\s*\{[^\n]*super\.onCreate\(null\)/);
    if (onCreateMatch) {
      const onCreateIndex = modifiedContent.indexOf(onCreateMatch[0]);
      const onCreateLine = modifiedContent.substring(onCreateIndex, onCreateIndex + onCreateMatch[0].length);
      if (onCreateLine.includes('{super.onCreate(null)') || onCreateLine.includes('{super.onCreate(null)')) {
        // Fix format: add newline after {
        modifiedContent = modifiedContent.substring(0, onCreateIndex) +
                         onCreateMatch[0].replace(/\{([^\n]*super\.onCreate\(null\))/, '{\n    $1') +
                         modifiedContent.substring(onCreateIndex + onCreateMatch[0].length);
      }
    }
  }
  
  // Step 5: Handle onContentChanged method (incremental overlay mode)
  const onContentChangedPattern = /override\s+fun\s+onContentChanged\s*\([^)]*\)\s*\{/;
  const onContentChangedInfo = findMethodInsertPosition(modifiedContent, onContentChangedPattern, /super\.onContentChanged\([^)]*\)/);
  
  if (!onContentChangedInfo) {
    // onContentChanged doesn't exist, add complete method after onCreate
    const onCreateMatchForInsert = modifiedContent.match(/override\s+fun\s+onCreate\s*\([^)]*\)\s*\{/);
    if (onCreateMatchForInsert) {
      // Find all matches to get the correct one
      let onCreateIndexForInsert = -1;
      const allMatches: number[] = [];
      let searchStart = 0;
      while (true) {
        const match = modifiedContent.substring(searchStart).match(/override\s+fun\s+onCreate\s*\([^)]*\)\s*\{/);
        if (!match) break;
        const matchIndex = searchStart + match.index!;
        allMatches.push(matchIndex);
        searchStart = matchIndex + match[0].length;
      }
      if (allMatches.length > 0) {
        onCreateIndexForInsert = allMatches[allMatches.length - 1];
      } else {
        onCreateIndexForInsert = modifiedContent.indexOf(onCreateMatchForInsert[0]);
      }
      
      // Find onCreate method end using brace matching
      let braceCount = 0;
      let onCreateEndIndexForInsert = onCreateIndexForInsert + onCreateMatchForInsert[0].length;
      let foundStart = false;
      
      for (let i = onCreateIndexForInsert; i < modifiedContent.length; i++) {
        if (modifiedContent[i] === '{') {
          braceCount++;
          foundStart = true;
        } else if (modifiedContent[i] === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            onCreateEndIndexForInsert = i + 1;
            break;
          }
        }
      }
      
      const onContentChangedCode = `
  override fun onContentChanged() {
    super.onContentChanged()
    // 同步添加视图，避免在渲染过程中出现 null 引用导致崩溃
    try {
      setupSplashImageView()
      setupWebViewContainer()
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error in onContentChanged", e)
    }
  }`;
      
      // Insert after onCreate method
      modifiedContent = modifiedContent.substring(0, onCreateEndIndexForInsert) +
                       '\n' + onContentChangedCode + '\n' +
                       modifiedContent.substring(onCreateEndIndexForInsert);
    } else {
      // Fallback: insert before getMainComponentName
      const getMainComponentMatch = modifiedContent.match(/override\s+fun\s+getMainComponentName/);
      if (getMainComponentMatch) {
        const insertPos = modifiedContent.indexOf(getMainComponentMatch[0]);
        const onContentChangedCode = `
  override fun onContentChanged() {
    super.onContentChanged()
    // 同步添加视图，避免在渲染过程中出现 null 引用导致崩溃
    try {
      setupSplashImageView()
      setupWebViewContainer()
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error in onContentChanged", e)
    }
  }`;
        modifiedContent = modifiedContent.substring(0, insertPos) +
                         onContentChangedCode + '\n\n' +
                         modifiedContent.substring(insertPos);
      }
    }
  } else {
    // onContentChanged exists, insert plugin code after super.onContentChanged() if not exists (incremental overlay)
    const onContentChangedContent = onContentChangedInfo.methodContent;
    const needsPluginCode = !onContentChangedContent.includes('setupSplashImageView()') ||
                            !onContentChangedContent.includes('setupWebViewContainer()');
    
    if (needsPluginCode) {
      const pluginCode = `
    // 同步添加视图，避免在渲染过程中出现 null 引用导致崩溃
    try {
      setupSplashImageView()
      setupWebViewContainer()
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error in onContentChanged", e)
    }`;
      
      modifiedContent = modifiedContent.substring(0, onContentChangedInfo.insertAfterSuper) +
                       pluginCode + '\n' +
                       modifiedContent.substring(onContentChangedInfo.insertAfterSuper);
    }
  }
  
  // Step 6: Add ImageView container code (if not exists)
  if (!modifiedContent.includes('splashImageViewContainer')) {
    const imageViewCode = `
  private var splashImageViewContainer: ViewGroup? = null
  private var preventAutoHideImageView = false

  /**
   * 安全地设置视图可见性，自动处理异常
   */
  private fun safeSetVisibility(view: View?, visibility: Int, viewName: String) {
    try {
      view?.visibility = visibility
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error setting $viewName visibility", e)
    }
  }

  private fun safeRemoveViewFromParent(child: View?, parent: ViewGroup?, viewName: String): Boolean {
    if (child == null || parent == null) {
      android.util.Log.d("MainActivity", "$viewName or parent is null, cannot remove")
      return false
    }
    
    try {
      val childCount = parent.childCount
      var found = false
      for (i in 0 until childCount) {
        if (parent.getChildAt(i) == child) {
          found = true
          break
        }
      }
      
      if (found) {
        parent.removeView(child)
        android.util.Log.d("MainActivity", "$viewName removed from parent")
        return true
      } else {
        android.util.Log.d("MainActivity", "$viewName not found in parent")
        return false
      }
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error removing $viewName", e)
      return false
    }
  }

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

      // Use window.decorView to ensure on top layer (but below WebView container)
      val decorView = window.decorView as? ViewGroup
      if (decorView != null) {
        decorView.addView(splashImageViewContainer)
        // ImageView container should be below WebView container
        splashImageViewContainer?.visibility = View.VISIBLE
        splashImageViewContainer?.elevation = Float.MAX_VALUE - 1 // Below WebView container
        android.util.Log.d("MainActivity", "Splash ImageView container added to decorView")
      }
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error creating splash ImageView container", e)
    }
  }

  fun hideSplashImageViewContainer(force: Boolean = false) {
    // Ensure all UI operations execute on main thread
    if (Looper.myLooper() == Looper.getMainLooper()) {
      hideSplashImageViewContainerInternal(force)
    } else {
      android.util.Log.d("MainActivity", "hideSplashImageViewContainer called from background thread, posting to main thread")
      Handler(Looper.getMainLooper()).post {
        hideSplashImageViewContainerInternal(force)
      }
    }
  }

  private fun hideSplashImageViewContainerInternal(force: Boolean = false) {
    try {
      // If preventAutoHideImageView is true and not force hide, don't execute hide operation
      if (preventAutoHideImageView && !force) {
        android.util.Log.d("MainActivity", "hideSplashImageViewContainer prevented by preventAutoHideImageView flag")
        return
      }

      if (splashImageViewContainer != null) {
        android.util.Log.d("MainActivity", "Hiding Splash ImageView container")

        // First set visibility to GONE to ensure invisible
        safeSetVisibility(splashImageViewContainer, View.GONE, "Splash ImageView container")

        // Try to remove from parent view with validation
        val parent = splashImageViewContainer?.parent as? ViewGroup
        if (parent != null) {
          val removed = safeRemoveViewFromParent(splashImageViewContainer, parent, "Splash ImageView container")
          if (!removed) {
            android.util.Log.d("MainActivity", "Splash ImageView container not found in parent, trying to remove from decorView")
            // If not found in parent, try to remove directly from decorView
            try {
              val decorView = window.decorView as? ViewGroup
              if (decorView != null) {
                safeRemoveViewFromParent(splashImageViewContainer, decorView, "Splash ImageView container from decorView")
              }
            } catch (e: Exception) {
              android.util.Log.e("MainActivity", "Error removing Splash ImageView container from decorView", e)
            }
          }
        } else {
          android.util.Log.d("MainActivity", "Splash ImageView container has no parent, trying to remove from decorView")
          // If parent is null, try to remove directly from decorView
          try {
            val decorView = window.decorView as? ViewGroup
            if (decorView != null) {
              safeRemoveViewFromParent(splashImageViewContainer, decorView, "Splash ImageView container from decorView")
            }
          } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error removing Splash ImageView container from decorView", e)
          }
        }

        // Clean up all child views
        try {
          splashImageViewContainer?.removeAllViews()
        } catch (e: Exception) {
          android.util.Log.e("MainActivity", "Error removing all views from Splash ImageView container", e)
        }

        // Clear reference
        splashImageViewContainer = null
        preventAutoHideImageView = false
        android.util.Log.d("MainActivity", "Splash ImageView container hidden")
      } else {
        android.util.Log.d("MainActivity", "Splash ImageView container is null, skipping")
      }
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error hiding splash ImageView container", e)
    }
  }`;
    
    // Insert ImageView container code into MainActivity class
    const classIndex = modifiedContent.indexOf(classMatch[0]) + classMatch[0].length;
    const afterClass = modifiedContent.substring(classIndex);
    const companionObjectMatch = afterClass.match(/companion\s+object\s*\{/);
    
    if (companionObjectMatch) {
      const companionIndex = classIndex + companionObjectMatch.index!;
      modifiedContent = modifiedContent.substring(0, companionIndex) +
                       imageViewCode +
                       '\n' +
                       modifiedContent.substring(companionIndex);
    } else {
      // Find first method or property to insert before it
      // Match: fun, override fun, private var, var, etc.
      const firstMethodMatch = afterClass.match(/\s+(override\s+)?fun\s+|\s+private\s+var\s+|\s+var\s+|\s+val\s+/);
      if (firstMethodMatch) {
        const insertIndex = classIndex + firstMethodMatch.index!;
        // Check if we're inserting right after "private" (which would cause duplicate "private")
        const beforeInsert = modifiedContent.substring(Math.max(0, insertIndex - 20), insertIndex);
        if (beforeInsert.trimEnd().endsWith('private')) {
          // Insert after the line break to avoid duplicate "private"
          const lineBreakIndex = modifiedContent.lastIndexOf('\n', insertIndex - 1);
          if (lineBreakIndex !== -1) {
            modifiedContent = modifiedContent.substring(0, lineBreakIndex + 1) +
                             imageViewCode +
                             '\n' +
                             modifiedContent.substring(lineBreakIndex + 1);
          } else {
            modifiedContent = modifiedContent.substring(0, insertIndex) +
                             imageViewCode +
                             '\n' +
                             modifiedContent.substring(insertIndex);
          }
        } else {
          modifiedContent = modifiedContent.substring(0, insertIndex) +
                           imageViewCode +
                           '\n' +
                           modifiedContent.substring(insertIndex);
        }
      } else {
        const lastBraceIndex = modifiedContent.lastIndexOf('}');
        modifiedContent = modifiedContent.substring(0, lastBraceIndex) +
                         imageViewCode +
                         '\n' +
                         modifiedContent.substring(lastBraceIndex);
      }
    }
  }
  
  // Step 7: Update preventAutoHide method to also handle ImageView container (if exists)
  const preventAutoHideMethodStart = modifiedContent.indexOf('fun preventAutoHide()');
  if (preventAutoHideMethodStart !== -1) {
    const methodSignatureEnd = modifiedContent.indexOf('{', preventAutoHideMethodStart);
    if (methodSignatureEnd !== -1) {
      let braceCount = 0;
      let methodEnd = methodSignatureEnd + 1;
      let foundStart = false;
      
      for (let i = methodSignatureEnd; i < modifiedContent.length; i++) {
        if (modifiedContent[i] === '{') {
          braceCount++;
          foundStart = true;
        } else if (modifiedContent[i] === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            methodEnd = i + 1;
            break;
          }
        }
      }
      
      const preventAutoHideContent = modifiedContent.substring(preventAutoHideMethodStart, methodEnd);
      const needsImageViewSupport = !preventAutoHideContent.includes('preventAutoHideImageView') ||
                                    !preventAutoHideContent.includes('setupSplashImageView()');
      
      if (needsImageViewSupport) {
        // Check if there's already a log statement with preventAutoHide
        const existingLogMatch = preventAutoHideContent.match(/android\.util\.Log\.d\s*\(\s*"MainActivity"\s*,\s*"preventAutoHide called[^"]*"\s*\)/);
        
        // Insert ImageView support code after preventAutoHide = true
        const preventAutoHideIndex = preventAutoHideContent.indexOf('preventAutoHide = true');
        if (preventAutoHideIndex !== -1) {
          const afterPreventAutoHide = preventAutoHideContent.indexOf('\n', preventAutoHideIndex);
          const insertPos = preventAutoHideMethodStart + (afterPreventAutoHide !== -1 ? afterPreventAutoHide + 1 : preventAutoHideIndex + 'preventAutoHide = true'.length);
          
          let imageViewSupportCode = `
      preventAutoHideImageView = true`;
          
          // Only add log if there's no existing log, or replace existing log
          if (existingLogMatch) {
            // Replace existing log with updated one
            const existingLogIndex = preventAutoHideMethodStart + preventAutoHideContent.indexOf(existingLogMatch[0]);
            const existingLogEnd = existingLogIndex + existingLogMatch[0].length;
            const updatedLog = `android.util.Log.d("MainActivity", "preventAutoHide called, preventAutoHide: $preventAutoHide, preventAutoHideImageView: $preventAutoHideImageView")`;
            modifiedContent = modifiedContent.substring(0, existingLogIndex) +
                             updatedLog +
                             modifiedContent.substring(existingLogEnd);
          } else {
            // Add new log
            imageViewSupportCode += `
      android.util.Log.d("MainActivity", "preventAutoHide called, preventAutoHide: $preventAutoHide, preventAutoHideImageView: $preventAutoHideImageView")`;
          }
          
          imageViewSupportCode += `
      // Show ImageView container
      Handler(Looper.getMainLooper()).post {
        setupSplashImageView()
      }`;
          
          modifiedContent = modifiedContent.substring(0, insertPos) +
                           imageViewSupportCode + '\n' +
                           modifiedContent.substring(insertPos);
        }
      }
    }
  }
  
  // Step 8: Update hideWebViewContainerInternal to use safe methods and correct order
  // Strategy: Find the method, replace specific parts step by step with simple string operations
  const hideWebViewMethodStart = modifiedContent.indexOf('private fun hideWebViewContainerInternal');
  if (hideWebViewMethodStart !== -1) {
    const methodSignatureEnd = modifiedContent.indexOf('{', hideWebViewMethodStart);
    if (methodSignatureEnd !== -1) {
      // Find method end by matching braces
      let braceCount = 0;
      let methodEnd = methodSignatureEnd + 1;
      let foundStart = false;
      
      for (let i = methodSignatureEnd; i < modifiedContent.length; i++) {
        if (modifiedContent[i] === '{') {
          braceCount++;
          foundStart = true;
        } else if (modifiedContent[i] === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            methodEnd = i + 1;
            break;
          }
        }
      }
      
      let methodContent = modifiedContent.substring(hideWebViewMethodStart, methodEnd);
      let needsUpdate = false;
      
      // Fix 1: Replace webViewContainer?.visibility = View.GONE with safeSetVisibility
      if (methodContent.includes('webViewContainer?.visibility = View.GONE') && 
          !methodContent.includes('safeSetVisibility(webViewContainer')) {
        // Find and replace the visibility line, ensuring proper formatting
        const visibilityIndex = methodContent.indexOf('webViewContainer?.visibility = View.GONE');
        if (visibilityIndex !== -1) {
          // Find the start of this section (after "First set visibility" comment)
          const commentStart = methodContent.lastIndexOf('// First set visibility', visibilityIndex);
          const lineStart = commentStart !== -1 ? commentStart : methodContent.lastIndexOf('\n', visibilityIndex) + 1;
          
          // Find where the next comment or code starts (after this line)
          let lineEnd = methodContent.indexOf('\n', visibilityIndex);
          if (lineEnd === -1) {
            lineEnd = methodContent.length;
          } else {
            lineEnd += 1; // Include the newline
          }
          
          // Check if there's a comment on the same line that needs to be moved
          const lineContent = methodContent.substring(visibilityIndex, lineEnd);
          const hasInlineComment = lineContent.includes('//');
          
          // Get indentation
          const indent = '        ';
          
          if (hasInlineComment && lineContent.includes('// Try to remove')) {
            // The comment is on the same line, move it to next line
            methodContent = methodContent.substring(0, lineStart) +
                           indent + '// First set visibility to GONE to ensure invisible\n' +
                           indent + 'safeSetVisibility(webViewContainer, View.GONE, "WebView container")\n' +
                           indent + '// Try to remove from parent view with validation\n' +
                           methodContent.substring(lineEnd);
          } else {
            // Simple replacement
            methodContent = methodContent.substring(0, lineStart) +
                           indent + '// First set visibility to GONE to ensure invisible\n' +
                           indent + 'safeSetVisibility(webViewContainer, View.GONE, "WebView container")\n' +
                           methodContent.substring(lineEnd);
          }
          needsUpdate = true;
        }
      }
      
      // Fix 2: Replace parent.removeView with safeRemoveViewFromParent
      if (methodContent.includes('parent.removeView(webViewContainer)') && 
          !methodContent.includes('safeRemoveViewFromParent(webViewContainer')) {
        // Find the start of remove logic (after safeSetVisibility line)
        const visibilityLineEnd = methodContent.indexOf('safeSetVisibility(webViewContainer');
        const removeStart = visibilityLineEnd !== -1 ? 
          methodContent.indexOf('// Try to remove', visibilityLineEnd) : 
          methodContent.indexOf('// Try to remove from parent view');
        
        // Find the end: before "// Clean up all child views"
        const removeEnd = methodContent.indexOf('// Clean up all child views');
        
        if (removeStart !== -1 && removeEnd !== -1 && removeEnd > removeStart) {
          // Find the actual end of the else block (before "Clean up")
          let actualEnd = removeEnd;
          // Go back to find the closing brace of else block
          const beforeCleanup = methodContent.substring(Math.max(0, removeEnd - 200), removeEnd);
          const lastBraceBeforeCleanup = beforeCleanup.lastIndexOf('}');
          if (lastBraceBeforeCleanup !== -1) {
            // Find the newline after the closing brace
            const bracePos = removeEnd - 200 + lastBraceBeforeCleanup;
            const newlineAfterBrace = methodContent.indexOf('\n', bracePos);
            if (newlineAfterBrace !== -1 && newlineAfterBrace < removeEnd) {
              actualEnd = newlineAfterBrace + 1;
            }
          }
          
          const safeRemoveCode = `        // Try to remove from parent view with validation
        val parent = webViewContainer?.parent as? ViewGroup
        if (parent != null) {
          val removed = safeRemoveViewFromParent(webViewContainer, parent, "WebView container")
          if (!removed) {
            android.util.Log.d("MainActivity", "WebView container not found in parent, trying to remove from decorView")
            // If not found in parent, try to remove directly from decorView
            try {
              val decorView = window.decorView as? ViewGroup
              if (decorView != null) {
                safeRemoveViewFromParent(webViewContainer, decorView, "WebView container from decorView")
              }
            } catch (e: Exception) {
              android.util.Log.e("MainActivity", "Error removing WebView container from decorView", e)
            }
          }
        } else {
          android.util.Log.d("MainActivity", "WebView container has no parent, trying to remove from decorView")
          // If parent is null, try to remove directly from decorView
          try {
            val decorView = window.decorView as? ViewGroup
            if (decorView != null) {
              safeRemoveViewFromParent(webViewContainer, decorView, "WebView container from decorView")
            }
          } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error removing WebView container from decorView", e)
          }
        }
        
`;
          
          methodContent = methodContent.substring(0, removeStart) +
                         safeRemoveCode +
                         methodContent.substring(actualEnd);
          needsUpdate = true;
        }
      }
      
      // Fix 3: Insert ImageView container hide BEFORE SplashScreen2Activity handling
      const needsImageViewHide = !methodContent.includes('hideSplashImageViewContainer');
      const hasSplashScreen2Activity = methodContent.includes('// Also hide SplashScreen2Activity');
      
      if (needsImageViewHide && hasSplashScreen2Activity) {
        const splashScreen2Index = methodContent.indexOf('// Also hide SplashScreen2Activity');
        methodContent = methodContent.substring(0, splashScreen2Index) +
                       '\n\n      // Also hide ImageView container\n' +
                       '      hideSplashImageViewContainer(force)\n' +
                       methodContent.substring(splashScreen2Index);
        needsUpdate = true;
      } else if (needsImageViewHide && !hasSplashScreen2Activity) {
        // Insert after WebView cleanup, before preventAutoHide
        const preventAutoHideIndex = methodContent.indexOf('preventAutoHide = false');
        if (preventAutoHideIndex !== -1) {
          const insertPos = methodContent.lastIndexOf('\n', preventAutoHideIndex);
          methodContent = methodContent.substring(0, insertPos !== -1 ? insertPos + 1 : preventAutoHideIndex) +
                         '\n      // Also hide ImageView container\n' +
                         '      hideSplashImageViewContainer(force)\n' +
                         methodContent.substring(insertPos !== -1 ? insertPos + 1 : preventAutoHideIndex);
          needsUpdate = true;
        }
      }
      
      // Fix 4: Add theme setting before preventAutoHide = false
      const needsThemeSetting = !methodContent.includes('setTheme(R.style.AppTheme)');
      if (needsThemeSetting) {
        const preventAutoHideIndex = methodContent.indexOf('preventAutoHide = false');
        if (preventAutoHideIndex !== -1) {
          const lineStart = methodContent.lastIndexOf('\n', preventAutoHideIndex) + 1;
          const lineEnd = methodContent.indexOf('\n', preventAutoHideIndex);
          const actualLineEnd = lineEnd !== -1 ? lineEnd : preventAutoHideIndex + 'preventAutoHide = false'.length;
          
          methodContent = methodContent.substring(0, lineStart) +
                         '\n      // Manually set MainActivity theme to @style/AppTheme after hiding splash screen\n' +
                         '      try {\n' +
                         '        setTheme(R.style.AppTheme)\n' +
                         '        android.util.Log.d("MainActivity", "MainActivity theme set to @style/AppTheme")\n' +
                         '      } catch (e: Exception) {\n' +
                         '        android.util.Log.e("MainActivity", "Error setting theme to AppTheme", e)\n' +
                         '      }\n' +
                         '\n      // Reset preventAutoHide flag (regardless of whether hide was successful)\n' +
                         '      preventAutoHide = false\n' +
                         methodContent.substring(actualLineEnd);
          needsUpdate = true;
        }
      }
      
      // Update the method if changed
      if (needsUpdate) {
        modifiedContent = modifiedContent.substring(0, hideWebViewMethodStart) +
                         methodContent +
                         modifiedContent.substring(methodEnd);
      }
    }
  }
  
  // Step 9: Add companion object with actionStart method (if not exists)
  const hasCompanionObject = modifiedContent.includes('companion object') && modifiedContent.includes('actionStart');
  if (!hasCompanionObject) {
    const companionObjectCode = `
  companion object {
    fun actionStart(context: android.content.Context) {
      val intent = android.content.Intent(context, MainActivity::class.java)
      context.startActivity(intent)
      // Add fade-in fade-out animation effect
      if (context is android.app.Activity) {
        context.overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
      }
    }
  }`;
    
    // Find the last closing brace of the class (before any nested classes or companion objects)
    const classMatchForCompanion = modifiedContent.match(/class\s+MainActivity\s*[^:]*:/);
    if (classMatchForCompanion) {
      let braceCount = 0;
      const classStartIndex = modifiedContent.indexOf(classMatchForCompanion[0]);
      let foundClassStart = false;
      let classEndIndex = -1;
      
      for (let i = classStartIndex; i < modifiedContent.length; i++) {
        if (modifiedContent[i] === '{') {
          braceCount++;
          foundClassStart = true;
        } else if (modifiedContent[i] === '}') {
          braceCount--;
          if (foundClassStart && braceCount === 0) {
            classEndIndex = i;
            break;
          }
        }
      }
      
      if (classEndIndex !== -1) {
        // Insert companion object before the closing brace
        modifiedContent = modifiedContent.substring(0, classEndIndex) +
                         companionObjectCode +
                         '\n' +
                         modifiedContent.substring(classEndIndex);
      } else {
        // Fallback: use last brace
        const lastBraceIndex = modifiedContent.lastIndexOf('}');
        modifiedContent = modifiedContent.substring(0, lastBraceIndex) +
                         companionObjectCode +
                         '\n' +
                         modifiedContent.substring(lastBraceIndex);
      }
    }
  }
  
  return modifiedContent;
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
 * Modify AndroidManifest.xml for responsiveImage mode (MainActivity uses @style/AppTheme)
 */
function modifyAndroidManifestForImageMode(
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
  
  // Set MainActivity's theme to @style/AppTheme for responsiveImage mode
  if (mainActivity && mainActivity.$) {
    mainActivity.$['android:theme'] = '@style/AppTheme';
  }

  return manifest;
}

/**
 * Modify AndroidManifest.xml for Blend mode (MainActivity uses @style/Theme.App.SplashScreen)
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
  
  // Set MainActivity's theme to @style/Theme.App.SplashScreen for blend mode
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
      // ResponsiveImage 模式：全屏背景图（向上延伸 1px，与 storyboard 保持一致）
      // 向上延伸 1px 以覆盖安全区域，避免顶部出现 1px 白线
      let fullScreenFrame = CGRect(
        x: window.bounds.origin.x,
        y: window.bounds.origin.y - 1,
        width: window.bounds.width,
        height: window.bounds.height + 1
      )
      imageView = UIImageView(frame: fullScreenFrame)
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
  // Note: Background image setting is now handled in SplashScreen2ViewController.viewDidLoad()
  // SplashScreen2ViewController will automatically detect blend mode by checking for splash_background_image file
  // No need to set background image in AppDelegate to avoid duplication
  return modifyAppDelegate(content, backgroundColor);
}

/**
 * 修改 AppDelegate.swift，添加自定义开屏逻辑
 */
function modifyAppDelegate(content: string, backgroundColor: string = '#ffffff'): string {
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
    
    // 保存 backgroundColor 到 UserDefaults，供 SplashScreen2ViewController 使用
    UserDefaults.standard.set("${backgroundColor}", forKey: "SplashScreenBackgroundColor")
    UserDefaults.standard.synchronize()
    
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
      // 注意：top 约束使用 constant="-1" 确保背景图片完全覆盖，包括安全区域，避免顶部出现 1px 白线
      mainView.constraints[0].constraint = [];
      ensureUniquePush(
        mainView.constraints[0].constraint,
        createConstraint([IMAGE_ID, 'top'], [CONTAINER_ID, 'top'], '-1')
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
    const imagePath = pluginConfig?.ios?.image || pluginConfig?.image;
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
  const androidImage = pluginConfig.android?.image || pluginConfig.image;
  const iosImage = pluginConfig.ios?.image || pluginConfig.image;
  if (!androidImage && !iosImage) {
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

      if (!androidImage) return config;
      // 复制背景图到 Android 资源目录
      const imageResourceName = copyBackgroundImage(
        projectRoot,
        androidImage!,
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
    if (!androidImage) return config;
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

  // 修改 AndroidManifest.xml，设置 MainActivity 主题为 @style/AppTheme
  config = withAndroidManifest(config, (config) => {
    if (!androidImage) return config;
    config.modResults = modifyAndroidManifestForImageMode(config.modResults, packageName);
    return config;
  });

  // 修改 MainActivity.kt，添加图片容器
  config = withMainActivity(config, (config) => {
    if (!androidImage) return config;
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

      if (!iosImage) return config;
      // 复制背景图到 iOS bundle
      const imageFileName = copyBackgroundImageToIOS(
        projectRoot,
        iosImage!,
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
      
      if (!iosImage) return config;
      // 获取背景图文件名
      const backgroundImagePath = path.resolve(projectRoot, iosImage!);
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
        
        if (!iosImage) return config;
        if (fs.existsSync(storyboardPath)) {
          const backgroundImagePath = path.resolve(projectRoot, iosImage!);
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
    if (!iosImage) return config;
    if (config.modResults.language === 'swift') {
      const backgroundImagePath = path.resolve(
        config.modRequest.projectRoot || '',
        iosImage!
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
    if (!iosImage) return config;
    const proj = config.modResults;
    const projectRoot = config.modRequest.projectRoot || '';
    const projectName = config.modRequest.projectName;
    const iosPath = path.join(projectRoot, 'ios');
    
    if (!projectName) {
      return config;
    }

    const backgroundImagePath = path.resolve(projectRoot, iosImage!);
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
  const androidImage = pluginConfig.android?.image || pluginConfig.image;
  const iosImage = pluginConfig.ios?.image || pluginConfig.image;
  // 必填字段检查
  if (!androidImage && !iosImage) {
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

      if (!androidImage) return config;
      // 1. 复制图片资源到 drawable-xxhdpi (浅色模式)
      const imagePath = path.resolve(projectRoot, androidImage!);
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
        androidImage!,
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
    if (!androidImage) return config;
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
      
      if (!iosImage) return cfg;
      // 创建 Asset Catalog imageset 用于支持深色模式
      const imagePath = path.resolve(projectRoot, iosImage!);
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
    if (!iosImage) return cfg;
    const imagePath = iosImage!;
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
    if (!iosImage) return config;
    if (config.modResults.language === 'swift') {
      const imagePath = path.resolve(
        config.modRequest.projectRoot || '',
        iosImage!
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
  const androidImage = pluginConfig.android?.image || pluginConfig.image;
  const iosImage = pluginConfig.ios?.image || pluginConfig.image;

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
      const iconPath = androidImage || config.icon;
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

      // 读取 edgeToEdgeEnabled 配置
      const edgeToEdgeEnabled = config.android?.edgeToEdgeEnabled;

      // 生成 CustomSplashActivity
      if (projectRoot) {
        generateCustomSplashActivity(packageName, projectRoot, androidMainPath, pluginConfig.backgroundColor || '#ffffff', edgeToEdgeEnabled);
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
    const edgeToEdgeEnabled = config.android?.edgeToEdgeEnabled;
    config.modResults.contents = modifyMainActivity(
      config.modResults.contents,
      packageName,
      pluginConfig.backgroundColor || '#ffffff',
      edgeToEdgeEnabled
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
  const imagePath = iosImage;
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
      const backgroundColor = pluginConfig?.backgroundColor || 
                            config.splash?.backgroundColor || 
                            '#ffffff';
      config.modResults.contents = modifyAppDelegate(config.modResults.contents, backgroundColor);
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
  const androidImage = pluginConfig.android?.image || pluginConfig.image;
  const iosImage = pluginConfig.ios?.image || pluginConfig.image;
  if (!androidImage && !iosImage) {
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

      if (!androidImage) return config;
      // 复制.9图到drawable-xxhdpi（类似responsiveImage模式）
      const imageResourceName = copyBackgroundImage(
        projectRoot,
        androidImage!,
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

      // 读取 edgeToEdgeEnabled 配置
      const edgeToEdgeEnabled = config.android?.edgeToEdgeEnabled;

      // 生成 CustomSplashActivity（WebView容器背景使用.9图）
      if (projectRoot) {
        generateCustomSplashActivityForBlendMode(packageName, projectRoot, androidMainPath, imageResourceName, edgeToEdgeEnabled);
        generatePrivacyPolicyActivity(packageName, projectRoot, androidMainPath);
      } else {
        console.warn('[expo-splash-screen2] projectRoot is undefined, skipping activity generation');
      }
      return config;
    },
  ]);

  // 修改 AndroidManifest.xml（blend模式下MainActivity使用Theme.App.SplashScreen）
  config = withAndroidManifest(config, (config) => {
    if (!androidImage) return config;
    config.modResults = modifyAndroidManifestForBlendMode(config.modResults, packageName);
    return config;
  });

  // 修改 MainActivity.kt（WebView容器背景使用.9图）
  config = withMainActivity(config, (config) => {
    if (!androidImage) return config;
    const edgeToEdgeEnabled = config.android?.edgeToEdgeEnabled;
    config.modResults.contents = modifyMainActivityForBlendMode(
      config.modResults.contents,
      packageName,
      savedImageResourceName,
      edgeToEdgeEnabled
    );
    return config;
  });

  // 修改 styles.xml，设置windowBackground为.9图（类似responsiveImage模式）
  config = withAndroidStyles(config, (config) => {
    if (!androidImage) return config;
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
      
      if (!iosImage) return config;
      const imageFileName = copyBackgroundImageToIOS(
        projectRoot,
        iosImage!,
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
    
    if (!iosImage) return config;
    // blend模式：使用.9图作为背景（和responsiveImage模式一样）
    // 获取.9图文件名（应该已经在withDangerousMod中复制了）
    const backgroundImagePath = path.resolve(projectRoot, iosImage!);
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
    if (!iosImage) return config;
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
    if (!iosImage) return config;
    config.modResults = modifyInfoPlist(config.modResults);
    return config;
  });

  // 修改 Xcode 项目文件
  config = withXcodeProject(config, (config) => {
    if (!iosImage) return config;
    const configWithIcon = { ...config, icon: iosImage };
    modifyXcodeProject(configWithIcon, pluginConfig, configWithIcon);
    return configWithIcon;
  });

  return config;
}

/**
 * 拷贝开屏背景图到鸿蒙 rawfile 目录（ArkUI Image 加载）。
 * 鸿蒙 ArkUI 不解析 Android .9 标记，直接按普通图渲染（objectFit: Cover 裁掉 1px 黑边）。
 */
function copySplashImageToHarmony(projectRoot: string, imagePath: string | undefined, rawfileDir: string): string | null {
  try {
    if (!imagePath) {
      return null;
    }
    const sourcePath = path.resolve(projectRoot, imagePath);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[expo-splash-screen2] Harmony background image file not found: ${sourcePath}`);
      return null;
    }
    if (!fs.existsSync(rawfileDir)) {
      fs.mkdirSync(rawfileDir, { recursive: true });
    }
    const targetFileName = 'expo_splash.png';
    const targetPath = path.join(rawfileDir, targetFileName);
    fs.copyFileSync(sourcePath, targetPath);
    return targetFileName;
  } catch (error) {
    console.error(`[expo-splash-screen2] Error copying harmony background image: ${error}`);
    return null;
  }
}

/**
 * 写入鸿蒙 element/color.json 的 expo_splash_background 颜色项。
 */
function writeHarmonySplashColor(elementDir: string, backgroundColor: string | undefined): boolean {
  try {
    if (!fs.existsSync(elementDir)) {
      fs.mkdirSync(elementDir, { recursive: true });
    }
    const colorJsonPath = path.join(elementDir, 'color.json');
    let colorJson: { color: Array<{ name: string; value: string }> } = { color: [] };
    if (fs.existsSync(colorJsonPath)) {
      const raw = fs.readFileSync(colorJsonPath, 'utf8');
      colorJson = JSON.parse(raw);
      if (!colorJson.color || !Array.isArray(colorJson.color)) {
        colorJson.color = [];
      }
    }
    let normalized = (backgroundColor || '#ffffff').trim();
    if (!normalized.startsWith('#')) {
      normalized = '#' + normalized;
    }
    const existing = colorJson.color.find((c) => c?.name === 'expo_splash_background');
    if (existing) {
      existing.value = normalized;
    } else {
      colorJson.color.push({ name: 'expo_splash_background', value: normalized });
    }
    fs.writeFileSync(colorJsonPath, JSON.stringify(colorJson, null, 2));
    return true;
  } catch (error) {
    console.error(`[expo-splash-screen2] Error writing harmony color.json: ${error}`);
    return false;
  }
}

/**
 * 设置鸿蒙开屏：拷贝背景图到 rawfile + 写背景色到 color.json。
 * 鸿蒙构建不跑 Expo config-plugin，故由使用方（如 setup-splash-harmony.js）显式调用本函数。
 */
export function setupHarmonyMode(config: any, pluginConfig: SplashHtmlConfig): any {
  const harmonyImage = pluginConfig?.harmony?.image || pluginConfig?.image;
  const backgroundColor = pluginConfig?.harmony?.backgroundColor || pluginConfig?.backgroundColor || '#ffffff';
  if (!harmonyImage) {
    console.warn('[expo-splash-screen2] image is required for harmony mode');
    return config;
  }
  const projectRoot = config?.modRequest?.projectRoot || config?.projectRoot || process.cwd();
  const resourcesDir = path.join(projectRoot, 'harmony', 'entry', 'src', 'main', 'resources');
  const rawfileDir = path.join(resourcesDir, 'rawfile');
  const elementDir = path.join(resourcesDir, 'base', 'element');
  copySplashImageToHarmony(projectRoot, harmonyImage, rawfileDir);
  writeHarmonySplashColor(elementDir, backgroundColor);
  return config;
}

export default withSplashHtml;

