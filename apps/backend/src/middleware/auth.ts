import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { Unauthorized } from '../lib/errors.js';
import type { AuthUser } from '../lib/types.js';
import type { Db } from '../db/index.js';
import type { Env } from '../config/env.js';

/** JWT authentication middleware. Verifies Bearer token and attaches user to context. */
export const jwt = () =>
  createMiddleware<{
    Variables: { user: AuthUser; db: Db; env: Env; redis: import('ioredis').default | null };
  }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw Unauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const env = c.get('env');

    let payload: { sub: string; email: string; role: string; organizationId: string };
    try {
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const result = await jwtVerify(token, secret);
      payload = result.payload as typeof payload;
    } catch {
      throw Unauthorized('Invalid or expired token');
    }

    // Check token blacklist (Redis) — rejected tokens from logout
    const redis = c.get('redis' as any) as import('ioredis').default | null;
    if (redis) {
      try {
        const blacklisted = await redis.get(`bl:${token.slice(-32)}`);
        if (blacklisted) throw Unauthorized('Token has been revoked');
      } catch (e) {
        if (e instanceof Error && e.message.includes('revoked')) throw e;
        // Redis error — fail open (don't block requests if Redis is down)
      }
    }

    // Verify user still exists and is active
    const db = c.get('db');
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);

    if (!user || !user.isActive) {
      throw Unauthorized('User not found or inactive');
    }

    c.set('user', {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    } as AuthUser);

    await next();
  });
