#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Path constants
const ROOT_DIR = path.join(__dirname, '..');
const TARGET_DIR = path.join(ROOT_DIR, 'expo-splash-web', 'dist');

/**
 * Execute Expo Web export
 */
async function exportWeb() {
	console.log('\n🚀 Starting SplashScreen Web export...\n');

	// Clear target directory
	await fs.rm(TARGET_DIR, { recursive: true, force: true }).catch(() => {});

	return new Promise((resolve, reject) => {
		const env = {
			...process.env,
			BUILD_SPLASH_WEB: 'true',
			NODE_ENV: 'production',
		};

		const expoProcess = spawn(
			'npx',
			['expo', 'export', '-p', 'web', '--output-dir', TARGET_DIR, '--clear'],
			{ cwd: ROOT_DIR, env, stdio: 'inherit' }
		);

		expoProcess.on('close', (code) => {
			if (code === 0) {
				console.log('\n✓ Export successful');
				resolve();
			} else {
				reject(new Error(`Export failed, exit code: ${code}`));
			}
		});

		expoProcess.on('error', reject);
	});
}

/**
 * Optimize build output
 */
async function optimizeOutput() {
	console.log('\n✂️  Optimizing build output...');

	try {
		// Clean up unnecessary files
		const unnecessaryFiles = [
			path.join(TARGET_DIR, '_sitemap.html'),
			path.join(TARGET_DIR, '+not-found.html'),
			path.join(TARGET_DIR, 'metadata.json'),
			path.join(TARGET_DIR, 'favicon.ico'),
		];

		for (const file of unnecessaryFiles) {
			await fs.unlink(file).catch(() => {});
		}

		// Clean up routing-related code in index.html
		const indexHtml = path.join(TARGET_DIR, 'index.html');
		if (
			await fs
				.access(indexHtml)
				.then(() => true)
				.catch(() => false)
		) {
			let html = await fs.readFile(indexHtml, 'utf-8');

			// Remove Expo Router hydration flag
			html = html.replace(
				/<script type="module">globalThis\.__EXPO_ROUTER_HYDRATE__=true;<\/script>/g,
				''
			);

			// Remove favicon reference (not needed for WebView)
			html = html.replace(/<link rel="icon" href="\.\/favicon\.ico" \/>/g, '');

			// Remove preload links (not needed for WebView local loading)
			html = html.replace(/<link rel="preload"[^>]*>/g, '');

			await fs.writeFile(indexHtml, html, 'utf-8');

			const stats = await fs.stat(indexHtml);
			console.log(`✓ index.html: ${(stats.size / 1024).toFixed(2)} KB`);
			console.log('✓ Removed routing hydration flag');
			console.log('✓ Removed unnecessary resource references');
		}

		// Display final file sizes
		console.log('\n📦 Final output size:');
		const jsDir = path.join(TARGET_DIR, '_expo', 'static', 'js', 'web');
		const cssDir = path.join(TARGET_DIR, '_expo', 'static', 'css');

		let totalSize = 0;

		// JS files
		if (
			await fs
				.access(jsDir)
				.then(() => true)
				.catch(() => false)
		) {
			const jsFiles = await fs.readdir(jsDir);
			for (const file of jsFiles) {
				if (file.endsWith('.js')) {
					const filePath = path.join(jsDir, file);
					const size = (await fs.stat(filePath)).size;
					totalSize += size;
					console.log(`  JS:  ${(size / 1024).toFixed(0)} KB`);
				}
			}
		}

		// CSS files
		if (
			await fs
				.access(cssDir)
				.then(() => true)
				.catch(() => false)
		) {
			const cssFiles = await fs.readdir(cssDir);
			for (const file of cssFiles) {
				if (file.endsWith('.css')) {
					const filePath = path.join(cssDir, file);
					const size = (await fs.stat(filePath)).size;
					totalSize += size;
					console.log(`  CSS: ${(size / 1024).toFixed(2)} KB`);
				}
			}
		}

		// HTML
		if (
			await fs
				.access(indexHtml)
				.then(() => true)
				.catch(() => false)
		) {
			const size = (await fs.stat(indexHtml)).size;
			totalSize += size;
			console.log(`  HTML: ${(size / 1024).toFixed(2)} KB`);
		}

		console.log(`  Total: ${(totalSize / 1024).toFixed(0)} KB`);

		console.log('✓ Cleanup completed');
	} catch (error) {
		console.warn('⚠ Optimization failed:', error.message);
	}
}

/**
 * Move images to dist/assets and remove hash suffixes
 * Returns map of old path -> new path for HTML replacement
 */
async function reorganizeImages() {
	console.log('\n📁 Reorganizing images...');

	const sourceImagesDir = path.join(TARGET_DIR, 'assets', 'expo-splash-web', 'src', 'images');
	const targetAssetsDir = path.join(TARGET_DIR, 'assets');
	const imageMap = {}; // old path -> new path

	// Check if source directory exists
	if (
		!(await fs
			.access(sourceImagesDir)
			.then(() => true)
			.catch(() => false))
	) {
		console.warn('⚠ Source images directory not found');
		return imageMap;
	}

	// Create target assets directory
	await fs.mkdir(targetAssetsDir, { recursive: true }).catch(() => {});

	// Read all image files
	const imageFiles = await fs.readdir(sourceImagesDir);

	for (const file of imageFiles) {
		// Skip non-image files
		if (!/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file)) {
			continue;
		}

		const sourcePath = path.join(sourceImagesDir, file);
		let targetFileName = file;

		// Remove hash from filename (format: name.hash.ext -> name.ext)
		const match = file.match(/^(.+)\.([a-f0-9]{32,40})\.(.+)$/);
		if (match) {
			const [, baseName, , ext] = match;
			targetFileName = `${baseName}.${ext}`;
		}

		const targetPath = path.join(targetAssetsDir, targetFileName);

		// Copy file to new location
		await fs.copyFile(sourcePath, targetPath);

		// Store mapping for HTML replacement
		const oldPath = `/assets/expo-splash-web/src/images/${file}`;
		const newPath = `./assets/${targetFileName}`;
		imageMap[oldPath] = newPath;

		console.log(`  ✓ ${file} -> assets/${targetFileName}`);
	}

	// Remove old nested directory structure
	await fs
		.rm(path.join(TARGET_DIR, 'assets', 'expo-splash-web'), { recursive: true, force: true })
		.catch(() => {});

	console.log(`✓ Reorganized ${Object.keys(imageMap).length} images to dist/assets/`);
	return imageMap;
}

/**
 * Inline Assets
 */
async function inlineAssets() {
	console.log('\n💉 Inlining assets...');

	try {
		const indexHtmlPath = path.join(TARGET_DIR, 'index.html');
		if (
			!(await fs
				.access(indexHtmlPath)
				.then(() => true)
				.catch(() => false))
		) {
			console.warn('⚠ index.html not found');
			return;
		}

		let html = await fs.readFile(indexHtmlPath, 'utf-8');
		const jsDir = path.join(TARGET_DIR, '_expo', 'static', 'js', 'web');

		// Inline JS
		if (
			await fs
				.access(jsDir)
				.then(() => true)
				.catch(() => false)
		) {
			const jsFiles = await fs.readdir(jsDir);
			for (const file of jsFiles) {
				if (file.endsWith('.js')) {
					let content = await fs.readFile(path.join(jsDir, file), 'utf-8');
					// Escape </script> tags to prevent premature closing
					content = content.replace(/<\/script>/gi, '<\\/script>');
					html = html.replace('</body>', `<script>${content}</script></body>`);
					// Remove original script tags
					const regex = new RegExp(`<script src="[^"]*${file}"[^>]*></script>`, 'g');
					html = html.replace(regex, '');
				}
			}
		}

		// Reorganize images: move to dist/assets and remove hash suffixes
		const imageMap = await reorganizeImages();

		// Update HTML paths: replace old paths with new paths
		console.log('🔧 Updating image paths in HTML...');
		for (const [oldPath, newPath] of Object.entries(imageMap)) {
			// Escape special regex characters in oldPath
			const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			// Replace all occurrences (both quoted formats)
			const regex1 = new RegExp(`"${escapedOldPath}"`, 'g');
			html = html.replace(regex1, `"${newPath}"`);
			const regex2 = new RegExp(`'${escapedOldPath}'`, 'g');
			html = html.replace(regex2, `'${newPath}'`);
		}

		// Also fix paths that might already be simplified but missing assets/ prefix
		// This handles cases where paths are already "./filename.ext" but should be "./assets/filename.ext"
		const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
		for (const ext of imageExtensions) {
			// Match uri:"./filename.ext" pattern and ensure it has assets/ prefix
			const regex = new RegExp(`(uri:"\\./)([^"/]+\\.${ext})"`, 'g');
			html = html.replace(regex, (match, prefix, filename) => {
				// Only add assets/ if not already present and filename doesn't start with assets/
				if (!filename.startsWith('assets/')) {
					return `${prefix}assets/${filename}"`;
				}
				return match;
			});
		}

		console.log(
			`✓ Updated image paths in HTML (${Object.keys(imageMap).length} images reorganized)`
		);

		await fs.writeFile(indexHtmlPath, html, 'utf-8');
		console.log('✓ Inlined JS into index.html');

		// Clean up original file directory
		await fs.rm(path.join(TARGET_DIR, '_expo'), { recursive: true, force: true });
		console.log('✓ Cleaned up original resource files');
	} catch (error) {
		console.warn('⚠ Inlining failed:', error.message);
	}
}

/**
 * Create temporary config file (proxy mode)
 */
async function createTempConfig() {
	console.log('\n📝 Creating temporary config proxy...');
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
	if (
		await fs
			.access(configPath)
			.then(() => true)
			.catch(() => false)
	) {
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
	await fs.copyFile(packageJsonPath, packageJsonPath + '.backup');

	const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
	packageJson.main = './expo-splash-web/src/index.ts';

	await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
	console.log('✓ Entry point set to expo-splash-web/src/index.ts');
}

/**
 * Restore package.json
 */
async function restorePackageJson() {
	const packageJsonPath = path.join(ROOT_DIR, 'package.json');
	const packageJsonBackup = packageJsonPath + '.backup';
	if (
		await fs
			.access(packageJsonBackup)
			.then(() => true)
			.catch(() => false)
	) {
		await fs.copyFile(packageJsonBackup, packageJsonPath);
		await fs.unlink(packageJsonBackup);
		console.log('✓ package.json restored');
	}
}

/**
 * Start development server
 */
async function startDevServer() {
	console.log('\n🚀 Starting development server...');
	console.log('Press Ctrl+C to stop server and restore config\n');

	return new Promise((resolve, reject) => {
		const env = {
			...process.env,
			BUILD_SPLASH_WEB: 'true',
		};

		const expoProcess = spawn('npx', ['expo', 'start', '--web'], {
			cwd: ROOT_DIR,
			env,
			stdio: 'inherit',
		});

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
 * Copy assets to native directories
 * Images are already in dist/assets with simplified names (no hash)
 */
async function copyAssetsToNative() {
	console.log('\n📦 Copying assets to native directories...');

	try {
		const sourceAssetsDir = path.join(TARGET_DIR, 'assets');
		const androidAssetsDir = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'assets');
		const iosAssetsDir = path.join(ROOT_DIR, 'ios', 'wpcz');

		// Check if assets directory exists
		if (
			!(await fs
				.access(sourceAssetsDir)
				.then(() => true)
				.catch(() => false))
		) {
			console.warn('⚠ Assets directory not found, skipping copy');
			return;
		}

		// Read all files in assets directory
		const assetFiles = await fs.readdir(sourceAssetsDir);
		const imageFiles = assetFiles.filter((file) => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file));

		if (imageFiles.length === 0) {
			console.warn('⚠ No images found to copy');
			return;
		}

		// Copy to Android
		if (
			await fs
				.access(path.join(ROOT_DIR, 'android'))
				.then(() => true)
				.catch(() => false)
		) {
			await fs.mkdir(androidAssetsDir, { recursive: true }).catch(() => {});

			for (const file of imageFiles) {
				const sourcePath = path.join(sourceAssetsDir, file);
				const targetPath = path.join(androidAssetsDir, file);

				await fs.copyFile(sourcePath, targetPath);
				console.log(`  ✓ Android: ${file}`);
			}
		}

		// Copy to iOS
		if (
			await fs
				.access(path.join(ROOT_DIR, 'ios'))
				.then(() => true)
				.catch(() => false)
		) {
			await fs.mkdir(iosAssetsDir, { recursive: true }).catch(() => {});

			for (const file of imageFiles) {
				const sourcePath = path.join(sourceAssetsDir, file);
				const targetPath = path.join(iosAssetsDir, file);

				await fs.copyFile(sourcePath, targetPath);
				console.log(`  ✓ iOS: ${file}`);
			}
		}

		console.log(`✓ Copied ${imageFiles.length} images to native directories`);
	} catch (error) {
		console.warn('⚠ Failed to copy assets:', error.message);
	}
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
	const args = process.argv.slice(2);
	const isDev = args.includes('--dev');

	console.log(
		`🎯 ${isDev ? 'Starting SplashScreen Development Mode' : 'Building SplashScreen Web'}\n`
	);
	console.log('='.repeat(50));

	const startTime = Date.now();

	try {
		// 1. Setup environment
		await setup();

		if (isDev) {
			// 2. Development mode
			await startDevServer();
		} else {
			// 2. Build mode
			await exportWeb();
			await optimizeOutput();
			await inlineAssets();
			await copyAssetsToNative();
			// Actively cleanup in build mode
			await cleanup();
		}

		if (!isDev) {
			const duration = ((Date.now() - startTime) / 1000).toFixed(2);
			console.log('\n' + '='.repeat(50));
			console.log(`✅ Build successful! Duration: ${duration}s`);
			console.log(`📁 Output: ${TARGET_DIR}`);
			console.log('='.repeat(50));
		}

		process.exit(0);
	} catch (error) {
		console.error('\n' + '='.repeat(50));
		console.error(`❌ ${isDev ? 'Startup' : 'Build'} failed:`, error.message);
		console.error('='.repeat(50));

		await cleanup();
		process.exit(1);
	}
}

if (require.main === module) {
	main();
}

module.exports = { main };
