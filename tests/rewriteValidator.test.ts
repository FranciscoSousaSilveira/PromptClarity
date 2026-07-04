import { describe, expect, it } from 'vitest';
import { validateModelRewrite } from '../lib/rewriteValidator';

function expectAccepted(original: string, rewritten: string) {
  expect(validateModelRewrite(original, rewritten)).toEqual({
    passed: true,
    reason: 'model_output_valid'
  });
}

function expectRejected(original: string, rewritten: string, reason: string) {
  expect(validateModelRewrite(original, rewritten)).toEqual({ passed: false, reason });
}

describe('strict conservative rewrite validation', () => {
  describe('valid conservative outputs', () => {
    it('accepts a clear prompt with no changes', () => {
      const prompt = 'Explica este exercício em português de Portugal.';
      expectAccepted(prompt, prompt);
    });

    it('accepts a simple Portuguese grammar and spelling correction', () => {
      expectAccepted(
        'ajuda me com este codigo acho que n ta a funcionar',
        'Ajuda-me com este código. Acho que não está a funcionar.'
      );
    });

    it('accepts harmless capitalization and punctuation', () => {
      expectAccepted('explica este erro', 'Explica este erro.');
    });

    it('accepts a correction that preserves uncertainty and negation', () => {
      expectAccepted('acho que este codigo nao funciona', 'Acho que este código não funciona.');
    });

    it('accepts modest growth needed for a short grammatical correction', () => {
      expectAccepted('ajuda codigo', 'Ajuda-me com este código.');
    });

    it('accepts tools and requirements that were already present', () => {
      expectAccepted('cria testes em python para este codigo', 'Cria testes em Python para este código.');
    });
  });

  describe('assistant behavior', () => {
    it('rejects an answer instead of a correction', () => {
      expectRejected(
        'o que é tcp reno',
        'TCP Reno é um algoritmo de controlo de congestionamento usado em redes.',
        'assistant_answer'
      );
    });

    it.each([
      'Claro! Explica este erro.',
      'Aqui está. Explica este erro.',
      'Posso ajudar. Explica este erro.',
      'A resposta é esta. Explica este erro.',
      'Sure! Explain this error.',
      'Here is the correction. Explain this error.',
      'I can help. Explain this error.',
      'The answer is simple. Explain this error.'
    ])('rejects an introduced assistant preface: %s', (rewritten) => {
      expectRejected('explica este erro', rewritten, 'assistant_preface');
    });

    it.each([
      'Desculpa, mas não posso ajudar com isso.',
      'Não posso fazer isso.',
      "I'm sorry, but I cannot help with that.",
      'I’m sorry, but I cannot help with that.'
    ])('rejects a refusal: %s', (rewritten) => {
      expectRejected('faz isto', rewritten, 'refusal');
    });

    it.each([
      'Versão corrigida: Explica este erro.',
      'Aqui está a versão corrigida: Explica este erro.',
      'I corrected the grammar. Explain this error.',
      'This prompt is already clear. Explain this error.',
      'No changes needed. Explain this error.',
      'The improved prompt is: Explain this error.'
    ])('rejects commentary about the prompt: %s', (rewritten) => {
      expectRejected('explica este erro', rewritten, 'prompt_commentary');
    });
  });

  describe('semantic preservation', () => {
    it('rejects semantic expansion', () => {
      expectRejected(
        'explica tcp reno',
        'Explica TCP Reno com exemplos, fórmulas, diagramas e casos práticos.',
        'semantic_expansion'
      );
    });

    it('rejects a newly introduced constraint', () => {
      expectRejected('explica tcp reno', 'Explica TCP Reno de forma detalhada.', 'semantic_expansion');
    });

    it('rejects an additional task', () => {
      expectRejected(
        'explica tcp reno de forma clara',
        'Explica TCP Reno de forma clara e resume as diferenças.',
        'semantic_expansion'
      );
    });

    it('rejects an introduced tool and extra task', () => {
      expectRejected(
        'ajuda me com este codigo',
        'Ajuda-me com este código em Python e escreve testes unitários.',
        'introduced_tool'
      );
    });

    it.each([
      'React',
      'Docker',
      'TypeScript',
      'Excel',
      'PDF',
      'JSON',
      'Markdown',
      'fontes',
      'citações',
      'links'
    ])('rejects an introduced tool or output dependency: %s', (entity) => {
      expectRejected('explica este problema', `Explica este problema usando ${entity}.`, 'introduced_tool');
    });

    it('rejects changed uncertainty', () => {
      expectRejected('acho que isto pode estar errado', 'Isto está errado.', 'uncertainty_changed');
    });

    it('rejects a changed numeric fact', () => {
      expectRejected('Compara os 3 resultados.', 'Compara os 4 resultados.', 'factual_meaning_changed');
    });

    it('rejects removal of negation', () => {
      expectRejected(
        'Explica porque isto não funciona.',
        'Explica porque isto funciona.',
        'factual_meaning_changed'
      );
    });

    it('rejects a rewrite that loses most of the original meaning', () => {
      expectRejected(
        'Explica o erro de ligação entre o cliente e o servidor local.',
        'Explica o cliente e o pedido de autenticação do utilizador.',
        'unfaithful_rewrite'
      );
    });
  });

  describe('language preservation', () => {
    it('rejects a Portuguese to English language shift', () => {
      expectRejected(
        'explica isto em português de portugal',
        'Explain this in European Portuguese.',
        'language_shift'
      );
    });

    it('rejects an English to Portuguese language shift', () => {
      expectRejected(
        'Explain this error in simple terms.',
        'Explica este erro de forma simples.',
        'language_shift'
      );
    });

    it('rejects a clear Brazilian Portuguese shift', () => {
      expectRejected(
        'Explica isto em português de Portugal.',
        'Você pode explicar isto em português de Portugal?',
        'language_variant_shift'
      );
    });

    it('accepts a conservative English correction', () => {
      expectAccepted('explain this error please', 'Explain this error, please.');
    });
  });

  describe('structure and markdown preservation', () => {
    it('rejects a numbered structure added to plain text', () => {
      expectRejected(
        'melhora esta prompt',
        'Melhora esta prompt seguindo estes passos:\n\n1. Clarifica o objetivo\n2. Define o formato',
        'added_structure'
      );
    });

    it('rejects a heading added to plain text', () => {
      expectRejected('explica este erro', '## Explicação do erro', 'markdown_injection');
    });

    it.each(['**Explica este erro.**', '> Explica este erro.', '```text\nExplica este erro.\n```'])(
      'rejects introduced Markdown: %s',
      (rewritten) => {
        expectRejected('explica este erro', rewritten, 'markdown_injection');
      }
    );
  });

  describe('completeness and size', () => {
    it('rejects an empty output', () => {
      expectRejected('explica isto', '', 'empty_output');
    });

    it('rejects an output above the absolute safety limit', () => {
      expectRejected('explica isto', `Explica isto ${'muito '.repeat(1_400)}`, 'output_too_long');
    });

    it('rejects a truncated prefix of the original', () => {
      expectRejected(
        'explica este problema e mostra as contas',
        'Explica este problema e mostra',
        'truncated_output'
      );
    });

    it('rejects obvious continuation markers', () => {
      expectRejected('explica este problema completo', 'Explica este problema...', 'truncated_output');
    });

    it('rejects unbalanced brackets and quotes', () => {
      expectRejected(
        'Explica este problema com a nota entre parênteses.',
        'Explica este problema (com a nota entre parênteses.',
        'unbalanced_delimiters'
      );
      expectRejected(
        'Explica esta frase entre aspas.',
        'Explica esta frase entre "aspas.',
        'unbalanced_delimiters'
      );
    });

    it.each([
      {
        original: 'Explica este problema.',
        rewritten: 'Explica este problema. Explica este problema. Explica este problema.'
      },
      {
        original: 'Explica cuidadosamente este problema local sem alterar o seu significado. '
          .repeat(2)
          .trim(),
        rewritten: 'Explica cuidadosamente este problema local sem alterar o seu significado. '
          .repeat(4)
          .trim()
      },
      {
        original: 'Explica cuidadosamente este problema local sem alterar o seu significado. '
          .repeat(6)
          .trim(),
        rewritten: 'Explica cuidadosamente este problema local sem alterar o seu significado. '
          .repeat(8)
          .trim()
      }
    ])('rejects excessive dynamic length growth', ({ original, rewritten }) => {
      expectRejected(original, rewritten, 'excessive_length_growth');
    });
  });
});
