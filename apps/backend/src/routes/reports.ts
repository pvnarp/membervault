import { Hono } from 'hono';
import { eq, and, sql, count } from 'drizzle-orm';
import { members } from '../db/schema.js';
import { jwt } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import type { AppVariables } from '../app.js';
import { getUser } from '../lib/context.js';

export const reportRoutes = new Hono<{ Variables: AppVariables }>()
  // All report routes require admin
  .use('*', jwt())
  .use('*', requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER', 'VIEWER'))

  // Membership statistics — aggregated data for charts
  .get('/membership-stats', async (c) => {
    const db = c.get('db');
    const orgId = getUser(c).organizationId;

    // Time range filter: ?range=1m|3m|6m|1y|all (default: 1y)
    const range = c.req.query('range') || '1y';
    const intervalMap: Record<string, string> = {
      '1m': '1 month',
      '3m': '3 months',
      '6m': '6 months',
      '1y': '1 year',
      '2y': '2 years',
      all: '100 years',
    };
    const interval = intervalMap[range] || '1 year';

    // Members by month
    const membersByMonth = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', application_date), 'YYYY-MM') as month,
        COUNT(*) as count
      FROM members
      WHERE organization_id = ${orgId}
        AND application_date >= NOW() - CAST(${interval} AS INTERVAL)
      GROUP BY DATE_TRUNC('month', application_date)
      ORDER BY month
    `);

    // Status distribution
    const byStatus = await db
      .select({ status: members.status, count: count() })
      .from(members)
      .where(eq(members.organizationId, orgId))
      .groupBy(members.status);

    // Member type distribution
    const byType = await db
      .select({ memberType: members.memberType, count: count() })
      .from(members)
      .where(and(eq(members.organizationId, orgId), eq(members.status, 'APPROVED')))
      .groupBy(members.memberType);

    // Geographic distribution (by city)
    const byCity = await db.execute(sql`
      SELECT city, COUNT(*) as count
      FROM members
      WHERE organization_id = ${orgId}
        AND city IS NOT NULL AND city != ''
        AND status = 'APPROVED'
      GROUP BY city
      ORDER BY count DESC
      LIMIT 15
    `);

    return c.json({
      membersByMonth: membersByMonth.rows,
      byStatus,
      byType,
      byCity: byCity.rows,
    });
  });
