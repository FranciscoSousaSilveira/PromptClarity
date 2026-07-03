# Prompt Grammarly for Chrome

The extension reviews prompt drafts directly inside supported AI chat apps. It corrects spelling, grammar, punctuation, and clarity without adding new instructions or content.

Rewriting is local and always uses Ollama when available. Fast, Balanced, and Quality select progressively more capable local models. When no correction is needed, the popup shows a green checkmark. The corrected prompt remains editable before Copy or Insert, and Insert supports Undo.

## Local AI setup

1. Install [Ollama](https://ollama.com/download) for your operating system.
2. From the repository root, run `npm run model:pull` once. This downloads Qwen 3B, used by all modes with different context and output limits.
3. Run `npm run dev` and leave that terminal open while using the extension. This starts the local bridge at `http://127.0.0.1:3000/api/rewrite`.
4. Build and reload the Chrome extension as described below.

You can check the bridge by opening `http://127.0.0.1:3000/api/rewrite`. A successful response reports whether Ollama and the configured model are available.

The app warms only the selected model. Model memory can be disabled from settings when RAM usage matters more than latency.

To favor quality over speed, start the app with `OLLAMA_MODEL=qwen2.5:3b`. You can use any other Ollama model in the same way, and change the Ollama server address with `OLLAMA_URL`.

## Install locally

1. From the repository root, run `npm run build:chrome`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the `chrome-extension` folder.
5. Refresh an existing AI chat tab.

After rebuilding the extension, click **Reload** on its card in `chrome://extensions` and refresh every already-open AI chat tab. Existing tabs keep the previous content script until they are refreshed.

## Use

1. Start writing in the message field.
2. Pause for about one second. A suggestion opens automatically when the draft looks like a prompt.
3. Choose **Insert Prompt** to replace the draft or **Copy** to keep both versions.
4. Disable **Auto-open suggestions** in the card if you prefer to open it manually from the floating button.

Supported sites include ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, DeepSeek, Grok, Mistral, Poe, and Meta AI.

## Troubleshooting

- If the floating icon disappears or a chat site changes its editor, rebuild, reload the extension, and refresh the chat tab. Site-specific selectors live in `src/siteAdapters.ts`.
- If no icon appears, focus the message composer and type at least a short instruction such as `Explain this in three bullets`.
- If the card says that the model did not respond, run `ollama serve`, confirm that the three models listed above appear in `ollama list`, and keep `npm run dev` running. Use **Try again** after restoring the connection.
