/**
 * VS Code Extension main activation module.
 * Manages the prompt enhancement popup for VS Code Chat.
 */

import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { analyzeForPopup, shouldShowHint, type PopupContent } from '../lib/promptIntegration';
import { rewritePromptWithModel } from '../lib/modelPromptRewriter';
import {
  DEFAULT_REWRITE_INTERVENTION,
  isRewriteIntervention,
  type PerformanceMode,
  type RewriteIntervention
} from '../config/product';
import {
  buildVscodeTooMuchFeedbackEntry,
  describeVscodeRewritePresentation,
  type VscodeRewritePresentation
} from '../lib/vscodePresentation';
import {
  collectLocalDiagnostics,
  createRewriteDiagnostics,
  describeRewriteDiagnostic,
  EMPTY_REWRITE_DIAGNOSTICS,
  formatDiagnosticsReport
} from '../lib/diagnostics';
import type { RewriteDiagnostics } from '../types/diagnostics';

let popupPanel: vscode.WebviewPanel | undefined;
let lastAnalyzedText: string = '';
let currentImprovedPrompt: string = '';
let currentPresentation: VscodeRewritePresentation | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let lastRewriteDiagnostics: RewriteDiagnostics = { ...EMPTY_REWRITE_DIAGNOSTICS };

type LocalRewriteResult = ReturnType<typeof analyzeForPopup> & {
  copyableText: string;
  improvedPrompt: string;
  rewriteSource?: 'model' | 'rules';
  rewriteStatus?: 'changed' | 'no_change' | 'fallback' | 'error';
  modelName?: string;
  modelError?: string;
  isAlreadyGood?: boolean;
  mode: PerformanceMode;
  intervention: VscodeRewritePresentation['intervention'];
  validationReason?: string | null;
  presentation: VscodeRewritePresentation;
};

export function activate(context: vscode.ExtensionContext) {
  console.log('Prompt Enhancement extension activated');
  const diagnosticsOutput = vscode.window.createOutputChannel('Prompt Grammarly Diagnostics');

  // Command: Manual popup toggle
  const togglePopup = vscode.commands.registerCommand('prompt-enhancement.togglePopup', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No active editor');
      return;
    }

    const selectedText = editor.document.getText(editor.selection);
    if (!selectedText) {
      vscode.window.showInformationMessage('Please select text to enhance');
      return;
    }

    await showPopup(selectedText, context);
  });

  // Command: Analyze and copy to clipboard
  const analyzeAndCopy = vscode.commands.registerCommand(
    'prompt-enhancement.analyzeAndCopy',
    async (text?: string) => {
      const textToAnalyze = text || lastAnalyzedText;
      if (!textToAnalyze) {
        vscode.window.showWarningMessage('No text to analyze');
        return;
      }

      const result = await analyzeWithLocalModel(textToAnalyze);

      if (result.copyableText) {
        await vscode.env.clipboard.writeText(result.copyableText);
        vscode.window.showInformationMessage('Improved prompt copied to clipboard');
      }
    }
  );

  const showDiagnostics = vscode.commands.registerCommand('prompt-enhancement.showDiagnostics', async () => {
    const configuration = vscode.workspace.getConfiguration('promptGrammarly');
    const mode = configuration.get<PerformanceMode>('performanceMode', 'fast');
    const configuredIntervention = configuration.get<RewriteIntervention>(
      'intervention',
      DEFAULT_REWRITE_INTERVENTION
    );
    const intervention = isRewriteIntervention(configuredIntervention)
      ? configuredIntervention
      : DEFAULT_REWRITE_INTERVENTION;
    const feedback = context.workspaceState.get<unknown[]>('promptGrammarly.tooMuchFeedback');
    const keepModelsWarm = configuration.get<boolean>('keepModelsWarm', true);
    const diagnostics = await collectLocalDiagnostics({
      mode,
      intervention,
      historyEnabled: null,
      feedbackCount: Array.isArray(feedback) ? feedback.length : 0,
      keepAlive: keepModelsWarm,
      prewarmEnabled: keepModelsWarm,
      rewrite: lastRewriteDiagnostics
    });

    diagnosticsOutput.clear();
    diagnosticsOutput.appendLine('Prompt Grammarly diagnostics');
    diagnosticsOutput.appendLine('Local-only metadata; prompt contents are never included.');
    for (const line of formatDiagnosticsReport(diagnostics)) diagnosticsOutput.appendLine(line);
    if (diagnostics.api.status === 'error') {
      diagnosticsOutput.appendLine('Hint: Start the local API with npm run dev.');
    } else if (!diagnostics.ollama.reachable) {
      diagnosticsOutput.appendLine('Hint: Start Ollama and confirm that the selected model is installed.');
    }
    diagnosticsOutput.show(true);
  });

  // Listen for text changes in chat/editor (automatic hinting)
  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
    const text = getRelevantEditorText(event);
    if (text) debounceAnalysis(text);
  });

  context.subscriptions.push(
    togglePopup,
    analyzeAndCopy,
    showDiagnostics,
    onDidChangeTextDocument,
    diagnosticsOutput
  );
}

/**
 * Shows the popup with improved prompt
 */
async function analyzeWithLocalModel(text: string): Promise<PopupContent | LocalRewriteResult> {
  const result = analyzeForPopup({ text, useCase: 'general' });
  if (!result.analysis || !result.improvedPrompt) return result;

  const configuration = vscode.workspace.getConfiguration('promptGrammarly');
  const performanceMode = configuration.get<PerformanceMode>('performanceMode', 'fast');
  const configuredIntervention = configuration.get<RewriteIntervention>(
    'intervention',
    DEFAULT_REWRITE_INTERVENTION
  );
  const intervention = isRewriteIntervention(configuredIntervention)
    ? configuredIntervention
    : DEFAULT_REWRITE_INTERVENTION;
  const modelResult = await rewritePromptWithModel({
    prompt: text,
    useCase: 'general',
    fallbackPrompt: result.improvedPrompt,
    preferSpeed: performanceMode === 'fast',
    performanceMode,
    intervention,
    keepModelsWarm: configuration.get<boolean>('keepModelsWarm', true)
  });
  lastRewriteDiagnostics = createRewriteDiagnostics(modelResult);
  const diagnosticHint = describeRewriteDiagnostic(lastRewriteDiagnostics.lastValidationReason);

  const presentation = describeVscodeRewritePresentation({
    original: text,
    rewritten: modelResult.rewrittenPrompt,
    status: modelResult.status,
    source:
      modelResult.source === 'model'
        ? 'model'
        : modelResult.source === 'checkmark'
          ? 'checkmark'
          : modelResult.source === 'error'
            ? 'error'
            : 'local_fallback',
    mode: performanceMode,
    intervention: modelResult.intervention,
    validationReason: modelResult.validation.reason,
    error:
      modelResult.status === 'error'
        ? diagnosticHint || 'The local rewrite service is unavailable.'
        : modelResult.error
  });

  return {
    ...result,
    analysis: { ...result.analysis, rewrittenPrompt: modelResult.rewrittenPrompt },
    improvedPrompt: modelResult.rewrittenPrompt,
    copyableText: presentation.copyText,
    rewriteSource: modelResult.source === 'model' || modelResult.source === 'checkmark' ? 'model' : 'rules',
    modelName: modelResult.model,
    modelError:
      modelResult.status === 'error'
        ? diagnosticHint || 'The local rewrite service is unavailable.'
        : modelResult.error,
    isAlreadyGood: modelResult.status === 'no_change' && !modelResult.error,
    rewriteStatus: modelResult.error && modelResult.status === 'error' ? 'error' : modelResult.status,
    mode: performanceMode,
    intervention: presentation.intervention,
    validationReason: presentation.validationReasonText,
    presentation
  };
}

async function showPopup(text: string, context: vscode.ExtensionContext) {
  lastAnalyzedText = text;
  const result = await analyzeWithLocalModel(text);

  if (!result.isPrompt || !result.improvedPrompt) {
    vscode.window.showInformationMessage('Text does not appear to be a prompt');
    return;
  }

  const presentation =
    'presentation' in result
      ? result.presentation
      : describeVscodeRewritePresentation({
          original: text,
          rewritten: currentImprovedPrompt || text,
          status:
            result.rewriteStatus && result.rewriteStatus !== 'loading' ? result.rewriteStatus : 'changed',
          source: result.rewriteSource === 'model' ? 'model' : 'local_fallback',
          mode: 'fast',
          intervention: result.intervention,
          validationReason: result.validationReason,
          error: result.modelError
        });

  currentImprovedPrompt = result.copyableText || result.improvedPrompt || text;
  currentPresentation = presentation;

  if (popupPanel) {
    popupPanel.reveal(vscode.ViewColumn.Beside);
    popupPanel.webview.postMessage({
      type: 'update',
      original: text,
      improved: result.improvedPrompt,
      copyableText: currentImprovedPrompt,
      confidence: Math.round(result.detectionConfidence * 100),
      isAlreadyGood: result.isAlreadyGood,
      analysis: result.analysis,
      rewriteStatus: result.rewriteStatus,
      intervention: result.intervention,
      validationReason: result.validationReason,
      title: presentation.title,
      subtitle: presentation.subtitle,
      message: presentation.message,
      copyLabel: presentation.copyLabel,
      insertLabel: presentation.insertLabel,
      canInsert: presentation.canInsert,
      canCopy: presentation.canCopy
    });
    return;
  }

  // Create new panel
  popupPanel = vscode.window.createWebviewPanel(
    'promptEnhancement',
    'Prompt Enhancement',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [context.extensionUri]
    }
  );

  popupPanel.webview.html = getWebviewContent(
    text,
    currentImprovedPrompt,
    result.detectionConfidence,
    presentation,
    popupPanel.webview
  );

  popupPanel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'copy':
        if (currentImprovedPrompt) {
          await vscode.env.clipboard.writeText(currentImprovedPrompt);
          vscode.window.showInformationMessage('Copied to clipboard!');
        }
        break;
      case 'insert':
        if (currentImprovedPrompt && currentPresentation?.canInsert !== false) {
          insertTextInEditor(currentImprovedPrompt);
        }
        break;
      case 'tooMuch': {
        const saved = await recordVsCodeTooMuchFeedback(context, text, result as LocalRewriteResult);
        if (saved) {
          vscode.window.showInformationMessage('Saved locally');
        }
        break;
      }
      case 'close':
        if (popupPanel) {
          popupPanel.dispose();
          popupPanel = undefined;
        }
        break;
    }
  });

  popupPanel.onDidDispose(() => {
    popupPanel = undefined;
    currentPresentation = undefined;
  });
}

async function recordVsCodeTooMuchFeedback(
  context: vscode.ExtensionContext,
  original: string,
  result: LocalRewriteResult
) {
  const presentation = result.presentation;
  if (!presentation) return false;

  const entry = buildVscodeTooMuchFeedbackEntry({
    original,
    rewritten: result.copyableText || result.improvedPrompt || original,
    source: presentation.source,
    status: result.rewriteStatus || 'error',
    mode: result.mode || 'fast',
    intervention: presentation.intervention,
    validationReason: presentation.validationReasonText,
    timestamp: new Date().toISOString(),
    reason: 'user_too_much'
  });

  const existing = context.workspaceState.get<unknown[]>('promptGrammarly.tooMuchFeedback');
  const feedback = Array.isArray(existing) ? existing : [];
  await context.workspaceState.update('promptGrammarly.tooMuchFeedback', [entry, ...feedback].slice(0, 50));
  return true;
}

/**
 * Debounced analysis for automatic hints
 */
function getRelevantEditorText(event: vscode.TextDocumentChangeEvent): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document !== event.document) return '';

  if (!editor.selection.isEmpty) {
    return editor.document.getText(editor.selection).slice(0, 2000);
  }

  const currentLine = editor.document.lineAt(editor.selection.active.line).text.trim();
  return currentLine.slice(0, 2000);
}

function debounceAnalysis(text: string) {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    if (shouldShowHint(text)) {
      lastAnalyzedText = text;
      // Could show a status bar hint here
      vscode.window.setStatusBarMessage('💡 Looks like a prompt - use Cmd+Shift+P > "Enhance Prompt"', 3000);
    }
  }, 500);
}

/**
 * Inserts improved prompt into the active editor
 */
function insertTextInEditor(text: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  editor.edit((editBuilder) => {
    editBuilder.replace(editor.selection, text);
  });

  if (popupPanel) {
    popupPanel.dispose();
    popupPanel = undefined;
  }
}

/**
 * Generates the HTML for the webview popup
 */
function getWebviewContent(
  original: string,
  improved: string,
  confidence: number,
  presentation: VscodeRewritePresentation,
  _webview: vscode.Webview
): string {
  const nonce = randomBytes(16).toString('base64');
  const isError = presentation.status === 'error';
  const showInsert = presentation.canInsert && !isError;
  const showCopy = presentation.canCopy;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <title>Enhance Prompt</title>
    <style nonce="${nonce}">
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 16px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        
        .header {
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .title {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .confidence {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            background: var(--vscode-button-secondaryBackground);
            padding: 2px 8px;
            border-radius: 4px;
        }

        .status-banner {
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 16px;
          background: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
        }

        .status-banner strong {
          display: block;
          font-size: 13px;
          margin-bottom: 2px;
        }

        .status-banner small {
          color: var(--vscode-descriptionForeground);
        }
        
        .section {
            margin-bottom: 20px;
        }
        
        .section-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }
        
        .text-box {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 12px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 120px;
            overflow-y: auto;
        }

          .comparison {
            display: grid;
            gap: 12px;
          }

          .comparison .text-box {
            max-height: 180px;
          }
        
        .actions {
            display: flex;
            gap: 8px;
            margin-top: 16px;
        }
        
        button {
            flex: 1;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 12px;
            padding: 8px;
            background: var(--vscode-editor-background);
            border-left: 3px solid var(--vscode-button-background);
            padding-left: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
      <span class="title" id="result-title">${escapeHtml(presentation.title)}</span>
            <span class="confidence" id="confidence-value">${confidence}% confident</span>
        </div>
    <div class="status-banner" id="status-banner">
      <strong id="result-subtitle">${escapeHtml(presentation.subtitle)}</strong>
      <small id="result-message">${escapeHtml(presentation.message)}</small>
    </div>
        
        <div class="section">
      <div class="section-label" id="original-label">${escapeHtml(presentation.originalLabel)}</div>
            <div class="text-box" id="original-text">${escapeHtml(original)}</div>
        </div>
        
        <div class="section">
      <div class="section-label" id="result-label">${escapeHtml(presentation.rewrittenLabel)}</div>
            <div class="text-box" id="improved-text">${escapeHtml(improved)}</div>
      <div class="hint" id="result-hint">${escapeHtml(presentation.validationReasonText || presentation.message)}</div>
        </div>
        
        <div class="actions">
      <button class="btn-primary" id="copy-button" ${showCopy ? '' : 'hidden'}>
        📋 ${escapeHtml(presentation.copyLabel)}
            </button>
      <button class="btn-secondary" id="insert-button" ${showInsert ? '' : 'hidden'}>
        ${escapeHtml(presentation.insertLabel)}
      </button>
      <button class="btn-secondary" id="too-much-button" type="button">
        Too much
            </button>
            <button class="btn-secondary" id="close-button">
                Close
            </button>
        </div>
    </div>
    
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type !== 'update') return;

            document.getElementById('original-text').textContent = message.original;
            document.getElementById('improved-text').textContent = message.improved;
            document.getElementById('confidence-value').textContent = message.confidence + '% confident';
            document.getElementById('result-title').textContent = message.title || 'Prompt result';
            document.getElementById('result-subtitle').textContent = message.subtitle || '';
            document.getElementById('result-message').textContent = message.message || '';
            document.getElementById('original-label').textContent = message.originalLabel || 'Original prompt';
            document.getElementById('result-label').textContent = message.rewrittenLabel || 'Corrected prompt';
            document.getElementById('result-hint').textContent = message.validationReason || message.message || '';

            const copyButton = document.getElementById('copy-button');
            if (copyButton) {
              copyButton.hidden = message.canCopy === false;
              copyButton.textContent = message.copyLabel ? '📋 ' + message.copyLabel : '📋 Copy';
            }

            const insertButton = document.getElementById('insert-button');
            if (insertButton) {
              insertButton.hidden = message.canInsert === false;
              insertButton.textContent = message.insertLabel || 'Insert';
            }
        });
        
        function copy() {
            vscode.postMessage({ command: 'copy' });
        }
        
        function insert() {
            vscode.postMessage({ command: 'insert' });
        }

        function tooMuch() {
          vscode.postMessage({ command: 'tooMuch' });
        }
        
        function close() {
            vscode.postMessage({ command: 'close' });
        }

        document.getElementById('copy-button').addEventListener('click', copy);
        document.getElementById('insert-button')?.addEventListener('click', insert);
        document.getElementById('too-much-button').addEventListener('click', tooMuch);
        document.getElementById('close-button').addEventListener('click', close);
    </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export function deactivate() {
  clearTimeout(debounceTimer);
  currentImprovedPrompt = '';
  if (popupPanel) {
    popupPanel.dispose();
  }
}
