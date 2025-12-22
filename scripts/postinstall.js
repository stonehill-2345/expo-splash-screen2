const fs = require('fs');
const path = require('path');

/**
 * Postinstall script
 * 1. Copy expo-splash-web folder from plugin root to project root (overwrite)
 * 2. Add build:expo-splash-web command to project's package.json
 * 3. Modify project's app.json: add expo-splash-screen2 plugin configuration, remove expo-splash-screen
 * 4. Remove expo-splash-screen dependency from project's package.json
 * 
 * Note: If using pnpm and postinstall script doesn't run automatically, manually run:
 * node node_modules/expo-splash-screen2/scripts/setup.js
 */

// Get plugin root directory (parent directory of current script)
const pluginRoot = path.join(__dirname, '..');

// Check if script is executed from node_modules (indicating it's in a project using the plugin)
const isInNodeModules = __dirname.includes('node_modules');

/**
 * Find directory containing app.json by going up (React Native/Expo project root)
 * This is especially important in monorepo environments, as packages may be hoisted to root
 */
function findProjectRoot(startDir) {
  let currentDir = startDir;
  const root = path.parse(currentDir).root; // Get system root directory (e.g., / or C:\)
  
  while (currentDir !== root) {
    const appJsonPath = path.join(currentDir, 'app.json');
    if (fs.existsSync(appJsonPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  // If app.json not found, return starting directory
  return startDir;
}

// Get project root directory
// 1. Prefer INIT_CWD (environment variable set by npm/pnpm during installation)
// 2. If script is in node_modules, go up to find project root
// 3. Otherwise use current working directory (may be called from subdirectory like example, or manually)
let projectRoot = process.env.INIT_CWD || process.cwd();

// If current directory is in node_modules, go up to find project root
if (isInNodeModules) {
  const parts = __dirname.split(path.sep);
  const nodeModulesIndex = parts.lastIndexOf('node_modules');
  if (nodeModulesIndex !== -1) {
    const candidateRoot = parts.slice(0, nodeModulesIndex).join(path.sep);
    // In monorepo, packages may be hoisted to root, need to continue going up to find directory containing app.json
    projectRoot = findProjectRoot(candidateRoot);
  }
} else {
  // Even if not in node_modules, try to find directory containing app.json (handle manual invocation)
  projectRoot = findProjectRoot(projectRoot);
}

// Check if in plugin development environment (for log hints, but don't skip execution)
// Allow execution in plugin development environment to install expo-splash-web in root directory
const isPluginDevelopment = !isInNodeModules && 
  fs.existsSync(path.join(projectRoot, 'package.json')) &&
  (() => {
    try {
      const projectPackageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
      return projectPackageJson.name === 'expo-splash-screen2';
    } catch (error) {
      return false;
    }
  })();

if (isPluginDevelopment) {
  console.log('[expo-splash-screen2] Running postinstall in plugin development environment');
}

// Source directory: expo-splash-web in plugin root
const sourceDir = path.join(pluginRoot, 'expo-splash-web');
// Target directory: expo-splash-web in project root
const targetDir = path.join(projectRoot, 'expo-splash-web');

// In plugin development environment, source and target are the same, skip copying
const isSameDirectory = path.resolve(sourceDir) === path.resolve(targetDir);

/**
 * Recursively copy directory
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[expo-splash-screen2] Source directory not found: ${src}`);
    return false;
  }

  // Safety check: prevent deleting source directory
  const resolvedSrc = path.resolve(src);
  const resolvedDest = path.resolve(dest);
  if (resolvedSrc === resolvedDest) {
    console.warn(`[expo-splash-screen2] Source and destination are the same, skipping copy: ${src}`);
    return true; // Consider it success since nothing needs to be done
  }

  // If target directory exists, delete it first (overwrite mode)
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  // Create target directory
  fs.mkdirSync(dest, { recursive: true });

  // Read source directory contents
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  return true;
}

/**
 * Modify app.json: add plugin configuration and remove expo-splash-screen
 */
function modifyAppJson(projectRoot) {
  const appJsonPath = path.join(projectRoot, 'app.json');

  if (!fs.existsSync(appJsonPath)) {
    console.warn(`[expo-splash-screen2] app.json not found: ${appJsonPath}`);
    return false;
  }

  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));

    // Ensure expo and plugins fields exist
    if (!appJson.expo) {
      appJson.expo = {};
    }
    if (!appJson.expo.plugins) {
      appJson.expo.plugins = [];
    }

    const plugins = appJson.expo.plugins;

    // Define our plugin configuration
    const ourPluginConfig = [
      "expo-splash-screen2",
      {
        "mode": "webview",
        "backgroundColor": "#10021F"
      }
    ];

    // Check if our plugin configuration already exists
    const ourPluginIndex = plugins.findIndex(plugin => {
      if (typeof plugin === 'string') {
        return plugin === 'expo-splash-screen2';
      }
      if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen2') {
        return true;
      }
      return false;
    });

    // If doesn't exist, add our plugin configuration
    if (ourPluginIndex === -1) {
      plugins.push(ourPluginConfig);
      console.log(`[expo-splash-screen2] Added expo-splash-screen2 plugin to app.json`);
    } else {
      // If exists, update configuration
      plugins[ourPluginIndex] = ourPluginConfig;
      console.log(`[expo-splash-screen2] Updated expo-splash-screen2 plugin in app.json`);
    }

    // Remove expo-splash-screen plugin configuration
    const filteredPlugins = plugins.filter(plugin => {
      if (typeof plugin === 'string') {
        return plugin !== 'expo-splash-screen';
      }
      if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') {
        return false;
      }
      return true;
    });

    // Check if expo-splash-screen was removed
    if (filteredPlugins.length < plugins.length) {
      console.log(`[expo-splash-screen2] Removed expo-splash-screen plugin from app.json`);
    }

    appJson.expo.plugins = filteredPlugins;

    // Write file
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf-8');
    return true;
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to modify app.json:`, error.message);
    return false;
  }
}

/**
 * Add build:expo-splash-web command to package.json
 */
function addBuildCommand(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.warn(`[expo-splash-screen2] package.json not found: ${packageJsonPath}`);
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Ensure scripts field exists
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    // Add or update build:expo-splash-web command
    packageJson.scripts['build:expo-splash-web'] = 'node expo-splash-web/build-splash-web.js';
    // Add or update dev:expo-splash-web command
    packageJson.scripts['dev:expo-splash-web'] = 'node expo-splash-web/dev-splash-web.js';

    // Write file
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
    return true;
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to update package.json:`, error.message);
    return false;
  }
}

/**
 * Remove expo-splash-screen dependency from package.json
 */
function removeExpoSplashScreenDependency(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.warn(`[expo-splash-screen2] package.json not found: ${packageJsonPath}`);
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    let removed = false;

    // Check and remove expo-splash-screen from dependencies
    if (packageJson.dependencies && packageJson.dependencies['expo-splash-screen']) {
      delete packageJson.dependencies['expo-splash-screen'];
      removed = true;
      console.log(`[expo-splash-screen2] Removed expo-splash-screen from dependencies`);
    }

    // Check and remove expo-splash-screen from devDependencies
    if (packageJson.devDependencies && packageJson.devDependencies['expo-splash-screen']) {
      delete packageJson.devDependencies['expo-splash-screen'];
      removed = true;
      console.log(`[expo-splash-screen2] Removed expo-splash-screen from devDependencies`);
    }

    // Check and remove expo-splash-screen from peerDependencies
    if (packageJson.peerDependencies && packageJson.peerDependencies['expo-splash-screen']) {
      delete packageJson.peerDependencies['expo-splash-screen'];
      removed = true;
      console.log(`[expo-splash-screen2] Removed expo-splash-screen from peerDependencies`);
    }

    if (removed) {
      // Write file
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
      return true;
    } else {
      console.log(`[expo-splash-screen2] expo-splash-screen dependency not found in package.json`);
      return true; // Not found is also considered success
    }
  } catch (error) {
    console.error(`[expo-splash-screen2] Failed to remove expo-splash-screen dependency:`, error.message);
    return false;
  }
}

/**
 * Detect if using pnpm
 */
function isUsingPnpm() {
  // Check environment variable (pnpm sets this)
  if (process.env.npm_config_user_agent) {
    return process.env.npm_config_user_agent.includes('pnpm');
  }
  // Check if pnpm-lock.yaml exists
  const checkRoot = process.env.INIT_CWD || process.cwd();
  return fs.existsSync(path.join(checkRoot, 'pnpm-lock.yaml'));
}

/**
 * Print manual setup instructions (prominent format)
 */
function printManualSetupInstructions() {
  console.error('');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('⚠️  expo-splash-screen2 requires manual setup');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('');
  console.error('Please run the following command to complete setup:');
  console.error('');
  console.error('  node node_modules/expo-splash-screen2/scripts/setup.js');
  console.error('');
  console.error('This script will automatically perform the following operations:');
  console.error('  1. Copy expo-splash-web folder to project root');
  console.error('  2. Update app.json to add plugin configuration');
  console.error('  3. Update package.json to add build commands');
  console.error('  4. Remove expo-splash-screen dependency');
  console.error('');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('');
}

/**
 * Main function
 */
function main() {
  const usingPnpm = isUsingPnpm();
  
  // If using pnpm, output hint at the start
  if (usingPnpm) {
    console.log('[expo-splash-screen2] Detected pnpm environment');
    console.log('[expo-splash-screen2] Running postinstall script...');
  } else {
    console.log('[expo-splash-screen2] Running postinstall script...');
  }

  let hasError = false;
  let errorMessage = '';

  try {
    // 1. Copy expo-splash-web folder (skip if source and target are the same)
    if (isSameDirectory) {
      console.log(`[expo-splash-screen2] ⏭ Skipped copying expo-splash-web (already in correct location)`);
    } else if (copyDirectory(sourceDir, targetDir)) {
      console.log(`[expo-splash-screen2] ✓ Copied expo-splash-web to ${targetDir}`);
    } else {
      console.warn(`[expo-splash-screen2] ⚠ Failed to copy expo-splash-web`);
      hasError = true;
      errorMessage = 'Failed to copy expo-splash-web directory';
    }

    // 2. Add build:expo-splash-web and dev:expo-splash-web commands to package.json
    if (addBuildCommand(projectRoot)) {
      console.log(`[expo-splash-screen2] ✓ Added build:expo-splash-web and dev:expo-splash-web commands to package.json`);
    } else {
      console.warn(`[expo-splash-screen2] ⚠ Failed to add build commands`);
      hasError = true;
      if (errorMessage) errorMessage += ', ';
      errorMessage += 'Failed to add build commands';
    }

    // 3. Modify app.json: add plugin configuration and remove expo-splash-screen
    if (modifyAppJson(projectRoot)) {
      console.log(`[expo-splash-screen2] ✓ Modified app.json (added plugin, removed expo-splash-screen)`);
    } else {
      console.warn(`[expo-splash-screen2] ⚠ Failed to modify app.json`);
      hasError = true;
      if (errorMessage) errorMessage += ', ';
      errorMessage += 'Failed to modify app.json';
    }

    // 4. Remove expo-splash-screen dependency from package.json
    if (removeExpoSplashScreenDependency(projectRoot)) {
      console.log(`[expo-splash-screen2] ✓ Processed expo-splash-screen dependency removal`);
    } else {
      console.warn(`[expo-splash-screen2] ⚠ Failed to remove expo-splash-screen dependency`);
      hasError = true;
      if (errorMessage) errorMessage += ', ';
      errorMessage += 'Failed to remove expo-splash-screen dependency';
    }

    if (!hasError) {
      console.log('[expo-splash-screen2] ✓ Postinstall completed successfully');
    } else {
      console.warn('[expo-splash-screen2] ⚠ Postinstall completed with errors');
      // If error occurs, output manual setup instructions
      printManualSetupInstructions();
      hasError = true; // Ensure error flag is set
    }
  } catch (error) {
    hasError = true; // Set error flag
    console.error('[expo-splash-screen2] ❌ Postinstall script failed:', error.message);
    // When exception occurs, output manual setup instructions
    printManualSetupInstructions();
    // Don't exit process, let installation continue
  }
  
  // If using pnpm, output hint (because pnpm doesn't run postinstall scripts by default)
  // Only output friendly hint if no errors (error case already output prominent error message above)
  if (usingPnpm && !hasError) {
    console.log('');
    console.log('[expo-splash-screen2] ℹ️  Note: If postinstall didn\'t run automatically in pnpm, manually execute:');
    console.log('[expo-splash-screen2]    node node_modules/expo-splash-screen2/scripts/setup.js');
    console.log('');
  }
}

// Execute main function
main();
