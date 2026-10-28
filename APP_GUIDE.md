# PromptClarity — Application Guide

This document describes the PromptClarity desktop application, the Chrome extension, the VS Code extension, the local API, and the Ollama model. The web interface is not part of this guide.

## What the Application Does

PromptClarity reviews a prompt before it is sent to an AI assistant. It acts as a conservative copy editor:

- Corrects spelling, grammar, punctuation, and unclear phrasing
- Preserves the intent, facts, uncertainty, language, and level of detail
- Does not answer the prompt
- Does not add requirements, sources, formats, examples, context, or recommendations
- Returns the prompt unchanged when it is already clear
- Shows a checkmark when the model confirms no changes are needed

If the model produces a response, refusal, incomplete text, or semantically different content, that output is rejected. The application then uses a conservative local fallback that never expands the prompt.

## Components

### Desktop Application

Located in `apps/desktop-app/` and built with Electron + TypeScript.

1. The user selects a prompt, or places the text cursor at the end of it
2. Presses `Ctrl+Alt+P`
3. The Windows helper copies the text from the active application
4. The prompt is sent only to `127.0.0.1`
5. The popup shows the corrected version or a confirmation checkmark
6. **Copy** copies the result; **Insert** replaces the text in the original application
7. **Undo** restores the previous version when available

The application stays in the system tray. The menu allows changing performance mode, shortcut, local history, model warm-up, and opening diagnostics.

**New in 0.2.0:**

- **Bundled Ollama** — No separate installation required; Ollama is bundled and auto-starts
- **Auto model selection** — On first launch, detects RAM and recommends optimal model (Fast/Balanced/Quality)
- **Auto Ollama install** — If Ollama is missing, offers to download and install silently (opt-out in Settings)
- **Model selector** — Settings panel shows dropdown of installed models with descriptions
- **Re-detect hardware** — Re-run RAM detection and update model recommendation
- **Telemetry (opt-in)** — Anonymous crash reports + usage stats (disabled by default)

### Chrome Extension

Located in `chrome-extension/` and injected into supported composers, including ChatGPT, Gemini, Claude, Copilot, Perplexity, DeepSeek, Grok, Mistral, Poe, and Meta AI.

- Shows a bubble next to the composer
- Opens a popup on click or, when enabled, after a pause in typing
- Keeps the corrected prompt editable
- Provides **Copy**, **Insert Prompt**, and **Undo**
- Detects `textarea`, `input`, and `contenteditable` fields via site adapters
- Distinguishes new conversations from conversations with prior messages without inventing context
- Saves settings and, optionally, a limited history in Chrome's local storage
- Handles extension reloads without throwing `Extension context invalidated` errors

When the prompt is already good, the popup shows a green checkmark, keeps the original text, and indicates no changes were needed.

### VS Code Extension

Located in `extension/`.

- Analyzes selected text in the editor
- Uses the same shared logic and local API
- Allows copying or inserting the revised version
- Provides Fast, Balanced, and Quality modes in VS Code settings

### API and Local Model

The main route is in `app/api/rewrite/route.ts` and listens on:

```text
http://127.0.0.1:3000/api/rewrite
```

The API communicates with Ollama at `127.0.0.1:11434`. No prompt is sent to any cloud service.

The system prompt forces the model to act only as a copy editor. Validation in `lib/modelPromptRewriter.ts` confirms that the output:

- Continues to represent the original text
- Does not introduce excessive new concepts
- Is not a response, refusal, or comment on the prompt
- Does not terminate mid-way
- Does not grow disproportionately

Invalid responses are not cached.

## Performance Modes

- **Fast:** `qwen2.5:0.5b`; reduced context and output for lowest latency
- **Balanced:** `qwen2.5:1.5b`; more context for longer prompts
- **Quality:** `qwen2.5:3b`; maximum context and output limits

Models can remain in memory to reduce first-rewrite latency. The application pre-warms the selected mode automatically.

**Auto-selection on first run:** Detects system RAM and recommends optimal model:

- 8+ GB → `qwen2.5:3b` (Quality)
- 6 GB → `qwen2.5:1.5b` (Balanced)
- 4 GB → `qwen2.5:0.5b` (Fast)

## Installation and Execution

### Prerequisites

- Windows 10 or 11 for desktop automation
- **No Ollama, Node.js, or Python pre-installation required** — everything bundles inside the installer

### Installer (Recommended)

Download `PromptClarity Setup 0.2.0.exe` from GitHub Releases and run the installer.

### From Source

```powershell
# At repository root:
npm install
npm run desktop:build
npm run package:desktop
# Output: release/desktop/PromptClarity Setup 0.2.0.exe
```

### Development Mode

```powershell
npm run desktop:dev
```

This builds the app and starts it with hot reload for the renderer.

---

## Testing the Chrome Extension

```powershell
npm run dev
npm run build:chrome
```

Then:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Choose **Load unpacked**
4. Select the `chrome-extension/` folder
5. Refresh chat tabs that were already open

Whenever the extension is rebuilt, use **Reload** in `chrome://extensions` and refresh the chat tab.

---

## Testing and Quality

```powershell
npm test
npm run test:e2e
npm run lint
npm run format:check
npm run build:chrome
npm run build:vscode
npm run desktop:typecheck
```

E2E tests cover normal fields, `contenteditable`, local fallback, insertion, Chrome context invalidation, and checkmark state.

## Packaging

```powershell
npm run package:chrome
npm run package:vscode
npm run package:desktop
```

Artifacts are placed in `release/`. The desktop packager automatically picks a temporary drive with sufficient space.

## Privacy and Storage

- Prompts are processed locally
- The API accepts only local clients and supported origins
- History can be disabled
- Desktop settings live in the app's local app data profile
- Chrome settings live in `chrome.storage.local`
- No cloud API keys are used

See also `PRIVACY.md` and `SECURITY.md`.

## Key Files

- `chrome-extension/src/content.ts`: Detection, analysis, and insertion in the browser
- `chrome-extension/src/ui.ts`: Popup and checkmark for the extension
- `chrome-extension/src/siteAdapters.ts`: Per-chat-platform integration
- `apps/desktop-app/src/main.ts`: Shortcuts, clipboard, popup, tray
- `apps/desktop-app/src/windows-helper.ps1`: Windows capture and insertion
- `lib/promptAnalyzer.ts`: Local prompt evaluation
- `lib/promptRewriter.ts`: Conservative fallback without semantic expansion
- `lib/modelPromptRewriter.ts`: Model call and validation
- `app/api/rewrite/route.ts`: Local API and Ollama communication
- `config/product.ts`: Models, modes, and shared configuration

## Troubleshooting

**Model does not respond:** Confirm Ollama is running, run `npm run model:pull`, restart with `npm run dev` or `npm run desktop`.

**Extension uses old code:** Use **Reload** in `chrome://extensions` and refresh the chat tab.

**Shortcut does nothing:** Close old tray instances or pick another shortcut in Settings.

**First rewrite is slow:** Keep **Keep models in memory** enabled and wait for warm-up to finish.

**Model adds content:** Output is rejected by validation and replaced with conservative fallback. Save the prompt and output as a regression test if this recurs.

---

## New in 0.2.0 (PromptClarity)

- **Rebranded** from PromptClarity to PromptClarity
- **Standalone installer** — no prerequisites required
- **Bundled Ollama** — auto-starts with the app
- **Auto model selection** based on detected RAM
- **Auto Ollama install** if missing (opt-out in Settings)
- **Model selector** in Settings with descriptions
- **Re-detect hardware** button to re-run RAM detection
- **Telemetry opt-in** (crash reports + usage stats, disabled by default)
- **Auto-updater** via GitHub Releases
- **Code signing** support for EV certificates
- **GitHub Actions** release pipeline
