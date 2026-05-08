#!/usr/bin/env node
/**
 * Pre-compress all compressible assets in dist/ with gzip and brotli.
 * nginx gzip_static + brotli_static serve these files directly from disk
 * with zero CPU overhead per request.
 */

import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;
const EXTS = new Set(['.js', '.css', '.html', '.xml', '.json', '.svg', '.txt', '.woff2']);

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith('.gz') || entry.endsWith('.br')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) results.push(...walk(full));
    else if (EXTS.has(extname(entry))) results.push(full);
  }
  return results;
}

const files = walk(DIST);
let gz = 0; let br = 0;

for (const f of files) {
  const source = readFileSync(f);
  try {
    writeFileSync(`${f}.gz`, gzipSync(source, { level: 9 }));
    gz++;
  } catch {}
  try {
    writeFileSync(`${f}.br`, brotliCompressSync(source, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 9,
      },
    }));
    br++;
  } catch {}
}

console.log(`[compress] gzip: ${gz} files, brotli: ${br} files`);
