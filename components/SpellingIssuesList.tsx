'use client';

import type { SpellingIssue } from '../types/prompt';

interface SpellingIssuesListProps {
  issues: SpellingIssue[];
}

export function SpellingIssuesList({ issues }: SpellingIssuesListProps) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="spelling-issues-panel">
      <h3>✓ Spelling Suggestions</h3>
      <ul className="spelling-issues-list">
        {issues.map((issue, idx) => (
          <li key={idx} className="spelling-issue-item">
            <div className="spelling-issue-content">
              <span className="misspelled-word">"{issue.word}"</span>
              <span className="confidence-badge">{issue.confidence}%</span>
            </div>
            <div className="suggestions-text">
              Suggestions: <strong>{issue.suggestions.join(', ')}</strong>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
