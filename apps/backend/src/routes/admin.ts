import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, ne, desc } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { users } from '../db/schema.js';
import { createAdminSchema, updateAdminSchema } from '../validators/admin.schema.js';
import { jwt } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { audit } from '../middleware/audit.js';
import { BadRequest } from '../lib/errors.js';
import type { AppVariables } from '../app.js';
import { getDb } from '../lib/context.js';

const SUPER_ADMIN = requireRoles('SUPER_ADMIN');
const ADMIN_WRITE = requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER');

export const adminRoutes = new Hono<{ Variables: AppVariables }>()

  // GET /admin/users — list admin users (Super Admin + Manager only)
  .get('/', jwt(), ADMIN_WRITE, async (c) => {
    const db = getDb(c);
    const user = c.get('user');
    return c.json(
      await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          mfaEnabled: users.mfaEnabled,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(eq(users.organizationId, user.organizationId), ne(users.role, 'MEMBER')))
        .orderBy(desc(users.createdAt)),
    );
  })

  // POST /admin/users — create admin user
  // SUPER_ADMIN can create MEMBERSHIP_MANAGER or VIEWER
  // MEMBERSHIP_MANAGER can only create VIEWER
  .post(
    '/',
    jwt(),
    requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER'),
    audit(),
    zValidator('json', createAdminSchema),
    async (c) => {
      const db = getDb(c);
      const user = c.get('user');
      const dto = c.req.valid('json');

      if (dto.role === 'MEMBER' || dto.role === 'SUPER_ADMIN') {
        throw BadRequest('Can only create MEMBERSHIP_MANAGER or VIEWER accounts');
      }
      // Managers can only create Viewers
      if (user.role === 'MEMBERSHIP_MANAGER' && dto.role !== 'VIEWER') {
        throw BadRequest('Managers can only create Viewer accounts');
      }

      const [existing] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, dto.email), eq(users.organizationId, user.organizationId)))
        .limit(1);
      if (existing) throw BadRequest('User with this email already exists');

      const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
      const [created] = await db
        .insert(users)
        .values({
          organizationId: user.organizationId,
          email: dto.email,
          role: dto.role,
          passwordHash,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .returning({
          id: users.id,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        });

      return c.json(created, 201);
    },
  )

  // PATCH /admin/users/:id — update admin role or status
  .patch('/:id', jwt(), SUPER_ADMIN, audit(), zValidator('json', updateAdminSchema), async (c) => {
    const db = getDb(c);
    const currentUser = c.get('user');
    const targetId = c.req.param('id');
    const dto = c.req.valid('json');

    if (targetId === currentUser.id && dto.role) throw BadRequest('Cannot change your own role');
    if (targetId === currentUser.id && dto.isActive === false)
      throw BadRequest('Cannot deactivate yourself');

    const [target] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, targetId),
          eq(users.organizationId, currentUser.organizationId),
          ne(users.role, 'MEMBER'),
        ),
      )
      .limit(1);
    if (!target) throw BadRequest('Admin user not found');

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, targetId))
      .returning({ id: users.id, email: users.email, role: users.role, isActive: users.isActive });
    return c.json(updated);
  })

  // DELETE /admin/users/:id — deactivate admin user
  // SUPER_ADMIN can delete any admin; MEMBERSHIP_MANAGER can only delete VIEWER
  .delete('/:id', jwt(), requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER'), audit(), async (c) => {
    const db = getDb(c);
    const currentUser = c.get('user');
    const targetId = c.req.param('id');

    if (targetId === currentUser.id) throw BadRequest('Cannot delete your own account');

    const [target] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, targetId),
          eq(users.organizationId, currentUser.organizationId),
          ne(users.role, 'MEMBER'),
        ),
      )
      .limit(1);
    if (!target) throw BadRequest('Admin user not found');

    // Managers can only deactivate Viewers
    if (currentUser.role === 'MEMBERSHIP_MANAGER' && target.role !== 'VIEWER') {
      throw BadRequest('Managers can only deactivate Viewer accounts');
    }

    await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, targetId));
    return c.json({ success: true });
  });
