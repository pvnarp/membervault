import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { members, users, auditLogs, organizations, documents } from '../db/schema.js';
import { EncryptionService } from '../lib/encryption.js';
import { cronAuth } from '../middleware/cron-auth.js';
import { requireRoles } from '../middleware/roles.js';
import { Forbidden } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { AppVariables } from '../app.js';

const DEMO_ONLY = requireRoles('SUPER_ADMIN');

function blockInProd(env: { NODE_ENV: string }) {
  if (env.NODE_ENV === 'production') {
    throw Forbidden('This endpoint is not available in production');
  }
}

export const cronRoutes = new Hono<{ Variables: AppVariables }>()
  // All cron routes require either a cron secret or a SUPER_ADMIN JWT.
  .use('*', cronAuth())

  // POST /cron/weekly-reminders — Send reminders to PENDING members across
  // every organization (multi-tenant safe: per-org loop, no cross-tenant leak).
  .post('/weekly-reminders', async (c) => {
    const db = c.get('db');
    const services = c.get('services');
    const encryption = services.encryption as EncryptionService;
    const email = services.email;

    const orgs = await db.select({ id: organizations.id }).from(organizations);

    const perOrg: Array<{ organizationId: string; sent: number; total: number }> = [];
    let totalSent = 0;
    let totalPending = 0;

    for (const org of orgs) {
      const pending = await db
        .select()
        .from(members)
        .where(eq(members.organizationId, org.id))
        .then((rows) => rows.filter((m) => m.status === 'PENDING'));

      let sent = 0;
      for (const member of pending) {
        try {
          const memberEmail = encryption.decrypt(member.emailEnc);
          const firstName = encryption.decrypt(member.firstNameEnc);
          const lastName = encryption.decrypt(member.lastNameEnc);
          await email.sendWeeklyReminder(
            memberEmail,
            `${firstName} ${lastName}`,
            member.memberNumber || member.id,
            member.applicationDate || member.createdAt,
          );
          sent++;
        } catch (err) {
          logger.error(
            { err, memberId: member.id, organizationId: org.id },
            'Failed to send weekly reminder',
          );
        }
      }

      perOrg.push({ organizationId: org.id, sent, total: pending.length });
      totalSent += sent;
      totalPending += pending.length;
    }

    return c.json({ sent: totalSent, total: totalPending, organizations: perOrg });
  })

  // POST /cron/reset-demo — Flush all data and reseed (SUPER_ADMIN, dev only).
  .post('/reset-demo', DEMO_ONLY, async (c) => {
    blockInProd(c.get('env'));

    const db = c.get('db');

    // Delete in FK-safe order (children before parents)
    await db.delete(documents);
    await db.delete(auditLogs);

    // Delete member users (role=MEMBER) but keep admin users
    await db.delete(users).where(eq(users.role, 'MEMBER'));

    // Delete all members
    await db.delete(members);

    // Clean uploaded files from disk
    try {
      const fs = await import('node:fs/promises');
      const env = c.get('env');
      const uploadDir = env.UPLOAD_PATH || './uploads';
      const files = await fs.readdir(uploadDir).catch(() => [] as string[]);
      for (const file of files) {
        await fs.unlink(`${uploadDir}/${file}`).catch(() => {});
      }
    } catch {
      /* upload dir may not exist yet */
    }

    // Reset org settings (clear email template customizations)
    const [org] = await db.select().from(organizations).limit(1);
    if (org) {
      await db
        .update(organizations)
        .set({ settings: {}, updatedAt: new Date().toISOString() })
        .where(eq(organizations.id, org.id));
    }

    return c.json({
      message: 'Demo data flushed. Run seed to repopulate.',
      hint: 'POST /api/v1/cron/seed-demo to reseed, or run: npm run db:seed',
    });
  })

  // POST /cron/reindex-search — Rebuild member search indexes (SUPER_ADMIN, dev only).
  .post('/reindex-search', DEMO_ONLY, async (c) => {
    blockInProd(c.get('env'));

    const services = c.get('services');
    const { MemberService } = await import('../services/member.service.js');
    const db = c.get('db');
    const user = c.get('user');
    const svc = new MemberService(db, services.encryption, services.email);

    // Scope to the caller's org (cron-secret path has no user; reject so we
    // don't accidentally reindex the wrong tenant)
    if (!user) {
      throw Forbidden('Reindex requires SUPER_ADMIN authentication, not cron secret');
    }
    const count = await svc.rebuildAllSearchIndexes(user.organizationId);
    return c.json({ message: `Rebuilt search index for ${count} members` });
  })

  // POST /cron/seed-demo — Reseed demo data (SUPER_ADMIN, dev only).
  .post('/seed-demo', DEMO_ONLY, async (c) => {
    blockInProd(c.get('env'));

    try {
      const env = c.get('env');
      const { main: seedMain } = await import('../db/seed.js');
      await seedMain(env.DATABASE_URL);
      return c.json({ message: 'Demo data seeded successfully' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error }, 'Seed failed');
      return c.json({ error: 'Seed failed', details: msg }, 500);
    }
  });
