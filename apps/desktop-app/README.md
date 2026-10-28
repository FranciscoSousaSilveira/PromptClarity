# PromptClarity Desktop

Windows desktop companion for the existing PromptClarity browser extension. It improves selected text in VS Code, Notepad, terminals, browsers, and other desktop applications using the same local API and Ollama model.

No cloud service is used. Selected prompts are sent only to `http://127.0.0.1:3000/api/rewrite`.

## Requirements

- Windows 10 or 11
- Node.js and npm
- Ollama running locally
- The `qwen2.5:3b` Ollama model

## Install

First-time setup from the repository root:

```powershell
npm install
npm run model:pull
npm run desktop:install
```

You only need `desktop:install` once, or after desktop dependencies change.

## Run

From the repository root, use one command:

```powershell
npm run desktop
```

This checks Ollama, starts the local API when necessary, preloads the selected model, builds Electron, and leaves the helper in the Windows tray. The packaged application includes an embedded local bridge.

If a previous test version is already running, quit **PromptClarity Desktop** from the Windows tray before running the command.

### Quick test

1. Open Notepad and type `Explain quantum computing to a beginner`.
2. Leave the text cursor immediately after `beginner`; do not select anything.
3. Press `Ctrl+Alt+P` and wait for the popup.
4. The app selects the full prompt automatically. Press **Insert** to replace it with the improved version.

The desktop helper stays in the Windows system tray.

## Use

1. Either select a prompt, or place the text cursor at the end of it, in VS Code, Notepad, a browser, or another desktop app.
2. Press `Ctrl+Alt+P`.
3. Short prompts are corrected instantly; for longer prompts, wait while the preloaded local model improves the text.
4. Choose **Copy** to keep the result on the clipboard, or **Insert** to replace the selection in the original app.
5. Press `Esc` or use the close button to cancel. The previous clipboard is restored when cancelling or after insertion.

The popup shows the improved prompt first. Its local rule-based score and review are available under **View prompt review**.

## How it works

The Electron process uses a persistent Windows automation worker, avoiding a new PowerShell startup for every shortcut. It remembers the active window and clipboard, selects the current prompt, and restores the previous clipboard after Copy, Insert, or cancellation. The result can be edited, inserted, undone, and optionally saved to local history.

The renderer has no Node.js access. Clipboard, keyboard automation, and API work remain in the Electron main process and are exposed through a narrow preload bridge.

## Commands

```powershell
npm run desktop:build
npm run desktop:typecheck
npm run desktop:dev
```

## Troubleshooting

- **Local AI unavailable:** keep `npm run dev` running and confirm `ollama list` includes `qwen2.5:3b`.
- **No text selected:** select text before pressing `Ctrl+Alt+P`. Some terminal applications use a different selection/copy mode.
- **Shortcut does nothing:** another application may already use `Ctrl+Alt+P`. The tray app displays a Windows notification when registration fails.
- **Insert does not return to an elevated application:** run the desktop helper with the same Windows privilege level as the target app.
- **Old process is still running:** quit PromptClarity Desktop from its tray menu before starting it again.

The Chrome extension remains independent and continues to use its existing build and installation process.
