import https from 'node:https';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import AdmZip from 'adm-zip';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'PromptGrammarly/1.0' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(JSON.parse(data)));
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('Fetching latest Ollama release from GitHub API...');

  const release = await fetchJson('https://api.github.com/repos/ollama/ollama/releases/latest');

  // Prefer OllamaSetup.exe, fallback to zip
  let asset = release.assets.find((a) => a.name === 'OllamaSetup.exe');
  if (!asset) {
    asset = release.assets.find((a) => a.name === 'ollama-windows-amd64.zip');
  }
  if (!asset) {
    throw new Error('No suitable Ollama Windows asset found');
  }

  console.log(`Downloading ${asset.name}...`);

  const DEST_DIR = resolve(import.meta.dirname, '../resources/ollama');
  const DEST_PATH = resolve(DEST_DIR, asset.name);

  await fs.mkdir(DEST_DIR, { recursive: true });

  // Download the asset
  const response = await fetch(asset.browser_download_url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(DEST_PATH, Buffer.from(buffer));
  console.log(`Downloaded ${asset.name} to ${DEST_PATH}`);

  // If it's a zip, extract ollama.exe
  if (asset.name.endsWith('.zip')) {
    console.log('Extracting ollama.exe from zip...');
    const zip = new AdmZip(DEST_PATH);
    const zipEntries = zip.getEntries();
    const ollamaEntry = zipEntries.find((e) => e.entryName === 'ollama.exe');
    if (ollamaEntry) {
      zip.extractEntryTo(ollamaEntry, resolve(DEST_DIR, 'ollama.exe'), false, true);
      console.log('Extracted ollama.exe');
    } else {
      console.warn('Could not find ollama.exe in zip');
    }
    await fs.unlink(DEST_PATH);
  }

  // Rename OllamaSetup.exe to ollama.exe if needed
  const setupPath = resolve(DEST_DIR, 'OllamaSetup.exe');
  const exePath = resolve(DEST_DIR, 'ollama.exe');

  if (await fs.stat(setupPath).catch(() => false)) {
    await fs.rename(setupPath, exePath);
    console.log('Renamed OllamaSetup.exe to ollama.exe');
  }

  console.log('Ollama binary ready at:', exePath);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
