import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
for (const file of [
  'chrome-extension/manifest.json',
  'extension/package.json',
  'apps/desktop-app/package.json'
]) {
  const value = JSON.parse(await readFile(file, 'utf8'));
  value.version = rootPackage.version;
  if (value.name === 'prompt-enhancement') value.displayName = 'Prompt Grammarly';
  const formatted = await format(JSON.stringify(value), {
    parser: file.endsWith('package.json') ? 'json-stringify' : 'json',
    filepath: file
  });
  await writeFile(file, formatted, 'utf8');
}
console.log(`Synchronized version ${rootPackage.version}.`);
