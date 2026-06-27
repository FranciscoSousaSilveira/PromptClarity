# Prompt Grammarly for Chrome

The extension reviews prompt drafts directly inside supported AI chat apps. After you pause typing, it opens a local suggestion card with a score, focused feedback, and a structured rewrite.

Nothing is sent to an external API. The draft stays in the current browser tab and is processed by the bundled deterministic rules.

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

- If the floating icon disappears, Gemini inserts only the first line, or a result is enhanced twice, confirm that the extension shows version `1.1.5`, reload it, and refresh the Gemini/ChatGPT tab.
- If no icon appears, focus the message composer and type at least a short instruction such as `Explain this in three bullets`.
