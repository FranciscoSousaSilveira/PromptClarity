import type { PromptScoreLabel } from '../types/prompt';

interface ScoreCardProps {
  score: number;
  label: PromptScoreLabel;
  summary: string;
}

export function ScoreCard({ score, label, summary }: ScoreCardProps) {
  const getScoreClass = (s: number): string => {
    if (s >= 85) return 'score-excellent';
    if (s >= 70) return 'score-strong';
    if (s >= 40) return 'score-decent';
    return 'score-weak';
  };

  return (
    <section className={`panel score-card ${getScoreClass(score)}`}>
      <div className="score-ring" style={{ ['--score' as never]: score }}>
        <div>
          <span className="score-value">{score}</span>
          <span className="score-out-of">/ 100</span>
        </div>
      </div>
      <div className="score-copy">
        <p className="eyebrow">Overall score</p>
        <h3>{label}</h3>
        <p>{summary}</p>
      </div>
    </section>
  );
}
