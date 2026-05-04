const SITE_URL = (process.env.TEKNAV_SMOKE_URL || process.env.TEKNAV_SITE_URL || 'https://www.teknav.ir').replace(/\/$/, '');
const ARTICLE_PATHS = (process.env.TEKNAV_SMOKE_ARTICLES || '/article/agentic-ai-production,/article/ai-clean-data')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

async function request(path) {
  const url = `${SITE_URL}${path}`;
  const res = await fetch(url, { redirect: 'manual' });
  const body = await res.text().catch(() => '');
  return { url, status: res.status, headers: res.headers, body };
}

function pass(label, detail = '') {
  console.log(`PASS ${label}${detail ? ` - ${detail}` : ''}`);
}

function fail(label, detail = '') {
  throw new Error(`FAIL ${label}${detail ? ` - ${detail}` : ''}`);
}

async function expectOk(path, label) {
  const res = await request(path);
  if (res.status < 200 || res.status >= 300) fail(label, `${res.url} returned ${res.status}`);
  pass(label, `${res.status}`);
  return res;
}

await expectOk('/api/health', 'backend health');
await expectOk('/sitemap.xml', 'sitemap available');
await expectOk('/robots.txt', 'robots available');
await expectOk('/feed.xml', 'rss feed available');
await expectOk('/feeds/topic-ai.xml', 'topic rss feed available');
await expectOk('/newsletter', 'newsletter archive available');
await expectOk('/tag/AI', 'tag page available');

const blocked = await request('/ACCOUNTS.md');
if (![403, 404].includes(blocked.status)) fail('ACCOUNTS.md blocked', `${blocked.url} returned ${blocked.status}`);
pass('ACCOUNTS.md blocked', `${blocked.status}`);

for (const path of ARTICLE_PATHS) {
  const res = await expectOk(path, `article page ${path}`);
  const canonical = `${SITE_URL}${path}`;
  if (!res.body.includes('rel="canonical"') && !res.body.includes(canonical)) {
    fail(`canonical present ${path}`, 'canonical link or URL was not found in HTML');
  }
  pass(`canonical present ${path}`);
}

console.log(`Production smoke checks completed for ${SITE_URL}`);
