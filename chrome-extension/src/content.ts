import { analyzeForPopup, shouldShowHint, type PopupContent } from '../../lib/promptIntegration';
import type { UseCase } from '../../types/prompt';
import { PromptEnhancerUI } from './ui';

// Declare compile-time global injected by esbuild
declare const __CSS_TEXT__: string;
declare const chrome: any;

class PromptEnhancerExtension {
  private ui = new PromptEnhancerUI();
  private activeElement: HTMLTextAreaElement | HTMLInputElement | HTMLElement | null = null;
  private currentUseCase: UseCase = 'general';
  private resizeObserver: ResizeObserver | null = null;
  private positionFrame: number | null = null;

  constructor() {}

  public async init() {
    // Load saved use case from storage if available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get('defaultUseCase');
      if (data.defaultUseCase) {
        this.currentUseCase = data.defaultUseCase as UseCase;
      }
    }

    // Initialize UI
    const cssText = typeof __CSS_TEXT__ !== 'undefined' ? __CSS_TEXT__ : '';
    this.ui.init(cssText, {
      onUseCaseChange: (useCase) => this.handleUseCaseChange(useCase),
      onCopy: (text) => this.handleCopy(text),
      onInsert: (text) => this.handleInsert(text),
      onClose: () => this.handleClose()
    });

    // Listen to focus changes
    document.addEventListener('focusin', (e) => this.handleFocusIn(e));
    document.addEventListener('focusout', (e) => this.handleFocusOut(e));

    // Listen for custom trigger event from bubble click
    window.addEventListener('prompt-enhance-click', () => this.runAnalysis());

    // Setup periodic polling to adjust position (since pages can dynamically resize/reposition textareas)
    this.setupPositionTracking();
  }

  private handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;
    if (this.isValidInputField(target)) {
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

    const text = this.getInputText(this.activeElement);
    const isLikelyPrompt = shouldShowHint(text);
    
    this.ui.setPulse(isLikelyPrompt);
    this.updateUI();
  };

  private handleUseCaseChange(useCase: UseCase) {
    this.currentUseCase = useCase;
    
    // Save to storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ defaultUseCase: useCase });
    }

    // Re-run analysis with new use case
    this.runAnalysis();
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

    // Refocus element
    el.focus();

    if (this.isContentEditable(el)) {
      // For contenteditable, try selection document.execCommand first
      try {
        el.innerHTML = '';
        const selection = window.getSelection();
        if (selection) {
          selection.selectAllChildren(el);
          selection.collapseToEnd();
        }
        document.execCommand('insertText', false, text);
      } catch (e) {
        el.innerText = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      // For standard inputs/textareas
      const inputEl = el as HTMLTextAreaElement | HTMLInputElement;
      
      try {
        // Use select and execCommand to preserve undo stack and update frameworks
        inputEl.select();
        document.execCommand('insertText', false, text);
      } catch (e) {
        // Fallback for newer frameworks / edge cases
        inputEl.value = text;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    this.ui.setPulse(false);
  }

  private handleClose() {
    // Return focus to text box
    this.activeElement?.focus();
  }

  private runAnalysis() {
    if (!this.activeElement) return;

    const text = this.getInputText(this.activeElement);
    const rect = this.activeElement.getBoundingClientRect();

    // Call local library analyzer
    const content: PopupContent = analyzeForPopup({
      text,
      useCase: this.currentUseCase
    });

    // If analysis did not detect prompt structure, we still force it to display
    // using the text since they explicitly clicked the bubble
    if (!content.isPrompt || !content.analysis) {
      const forceContent = this.forceAnalysisFallback(text);
      this.ui.showPopup(rect, forceContent, this.currentUseCase);
    } else {
      this.ui.showPopup(rect, content, this.currentUseCase);
    }
  }

  private forceAnalysisFallback(text: string): PopupContent {
    // If it's too short, return blank
    if (!text || text.trim().length < 2) {
      return { isPrompt: false, detectionConfidence: 0 };
    }

    try {
      // Run analysis directly even if it failed the detector threshold
      const { analyzePrompt } = require('../../lib/promptAnalyzer');
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
      this.ui.hidePopup();
      return;
    }

    this.ui.updateBubblePosition(rect);

    // If popup is open, update its position relative to bubble too
    if (this.ui.isPopupVisible()) {
      const text = this.getInputText(this.activeElement);
      // We don't want to re-run full analysis on scroll/resize, just update position.
      // We can do this by letting the UI adjust. We'll pass a dummy content or let UI class handle it.
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
