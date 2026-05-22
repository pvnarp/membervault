import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { organizations } from '../db/schema.js';
import { jwt } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { audit } from '../middleware/audit.js';
import type { AppVariables } from '../app.js';
import { getDb, getUser, getServices, getEnv } from '../lib/context.js';

const SUPER_ADMIN = requireRoles('SUPER_ADMIN');
const ADMIN = requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER', 'VIEWER');

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  timezone: z.string().max(100).optional(),
  emailDomain: z.string().max(255).optional(),
  logo: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  website: z.string().max(255).optional(),
});

export const settingsRoutes = new Hono<{ Variables: AppVariables }>()

  // GET /admin/settings — get org settings
  .get('/', jwt(), ADMIN, async (c) => {
    const db = getDb(c);
    const user = c.get('user');
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);
    if (!org) return c.json({ error: 'Organization not found' }, 404);
    return c.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      settings: org.settings || {},
    });
  })

  // PATCH /admin/settings — update org settings
  .patch('/', jwt(), SUPER_ADMIN, audit(), zValidator('json', updateSettingsSchema), async (c) => {
    const db = getDb(c);
    const user = c.get('user');
    const data = c.req.valid('json');

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);
    if (!org) return c.json({ error: 'Organization not found' }, 404);

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    // Name goes on the org record directly
    if (data.name !== undefined) updateData.name = data.name;

    // Everything else goes into the settings JSONB
    const newSettings = { ...(org.settings as Record<string, unknown>) };
    for (const key of ['timezone', 'emailDomain', 'logo', 'address', 'phone', 'website'] as const) {
      if (data[key] !== undefined) newSettings[key] = data[key];
    }
    updateData.settings = newSettings;

    const [updated] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, user.organizationId))
      .returning();

    return c.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      settings: updated.settings || {},
    });
  });
