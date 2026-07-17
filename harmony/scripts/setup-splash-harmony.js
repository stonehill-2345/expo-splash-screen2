#!/usr/bin/env node

/**
 * setup-splash-harmony.js
 * 读取 apps/native/app.config.ts 中 expo-splash-screen2 的插件配置，
 * 调用插件的 setupHarmonyMode，把开屏图与背景色写入鸿蒙原生资源：
 * - image -> harmony/entry/src/main/resources/rawfile/expo_splash.png
 * - backgroundColor -> harmony/entry/src/main/resources/base/element/color.json (expo_splash_background)
 *
 * 鸿蒙构建不跑 Expo config-plugin，故由本脚本（postinstall 调用）显式驱动。
 * 配置 source of truth 是 apps/native/app.config.ts，鸿蒙沿用其 image（.9 图由 ArkUI objectFit 处理）。
 */

const path = require('path');
const fs = require('fs');

const ohrnRoot = path.resolve(__dirname, '..');
const nativeRoot = path.resolve(ohrnRoot, '../native');
const monorepoRoot = path.resolve(ohrnRoot, '../..'); // apps/ohrn -> apps -> 根

// @expo/config 被 hoist 到根；按序尝试候选路径解析。
function requireExpoConfig() {
	const candidates = [
		path.join(monorepoRoot, 'node_modules/@expo/config'),
		path.join(nativeRoot, 'node_modules/@expo/config'),
		path.join(ohrnRoot, 'node_modules/@expo/config'),
	];
	for (const c of candidates) {
		if (fs.existsSync(path.join(c, 'package.json'))) {
			return require(c);
		}
	}
	// 兜底：交给 node 的向上解析
	return require('@expo/config');
}

// app.config.ts 里的资源路径是相对 apps/native 的，但写入目标在 apps/ohrn。
// 这里把相对路径转成绝对路径，供 setupHarmonyMode 用 ohrnRoot 解析时直接命中。
function resolveAssetPaths(nativeRoot, cfg) {
	if (!cfg) return cfg;
	const resolved = { ...cfg };
	if (resolved.image) {
		resolved.image = path.isAbsolute(resolved.image)
			? resolved.image
			: path.resolve(nativeRoot, resolved.image);
	}
	if (resolved.harmony?.image) {
		resolved.harmony = {
			...resolved.harmony,
			image: path.isAbsolute(resolved.harmony.image)
				? resolved.harmony.image
				: path.resolve(nativeRoot, resolved.harmony.image),
		};
	}
	return resolved;
}

function setupSplashHarmony() {
	// 1. 读 apps/native/app.config.ts 的 expo-splash-screen2 配置
	let pluginConfig = null;
	try {
		const { getConfig } = requireExpoConfig();
		const { exp } = getConfig(nativeRoot, { skipSDKVersionRequirement: true });
		const plugins = exp.plugins || [];
		const entry = plugins.find(
			(p) => Array.isArray(p) && p[0] === 'expo-splash-screen2'
		);
		pluginConfig = entry ? entry[1] || {} : null;
	} catch (e) {
		console.warn(
			'[setup-splash-harmony] ⚠ 读取 app.config.ts 失败，跳过鸿蒙开屏资源生成：',
			e.message
		);
		return;
	}

	if (!pluginConfig) {
		console.warn('[setup-splash-harmony] ⚠ app.config.ts 未配置 expo-splash-screen2，跳过。');
		return;
	}

	const resolvedConfig = resolveAssetPaths(nativeRoot, pluginConfig);
	if (!resolvedConfig.harmony?.image && !resolvedConfig.image) {
		console.warn('[setup-splash-harmony] ⚠ 配置缺少 image，跳过。');
		return;
	}

	// 2. 加载插件（跨 workspace 引 apps/native/node_modules 的已打 patch 实例）
	const pluginBuildDir = path.join(
		nativeRoot,
		'node_modules/expo-splash-screen2/plugin/build'
	);
	if (!fs.existsSync(path.join(pluginBuildDir, 'index.js'))) {
		console.warn('[setup-splash-harmony] ⚠ expo-splash-screen2 插件未找到，跳过。', pluginBuildDir);
		return;
	}

	// 插件 require 依赖 expo/config-plugins，需 apps/native 的 node_modules 解析
	const Module = require('module');
	const origResolve = Module._resolveFilename;
	Module._resolveFilename = function (request, parent, ...rest) {
		try {
			return origResolve.call(this, request, parent, ...rest);
		} catch (e) {
			if (request.startsWith('expo/') || request === 'expo') {
				return origResolve.call(this, path.join(nativeRoot, 'node_modules', request), parent, ...rest);
			}
			throw e;
		}
	};

	let setupHarmonyMode;
	try {
		const plugin = require(path.join(pluginBuildDir, 'index.js'));
		Module._resolveFilename = origResolve;
		setupHarmonyMode = plugin.setupHarmonyMode;
	} catch (e) {
		Module._resolveFilename = origResolve;
		console.warn('[setup-splash-harmony] ⚠ 加载插件失败，跳过：', e.message);
		return;
	}

	if (typeof setupHarmonyMode !== 'function') {
		console.warn('[setup-splash-harmony] ⚠ setupHarmonyMode 未导出（patch 未应用？），跳过。');
		return;
	}

	// 3. 调用 setupHarmonyMode：projectRoot 用 ohrnRoot（写入 ohrn 的 harmony/）
	const source = resolvedConfig.harmony?.image
		? 'harmony.image'
		: 'image';
	try {
		setupHarmonyMode({ projectRoot: ohrnRoot }, resolvedConfig);
		console.log(
			`[setup-splash-harmony] ✓ 鸿蒙开屏资源已生成（基于 app.config.ts 配置, 来源 ${source}）`
		);
	} catch (e) {
		console.error('[setup-splash-harmony] ✗ 生成失败：', e);
	}

	// 4. 拷贝 webview 资源（index.html + logo 图片）到 rawfile/splash/
	copySplashWebResources();
}

// 跑 build-splash-web.js 重新构建 expo-splash-web 的 HTML 产物。
// 对齐 native 插件行为：iOS/Android prebuild 会跑此脚本，鸿蒙也跑，确保 HTML 是最新源码构建。
function buildSplashWeb() {
	const splashWebDir = path.join(nativeRoot, 'expo-splash-web');
	const buildScript = path.join(splashWebDir, 'build-splash-web.js');
	if (!fs.existsSync(buildScript)) {
		console.warn('[setup-splash-harmony] ⚠ apps/native/expo-splash-web/build-splash-web.js 不存在，将直接用现有 dist。');
		return false;
	}
	console.log('[setup-splash-harmony] 构建 expo-splash-web（对齐 native）...');
	const result = require('child_process').spawnSync('node', ['build-splash-web.js'], {
		cwd: splashWebDir,
		stdio: 'inherit',
		env: { ...process.env, NODE_ENV: 'production' },
	});
	if (result.error || result.status !== 0) {
		console.warn('[setup-splash-harmony] ⚠ build-splash-web.js 失败，将用现有 dist。', result.error?.message || `exit ${result.status}`);
		return false;
	}
	console.log('[setup-splash-harmony] ✓ expo-splash-web 构建完成');
	return true;
}

// 拷贝 expo-splash-web 的构建产物到 rawfile/splash/（Web 组件加载的 HTML + 相对路径资源）
// 源用 native 项目本地 expo-splash-web/dist（最新构建产物），不是 node_modules 里的插件内置旧版。
// 因为 apps/ohrn/src 软链 apps/native/src，业务代码与 native 保持一致，开屏 HTML 也应一致。
function copySplashWebResources() {
	// 先重新构建 HTML（对齐 native 插件行为），失败则回退用现有 dist
	buildSplashWeb();

	const distDir = path.join(nativeRoot, 'expo-splash-web/dist');
	const targetDir = path.join(
		ohrnRoot,
		'harmony/entry/src/main/resources/rawfile/splash'
	);

	if (!fs.existsSync(path.join(distDir, 'index.html'))) {
		console.warn('[setup-splash-harmony] ⚠ apps/native/expo-splash-web/dist/index.html 不存在，跳过 webview 资源。', distDir);
		return;
	}

	// 幂等：清空目标目录再拷（避免旧 hash 图片残留）
	if (fs.existsSync(targetDir)) {
		fs.rmSync(targetDir, { recursive: true, force: true });
	}
	fs.mkdirSync(targetDir, { recursive: true });
	fs.cpSync(distDir, targetDir, { recursive: true });

	const files = [];
	const walk = (dir) => {
		for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, e.name);
			if (e.isDirectory()) walk(full);
			else files.push(path.relative(targetDir, full));
		}
	};
	walk(targetDir);
	console.log(`[setup-splash-harmony] ✓ webview 资源已拷贝到 rawfile/splash/（${files.length} 文件: ${files.map(f => f.split(path.sep).pop()).slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}）`);
}

setupSplashHarmony();
