'use client';

import { useEffect, useMemo, useState } from 'react';
import { analyzePrompt } from '../lib/promptAnalyzer';
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
  const [showCopyMenu, setShowCopyMenu] = useState(false);

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

  function handleAnalyze() {
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

    await navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    setShowCopyMenu(false);
    window.setTimeout(() => setCopiedFormat(null), 1600);
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
            <span>Deterministic analysis</span>
            <span>No API keys required</span>
            <span>Public-safe and self-contained</span>
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

          <TemplateGallery templates={starterTemplates} onSelect={handleTemplateSelect} activeUseCase={useCase} />
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
              <p>
                The results area stays empty until you analyze a real prompt, so the editor and analysis always stay in sync.
              </p>
            </section>
          )}
        </div>
      </section>

      {analysis && analysisIsCurrent && (
        <section className="analysis-grid">
          <SuggestionList suggestions={analysis.strengths} />
          <IssueList issues={analysis.issues} />
        </section>
      )}

      {analysis && analysisIsCurrent && analysis.spellingIssues.length > 0 && (
        <section className="panel">
          <SpellingIssuesList issues={analysis.spellingIssues} />
        </section>
      )}

      {analysis && analysisIsCurrent && analysis.correctedPrompt !== currentPrompt && (
        <section className="panel corrected-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">✓ Enhanced Version</p>
              <h3>Corrected & quality-improved {analysis.overallScore < 70 ? '(targeting 70%+)' : ''}</h3>
            </div>
          </div>
          <article className="corrected-card">
            <pre>{analysis.correctedPrompt}</pre>
          </article>
        </section>
      )}

      {analysis && analysisIsCurrent && analysis.issues.length > 0 && (
        <section className="panel focus-panel">
          <div className="panel-header compact">
            <p className="eyebrow">Focus areas</p>
            <h3>What to improve first</h3>
          </div>
          <ol className="focus-list">
            {analysis.issues.slice(0, 3).map((issue) => (
              <li key={issue.id}>
                <strong>{issue.title}:</strong> {issue.suggestion}
              </li>
            ))}
          </ol>
        </section>
      )}

      {analysis && analysisIsCurrent && (
        <section className="panel comparison-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Before / After</p>
              <h3>See the structured rewrite</h3>
            </div>
            <div className="copy-menu-wrapper">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowCopyMenu(!showCopyMenu)}
                disabled={!analysisIsCurrent}
                aria-disabled={!analysisIsCurrent}
              >
                {copiedFormat ? 'Copied!' : 'Copy'}
              </button>
              {showCopyMenu && analysisIsCurrent && (
                <div className="copy-menu">
                  <button
                    type="button"
                    className="copy-menu-item"
                    onClick={() => handleCopy('improved')}
                  >
                    Improved prompt
                  </button>
                  <button
                    type="button"
                    className="copy-menu-item"
                    onClick={() => handleCopy('analysis')}
                  >
                    Analysis report
                  </button>
                  <button
                    type="button"
                    className="copy-menu-item"
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
        </section>
      )}
    </main>
  );
}
