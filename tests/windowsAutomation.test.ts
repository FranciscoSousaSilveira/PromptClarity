import { describe, expect, it, vi } from 'vitest';
import { WindowsAutomation, type WindowsCaptureResult } from '../apps/desktop-app/src/windowsAutomation';

describe('WindowsAutomation unit tests', () => {
  it('parses capture result with copiedLength, window details and clipboard formats', async () => {
    const mockResult: WindowsCaptureResult = {
      windowHandle: '123456',
      selectionState: 'HAS_SELECTION',
      processName: 'nvm',
      caretAtEnd: false,
      isTextControl: true,
      copiedLength: 18,
      foregroundWindowHandle: '123456',
      targetWindowHandle: '123456',
      targetWindowTitle: 'nvm - Editor',
      focusedControlType: 'ControlType.Document',
      availableFormats: 'Text, UnicodeText',
      helperError: null
    };

    const automation = new WindowsAutomation();
    // Inject mock request
    vi.spyOn(automation as unknown as { request: (...args: unknown[]) => Promise<{ result: WindowsCaptureResult }> }, 'request').mockResolvedValue({
      result: mockResult
    });

    const res = await automation.capture('sentinel_123');
    expect(res.copiedLength).toBe(18);
    expect(res.processName).toBe('nvm');
    expect(res.selectionState).toBe('HAS_SELECTION');
    expect(res.targetWindowTitle).toBe('nvm - Editor');
  });

  it('handles helper failure gracefully', async () => {
    const automation = new WindowsAutomation();
    vi.spyOn(automation as unknown as { request: () => Promise<never> }, 'request').mockRejectedValue(
      new Error('Windows helper timed out')
    );

    await expect(automation.capture('sentinel_123')).rejects.toThrow('Windows helper timed out');
  });

  it('handles capture with zero copiedLength', async () => {
    const mockResult: WindowsCaptureResult = {
      windowHandle: '123456',
      selectionState: 'EMPTY',
      processName: 'notepad',
      caretAtEnd: null,
      isTextControl: true,
      copiedLength: 0,
      foregroundWindowHandle: '123456',
      targetWindowHandle: '123456',
      targetWindowTitle: 'Untitled - Notepad',
      focusedControlType: 'ControlType.Edit',
      availableFormats: '',
      helperError: null
    };

    const automation = new WindowsAutomation();
    vi.spyOn(automation as unknown as { request: (...args: unknown[]) => Promise<{ result: WindowsCaptureResult }> }, 'request').mockResolvedValue({
      result: mockResult
    });

    const res = await automation.capture('sentinel_123');
    expect(res.copiedLength).toBe(0);
    expect(res.selectionState).toBe('EMPTY');
  });
});