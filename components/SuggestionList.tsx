interface SuggestionListProps {
  suggestions: string[];
}

export function SuggestionList({ suggestions }: SuggestionListProps) {
  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Strengths</p>
          <h3>What to preserve in the rewrite</h3>
        </div>
      </div>

      {suggestions.length > 0 ? (
        <ul className="suggestion-list">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">The current prompt is still too thin to preserve much yet.</p>
      )}
    </section>
  );
}
