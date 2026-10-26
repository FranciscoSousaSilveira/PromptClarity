# PromptClarity — Installation Guide

## For End Users

### System Requirements

| Component | Minimum          | Recommended |
| --------- | ---------------- | ----------- |
| OS        | Windows 10 1909+ | Windows 11  |
| RAM       | 4 GB             | 8+ GB       |
| Disk      | 3 GB free        | 5 GB free   |
| CPU       | x64              | Modern x64  |

**No Ollama, Node.js, or Python pre-installed required** — everything bundles inside the installer.

---

### Installation

1. **Download** the latest `PromptClarity Setup 0.2.0.exe` from [GitHub Releases](https://github.com/yourusername/PromptClarity/releases)
2. **Run the installer** — click through the wizard (standard NSIS installer)
3. **Launch** PromptClarity from Start Menu or desktop shortcut
4. **First launch** — the app will:
   - Detect your RAM
   - Recommend the optimal model (Fast/Balanced/Quality)
   - Auto-download the model if not present
   - Show a tray icon in the system tray

---

### First Run

On first launch, you'll see a welcome dialog:

```
Welcome to PromptClarity!
We detected 8 GB of RAM on your computer.
We'll use the "Best quality" model (qwen2.5:3b) for the best experience.
Description: For 8 GB+ RAM computers

[Use this model]  [Choose another]
```

- **Use this model** — downloads the recommended model automatically
- **Choose another** — pick from already-installed Ollama models

The model downloads in the background (shows progress balloon). Once done, you're ready!

---

### Using PromptClarity

1. **Select text** in any application (Notepad, VS Code, browser, terminal)
2. **Press `Ctrl+Alt+P`** — the popup appears with the improved prompt
3. **Review** the improved prompt
4. Click **Insert** to replace the original text, or **Copy** to clipboard
5. **Undo** — click the tray icon → "Undo last insertion" to revert

---

### Settings (Right-click tray → Settings)

| Section         | Options                                                  |
| --------------- | -------------------------------------------------------- |
| **Model**       | Dropdown of installed models + Refresh/Re-detect buttons |
| **Performance** | Fast / Balanced / Quality                                |
| **Shortcut**    | Ctrl+Alt+P / Ctrl+Shift+P / Ctrl+Alt+G                   |
| **Privacy**     | Telemetry (opt-in), Ollama auto-install (default: on)    |
| **History**     | Enable/disable local history                             |

---

### Uninstalling

1. Open Windows Settings → Apps → Installed apps
2. Find "PromptClarity" → click ••• → Uninstall
3. This removes the app but **keeps** your Ollama models and settings in `%LOCALAPPDATA%\PromptClarity Desktop`

---

## For Developers (Building from Source)

### Prerequisites

- Node.js 20+
- Git
- Windows 10/11

### Setup

```powershell
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

### Build & Package

```powershell
# Build desktop app
npm run desktop:build

# Create NSIS installer
npm run package:desktop
# Output: release/desktop/PromptClarity Setup 0.2.0.exe
```

---

## Troubleshooting

| Issue                     | Solution                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| **Shortcut doesn't work** | Close other PromptClarity instances in tray; check Settings → Shortcut |
| **Model not downloading** | Check internet; retry in Settings → Model; verify disk space           |
| **Ollama won't start**    | Check port 11434 free; check antivirus; check Diagnostics              |
| **Slow first run**        | Enable "Keep models in memory" in Settings; wait for warm-up           |
| **"Prompt not detected"** | Select text or place cursor at end; try `Ctrl+A` then `Ctrl+Alt+P`     |

### Diagnostics

Open **Diagnostics** from tray menu or run:

```powershell
npm run diagnostics
```

Shows: API status, Ollama status, model, RAM, last rewrite status.

---

## Uninstalling

1. Open Windows Settings → Apps → Installed apps
2. Find "PromptClarity" → click ••• → Uninstall
3. This removes the app but **keeps** your Ollama models and settings in `%LOCALAPPDATA%\PromptClarity Desktop`

To fully remove everything:

```powershell
# Remove Ollama (if you don't use it elsewhere)
winget uninstall Ollama.Ollama

# Remove settings
Remove-Item "$env:LOCALAPPDATA\PromptClarity Desktop" -Recurse -Force
```
