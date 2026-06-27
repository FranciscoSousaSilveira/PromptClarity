'use client';

import { useRef } from 'react';
import type { UseCase, UseCaseOption } from '../types/prompt';

interface UseCaseSelectorProps {
  value: UseCase;
  options: UseCaseOption[];
  onChange: (useCase: UseCase) => void;
}

export function UseCaseSelector({ value, options, onChange }: UseCaseSelectorProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  function selectWithKeyboard(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : 0;

    if (direction === 0) return;
    event.preventDefault();
    const nextIndex = (index + direction + options.length) % options.length;
    onChange(options[nextIndex].value);
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    window.requestAnimationFrame(() => buttons?.[nextIndex]?.focus());
  }

  return (
    <div className="use-case-grid" role="radiogroup" aria-label="Prompt use case" ref={groupRef}>
      {options.map((option, index) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            className={`use-case-card ${active ? 'is-active' : ''}`}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => selectWithKeyboard(event, index)}
          >
            <span className="use-case-label">{option.label}</span>
            <span className="use-case-description">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
