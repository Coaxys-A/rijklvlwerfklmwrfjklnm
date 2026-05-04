import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TeknavData } from '../teknav-data.js';

const { createCanvas } = await import('@napi-rs/canvas');
const OUT_DIR = resolve('public/images/og');

mkdirSync(OUT_DIR, { recursive: true });

function isPublishedArticle(article) {
  if (article.status === 'منتشرشده') return true;
  if (article.status === 'پیش‌نویس' || article.status === 'در انتظار بررسی') return false;
  if (['rust-systems', 'venture-capital-ai'].includes(article.slug)) return false;
  return !!article.dateEn;
}

function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(/\s+/);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines) return y;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
  return y + lineHeight;
}

for (const article of TeknavData.articles.filter(isPublishedArticle)) {
  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#0F6B73');
  gradient.addColorStop(0.55, '#20343A');
  gradient.addColorStop(1, '#D49A2A');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  ctx.fillStyle = 'rgba(250,247,240,0.10)';
  for (let i = 0; i < 12; i += 1) {
    ctx.fillRect(80 + i * 88, 80 + (i % 3) * 34, 48, 300);
  }

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FAF7F0';
  ctx.font = 'bold 64px sans-serif';
  wrap(ctx, article.title, 1080, 190, 900, 82, 3);

  ctx.font = '30px sans-serif';
  ctx.fillStyle = '#F4EFE6';
  wrap(ctx, article.summary, 1080, 445, 860, 44, 2);

  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#FFDC83';
  ctx.fillText('teknav.ir', 1080, 565);

  writeFileSync(resolve(OUT_DIR, `${article.slug}.jpg`), canvas.toBuffer('image/jpeg'));
}

console.log(`[og] generated ${TeknavData.articles.length} article image candidates in public/images/og`);
