import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'src');
const dist = resolve(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

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
