# Legacy VS Code MVP Guide

> Historical document. Use the root `README.md` for the current application.

## Overview

This guide walks you through setting up and testing the prompt enhancement MVP in VS Code.

## Prerequisites

- VS Code 1.90+
- Node.js 16+
- TypeScript knowledge (optional)

## Setup

### 1. Install Dependencies

```bash
cd path/to/grammarly-prompts-worktree
npm install
```

### 2. Compile the Extension

```bash
cd extension
npm run build
# or for development:
npm run watch
```

This compiles TypeScript to JavaScript in the `out/` folder.

### 3. Run Tests (Optional)

```bash
# From root directory
npm test -- promptDetector

# Or run all tests
npm test
```

## Testing in VS Code

### Option A: Extension Development Host

1. Open the root project folder in VS Code
2. Press `F5` to launch Extension Development Host
3. A new VS Code window opens with the extension loaded

### Option B: Manual Installation

1. Compile the extension (step 2 above)
2. Copy the `out/` folder to your VS Code extensions directory:
   - macOS: `~/.vscode/extensions/prompt-enhancement-0.1.0`
   - Linux: `~/.vscode/extensions/prompt-enhancement-0.1.0`
   - Windows: `%USERPROFILE%\.vscode\extensions\prompt-enhancement-0.1.0`
3. Restart VS Code

## Testing Scenarios

### Scenario 1: Automatic Hint

1. Open any file in VS Code
2. Type: "create a function that validates email addresses"
3. After 500ms, a status bar message appears: "💡 Looks like a prompt..."
4. Message disappears after 3 seconds

### Scenario 2: Manual Popup - Keybinding

1. Select the text: "explain how React hooks work"
2. Press **Cmd+Shift+E** (Mac) or **Ctrl+Shift+E** (Windows/Linux)
3. A webview panel appears on the right side showing:
   - Original: "explain how React hooks work"
   - Improved: [enhanced version from analyzer]
   - Confidence: XX% (e.g., "92% confident")
4. Click "📋 Copy Improved" button
5. Text is copied to clipboard
6. Paste it somewhere to verify

### Scenario 3: Manual Popup - Context Menu

1. Select text: "write a summary of machine learning"
2. Right-click and select "Enhance Prompt" from context menu
3. Same popup appears as in Scenario 2

### Scenario 4: False Positive Check

Type these and verify NO popup appears (even with Cmd+Shift+E):

```
sounds good to me
thanks for your help
see you later
have a good day
the weather is nice today
I totally agree with that
```

These should show no hint and no popup.

### Scenario 5: Edge Cases

Try these and observe detection behavior:

```
can you help me debug this error?
→ Should trigger popup

please fix this code for me
→ Should trigger popup

I need a TypeScript function that handles @mentions
→ Should trigger popup

how do you build a REST API?
→ May show hint (0.35 threshold)

what are some best practices?
→ Should NOT trigger popup (< 0.4 confidence)
```

## Command Palette Commands

1. Press **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows/Linux)
2. Type "Enhance Prompt"
3. Select either:
   - **Enhance Prompt** - Opens popup for selected text
   - **Analyze & Copy** - Analyzes last text and copies to clipboard

## Debugging

### View Console Logs

1. Press **Ctrl+Shift+J** (Windows/Linux) or **Cmd+Shift+J** (Mac)
2. Ensure "Extension Host" is selected in the dropdown
3. Look for logs from the extension:
   - `"Prompt Enhancement extension activated"`
   - Analysis results

### Check Confidence Score

To manually check the confidence score for a prompt:

```typescript
import { detectPrompt } from './lib/promptDetector';

const result = detectPrompt('your text here');
console.log('Confidence:', result.confidence); // 0-1
console.log('Is Prompt:', result.isPrompt);
console.log('Signals:', result.signals);
```

### Reset Extension State

If the popup gets stuck:

1. Close the webview panel
2. Run command palette: "Developer: Reload Window"
3. Extension reloads automatically

## Performance Notes

- Detection happens on every keystroke (debounced 500ms)
- Analysis only happens when popup is opened
- Webview creation is deferred until popup is manually requested
- Status bar messages auto-dismiss (3 seconds)

## Known Limitations in MVP

1. **English Only** - Detection tuned for English chat
2. **No Text Replacement** - Copy-paste workflow only
3. **Basic UI** - Minimal styling, no animations
4. **Single Use Case** - Always uses 'general' use case
5. **No History** - Previous analyses not saved

## Troubleshooting

### Extension doesn't activate

**Problem:** F5 doesn't launch Extension Development Host

**Solution:**

1. Check VS Code is at root of project
2. Check `.vscode/launch.json` exists
3. Try creating it manually with:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Extension",
         "type": "extensionHost",
         "request": "launch",
         "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
       }
     ]
   }
   ```

### Popup shows but doesn't improve text

**Problem:** Original and improved text look the same

**Solution:**

1. Check text is actually a prompt
2. Try a longer, more complex prompt
3. Check console for analyzer errors (F12 in Extension Host)

### Keybinding doesn't work

**Problem:** Cmd+Shift+E doesn't trigger popup

**Solution:**

1. Ensure text is selected
2. Check command palette for conflicts
3. Try context menu instead
4. Check `extension/package.json` for correct keybinding

### Tests fail

**Problem:** `npm test -- promptDetector` shows failures

**Solution:**

1. Check Node.js version (16+)
2. Ensure npm install completed successfully
3. Try `npm test` to run all tests
4. Check vitest output for specific failures

## Next Steps After Testing

1. **Try Different Prompts**
   - Code prompts: "create a sorting algorithm"
   - Writing prompts: "write a professional email"
   - Research prompts: "compare JavaScript vs TypeScript"

2. **Experiment with Settings**
   - In `promptDetector.ts`, adjust thresholds:
     - `shouldShowPopup`: 0.40 (try 0.35 for more popups)
     - `shouldShowHint`: 0.35 (try 0.30 for more hints)

3. **Review Code**
   - Read through `promptDetector.ts` to understand signal weighting
   - Check `extension.ts` for webview lifecycle
   - Review tests in `tests/promptDetector.test.ts` for coverage

4. **Plan Phase 2**
   - Note features you'd like to see
   - Think about edge cases to add to tests
   - Consider performance optimizations

## Support

For issues:

1. Check this guide's troubleshooting section
2. Review `IMPLEMENTATION.md` for architecture details
3. Check test files for usage examples
4. Look at console logs for errors

Happy testing! 🚀
