# Legacy Implementation Guide

> Historical MVP document. Use the root `README.md` for the current architecture.

## Overview

This is the MVP implementation of a Grammarly-like prompt enhancement system for VS Code. It detects when users are writing prompts in the VS Code Chat and offers an improved version via a popup that supports copy-paste workflow.

## Architecture

### Core Components

#### 1. **Prompt Detection** (`lib/promptDetector.ts`)

- Detects if text looks like a prompt (AI instruction/request)
- Confidence scoring (0-1) based on multiple signals:
  - Action verbs (explain, create, write, etc.)
  - Constraint language (must, should, without, etc.)
  - Format requests (bullet, table, json, etc.)
  - Context indicators (because, background, etc.)
  - Goal language (want, need, trying, etc.)
  - Imperative form (starts with verb, "can you", "could you", etc.)
  - Length heuristics (15-500 characters)
  - Question marks or colons

**Key Functions:**

- `detectPrompt(text)` → DetectionResult with confidence & signals
- `shouldShowPopup(confidence)` → boolean (threshold: 0.40)
- `shouldShowHint(text)` → boolean (threshold: 0.35, for hints)

**Philosophy:**

- Low false positive rate (normal chat doesn't trigger popup)
- Confidence-based UI response (can show hints at 0.35, full popup at 0.40)
- Modular signal weighting for easy tuning

#### 2. **Prompt Integration** (`lib/promptIntegration.ts`)

- Main entry point combining detection + analysis
- Handles error cases gracefully
- Returns structured PopupContent with:
  - Whether text is a prompt
  - Detection confidence
  - Full analysis (if analysis succeeds)
  - Copyable improved text

**Key Functions:**

- `analyzeForPopup(request)` → PopupContent
- `getPopupContent(text, useCase)` → string | null
- `shouldShowHint(text)` → boolean
- `getConfidenceScore(text)` → number (0-100)

#### 3. **VS Code Extension** (`extension/extension.ts`)

- Main activation point for the VS Code extension
- Manages popup lifecycle and UI state
- Commands:
  - `prompt-enhancement.togglePopup` - Manual activation (Cmd+Shift+E)
  - `prompt-enhancement.analyzeAndCopy` - Direct copy-to-clipboard

**Features:**

- Manual popup toggle via keybinding or context menu
- Automatic hinting (status bar message when prompt detected)
- Copy-to-clipboard workflow (no text replacement in MVP)
- Debounced analysis for performance
- Webview panel with side-by-side comparison

#### 4. **Tests** (`tests/promptDetector.test.ts`)

- 40+ test cases covering:
  - Clear prompts with action verbs
  - Format requests
  - Constraints
  - Imperative forms
  - False positive avoidance (normal chat, casual statements)
  - Edge cases (URLs, code snippets, special characters)

## Data Flow

```
User types in VS Code Chat
         ↓
[Extension detects on text change - debounced 500ms]
         ↓
detectPrompt() → confidence score
         ↓
├─ confidence < 0.35: No hint
├─ 0.35 ≤ confidence < 0.40: Optional hint (status bar)
└─ confidence ≥ 0.40: Full popup available
         ↓
User selects text + Cmd+Shift+E (or context menu)
         ↓
showPopup() triggers:
  - analyzeForPopup()
  - Generates improved version
  - Shows webview with original vs improved
         ↓
User clicks "Copy Improved" button
         ↓
Improved prompt → clipboard
```

## Key Design Decisions

### 1. Detection-First Architecture

- Prompt detection is lightweight and always runs
- Expensive analysis only happens when popup is shown
- Confidence scoring guides UI decisions (hints vs full popup)

### 2. Copy-First, Not Replace

- MVP focuses on copy-paste workflow
- No automatic text replacement (safer for MVP)
- Users explicitly choose to use improved version

### 3. Local Analysis

- All analysis runs locally (no API calls)
- Deterministic results (same input = same output)
- Works offline

### 4. Chat Context Optimization

- Detection tuned for shorter, chat-style prompts
- Emphasis on action verbs + constraints
- Lower bar for chat-style instructions vs full essays

### 5. False Positive Avoidance

- Threshold of 0.40 confidence required for popup
- Multiple signal types must align
- Normal chat text scores < 0.4 in most cases

## Configuration & Customization

### Detection Thresholds

In `promptDetector.ts`:

- `shouldShowPopup(confidence)`: requires 0.40 (adjust for sensitivity)
- `shouldShowHint(text)`: uses 0.35 threshold (for status bar hints)

### Action Verbs & Signal Weights

In `promptDetector.ts`:

- Modify `ACTION_VERBS` to add/remove detection patterns
- Adjust signal weights (currently: action_verb=0.25, format=0.20, etc.)

### Chat vs Essay Distinction

In `promptDetector.ts`:

- Length heuristic: 15-500 chars (adjust for different contexts)
- Longer texts are deprioritized (prevents essays from triggering)

## Testing the MVP

### Unit Tests

```bash
npm test -- promptDetector
```

Covers:

- Prompt detection accuracy
- False positive avoidance
- Confidence scoring
- Signal combinations

### Manual Integration Testing

1. Open VS Code with extension installed
2. Open Command Palette (Cmd+Shift+P)
3. Type "Enhance Prompt"
4. Select text (e.g., "create a function that validates emails")
5. Run command or use Cmd+Shift+E
6. Popup appears with original vs improved version
7. Click "Copy Improved" to copy to clipboard
8. Paste in VS Code Chat

### False Positive Testing

Type normal chat text to confirm popup doesn't appear:

- "sounds good to me" → no popup
- "thanks for your help" → no popup
- "see you later" → no popup
- "have a good day" → no popup

## Next Steps

### Phase 2 (Optional)

1. **UI Polish**
   - Add keyboard shortcuts for copy/close
   - Show confidence score with visual indicator
   - Keyboard navigation in popup

2. **Smarter Analysis**
   - Detect use case automatically (coding vs writing vs research)
   - Different enhancement strategies per use case
   - Show analysis details (strengths, gaps, issues)

3. **Scope Expansion**
   - Multi-language support (Portuguese already supported in analyzer)
   - Custom prompt templates
   - History/favorites system

4. **Performance**
   - Cache analysis results
   - Lazy-load analyzer module
   - Web Worker for background analysis

## File Structure

```
├── lib/
│   ├── promptDetector.ts         [NEW] Detection logic
│   ├── promptIntegration.ts      [NEW] Detection + analysis bridge
│   ├── promptAnalyzer.ts         [EXISTING] Full analysis
│   ├── promptRewriter.ts         [EXISTING] Improvement generation
│   ├── promptEnhancer.ts         [EXISTING] Quality enhancement
│   └── spellChecker.ts           [EXISTING] Spell checking
├── extension/
│   ├── extension.ts              [NEW] Main VS Code extension
│   ├── package.json              [NEW] Extension manifest
│   ├── tsconfig.json             [NEW] TypeScript config
│   └── .vscodeignore             [NEW] Packaging rules
├── types/
│   └── prompt.ts                 [EXISTING] Type definitions
├── tests/
│   ├── promptDetector.test.ts    [NEW] Detection tests
│   └── [existing test files]     [EXISTING] Other tests
├── app/                          [EXISTING] Next.js web playground
└── components/                   [EXISTING] React components
```

## Dependencies

### Required (in VS Code extension context)

- `vscode` - VS Code API (provided by runtime)
- TypeScript 5.3+

### Local libraries

- Existing analyzer, rewriter, enhancer modules
- No external dependencies for core MVP

## Known Limitations

1. **Detection Quality**
   - May miss some edge cases of prompt-like text
   - Might trigger on some narrative text > 500 chars
   - Language-specific (optimized for English chat)

2. **Analysis**
   - Uses existing analyzer (not chat-optimized)
   - May suggest improvements for non-prompts if detection fails
   - Portuguese support in analyzer, but English-centric in extension

3. **UI**
   - Popup not themeable yet (uses VS Code theme variables)
   - No progress indicator for analysis
   - No error messages for failed analysis

## Troubleshooting

### Popup doesn't appear

1. Check text meets minimum length (15+ chars)
2. Confirm text has action verb or format request
3. Verify confidence score: `getConfidenceScore(text)`
4. Check that confidence ≥ 0.40

### Popup shows for normal chat

1. Reduce threshold in `promptDetector.ts`
2. Review signal weights (check if context or goal signals are too loose)
3. Add false positive examples to test suite

### Analysis fails silently

1. Check console for errors (F1 > "Developer: Toggle Developer Tools")
2. Verify analyzer module is loaded
3. Check text length and format

## Contact & Support

For issues, feature requests, or questions:

- Open issue on GitHub
- Check test cases for example usage
- Review signal definitions in promptDetector.ts
