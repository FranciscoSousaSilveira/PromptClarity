const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'chrome-extension', 'src', 'styles.css');
const contentSrcPath = path.join(__dirname, 'chrome-extension', 'src', 'content.ts');
const contentOutPath = path.join(__dirname, 'chrome-extension', 'dist', 'content.js');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

try {
  console.log('Reading CSS file...');
  const cssText = fs.readFileSync(cssPath, 'utf8');

  console.log('Building content script...');
  esbuild.buildSync({
    entryPoints: [contentSrcPath],
    bundle: true,
    outfile: contentOutPath,
    define: {
      __CSS_TEXT__: JSON.stringify(cssText),
      __APP_VERSION__: JSON.stringify(packageJson.version)
    },
    minify: true,
    sourcemap: false,
    platform: 'browser',
    target: ['chrome100']
  });

  console.log('Build completed successfully! Output is at: ' + contentOutPath);
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
