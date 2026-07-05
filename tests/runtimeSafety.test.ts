import { describe, expect, it } from 'vitest';
import {
  ExtensionContextLifecycle,
  hasUsableExtensionContext,
  isChromeRuntimeCommunicationError,
  isExtensionContextInvalidationError,
  readChromeRuntimeLastError,
  type ChromeLike
} from '../chrome-extension/src/runtimeSafety';

function extensionChrome(id = 'extension-id'): ChromeLike {
  return { runtime: { id }, storage: { local: {} } };
}

describe('Chrome runtime safety', () => {
  it('does not treat a test bench that never had an extension id as invalidated', () => {
    const lifecycle = new ExtensionContextLifecycle();
    expect(lifecycle.observe(undefined)).toBe(false);
    expect(lifecycle.shouldIgnoreLateResult(undefined)).toBe(false);
    expect(lifecycle.hasObservedExtensionContext()).toBe(false);
    expect(lifecycle.isInvalidated()).toBe(false);
  });

  it('ignores late results only after a real extension context disappears', () => {
    const lifecycle = new ExtensionContextLifecycle();
    expect(lifecycle.observe(extensionChrome())).toBe(true);
    expect(lifecycle.shouldIgnoreLateResult(extensionChrome(''))).toBe(true);
    expect(lifecycle.isInvalidated()).toBe(true);
  });

  it('keeps a continuously valid extension context usable', () => {
    const lifecycle = new ExtensionContextLifecycle();
    expect(lifecycle.observe(extensionChrome())).toBe(true);
    expect(lifecycle.shouldIgnoreLateResult(extensionChrome())).toBe(false);
  });

  it('recognizes explicit context invalidation and common message/port failures', () => {
    expect(isExtensionContextInvalidationError(new Error('Extension context invalidated.'))).toBe(true);
    expect(isChromeRuntimeCommunicationError(new Error('The message port closed before a response.'))).toBe(
      true
    );
    expect(isChromeRuntimeCommunicationError(new Error('Could not establish connection.'))).toBe(true);
    expect(isChromeRuntimeCommunicationError(new Error('Quota exceeded'))).toBe(false);
  });

  it('marks a known invalidation error even if runtime.id still appears present', () => {
    const lifecycle = new ExtensionContextLifecycle();
    lifecycle.observe(extensionChrome());
    expect(lifecycle.noteRuntimeError(new Error('Extension context was invalidated.'))).toBe(true);
    expect(lifecycle.shouldIgnoreLateResult(extensionChrome())).toBe(true);
  });

  it('reads chrome.runtime.lastError without throwing', () => {
    const chromeApi = extensionChrome();
    chromeApi.runtime!.lastError = { message: 'The port is disconnected' };
    expect(readChromeRuntimeLastError(chromeApi)?.message).toBe('The port is disconnected');
    expect(hasUsableExtensionContext(chromeApi)).toBe(true);
  });
});
