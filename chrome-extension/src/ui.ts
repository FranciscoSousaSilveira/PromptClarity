import type { UseCase } from '../../types/prompt';
import type { PopupContent } from '../../lib/promptIntegration';

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
  private onCopy: (text: string) => void = () => {};
  private onInsert: (text: string) => void = () => {};
  private onClose: () => void = () => {};

  constructor() {}

  public init(
    cssText: string,
    callbacks: {
      onUseCaseChange: (useCase: UseCase) => void;
      onAutoEnhanceChange: (enabled: boolean) => void;
      onCopy: (text: string) => void;
      onInsert: (text: string) => void;
      onClose: () => void;
    }
  ) {
    this.onUseCaseChange = callbacks.onUseCaseChange;
    this.onAutoEnhanceChange = callbacks.onAutoEnhanceChange;
    this.onCopy = callbacks.onCopy;
    this.onInsert = callbacks.onInsert;
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
      
      const target = e.target as HTMLElement;
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

  public showPopup(rect: DOMRect, content: PopupContent, currentUseCase: UseCase, autoEnhanceEnabled: boolean) {
    if (!this.popup || !this.bubble) return;

    this.renderPopupContent(content, currentUseCase, autoEnhanceEnabled);

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

  private renderPopupContent(content: PopupContent, currentUseCase: UseCase, autoEnhanceEnabled: boolean) {
    if (!this.popup) return;

    // Header HTML
    let headerHTML = `
      <div class="popup-header">
        <div class="popup-title-area">
          <div class="popup-title-logo">
            <svg fill="none" viewBox="0 0 24 24">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div>
            <div class="popup-title">Prompt Grammarly</div>
            <div class="popup-subtitle">Draft reviewed locally</div>
          </div>
        </div>
        <button class="popup-close-btn" id="pe-close-btn" aria-label="Close suggestion">
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

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
                ${USE_CASES.map(uc => `<option value="${uc.value}" ${uc.value === currentUseCase ? 'selected' : ''}>${uc.label}</option>`).join('')}
              </select>
            </div>
          </div>
          ${this.renderAutoEnhanceControl(autoEnhanceEnabled)}
        </div>
      `;
      this.bindPopupEvents(content);
      return;
    }

    const { analysis, improvedPrompt } = content;
    const score = analysis.overallScore;
    const label = analysis.label;
    const labelLower = label.toLowerCase() as 'weak' | 'decent' | 'strong' | 'excellent';

    // Calculate circular gauge offset (dasharray is 145)
    // 0 score = 145 dashoffset, 100 score = 0 dashoffset
    const offset = 145 - (145 * score) / 100;

    // Render Critique Items
    const issues = analysis.issues.slice(0, 3).map(issue => `
      <div class="critique-item issue">
        <span class="critique-icon">⚠️</span>
        <span class="critique-text"><strong>${this.escapeHtml(issue.title)}:</strong> ${this.escapeHtml(issue.suggestion)}</span>
      </div>
    `).join('');

    const strengths = analysis.strengths.slice(0, 2).map(strength => `
      <div class="critique-item strength">
        <span class="critique-icon">✨</span>
        <span class="critique-text">${this.escapeHtml(strength)}</span>
      </div>
    `).join('');

    const bodyHTML = `
      <div class="popup-body">
        <!-- Use Case Selector -->
        <div class="use-case-section">
          <div class="section-label">Use Case</div>
          <div class="use-case-select-wrapper">
            <select class="use-case-select" id="pe-use-case-select">
              ${USE_CASES.map(uc => `<option value="${uc.value}" ${uc.value === currentUseCase ? 'selected' : ''}>${uc.label}</option>`).join('')}
            </select>
          </div>
        </div>
        ${this.renderAutoEnhanceControl(autoEnhanceEnabled)}

        <!-- Score Ring Card -->
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

        <!-- Issues and Strengths Critique -->
        <div class="critique-section">
          <div class="section-label">Suggestions & Strengths</div>
          <div class="critique-list">
            ${issues}
            ${strengths}
            ${analysis.issues.length === 0 && analysis.strengths.length === 0 ? '<div class="critique-item strength">Looking excellent! Ready to use.</div>' : ''}
          </div>
        </div>

        <!-- Improved Text Box -->
        <div class="improved-box-section">
          <div class="section-label">Enhanced Prompt</div>
          <div class="improved-container">
            <textarea class="improved-textarea" id="pe-improved-textarea" readonly>${this.escapeHtml(improvedPrompt || '')}</textarea>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="popup-footer">
        <button class="footer-btn btn-secondary" id="pe-copy-btn">
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-7 8H8" stroke="round" stroke-linejoin="round"/>
          </svg>
          Copy
        </button>
        <button class="footer-btn btn-primary" id="pe-insert-btn">
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" stroke="round" stroke-linejoin="round"/>
          </svg>
          Insert Prompt
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

    // Copy Button
    const copyBtn = this.popup.querySelector('#pe-copy-btn') as HTMLButtonElement | null;
    copyBtn?.addEventListener('click', () => {
      const textarea = this.popup?.querySelector('#pe-improved-textarea') as HTMLTextAreaElement | null;
      const textToCopy = textarea ? textarea.value : content.improvedPrompt || '';
      
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
    insertBtn?.addEventListener('click', () => {
      const textarea = this.popup?.querySelector('#pe-improved-textarea') as HTMLTextAreaElement | null;
      const textToInsert = textarea ? textarea.value : content.improvedPrompt || '';
      
      if (textToInsert) {
        this.onInsert(textToInsert);
        
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
            if (insertBtn.isConnected && this.popup?.classList.contains('visible')) {
              this.hidePopup();
            }
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

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[character] || character);
  }
}
