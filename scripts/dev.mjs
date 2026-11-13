import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
}

function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        // Vite is still starting.
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timed out waiting for ${url}`));
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

const mainBuild = run(process.execPath, ['scripts/build-electron.mjs']);
await new Promise((resolve, reject) => {
  mainBuild.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('Main process build failed'))));
});

const vite = run(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5173', '--strictPort']);
const url = 'http://localhost:5173';
await waitForServer(url);

const electronBin = process.platform === 'win32'
  ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(root, 'node_modules', '.bin', 'electron');

const electron = run(electronBin, ['.'], {
  shell: false,
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

const shutdown = () => {
  vite.kill();
  electron.kill();
  process.exit(0);
};

electron.on('exit', shutdown);
vite.on('exit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
