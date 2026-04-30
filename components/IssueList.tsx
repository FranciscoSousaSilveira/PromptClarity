import type { PromptIssue } from '../types/prompt';

interface IssueListProps {
  issues: PromptIssue[];
}

export function IssueList({ issues }: IssueListProps) {
  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Issues found</p>
          <h3>What is likely to go wrong</h3>
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="issue-list">
          {issues.map((issue) => (
            <article key={issue.id} className={`issue-card severity-${issue.severity}`}>
              <div className="issue-title-row">
                <span className="issue-title">{issue.title}</span>
                <span className="issue-category">{issue.category}</span>
              </div>
              <p>{issue.description}</p>
              <div className="issue-suggestion">
                <strong>Suggestion:</strong> {issue.suggestion}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-copy">No major issues detected. The prompt already has a strong shape.</p>
      )}
    </section>
  );
}
