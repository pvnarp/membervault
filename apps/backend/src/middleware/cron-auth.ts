import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { Unauthorized } from '../lib/errors.js';
import type { AuthUser } from '../lib/types.js';
import type { Db } from '../db/index.js';
import type { Env } from '../config/env.js';

// Constant-time comparison to avoid leaking the secret through response timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Authentication for /cron/* routes. Accepts EITHER:
 *   - An `x-cron-secret` header that matches `env.CRON_SECRET`
 *     (used by scheduled jobs: k8s CronJob, GitHub Actions, etc.), OR
 *   - A JWT Bearer token belonging to a SUPER_ADMIN user
 *     (used by humans triggering jobs manually from the admin UI).
 *
 * Unlike the previous middleware, this check runs regardless of NODE_ENV so
 * dev/staging cron endpoints cannot be triggered anonymously.
 */
export const cronAuth = () =>
  createMiddleware<{
    Variables: {
      user?: AuthUser;
      db: Db;
      env: Env;
      redis: import('ioredis').default | null;
    };
  }>(async (c, next) => {
    const env = c.get('env');

    // ---- Path 1: cron secret ----
    const provided = c.req.header('x-cron-secret');
    if (provided && env.CRON_SECRET && timingSafeEqual(provided, env.CRON_SECRET)) {
      await next();
      return;
    }

    // ---- Path 2: SUPER_ADMIN JWT ----
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        const claims = payload as { sub: string; role: string };

        const db = c.get('db');
        const [user] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);

        if (user?.isActive && user.role === 'SUPER_ADMIN') {
          c.set('user', {
            id: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
          } as AuthUser);
          await next();
          return;
        }
      } catch {
        // fall through to 401
      }
    }

    throw Unauthorized('Cron endpoint requires x-cron-secret header or SUPER_ADMIN token');
  });
