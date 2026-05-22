import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { compress } from 'hono/compress';
import { HTTPException } from 'hono/http-exception';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { memberRoutes } from './routes/members.js';
import { documentRoutes } from './routes/documents.js';
import { adminRoutes } from './routes/admin.js';
import { auditRoutes } from './routes/audit.js';
import { cronRoutes } from './routes/cron.js';
import { emailTemplateRoutes } from './routes/email-templates.js';
import { reportRoutes } from './routes/reports.js';
import { notificationRoutes } from './routes/notifications.js';
import { settingsRoutes } from './routes/settings.js';
import { randomUUID } from 'node:crypto';
import { rateLimit } from './middleware/rate-limit.js';
import { createServices, type Services } from './lib/container.js';
import { logger } from './lib/logger.js';
import {
  register,
  httpRequestDuration,
  httpRequestTotal,
  httpActiveConnections,
} from './lib/metrics.js';
import type { Db } from './db/index.js';
import type { Env } from './config/env.js';
import type { AuthUser } from './lib/types.js';

// App-level variables available in all handlers via c.get(...)
export type AppVariables = {
  db: Db;
  env: Env;
  services: Services;
  redis: import('ioredis').default | null;
  // Set by the jwt() middleware on protected routes; undefined on public routes.
  user?: AuthUser;
};

export function createApp(db: Db, env: Env, redis?: import('ioredis').default | null) {
  const app = new Hono<{ Variables: AppVariables }>().basePath('/api/v1');
  const services = createServices(db, env);

  // Global error handler
  app.onError((err, c) => {
    const reqId = c.get('requestId' as any);
    if (err instanceof HTTPException) {
      return c.json({ statusCode: err.status, message: err.message }, err.status);
    }
    logger.error({ err, path: c.req.path, reqId }, 'Unhandled error');
    return c.json({ statusCode: 500, message: 'Internal server error' }, 500);
  });

  // Prometheus metrics middleware
  app.use('*', async (c, next) => {
    if (c.req.path === '/api/v1/metrics') {
      await next();
      return;
    }
    httpActiveConnections.inc();
    const end = httpRequestDuration.startTimer();
    await next();
    httpActiveConnections.dec();

    const route = c.req.routePath || c.req.path;
    const labels = {
      method: c.req.method,
      route,
      status: String(c.res.status),
    };
    end(labels);
    httpRequestTotal.inc(labels);
  });

  // Request ID + logging
  app.use('*', async (c, next) => {
    const reqId = (c.req.header('x-request-id') || randomUUID()).slice(0, 36);
    (c as any).set('requestId', reqId);
    c.header('X-Request-Id', reqId);

    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    if (c.req.path !== '/api/v1/health' && c.req.path !== '/api/v1/metrics') {
      logger.info(
        { reqId, method: c.req.method, path: c.req.path, status: c.res.status, ms },
        'request',
      );
    }
  });

  // Security headers
  app.use('*', secureHeaders());

  // CORS
  const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    '*',
    cors({
      origin: origins,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  );

  // Compression
  app.use('*', compress());

  // Rate limiting (100 req/min global) — Redis-backed in production, in-memory fallback
  app.use('*', rateLimit({ windowMs: 60_000, limit: 100, redis }));

  // Inject db, env, services, and redis into context
  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('env', env);
    c.set('services', services);
    c.set('redis', redis ?? null);
    await next();
  });

  // Prometheus metrics endpoint — internal scraping allowed, external requires SUPER_ADMIN
  app.get('/metrics', async (c) => {
    // Allow Prometheus internal scraping (Docker service-to-service, no auth needed)
    // External access (via Caddy proxy) requires auth
    const isInternal =
      c.req.header('user-agent')?.includes('Prometheus') ||
      c.req.header('x-forwarded-for') === undefined; // No proxy = direct internal access

    if (!isInternal) {
      // External request — verify SUPER_ADMIN token
      const authHeader = c.req.header('authorization');
      if (!authHeader) return c.text('Unauthorized', 401);
      // Delegate to JWT middleware pattern
      try {
        const token = authHeader.replace('Bearer ', '');
        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const { jwtVerify } = await import('jose');
        const { payload } = await jwtVerify(token, secret);
        if ((payload as any).role !== 'SUPER_ADMIN') return c.text('Forbidden', 403);
      } catch {
        return c.text('Unauthorized', 401);
      }
    }

    const metrics = await register.metrics();
    return c.text(metrics, 200, { 'Content-Type': register.contentType });
  });

  // Routes
  app.route('/health', healthRoutes);
  app.route('/auth', authRoutes);
  app.route('/members', memberRoutes);
  app.route('/documents', documentRoutes);
  app.route('/admin/users', adminRoutes);
  app.route('/audit-logs', auditRoutes);
  app.route('/cron', cronRoutes);
  app.route('/admin/email-templates', emailTemplateRoutes);
  app.route('/reports', reportRoutes);
  app.route('/notifications', notificationRoutes);
  app.route('/admin/settings', settingsRoutes);

  return app;
}
