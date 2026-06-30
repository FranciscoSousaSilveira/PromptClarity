import { readFile } from 'node:fs/promises';

const corpus = JSON.parse(
  await readFile(new URL('../tests/fixtures/prompt-corpus.json', import.meta.url), 'utf8')
);
const tags = await fetch('http://127.0.0.1:11434/api/tags').then((response) => response.json());
const models = (tags.models || []).map((item) => item.name).filter((name) => /qwen|gemma|llama/i.test(name));
for (const model of models) {
  let totalMs = 0;
  let passed = 0;
  for (const item of corpus.slice(0, 4)) {
    const started = Date.now();
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: '10m',
        options: { temperature: 0.05, num_predict: 80 },
        messages: [
          {
            role: 'system',
            content:
              'Rewrite as a clear prompt in the same language. Output only the prompt. Never answer it.'
          },
          { role: 'user', content: item.prompt }
        ]
      })
    }).then((result) => result.json());
    totalMs += Date.now() - started;
    const output = String(response.message?.content || '').toLowerCase();
    if (item.mustInclude.some((term) => output.includes(term.toLowerCase().slice(0, 5)))) passed++;
  }
  console.log(`${model}: ${passed}/4 intent checks, average ${Math.round(totalMs / 4)}ms`);
}
