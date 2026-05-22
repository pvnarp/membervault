import { Hono } from 'hono';
import { eq, and, desc, gte, lte, like, or, sql } from 'drizzle-orm';
import { auditLogs, users } from '../db/schema.js';
import { jwt } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import type { AppVariables } from '../app.js';
import { getDb, getUser } from '../lib/context.js';

const ADMIN_WRITE = requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER');

export const auditRoutes = new Hono<{ Variables: AppVariables }>()
  // GET /audit-logs/export — CSV export scoped to caller's org
  .get('/export', jwt(), ADMIN_WRITE, async (c) => {
    const db = getDb(c);
    const { organizationId } = c.get('user');
    const action = c.req.query('action');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const conditions = [eq(auditLogs.organizationId, organizationId)];
    if (action) conditions.push(eq(auditLogs.action, action));
    if (startDate) conditions.push(gte(auditLogs.timestamp, startDate));
    if (endDate) conditions.push(lte(auditLogs.timestamp, endDate));

    const rows = await db
      .select({
        id: auditLogs.id,
        userEmail: users.email,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        action: auditLogs.action,
        ipAddress: auditLogs.ipAddress,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.timestamp))
      .limit(10000);

    const header = 'Timestamp,User,Action,Table,Record ID,IP Address\n';
    const csvRows = rows.map((r: any) =>
      [
        r.timestamp || '',
        r.userEmail || 'system',
        r.action || '',
        r.tableName || '',
        r.recordId || '',
        r.ipAddress || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    return new Response(header + csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit_log_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  })

  // GET /audit-logs — paginated list scoped to caller's org
  .get('/', jwt(), ADMIN_WRITE, async (c) => {
    const db = getDb(c);
    const { organizationId } = c.get('user');
    const page = Number(c.req.query('page') || 1);
    const limit = Number(c.req.query('limit') || 25);
    const action = c.req.query('action');
    const search = c.req.query('search');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const conditions = [eq(auditLogs.organizationId, organizationId)];

    if (action) conditions.push(eq(auditLogs.action, action));
    if (search) {
      conditions.push(
        or(like(auditLogs.recordId, `%${search}%`), like(auditLogs.tableName, `%${search}%`))!,
      );
    }
    if (startDate) conditions.push(gte(auditLogs.timestamp, startDate));
    if (endDate) conditions.push(lte(auditLogs.timestamp, endDate));

    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userEmail: users.email,
          tableName: auditLogs.tableName,
          recordId: auditLogs.recordId,
          action: auditLogs.action,
          oldValues: auditLogs.oldValues,
          newValues: auditLogs.newValues,
          ipAddress: auditLogs.ipAddress,
          timestamp: auditLogs.timestamp,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(where)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql`count(*)::int` })
        .from(auditLogs)
        .where(where),
    ]);

    const total = (countResult[0]?.count as number) ?? 0;
    return c.json({
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });
