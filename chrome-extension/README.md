# Prompt Grammarly for Chrome

The extension reviews prompt drafts directly inside supported AI chat apps. After you pause typing, it opens a suggestion card with a score, focused feedback, and a natural ready-to-send rewrite.

Rewriting is performed by a local open-source model through Ollama. The prompt is sent only to the local Next.js service on your computer, which forwards it to local Ollama. If either service is unavailable, the bundled deterministic rules take over automatically.

## Local AI setup

1. Install [Ollama](https://ollama.com/download) for your operating system.
2. From the repository root, run `npm run model:pull` once. This downloads `qwen2.5:3b` (roughly 2 GB).
3. Run `npm run dev` and leave that terminal open while using the extension. This starts the local bridge at `http://127.0.0.1:3000/api/rewrite`.
4. Build and reload the Chrome extension as described below.

You can check the bridge by opening `http://127.0.0.1:3000/api/rewrite`. A successful response reports whether Ollama and the configured model are available.

To use another Ollama model, start the app with `OLLAMA_MODEL` set to its Ollama name. You can also change the Ollama server address with `OLLAMA_URL`.

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

- If the floating icon disappears, Gemini inserts only the first line, or a result is enhanced twice, confirm that the extension shows version `1.2.0`, reload it, and refresh the Gemini/ChatGPT tab.
- If no icon appears, focus the message composer and type at least a short instruction such as `Explain this in three bullets`.
- If the card says **Local AI offline**, run `ollama serve`, confirm that `qwen2.5:3b` appears in `ollama list`, and keep `npm run dev` running. The rules fallback remains usable while you fix the connection.
