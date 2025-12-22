#!/usr/bin/env node

/**
 * Preinstall 脚本
 * 在安装前输出提示信息，提醒用户如果需要手动执行 setup.js
 * 这个脚本会在安装阶段运行，即使 postinstall 没有执行，用户也能看到提示
 */

const fs = require('fs');
const path = require('path');

/**
 * 检测是否使用 pnpm
 */
function isUsingPnpm() {
  // 检查环境变量
  if (process.env.npm_config_user_agent) {
    return process.env.npm_config_user_agent.includes('pnpm');
  }
  return false;
}

/**
 * 输出安装提示
 */
function printInstallNotice() {
  const usingPnpm = isUsingPnpm();
  
  if (usingPnpm) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📦 expo-splash-screen2 安装提示');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('⚠️  检测到您正在使用 pnpm');
    console.log('');
    console.log('pnpm 默认不会自动运行 postinstall 脚本。');
    console.log('安装完成后，如果 postinstall 脚本没有自动执行，');
    console.log('请手动执行以下命令完成设置：');
    console.log('');
    console.log('  node node_modules/expo-splash-screen2/scripts/setup.js');
    console.log('');
    console.log('该脚本将自动完成以下操作：');
    console.log('  ✓ 复制 expo-splash-web 文件夹到项目根目录');
    console.log('  ✓ 更新 app.json 添加插件配置');
    console.log('  ✓ 更新 package.json 添加构建命令');
    console.log('  ✓ 移除 expo-splash-screen 依赖');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
  }
}

// 先执行 only-allow pnpm 检查
const { execSync } = require('child_process');
try {
  execSync('npx only-allow pnpm', { stdio: 'inherit' });
} catch (error) {
  // only-allow 失败时会退出，这里不需要处理
  process.exit(error.status || 1);
}

// 然后输出提示
printInstallNotice();
