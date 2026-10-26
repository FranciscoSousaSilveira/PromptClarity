# PromptClarity — Implementation Guide

## Overview

PromptClarity is a standalone Windows desktop application that improves prompts locally using a bundled Ollama instance and a local Next.js API server. It works system-wide via a global hotkey (`Ctrl+Alt+P`), capturing text from any application, sending it to a local AI model, and presenting an improved version for insertion.

---

## Architecture

```
PromptClarity.exe (Electron)
├── Service Manager
│   ├── Ollama (bundled ollama.exe)     → localhost:11434
│   └── Local API (bundled Next.js)     → localhost:3000
├── Windows Automation (UIA + SendKeys)
│   ├── Text capture via UI Automation
│   └── Text insertion via SendKeys
├── Tray + Popup UI (React)
│   ├── Tray icon + global hotkey (Ctrl+Alt+P)
│   └── React popup (React, frameless, always-on-top)
└── Persistence
    ├── Settings (JSON in %LOCALAPPDATA%\PromptClarity Desktop)
    └── History (optional, JSON)
```

---

## Core Components

### 1. Service Manager (`apps/desktop-app/src/services.ts`)

Manages the lifecycle of bundled services (Ollama + API):

```typescript
class ServiceManager {
  private services = new Map<string, ServiceInstance>();
  
  async startService(config: ServiceConfig): Promise<void>
  async stopService(name: string): Promise<void>
  async stopAll(): Promise<void>
  isServiceReady(name: string): boolean
}
```

**Service Configuration:**
```typescript
interface ServiceConfig {
  name: string;
  command: string;           // Relative path from resources/
  args: string[];
  healthUrl: string;         // HTTP endpoint for readiness
  readyTimeoutMs: number;    // Max wait time for readiness
  env?: Record<string, string>;
}
```

**Startup Sequence:**
1. Start Ollama (`ollama/ollama.exe serve`) → wait for `http://127.0.0.1:11434/api/version`
2. Start API (`api/server.exe`) → wait for `http://127.0.0.1:3000/api/health`
3. Proceed to `checkOllamaAndModel()`

**Graceful Shutdown:**
- `SIGTERM` → 5s grace period → `SIGKILL`
- Called in `app.on('before-quit')`

---

### 2. Ollama Auto-Install & Model Management

**First Launch Flow:**
```
1. Detect RAM → recommend model (Fast/Balanced/Quality)
2. Check if Ollama is running (ollama list)
3. If missing:
   a. If ollamaAutoInstall=true (default): download OllamaSetup.exe → silent install (/S)
   b. Else: show dialog with [Download Ollama] [Retry] [Close]
4. Check if recommended model exists (ollama list)
5. If missing: download with `ollama pull <model>`
6. Cache model name in settings.selectedModel
```

**Auto-Install Logic (`installOllamaSilently`):**
1. Downloads `OllamaSetup.exe` from GitHub Releases API
2. Runs silent install: `OllamaSetup.exe /S /D=<install_dir>`
3. Waits for `ollama list` to succeed (30s timeout)
4. Falls back to manual dialog on failure

**Model Profiles (detectHardwareProfile):**
| RAM | Model | Label | Description |
|-----|-------|-------|-------------|
| ≥8 GB | `qwen2.5:3b` | Best quality | For 8 GB+ RAM |
| 6 GB | `qwen2.5:1.5b` | Good quality | Optimized for 6 GB |
| 4 GB | `qwen2.5:0.5b` | Fast & reliable | Optimized for 4 GB |
| <4 GB | `qwen2.5:0.5b` | Lightweight | For limited RAM |

---

### 3. Windows Automation (`windows-helper.ps1`)

Captures text from any application using Windows UI Automation + SendKeys.

**Capture Flow:**
```powershell
# 1. Find target window (skip Electron/Ollama/PromptClarity windows)
$target = Get-ValidTargetWindow  # Z-order traversal, skip Electron/Ollama/PromptClarity

# 2. Focus target window
SetForegroundWindow($handle)
Start-Sleep 100ms
$focusConfirmed = (GetForegroundWindow() -eq $handle)

# 3. Check existing selection via UIA TextPattern
$focused = [AutomationElement]::FocusedElement
if ($focused -and $focused.TryGetTextPattern()) {
    $selection = $pattern.GetSelection()
    $selectedText = $selection | ForEach-Object { $_.GetText(-1) } -join ''
    if ($selectedText) { selectionState = 'HAS_SELECTION' }
}

# 4. If no selection: try Ctrl+C
if ($selectionState -ne 'HAS_SELECTION') {
    SendKeys('^c')
    Wait 100ms
    $clipText = [Clipboard]::GetText()
    if ($clipText -ne $sentinel) { selectionState = 'HAS_SELECTION' }
}

# 5. If still empty: Select All + Copy
if ($selectionState -eq 'EMPTY') {
    SendKeys('^a'); Wait 100ms
    SendKeys('^c'); Wait 100ms
    $clipText = [Clipboard]::GetText()
    if ($clipText -ne $sentinel) { selectionState = 'AUTO_SELECTED' }
}

# 6. Return diagnostics
return @{
    selectionState, copiedLength, processName,
    foregroundWindowHandle, targetWindowHandle,
    focusedControlType, availableFormats, helperError
}
```

**Key Features:**
- **Focus verification** — Confirms target window has foreground before sending keys
- **Sentinel pattern** — Writes unique sentinel to clipboard before copy; verifies clipboard changed
- **Focus verification** — After `SetForegroundWindow`, confirms `GetForegroundWindow() === target`
- **Multiple strategies** — Existing selection → Ctrl+C → Select All + Copy
- **Diagnostics** — Returns `selectionState`, `copiedLength`, `focusedControlType`, `availableFormats`, `helperError`

---

### 3. Electron Main Process (`main.ts`)

**Key Responsibilities:**
- Global hotkey registration (`Ctrl+Alt+P`)
- Tray icon + context menu
- Popup window management (frameless, always-on-top)
- Service Manager orchestration
- Settings persistence
- Auto-updater integration
- Ollama/Model management

**Key Functions:**
- `captureAndAnalyze()` — Hotkey handler with 15s timeout, AbortController
- `checkOllamaAndModel()` — Ollama detection, model selection, auto-install
- `analyzeSession()` → `rewritePromptWithModel()` → UI update
- `insertImprovedPrompt()` / `undoLastInsertion()` — Clipboard + paste workflow

**Concurrency Control:**
- `captureInProgress` / `analysisInProgress` flags
- `AbortController` for 15s capture timeout
- `Promise.race` for clipboard wait (2s timeout)

---

### 4. Service Manager (`services.ts`)

```typescript
class ServiceManager {
  private services = new Map<string, ServiceInstance>();
  private isShuttingDown = false;

  async startService(config: ServiceConfig): Promise<void>
  async stopService(name: string): Promise<void>
  async stopAll(): Promise<void>
  isServiceReady(name: string): boolean
}
```

**Request/Response Protocol:**
- JSON lines over stdin/stdout
- Request: `{ id, command, sentinel, originalHandle }`
- Response: `{ id, ok, result, error }`
- `AbortSignal` support for cancellation

---

### 4. Windows Helper (`windows-helper.ps1`)

Persistent PowerShell process communicating via stdin/stdout JSON.

**Commands:**
- `capture` → Returns capture diagnostics
- `paste` → Focuses window + `Ctrl+V` (or `Ctrl+A` + `Ctrl+V`)

**Focus Verification:**
```powershell
$beforeFocus = GetForegroundWindow()
SetForegroundWindow($handle)
Start-Sleep 150ms
$afterFocus = GetForegroundWindow()
$focusConfirmed = ($afterFocus -eq $handle)
```

---

### 5. Settings & Persistence (`desktopStore.ts`, `types/settings.ts`)

**Settings Schema:**
```typescript
interface AppSettings {
  performanceMode: 'fast' | 'balanced' | 'quality';
  language: 'auto' | 'en' | 'pt-PT';
  autoOpen: boolean;
  keepModelsWarm: boolean;
  shortcut: string;                    // default: 'CommandOrControl+Alt+P'
  historyEnabled: boolean;
  historyLimit: number;                // default: 20
  selectedModel?: string;              // e.g., 'qwen2.5:3b'
  hardwareDetected?: boolean;          // first-run flag
  telemetryEnabled?: boolean;          // default: false
  ollamaAutoInstall?: boolean;         // default: true
}
```

**Change Notification:**
```typescript
onDidChange(key: string, listener: (value: any) => void)
```
Used by telemetry to react to `telemetryEnabled` changes.

---

### 5. Telemetry (`telemetry.ts`)

**Opt-in Only** — Disabled by default, enabled in Settings → Privacy.

**Events Tracked:**
- `app_start` — Platform, arch, version
- `capture_success` — `copiedLength`, `selectionState`, duration
- `telemetry_enabled` / `telemetry_disabled`
- `model_download_start` / `capture_timeout` / `capture_error`

**Crash Reports:**
- `uncaughtException` / `unhandledRejection`
- Uses `navigator.sendBeacon` for reliability
- Context: `captureInProgress`, `analysisInProgress`, `selectedModel`
- **No PII** — No prompt text, clipboard, file paths

**Endpoints:**
- `https://telemetry.promptclarity.app/v1/events`
- `https://telemetry.promptclarity.app/v1/crashes`

---

### 5. Local API (`app/api/rewrite/route.ts`)

**Endpoint:** `POST http://127.0.0.1:3000/api/rewrite`

**Request:**
```json
{
  "prompt": "string",
  "useCase": "general",
  "fallbackPrompt": "string",
  "hasPriorConversation": false,
  "preferSpeed": false,
  "performanceMode": "fast|balanced|quality",
  "keepModelsWarm": false
}
```

**Response:**
```json
{
  "rewrittenPrompt": "string",
  "model": "qwen2.5:3b",
  "source": "model|checkmark|error|local_fallback",
  "status": "changed|no_change|fallback|error",
  "validation": { "reason": "string" },
  "validationScore": number,
  "intervention": "strict|normal|polished",
  "latencyMs": number
}
```

**Validation (`modelPromptRewriter.ts`):**
- Ensures output represents original intent
- Rejects responses that add requirements, refuse, or comment
- Falls back to conservative local rewriter on failure

---

### 6. Prompt Analysis Pipeline (`lib/`)

**Pipeline:**
```
promptAnalyzer.ts    →  Full analysis (score, issues, strengths, rewritten)
promptRewriter.ts    →  Conservative fallback (no semantic expansion)
promptRewriter.ts    →  Model call + validation
promptEnhancer.ts    →  Quality enhancement
spellChecker.ts      →  Spell checking
```

---

## Data Flow

```
User presses Ctrl+Alt+P
        ↓
[main.ts] captureAndAnalyze()
        ↓
[windows-helper.ps1] capture text
        ↓
[main.ts] copySelectionAndCaptureWindow(sentinel)
        ↓
[services.ts] → windows-helper.ps1 (stdin/stdout JSON)
        ↓
[main.ts] waitForCopiedText(sentinel)  // 2s timeout
        ↓
[main.ts] analyzeSession(activeSession)
        ↓
[modelPromptRewriter.ts] rewritePromptWithModel()
        ↓
[API] POST /api/rewrite → Ollama → validation
        ↓
[main.ts] showState({ status: 'success', improvedText })
        ↓
[renderer.ts] render popup → user clicks Insert
        ↓
[main.ts] insertImprovedPrompt() → focus window → Ctrl+V
        ↓
[main.ts] restore clipboard + undo stack
```

---

## Concurrency & Timeouts

| Operation | Timeout | Mechanism |
|-----------|---------|-----------|
| Capture (helper) | 15s | `AbortController` + `Promise.race` |
| Clipboard wait | 2s | `Promise.race` + `setTimeout` |
| Ollama startup | 30s | Health check polling |
| API startup | 15s | Health check polling |
| Ollama model pull | 180s | `execFile` timeout |
| Ollama install | 180s | `execFile` timeout |
| Service shutdown | 5s grace | `SIGTERM` → `SIGKILL` |

---

## Concurrency Control

```typescript
let captureInProgress = false;
let analysisInProgress = false;
const captureController = new AbortController();

async function captureAndAnalyze() {
  if (captureInProgress) return;  // Ignore duplicate hotkey
  if (analysisInProgress) {       // Abort ongoing analysis
    modelAbortController?.abort();
    analysisSequence++;
    analysisInProgress = false;
  }
  captureInProgress = true;
  const captureController = new AbortController();
  const captureTimeout = setTimeout(() => captureController.abort(), 15000);
  
  try {
    const capture = await copySelectionAndCaptureWindow(sentinel, captureController.signal);
    // ...
  } catch (error) {
    if (error.name === 'AbortError') { /* handled */ }
  } finally {
    clearTimeout(captureTimeout);
    captureInProgress = false;
  }
}
```

---

## Auto-Updater

```typescript
import { autoUpdater } from 'electron-updater';

app.whenReady().then(async () => {
  initTelemetry();
  autoUpdater.checkForUpdatesAndNotify().catch(err => console.error('Update check failed:', err));
  // ...
});
```

**Configuration (`package.json`):**
```json
{
  "publish": { "provider": "github", "owner": "owner", "repo": "PromptClarity" },
  "win": { "target": ["nsis"] }
}
```

---

## Build & Packaging

```json
{
  "scripts": {
    "desktop:build": "node scripts/build.mjs",
    "package:desktop": "npm run build && electron-builder --win nsis"
  },
  "build": {
    "appId": "com.promptclarity.desktop",
    "productName": "PromptClarity",
    "asar": true,
    "asarUnpack": ["resources/**/*"],
    "files": ["dist/**/*", "resources/**/*", "package.json"],
    "win": { "target": ["nsis"], "icon": "assets/icon.png" },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "publish": { "provider": "github", "owner": "owner", "repo": "PromptClarity" }
  }
}
```

**Build Steps:**
1. `scripts/download-ollama.mjs` → Downloads `OllamaSetup.exe` from GitHub Releases
2. `scripts/build-api.mjs` → `npm run build` in `app/` → copies `.next/standalone` to `resources/api/api`
3. `scripts/build.mjs` → esbuild bundles `main.ts`, `preload.ts`, `renderer.ts`
4. `electron-builder --win nsis` → Creates `PromptClarity Setup 0.2.0.exe`

---

## Testing

```bash
# Unit tests
npm test                    # 324 tests, 22 files

# Type checking
npm run desktop:typecheck   # tsc --noEmit

# Linting
npm run lint                # ESLint on apps/desktop-app/src

# E2E (Playwright)
npm run test:e2e
```

---

## File Structure

```
PromptClarity/
├── apps/desktop-app/
│   ├── src/
│   │   ├── main.ts              # Electron main, tray, services
│   │   ├── renderer.ts          # React popup UI
│   │   ├── services.ts          # ServiceManager (Ollama + API)
│   │   ├── telemetry.ts         # Opt-in telemetry
│   │   ├── windows-helper.ps1   # Windows automation
│   │   ├── renderer/            # React popup components
│   │   └── preload.ts           # IPC bridge
│   ├── resources/
│   │   ├── ollama/ollama.exe    # Bundled Ollama binary
│   │   └── api/api/             # Standalone Next.js API
│   ├── scripts/
│   │   ├── build.mjs
│   │   ├── download-ollama.mjs
│   │   └── build-api.mjs
│   └── package.json
├── app/                          # Next.js API server
├── config/product.ts             # Model profiles, shortcuts
├── types/                        # TypeScript types
├── lib/                          # Shared logic (analyzer, rewriter, etc.)
├── tests/                        # Vitest tests
└── package.json                  # Root workspace
```

---

## Configuration

### `config/product.ts`
```typescript
export const PRODUCT = {
  name: 'PromptClarity',
  desktopName: 'PromptClarity Desktop',
  version: '0.2.0',
  apiUrl: 'http://127.0.0.1:3000/api/rewrite',
  defaultShortcut: 'CommandOrControl+Alt+P'
} as const;

export const MODEL_PROFILES: Record<PerformanceMode, ModelProfile> = {
  fast: { model: 'qwen2.5:0.5b', maxInputCharacters: 1_500, maxOutputTokens: 64, ... },
  balanced: { model: 'qwen2.5:1.5b', maxInputCharacters: 6_000, maxOutputTokens: 180, ... },
  quality: { model: 'qwen2.5:3b', maxInputCharacters: 12_000, maxOutputTokens: 320, ... }
};
```

### `types/settings.ts`
```typescript
export interface AppSettings {
  performanceMode: PerformanceMode;
  language: 'auto' | 'en' | 'pt-PT';
  autoOpen: boolean;
  keepModelsWarm: boolean;
  shortcut: string;
  historyEnabled: boolean;
  historyLimit: number;
  selectedModel?: string;
  hardwareDetected?: boolean;
  telemetryEnabled?: boolean;
  ollamaAutoInstall?: boolean;
}
```

---

## Security Considerations

- **No cloud communication** — All processing local
- **Code signing** — EV certificate required for production
- **Auto-updater** — HTTPS + signature verification via `electron-updater`
- **No PII in telemetry** — Crash reports exclude prompt text, clipboard, paths
- **Local-only API** — Binds to `127.0.0.1`, no external exposure
- **No cloud dependencies** — Ollama, models, API all local

---

## Troubleshooting Guide

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| Shortcut ignored | Another instance running | Close tray instances; check Settings → Shortcut |
| Model not downloading | No internet / disk full | Check network; Settings → Model → retry |
| Ollama won't start | Port 11434 busy / AV blocking | `netstat -ano | findstr 11434`; check AV exclusions |
| "Prompt not detected" | No selection / cursor not at end | Select text or place cursor at end; try `Ctrl+A` |
| Slow first rewrite | Model not warmed | Enable "Keep models in memory"; wait for warm-up |
| Model adds content | Validation failed | Falls back to conservative rewriter; check Diagnostics |

---

## Debugging

**Diagnostics Panel:** Tray → Diagnostics → Shows API/Ollama status, model, RAM, last rewrite.

**Logs:** Console output in terminal where `npm run desktop:dev` runs.

**Debug Helper:** `scripts/debug-ollama.mjs` lists GitHub release assets.

---

## Future Extensions

- **Mac/Linux builds** — Electron supports all platforms
- **Ollama auto-install** — Detect missing → silent install
- **Plugin system** — Custom rewrite rules, templates
- **Multi-language** — Portuguese support in analyzer
- **Telemetry dashboard** — Aggregate crash/usage stats