# PromptClarity

**PromptClarity** improves prompts before they reach an AI assistant — running entirely locally with zero cloud dependencies.

## What It Does

Select any text in any application (Notepad, VS Code, browser, terminal), press **`Ctrl+Alt+P`**, and PromptClarity rewrites your prompt for clarity, grammar, and precision — all running 100% locally on your machine.

- **No cloud APIs** — your prompts never leave your machine
- **Works everywhere** — Notepad, VS Code, browsers, terminals, any text field
- **One hotkey** — `Ctrl+Alt+P` captures, improves, and optionally inserts
- **Auto model selection** — Detects your RAM and picks the optimal model
- **Bundled Ollama** — No separate installation required

---

## Quick Start

```powershell
# Download and run the installer
# Or build from source:
npm install
npm run desktop:build
npm run package:desktop
```

**First launch:** Detects your RAM → recommends optimal model → auto-downloads if needed → tray icon appears.

**Use it:** Select text anywhere → press `Ctrl+Alt+P` → review → click **Insert**.

---

## What It Does

| Feature | Description |
|---------|-------------|
| **Grammar & spelling** | Fixes typos, punctuation, unclear phrasing |
| **Clarity** | Removes ambiguity, tightens wording |
| **Preserves intent** | Never adds requirements, examples, or changes meaning |
| **Checkmark** | Shows ✓ when prompt already clear |
| **Undo** | One-click revert to original |
| **History** | Optional local history (opt-in) |

---

## Performance Modes

| Mode | Model | Best For |
|------|-------|----------|
| **Fast** | `qwen2.5:0.5b` | 4 GB RAM, quick edits |
| **Balanced** | `qwen2.5:1.5b` | 6 GB RAM, general use |
| **Quality** | `qwen2.5:3b` | 8+ GB RAM, complex prompts |

Auto-selected on first run based on your RAM. Change anytime in Settings.

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10 1909+ | Windows 11 |
| RAM | 4 GB | 8+ GB |
| Disk | 3 GB free | 5 GB free |
| CPU | x64 | Modern x64 |

**No Ollama, Node.js, or Python pre-installed required** — everything bundles inside the installer.

---

## Quick Start

```powershell
# 1. Download installer from GitHub Releases
# 2. Run installer → click through wizard
# 3. First launch: auto-detects RAM → recommends model → downloads if needed
# 4. Select text anywhere → Ctrl+Alt+P → review → Insert
```

**Tray menu** (right-click tray icon):
- **Improve current prompt** — `Ctrl+Alt+P`
- **Undo last insertion**
- **Performance mode** — Fast / Balanced / Quality
- **Settings** — Model, shortcut, telemetry, Ollama auto-install
- **History** — View past improvements
- **Diagnostics** — System health check

---

## Development

```powershell
# Install deps
npm install

# Build desktop app
npm run desktop:build

# Run in dev mode (with hot reload)
npm run desktop:dev

# Run tests
npm test

# Type check
npm run desktop:typecheck

# Lint
npm run lint
```

### Build & Package

```powershell
# Build desktop app
npm run desktop:build

# Package installer (NSIS)
npm run package:desktop
```

Artifacts in `release/desktop/`.

---

## Architecture

```
PromptClarity.exe (Electron)
├── Bundled Ollama (ollama.exe)     → localhost:11434
├── Bundled API Server (Node.js)    → localhost:3000
├── Windows Automation (UIA + SendKeys)
└── Tray + Popup UI (React)
```

- **Zero cloud** — All processing local
- **Bundled Ollama** — No separate install needed
- **Bundled API** — Standalone Next.js server compiled to single executable
- **Service Manager** — Starts/stops Ollama + API, health checks, graceful shutdown
- **AbortController** — 15s capture timeout, 2s clipboard timeout

---

## Privacy

- **No cloud** — All processing local
- **No telemetry by default** — Opt-in only in Settings → Privacy
- **Telemetry (opt-in)**: Anonymous crash reports + usage events (`app_start`, `capture_success`)
- **Never logged**: Prompt text, clipboard content, file paths
- **No accounts, no tracking, no cloud**

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10 1909+ | Windows 11 |
| RAM | 4 GB | 8+ GB |
| Disk | 3 GB free | 5 GB free |
| CPU | x64 | Modern x64 |

---

## Building from Source

```powershell
# Prerequisites
- Node.js 20+
- Git
- Windows 10/11

# Setup
git clone https://github.com/yourusername/PromptClarity
cd PromptClarity
npm install

# Build everything
npm run desktop:build

# Run tests
npm test
npm run desktop:typecheck
npm run lint
```

### Project Structure

```
PromptClarity/
├── apps/desktop-app/          # Electron app
│   ├── src/
│   │   ├── main.ts            # Electron main, tray, services
│   │   ├── renderer.ts        # React popup UI
│   │   ├── services.ts        # Service manager (Ollama + API)
│   │   ├── telemetry.ts       # Opt-in telemetry
│   │   ├── windows-helper.ps1 # Windows automation
│   │   └── renderer/          # React popup UI
│   ├── resources/
│   │   ├── ollama/ollama.exe      # Bundled Ollama
│   │   └── api/api/               # Bundled API server
│   └── scripts/
│       ├── build.mjs
│       ├── download-ollama.mjs
│       └── build-api.mjs
├── app/                       # Next.js API server
├── config/product.ts          # Model profiles, shortcuts
├── types/                     # TypeScript types
└── lib/                       # Shared logic
```

---

## Packaging & Distribution

```powershell
# Create NSIS installer
npm run package:desktop
# Output: release/desktop/PromptClarity Setup 0.2.0.exe
```

### GitHub Actions (Auto-release)

```yaml
# .github/workflows/release.yml
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run desktop:build
      - run: npm --prefix apps/desktop-app run package
      - uses: softprops/action-gh-release@v1
        with:
          files: release/desktop/PromptClarity Setup *.exe
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Shortcut doesn't work** | Close other PromptClarity instances in tray; check Settings → Shortcut |
| **Model not downloading** | Check internet; retry in Settings → Model; verify disk space |
| **Ollama won't start** | Check port 11434 free; check antivirus; check Diagnostics |
| **Slow first run** | Enable "Keep models in memory" in Settings; wait for warm-up |
| **"Prompt not detected"** | Select text or place cursor at end; try `Ctrl+A` then `Ctrl+Alt+P` |

### Diagnostics

Open **Diagnostics** from tray menu or run:
```powershell
npm run diagnostics
```

Shows: API status, Ollama status, model, RAM, last rewrite status.

---

## License

MIT — see `LICENSE.md`.

---

## Contributing

1. Fork → branch → PR
2. `npm run lint && npm test && npm run desktop:typecheck`
3. PR with description of changes

---

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

## Privacy

See [PRIVACY.md](PRIVACY.md). TL;DR: **Zero cloud, opt-in telemetry only, no prompt data ever leaves your machine.**