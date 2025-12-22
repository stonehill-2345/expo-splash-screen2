const parentConfig = require('../app.json');

module.exports = () => {
  // 继承父配置的基础设置
  const baseConfig = {
    ...parentConfig.expo,
    name: 'Splash Screen Web',
    slug: 'splash-screen-web',
  };

  // 设置独立入口点
  baseConfig.entryPoint = './expo-splash-web/src/index.ts';

  // 移除 expo-router 插件
  if (baseConfig.plugins) {
    baseConfig.plugins = baseConfig.plugins.filter(
      plugin => plugin !== 'expo-router' && 
      (Array.isArray(plugin) ? plugin[0] !== 'expo-router' : true)
    );
  }

  // Web 配置：单页应用模式
  baseConfig.web = {
    ...baseConfig.web,
    output: 'single', // 生成单个 HTML 文件
    bundler: 'metro',
  };

  // 设置相对路径
  baseConfig.experiments = {
    ...baseConfig.experiments,
    baseUrl: './',
  };

  return baseConfig;
};
