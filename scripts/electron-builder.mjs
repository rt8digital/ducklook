import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => process.exit(code ?? 1));
