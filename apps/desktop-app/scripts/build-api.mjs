import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { promises as fs } from 'node:fs';

const PROJECT_ROOT = resolve(import.meta.dirname, '../../..');
const API_DEST = resolve(import.meta.dirname, '../resources/api');

async function main() {
  console.log('Building local API as standalone executable...');

  // Build the API as a standalone Node.js app
  // Run build from the project root (where package.json is)
  console.log('Building Next.js API...');
  execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });

  // The Next.js build creates a .next/standalone folder if output: 'standalone' is set
  // We need to copy the standalone output to resources/api
  const standaloneSource = resolve(PROJECT_ROOT, '.next/standalone');
  const apiDest = resolve(API_DEST, 'api');

  await fs.rm(apiDest, { recursive: true, force: true });
  await fs.cp(standaloneSource, apiDest, { recursive: true });

  console.log(`API built and copied to ${apiDest}`);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
