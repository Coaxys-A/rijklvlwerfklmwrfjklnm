#!/usr/bin/env node
// Fails the build if any CDN reference survived into dist/.
// Hard rule for Teknav production: zero outbound CDN dependencies.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';
const FORBIDDEN = [
  /unpkg\.com/i,
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
  /cdn\.jsdelivr\.net/i,
  /cdnjs\.cloudflare\.com/i,
  /\bcdn\.[a-z0-9-]+\.[a-z]{2,}/i,
];

// Skip binary/font assets — only scan text-like files where URLs would actually be loaded.
const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.cjs', '.css', '.map', '.json', '.svg', '.txt', '.webmanifest']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

let bad = 0;
try {
  await stat(DIST);
} catch {
  console.error(`[check-no-cdn] ${DIST}/ not found — run \`vite build\` first.`);
  process.exit(2);
}

for await (const file of walk(DIST)) {
  const ext = file.slice(file.lastIndexOf('.'));
  if (!TEXT_EXT.has(ext)) continue;
  const text = await readFile(file, 'utf8').catch(() => '');
  for (const pat of FORBIDDEN) {
    const m = text.match(pat);
    if (m) {
      console.error(`[check-no-cdn] FORBIDDEN ${pat} in ${file}: "${m[0]}"`);
      bad++;
    }
  }
}

if (bad) {
  console.error(`[check-no-cdn] ${bad} CDN reference(s) found. Build rejected.`);
  process.exit(1);
}
console.log('[check-no-cdn] clean — no CDN references in dist/.');
