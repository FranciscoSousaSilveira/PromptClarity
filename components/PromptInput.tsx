interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  onClear: () => void;
  characterCount: number;
  error?: string | null;
  warning?: string | null;
  isAnalyzing?: boolean;
  onCancel?: () => void;
}

export function PromptInput({
  value,
  onChange,
  onAnalyze,
  onClear,
  characterCount,
  error,
  warning,
  isAnalyzing,
  onCancel
}: PromptInputProps) {
  return (
    <section className="panel prompt-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Prompt editor</p>
          <h2>Paste a rough prompt, then sharpen it instantly.</h2>
        </div>
        <div className="input-actions">
          <button type="button" className="secondary-button" onClick={onClear}>
            Clear
          </button>
          <button type="button" className="primary-button" onClick={isAnalyzing ? onCancel : onAnalyze}>
            {isAnalyzing ? 'Cancel' : 'Analyze prompt'}
          </button>
        </div>
      </div>

      <label className="sr-only" htmlFor="prompt-input">
        Prompt
      </label>
      <textarea
        id="prompt-input"
        className="prompt-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Make this better."
        spellCheck={false}
      />

      <div className="input-meta">
        <span className="character-count">{characterCount} characters</span>
        <span className="input-hint">Try adding role, context, constraints, and desired output format.</span>
      </div>

      {error ? <div className="inline-message error">{error}</div> : null}
      {warning ? <div className="inline-message warning">{warning}</div> : null}
    </section>
  );
}
