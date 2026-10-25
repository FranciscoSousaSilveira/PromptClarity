import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveLocalOllamaUrl } from '../lib/localRewriteService';

describe('release privacy gate', () => {
  it('only checks for updates from configured trusted sources', () => {
    const desktopMain = readFileSync('apps/desktop-app/src/main.ts', 'utf8');
    // electron-updater is used for trusted source updates via GitHub releases
    expect(desktopMain).toContain('electron-updater');
    // ensure we don't use generic update strings that might leak to external trackers
    expect(desktopMain).not.toMatch(/checkForUpdates\(\)/);
  });

  it('rejects external Ollama endpoints', () => {
    expect(resolveLocalOllamaUrl('https://external.example/api')).toBe('http://127.0.0.1:11434');
  });
});
