import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
  type NativeImage
} from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { analyzePrompt } from '../../../lib/promptAnalyzer';
import { rewritePromptWithModel } from '../../../lib/modelPromptRewriter';
import type { DesktopPopupState, PromptReview } from './shared';
import { WindowsAutomation } from './windowsAutomation';
import { DesktopStore } from './desktopStore';
import { PRODUCT } from '../../../config/product';
import type { DesktopSettingsView } from './shared';
import { autoUpdater } from 'electron-updater';
import { startLocalBridgeIfNeeded } from './localBridge';
import type { Server } from 'node:http';

const execFileAsync = promisify(execFile);
const MAX_PROMPT_LENGTH = 12_000;

interface ClipboardSnapshot {
  text: string;
  html: string;
  rtf: string;
  image: NativeImage;
}

interface ActiveSession {
  originalText: string;
  improvedText?: string;
  previousWindowHandle: string;
  clipboardSnapshot: ClipboardSnapshot;
  sourceDetail?: 'local-ai' | 'instant-rules' | 'safety-fallback';
  validationScore?: number;
}

interface LastInsertion {
  originalText: string;
  improvedText: string;
  windowHandle: string;
}

interface CaptureResult {
  windowHandle: string;
  selectionState: 'HAS_SELECTION' | 'AUTO_SELECTED' | 'EMPTY' | 'UNKNOWN';
  processName: string;
  caretAtEnd: boolean | null;
  isTextControl: boolean;
}

let popupWindow: BrowserWindow | null = null;
let popupReady: Promise<void> | null = null;
let tray: Tray | null = null;
let activeSession: ActiveSession | null = null;
let isQuitting = false;
let analysisSequence = 0;
let analysisInProgress = false;
let captureInProgress = false;
let modelAbortController: AbortController | null = null;
let lastInsertion: LastInsertion | null = null;
let embeddedBridge: Server | null = null;
const windowsAutomation = process.platform === 'win32' ? new WindowsAutomation() : null;

// Use an app-specific profile instead of Electron's shared development cache.
// This also makes the single-instance lock reliable across launch methods.
app.setName('Prompt Grammarly Desktop');
const userDataPath = join(app.getPath('appData'), 'Prompt Grammarly Desktop');
app.setPath('userData', userDataPath);
const desktopStore = new DesktopStore(join(userDataPath, 'prompt-grammarly.json'));
app.commandLine.appendSwitch('disk-cache-dir', join(userDataPath, 'Cache'));
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.disableHardwareAcceleration();

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function snapshotClipboard(): ClipboardSnapshot {
  return {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    image: clipboard.readImage()
  };
}

function restoreClipboard(snapshot: ClipboardSnapshot) {
  clipboard.clear();
  const data: { text?: string; html?: string; rtf?: string; image?: NativeImage } = {};
  if (snapshot.text) data.text = snapshot.text;
  if (snapshot.html) data.html = snapshot.html;
  if (snapshot.rtf) data.rtf = snapshot.rtf;
  if (!snapshot.image.isEmpty()) data.image = snapshot.image;

  if (Object.keys(data).length > 0) clipboard.write(data);
}

async function runPowerShell(script: string): Promise<string> {
  if (process.platform !== 'win32') {
    throw new Error('Desktop keyboard automation is currently available on Windows only.');
  }

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, timeout: 10_000, maxBuffer: 1024 * 1024 }
  );
  return stdout.trim();
}

async function copySelectionAndCaptureWindowLegacy(): Promise<CaptureResult> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PromptDesktopWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$handle = [PromptDesktopWindow]::GetForegroundWindow()
$processId = [uint32]0
[PromptDesktopWindow]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null
$processName = ""
try { $processName = (Get-Process -Id $processId).ProcessName } catch {}
$selectionState = "UNKNOWN"
$caretAtEnd = "UNKNOWN"
$isTextControl = $false
try {
  Add-Type -AssemblyName UIAutomationClient
  $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
  if ($null -ne $focused) {
    $controlType = $focused.Current.ControlType.ProgrammaticName
    $isTextControl = $controlType -in @("ControlType.Edit", "ControlType.Document")
  }
  $pattern = $null
  if ($null -ne $focused -and $focused.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern)) {
    $selectionRanges = $pattern.GetSelection()
    $selectedText = (($selectionRanges | ForEach-Object { $_.GetText(-1) }) -join "")
    if ([string]::IsNullOrWhiteSpace($selectedText)) {
      $selectionState = "EMPTY"
      if ($selectionRanges.Count -gt 0) {
        $endComparison = $selectionRanges[0].CompareEndpoints(
          [System.Windows.Automation.TextPatternRangeEndpoint]::End,
          $pattern.DocumentRange,
          [System.Windows.Automation.TextPatternRangeEndpoint]::End
        )
        if ($endComparison -eq 0) { $caretAtEnd = "TRUE" } else { $caretAtEnd = "FALSE" }
      }
    } else {
      $selectionState = "HAS_SELECTION"
    }
  }
} catch {}
$supportsPromptAutoSelect = $processName -match "^(Code(?: - Insiders)?|chrome|msedge|firefox|brave|opera|vivaldi)$"
if (($selectionState -eq "EMPTY" -or $selectionState -eq "UNKNOWN") -and $supportsPromptAutoSelect) {
  [System.Windows.Forms.SendKeys]::SendWait("^a")
  Start-Sleep -Milliseconds 150
  $selectionState = "AUTO_SELECTED"
} elseif ($selectionState -eq "EMPTY" -and $caretAtEnd -eq "TRUE" -and $isTextControl) {
  [System.Windows.Forms.SendKeys]::SendWait("^a")
  Start-Sleep -Milliseconds 150
  $selectionState = "AUTO_SELECTED"
}
if ($selectionState -ne "EMPTY") {
  [System.Windows.Forms.SendKeys]::SendWait("^c")
}
Write-Output ($handle.ToInt64().ToString() + "|" + $selectionState + "|" + $processName + "|" + $caretAtEnd + "|" + $isTextControl)
`;

  const output = await runPowerShell(script);
  const lastLine = output.split(/\r?\n/).at(-1) || '';
  const [windowHandle, rawState, processName = '', rawCaretAtEnd = 'UNKNOWN', rawIsTextControl = 'False'] =
    lastLine.split('|');
  const selectionState =
    rawState === 'EMPTY' || rawState === 'HAS_SELECTION' || rawState === 'AUTO_SELECTED'
      ? rawState
      : 'UNKNOWN';
  const caretAtEnd = rawCaretAtEnd === 'TRUE' ? true : rawCaretAtEnd === 'FALSE' ? false : null;
  const isTextControl = rawIsTextControl.toLowerCase() === 'true';

  if (!/^\d+$/.test(windowHandle || '')) throw new Error('Could not identify the active window.');
  return { windowHandle, selectionState, processName, caretAtEnd, isTextControl };
}

async function copySelectionAndCaptureWindow(): Promise<CaptureResult> {
  if (!windowsAutomation) return copySelectionAndCaptureWindowLegacy();
  try {
    return await windowsAutomation.capture();
  } catch (error) {
    console.warn('[desktop] Persistent Windows helper failed; using one-shot fallback.', error);
    return copySelectionAndCaptureWindowLegacy();
  }
}

async function focusWindowAndPasteLegacy(windowHandle: string) {
  if (!/^\d+$/.test(windowHandle)) throw new Error('The original window is no longer available.');

  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PromptDesktopFocus {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);
}
"@
$handle = [IntPtr]::new([Int64]::Parse("${windowHandle}"))
if ([PromptDesktopFocus]::IsIconic($handle)) {
  [PromptDesktopFocus]::ShowWindowAsync($handle, 9) | Out-Null
}
[PromptDesktopFocus]::SetForegroundWindow($handle) | Out-Null
Start-Sleep -Milliseconds 140
[System.Windows.Forms.SendKeys]::SendWait("^v")
`;

  await runPowerShell(script);
}

async function focusWindowAndPaste(windowHandle: string) {
  if (!windowsAutomation) return focusWindowAndPasteLegacy(windowHandle);
  try {
    await windowsAutomation.paste(windowHandle);
  } catch (error) {
    console.warn('[desktop] Persistent Windows helper paste failed; using one-shot fallback.', error);
    await focusWindowAndPasteLegacy(windowHandle);
  }
}

async function waitForCopiedText(sentinel: string): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    await wait(60);
    const value = clipboard.readText();
    if (value !== sentinel) return value.trim();
  }
  return '';
}

function createTrayImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#60a5fa"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
      <rect width="32" height="32" rx="9" fill="#121523"/>
      <path d="M16 6v5m0 10v5M6 16h5m10 0h5M9 9l3.5 3.5M19.5 19.5L23 23M9 23l3.5-3.5M19.5 12.5L23 9" stroke="url(#g)" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="16" cy="16" r="3.5" fill="url(#g)"/>
    </svg>`;
  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
    .resize({ width: 16, height: 16 });
}

function createPopupWindow() {
  popupWindow = new BrowserWindow({
    width: 400,
    height: 530,
    minWidth: 350,
    minHeight: 400,
    maxWidth: 560,
    maxHeight: 760,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  popupWindow.setAlwaysOnTop(true, 'floating');
  popupReady = new Promise((resolve) => {
    popupWindow?.webContents.once('did-finish-load', () => resolve());
  });
  void popupWindow.loadFile(join(__dirname, 'index.html'));

  popupWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    void closePopup();
  });
}

async function ensurePopupWindow() {
  if (!popupWindow || popupWindow.isDestroyed()) createPopupWindow();
  await popupReady;
  return popupWindow!;
}

function positionPopup(window: BrowserWindow) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const [currentWidth, currentHeight] = window.getSize();
  const width = Math.min(currentWidth, Math.max(340, display.workArea.width - 32));
  const height = Math.min(currentHeight, Math.max(380, display.workArea.height - 32));
  if (width !== currentWidth || height !== currentHeight) window.setSize(width, height, false);
  window.setPosition(
    Math.round(display.workArea.x + display.workArea.width - width - 24),
    Math.round(display.workArea.y + display.workArea.height - height - 24),
    false
  );
}

async function showState(state: DesktopPopupState, focus = true) {
  const window = await ensurePopupWindow();
  positionPopup(window);
  window.webContents.send('desktop-state', state);
  if (focus) window.show();
  else window.showInactive();
}

function toReview(text: string): PromptReview {
  const analysis = analyzePrompt(text, 'general');
  return {
    overallScore: analysis.overallScore,
    label: analysis.label,
    summary: analysis.summary,
    issues: analysis.issues.slice(0, 3).map(({ title, suggestion }) => ({ title, suggestion })),
    strengths: analysis.strengths.slice(0, 3)
  };
}

async function analyzeSession(session: ActiveSession) {
  if (analysisInProgress) return;
  analysisInProgress = true;
  const sequence = ++analysisSequence;
  await showState({ status: 'loading', originalText: session.originalText, stage: 'rewriting' }, false);

  try {
    const settings = desktopStore.settings;
    const originalAnalysis = analyzePrompt(session.originalText, 'general');
    modelAbortController?.abort();
    const currentAbortController = new AbortController();
    modelAbortController = currentAbortController;
    const modelResult = await rewritePromptWithModel(
      {
        prompt: session.originalText,
        useCase: 'general',
        fallbackPrompt: originalAnalysis.rewrittenPrompt,
        hasPriorConversation: false,
        preferSpeed: settings.performanceMode === 'fast',
        performanceMode: settings.performanceMode,
        keepModelsWarm: settings.keepModelsWarm
      },
      { signal: currentAbortController.signal }
    );
    if (modelAbortController === currentAbortController) modelAbortController = null;

    if (sequence !== analysisSequence || activeSession !== session) return;
    if (!modelResult.rewrittenPrompt.trim()) {
      throw new Error(modelResult.error || 'The local model did not return a valid prompt.');
    }

    await showState({ status: 'loading', originalText: session.originalText, stage: 'validating' }, false);
    session.improvedText = modelResult.rewrittenPrompt.trim();
    session.sourceDetail = modelResult.sourceDetail;
    session.validationScore = modelResult.validationScore;
    console.log(
      `[desktop] Rewrite ready with ${modelResult.model || 'instant rules fallback'} (${session.improvedText.length} characters).`
    );
    await showState({
      status: 'success',
      originalText: session.originalText,
      improvedText: session.improvedText,
      model: modelResult.model,
      sourceDetail: modelResult.sourceDetail,
      validationScore: modelResult.validationScore,
      isAlreadyGood: modelResult.source === 'model' && modelResult.isAlreadyGood && !modelResult.error,
      canUndo: lastInsertion !== null,
      review: toReview(session.improvedText)
    });
  } catch (error) {
    if (sequence !== analysisSequence || activeSession !== session) return;
    const detail = error instanceof Error ? error.message : 'Unknown local model error';
    await showState({
      status: 'error',
      title: 'Local AI unavailable',
      message: `Start the local API with npm run dev and make sure Ollama is running. ${detail}`,
      canRetry: true
    });
  } finally {
    modelAbortController = null;
    analysisInProgress = false;
  }
}

async function captureAndAnalyze() {
  if (captureInProgress || analysisInProgress) {
    popupWindow?.showInactive();
    console.log('[desktop] Ignored repeated shortcut while capture or rewrite is in progress.');
    return;
  }
  captureInProgress = true;
  const captureStartedAt = Date.now();

  analysisSequence++;
  if (activeSession) {
    restoreClipboard(activeSession.clipboardSnapshot);
    activeSession = null;
  }

  const clipboardSnapshot = snapshotClipboard();
  const sentinel = `__PROMPT_DESKTOP_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
  clipboard.writeText(sentinel);

  try {
    await showState({ status: 'loading', originalText: '', stage: 'reading' }, false);
    const capture = await copySelectionAndCaptureWindow();
    if (capture.selectionState === 'EMPTY') {
      restoreClipboard(clipboardSnapshot);
      await showState({
        status: 'error',
        title: 'Prompt not detected',
        message: 'Select a prompt, or place the text cursor at the end of it, then press Ctrl+Alt+P.',
        canRetry: false
      });
      return;
    }

    const selectedText = await waitForCopiedText(sentinel);
    if (!selectedText) {
      restoreClipboard(clipboardSnapshot);
      await showState({
        status: 'error',
        title: 'Prompt not detected',
        message: 'Select a prompt, or place the text cursor at the end of it, then press Ctrl+Alt+P.',
        canRetry: false
      });
      return;
    }

    if (!selectedText) {
      restoreClipboard(clipboardSnapshot);
      await showState({
        status: 'error',
        title: 'Prompt not detected',
        message: 'The focused editor did not contain a prompt to improve.',
        canRetry: false
      });
      return;
    }

    if (selectedText.length > MAX_PROMPT_LENGTH) {
      restoreClipboard(clipboardSnapshot);
      await showState({
        status: 'error',
        title: 'Selection is too long',
        message: `Select no more than ${MAX_PROMPT_LENGTH.toLocaleString()} characters.`,
        canRetry: false
      });
      return;
    }

    activeSession = {
      originalText: selectedText,
      previousWindowHandle: capture.windowHandle,
      clipboardSnapshot
    };
    console.log(
      `[desktop] Captured ${selectedText.length} characters via ${capture.selectionState} from ${capture.processName || 'unknown app'} in ${Date.now() - captureStartedAt}ms.`
    );
    await analyzeSession(activeSession);
  } catch (error) {
    restoreClipboard(clipboardSnapshot);
    const message = error instanceof Error ? error.message : 'Could not read the selected text.';
    await showState({ status: 'error', title: 'Could not capture selection', message, canRetry: false });
  } finally {
    captureInProgress = false;
  }
}

async function closePopup() {
  analysisSequence++;
  modelAbortController?.abort();
  modelAbortController = null;
  popupWindow?.hide();
  if (activeSession) restoreClipboard(activeSession.clipboardSnapshot);
  activeSession = null;
}

async function insertImprovedPrompt(editedText?: string): Promise<boolean> {
  const session = activeSession;
  if (!session?.improvedText) return false;
  const textToInsert = editedText?.trim() || session.improvedText;

  popupWindow?.hide();
  try {
    clipboard.writeText(textToInsert);
    await focusWindowAndPaste(session.previousWindowHandle);
    await wait(700);
    restoreClipboard(session.clipboardSnapshot);
    lastInsertion = {
      originalText: session.originalText,
      improvedText: textToInsert,
      windowHandle: session.previousWindowHandle
    };
    desktopStore.addHistory({
      originalText: session.originalText,
      improvedText: textToInsert,
      source: session.sourceDetail || 'unknown'
    });
    refreshTrayMenu();
    activeSession = null;
    console.log('[desktop] Improved prompt inserted and previous clipboard restored.');
    return true;
  } catch (error) {
    restoreClipboard(session.clipboardSnapshot);
    const message = error instanceof Error ? error.message : 'Could not paste into the original application.';
    await showState({ status: 'error', title: 'Insert failed', message, canRetry: false });
    return false;
  }
}

async function undoLastInsertion(): Promise<boolean> {
  const insertion = lastInsertion;
  if (!insertion) return false;
  const snapshot = snapshotClipboard();
  try {
    clipboard.writeText(insertion.originalText);
    if (windowsAutomation) await windowsAutomation.paste(insertion.windowHandle, true);
    else await focusWindowAndPaste(insertion.windowHandle);
    await wait(500);
    restoreClipboard(snapshot);
    lastInsertion = null;
    refreshTrayMenu();
    popupWindow?.hide();
    return true;
  } catch {
    restoreClipboard(snapshot);
    return false;
  }
}

function registerIpcHandlers() {
  ipcMain.handle('copy-improved-prompt', async (_event, editedText?: string) => {
    if (!activeSession?.improvedText) return false;
    const textToCopy = editedText?.trim() || activeSession.improvedText;
    clipboard.writeText(textToCopy);
    desktopStore.addHistory({
      originalText: activeSession.originalText,
      improvedText: textToCopy,
      source: activeSession.sourceDetail || 'unknown'
    });
    activeSession = null;
    await wait(350);
    popupWindow?.hide();
    return true;
  });

  ipcMain.handle('insert-improved-prompt', (_event, editedText?: string) => insertImprovedPrompt(editedText));
  ipcMain.handle('undo-last-insertion', () => undoLastInsertion());
  ipcMain.handle('retry-analysis', async () => {
    if (activeSession) await analyzeSession(activeSession);
  });
  ipcMain.handle('close-popup', () => closePopup());
  ipcMain.handle('save-settings', async (_event, patch: Partial<DesktopSettingsView>) => {
    const previousShortcut = desktopStore.settings.shortcut;
    const previousMode = desktopStore.settings.performanceMode;
    const previouslyKeptWarm = desktopStore.settings.keepModelsWarm;
    const settings = desktopStore.updateSettings(patch);
    if (settings.shortcut !== previousShortcut) registerConfiguredShortcut();
    if (
      settings.keepModelsWarm &&
      (settings.performanceMode !== previousMode || settings.keepModelsWarm !== previouslyKeptWarm)
    ) {
      void warmSelectedModel();
    }
    refreshTrayMenu();
    return settings;
  });
  ipcMain.handle('clear-history', async () => {
    desktopStore.clearHistory();
    await showState({ status: 'history', entries: [] });
  });
}

function createTray() {
  tray = new Tray(createTrayImage());
  tray.setToolTip(PRODUCT.desktopName);
  refreshTrayMenu();
  tray.on('double-click', () => void captureAndAnalyze());
}

function refreshTrayMenu() {
  if (!tray) return;
  const settings = desktopStore.settings;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Improve current prompt',
        accelerator: settings.shortcut.replace('CommandOrControl', 'Ctrl'),
        click: () => void captureAndAnalyze()
      },
      {
        label: 'Undo last insertion',
        enabled: lastInsertion !== null,
        click: () => void undoLastInsertion()
      },
      { type: 'separator' },
      {
        label: 'Performance mode',
        submenu: (['fast', 'balanced', 'quality'] as const).map((mode) => ({
          label: mode.charAt(0).toUpperCase() + mode.slice(1),
          type: 'radio' as const,
          checked: settings.performanceMode === mode,
          click: () => {
            desktopStore.updateSettings({ performanceMode: mode });
            refreshTrayMenu();
            void warmSelectedModel();
          }
        }))
      },
      {
        label: 'Shortcut',
        submenu: [
          ['CommandOrControl+Alt+P', 'Ctrl+Alt+P'],
          ['CommandOrControl+Shift+P', 'Ctrl+Shift+P'],
          ['CommandOrControl+Alt+G', 'Ctrl+Alt+G']
        ].map(([shortcut, label]) => ({
          label,
          type: 'radio' as const,
          checked: settings.shortcut === shortcut,
          click: () => {
            desktopStore.updateSettings({ shortcut });
            registerConfiguredShortcut();
            refreshTrayMenu();
          }
        }))
      },
      {
        label: 'Keep models in memory',
        type: 'checkbox',
        checked: settings.keepModelsWarm,
        click: (item) => {
          desktopStore.updateSettings({ keepModelsWarm: item.checked });
          if (item.checked) void warmSelectedModel();
        }
      },
      {
        label: 'Save local history',
        type: 'checkbox',
        checked: settings.historyEnabled,
        click: (item) => desktopStore.updateSettings({ historyEnabled: item.checked })
      },
      { type: 'separator' },
      {
        label: 'Settings…',
        click: () => void showState({ status: 'settings', settings: desktopStore.settings })
      },
      {
        label: `History (${desktopStore.history.length})…`,
        click: () => void showState({ status: 'history', entries: desktopStore.history })
      },
      { label: 'Diagnostics…', click: () => void showDiagnostics() },
      {
        label: 'Check for updates',
        enabled: app.isPackaged,
        click: () => void autoUpdater.checkForUpdatesAndNotify()
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  );
}

async function showDiagnostics() {
  const settings = desktopStore.settings;
  let api = 'Local API: offline';
  try {
    const response = await fetch('http://127.0.0.1:3000/api/rewrite', { signal: AbortSignal.timeout(2_000) });
    api = `Local API: HTTP ${response.status}`;
  } catch {}
  await showState({
    status: 'diagnostics',
    lines: [
      api,
      `Mode: ${settings.performanceMode}`,
      `Shortcut: ${settings.shortcut.replace('CommandOrControl', 'Ctrl')}`,
      `Persistent Windows helper: ${windowsAutomation ? 'enabled' : 'unavailable'}`,
      `Model memory: ${settings.keepModelsWarm ? 'keep warm' : 'release after use'}`,
      `Saved history entries: ${desktopStore.history.length}`
    ]
  });
}

function registerConfiguredShortcut(): boolean {
  globalShortcut.unregisterAll();
  const shortcut = desktopStore.settings.shortcut;
  const registered = globalShortcut.register(shortcut, () => void captureAndAnalyze());
  console.log(`[desktop] Global shortcut ${shortcut}: ${registered ? 'registered' : 'unavailable'}.`);
  return registered;
}

async function warmSelectedModel() {
  const settings = desktopStore.settings;
  if (!settings.keepModelsWarm) return;
  const query = new URLSearchParams({
    warm: '1',
    keep: '1',
    mode: settings.performanceMode
  });
  try {
    const response = await fetch(`http://127.0.0.1:3000/api/rewrite?${query}`, {
      signal: AbortSignal.timeout(120_000)
    });
    console.log(
      `[desktop] ${settings.performanceMode} model warm-up: ${response.ok ? 'ready' : `HTTP ${response.status}`}.`
    );
  } catch (error) {
    console.warn('[desktop] Model warm-up did not complete.', error);
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.whenReady().then(async () => {
  embeddedBridge = await startLocalBridgeIfNeeded();
  windowsAutomation?.start();
  app.setAppUserModelId('com.promptgrammarly.desktop');
  createPopupWindow();
  createTray();
  registerIpcHandlers();
  if (app.isPackaged) void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
  void warmSelectedModel();

  const registered = registerConfiguredShortcut();
  console.log('[desktop] Tray app ready.');
  if (!registered && process.platform === 'win32') {
    tray?.displayBalloon({
      title: 'Prompt Grammarly Desktop',
      content: 'Ctrl+Alt+P is already being used by another application.'
    });
    void showState({
      status: 'error',
      title: 'Shortcut unavailable',
      message:
        'Ctrl+Alt+P is already being used. Quit any previous Prompt Grammarly Desktop tray instance and start the app again.',
      canRetry: false
    });
  }
});

app.on('second-instance', () => {
  tray?.displayBalloon({
    title: 'Prompt Grammarly Desktop',
    content: 'The app is already running. Select text and press Ctrl+Alt+P.'
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  analysisSequence++;
  globalShortcut.unregisterAll();
  if (activeSession) restoreClipboard(activeSession.clipboardSnapshot);
  activeSession = null;
  windowsAutomation?.stop();
  embeddedBridge?.close();
});

// Keep the tray process alive after the popup is hidden or closed.
app.on('window-all-closed', () => {});
