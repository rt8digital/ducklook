import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
  packages: 'external',
  external: ['electron'],
  absWorkingDir: root,
  entryPoints: ['scripts/api-test-entry.ts'],
  outfile: 'dist-electron/api-test.cjs',
});

const electronBin =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(root, 'node_modules', 'electron', 'dist', 'electron');

const child = spawn(electronBin, ['dist-electron/api-test.cjs'], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => process.exit(code ?? 1));
