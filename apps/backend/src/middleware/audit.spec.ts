import { Hono } from 'hono';
import { audit } from './audit.js';

function makeFakeDb() {
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        inserts.push({ table, values });
        return [{ id: 'audit-1' }];
      }),
    })),
  };
  return { db, inserts };
}

function makeApp(
  db: ReturnType<typeof makeFakeDb>['db'],
  user?: { id: string; organizationId?: string },
) {
  const app = new Hono<{
    Variables: { user?: { id: string; organizationId?: string }; db: typeof db };
  }>().basePath('/api/v1');
  app.use('*', async (c, next) => {
    c.set('db', db);
    if (user) c.set('user', user);
    await next();
  });
  return app;
}

describe('audit middleware', () => {
  it('skips audit when response status is 4xx', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.post('/members', audit(), (c) => c.json({ message: 'Bad' }, 400));

    const res = await app.request('/api/v1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING' }),
    });

    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it('skips audit when response status is 5xx', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.delete('/members/:id', audit(), (c) => c.json({ message: 'Boom' }, 500));

    await app.request('/api/v1/members/m-1', { method: 'DELETE' });
    expect(inserts).toHaveLength(0);
  });

  it('skips audit for non-mutating methods', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.get('/members', audit(), (c) => c.json([]));

    await app.request('/api/v1/members');
    expect(inserts).toHaveLength(0);
  });

  it('records the URL :id param as recordId for PATCH', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.patch('/members/:id', audit(), (c) => c.json({ id: c.req.param('id'), ok: true }));

    const res = await app.request('/api/v1/members/m-42', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    expect(res.status).toBe(200);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values.recordId).toBe('m-42');
    expect(inserts[0].values.action).toBe('PATCH:200');
    expect(inserts[0].values.tableName).toBe('members');
    expect(inserts[0].values.userId).toBe('u-1');
    expect(inserts[0].values.organizationId).toBe('org-1');
  });

  it('extracts recordId from response body for POST creates without :id', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.post('/members', audit(), (c) => c.json({ id: 'new-member-id', name: 'X' }, 201));

    await app.request('/api/v1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING' }),
    });

    expect(inserts[0].values.recordId).toBe('new-member-id');
    expect(inserts[0].values.action).toBe('POST:201');
  });

  it('redacts credentials and encrypted PII in newValues', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.patch('/members/:id', audit(), (c) => c.json({ ok: true }));

    await app.request('/api/v1/members/m-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        driverLicenseNumber: 'DL12345',
        password: 'plaintext',
        status: 'APPROVED',
        memberType: 'VOTING',
      }),
    });

    const newValues = inserts[0].values.newValues as Record<string, unknown>;
    expect(newValues.firstName).toBe('[REDACTED]');
    expect(newValues.lastName).toBe('[REDACTED]');
    expect(newValues.email).toBe('[REDACTED]');
    expect(newValues.driverLicenseNumber).toBe('[REDACTED]');
    expect(newValues.password).toBe('[REDACTED]');
    expect(newValues.status).toBe('APPROVED');
    expect(newValues.memberType).toBe('VOTING');
  });

  it('redacts sensitive keys nested in objects', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.post('/admin/users', audit(), (c) => c.json({ id: 'u-99' }, 201));

    await app.request('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'VIEWER',
        credentials: { password: 'hunter2', mfaSecret: 'JBSWY3DPEHPK3PXP' },
      }),
    });

    const newValues = inserts[0].values.newValues as Record<string, unknown>;
    expect(newValues.role).toBe('VIEWER');
    const creds = newValues.credentials as Record<string, unknown>;
    expect(creds.password).toBe('[REDACTED]');
    expect(creds.mfaSecret).toBe('[REDACTED]');
    expect(inserts[0].values.tableName).toBe('users');
  });

  it('uses last hop of x-forwarded-for, not the first', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.patch('/members/:id', audit(), (c) => c.json({ ok: true }));

    await app.request('/api/v1/members/m-1', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '1.2.3.4, 10.0.0.5, 172.16.0.1',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    expect(inserts[0].values.ipAddress).toBe('172.16.0.1');
  });

  it('records DELETE with status code and no body capture', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.delete('/members/:id', audit(), (c) => c.json({ deleted: true }));

    await app.request('/api/v1/members/m-77', { method: 'DELETE' });

    expect(inserts[0].values.action).toBe('DELETE:200');
    expect(inserts[0].values.recordId).toBe('m-77');
    expect(inserts[0].values.newValues).toBeNull();
  });

  it('handles missing user (system actions) with userId null', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db);
    app.post('/cron/refresh', audit(), (c) => c.json({ ok: true }));

    await app.request('/api/v1/cron/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(inserts[0].values.userId).toBeNull();
  });

  it('does not throw or fail the request when audit insert errors', async () => {
    const exploding = {
      insert: vi.fn(() => ({
        values: vi.fn(async () => {
          throw new Error('db down');
        }),
      })),
    };
    const app = makeApp(exploding as never, { id: 'u-1', organizationId: 'org-1' });
    app.patch('/members/:id', audit(), (c) => c.json({ ok: true }));

    const res = await app.request('/api/v1/members/m-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    expect(res.status).toBe(200);
  });

  it('strips the admin/ namespace from the resource name', async () => {
    const { db, inserts } = makeFakeDb();
    const app = makeApp(db, { id: 'u-1', organizationId: 'org-1' });
    app.patch('/admin/users/:id', audit(), (c) => c.json({ ok: true }));

    await app.request('/api/v1/admin/users/u-9', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'VIEWER' }),
    });

    expect(inserts[0].values.tableName).toBe('users');
  });
});
