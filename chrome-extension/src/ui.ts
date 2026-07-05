import type { UseCase } from '../../types/prompt';
import type { PopupContent } from '../../lib/promptIntegration';
import type { PerformanceMode } from '../../config/product';
import { describeRewritePresentation } from '../../lib/popupState';

declare const __APP_VERSION__: string;

const USE_CASES: { value: UseCase; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'coding', label: 'Coding' },
  { value: 'writing', label: 'Writing' },
  { value: 'studying', label: 'Studying' },
  { value: 'research', label: 'Research' },
  { value: 'business', label: 'Business' },
  { value: 'imageGeneration', label: 'Image Generation' }
];

export class PromptEnhancerUI {
  private container: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private bubble: HTMLButtonElement | null = null;
  private popup: HTMLDivElement | null = null;

  // Callbacks
  private onUseCaseChange: (useCase: UseCase) => void = () => {};
  private onAutoEnhanceChange: (enabled: boolean) => void = () => {};
  private onPerformanceModeChange: (mode: PerformanceMode) => void = () => {};
  private onCopy: (text: string) => void = () => {};
  private onInsert: (text: string) => void = () => {};
  private onUndo: () => void = () => {};
  private onTooMuch: () => Promise<boolean> | boolean = () => false;
  private onClose: () => void = () => {};

  constructor() {}

  public init(
    cssText: string,
    callbacks: {
      onUseCaseChange: (useCase: UseCase) => void;
      onAutoEnhanceChange: (enabled: boolean) => void;
      onPerformanceModeChange: (mode: PerformanceMode) => void;
      onCopy: (text: string) => void;
      onInsert: (text: string) => void;
      onUndo: () => void;
      onTooMuch: () => Promise<boolean> | boolean;
      onClose: () => void;
    }
  ) {
    this.onUseCaseChange = callbacks.onUseCaseChange;
    this.onAutoEnhanceChange = callbacks.onAutoEnhanceChange;
    this.onPerformanceModeChange = callbacks.onPerformanceModeChange;
    this.onCopy = callbacks.onCopy;
    this.onInsert = callbacks.onInsert;
    this.onUndo = callbacks.onUndo;
    this.onTooMuch = callbacks.onTooMuch;
    this.onClose = callbacks.onClose;

    // Check if container already exists
    const existing = document.getElementById('prompt-enhancer-root');
    if (existing) {
      existing.remove();
    }

    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'prompt-enhancer-root';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.pointerEvents = 'none'; // click-through
    this.container.style.zIndex = '2147483647'; // max z-index
    document.body.appendChild(this.container);

    // Create Shadow DOM
    this.shadow = this.container.attachShadow({ mode: 'open' });

    // Inject Styles
    const styleEl = document.createElement('style');
    styleEl.textContent = cssText;
    this.shadow.appendChild(styleEl);

    // Create Bubble Element
    this.bubble = document.createElement('button');
    this.bubble.type = 'button';
    this.bubble.className = 'prompt-bubble';
    this.bubble.title = 'Enhance this Prompt';
    this.bubble.setAttribute('aria-label', 'Improve this prompt');
    this.bubble.setAttribute('aria-expanded', 'false');
    this.bubble.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor" opacity="0.3" />
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="currentColor" />
      </svg>
    `;
    this.shadow.appendChild(this.bubble);

    // Create Popup Element
    this.popup = document.createElement('div');
    this.popup.className = 'prompt-popup';
    this.shadow.appendChild(this.popup);

    // Bind event listeners
    const activateBubble = () => {
      const activeTextarea = (this.container as any)._activeElement;
      if (!activeTextarea) return;

      if (this.popup?.classList.contains('visible')) {
        this.hidePopup();
      } else {
        window.dispatchEvent(new CustomEvent('prompt-enhance-click'));
      }
    };

    // Gemini and similar editors re-render when their composer loses focus.
    // Activate on pointerdown and keep focus in the composer so the icon is
    // not detached before the later click event can run.
    this.bubble.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      event.preventDefault();
      activateBubble();
    });

    this.bubble.addEventListener('mousedown', (event) => {
      event.stopPropagation();
      event.preventDefault();
    });

    // Keyboard-triggered button clicks have detail 0 and no pointerdown.
    this.bubble.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      if (event.detail === 0) activateBubble();
    });

    // Close popup on click outside
    document.addEventListener('mousedown', (e) => {
      if (!this.popup || !this.bubble) return;

      // Check if target is inside our Shadow DOM container
      const path = e.composedPath();
      const isInsideShadow = path.includes(this.container!);

      if (!isInsideShadow && this.popup.classList.contains('visible')) {
        this.hidePopup();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.popup?.classList.contains('visible')) {
        this.hidePopup();
      }
    });
  }

  public updateBubblePosition(rect: DOMRect) {
    if (!this.bubble) return;

    const bubbleWidth = 32;
    const bubbleHeight = 32;

    const pageY = rect.top + window.scrollY;
    const pageX = rect.left + window.scrollX;

    // Position bubble inside the textarea at bottom right
    // Ensure we don't go outside the boundaries
    const top = pageY + rect.height - bubbleHeight - 6;
    const left = pageX + rect.width - bubbleWidth - 6;

    this.bubble.style.top = `${top}px`;
    this.bubble.style.left = `${left}px`;
    this.bubble.classList.add('visible');
  }

  public hideBubble() {
    this.bubble?.classList.remove('visible');
    this.setPulse(false);
  }

  public setPulse(pulse: boolean) {
    if (pulse) {
      this.bubble?.classList.add('pulse');
    } else {
      this.bubble?.classList.remove('pulse');
    }
  }

  public showPopup(
    rect: DOMRect,
    content: PopupContent,
    currentUseCase: UseCase,
    autoEnhanceEnabled: boolean,
    performanceMode: PerformanceMode
  ) {
    if (!this.popup || !this.bubble) return;

    this.renderPopupContent(content, currentUseCase, autoEnhanceEnabled, performanceMode);

    this.positionPopup();
    this.popup.classList.add('visible');
    this.bubble.setAttribute('aria-expanded', 'true');
  }

  public updatePopupPosition() {
    if (this.popup?.classList.contains('visible')) {
      this.positionPopup();
    }
  }

  private positionPopup() {
    if (!this.popup || !this.bubble) return;

    const bubbleTop = parseFloat(this.bubble.style.top);
    const bubbleLeft = parseFloat(this.bubble.style.left);

    // Position popup next to bubble
    const popupWidth = Math.min(380, window.innerWidth - 20);
    const popupHeight = 480;
    this.popup.style.width = `${popupWidth}px`;

    let top = bubbleTop + 38;
    let left = bubbleLeft - popupWidth + 32;

    // Check boundary limitations (viewport edges)
    if (left < 10) {
      left = 10;
    }
    const rightEdge = left + popupWidth;
    if (rightEdge > window.innerWidth - 10) {
      left = window.innerWidth - popupWidth - 10;
    }

    // Position above bubble if space is tight at bottom
    const bottomEdge = top + popupHeight;
    if (bottomEdge > window.innerHeight + window.scrollY - 10) {
      top = bubbleTop - popupHeight - 10;
      if (top < window.scrollY + 10) {
        top = window.scrollY + 10;
      }
    }

    this.popup.style.top = `${top}px`;
    this.popup.style.left = `${left}px`;
  }

  public hidePopup(notify = true) {
    this.popup?.classList.remove('visible');
    this.bubble?.setAttribute('aria-expanded', 'false');
    if (notify) this.onClose();
  }

  public isPopupVisible(): boolean {
    return this.popup?.classList.contains('visible') || false;
  }

  public keepPopupOpen() {
    this.popup?.classList.add('visible');
    this.bubble?.setAttribute('aria-expanded', 'true');
  }

  private renderPopupContent(
    content: PopupContent,
    currentUseCase: UseCase,
    autoEnhanceEnabled: boolean,
    performanceMode: PerformanceMode
  ) {
    if (!this.popup) return;

    const originalText = content.originalText || '';
    const rewrittenText = content.improvedPrompt || content.copyableText || originalText;
    const presentation =
      content.rewriteStatus && content.rewriteStatus !== 'loading'
        ? describeRewritePresentation({
            original: originalText,
            rewritten: rewrittenText,
            status: content.rewriteStatus,
            source:
              content.rewriteStatus === 'no_change'
                ? 'checkmark'
                : content.rewriteStatus === 'error'
                  ? 'error'
                  : content.rewriteSource === 'model'
                    ? 'model'
                    : 'local_fallback',
            mode: performanceMode,
            intervention: content.intervention,
            validationReason: content.validationReason,
            error: content.modelError || null
          })
        : null;

    // Header HTML
    const subtitle =
      content.rewriteStatus === 'loading'
        ? 'Improving with local AI…'
        : presentation
          ? `${presentation.subtitle} · ${this.formatMode(performanceMode)} · ${this.formatIntervention(presentation.intervention)}`
          : 'Draft reviewed locally';

    const headerHTML = `
      <div class="popup-header">
        <div class="popup-title-area">
          <div class="popup-title-logo">
            <svg fill="none" viewBox="0 0 24 24">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div>
            <div class="popup-title">Prompt Grammarly <span class="popup-version">v${this.escapeHtml(typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev')}</span></div>
            <div class="popup-subtitle">${subtitle}</div>
          </div>
        </div>
        <button class="popup-close-btn" id="pe-close-btn" aria-label="Close suggestion">
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    if (content.rewriteStatus === 'loading') {
      this.popup.innerHTML = `
        ${headerHTML}
        <div class="model-loading-state" role="status" aria-live="polite">
          <div class="model-loading-spinner" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="model-loading-title">Improving your prompt…</div>
          <div class="model-loading-text">
            The local model is checking spelling, grammar, and clarity without adding new instructions. Copy and insert will become available when the final version is ready.
          </div>
          <div class="model-loading-dots" aria-hidden="true">
            <i></i><i></i><i></i>
          </div>
        </div>
      `;
      this.bindPopupEvents(content);
      return;
    }

    if (content.rewriteStatus === 'error') {
      this.popup.innerHTML = `
        ${headerHTML}
        <div class="popup-body">
          <div class="result-state result-error" role="alert">
            <div class="result-state-icon" aria-hidden="true">!</div>
            <div>
              <strong>${this.escapeHtml(presentation?.title || 'Local rewrite unavailable')}</strong>
              <small>${this.escapeHtml(presentation?.message || 'The local service is unavailable right now.')}</small>
            </div>
          </div>

          <div class="comparison-stack">
            <div class="comparison-column">
              <div class="section-label">Original</div>
              <div class="comparison-box comparison-box-muted">${this.escapeHtml(originalText)}</div>
            </div>
          </div>

          <div class="result-meta">${this.escapeHtml(presentation?.validationReasonText || 'Local rewrite unavailable')}</div>
          ${content.diagnosticHint ? `<div class="result-meta">${this.escapeHtml(content.diagnosticHint)}</div>` : ''}
        </div>
      `;
      this.bindPopupEvents(content);
      return;
    }

    if (!content.isPrompt || !content.analysis) {
      // Empty/Initial State
      this.popup.innerHTML = `
        ${headerHTML}
        <div class="popup-body">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" viewBox="0 0 24 24">
                <path d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 113.536 0V17h-3.536z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="empty-state-title">No Prompt Detected</div>
            <div class="empty-state-text">
              We couldn't detect a detailed prompt in this text box yet. Keep typing or select a Use Case to force an enhancement.
            </div>
          </div>
          
          <div class="use-case-section">
            <div class="section-label">Force Analysis as:</div>
            <div class="use-case-select-wrapper">
              <select class="use-case-select" id="pe-use-case-select">
                ${USE_CASES.map((uc) => `<option value="${uc.value}" ${uc.value === currentUseCase ? 'selected' : ''}>${uc.label}</option>`).join('')}
              </select>
            </div>
          </div>
          ${this.renderAutoEnhanceControl(autoEnhanceEnabled)}
        </div>
      `;
      this.bindPopupEvents(content);
      return;
    }

    const { analysis } = content;
    const score = analysis.overallScore;
    const label = analysis.label;
    const labelLower = label.toLowerCase() as 'weak' | 'decent' | 'strong' | 'excellent';

    // Calculate circular gauge offset (dasharray is 145)
    // 0 score = 145 dashoffset, 100 score = 0 dashoffset
    const offset = 145 - (145 * score) / 100;

    // Render Critique Items
    const issues = analysis.issues
      .slice(0, 3)
      .map(
        (issue) => `
      <div class="critique-item issue">
        <span class="critique-icon">⚠️</span>
        <span class="critique-text"><strong>${this.escapeHtml(issue.title)}:</strong> ${this.escapeHtml(issue.suggestion)}</span>
      </div>
    `
      )
      .join('');

    const strengths = analysis.strengths
      .slice(0, 2)
      .map(
        (strength) => `
      <div class="critique-item strength">
        <span class="critique-icon">✨</span>
        <span class="critique-text">${this.escapeHtml(strength)}</span>
      </div>
    `
      )
      .join('');

    const comparisonHTML =
      presentation && presentation.showComparison
        ? `
          <div class="comparison-stack">
            <div class="comparison-column">
              <div class="section-label">${this.escapeHtml(presentation.originalLabel)}</div>
              <div class="comparison-box ${presentation.kind === 'no_change' ? 'comparison-box-check' : ''}">${this.escapeHtml(
                originalText
              )}</div>
            </div>
            <div class="comparison-column">
              <div class="section-label">${this.escapeHtml(presentation.rewrittenLabel)}</div>
              <textarea class="improved-textarea" id="pe-improved-textarea" aria-label="Editable enhanced prompt">${this.escapeHtml(
                rewrittenText
              )}</textarea>
            </div>
          </div>
        `
        : '';

    const statusHTML = presentation
      ? `
        <div class="result-state result-${presentation.kind}">
          <div class="result-state-icon" aria-hidden="true">${presentation.showCheckmark ? '✓' : 'i'}</div>
          <div>
            <strong>${this.escapeHtml(presentation.title)}</strong>
            <small>${this.escapeHtml(presentation.message)}</small>
          </div>
        </div>
        <div class="result-meta">${this.escapeHtml(
          presentation.validationReasonText ||
            `Intervention: ${this.formatIntervention(presentation.intervention)}`
        )}</div>
        ${presentation.kind === 'fallback' && content.diagnosticHint ? `<div class="result-meta">${this.escapeHtml(content.diagnosticHint)}</div>` : ''}
      `
      : '';

    const isError = presentation?.kind === 'error';
    const copyButtonLabel = isError ? 'Copy Original' : 'Copy';
    const insertButtonLabel = presentation?.kind === 'no_change' ? 'Insert Original' : 'Insert Prompt';
    const insertHidden = isError || presentation?.showInsert === false;

    const bodyHTML = `
      <div class="popup-body">
        ${statusHTML}
        ${comparisonHTML}

        <!-- Review stays collapsed until requested -->
        <details class="prompt-review-details" ${isError ? 'hidden' : ''}>
          <summary>
            <span class="review-summary-copy">
              <span class="review-closed-label">View prompt review</span>
              <span class="review-open-label">Hide prompt review</span>
            </span>
            <svg class="review-chevron" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </summary>
          <div class="prompt-review-content">
            <div class="score-card">
              <div class="score-visual">
                <svg class="score-circle-svg">
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#34d399" />
                      <stop offset="100%" stop-color="#60a5fa" />
                    </linearGradient>
                  </defs>
                  <circle class="score-circle-bg" cx="26" cy="26" r="23" />
                  <circle class="score-circle-fill" cx="26" cy="26" r="23" style="stroke-dashoffset: ${offset};" />
                </svg>
                <div class="score-value">${score}</div>
              </div>
              <div class="score-details">
                <div class="score-label ${labelLower}">${label} Quality</div>
                <div class="score-summary">${this.escapeHtml(analysis.summary || 'Analyze detailed prompt structure.')}</div>
              </div>
            </div>

            <div class="critique-section">
              <div class="section-label">Suggestions & Strengths</div>
              <div class="critique-list">
                ${issues}
                ${strengths}
                ${analysis.issues.length === 0 && analysis.strengths.length === 0 ? '<div class="critique-item strength">Looking excellent! Ready to use.</div>' : ''}
              </div>
            </div>

            <div class="use-case-section">
              <div class="section-label">Use Case</div>
              <div class="use-case-select-wrapper">
                <select class="use-case-select" id="pe-use-case-select">
                  ${USE_CASES.map((uc) => `<option value="${uc.value}" ${uc.value === currentUseCase ? 'selected' : ''}>${uc.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="use-case-section">
              <div class="section-label">Performance</div>
              <div class="use-case-select-wrapper">
                <select class="use-case-select" id="pe-performance-mode" aria-label="Performance mode">
                  <option value="fast" ${performanceMode === 'fast' ? 'selected' : ''}>Fast</option>
                  <option value="balanced" ${performanceMode === 'balanced' ? 'selected' : ''}>Balanced</option>
                  <option value="quality" ${performanceMode === 'quality' ? 'selected' : ''}>Quality</option>
                </select>
              </div>
            </div>
            ${this.renderAutoEnhanceControl(autoEnhanceEnabled)}
          </div>
        </details>
      </div>

      <!-- Action Buttons -->
      <div class="popup-footer">
        <button class="footer-btn btn-secondary" id="pe-undo-btn" type="button" hidden>Undo</button>
        <button class="footer-btn btn-secondary" id="pe-copy-btn">
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-7 8H8" stroke="round" stroke-linejoin="round"/>
          </svg>
          ${copyButtonLabel}
        </button>
        <button class="footer-btn btn-secondary" id="pe-too-much-btn" type="button">Too much</button>
        <button class="footer-btn btn-primary" id="pe-insert-btn" ${insertHidden ? 'hidden' : ''}>
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" stroke="round" stroke-linejoin="round"/>
          </svg>
          ${insertButtonLabel}
        </button>
      </div>
    `;

    this.popup.innerHTML = headerHTML + bodyHTML;
    this.bindPopupEvents(content);
  }

  private bindPopupEvents(content: PopupContent) {
    if (!this.popup) return;

    // Close button
    const closeBtn = this.popup.querySelector('#pe-close-btn');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hidePopup();
    });

    const retryBtn = this.popup.querySelector('#pe-retry-btn');
    retryBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hidePopup(false);
      window.dispatchEvent(new CustomEvent('prompt-enhance-click'));
    });

    // Use Case Dropdown
    const select = this.popup.querySelector('#pe-use-case-select') as HTMLSelectElement | null;
    select?.addEventListener('change', () => {
      if (select.value) {
        this.onUseCaseChange(select.value as UseCase);
      }
    });

    const autoEnhance = this.popup.querySelector('#pe-auto-enhance') as HTMLInputElement | null;
    autoEnhance?.addEventListener('change', () => {
      this.onAutoEnhanceChange(autoEnhance.checked);
    });

    const performanceMode = this.popup.querySelector('#pe-performance-mode') as HTMLSelectElement | null;
    performanceMode?.addEventListener('change', () => {
      this.onPerformanceModeChange(performanceMode.value as PerformanceMode);
    });

    // Copy Button
    const copyBtn = this.popup.querySelector('#pe-copy-btn') as HTMLButtonElement | null;
    copyBtn?.addEventListener('click', () => {
      const textarea = this.popup?.querySelector('#pe-improved-textarea') as HTMLTextAreaElement | null;
      const textToCopy =
        content.rewriteStatus === 'error'
          ? content.originalText || ''
          : textarea
            ? textarea.value
            : content.improvedPrompt || content.originalText || '';

      if (textToCopy) {
        this.onCopy(textToCopy);

        // Show success animation
        if (copyBtn) {
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          `;
          copyBtn.style.background = '#059669'; // Emerald green
          copyBtn.style.color = '#ffffff';
          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.style.background = '';
            copyBtn.style.color = '';
          }, 1500);
        }
      }
    });

    // Insert Button
    const insertBtn = this.popup.querySelector('#pe-insert-btn') as HTMLButtonElement | null;
    const undoBtn = this.popup.querySelector('#pe-undo-btn') as HTMLButtonElement | null;
    const tooMuchBtn = this.popup.querySelector('#pe-too-much-btn') as HTMLButtonElement | null;

    tooMuchBtn?.addEventListener('click', () => {
      const saved = this.onTooMuch();
      Promise.resolve(saved).then((didSave) => {
        if (!didSave || !tooMuchBtn) return;
        const originalHTML = tooMuchBtn.innerHTML;
        tooMuchBtn.innerHTML = 'Saved locally';
        tooMuchBtn.style.background = '#0f766e';
        tooMuchBtn.style.color = '#ffffff';
        setTimeout(() => {
          tooMuchBtn.innerHTML = originalHTML;
          tooMuchBtn.style.background = '';
          tooMuchBtn.style.color = '';
        }, 1500);
      });
    });

    undoBtn?.addEventListener('click', () => {
      this.onUndo();
      undoBtn.hidden = true;
    });
    insertBtn?.addEventListener('click', () => {
      const textarea = this.popup?.querySelector('#pe-improved-textarea') as HTMLTextAreaElement | null;
      const textToInsert =
        content.rewriteStatus === 'error'
          ? ''
          : textarea
            ? textarea.value
            : content.improvedPrompt || content.originalText || '';

      if (textToInsert) {
        this.onInsert(textToInsert);
        if (undoBtn) undoBtn.hidden = false;

        // Show success animation
        if (insertBtn) {
          const originalHTML = insertBtn.innerHTML;
          insertBtn.innerHTML = `
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            Inserted!
          `;
          insertBtn.style.background = '#059669';
          setTimeout(() => {
            insertBtn.innerHTML = originalHTML;
            insertBtn.style.background = '';
            insertBtn.textContent = 'Insert Prompt';
          }, 1000);
        }
      }
    });
  }

  public setActiveElement(el: HTMLElement | null) {
    if (this.container) {
      (this.container as any)._activeElement = el;
    }
  }

  private renderAutoEnhanceControl(enabled: boolean): string {
    return `
      <label class="auto-enhance-control">
        <span class="auto-enhance-copy">
          <strong>Auto-open suggestions</strong>
          <small>Runs on this device after you pause typing</small>
        </span>
        <input type="checkbox" id="pe-auto-enhance" ${enabled ? 'checked' : ''}>
        <span class="auto-enhance-switch" aria-hidden="true"></span>
      </label>
    `;
  }

  private formatMode(mode: PerformanceMode): string {
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  }

  private formatIntervention(intervention: string): string {
    if (intervention === 'strict') return 'Strict intervention';
    if (intervention === 'polished') return 'Polished intervention';
    return 'Normal intervention';
  }

  private escapeHtml(value: string): string {
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
}
