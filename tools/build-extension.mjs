// Bundles the scam guard's rules and page code into extension/guard-bundle.js, because the extension's
// page script is a plain script that cannot import modules. Also copies the page scripts for the try
// page. Run by `npm run sync:demo`, and so on every build.
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build({
  entryPoints: [join(root, 'src', 'guardPage.js')],
  bundle: true, minify: true, format: 'iife', charset: 'utf8',
  outfile: join(root, 'extension', 'guard-bundle.js'),
  logLevel: 'error',
});
mkdirSync(join(root, 'public', 'demo-bridge'), { recursive: true });
for (const f of ['content.js', 'guard-bundle.js']) copyFileSync(join(root, 'extension', f), join(root, 'public', 'demo-bridge', f));
console.log('built extension/guard-bundle.js and copied the page scripts for the try page');
