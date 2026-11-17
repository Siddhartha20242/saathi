// Builds tools/real-model/out/check.js: one minified, one-line file to paste into a page's console.
// The extension's page script is wrapped in a function (not run through eval), so it also works on
// sites whose security policy forbids dynamic code.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const content = readFileSync(join(here, '..', '..', 'extension', 'content.js'), 'utf8');
writeFileSync(join(here, 'out', 'scan.generated.js'), `export default function makeScan(chrome) {\n${content}\n}\n`);
await build({
  entryPoints: [join(here, 'entry.js')],
  bundle: true, minify: true, format: 'iife', charset: 'ascii',
  supported: { 'template-literal': false }, // keeps the output on one line
  outfile: join(here, 'out', 'check.js'),
  logLevel: 'error',
});
console.log('built tools/real-model/out/check.js');
