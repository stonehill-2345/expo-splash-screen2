#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Path constants
const ROOT_DIR = path.join(__dirname, '..');
const SPLASH_WEB_DIR = path.join(ROOT_DIR, 'expo-splash-web');

/**
 * Create temporary config file (proxy mode)
 */
async function createTempConfig() {
  console.log('📝 Creating temporary config proxy...');
  const tempConfigPath = path.join(ROOT_DIR, 'app.config.js');
  
  // Use proxy mode: directly reference config under expo-splash-web
  // This preserves relative path resolution logic in original file
  const configContent = `module.exports = require('./expo-splash-web/app.config.js');`;
  
  await fs.writeFile(tempConfigPath, configContent, 'utf-8');
  console.log('✓ Temporary config file created');
}

/**
 * Remove temporary config file
 */
async function removeTempConfig() {
  const configPath = path.join(ROOT_DIR, 'app.config.js');
  if (await fs.access(configPath).then(() => true).catch(() => false)) {
    await fs.unlink(configPath);
    console.log('✓ Temporary config removed');
  }
}

/**
 * Modify package.json to set entry point
 */
async function modifyPackageJson() {
  console.log('📝 Modifying package.json entry point...');
  const packageJsonPath = path.join(ROOT_DIR, 'package.json');
  
  // Check if backup file exists, if exists means it was modified before
  const backupPath = packageJsonPath + '.backup';
  const hasBackup = await fs.access(backupPath).then(() => true).catch(() => false);
  
  if (!hasBackup) {
    await fs.copyFile(packageJsonPath, backupPath);
  }
  
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  packageJson.main = './expo-splash-web/src/index.ts';
  
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
  console.log('✓ Entry point set to expo-splash-web/src/index.ts');
}

/**
 * Restore package.json
 */
async function restorePackageJson() {
  const packageJsonPath = path.join(ROOT_DIR, 'package.json');
  const packageJsonBackup = packageJsonPath + '.backup';
  if (await fs.access(packageJsonBackup).then(() => true).catch(() => false)) {
    await fs.copyFile(packageJsonBackup, packageJsonPath);
    await fs.unlink(packageJsonBackup);
    console.log('✓ package.json restored');
  }
}

/**
 * Start development server
 */
async function startDevServer() {
  console.log('\n🚀 Starting SplashScreen development server...');
  console.log('📱 Browser will open automatically, or visit the displayed URL');
  console.log('Press Ctrl+C to stop server and restore config\n');
  console.log('='.repeat(50));

  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      BUILD_SPLASH_WEB: 'true',
    };
    
    const expoProcess = spawn(
      'npx',
      ['expo', 'start', '--web'],
      { cwd: ROOT_DIR, env, stdio: 'inherit' }
    );
    
    // Listen for process exit
    expoProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Development server is usually interrupted by user, not considered an error
        resolve();
      }
    });
    
    expoProcess.on('error', reject);
    
    // Listen for main process exit signals, forward to child process
    const cleanupAndExit = async () => {
      console.log('\n\n🛑 Stopping development server...');
      expoProcess.kill();
      await cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanupAndExit);
    process.on('SIGTERM', cleanupAndExit);
  });
}

/**
 * Environment setup
 */
async function setup() {
  await modifyPackageJson();
  await createTempConfig();
}

/**
 * Environment cleanup
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up environment...');
  await removeTempConfig().catch(() => {});
  await restorePackageJson().catch(() => {});
}

/**
 * Main function
 */
async function main() {
  console.log('🎯 SplashScreen Development Mode\n');
  console.log('='.repeat(50));
  
  try {
    // 1. Setup environment
    await setup();
    
    // 2. Start development server
    await startDevServer();
    
    // 3. Cleanup environment (after server stops)
    await cleanup();
    
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ Startup failed:', error.message);
    console.error('='.repeat(50));
    
    await cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };




