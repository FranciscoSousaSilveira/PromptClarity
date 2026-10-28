#!/usr/bin/env node
/**
 * CLI wrapper for the Prompt Enhancement analysis engine.
 * Designed to be invoked by the Antigravity agent via the terminal.
 *
 * Usage:
 *   node .agents/plugins/prompt-enhancement/scripts/analyze-prompt.js --prompt "your prompt text" [--useCase coding]
 *
 * Output: JSON to stdout
 */

const path = require('path');
const fs = require('fs');

// Resolve project root dynamically by searching for a directory containing lib/promptAnalyzer.js
let projectRoot = '';
const possibleRoots = [
  path.resolve(__dirname, '..', '..', '..', '..'), // if inside PromptClarity/.agents/
  path.resolve(__dirname, '..', '..', '..', '..', 'PromptClarity'), // if inside workspace-root/.agents/
  path.resolve(__dirname, '..', '..'), // if running from scripts directly
  process.cwd(), // current working directory
  path.join(process.cwd(), 'PromptClarity')
];

for (const root of possibleRoots) {
  if (fs.existsSync(path.join(root, 'lib', 'promptAnalyzer.js'))) {
    projectRoot = root;
    break;
  }
}

if (!projectRoot) {
  console.error('Error: Could not find project root containing "lib/promptAnalyzer.js".');
  process.exit(1);
}

// Import the compiled analysis modules from lib/
const { analyzePrompt } = require(path.join(projectRoot, 'lib', 'promptAnalyzer.js'));
const { detectPrompt, shouldShowPopup } = require(path.join(projectRoot, 'lib', 'promptDetector.js'));

const VALID_USE_CASES = [
  'general', 'coding', 'writing', 'studying',
  'research', 'business', 'imageGeneration'
];

function parseArgs(argv) {
  let prompt = undefined;
  let useCase = 'general';
  let stdin = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--prompt' && i + 1 < argv.length) {
      prompt = argv[++i];
    } else if (arg === '--useCase' && i + 1 < argv.length) {
      const val = argv[++i];
      if (VALID_USE_CASES.includes(val)) {
        useCase = val;
      } else {
        console.error(`Warning: Unknown use case "${val}". Using "general".`);
      }
    } else if (arg === '--stdin') {
      stdin = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return { prompt, useCase, stdin };
}

function printHelp() {
  console.log(`
Prompt Enhancement Analyzer — CLI

Usage:
  node analyze-prompt.js --prompt "text" [--useCase <type>]
  echo "text" | node analyze-prompt.js --stdin [--useCase <type>]

Options:
  --prompt <text>    The prompt text to analyze
  --stdin            Read prompt from stdin instead of --prompt
  --useCase <type>   One of: ${VALID_USE_CASES.join(', ')} (default: general)
  --help, -h         Show this help message

Output:
  JSON object with detection results, analysis scores, issues, and rewritten prompt.
`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);

    // If nothing arrives within 5 seconds, assume empty
    setTimeout(() => {
      if (data.length === 0) {
        reject(new Error('No input received on stdin within 5 seconds'));
      }
    }, 5000);
  });
}

async function main() {
  const { prompt: argPrompt, useCase, stdin } = parseArgs(process.argv);

  let promptText;

  if (stdin) {
    try {
      promptText = await readStdin();
    } catch (err) {
      console.error('Error reading from stdin:', err.message);
      process.exit(1);
    }
  } else if (argPrompt) {
    promptText = argPrompt;
  } else {
    console.error('Error: No prompt provided. Use --prompt "text" or --stdin.');
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  if (!promptText || promptText.trim().length === 0) {
    console.error('Error: Prompt text is empty.');
    process.exit(1);
  }

  try {
    // Step 1: Detection
    const detection = detectPrompt(promptText);
    const isLikelyPrompt = shouldShowPopup(detection.confidence);

    // Step 2: Full analysis (always run, even if detection confidence is low)
    const analysis = analyzePrompt(promptText, useCase);

    // Step 3: Output structured JSON
    const output = {
      detection: {
        isPrompt: isLikelyPrompt,
        confidence: Math.round(detection.confidence * 100),
        signals: detection.signals
          .filter(s => s.present)
          .map(s => ({ name: s.name, weight: s.weight }))
      },
      analysis: {
        overallScore: analysis.overallScore,
        label: analysis.label,
        summary: analysis.summary,
        categoryScores: analysis.categoryScores,
        issues: analysis.issues.map(issue => ({
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          suggestion: issue.suggestion
        })),
        strengths: analysis.strengths,
        spellingIssues: analysis.spellingIssues.length > 0
          ? analysis.spellingIssues.map(s => ({
              word: s.word,
              suggestions: s.suggestions,
              confidence: s.confidence
            }))
          : undefined
      },
      rewrittenPrompt: analysis.rewrittenPrompt,
      originalPrompt: promptText,
      useCase
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    console.error('Analysis failed:', err.message);
    process.exit(1);
  }
}

main();
