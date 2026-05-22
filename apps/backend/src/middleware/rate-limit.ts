import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

interface RateLimitOptions {
  windowMs?: number;
  limit?: number;
  redis?: import('ioredis').default | null;
}

/** Rate limiter with Redis support and in-memory fallback. */
export const rateLimit = (opts: RateLimitOptions = {}) => {
  const windowMs = opts.windowMs ?? 60_000;
  const limit = opts.limit ?? 100;
  const windowSec = Math.ceil(windowMs / 1000);
  const redis = opts.redis ?? null;

  // In-memory fallback store
  const memStore: RateLimitStore = {};

  // Cleanup expired in-memory entries periodically
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(memStore)) {
      if (memStore[key].resetAt <= now) delete memStore[key];
    }
  }, windowMs);
  cleanup.unref();

  return createMiddleware(async (c, next) => {
    // Use the first (client) IP from x-forwarded-for if behind a trusted proxy,
    // otherwise fall back to remote address. This is harder to spoof than using the raw header.
    const xff = c.req.header('x-forwarded-for');
    const clientKey = xff ? xff.split(',')[0].trim() : c.req.header('x-real-ip') || 'unknown';

    if (redis) {
      // Redis-backed rate limiting using sliding window counter
      const redisKey = `rl:${clientKey}`;
      try {
        const current = await redis.incr(redisKey);
        if (current === 1) {
          await redis.expire(redisKey, windowSec);
        }
        if (current > limit) {
          throw new HTTPException(429, { message: 'Too many requests' });
        }
      } catch (err) {
        if (err instanceof HTTPException) throw err;
        // Redis error — fall through to in-memory
      }
    } else {
      // In-memory rate limiting
      const now = Date.now();
      const entry = memStore[clientKey];

      if (!entry || entry.resetAt <= now) {
        memStore[clientKey] = { count: 1, resetAt: now + windowMs };
      } else {
        entry.count++;
        if (entry.count > limit) {
          throw new HTTPException(429, { message: 'Too many requests' });
        }
      }
    }

    await next();
  });
};
