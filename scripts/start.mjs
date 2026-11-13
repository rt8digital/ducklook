import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronBin =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(root, 'node_modules', 'electron', 'dist', 'electron');

const child = spawn(electronBin, ['.'], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
