#!/usr/bin/env node

/**
 * 手动设置脚本
 * 用于在 pnpm 环境下手动执行设置操作
 * 
 * 使用方法：
 * 1. 在项目根目录执行：node node_modules/expo-splash-screen2/scripts/setup.js
 * 2. 或者：npx expo-splash-screen2 setup
 */

const fs = require('fs');
const path = require('path');

/**
 * 向上查找包含 app.json 的目录（React Native/Expo 项目根目录）
 */
function findProjectRoot(startDir) {
  let currentDir = startDir;
  const root = path.parse(currentDir).root;
  
  while (currentDir !== root) {
    const appJsonPath = path.join(currentDir, 'app.json');
    if (fs.existsSync(appJsonPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

/**
 * 查找插件安装位置
 * 1. 从当前脚本位置向上查找 node_modules/expo-splash-screen2
 * 2. 从项目根目录查找 node_modules/expo-splash-screen2
 */
function findPluginRoot(projectRoot) {
  // 方法1: 从当前脚本位置查找
  let currentDir = __dirname;
  const root = path.parse(currentDir).root;
  
  while (currentDir !== root) {
    const parts = currentDir.split(path.sep);
    const nodeModulesIndex = parts.lastIndexOf('node_modules');
    if (nodeModulesIndex !== -1) {
      const pluginPath = path.join(
        parts.slice(0, nodeModulesIndex + 1).join(path.sep),
        'expo-splash-screen2'
      );
      if (fs.existsSync(pluginPath)) {
        return pluginPath;
      }
    }
    currentDir = path.dirname(currentDir);
  }
  
  // 方法2: 从项目根目录查找
  if (projectRoot) {
    const pluginPath = path.join(projectRoot, 'node_modules', 'expo-splash-screen2');
    if (fs.existsSync(pluginPath)) {
      return pluginPath;
    }
  }
  
  return null;
}

// 获取项目根目录
let projectRoot = process.cwd();
projectRoot = findProjectRoot(projectRoot);

if (!projectRoot) {
  console.error('[expo-splash-screen2] ❌ Error: Cannot find project root (app.json not found)');
  console.error('[expo-splash-screen2] Please run this script from your project root directory.');
  process.exit(1);
}

console.log(`[expo-splash-screen2] Project root: ${projectRoot}`);

// 查找插件根目录
const pluginRoot = findPluginRoot(projectRoot);

if (!pluginRoot) {
  console.error('[expo-splash-screen2] ❌ Error: Cannot find expo-splash-screen2 installation');
  console.error('[expo-splash-screen2] Please make sure the package is installed: pnpm add expo-splash-screen2');
  process.exit(1);
}

console.log(`[expo-splash-screen2] Plugin root: ${pluginRoot}`);

// 源目录：插件根目录的 expo-splash-web
const sourceDir = path.join(pluginRoot, 'expo-splash-web');
// 目标目录：项目根目录的 expo-splash-web
const targetDir = path.join(projectRoot, 'expo-splash-web');

// 检查源目录和目标目录是否相同（插件开发环境）
const isSameDirectory = path.resolve(sourceDir) === path.resolve(targetDir);

/**
 * 递归复制目录
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[expo-splash-screen2] Source directory not found: ${src}`);
    return false;
  }

  // 安全检查：防止删除源目录
  const resolvedSrc = path.resolve(src);
  const resolvedDest = path.resolve(dest);
  if (resolvedSrc === resolvedDest) {
    console.warn(`[expo-splash-screen2] Source and destination are the same, skipping copy: ${src}`);
    return true; // 视为成功，因为无需操作
  }

  // 如果目标目录存在，先删除（覆盖模式）
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  // 创建目标目录
  fs.mkdirSync(dest, { recursive: true });

  // 读取源目录内容
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
 * 修改 app.json：添加插件配置并移除 expo-splash-screen
 */
function modifyAppJson(projectRoot) {
  const appJsonPath = path.join(projectRoot, 'app.json');

  if (!fs.existsSync(appJsonPath)) {
    console.warn(`[expo-splash-screen2] app.json not found: ${appJsonPath}`);
    return false;
  }

  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));

    // 确保 expo 和 plugins 字段存在
    if (!appJson.expo) {
      appJson.expo = {};
    }
    if (!appJson.expo.plugins) {
      appJson.expo.plugins = [];
    }

    const plugins = appJson.expo.plugins;

    // 定义我们的插件配置
    const ourPluginConfig = [
      "expo-splash-screen2",
      {
        "mode": "webview",
        "backgroundColor": "#10021F"
      }
    ];

    // 检查是否已经存在我们的插件配置
    const ourPluginIndex = plugins.findIndex(plugin => {
      if (typeof plugin === 'string') {
        return plugin === 'expo-splash-screen2';
      }
      if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen2') {
        return true;
      }
      return false;
    });

    // 如果不存在，添加我们的插件配置
    if (ourPluginIndex === -1) {
      plugins.push(ourPluginConfig);
      console.log(`[expo-splash-screen2] ✓ Added expo-splash-screen2 plugin to app.json`);
    } else {
      // 如果存在，更新配置
      plugins[ourPluginIndex] = ourPluginConfig;
      console.log(`[expo-splash-screen2] ✓ Updated expo-splash-screen2 plugin in app.json`);
    }

    // 移除 expo-splash-screen 插件配置
    const filteredPlugins = plugins.filter(plugin => {
      if (typeof plugin === 'string') {
        return plugin !== 'expo-splash-screen';
      }
      if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') {
        return false;
      }
      return true;
    });

    // 检查是否移除了 expo-splash-screen
    if (filteredPlugins.length < plugins.length) {
      console.log(`[expo-splash-screen2] ✓ Removed expo-splash-screen plugin from app.json`);
    }

    appJson.expo.plugins = filteredPlugins;

    // 写入文件
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf-8');
    return true;
  } catch (error) {
    console.error(`[expo-splash-screen2] ❌ Failed to modify app.json:`, error.message);
    return false;
  }
}

/**
 * 在 package.json 中添加 build:expo-splash-web 命令
 */
function addBuildCommand(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.warn(`[expo-splash-screen2] package.json not found: ${packageJsonPath}`);
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // 确保 scripts 字段存在
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    let updated = false;

    // 添加或更新 build:expo-splash-web 命令
    if (packageJson.scripts['build:expo-splash-web'] !== 'node expo-splash-web/build-splash-web.js') {
      packageJson.scripts['build:expo-splash-web'] = 'node expo-splash-web/build-splash-web.js';
      updated = true;
    }

    // 添加或更新 dev:expo-splash-web 命令
    if (packageJson.scripts['dev:expo-splash-web'] !== 'node expo-splash-web/dev-splash-web.js') {
      packageJson.scripts['dev:expo-splash-web'] = 'node expo-splash-web/dev-splash-web.js';
      updated = true;
    }

    if (updated) {
      // 写入文件
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
      console.log(`[expo-splash-screen2] ✓ Added build:expo-splash-web and dev:expo-splash-web commands to package.json`);
    } else {
      console.log(`[expo-splash-screen2] ✓ Build commands already exist in package.json`);
    }
    return true;
  } catch (error) {
    console.error(`[expo-splash-screen2] ❌ Failed to update package.json:`, error.message);
    return false;
  }
}

/**
 * 检测是否使用 pnpm
 */
function isUsingPnpm(checkRoot) {
  // 检查环境变量
  if (process.env.npm_config_user_agent) {
    return process.env.npm_config_user_agent.includes('pnpm');
  }
  // 检查是否存在 pnpm-lock.yaml
  const root = checkRoot || process.cwd();
  return fs.existsSync(path.join(root, 'pnpm-lock.yaml'));
}

/**
 * 检查 package.json 中是否已安装 react-native-web
 */
function hasReactNativeWeb(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // 检查 dependencies、devDependencies 和 peerDependencies
    return !!(
      (packageJson.dependencies && packageJson.dependencies['react-native-web']) ||
      (packageJson.devDependencies && packageJson.devDependencies['react-native-web']) ||
      (packageJson.peerDependencies && packageJson.peerDependencies['react-native-web'])
    );
  } catch (error) {
    return false;
  }
}

/**
 * 安装 react-native-web 依赖
 */
function installReactNativeWeb(projectRoot) {
  console.log(`[expo-splash-screen2] ⚠️  react-native-web 是必需的依赖，但在 package.json 中未找到`);
  console.log(`[expo-splash-screen2] 正在安装 react-native-web...`);
  
  const { execSync } = require('child_process');
  
  // 先尝试使用 npm 安装
  try {
    console.log(`[expo-splash-screen2] 尝试使用 npm 安装 react-native-web...`);
    execSync('npm install react-native-web', {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log(`[expo-splash-screen2] ✓ 使用 npm 成功安装 react-native-web`);
    return true;
  } catch (npmError) {
    console.warn(`[expo-splash-screen2] ⚠️  npm 安装失败:`, npmError.message);
    console.log(`[expo-splash-screen2] 尝试使用 pnpm 安装 react-native-web...`);
    
    // npm 失败后，尝试使用 pnpm 安装
    try {
      execSync('pnpm add react-native-web', {
        cwd: projectRoot,
        stdio: 'inherit',
        env: { ...process.env }
      });
      console.log(`[expo-splash-screen2] ✓ 使用 pnpm 成功安装 react-native-web`);
      return true;
    } catch (pnpmError) {
      console.error(`[expo-splash-screen2] ❌ pnpm 安装也失败:`, pnpmError.message);
      console.error(`[expo-splash-screen2] ❌ 所有安装方式都失败，请手动安装 react-native-web:`);
      console.error(`[expo-splash-screen2]   npm install react-native-web`);
      console.error(`[expo-splash-screen2]   或`);
      console.error(`[expo-splash-screen2]   pnpm add react-native-web`);
      return false;
    }
  }
}

/**
 * 确保 react-native-web 已安装
 */
function ensureReactNativeWeb(projectRoot) {
  if (hasReactNativeWeb(projectRoot)) {
    console.log(`[expo-splash-screen2] ✓ react-native-web 已安装`);
    return true;
  }
  
  console.log(`[expo-splash-screen2] ⚠️  react-native-web 是 @ued2345/react-native-splash 的必需依赖`);
  console.log(`[expo-splash-screen2] 此插件使用 WebView 显示 HTML 启动页，需要 react-native-web`);
  
  return installReactNativeWeb(projectRoot);
}

/**
 * 从 package.json 中删除 expo-splash-screen 依赖
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

    // 检查并删除 dependencies 中的 expo-splash-screen
    if (packageJson.dependencies && packageJson.dependencies['expo-splash-screen']) {
      delete packageJson.dependencies['expo-splash-screen'];
      removed = true;
      console.log(`[expo-splash-screen2] ✓ Removed expo-splash-screen from dependencies`);
    }

    // 检查并删除 devDependencies 中的 expo-splash-screen
    if (packageJson.devDependencies && packageJson.devDependencies['expo-splash-screen']) {
      delete packageJson.devDependencies['expo-splash-screen'];
      removed = true;
      console.log(`[expo-splash-screen2] ✓ Removed expo-splash-screen from devDependencies`);
    }

    // 检查并删除 peerDependencies 中的 expo-splash-screen
    if (packageJson.peerDependencies && packageJson.peerDependencies['expo-splash-screen']) {
      delete packageJson.peerDependencies['expo-splash-screen'];
      removed = true;
      console.log(`[expo-splash-screen2] ✓ Removed expo-splash-screen from peerDependencies`);
    }

    if (removed) {
      // 写入文件
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
      return true;
    } else {
      console.log(`[expo-splash-screen2] ✓ expo-splash-screen dependency not found in package.json`);
      return true; // 没找到也算成功
    }
  } catch (error) {
    console.error(`[expo-splash-screen2] ❌ Failed to remove expo-splash-screen dependency:`, error.message);
    return false;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('[expo-splash-screen2] Running manual setup script...\n');

  let success = true;

  // 1. 复制 expo-splash-web 文件夹（如果源目录和目标目录相同则跳过）
  if (isSameDirectory) {
    console.log(`[expo-splash-screen2] ⏭ Skipped copying expo-splash-web (already in correct location)\n`);
  } else if (copyDirectory(sourceDir, targetDir)) {
    console.log(`[expo-splash-screen2] ✓ Copied expo-splash-web to ${targetDir}\n`);
  } else {
    console.error(`[expo-splash-screen2] ❌ Failed to copy expo-splash-web\n`);
    success = false;
  }

  // 2. 添加 build:expo-splash-web 和 dev:expo-splash-web 命令到 package.json
  if (!addBuildCommand(projectRoot)) {
    success = false;
  }
  console.log('');

  // 3. 修改 app.json：添加插件配置并移除 expo-splash-screen
  if (!modifyAppJson(projectRoot)) {
    success = false;
  }
  console.log('');

  // 4. 从 package.json 中删除 expo-splash-screen 依赖
  if (!removeExpoSplashScreenDependency(projectRoot)) {
    success = false;
  }
  console.log('');

  // 5. 确保 react-native-web 已安装（必需依赖）
  if (!ensureReactNativeWeb(projectRoot)) {
    success = false;
  }

  if (success) {
    console.log('[expo-splash-screen2] ✅ Setup completed successfully!');
  } else {
    console.error('[expo-splash-screen2] ⚠️  Setup completed with some errors. Please check the messages above.');
    process.exit(1);
  }
}

// 执行主函数
main();
