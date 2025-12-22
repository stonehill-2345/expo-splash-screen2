const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 添加 watchFolders 以支持符号链接
config.watchFolders = [
  path.resolve(__dirname),
  path.resolve(__dirname, '../../'), // 插件根目录
];

module.exports = config;
