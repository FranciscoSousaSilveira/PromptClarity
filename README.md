# Prompt Grammarly

Prompt Grammarly improves prompts before they are sent to an AI assistant. It runs locally with Ollama and is available as a Chrome extension, Windows desktop app, VS Code extension, and web interface.

See [APP_GUIDE.md](APP_GUIDE.md) for the complete desktop and extension guide (excluding the web interface).

## Quick start

```powershell
npm install
npm run model:pull
npm run desktop:install
npm run desktop
```

The desktop app starts the local API on `127.0.0.1`, warms the selected model, and remains in the Windows system tray. Place the text cursor at the end of a prompt and press `Ctrl+Alt+P`.

## Performance modes

- **Fast:** Qwen 3B with a smaller context and output limit.
- **Balanced:** Qwen 3B with more context for longer prompts.
- **Quality:** Qwen 3B with a larger context and longer processing time.

Settings, shortcut, model memory, history, Undo, diagnostics, and performance mode are available from the desktop tray menu.

## Development

```powershell
npm run lint
npm run test:coverage
npm run build
npm run build:chrome
npm run build:vscode
npm run desktop:typecheck
npm run test:e2e
```

## Packaging

```powershell
npm run package:chrome
npm run package:vscode
npm run package:desktop
```

Artifacts are written to `release/`. The packaged desktop app includes its own local bridge and only requires Ollama and the selected model.

## Diagnostics

Run `npm run diagnostics`, or choose **Diagnostics** from the desktop tray menu. Run `npm run benchmark:models` to compare installed Ollama models against the real prompt corpus.

See [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), and the platform-specific READMEs for details.
