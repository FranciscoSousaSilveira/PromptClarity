import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import electronPath from 'electron';

const root = resolve(import.meta.dirname, '..');
const env = { ...process.env };

// Some IDE and automation environments set this variable for Electron-based
// tools. The desktop app needs the full Electron runtime, not Node-only mode.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true
});

child.on('error', (error) => {
  console.error('Could not start Electron:', error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Electron stopped with signal ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 0;
});
