import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const ownedProcesses = [];
let shuttingDown = false;

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

async function endpointIsReady(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForEndpoint(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await endpointIsReady(url)) return true;
    await wait(500);
  }
  return false;
}

function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
    ...options
  });
  ownedProcesses.push(child);
  return child;
}

function startNpm(args) {
  if (process.env.npm_execpath) {
    return startProcess(process.execPath, [process.env.npm_execpath, ...args]);
  }
  return startProcess(npmCommand, args, { shell: process.platform === 'win32' });
}

async function ensureOllama() {
  if (await endpointIsReady('http://127.0.0.1:11434/api/tags')) return;

  const windowsOllama = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe')
    : '';
  const ollamaCommand =
    process.env.OLLAMA_BINARY || (windowsOllama && existsSync(windowsOllama) ? windowsOllama : 'ollama');

  console.log('[desktop] Starting Ollama...');
  const ollama = startProcess(ollamaCommand, ['serve']);
  ollama.on('error', () => {});
  if (!(await waitForEndpoint('http://127.0.0.1:11434/api/tags', 20_000))) {
    throw new Error('Ollama did not start. Open Ollama manually and run npm run desktop again.');
  }
}

async function ensureLocalApi() {
  if (await endpointIsReady('http://127.0.0.1:3000/api/rewrite')) {
    console.log('[desktop] Local API is already running.');
  } else {
    console.log('[desktop] Starting the local API...');
    startNpm(['run', 'dev']);
    if (!(await waitForEndpoint('http://127.0.0.1:3000/api/rewrite', 60_000))) {
      throw new Error('The local API did not start on http://127.0.0.1:3000.');
    }
  }

  console.log('[desktop] Warming the local model...');
  try {
    const response = await fetch('http://127.0.0.1:3000/api/rewrite?warm=1', {
      signal: AbortSignal.timeout(120_000)
    });
    if (response.ok) console.log('[desktop] Local model is warm.');
    else console.warn('[desktop] Model warm-up did not complete; the first rewrite may be slower.');
  } catch {
    console.warn('[desktop] Model warm-up did not complete; the first rewrite may be slower.');
  }
}

function stopProcessTree(child) {
  if (!child.pid || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true
    });
  } else {
    child.kill('SIGTERM');
  }
}

function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of ownedProcesses.reverse()) stopProcessTree(child);
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.on('exit', cleanup);

try {
  console.log('\nPrompt Grammarly Desktop');
  console.log('-------------------------');
  await ensureOllama();
  await ensureLocalApi();
  console.log('[desktop] Starting the tray app...');
  const desktop = startNpm(['run', 'desktop:dev']);
  desktop.on('exit', (code) => {
    cleanup();
    process.exitCode = code ?? 0;
  });
} catch (error) {
  console.error(`\n[desktop] ${error instanceof Error ? error.message : error}`);
  cleanup();
  process.exitCode = 1;
}
