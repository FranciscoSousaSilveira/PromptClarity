import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopStore } from '../apps/desktop-app/src/desktopStore';

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('DesktopStore feedback persistence', () => {
  it('stores local feedback entries on disk', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'prompt-grammarly-store-'));
    const storePath = join(tempDir, 'prompt-grammarly.json');
    const store = new DesktopStore(storePath);

    store.addFeedback({
      original: 'Explain the bug.',
      rewritten: 'Explain the bug.',
      source: 'error',
      status: 'error',
      mode: 'balanced',
      intervention: 'normal',
      validationReason: 'local_service_unavailable',
      reason: 'user_too_much',
      surface: 'desktop'
    });

    expect(store.history).toHaveLength(0);
    expect(store.feedback).toHaveLength(1);

    const saved = JSON.parse(readFileSync(storePath, 'utf8')) as { feedback?: unknown[] };
    expect(Array.isArray(saved.feedback)).toBe(true);
    expect(saved.feedback?.[0]).toMatchObject({
      original: 'Explain the bug.',
      rewritten: 'Explain the bug.',
      source: 'error',
      status: 'error',
      mode: 'balanced',
      intervention: 'normal',
      validationReason: 'local_service_unavailable',
      reason: 'user_too_much',
      surface: 'desktop'
    });
  });
});
