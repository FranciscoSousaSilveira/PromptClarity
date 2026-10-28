import type { DesktopBridge, DesktopPopupState } from './shared';
import { formatDiagnosticsReport } from '../../../lib/diagnostics';

declare global {
  interface Window {
    promptDesktop: DesktopBridge;
  }
}

const root = document.querySelector<HTMLElement>('#app');
let currentState: DesktopPopupState | null = null;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[character] || character
  );
}

function shell(content: string, subtitle: string) {
  return `
    <section class="window-card">
      <header class="titlebar">
        <div class="brand">
          <span class="brand-icon" aria-hidden="true">✦</span>
          <span>
            <strong>PromptClarity</strong>
            <small>${escapeHtml(subtitle)}</small>
          </span>
        </div>
        <button class="icon-button" id="close-button" type="button" aria-label="Close">×</button>
      </header>
      ${content}
    </section>
  `;
}

function renderLoading(state: Extract<DesktopPopupState, { status: 'loading' }>) {
  const copy =
    state.stage === 'reading'
      ? ['Reading your prompt…', 'Selecting and copying text from the active application.']
      : state.stage === 'validating'
        ? ['Validating the rewrite…', 'Checking meaning, language, and safety before enabling Insert.']
        : [
            'Checking your prompt…',
            'The local model is correcting spelling, grammar, and clarity without adding instructions.'
          ];
  return shell(
    `
    <div class="loading-state" role="status">
      <div class="spinner" aria-hidden="true"><i></i><i></i><i></i></div>
      <h1>${copy[0]}</h1>
      <p>${copy[1]}</p>
      <div class="loading-preview">${escapeHtml(state.originalText.slice(0, 180))}${state.originalText.length > 180 ? '…' : ''}</div>
      <div class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
  `,
    'Local AI is working'
  );
}

function renderSuccess(state: Extract<DesktopPopupState, { status: 'success' }>) {
  const isCheckmark = state.rewriteStatus === 'no_change';
  const isFallback = state.rewriteStatus === 'fallback';
  const isErrorRewrite = state.rewriteStatus === 'error';
  const statusLabel = isErrorRewrite
    ? 'Local rewrite unavailable'
    : state.rewriteStatus === 'no_change'
      ? 'Prompt checked'
      : state.rewriteStatus === 'fallback'
        ? 'Conservative local correction'
        : 'Corrected prompt';
  const statusMessage = isErrorRewrite
    ? 'The local service is unavailable right now.'
    : state.rewriteStatus === 'no_change'
      ? 'No changes were needed.'
      : isFallback
        ? 'A conservative local fallback was used.'
        : 'The corrected prompt keeps the original intent.';
  const meta = [
    `Intervention: ${state.intervention.charAt(0).toUpperCase() + state.intervention.slice(1)}`,
    state.validationReason || (isFallback ? 'Fallback used locally' : 'Local correction ready')
  ].join(' · ');

  const issues = state.review.issues
    .map(
      (issue) => `
    <div class="review-item issue">
      <strong>${escapeHtml(issue.title)}</strong>
      <span>${escapeHtml(issue.suggestion)}</span>
    </div>
  `
    )
    .join('');
  const strengths = state.review.strengths
    .map(
      (strength) => `
    <div class="review-item strength"><span>${escapeHtml(strength)}</span></div>
  `
    )
    .join('');

  return shell(
    `
    <div class="result-body">
      <div class="result-state result-${state.rewriteStatus}">
        <span class="prompt-good-check" aria-hidden="true">${isCheckmark ? '✓' : 'i'}</span>
        <span><strong>${escapeHtml(statusLabel)}</strong><small>${escapeHtml(statusMessage)}</small></span>
      </div>
      <div class="section-heading">
        <span>${isCheckmark ? 'Same prompt' : 'Original prompt'} / Corrected prompt</span>
        ${state.model ? `<small>${escapeHtml(state.model)}</small>` : ''}
      </div>
      <div class="comparison-stack">
        <div class="comparison-column">
          <div class="section-label">Original</div>
          <div class="text-box text-box-muted" id="original-text">${escapeHtml(state.originalText)}</div>
        </div>
        <div class="comparison-column">
          <div class="section-label">${isCheckmark ? 'Same text' : 'Corrected'}</div>
          <textarea id="improved-prompt" aria-label="Editable enhanced prompt"></textarea>
        </div>
      </div>
      <div class="result-meta">${escapeHtml(meta)}</div>

      <details class="review-details">
        <summary>
          <span>View prompt review</span>
          <span class="score-pill">${state.review.overallScore}/100</span>
          <span class="chevron">⌄</span>
        </summary>
        <div class="review-content">
          <div class="score-row">
            <span class="score-number">${state.review.overallScore}</span>
            <span><strong>${escapeHtml(state.review.label)} quality</strong><small>${escapeHtml(state.review.summary)}</small></span>
          </div>
          <div class="review-list">${issues}${strengths}</div>
        </div>
      </details>
    </div>
    <footer class="actions">
      <button class="button secondary" id="copy-button" type="button">Copy</button>
      <button class="button secondary" id="too-much-button" type="button">Too much</button>
      ${state.canUndo ? '<button class="button secondary" id="undo-button" type="button">Undo last</button>' : ''}
      ${isErrorRewrite ? '' : '<button class="button primary" id="insert-button" type="button">Insert</button>'}
    </footer>
  `,
    isCheckmark ? 'Prompt checked' : 'Ready to use'
  );
}

function renderSettings(state: Extract<DesktopPopupState, { status: 'settings' }>) {
  const settings = state.settings;
  return shell(
    `
    <form class="settings-body" id="settings-form">
      <fieldset>
        <legend>Model</legend>
        <div class="setting-row">
          <label>Model<select id="setting-model" disabled>
            <option value="">Loading...</option>
          </select></label>
          <button type="button" id="refresh-models" class="button secondary" title="Refresh models">⟳</button>
          <button type="button" id="redetect-hardware" class="button secondary" title="Re-detect hardware">🔍 Re-detect</button>
        </div>
        <p class="hint" id="model-hint"></p>
      </fieldset>

      <fieldset>
        <legend>Performance</legend>
        <label>Performance mode<select id="setting-mode">
          <option value="fast" ${settings.performanceMode === 'fast' ? 'selected' : ''}>Fast</option>
          <option value="balanced" ${settings.performanceMode === 'balanced' ? 'selected' : ''}>Balanced</option>
          <option value="quality" ${settings.performanceMode === 'quality' ? 'selected' : ''}>Quality</option>
        </select></label>
        <label>Language<select id="setting-language">
          <option value="auto" ${settings.language === 'auto' ? 'selected' : ''}>Automatic</option>
          <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
          <option value="pt-PT" ${settings.language === 'pt-PT' ? 'selected' : ''}>Português (Portugal)</option>
        </select></label>
        <label>Shortcut<select id="setting-shortcut">
          <option value="CommandOrControl+Alt+P" ${settings.shortcut === 'CommandOrControl+Alt+P' ? 'selected' : ''}>Ctrl+Alt+P</option>
          <option value="CommandOrControl+Shift+P" ${settings.shortcut === 'CommandOrControl+Shift+P' ? 'selected' : ''}>Ctrl+Shift+P</option>
          <option value="CommandOrControl+Alt+G" ${settings.shortcut === 'CommandOrControl+Alt+G' ? 'selected' : ''}>Ctrl+Alt+G</option>
        </select></label>
        <label class="check-row"><input id="setting-warm" type="checkbox" ${settings.keepModelsWarm ? 'checked' : ''}> Keep models in memory</label>
        <label class="check-row"><input id="setting-history" type="checkbox" ${settings.historyEnabled ? 'checked' : ''}> Save local history</label>
      </fieldset>

      <fieldset>
        <legend>Privacy</legend>
        <label class="check-row"><input id="setting-telemetry" type="checkbox" ${settings.telemetryEnabled ? 'checked' : ''}> Send anonymous crash reports & usage stats</label>
        <p class="hint">Helps improve PromptClarity. Never includes your prompts or clipboard content.</p>
        <label class="check-row"><input id="setting-ollama-auto" type="checkbox" ${settings.ollamaAutoInstall !== false ? 'checked' : ''}> Auto-install Ollama if missing</label>
      </fieldset>

      <button class="button primary" type="submit">Save settings</button>
    </form>
  `,
    'Settings'
  );
}

function renderHistory(state: Extract<DesktopPopupState, { status: 'history' }>) {
  const entries = state.entries
    .map(
      (entry) => `
    <article class="history-item">
      <time>${escapeHtml(new Date(entry.createdAt).toLocaleString())}</time>
      <strong>${escapeHtml(entry.improvedText.slice(0, 120))}</strong>
      <small>${escapeHtml(entry.source)}</small>
    </article>
  `
    )
    .join('');
  return shell(
    `
    <div class="history-body">${entries || '<p>No saved prompts yet.</p>'}</div>
    <footer class="actions"><button class="button secondary" id="clear-history" type="button">Clear history</button></footer>
  `,
    'Local history'
  );
}

function renderDiagnostics(state: Extract<DesktopPopupState, { status: 'diagnostics' }>) {
  const lines = formatDiagnosticsReport(state.diagnostics);
  return shell(
    `
    <div class="history-body">
      ${lines.map((line) => `<div class="history-item"><strong>${escapeHtml(line)}</strong></div>`).join('')}
      ${state.hints.map((hint) => `<div class="history-item"><small>${escapeHtml(hint)}</small></div>`).join('')}
    </div>
  `,
    'System diagnostics'
  );
}

function renderError(state: Extract<DesktopPopupState, { status: 'error' }>) {
  return shell(
    `
    <div class="error-state" role="alert">
      <span class="error-icon">!</span>
      <h1>${escapeHtml(state.title)}</h1>
      <p>${escapeHtml(state.message)}</p>
      ${state.originalText ? `<div class="text-box text-box-muted">${escapeHtml(state.originalText)}</div>` : ''}
      <div class="actions error-actions">
        <button class="button secondary" id="copy-button" type="button">Copy original</button>
        <button class="button secondary" id="too-much-button" type="button">Too much</button>
      </div>
      ${state.canRetry ? '<button class="button primary retry-button" id="retry-button" type="button">Try again</button>' : ''}
      <small class="shortcut-hint">Select text, or place the cursor at the end of a prompt, then press Ctrl+Alt+P.</small>
    </div>
  `,
    'Desktop helper'
  );
}

async function bindEvents(state: DesktopPopupState) {
  document.querySelector('#close-button')?.addEventListener('click', () => void window.promptDesktop.close());
  document.querySelector('#retry-button')?.addEventListener('click', () => void window.promptDesktop.retry());

  // Model selector events
  const modelSelect = document.querySelector<HTMLSelectElement>('#setting-model');
  const refreshModelsBtn = document.querySelector<HTMLButtonElement>('#refresh-models');
  const redetectHardwareBtn = document.querySelector<HTMLButtonElement>('#redetect-hardware');
  const modelHint = document.querySelector<HTMLElement>('#model-hint');

  async function loadModels() {
    try {
      const { models } = await window.promptDesktop.getModels();
      if (modelSelect) {
        modelSelect.innerHTML = models.map((m) => `<option value="${m}">${m}</option>`).join('');
        modelSelect.disabled = false;

        // Set current selection
        const settings = await window.promptDesktop.getSettings();
        modelSelect.value = settings.selectedModel || '';

        // Show hint
        const current = modelSelect.value;
        if (current && modelHint) {
          const profile = getProfileForModel(current);
          modelHint.textContent = profile ? profile.description : 'Custom model';
        }
      }
    } catch (e) {
      if (modelSelect) {
        modelSelect.innerHTML = '<option value="">Failed to load models</option>';
        modelSelect.disabled = true;
      }
    }
  }

  function getProfileForModel(model: string) {
    const profiles: Record<string, { description: string }> = {
      'qwen2.5:3b': { description: 'Best quality - for 8 GB+ RAM computers' },
      'qwen2.5:1.5b': { description: 'Good quality - optimized for 6 GB RAM' },
      'qwen2.5:0.5b': { description: 'Fast and reliable - optimized for 4 GB RAM' }
    };
    return profiles[model];
  }

  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      const profile = getProfileForModel(modelSelect.value);
      if (modelHint) modelHint.textContent = profile ? profile.description : 'Custom model';
    });
  }

  if (refreshModelsBtn) {
    refreshModelsBtn.addEventListener('click', loadModels);
  }

  if (redetectHardwareBtn) {
    redetectHardwareBtn.addEventListener('click', async () => {
      try {
        const { profile } = await window.promptDesktop.redetectHardware();
        if (modelHint) modelHint.textContent = profile.description;
        // Update dropdown if model exists
        if (modelSelect) {
          const options = Array.from(modelSelect.options).map((o) => o.value);
          if (options.includes(profile.model)) {
            modelSelect.value = profile.model;
          }
        }
      } catch (e) {
        console.error('Failed to re-detect hardware:', e);
      }
    });
  }

  // Load settings on settings panel open
  if (state.status === 'settings') {
    const settings = await window.promptDesktop.getSettings();
    document.querySelector<HTMLInputElement>('#setting-telemetry')!.checked =
      settings.telemetryEnabled ?? false;
    document.querySelector<HTMLInputElement>('#setting-ollama-auto')!.checked =
      settings.ollamaAutoInstall !== false;
    await loadModels();
  }

  document.querySelector('#setting-telemetry')?.addEventListener('change', async (e) => {
    const target = e.target as HTMLInputElement;
    await window.promptDesktop.saveSettings({ telemetryEnabled: target.checked });
  });

  document.querySelector('#setting-ollama-auto')?.addEventListener('change', async (e) => {
    const target = e.target as HTMLInputElement;
    await window.promptDesktop.saveSettings({ ollamaAutoInstall: target.checked });
  });

  // Load models on first settings open
  if (state.status === 'settings') {
    await loadModels();
  }

  const copyButton = document.querySelector<HTMLButtonElement>('#copy-button');
  copyButton?.addEventListener('click', async () => {
    copyButton.disabled = true;
    copyButton.textContent = 'Copied';
    const text =
      state.status === 'error' || (state.status === 'success' && state.rewriteStatus === 'error')
        ? state.originalText
        : document.querySelector<HTMLTextAreaElement>('#improved-prompt')?.value ||
          (state.status === 'success' ? state.improvedText : '');
    await window.promptDesktop.copy(text);
  });

  document.querySelector('#too-much-button')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement | null;
    if (!button) return;
    button.disabled = true;
    const saved = await window.promptDesktop.tooMuch();
    if (saved) button.textContent = 'Saved locally';
    button.disabled = false;
  });

  const insertButton = document.querySelector<HTMLButtonElement>('#insert-button');
  insertButton?.addEventListener('click', async () => {
    insertButton.disabled = true;
    insertButton.textContent = 'Inserting…';
    const text = document.querySelector<HTMLTextAreaElement>('#improved-prompt')?.value;
    const inserted = await window.promptDesktop.insert(text);
    if (!inserted) {
      insertButton.disabled = false;
      insertButton.textContent = 'Insert';
    }
  });

  document.querySelector('#undo-button')?.addEventListener('click', () => void window.promptDesktop.undo());
  document
    .querySelector('#clear-history')
    ?.addEventListener('click', () => void window.promptDesktop.clearHistory());
  document.querySelector('#settings-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await window.promptDesktop.saveSettings({
      performanceMode: (document.querySelector<HTMLSelectElement>('#setting-mode')?.value || 'fast') as
        'fast' | 'balanced' | 'quality',
      language: (document.querySelector<HTMLSelectElement>('#setting-language')?.value || 'auto') as
        'auto' | 'en' | 'pt-PT',
      shortcut:
        document.querySelector<HTMLSelectElement>('#setting-shortcut')?.value || 'CommandOrControl+Alt+P',
      keepModelsWarm: document.querySelector<HTMLInputElement>('#setting-warm')?.checked ?? true,
      historyEnabled: document.querySelector<HTMLInputElement>('#setting-history')?.checked ?? false,
      telemetryEnabled: document.querySelector<HTMLInputElement>('#setting-telemetry')?.checked ?? false,
      ollamaAutoInstall: document.querySelector<HTMLInputElement>('#setting-ollama-auto')?.checked ?? true
    });
    await window.promptDesktop.close();
  });
}

function render(state: DesktopPopupState) {
  if (!root) return;
  currentState = state;
  root.innerHTML =
    state.status === 'loading'
      ? renderLoading(state)
      : state.status === 'success'
        ? renderSuccess(state)
        : state.status === 'settings'
          ? renderSettings(state)
          : state.status === 'history'
            ? renderHistory(state)
            : state.status === 'diagnostics'
              ? renderDiagnostics(state)
              : renderError(state);

  if (state.status === 'success') {
    const prompt = document.querySelector<HTMLTextAreaElement>('#improved-prompt');
    if (prompt) prompt.value = state.improvedText;
  }
  window.getSelection()?.removeAllRanges();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  bindEvents(state);
}

window.promptDesktop.onState(render);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'a' && event.ctrlKey) event.preventDefault();
  if (event.key === 'Escape') void window.promptDesktop.close();
  if (
    event.key === 'Enter' &&
    event.ctrlKey &&
    currentState?.status === 'success' &&
    currentState.rewriteStatus !== 'error'
  ) {
    void window.promptDesktop.insert();
  }
});
