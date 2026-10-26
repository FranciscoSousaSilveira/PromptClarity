import { build } from 'esbuild';
import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'src');
const dist = resolve(root, 'dist');
const resourcesSrc = resolve(root, 'resources');
const resourcesDist = resolve(dist, 'resources');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(resourcesDist, { recursive: true });

// Download Ollama binary if not present
const ollamaDest = resolve(resourcesSrc, 'ollama/ollama.exe');
try {
  await execSync('node scripts/download-ollama.mjs', { cwd: root, stdio: 'inherit' });
} catch {
  console.warn('Failed to download Ollama, will try to use existing');
}

// Build API as standalone
try {
  execSync('node scripts/build-api.mjs', { cwd: root, stdio: 'inherit' });
} catch {
  console.warn('Failed to build API, continuing without');
}

// Copy resources to dist
await cp(resourcesSrc, resourcesDist, { recursive: true });

await Promise.all([
  build({
    entryPoints: [resolve(src, 'main.ts')],
    outfile: resolve(dist, 'main.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron', 'electron-updater'],
    sourcemap: true
  }),
  build({
    entryPoints: [resolve(src, 'preload.ts')],
    outfile: resolve(dist, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron'],
    sourcemap: true
  }),
  build({
    entryPoints: [resolve(src, 'renderer.ts')],
    outfile: resolve(dist, 'renderer.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'chrome120',
    sourcemap: true
  }),
  copyFile(resolve(src, 'index.html'), resolve(dist, 'index.html')),
  copyFile(resolve(src, 'styles.css'), resolve(dist, 'styles.css')),
  copyFile(resolve(src, 'windows-helper.ps1'), resolve(dist, 'windows-helper.ps1'))
]);

console.log('Desktop app built in apps/desktop-app/dist');