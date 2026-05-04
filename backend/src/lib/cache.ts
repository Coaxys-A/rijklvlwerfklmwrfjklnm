// Simple Redis-backed cache wrapper. Use `cached(key, ttl, () => fetcher())`.
// Stale errors don't poison the cache — fetcher exceptions skip the SET so the
// next request retries. JSON-serializable values only.
//
// Invalidate via `bust(prefix)` — uses SCAN with MATCH so it's safe on a hot
// Redis without blocking other clients (KEYS would).

import { redis } from '../redis.js';

export async function cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      // Corrupt blob — drop and refetch.
      await redis.del(key);
    }
  }
  const fresh = await fetcher();
  // Don't cache `undefined` (would round-trip as JSON null).
  if (fresh !== undefined) {
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
  }
  return fresh;
}

export async function bust(pattern: string): Promise<number> {
  let cursor = '0';
  let removed = 0;
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    if (batch.length > 0) {
      removed += await redis.del(...batch);
    }
  } while (cursor !== '0');
  return removed;
}
