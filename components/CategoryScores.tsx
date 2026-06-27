import { CATEGORY_LABELS } from '../types/prompt';
import type { CategoryKey } from '../types/prompt';

interface CategoryScoresProps {
  scores: Record<CategoryKey, number>;
}

const orderedCategories: CategoryKey[] = [
  'clarity',
  'context',
  'goal',
  'constraints',
  'outputFormat',
  'examples',
  'audience',
  'successCriteria'
];

export function CategoryScores({ scores }: CategoryScoresProps) {
  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Category scores</p>
          <h3>Where the prompt is strong or thin</h3>
        </div>
      </div>

      <div className="category-list">
        {orderedCategories.map((category) => {
          const score = scores[category];
          return (
            <div key={category} className="category-row">
              <div className="category-topline">
                <span>{CATEGORY_LABELS[category]}</span>
                <strong>{score}</strong>
              </div>
              <div
                className="meter"
                role="progressbar"
                aria-label={CATEGORY_LABELS[category]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score}
              >
                <span className="meter-fill" style={{ width: `${score}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
