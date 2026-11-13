import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
  // Native modules and protocol libraries stay in node_modules so they can be
  // rebuilt for Electron's ABI and resolved at runtime.
  packages: 'external',
  external: ['electron'],
  absWorkingDir: projectRoot,
};

await build({
  ...shared,
  entryPoints: ['electron/main.ts'],
  outfile: 'dist-electron/main.cjs',
});

await build({
  ...shared,
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist-electron/preload.cjs',
});

console.log('Electron main and preload bundles built.');
