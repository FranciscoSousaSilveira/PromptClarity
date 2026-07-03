import type { DesktopBridge, DesktopPopupState } from './shared';

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
            <strong>Prompt Grammarly</strong>
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
      ${state.isAlreadyGood ? '<div class="prompt-good-state"><span class="prompt-good-check">✓</span><span><strong>This prompt is already clear</strong><small>No changes were needed.</small></span></div>' : ''}
      <div class="section-heading">
        <span>${state.isAlreadyGood ? 'Your prompt' : 'Corrected prompt'}</span>
        ${state.model ? `<small>${escapeHtml(state.model)}</small>` : ''}
      </div>
      <textarea id="improved-prompt" aria-label="Editable enhanced prompt"></textarea>
      <div class="result-meta">${escapeHtml(state.sourceDetail === 'local-ai' ? `Local AI · ${state.validationScore}% validated` : state.sourceDetail === 'instant-rules' ? 'Instant local rewrite' : 'Safety fallback')}</div>

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
      ${state.canUndo ? '<button class="button secondary" id="undo-button" type="button">Undo last</button>' : ''}
      <button class="button primary" id="insert-button" type="button">Insert</button>
    </footer>
  `,
    state.isAlreadyGood ? 'Prompt checked' : 'Ready to use'
  );
}

function renderSettings(state: Extract<DesktopPopupState, { status: 'settings' }>) {
  const settings = state.settings;
  return shell(
    `
    <form class="settings-body" id="settings-form">
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
  return shell(
    `
    <div class="history-body">
      ${state.lines.map((line) => `<div class="history-item"><strong>${escapeHtml(line)}</strong></div>`).join('')}
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
      ${state.canRetry ? '<button class="button primary retry-button" id="retry-button" type="button">Try again</button>' : ''}
      <small class="shortcut-hint">Select text, or place the cursor at the end of a prompt, then press Ctrl+Alt+P.</small>
    </div>
  `,
    'Desktop helper'
  );
}

function bindEvents() {
  document.querySelector('#close-button')?.addEventListener('click', () => void window.promptDesktop.close());
  document.querySelector('#retry-button')?.addEventListener('click', () => void window.promptDesktop.retry());

  const copyButton = document.querySelector<HTMLButtonElement>('#copy-button');
  copyButton?.addEventListener('click', async () => {
    copyButton.disabled = true;
    copyButton.textContent = 'Copied';
    const text = document.querySelector<HTMLTextAreaElement>('#improved-prompt')?.value;
    await window.promptDesktop.copy(text);
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
      historyEnabled: document.querySelector<HTMLInputElement>('#setting-history')?.checked ?? true
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
  bindEvents();
}

window.promptDesktop.onState(render);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'a' && event.ctrlKey) event.preventDefault();
  if (event.key === 'Escape') void window.promptDesktop.close();
  if (event.key === 'Enter' && event.ctrlKey && currentState?.status === 'success') {
    void window.promptDesktop.insert();
  }
});
