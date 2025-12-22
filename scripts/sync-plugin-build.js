#!/usr/bin/env node

/**
 * Sync plugin/build directory to example/node_modules/expo-splash-screen2/plugin/build
 * This allows the example project to directly use the latest build results without reinstalling dependencies
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pluginBuildDir = path.join(rootDir, 'plugin', 'build');
const exampleNodeModulesDir = path.join(rootDir, 'example', 'node_modules', 'expo-splash-screen2', 'plugin', 'build');

function syncDirectory(source, target) {
  if (!fs.existsSync(source)) {
    console.warn(`[sync-plugin-build] Source directory does not exist: ${source}`);
    return;
  }

  // Ensure target directory exists
  const targetParent = path.dirname(target);
  if (!fs.existsSync(targetParent)) {
    console.warn(`[sync-plugin-build] Target parent directory does not exist: ${targetParent}`);
    console.warn(`[sync-plugin-build] Please run 'pnpm install' in the example directory first.`);
    return;
  }

  // If target directory exists, delete it first
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  // Create target directory
  fs.mkdirSync(target, { recursive: true });

  // Copy all files
  function copyRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyRecursive(pluginBuildDir, exampleNodeModulesDir);
  console.log(`[sync-plugin-build] ✓ Synced plugin/build to example/node_modules/expo-splash-screen2/plugin/build`);
}

// Execute sync
syncDirectory(pluginBuildDir, exampleNodeModulesDir);
