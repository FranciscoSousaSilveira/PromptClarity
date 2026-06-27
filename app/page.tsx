'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzePrompt } from '../lib/promptAnalyzer';
import { rewritePromptWithModel } from '../lib/modelPromptRewriter';
import { starterTemplates } from '../lib/templates';
import { CategoryScores } from '../components/CategoryScores';
import { IssueList } from '../components/IssueList';
import { PromptInput } from '../components/PromptInput';
import { ScoreCard } from '../components/ScoreCard';
import { SpellingIssuesList } from '../components/SpellingIssuesList';
import { SuggestionList } from '../components/SuggestionList';
import { TemplateGallery } from '../components/TemplateGallery';
import { UseCaseSelector } from '../components/UseCaseSelector';
import { USE_CASE_OPTIONS, type PromptAnalysis, type PromptTemplate, type UseCase } from '../types/prompt';

type CopyFormat = 'improved' | 'json' | 'analysis';

export default function HomePage() {
  const [prompt, setPrompt] = useState<string>('');
  const [useCase, setUseCase] = useState<UseCase>('general');
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [analyzedPrompt, setAnalyzedPrompt] = useState<string | null>(null);
  const [analyzedUseCase, setAnalyzedUseCase] = useState<UseCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const latestPromptRef = useRef(prompt);
  latestPromptRef.current = prompt;

  const characterCount = useMemo(() => prompt.length, [prompt]);
  const shortPromptWarning = prompt.trim().length > 0 && prompt.trim().length < 18
    ? 'This is very short. The analysis will work, but you may want more context for a better rewrite.'
    : null;
  const currentPrompt = prompt.trim();
  const analysisIsCurrent = Boolean(
    analysis &&
    analyzedPrompt === currentPrompt &&
    analyzedUseCase === useCase &&
    currentPrompt.length > 0
  );

  useEffect(() => {
    if (!analysisIsCurrent) {
      setShowCopyMenu(false);
    }
  }, [analysisIsCurrent]);

  useEffect(() => {
    if (!showCopyMenu) return;

    function closeMenu(event: KeyboardEvent | MouseEvent) {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        setShowCopyMenu(false);
        return;
      }

      if (event instanceof MouseEvent && !copyMenuRef.current?.contains(event.target as Node)) {
        setShowCopyMenu(false);
      }
    }

    document.addEventListener('keydown', closeMenu);
    document.addEventListener('mousedown', closeMenu);
    return () => {
      document.removeEventListener('keydown', closeMenu);
      document.removeEventListener('mousedown', closeMenu);
    };
  }, [showCopyMenu]);

  useEffect(() => {
    if (analysis && !analysisIsCurrent) {
      setAnalysis(null);
      setAnalyzedPrompt(null);
      setAnalyzedUseCase(null);
      setCopiedFormat(null);
    }
  }, [analysis, analysisIsCurrent]);

  // Quick heuristics for real-time category hints (not full analysis)
  const quickHints = useMemo(() => {
    if (prompt.trim().length === 0) return [];
    const lower = prompt.toLowerCase();
    const hints: string[] = [];
    
    if (!/[.!?]/.test(prompt)) hints.push('Consider a clear ending');
    if (prompt.split(' ').length < 5) hints.push('Add more context');
    if (!/\b(what|how|why|create|write|generate|explain|compare)\b/.test(lower)) hints.push('State the action clearly');
    
    return hints;
  }, [prompt]);

  async function handleAnalyze() {
    const trimmed = prompt.trim();

    if (trimmed.length === 0) {
      setError('Please paste a prompt before analyzing.');
      return;
    }

    setError(null);
    const nextAnalysis = analyzePrompt(prompt, useCase);
    setAnalysis(nextAnalysis);
    setAnalyzedPrompt(trimmed);
    setAnalyzedUseCase(useCase);

    const modelResult = await rewritePromptWithModel({
      prompt: trimmed,
      useCase,
      fallbackPrompt: nextAnalysis.rewrittenPrompt
    }, { endpoint: '/api/rewrite' });

    // Do not replace a newer analysis if the user edited the prompt meanwhile.
    if (latestPromptRef.current.trim() === trimmed) {
      setAnalysis({ ...nextAnalysis, rewrittenPrompt: modelResult.rewrittenPrompt });
    }
  }

  async function handleCopy(format: CopyFormat) {
    if (!analysisIsCurrent || !analysis) {
      return;
    }

    let text = '';

    switch (format) {
      case 'improved':
        text = analysis.rewrittenPrompt;
        break;
      case 'json':
        text = JSON.stringify({
          original: analyzedPrompt,
          useCase,
          score: analysis.overallScore,
          label: analysis.label,
          improved: analysis.rewrittenPrompt,
          issues: analysis.issues.map((i) => ({ title: i.title, suggestion: i.suggestion }))
        }, null, 2);
        break;
      case 'analysis':
        const issuesList = analysis.issues.length > 0
          ? analysis.issues.map((i) => `- ${i.title}: ${i.suggestion}`).join('\n')
          : 'No major issues detected.';
        text = `Prompt Analysis Report\n=====================\n\nOriginal: ${analyzedPrompt}\nScore: ${analysis.overallScore}/100 (${analysis.label})\nUse case: ${useCase}\n\nIssues:\n${issuesList}\n\nImproved prompt:\n${analysis.rewrittenPrompt}`;
        break;
    }

    if (text.length === 0) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('Copy command was rejected');
      }

      setCopyError(null);
      setCopiedFormat(format);
      setShowCopyMenu(false);
      window.setTimeout(() => setCopiedFormat(null), 1600);
    } catch {
      setCopyError('Could not access the clipboard. Select the improved prompt and copy it manually.');
      setShowCopyMenu(false);
    }
  }

  function handleTemplateSelect(template: PromptTemplate) {
    setUseCase(template.useCase);
    setPrompt(template.prompt);
    setError(null);
    const nextAnalysis = analyzePrompt(template.prompt, template.useCase);
    setAnalysis(nextAnalysis);
    setAnalyzedPrompt(template.prompt.trim());
    setAnalyzedUseCase(template.useCase);
  }

  function handleClear() {
    setPrompt('');
    setUseCase('general');
    setError(null);
    setCopiedFormat(null);
    setCopyError(null);
    setShowCopyMenu(false);
    setAnalysis(null);
    setAnalyzedPrompt(null);
    setAnalyzedUseCase(null);
  }

  return (
    <main className="app-shell">
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Public MVP demo</p>
          <h1>Prompt Grammarly</h1>
          <p className="hero-description">
            Analyze a rough prompt, see what is missing, and rewrite it into a stronger version before you send it to an LLM.
          </p>
          <div className="hero-badges">
            <span>Local AI rewriting</span>
            <span>No API keys required</span>
            <span>Rules fallback included</span>
          </div>
        </div>
      </section>

      <section className="top-grid">
        <div className="editor-column">
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onAnalyze={handleAnalyze}
            onClear={handleClear}
            characterCount={characterCount}
            error={error}
            warning={shortPromptWarning}
          />

          {quickHints.length > 0 && (
            <section className="panel hints-panel">
              <p className="eyebrow">Quick hints</p>
              <ul className="hints-list">
                {quickHints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel">
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">Use case</p>
                <h3>Choose the prompt lens first</h3>
              </div>
            </div>
            <UseCaseSelector value={useCase} options={USE_CASE_OPTIONS} onChange={setUseCase} />
          </section>

        </div>

        <div className="results-column">
          {analysis ? (
            <>
              <ScoreCard score={analysis.overallScore} label={analysis.label} summary={analysis.summary} />
              <CategoryScores scores={analysis.categoryScores} />
            </>
          ) : (
            <section className="panel empty-results-panel">
              <p className="eyebrow">No analysis yet</p>
              <h3>Paste a prompt and click Analyze</h3>
              <ol className="empty-steps">
                <li>Choose the closest use case.</li>
                <li>Paste the prompt you plan to send.</li>
                <li>Review the score and copy the rewrite.</li>
              </ol>
            </section>
          )}
        </div>
      </section>

      {analysis && analysisIsCurrent && (
        <section className="panel comparison-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Before / After</p>
              <h3>See the structured rewrite</h3>
            </div>
            <div className="copy-menu-wrapper" ref={copyMenuRef}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowCopyMenu(!showCopyMenu)}
                disabled={!analysisIsCurrent}
                aria-disabled={!analysisIsCurrent}
                aria-haspopup="menu"
                aria-expanded={showCopyMenu}
                aria-controls="copy-format-menu"
              >
                {copiedFormat ? 'Copied!' : 'Copy'}
              </button>
              {showCopyMenu && analysisIsCurrent && (
                <div className="copy-menu" id="copy-format-menu" role="menu">
                  <button
                    type="button"
                    className="copy-menu-item"
                    role="menuitem"
                    onClick={() => handleCopy('improved')}
                  >
                    Improved prompt
                  </button>
                  <button
                    type="button"
                    className="copy-menu-item"
                    role="menuitem"
                    onClick={() => handleCopy('analysis')}
                  >
                    Analysis report
                  </button>
                  <button
                    type="button"
                    className="copy-menu-item"
                    role="menuitem"
                    onClick={() => handleCopy('json')}
                  >
                    As JSON
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="comparison-grid">
            <article className="comparison-card before-card">
              <span className="comparison-label">Your Original Prompt</span>
              <pre>{prompt.trim() || 'Paste a prompt to get started.'}</pre>
            </article>
            <article className="comparison-card after-card">
              <span className="comparison-label">Improved Version</span>
              <pre>{analysis.rewrittenPrompt || 'Click "Analyze" to generate the improved prompt.'}</pre>
            </article>
          </div>
          <p className={`copy-feedback ${copyError ? 'is-error' : ''}`} role="status" aria-live="polite">
            {copyError ?? (copiedFormat ? 'Copied to clipboard.' : '')}
          </p>
        </section>
      )}

      {analysis && analysisIsCurrent && (
        <section className="analysis-grid">
          <IssueList issues={analysis.issues} />
          <SuggestionList suggestions={analysis.strengths} />
        </section>
      )}

      {analysis && analysisIsCurrent && analysis.spellingIssues.length > 0 && (
        <section className="panel spelling-panel-wrapper">
          <SpellingIssuesList issues={analysis.spellingIssues} />
          {analysis.correctedPrompt !== currentPrompt && (
            <div className="spelling-correction">
              <p className="eyebrow">Spelling-corrected original</p>
              <pre>{analysis.correctedPrompt}</pre>
            </div>
          )}
        </section>
      )}

      <TemplateGallery templates={starterTemplates} onSelect={handleTemplateSelect} activeUseCase={useCase} />
    </main>
  );
}
