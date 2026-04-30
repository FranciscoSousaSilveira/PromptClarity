import type { UseCase, UseCaseOption } from '../types/prompt';

interface UseCaseSelectorProps {
  value: UseCase;
  options: UseCaseOption[];
  onChange: (useCase: UseCase) => void;
}

export function UseCaseSelector({ value, options, onChange }: UseCaseSelectorProps) {
  return (
    <div className="use-case-grid" role="radiogroup" aria-label="Prompt use case">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            className={`use-case-card ${active ? 'is-active' : ''}`}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
          >
            <span className="use-case-label">{option.label}</span>
            <span className="use-case-description">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
