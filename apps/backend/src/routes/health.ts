import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { jwt } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import type { AppVariables } from '../app.js';

export const healthRoutes = new Hono<{ Variables: AppVariables }>()
  // Shallow health check — public, for load balancers and Docker healthchecks
  .get('/', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  })

  // Deep readiness check — SUPER_ADMIN only (contains system internals)
  .get('/ready', jwt(), requireRoles('SUPER_ADMIN'), async (c) => {
    const db = c.get('db');
    const env = c.get('env');
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // Database check
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      checks.database = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks.database = { status: 'unhealthy', error: (err as Error).message };
    }

    // Redis check (if configured)
    if (env.REDIS_URL) {
      try {
        const { getRedis } = await import('../lib/redis.js');
        const redis = await getRedis(env.REDIS_URL);
        if (redis) {
          const start = Date.now();
          await redis.ping();
          checks.redis = { status: 'healthy', latencyMs: Date.now() - start };
        } else {
          checks.redis = { status: 'unavailable', error: 'Not connected' };
        }
      } catch (err) {
        checks.redis = { status: 'unhealthy', error: (err as Error).message };
      }
    }

    // Memory check
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    checks.memory = {
      status: heapUsedMB < 450 ? 'healthy' : 'warning',
      latencyMs: undefined,
      error: undefined,
    };

    const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
    const status = allHealthy ? 'ok' : 'degraded';

    return c.json({
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || '3.0.0',
      nodeVersion: process.version,
      environment: env.NODE_ENV,
      checks,
      memory: { heapUsedMB, heapTotalMB, rssMB },
    });
  });
