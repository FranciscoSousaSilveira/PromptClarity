import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ollama =
  process.env.OLLAMA_BINARY ||
  (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe') : 'ollama');
console.log('Prompt Grammarly diagnostics');
console.log(`OS: ${os.platform()} ${os.release()} ${os.arch()}`);
console.log(`CPU: ${os.cpus()[0]?.model || 'unknown'} (${os.cpus().length} logical cores)`);
console.log(
  `RAM: ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB total, ${(os.freemem() / 1024 ** 3).toFixed(1)} GB free`
);
console.log(`Node: ${process.version}`);
console.log(`Ollama binary: ${existsSync(ollama) ? ollama : 'not found at default path'}`);
const models = spawnSync(ollama, ['list'], { encoding: 'utf8', windowsHide: true });
console.log(models.stdout || models.stderr || 'Could not query Ollama.');
try {
  const response = await fetch('http://127.0.0.1:3000/api/rewrite', { signal: AbortSignal.timeout(2_000) });
  console.log(`Local API: HTTP ${response.status}`);
} catch {
  console.log('Local API: offline');
}
