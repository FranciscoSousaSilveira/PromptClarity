import { analyzeForPopup, shouldShowHint, type PopupContent } from '../../lib/promptIntegration';
import { analyzePrompt } from '../../lib/promptAnalyzer';
import { DEFAULT_REWRITE_ENDPOINT, rewritePromptWithModel } from '../../lib/modelPromptRewriter';
import type { UseCase } from '../../types/prompt';
import type { PerformanceMode } from '../../config/product';
import { PromptEnhancerUI } from './ui';
import { findAdapterComposer, getSiteAdapter } from './siteAdapters';
import { buildTooMuchFeedbackEntry, type TooMuchFeedbackEntry } from '../../lib/popupState';
import { ExtensionContextLifecycle, getChromeApi, readChromeRuntimeLastError } from './runtimeSafety';
import { createRewriteDiagnostics, describeRewriteDiagnostic } from '../../lib/diagnostics';

// Declare compile-time global injected by esbuild
declare const __CSS_TEXT__: string;
const extensionContextLifecycle = new ExtensionContextLifecycle();

function isExtensionContextAvailable(): boolean {
  return extensionContextLifecycle.observe();
}

async function safeStorageGet(keys: string[]): Promise<Record<string, unknown>> {
  const chromeApi = getChromeApi() as any;
  if (!extensionContextLifecycle.observe(chromeApi)) return {};
  try {
    const result = (await chromeApi.storage.local.get(keys)) as Record<string, unknown>;
    const runtimeError = readChromeRuntimeLastError(chromeApi);
    if (runtimeError) {
      extensionContextLifecycle.noteRuntimeError(runtimeError);
      return {};
    }
    return result;
  } catch (error) {
    const expectedRuntimeFailure = extensionContextLifecycle.noteRuntimeError(error);
    if (!expectedRuntimeFailure) {
      console.warn('[PromptClarity] Could not read extension settings.', error);
    }
    return {};
  }
}

async function safeStorageSet(values: Record<string, unknown>): Promise<boolean> {
  const chromeApi = getChromeApi() as any;
  if (!extensionContextLifecycle.observe(chromeApi)) return false;
  try {
    await chromeApi.storage.local.set(values);
    const runtimeError = readChromeRuntimeLastError(chromeApi);
    if (runtimeError) {
      extensionContextLifecycle.noteRuntimeError(runtimeError);
      return false;
    }
    return true;
  } catch (error) {
    const expectedRuntimeFailure = extensionContextLifecycle.noteRuntimeError(error);
    if (!expectedRuntimeFailure) {
      console.warn('[PromptClarity] Could not save extension settings.', error);
    }
    return false;
  }
}

class PromptEnhancerExtension {
  private ui = new PromptEnhancerUI();
  private activeElement: HTMLTextAreaElement | HTMLInputElement | HTMLElement | null = null;
  private currentUseCase: UseCase = 'general';
  private autoEnhanceEnabled = true;
  private performanceMode: PerformanceMode = 'fast';
  private resizeObserver: ResizeObserver | null = null;
  private composerObserver: MutationObserver | null = null;
  private positionFrame: number | null = null;
  private analysisTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAnalyzedSignature = '';
  private dismissedSignature = '';
  private analysisRequestId = 0;
  private generatedSignatures = new Set<string>();
  private modelAbortController: AbortController | null = null;
  private readonly siteAdapter = getSiteAdapter();
  private lastInsertion: { element: HTMLElement; originalText: string } | null = null;
  private currentFeedbackContext: TooMuchFeedbackEntry | null = null;
  private currentResultContext: {
    element: HTMLElement;
    originalSignature: string;
    rewrittenSignature: string;
  } | null = null;

  private static readonly AUTO_ANALYZE_DELAY = 900;

  constructor() {}

  public async init() {
    isExtensionContextAvailable();

    // Load saved use case from storage if available
    if (isExtensionContextAvailable()) {
      const data = await safeStorageGet(['defaultUseCase', 'autoEnhanceEnabled', 'performanceMode']);
      if (data.defaultUseCase) {
        this.currentUseCase = data.defaultUseCase as UseCase;
      }
      if (typeof data.autoEnhanceEnabled === 'boolean') {
        this.autoEnhanceEnabled = data.autoEnhanceEnabled;
      }
      if (
        data.performanceMode === 'fast' ||
        data.performanceMode === 'balanced' ||
        data.performanceMode === 'quality'
      ) {
        this.performanceMode = data.performanceMode;
      }
    }

    // Initialize UI
    const cssText = typeof __CSS_TEXT__ !== 'undefined' ? __CSS_TEXT__ : '';
    this.ui.init(cssText, {
      onUseCaseChange: (useCase) => this.handleUseCaseChange(useCase),
      onAutoEnhanceChange: (enabled) => this.handleAutoEnhanceChange(enabled),
      onPerformanceModeChange: (mode) => this.handlePerformanceModeChange(mode),
      onCopy: (text) => this.handleCopy(text),
      onInsert: (text) => this.handleInsert(text),
      onUndo: () => this.handleUndo(),
      onTooMuch: () => this.handleTooMuch(),
      onClose: () => this.handleClose()
    });

    // Listen to focus changes
    document.addEventListener('focusin', (e) => this.handleFocusIn(e));
    document.addEventListener('focusout', (e) => this.handleFocusOut(e));

    // Listen for custom trigger event from bubble click
    window.addEventListener('prompt-enhance-click', () => this.runAnalysis(true));

    // Track scroll and resize events so the controls stay attached to dynamic chat inputs.
    this.setupPositionTracking();
    this.setupComposerTracking();

    // Load the local model in the background before the first suggestion. This
    // removes most of the cold-start delay without blocking the page or UI.
    fetch(`${DEFAULT_REWRITE_ENDPOINT}?warm=1`).catch(() => undefined);
  }

  private handleFocusIn(e: FocusEvent) {
    const target = this.findEditableTarget(e.target);
    if (target) {
      this.bindActiveComposer(target);
      this.handleInput();
    }
  }

  private handleFocusOut(e: FocusEvent) {
    const target = e.target as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;

    // Check if the focus has moved to our extension UI
    const isMovingToExtension =
      relatedTarget &&
      (relatedTarget.id === 'prompt-enhancer-root' || relatedTarget.closest('#prompt-enhancer-root'));

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
    if (!this.activeElement.isConnected) {
      this.handleDetachedComposer();
      return;
    }

    const text = this.getInputText(this.activeElement).trim();
    const signature = this.textSignature(text);
    const isLikelyPrompt = shouldShowHint(text);

    if (
      this.currentResultContext &&
      (this.currentResultContext.element !== this.activeElement ||
        this.currentResultContext.originalSignature !== signature)
    ) {
      this.currentResultContext = null;
      this.currentFeedbackContext = null;
    }

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
      this.generatedSignatures.has(signature) ||
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
    void safeStorageSet({ defaultUseCase: useCase });

    // Re-run analysis with new use case
    this.dismissedSignature = '';
    this.runAnalysis(true);
  }

  private handleAutoEnhanceChange(enabled: boolean) {
    this.autoEnhanceEnabled = enabled;
    void safeStorageSet({ autoEnhanceEnabled: enabled });

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

  private handlePerformanceModeChange(mode: PerformanceMode) {
    this.performanceMode = mode;
    void safeStorageSet({ performanceMode: mode });
    this.dismissedSignature = '';
    void this.runAnalysis(true);
  }

  private handleCopy(text: string) {
    this.rememberGeneratedPrompt(text);
    this.saveHistory(text);
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
    if (!el || !el.isConnected) {
      this.handleDetachedComposer();
      return;
    }
    if (!text.trim()) return;
    const resultContext = this.currentResultContext;
    if (
      !resultContext ||
      resultContext.element !== el ||
      resultContext.originalSignature !== this.textSignature(this.getInputText(el).trim()) ||
      resultContext.rewrittenSignature !== this.textSignature(text)
    ) {
      this.currentResultContext = null;
      this.currentFeedbackContext = null;
      this.ui.hidePopup(false);
      return;
    }
    this.lastInsertion = { element: el, originalText: this.getInputText(el) };

    this.clearAnalysisTimer();
    this.rememberGeneratedPrompt(text);
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
      } catch {
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

      const prototype =
        inputEl instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      setter?.call(inputEl, text);
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    this.ui.setPulse(false);
    this.ui.keepPopupOpen();
    window.requestAnimationFrame(() => {
      if (
        this.lastInsertion?.element === el &&
        el.isConnected &&
        this.textSignature(this.getInputText(el)) === this.textSignature(text)
      ) {
        this.ui.keepPopupOpen();
        this.ui.updatePopupPosition();
      }
    });
    this.currentResultContext = null;
    this.saveHistory(text);
  }

  private handleUndo() {
    const insertion = this.lastInsertion;
    if (!insertion || !insertion.element.isConnected || insertion.element !== this.activeElement) return;
    const { element, originalText } = insertion;
    element.focus();
    if (this.isContentEditable(element)) {
      this.replaceRichTextContent(element, originalText);
    } else {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      const prototype =
        input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, originalText);
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'historyUndo', data: originalText })
      );
    }
    this.lastInsertion = null;
  }

  private bindActiveComposer(target: HTMLElement) {
    if (this.activeElement === target) {
      this.updateUI();
      return;
    }

    if (this.activeElement) {
      this.activeElement.removeEventListener('input', this.handleInput);
    }
    this.resizeObserver?.disconnect();

    this.activeElement = target;
    this.currentResultContext = null;
    this.currentFeedbackContext = null;
    this.lastInsertion = null;
    this.ui.setActiveElement(target);
    target.removeEventListener('input', this.handleInput);
    target.addEventListener('input', this.handleInput);

    this.resizeObserver = new ResizeObserver(() => this.updateUI());
    this.resizeObserver.observe(target);
    this.updateUI();
  }

  private handleDetachedComposer() {
    this.clearAnalysisTimer();
    this.analysisRequestId += 1;
    this.modelAbortController?.abort();
    this.modelAbortController = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.activeElement = null;
    this.currentResultContext = null;
    this.currentFeedbackContext = null;
    this.lastInsertion = null;
    this.ui.setActiveElement(null);
    this.ui.hideBubble();
    this.ui.hidePopup(false);
  }

  private handleInvalidatedExtensionContext() {
    this.clearAnalysisTimer();
    this.analysisRequestId += 1;
    this.modelAbortController?.abort();
    this.modelAbortController = null;
    this.currentFeedbackContext = null;
    this.currentResultContext = null;
    this.ui.hideBubble();
    this.ui.hidePopup(false);
  }

  private setupComposerTracking() {
    if (!document.body) return;

    const handleMutations = () => {
      if (!this.activeElement) return;
      if (this.activeElement.isConnected) return;

      const focused = this.findEditableTarget(document.activeElement);
      if (focused) {
        this.bindActiveComposer(focused);
      } else {
        this.handleDetachedComposer();
      }
    };

    this.composerObserver = new MutationObserver(() => handleMutations());
    this.composerObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private async saveHistory(improvedText: string) {
    const data = await safeStorageGet(['promptHistory', 'historyEnabled']);
    if (!isExtensionContextAvailable()) return;
    if (data.historyEnabled !== true) return;
    const history = Array.isArray(data.promptHistory) ? data.promptHistory : [];
    history.unshift({ improvedText, createdAt: new Date().toISOString(), site: this.siteAdapter.id });
    await safeStorageSet({ promptHistory: history.slice(0, 20) });
  }

  private handleClose() {
    this.clearAnalysisTimer();
    this.analysisRequestId += 1;
    this.modelAbortController?.abort();
    this.modelAbortController = null;
    this.currentFeedbackContext = null;
    this.currentResultContext = null;
    if (this.activeElement) {
      this.dismissedSignature = this.textSignature(this.getInputText(this.activeElement));
    }
    // Return focus to text box
    this.activeElement?.focus();
  }

  private async runAnalysis(force: boolean) {
    if (!this.activeElement) return;

    const capturedText = this.getInputText(this.activeElement).trim();
    const text = force ? this.extractTaskFromLegacyRewrite(capturedText) : capturedText;
    if (text.length < 2) return;
    const rect = this.activeElement.getBoundingClientRect();

    // Call local library analyzer
    let content: PopupContent = analyzeForPopup({
      text,
      useCase: this.currentUseCase
    });

    // Automatic analysis stays quiet on uncertain text. A manual bubble click
    // can still force an enhancement for a short or unusual prompt.
    if (!content.isPrompt || !content.analysis) {
      if (!force) return;
      content = this.forceAnalysisFallback(text);
    }

    if (!content.analysis || !content.improvedPrompt) return;

    const signature = this.textSignature(text);
    const requestId = ++this.analysisRequestId;
    this.lastAnalyzedSignature = signature;
    this.currentFeedbackContext = null;
    this.currentResultContext = null;
    this.ui.showPopup(
      rect,
      { ...content, rewriteSource: 'rules', rewriteStatus: 'loading' },
      this.currentUseCase,
      this.autoEnhanceEnabled,
      this.performanceMode
    );

    this.modelAbortController?.abort();
    const modelAbortController = new AbortController();
    this.modelAbortController = modelAbortController;
    const modelResult = await rewritePromptWithModel(
      {
        prompt: text,
        useCase: this.currentUseCase,
        fallbackPrompt: content.improvedPrompt,
        hasPriorConversation: this.hasPriorUserMessages(),
        preferSpeed: this.performanceMode === 'fast',
        performanceMode: this.performanceMode
      },
      { signal: modelAbortController.signal }
    );
    if (this.modelAbortController === modelAbortController) this.modelAbortController = null;

    const extensionContextInvalidated = extensionContextLifecycle.shouldIgnoreLateResult();

    // Ignore stale answers when the user typed, changed use case, closed the card, or reloaded the extension.
    if (
      requestId !== this.analysisRequestId ||
      !this.activeElement ||
      this.textSignature(this.getInputText(this.activeElement).trim()) !== this.textSignature(capturedText) ||
      !this.ui.isPopupVisible() ||
      extensionContextInvalidated
    ) {
      if (extensionContextInvalidated) this.handleInvalidatedExtensionContext();
      return;
    }

    this.rememberGeneratedPrompt(modelResult.rewrittenPrompt);
    const rewriteDiagnostics = createRewriteDiagnostics(modelResult);
    const diagnosticHint = describeRewriteDiagnostic(rewriteDiagnostics.lastValidationReason);
    void safeStorageSet({ promptClarityDiagnostics: rewriteDiagnostics });
    this.currentResultContext = {
      element: this.activeElement,
      originalSignature: this.textSignature(capturedText),
      rewrittenSignature: this.textSignature(modelResult.rewrittenPrompt)
    };
    this.currentFeedbackContext = buildTooMuchFeedbackEntry({
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
      mode: this.performanceMode,
      intervention: modelResult.intervention,
      validationReason: modelResult.validation.reason,
      surface: 'chrome'
    });
    const reviewedPrompt = analyzePrompt(modelResult.rewrittenPrompt, this.currentUseCase);
    const promptIsAlreadyGood =
      modelResult.status === 'no_change' &&
      !modelResult.error &&
      content.analysis.spellingIssues.length === 0 &&
      !content.analysis.issues.some((issue) => issue.id === 'vague-task');
    const updatedAnalysis = promptIsAlreadyGood
      ? {
          ...reviewedPrompt,
          overallScore: 100,
          label: 'Excellent' as const,
          summary: 'The prompt is already clear and needs no changes.',
          issues: [],
          strengths: ['Clear wording and intent'],
          rewrittenPrompt: modelResult.rewrittenPrompt
        }
      : {
          ...reviewedPrompt,
          rewrittenPrompt: modelResult.rewrittenPrompt
        };
    const hasPasteableSafetyFallback =
      modelResult.sourceDetail === 'safety-fallback' &&
      modelResult.validationScore >= 70 &&
      modelResult.rewrittenPrompt.trim().length > 2;
    this.ui.showPopup(
      rect,
      {
        ...content,
        originalText: text,
        analysis: updatedAnalysis,
        improvedPrompt: modelResult.rewrittenPrompt,
        copyableText: modelResult.rewrittenPrompt,
        rewriteSource:
          modelResult.source === 'model' || modelResult.source === 'checkmark' ? 'model' : 'rules',
        rewriteStatus: modelResult.error && !hasPasteableSafetyFallback ? 'error' : modelResult.status,
        modelName: modelResult.model,
        modelError:
          modelResult.status === 'error'
            ? diagnosticHint || 'The local rewrite service is unavailable.'
            : modelResult.error,
        sourceDetail: modelResult.sourceDetail,
        validationScore: modelResult.validationScore,
        isAlreadyGood: promptIsAlreadyGood,
        intervention: modelResult.intervention,
        validationReason: modelResult.validation.reason,
        diagnosticHint
      },
      this.currentUseCase,
      this.autoEnhanceEnabled,
      this.performanceMode
    );
  }

  private async handleTooMuch(): Promise<boolean> {
    const context = this.currentFeedbackContext;
    if (!context) return false;

    const data = await safeStorageGet(['tooMuchFeedback']);
    const feedback = Array.isArray(data.tooMuchFeedback) ? data.tooMuchFeedback : [];
    const nextFeedback = [context, ...feedback].slice(0, 50);
    return safeStorageSet({ tooMuchFeedback: nextFeedback });
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
        originalText: text,
        isPrompt: true,
        detectionConfidence: 0.5,
        analysis,
        improvedPrompt: analysis.rewrittenPrompt,
        copyableText: analysis.rewrittenPrompt
      };
    } catch {
      return {
        originalText: text,
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

    if (!this.activeElement.isConnected) {
      this.handleDetachedComposer();
      return;
    }

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

    const candidate = findAdapterComposer(target, this.siteAdapter) as HTMLElement | null;
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
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private textSignature(text: string): string {
    return this.normalizeText(text).replace(/\s+/g, ' ').trim();
  }

  private rememberGeneratedPrompt(text: string) {
    const signature = this.textSignature(text);
    if (!signature) return;

    this.generatedSignatures.add(signature);
    if (this.generatedSignatures.size > 30) {
      const oldest = this.generatedSignatures.values().next().value;
      if (oldest) this.generatedSignatures.delete(oldest);
    }
  }

  private hasPriorUserMessages(): boolean {
    const candidates = document.querySelectorAll<HTMLElement>(
      this.siteAdapter.userMessageSelectors.join(',')
    );
    return Array.from(candidates).some((candidate) => {
      if (candidate === this.activeElement || candidate.contains(this.activeElement)) return false;
      const text = (candidate.innerText || candidate.textContent || '').trim();
      return text.length > 1;
    });
  }

  private looksLikeGeneratedRewrite(text: string): boolean {
    const normalized = this.normalizeText(text);
    const structured =
      /^(Role|Papel):/i.test(normalized) &&
      /\b(Context|Contexto):/i.test(normalized) &&
      /\b(Task|Tarefa):/i.test(normalized);
    const compactQuestion = /^(Answer the question|Responde à pergunta):/i.test(normalized);
    return structured || compactQuestion;
  }

  private extractTaskFromLegacyRewrite(text: string): string {
    if (!this.looksLikeGeneratedRewrite(text)) return text;

    const normalized = this.normalizeText(text);
    const taskMarkers = Array.from(normalized.matchAll(/(?:^|\s)(?:Task|Tarefa):\s*/gim));
    const lastMarker = taskMarkers.at(-1);
    if (lastMarker?.index === undefined) return text;

    const taskStart = lastMarker.index + lastMarker[0].length;
    const remainder = normalized.slice(taskStart);
    const boundary = remainder.search(
      /\s+(?:Constraints|Requisitos|Output format|Formato de saída|Success criteria|Critérios de sucesso):/i
    );
    const lastTask = (boundary >= 0 ? remainder.slice(0, boundary) : remainder).trim();
    if (!lastTask) return text;

    return lastTask.replace(/^(?:Clarify the task|Esclarece a tarefa):\s*/i, '').trim() || text;
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
extension.init().catch((error) => {
  if (!extensionContextLifecycle.noteRuntimeError(error)) console.error(error);
});
