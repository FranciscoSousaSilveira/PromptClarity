import type { PromptTemplate, UseCase } from '../types/prompt';

interface TemplateGalleryProps {
  templates: PromptTemplate[];
  onSelect: (template: PromptTemplate) => void;
  activeUseCase: UseCase;
}

export function TemplateGallery({ templates, onSelect, activeUseCase }: TemplateGalleryProps) {
  const visibleTemplates = templates.filter(
    (template) => template.useCase === activeUseCase || activeUseCase === 'general'
  );
  return (
    <section className="panel template-panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Starter templates</p>
          <h3>Kick off from a rough prompt</h3>
        </div>
      </div>

      <div className="template-grid">
        {visibleTemplates.map((template) => {
          const isMatched = template.useCase === activeUseCase && activeUseCase !== 'general';
          return (
            <button
              key={template.id}
              type="button"
              className={`template-card ${isMatched ? 'template-matched' : ''}`}
              onClick={() => onSelect(template)}
              title={isMatched ? 'Tailored for your use case' : 'General template'}
            >
              {isMatched && <span className="template-badge">✓ For {activeUseCase}</span>}
              <span className="template-title">{template.title}</span>
              <span className="template-description">{template.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
