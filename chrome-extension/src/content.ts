import { analyzeForPopup, shouldShowHint, type PopupContent } from '../../lib/promptIntegration';
import { analyzePrompt } from '../../lib/promptAnalyzer';
import type { UseCase } from '../../types/prompt';
import { PromptEnhancerUI } from './ui';

// Declare compile-time global injected by esbuild
declare const __CSS_TEXT__: string;
declare const chrome: any;

class PromptEnhancerExtension {
  private ui = new PromptEnhancerUI();
  private activeElement: HTMLTextAreaElement | HTMLInputElement | HTMLElement | null = null;
  private currentUseCase: UseCase = 'general';
  private autoEnhanceEnabled = true;
  private resizeObserver: ResizeObserver | null = null;
  private positionFrame: number | null = null;
  private analysisTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAnalyzedSignature = '';
  private dismissedSignature = '';

  private static readonly AUTO_ANALYZE_DELAY = 900;

  constructor() {}

  public async init() {
    // Load saved use case from storage if available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(['defaultUseCase', 'autoEnhanceEnabled']);
      if (data.defaultUseCase) {
        this.currentUseCase = data.defaultUseCase as UseCase;
      }
      if (typeof data.autoEnhanceEnabled === 'boolean') {
        this.autoEnhanceEnabled = data.autoEnhanceEnabled;
      }
    }

    // Initialize UI
    const cssText = typeof __CSS_TEXT__ !== 'undefined' ? __CSS_TEXT__ : '';
    this.ui.init(cssText, {
      onUseCaseChange: (useCase) => this.handleUseCaseChange(useCase),
      onAutoEnhanceChange: (enabled) => this.handleAutoEnhanceChange(enabled),
      onCopy: (text) => this.handleCopy(text),
      onInsert: (text) => this.handleInsert(text),
      onClose: () => this.handleClose()
    });

    // Listen to focus changes
    document.addEventListener('focusin', (e) => this.handleFocusIn(e));
    document.addEventListener('focusout', (e) => this.handleFocusOut(e));

    // Listen for custom trigger event from bubble click
    window.addEventListener('prompt-enhance-click', () => this.runAnalysis(true));

    // Track scroll and resize events so the controls stay attached to dynamic chat inputs.
    this.setupPositionTracking();
  }

  private handleFocusIn(e: FocusEvent) {
    const target = this.findEditableTarget(e.target);
    if (target) {
      if (this.activeElement && this.activeElement !== target) {
        this.activeElement.removeEventListener('input', this.handleInput);
        this.ui.hidePopup(false);
      }

      this.activeElement = target;
      this.ui.setActiveElement(target);
      
      // Update position immediately
      this.updateUI();

      // Listen for inputs to determine if text is a prompt (show/pulse bubble)
      target.removeEventListener('input', this.handleInput);
      target.addEventListener('input', this.handleInput);

      // Start observing element resize
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
      this.resizeObserver = new ResizeObserver(() => this.updateUI());
      this.resizeObserver.observe(target);

      this.handleInput();
    }
  }

  private handleFocusOut(e: FocusEvent) {
    const target = e.target as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;

    // Check if the focus has moved to our extension UI
    const isMovingToExtension = relatedTarget && 
      (relatedTarget.id === 'prompt-enhancer-root' || 
       relatedTarget.closest('#prompt-enhancer-root'));

    if (this.activeElement === target && !isMovingToExtension) {
      // Don't immediately clear, let bubble stay visible for a second or if it has text
      setTimeout(() => {
        if (this.activeElement === target && document.activeElement !== target) {
          // If we clicked our bubble or popup, do not hide
          const focusedInShadow = this.activeElement.getRootNode() === document ? false : true;
          if (!this.ui.isPopupVisible() && !focusedInShadow) {
            this.ui.hideBubble();
          }
        }
      }, 200);
    }
  }

  private handleInput = () => {
    if (!this.activeElement) return;

    const text = this.getInputText(this.activeElement).trim();
    const signature = this.textSignature(text);
    const isLikelyPrompt = shouldShowHint(text);

    if (this.ui.isPopupVisible() && signature !== this.lastAnalyzedSignature) {
      this.ui.hidePopup(false);
    }

    this.ui.setPulse(isLikelyPrompt);
    this.updateUI();
    this.scheduleAutomaticAnalysis(text, isLikelyPrompt);
  };

  private scheduleAutomaticAnalysis(text: string, isLikelyPrompt: boolean) {
    this.clearAnalysisTimer();
    const signature = this.textSignature(text);

    if (
      !this.autoEnhanceEnabled ||
      !isLikelyPrompt ||
      text.length < 12 ||
      signature === this.lastAnalyzedSignature ||
      signature === this.dismissedSignature ||
      this.looksLikeGeneratedRewrite(text)
    ) {
      return;
    }

    this.analysisTimer = setTimeout(() => {
      this.analysisTimer = null;
      if (!this.activeElement) return;

      const currentText = this.getInputText(this.activeElement).trim();
      if (this.textSignature(currentText) === signature && shouldShowHint(currentText)) {
        this.runAnalysis(false);
      }
    }, PromptEnhancerExtension.AUTO_ANALYZE_DELAY);
  }

  private clearAnalysisTimer() {
    if (this.analysisTimer) {
      clearTimeout(this.analysisTimer);
      this.analysisTimer = null;
    }
  }

  private handleUseCaseChange(useCase: UseCase) {
    this.currentUseCase = useCase;
    
    // Save to storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ defaultUseCase: useCase });
    }

    // Re-run analysis with new use case
    this.dismissedSignature = '';
    this.runAnalysis(true);
  }

  private handleAutoEnhanceChange(enabled: boolean) {
    this.autoEnhanceEnabled = enabled;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ autoEnhanceEnabled: enabled });
    }

    if (!enabled) {
      this.clearAnalysisTimer();
      this.ui.setPulse(false);
      return;
    }

    if (this.activeElement) {
      const text = this.getInputText(this.activeElement).trim();
      this.dismissedSignature = '';
      this.scheduleAutomaticAnalysis(text, shouldShowHint(text));
    }
  }

  private handleCopy(text: string) {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error('Failed to copy to clipboard:', err);
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    });
  }

  private handleInsert(text: string) {
    const el = this.activeElement;
    if (!el) return;

    this.clearAnalysisTimer();
    this.lastAnalyzedSignature = this.textSignature(text);
    this.dismissedSignature = this.textSignature(text);

    // Refocus element
    el.focus();

    if (this.isContentEditable(el)) {
      // Gemini uses a Quill-style editor which can collapse multiline
      // execCommand inserts to the first paragraph. Write paragraph nodes for
      // that editor and keep a verified fallback for other rich-text fields.
      try {
        if (location.hostname === 'gemini.google.com' || el.classList.contains('ql-editor')) {
          this.replaceRichTextContent(el, text);
        } else {
          el.innerHTML = '';
          const selection = window.getSelection();
          if (selection) {
            selection.selectAllChildren(el);
            selection.collapseToEnd();
          }
          const inserted = document.execCommand('insertText', false, text);
          if (!inserted) throw new Error('insertText was rejected');
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        }
      } catch (e) {
        this.replaceRichTextContent(el, text);
      }

      window.setTimeout(() => {
        if (this.normalizeText(this.getInputText(el)) !== this.normalizeText(text)) {
          this.replaceRichTextContent(el, text);
        }
      }, 80);
    } else {
      // For standard inputs/textareas
      const inputEl = el as HTMLTextAreaElement | HTMLInputElement;
      
      const prototype = inputEl instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      setter?.call(inputEl, text);
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    this.ui.setPulse(false);
  }

  private handleClose() {
    this.clearAnalysisTimer();
    if (this.activeElement) {
      this.dismissedSignature = this.textSignature(this.getInputText(this.activeElement));
    }
    // Return focus to text box
    this.activeElement?.focus();
  }

  private runAnalysis(force: boolean) {
    if (!this.activeElement) return;

    const text = this.getInputText(this.activeElement).trim();
    if (text.length < 2) return;
    const rect = this.activeElement.getBoundingClientRect();

    // Call local library analyzer
    const content: PopupContent = analyzeForPopup({
      text,
      useCase: this.currentUseCase
    });

    // Automatic analysis stays quiet on uncertain text. A manual bubble click
    // can still force an enhancement for a short or unusual prompt.
    if (!content.isPrompt || !content.analysis) {
      if (!force) return;
      const forceContent = this.forceAnalysisFallback(text);
      this.lastAnalyzedSignature = this.textSignature(text);
      this.ui.showPopup(rect, forceContent, this.currentUseCase, this.autoEnhanceEnabled);
    } else {
      this.lastAnalyzedSignature = this.textSignature(text);
      this.ui.showPopup(rect, content, this.currentUseCase, this.autoEnhanceEnabled);
    }
  }

  private forceAnalysisFallback(text: string): PopupContent {
    // If it's too short, return blank
    if (!text || text.trim().length < 2) {
      return { isPrompt: false, detectionConfidence: 0 };
    }

    try {
      // Run analysis directly even if it failed the detector threshold
      const analysis = analyzePrompt(text, this.currentUseCase);
      return {
        isPrompt: true,
        detectionConfidence: 0.5,
        analysis,
        improvedPrompt: analysis.rewrittenPrompt,
        copyableText: analysis.rewrittenPrompt
      };
    } catch (e) {
      return {
        isPrompt: true,
        detectionConfidence: 0.5,
        improvedPrompt: text,
        copyableText: text
      };
    }
  }

  private setupPositionTracking() {
    const scheduleUpdate = () => {
      if (this.positionFrame !== null) return;

      this.positionFrame = window.requestAnimationFrame(() => {
        this.positionFrame = null;
        if (this.activeElement && document.activeElement === this.activeElement) {
          this.updateUI();
        }
      });
    };

    window.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
  }

  private updateUI() {
    if (!this.activeElement) return;

    // Check if element is still visible/mounted
    const rect = this.activeElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      this.ui.hideBubble();
      this.ui.hidePopup(false);
      return;
    }

    this.ui.updateBubblePosition(rect);

    if (this.ui.isPopupVisible()) {
      this.ui.updatePopupPosition();
    }
  }

  // Helper Utilities
  private isValidInputField(el: HTMLElement): boolean {
    const tagName = el.tagName.toLowerCase();
    const isTextarea = tagName === 'textarea';
    const isTextInput = tagName === 'input' && (el as HTMLInputElement).type === 'text';
    const isContentEdit = this.isContentEditable(el);

    // Ignore tiny inputs (like small search bars < 80px wide) or password inputs, email inputs, etc.
    if (isTextInput && el.getBoundingClientRect().width < 120) {
      return false;
    }

    return isTextarea || isTextInput || isContentEdit;
  }

  private findEditableTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;

    const candidate = target.closest<HTMLElement>('textarea, input[type="text"], [contenteditable="true"]');
    return candidate && this.isValidInputField(candidate) ? candidate : null;
  }

  private replaceRichTextContent(el: HTMLElement, text: string) {
    const fragment = document.createDocumentFragment();
    const blocks = text
      .replace(/\r\n/g, '\n')
      .trim()
      .split(/\n{2,}/)
      .filter(Boolean);

    for (const block of blocks) {
      const paragraph = document.createElement('p');
      const lines = block.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) paragraph.appendChild(document.createElement('br'));
        paragraph.appendChild(document.createTextNode(line));
      });
      if (paragraph.childNodes.length === 0) {
        paragraph.appendChild(document.createElement('br'));
      }
      fragment.appendChild(paragraph);
    }

    el.replaceChildren(fragment);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private normalizeText(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private textSignature(text: string): string {
    return this.normalizeText(text).replace(/\s+/g, ' ').trim();
  }

  private looksLikeGeneratedRewrite(text: string): boolean {
    const normalized = this.normalizeText(text);
    const structured = /^(Role|Papel):/i.test(normalized) &&
      /\n+(Context|Contexto):/i.test(normalized) &&
      /\n+(Task|Tarefa):/i.test(normalized);
    const compactQuestion = /^(Answer the question|Responde à pergunta):/i.test(normalized);
    return structured || compactQuestion;
  }

  private isContentEditable(el: HTMLElement): boolean {
    return el.isContentEditable || el.getAttribute('contenteditable') === 'true';
  }

  private getInputText(el: HTMLElement): string {
    if (this.isContentEditable(el)) {
      return el.innerText || '';
    }
    return (el as HTMLTextAreaElement | HTMLInputElement).value || '';
  }
}

// Instantiate and initialize
const extension = new PromptEnhancerExtension();
extension.init().catch(console.error);
