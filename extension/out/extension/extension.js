"use strict";
/**
 * VS Code Extension main activation module.
 * Manages the prompt enhancement popup for VS Code Chat.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const crypto_1 = require("crypto");
const promptIntegration_1 = require("../lib/promptIntegration");
const modelPromptRewriter_1 = require("../lib/modelPromptRewriter");
let popupPanel;
let lastAnalyzedText = '';
let currentImprovedPrompt = '';
let debounceTimer;
function activate(context) {
    console.log('Prompt Enhancement extension activated');
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
    const analyzeAndCopy = vscode.commands.registerCommand('prompt-enhancement.analyzeAndCopy', async (text) => {
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
    });
    // Listen for text changes in chat/editor (automatic hinting)
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
        const text = getRelevantEditorText(event);
        if (text)
            debounceAnalysis(text);
    });
    context.subscriptions.push(togglePopup, analyzeAndCopy, onDidChangeTextDocument);
}
/**
 * Shows the popup with improved prompt
 */
async function analyzeWithLocalModel(text) {
    const result = (0, promptIntegration_1.analyzeForPopup)({ text, useCase: 'general' });
    if (!result.analysis || !result.improvedPrompt)
        return result;
    const configuration = vscode.workspace.getConfiguration('promptGrammarly');
    const performanceMode = configuration.get('performanceMode', 'fast');
    const modelResult = await (0, modelPromptRewriter_1.rewritePromptWithModel)({
        prompt: text,
        useCase: 'general',
        fallbackPrompt: result.improvedPrompt,
        preferSpeed: performanceMode === 'fast',
        performanceMode,
        keepModelsWarm: configuration.get('keepModelsWarm', true)
    });
    return {
        ...result,
        analysis: { ...result.analysis, rewrittenPrompt: modelResult.rewrittenPrompt },
        improvedPrompt: modelResult.rewrittenPrompt,
        copyableText: modelResult.rewrittenPrompt,
        rewriteSource: modelResult.source,
        modelName: modelResult.model,
        modelError: modelResult.error
    };
}
async function showPopup(text, context) {
    lastAnalyzedText = text;
    const result = await analyzeWithLocalModel(text);
    if (!result.isPrompt || !result.improvedPrompt) {
        vscode.window.showInformationMessage('Text does not appear to be a prompt');
        return;
    }
    currentImprovedPrompt = result.improvedPrompt;
    if (popupPanel) {
        popupPanel.reveal(vscode.ViewColumn.Beside);
        popupPanel.webview.postMessage({
            type: 'update',
            original: text,
            improved: result.improvedPrompt,
            confidence: Math.round(result.detectionConfidence * 100),
            analysis: result.analysis
        });
        return;
    }
    // Create new panel
    popupPanel = vscode.window.createWebviewPanel('promptEnhancement', 'Prompt Enhancement', vscode.ViewColumn.Beside, {
        enableScripts: true,
        localResourceRoots: [context.extensionUri]
    });
    popupPanel.webview.html = getWebviewContent(text, result.improvedPrompt, result.detectionConfidence, popupPanel.webview);
    popupPanel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'copy':
                if (currentImprovedPrompt) {
                    await vscode.env.clipboard.writeText(currentImprovedPrompt);
                    vscode.window.showInformationMessage('Copied to clipboard!');
                }
                break;
            case 'insert':
                if (currentImprovedPrompt) {
                    insertTextInEditor(currentImprovedPrompt);
                }
                break;
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
    });
}
/**
 * Debounced analysis for automatic hints
 */
function getRelevantEditorText(event) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== event.document)
        return '';
    if (!editor.selection.isEmpty) {
        return editor.document.getText(editor.selection).slice(0, 2000);
    }
    const currentLine = editor.document.lineAt(editor.selection.active.line).text.trim();
    return currentLine.slice(0, 2000);
}
function debounceAnalysis(text) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if ((0, promptIntegration_1.shouldShowHint)(text)) {
            lastAnalyzedText = text;
            // Could show a status bar hint here
            vscode.window.setStatusBarMessage('💡 Looks like a prompt - use Cmd+Shift+P > "Enhance Prompt"', 3000);
        }
    }, 500);
}
/**
 * Inserts improved prompt into the active editor
 */
function insertTextInEditor(text) {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
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
function getWebviewContent(original, improved, confidence, _webview) {
    const nonce = (0, crypto_1.randomBytes)(16).toString('base64');
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
            <span class="title">✨ Enhanced Prompt</span>
            <span class="confidence" id="confidence-value">${confidence}% confident</span>
        </div>
        
        <div class="section">
            <div class="section-label">Original</div>
            <div class="text-box" id="original-text">${escapeHtml(original)}</div>
        </div>
        
        <div class="section">
            <div class="section-label">Improved</div>
            <div class="text-box" id="improved-text">${escapeHtml(improved)}</div>
            <div class="hint">Copy and paste the improved prompt in your chat.</div>
        </div>
        
        <div class="actions">
            <button class="btn-primary" id="copy-button">
                📋 Copy Improved
            </button>
            <button class="btn-secondary" id="insert-button">
                Insert
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
        });
        
        function copy() {
            vscode.postMessage({ command: 'copy' });
        }
        
        function insert() {
            vscode.postMessage({ command: 'insert' });
        }
        
        function close() {
            vscode.postMessage({ command: 'close' });
        }

        document.getElementById('copy-button').addEventListener('click', copy);
        document.getElementById('insert-button').addEventListener('click', insert);
        document.getElementById('close-button').addEventListener('click', close);
    </script>
</body>
</html>`;
}
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
}
function deactivate() {
    clearTimeout(debounceTimer);
    currentImprovedPrompt = '';
    if (popupPanel) {
        popupPanel.dispose();
    }
}
//# sourceMappingURL=extension.js.map