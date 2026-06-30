import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const windowsInstall = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe')
  : '';
const command =
  process.env.OLLAMA_BINARY || (windowsInstall && existsSync(windowsInstall) ? windowsInstall : 'ollama');

const child = spawn(command, args, {
  env: process.env,
  stdio: 'inherit',
  windowsHide: true
});

child.on('error', (error) => {
  console.error(`Could not start Ollama at "${command}": ${error.message}`);
  console.error('Install Ollama or set OLLAMA_BINARY to the full path of ollama.exe.');
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
