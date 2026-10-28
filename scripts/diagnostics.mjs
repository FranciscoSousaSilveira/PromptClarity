import os from 'node:os';

const HEALTH_URL = 'http://127.0.0.1:3000/api/health';

function value(input) {
  return input === null || input === undefined ? 'not available' : String(input);
}

console.log('PromptClarity diagnostics');
console.log('Local-only metadata; prompt contents and environment variables are not included.');
console.log(`Platform: ${os.platform()} ${os.arch()}`);
console.log(`Node: ${process.version}`);

try {
  const startedAt = Date.now();
  // Allow a cold Next.js development route to compile; /api/health applies
  // its own shorter Ollama timeout and never performs a rewrite.
  const response = await fetch(HEALTH_URL, { cache: 'no-store', signal: AbortSignal.timeout(4_000) });
  const health = await response.json();
  const valid =
    health &&
    typeof health === 'object' &&
    health.api === 'ok' &&
    health.ollama &&
    typeof health.ollama === 'object';
  if (!valid) throw new Error('invalid health response');

  console.log(`Local API: ${health.status} (${Date.now() - startedAt} ms)`);
  console.log(`Ollama: ${value(health.ollama.status)}`);
  console.log(`Model: ${value(health.ollama.model)}`);
  console.log(`Ollama latency: ${value(health.ollama.latencyMs)} ms`);
  console.log(`Mode: ${value(health.config?.mode)}`);
  console.log(`Intervention: ${value(health.config?.intervention)}`);
  if (health.lastError) console.log(`Hint: ${health.lastError}`);
} catch {
  console.log('Local API: offline or timed out');
  console.log('Hint: start it with npm run dev, then run npm run diagnostics again.');
}
