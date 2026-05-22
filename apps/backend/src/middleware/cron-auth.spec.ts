import { Hono } from 'hono';
import { SignJWT } from 'jose';
import { HTTPException } from 'hono/http-exception';
import { cronAuth } from './cron-auth.js';

const JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
const CRON_SECRET = 'cron-secret-at-least-thirty-two-chars-x';

async function makeJwt(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

function makeApp(opts: {
  env?: Partial<{ NODE_ENV: string; JWT_SECRET: string; CRON_SECRET: string }>;
  dbUsers?: Array<{
    id: string;
    email: string;
    role: string;
    organizationId: string;
    isActive: boolean;
  }>;
}) {
  const env = {
    NODE_ENV: 'production',
    JWT_SECRET,
    CRON_SECRET,
    ...opts.env,
  };
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            return opts.dbUsers ?? [];
          },
        }),
      }),
    }),
  };
  const app = new Hono().basePath('/api/v1');
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ message: err.message }, err.status);
    }
    return c.json({ message: 'error' }, 500);
  });
  app.use('*', async (c, next) => {
    c.set('env', env);
    c.set('db', db);
    c.set('redis', null);
    await next();
  });
  app.post('/cron/test', cronAuth(), (c) => {
    const user = c.get('user' as never) as { id: string } | undefined;
    return c.json({ ok: true, asUser: user?.id ?? null });
  });
  return app;
}

describe('cronAuth middleware', () => {
  it('accepts a matching x-cron-secret header (cron path)', async () => {
    const app = makeApp({});
    const res = await app.request('/api/v1/cron/test', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, asUser: null });
  });

  it('rejects when cron secret header is wrong', async () => {
    const app = makeApp({});
    const res = await app.request('/api/v1/cron/test', {
      method: 'POST',
      headers: { 'x-cron-secret': 'nope' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects when no auth at all is provided, even in development', async () => {
    const app = makeApp({ env: { NODE_ENV: 'development' } });
    const res = await app.request('/api/v1/cron/test', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('rejects an empty cron secret (env not configured)', async () => {
    const app = makeApp({ env: { CRON_SECRET: '' } });
    const res = await app.request('/api/v1/cron/test', {
      method: 'POST',
      headers: { 'x-cron-secret': '' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts SUPER_ADMIN JWT and sets user on context', async () => {
    const dbUsers = [
      {
        id: 'u-admin',
        email: 'admin@example.org',
        role: 'SUPER_ADMIN',
        organizationId: 'org-1',
        isActive: true,
      },
    ];
    const app = makeApp({ dbUsers });
    const token = await makeJwt({ sub: 'u-admin', role: 'SUPER_ADMIN' });
    const res = await app.request('/api/v1/cron/test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, asUser: 'u-admin' });
  });

  it('rejects a JWT whose user is not SUPER_ADMIN', async () => {
    const dbUsers = [
      {
        id: 'u-mgr',
        email: 'mgr@example.org',
        role: 'MEMBERSHIP_MANAGER',
        organizationId: 'org-1',
        isActive: true,
      },
    ];
    const app = makeApp({ dbUsers });
    const token = await makeJwt({ sub: 'u-mgr', role: 'MEMBERSHIP_MANAGER' });
    const res = await app.request('/api/v1/cron/test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a JWT for an inactive user', async () => {
    const dbUsers = [
      {
        id: 'u-admin',
        email: 'admin@example.org',
        role: 'SUPER_ADMIN',
        organizationId: 'org-1',
        isActive: false,
      },
    ];
    const app = makeApp({ dbUsers });
    const token = await makeJwt({ sub: 'u-admin', role: 'SUPER_ADMIN' });
    const res = await app.request('/api/v1/cron/test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a malformed JWT', async () => {
    const app = makeApp({});
    const res = await app.request('/api/v1/cron/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer garbage.token.here' },
    });
    expect(res.status).toBe(401);
  });
});
