---
name: enhance-prompt
description: >
  Use this skill when the user asks to enhance, improve, analyze, score, review,
  or rewrite an AI prompt. Also use when the user says their prompt is vague,
  weak, or not getting good results, or when they paste a prompt and ask
  "how can I make this better?"
---

# Prompt Enhancement Skill

## Goal
Analyze a user-provided AI prompt for quality across 8 dimensions (clarity,
context, goal, constraints, output format, examples, audience, success criteria),
then generate a structured, improved version ready to copy-paste.

## When to use
- User explicitly asks to "enhance", "improve", "rewrite", or "optimize" a prompt
- User asks to "analyze" or "score" a prompt's quality
- User pastes a prompt and asks why it isn't working well
- User asks for help writing a better prompt for a specific use case
- User says their prompt is "vague", "weak", or "not specific enough"

## Procedures

### 1. Identify the prompt text
- If the user selected text in the editor, use that.
- If the user pasted a prompt in the chat, extract it.
- If the user referenced a file, read the prompt from the file.
- Ask the user to provide the prompt if none is obvious.

### 2. Identify the use case (optional)
The analysis engine supports these use cases:
- `general` (default)
- `coding` — debugging, implementation, code review
- `writing` — drafts, editing, tone control
- `studying` — explanations, practice prompts
- `research` — comparisons, evidence, synthesis
- `business` — emails, strategy, decision support
- `imageGeneration` — visual prompts for image models

Infer the use case from the prompt content. If ambiguous, default to `general`.

### 3. Run the analysis
Execute the CLI script from the workspace root. Since Node.js might not be in the default PATH of the terminal sandbox on Windows, you should prepend `C:\Program Files\nodejs` to the PATH.

On Windows PowerShell:
```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
node .agents/plugins/prompt-enhancement/scripts/analyze-prompt.js --prompt "<THE_PROMPT_TEXT>" --useCase <USE_CASE>
```

Or using `cmd /c`:
```cmd
cmd /c "set PATH=C:\Program Files\nodejs;%PATH% && node .agents/plugins/prompt-enhancement/scripts/analyze-prompt.js --prompt \"<THE_PROMPT_TEXT>\" --useCase <USE_CASE>"
```

If the prompt contains quotes, newlines or special characters, pipe it via stdin instead:
```cmd
cmd /c "set PATH=C:\Program Files\nodejs;%PATH% && echo <THE_PROMPT_TEXT> | node .agents/plugins/prompt-enhancement/scripts/analyze-prompt.js --stdin --useCase <USE_CASE>"
```

The script outputs JSON to stdout.

### 4. Present the results
Format the output for the user with these sections:

#### Score Overview
Show the overall score (0–100), label (Weak/Decent/Strong/Excellent), and a
one-line summary.

#### Category Breakdown
Show scores for each of the 8 categories as a table:
| Category | Score |
|----------|-------|
| Clarity  | 72    |
| ...      | ...   |

#### Issues Found
List each issue with severity, title, and suggestion. Use callout blocks:
- 🔴 High severity
- 🟡 Medium severity
- 🟢 Low severity

#### Strengths
Bullet list of what the prompt already does well.

#### Improved Prompt
Show the rewritten prompt in a fenced code block so the user can easily copy it.
Always show both the **original** and the **improved** version for comparison.

### 5. Offer next steps
- Ask if the user wants to adjust the use case and re-analyze
- Offer to copy the improved prompt to clipboard
- Suggest specific edits if the score is below 70

## Constraints
- Do NOT modify the user's files without explicit permission
- Always show the original prompt alongside the improved version
- If the analysis script fails, fall back to manual analysis using the same
  8-category framework described above
- Keep the presentation concise — don't dump raw JSON on the user

## Examples

### Example 1: Simple enhancement request
**User:** "Enhance this prompt: explain react hooks"

**Agent:**
1. Extracts prompt: "explain react hooks"
2. Infers use case: `coding`
3. Runs: `node .agents/plugins/prompt-enhancement/scripts/analyze-prompt.js --prompt "explain react hooks" --useCase coding`
4. Presents score (e.g., 38/100 — Weak), issues (vague task, no context, no format), and the rewritten prompt

### Example 2: User pastes a long prompt
**User:** "Score this prompt and tell me what's wrong: Write a Python function that takes a list of numbers and returns the sorted unique values without using built-in sort"

**Agent:**
1. Extracts the full prompt
2. Infers use case: `coding`
3. Runs analysis
4. Presents score (e.g., 68/100 — Decent), notes that constraints are well-specified but audience and examples are missing, shows rewritten version
