import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { buildWidget } from '../src/build.js';

const out = new URL('../dist/', import.meta.url);
mkdirSync(out, { recursive: true });
const code = buildWidget();
writeFileSync(new URL('humnovo.js', out), code);
console.log(`dist/humnovo.js  ${(code.length / 1024).toFixed(1)} KB  (gzip ${(gzipSync(code).length / 1024).toFixed(1)} KB)`);
