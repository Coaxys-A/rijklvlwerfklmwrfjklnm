// Single Redis client for the whole backend (sessions, rate-limit, view buffer).
// Lazy-connected so test suites can swap it out before connection.
import { Redis } from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  // Reconnect with exponential backoff up to 5s; ioredis handles command queuing while reconnecting.
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  enableReadyCheck: true,
});

redis.on('error', (err: Error) => {
  // Don't crash on transient errors — Fastify will surface 503s via /health.
  console.error('[redis]', err.message);
});

export async function connectRedis() {
  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect();
  }
}
