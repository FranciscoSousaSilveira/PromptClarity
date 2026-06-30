import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ZipArchive } from 'archiver';
import packageJson from '../package.json' with { type: 'json' };

const outputDirectory = resolve('release');
await mkdir(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, `prompt-grammarly-chrome-${packageJson.version}.zip`);
const output = createWriteStream(outputPath);
const archive = new ZipArchive({ zlib: { level: 9 } });
const completion = new Promise((resolveCompletion, reject) => {
  output.on('close', resolveCompletion);
  archive.on('error', reject);
});
archive.pipe(output);
archive.file(resolve('chrome-extension/manifest.json'), { name: 'manifest.json' });
archive.file(resolve('chrome-extension/icon.svg'), { name: 'icon.svg' });
archive.directory(resolve('chrome-extension/dist'), 'dist');
await archive.finalize();
await completion;
console.log(`Chrome package created: ${outputPath}`);
