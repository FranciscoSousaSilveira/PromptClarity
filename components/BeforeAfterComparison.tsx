interface BeforeAfterComparisonProps {
  original: string;
  improved: string;
  onCopy: () => void;
  copied: boolean;
}

export function BeforeAfterComparison({ original, improved, onCopy, copied }: BeforeAfterComparisonProps) {
  return (
    <section className="panel comparison-panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Before / after</p>
          <h3>See the rewrite side by side</h3>
        </div>
        <button type="button" className="secondary-button" onClick={onCopy}>
          {copied ? 'Copied' : 'Copy improved prompt'}
        </button>
      </div>

      <div className="comparison-grid">
        <article className="comparison-card before-card">
          <span className="comparison-label">Original</span>
          <pre>{original || 'No prompt yet.'}</pre>
        </article>
        <article className="comparison-card after-card">
          <span className="comparison-label">Improved</span>
          <pre>{improved || 'Run an analysis to generate the improved prompt.'}</pre>
        </article>
      </div>
    </section>
  );
}
