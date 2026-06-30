import { existsSync, statfsSync } from 'node:fs';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const desktopDirectory = join(root, 'apps', 'desktop-app');
const finalDirectory = join(root, 'release', 'desktop');
const minimumWorkingSpace = 1_200 * 1024 * 1024;

function freeBytes(path) {
  const stats = statfsSync(path);
  return Number(stats.bavail) * Number(stats.bsize);
}

function selectWorkingRoot() {
  const override = process.env.PROMPT_GRAMMARLY_BUILD_TEMP;
  if (override) return resolve(override);

  const candidates =
    process.platform === 'win32'
      ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `${letter}:\\`)
      : [tmpdir()];
  const available = candidates
    .filter((candidate) => existsSync(candidate))
    .map((candidate) => ({ candidate, free: freeBytes(candidate) }))
    .sort((left, right) => right.free - left.free);
  return available[0]?.free >= minimumWorkingSpace ? available[0].candidate : tmpdir();
}

function run(command, args, cwd, environment = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: environment, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${basename(command)} exited with code ${code}`));
    });
  });
}

const workingRoot = selectWorkingRoot();
const workingDirectory = join(workingRoot, `PromptGrammarlyBuild-${process.pid}`);
const temporaryOutput = join(workingDirectory, 'release');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run desktop packaging through npm run package:desktop.');
const builderCli = join(desktopDirectory, 'node_modules', 'electron-builder', 'cli.js');

try {
  await mkdir(temporaryOutput, { recursive: true });
  const environment = { ...process.env, TEMP: workingDirectory, TMP: workingDirectory };
  console.log(`Desktop packaging workspace: ${workingDirectory}`);
  await run(process.execPath, [npmCli, 'run', 'build'], desktopDirectory, environment);
  await run(
    process.execPath,
    [builderCli, '--win', 'nsis', `--config.directories.output=${temporaryOutput}`],
    desktopDirectory,
    environment
  );

  await mkdir(finalDirectory, { recursive: true });
  for (const entry of await readdir(temporaryOutput, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(exe|blockmap|yml)$/i.test(entry.name)) continue;
    await copyFile(join(temporaryOutput, entry.name), join(finalDirectory, entry.name));
  }
  console.log(`Desktop installer copied to ${finalDirectory}`);
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
}
