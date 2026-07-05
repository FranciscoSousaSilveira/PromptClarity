import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveLocalOllamaUrl } from '../lib/localRewriteService';

describe('release privacy gate', () => {
  it('does not perform cloud update checks from the desktop runtime', () => {
    const desktopMain = readFileSync('apps/desktop-app/src/main.ts', 'utf8');
    expect(desktopMain).not.toMatch(/autoUpdater|checkForUpdates/i);
    expect(desktopMain).not.toContain('electron-updater');
  });

  it('rejects external Ollama endpoints', () => {
    expect(resolveLocalOllamaUrl('https://external.example/api')).toBe('http://127.0.0.1:11434');
  });
});
