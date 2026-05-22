import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { asc } from 'drizzle-orm';
import { organizations } from '../db/schema.js';
import { jwt } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import {
  getTemplates,
  saveTemplate,
  renderPreview,
  DEFAULT_TEMPLATES,
  type TemplateId,
  type TemplateFields,
} from '../lib/email-templates.js';
import type { AppVariables } from '../app.js';
import { getDb, getUser, getServices, getEnv } from '../lib/context.js';

const SUPER_ADMIN = requireRoles('SUPER_ADMIN');

const updateSchema = z.object({
  subject: z.string().optional(),
  heading: z.string().optional(),
  body: z.string().optional(),
  instructions: z.string().optional(),
  votingNote: z.string().optional(),
  generalNote: z.string().optional(),
  footer: z.string().optional(),
});

const previewSchema = z.object({
  templateId: z.enum(['signupConfirmation', 'weeklyReminder', 'approved', 'rejected']),
});

export const emailTemplateRoutes = new Hono<{ Variables: AppVariables }>()

  // GET /admin/email-templates — list all templates with current values
  .get('/', jwt(), SUPER_ADMIN, async (c) => {
    const db = getDb(c);
    const user = c.get('user');
    const templates = await getTemplates(db, user.organizationId);
    return c.json({ templates, defaults: DEFAULT_TEMPLATES });
  })

  // PUT /admin/email-templates/:id — update a template
  .put('/:id', jwt(), SUPER_ADMIN, zValidator('json', updateSchema), async (c) => {
    const db = getDb(c);
    const user = c.get('user');
    const templateId = c.req.param('id') as TemplateId;

    if (!DEFAULT_TEMPLATES[templateId]) {
      return c.json({ error: 'Invalid template ID' }, 400);
    }

    const fields = c.req.valid('json') as Partial<TemplateFields>;
    await saveTemplate(db, user.organizationId, templateId, fields);
    const templates = await getTemplates(db, user.organizationId);
    return c.json({ templates });
  })

  // DELETE /admin/email-templates/:id — reset to default
  .delete('/:id', jwt(), SUPER_ADMIN, async (c) => {
    const db = getDb(c);
    const user = c.get('user');
    const templateId = c.req.param('id') as TemplateId;

    // Remove the override by saving undefined/null
    await saveTemplate(db, user.organizationId, templateId, {} as any);
    // Actually remove the key entirely
    const { eq } = await import('drizzle-orm');
    const [org] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);
    const settings = (org?.settings || {}) as Record<string, unknown>;
    const emailTemplates = (settings.emailTemplates || {}) as Record<string, unknown>;
    delete emailTemplates[templateId];
    settings.emailTemplates = emailTemplates;
    await db
      .update(organizations)
      .set({ settings, updatedAt: new Date().toISOString() })
      .where(eq(organizations.id, user.organizationId));

    const templates = await getTemplates(db, user.organizationId);
    return c.json({ templates });
  })

  // POST /admin/email-templates/preview — render preview with sample data
  .post('/preview', jwt(), SUPER_ADMIN, zValidator('json', previewSchema), async (c) => {
    const db = getDb(c);
    const user = c.get('user');
    const { templateId } = c.req.valid('json');

    const templates = await getTemplates(db, user.organizationId);
    const template = templates[templateId];
    const preview = renderPreview(template, templateId);
    return c.json(preview);
  });
