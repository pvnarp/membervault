import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import {
  listMembersQuerySchema,
  updateMemberSchema,
  rejectMemberSchema,
  changeRequestSchema,
  updateOwnProfileSchema,
  bulkApproveSchema,
  bulkRejectSchema,
} from '../validators/member.schema.js';
import { jwt } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { audit } from '../middleware/audit.js';
import { MemberService } from '../services/member.service.js';
import { ImportService } from '../services/import.service.js';
import { members } from '../db/schema.js';
import { getDb, getUser, getServices, getEnv } from '../lib/context.js';
import type { AppVariables } from '../app.js';

function getMemberService(c: Parameters<typeof getDb>[0]): MemberService {
  const services = getServices(c);
  return new MemberService(getDb(c), services.encryption, services.email);
}

const ADMIN = requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER', 'VIEWER');
const ADMIN_WRITE = requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER');
const SUPER_ADMIN = requireRoles('SUPER_ADMIN');
const MEMBER = requireRoles('MEMBER');

export const memberRoutes = new Hono<{ Variables: AppVariables }>()

  // GET /members — List members (admin)
  .get('/', jwt(), ADMIN, zValidator('query', listMembersQuerySchema), async (c) => {
    const svc = getMemberService(c);
    const user = c.get('user');
    const query = c.req.valid('query');
    return c.json(await svc.listMembers(user.organizationId, query));
  })

  // GET /members/me — Own profile (member)
  .get('/me', jwt(), MEMBER, async (c) => {
    const svc = getMemberService(c);
    return c.json(await svc.getOwnProfile(getUser(c).id));
  })

  // PATCH /members/me — Update own non-critical fields (member)
  .patch('/me', jwt(), MEMBER, zValidator('json', updateOwnProfileSchema), async (c) => {
    const svc = getMemberService(c);
    return c.json(await svc.updateOwnProfile(getUser(c).id, c.req.valid('json')));
  })

  // POST /members/me/change-request — Request critical field change (member)
  .post('/me/change-request', jwt(), MEMBER, zValidator('json', changeRequestSchema), async (c) => {
    const svc = getMemberService(c);
    const user = c.get('user');
    const result = await svc.requestProfileChange(
      user.id,
      c.req.valid('json') as Record<string, string>,
    );

    // Notify admins about the change request
    const { notifications } = getServices(c);
    notifications
      .notifyAdmins(c.get('db'), user.organizationId, {
        type: 'change_request',
        title: 'Change Request Submitted',
        message: `A member has submitted a profile change request for review.`,
        relatedId: (result as any).id,
      })
      .catch(() => {});

    return c.json(result);
  })

  // GET /members/change-requests — List pending change requests (admin)
  .get('/change-requests', jwt(), ADMIN_WRITE, async (c) => {
    const svc = getMemberService(c);
    return c.json(await svc.listChangeRequests(getUser(c).organizationId));
  })

  // GET /members/:id — Get member detail (admin)
  .get('/:id', jwt(), ADMIN, async (c) => {
    const svc = getMemberService(c);
    return c.json(await svc.getMember(c.req.param('id'), getUser(c).organizationId));
  })

  // PATCH /members/:id — Update member (admin)
  .patch('/:id', jwt(), ADMIN_WRITE, audit(), zValidator('json', updateMemberSchema), async (c) => {
    const svc = getMemberService(c);
    return c.json(
      await svc.updateMember(
        c.req.param('id'),
        getUser(c).organizationId,
        c.req.valid('json') as Record<string, unknown>,
      ),
    );
  })

  // DELETE /members/:id — Delete member (super admin)
  .delete('/:id', jwt(), SUPER_ADMIN, audit(), async (c) => {
    const svc = getMemberService(c);
    return c.json(await svc.deleteMember(c.req.param('id'), getUser(c).organizationId));
  })

  // POST /members/:id/approve — Approve application (admin)
  .post('/:id/approve', jwt(), ADMIN_WRITE, audit(), async (c) => {
    const svc = getMemberService(c);
    const user = c.get('user');
    const result = await svc.approveMember(c.req.param('id'), user.organizationId, user.id);

    // In-app notification to member
    const { notifications } = getServices(c);
    const memberData = result as any;
    if (memberData.userId) {
      notifications
        .create({
          userId: memberData.userId,
          organizationId: user.organizationId,
          type: 'approval',
          title: 'Application Approved',
          message: `Your membership application has been approved. Welcome!`,
          relatedId: c.req.param('id'),
        })
        .catch(() => {});
    }

    return c.json(result);
  })

  // POST /members/:id/approve-change — Approve change request (admin)
  .post('/:id/approve-change', jwt(), ADMIN_WRITE, audit(), async (c) => {
    const svc = getMemberService(c);
    const result = await svc.approveChangeRequest(c.req.param('id'), getUser(c).organizationId);
    const memberData = result as any;
    if (memberData.userId) {
      const { notifications } = getServices(c);
      notifications
        .create({
          userId: memberData.userId,
          organizationId: getUser(c).organizationId,
          type: 'change_request',
          title: 'Change Request Approved',
          message: 'Your profile change request has been approved and applied.',
          relatedId: c.req.param('id'),
        })
        .catch(() => {});
    }
    return c.json(result);
  })

  // POST /members/:id/deny-change — Deny change request (admin)
  .post('/:id/deny-change', jwt(), ADMIN_WRITE, audit(), async (c) => {
    const svc = getMemberService(c);
    const result = await svc.denyChangeRequest(c.req.param('id'), getUser(c).organizationId);
    const memberData = result as any;
    if (memberData.userId) {
      const { notifications } = getServices(c);
      notifications
        .create({
          userId: memberData.userId,
          organizationId: getUser(c).organizationId,
          type: 'change_request',
          title: 'Change Request Denied',
          message: 'Your profile change request was not approved.',
          relatedId: c.req.param('id'),
        })
        .catch(() => {});
    }
    return c.json(result);
  })

  // POST /members/:id/reject — Reject application (admin)
  .post(
    '/:id/reject',
    jwt(),
    ADMIN_WRITE,
    audit(),
    zValidator('json', rejectMemberSchema),
    async (c) => {
      const svc = getMemberService(c);
      const user = c.get('user');
      const { reason } = c.req.valid('json');
      const result = await svc.rejectMember(
        c.req.param('id'),
        user.organizationId,
        user.id,
        reason,
      );

      // In-app notification to member (if they have a userId)
      const memberData = result as any;
      if (memberData.userId) {
        const { notifications } = getServices(c);
        notifications
          .create({
            userId: memberData.userId,
            organizationId: user.organizationId,
            type: 'rejection',
            title: 'Application Update',
            message: `Your membership application status has been updated.`,
            relatedId: c.req.param('id'),
          })
          .catch(() => {});
      }

      return c.json(result);
    },
  )

  // POST /members/bulk/approve — Bulk approve members
  .post(
    '/bulk/approve',
    jwt(),
    ADMIN_WRITE,
    audit(),
    zValidator('json', bulkApproveSchema),
    async (c) => {
      const svc = getMemberService(c);
      const user = c.get('user');
      const { memberIds } = c.req.valid('json');
      const { notifications } = getServices(c);

      const results = { approved: 0, failed: 0, errors: [] as string[] };
      for (const id of memberIds) {
        try {
          const result = await svc.approveMember(id, user.organizationId, user.id);
          results.approved++;
          const memberData = result as any;
          if (memberData.userId) {
            notifications
              .create({
                userId: memberData.userId,
                organizationId: user.organizationId,
                type: 'approval',
                title: 'Application Approved',
                message: 'Your membership application has been approved. Welcome!',
                relatedId: id,
              })
              .catch(() => {});
          }
        } catch (e) {
          results.failed++;
          results.errors.push(`${id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
      return c.json(results);
    },
  )

  // POST /members/bulk/reject — Bulk reject members
  .post(
    '/bulk/reject',
    jwt(),
    ADMIN_WRITE,
    audit(),
    zValidator('json', bulkRejectSchema),
    async (c) => {
      const svc = getMemberService(c);
      const user = c.get('user');
      const { memberIds, reason } = c.req.valid('json');

      const results = { rejected: 0, failed: 0, errors: [] as string[] };
      for (const id of memberIds) {
        try {
          await svc.rejectMember(id, user.organizationId, user.id, reason);
          results.rejected++;
        } catch (e) {
          results.failed++;
          results.errors.push(`${id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
      return c.json(results);
    },
  )

  // POST /members/create — Admin creates a member (auto-approved, no captcha)
  .post(
    '/create',
    jwt(),
    ADMIN_WRITE,
    audit(),
    zValidator('json', updateMemberSchema),
    async (c) => {
      const data = c.req.valid('json');
      const user = getUser(c);
      const services = getServices(c);
      const svc = getMemberService(c);

      // First register as PENDING (reuses existing duplicate-email check + encryption)
      const { AuthService } = await import('../services/auth.service.js');
      const auth = new AuthService(getDb(c), services.encryption, services.email, getEnv(c));
      const registered = await auth.register({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        dob: data.dob || '',
        dlNumber: data.dlNumber || 'pending-verification',
        streetAddress: data.streetAddress || '',
        city: data.city || '',
        state: data.state || '',
        zipCode: data.zipCode || '',
        county: data.county,
        gender: data.gender || '',
        organizationId: user.organizationId,
      });

      // Immediately approve (creates user account, classifies member type, sends approval email)
      const approved = await svc.approveMember(registered.id, user.organizationId, user.id);
      return c.json(approved, 201);
    },
  )

  // POST /members/import — Bulk CSV import (SUPER_ADMIN only)
  .post('/import', jwt(), SUPER_ADMIN, audit(), async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || typeof file === 'string') {
      return c.json({ message: 'CSV file required' }, 400);
    }
    const csvContent = await (file as File).text();
    const user = getUser(c);
    const services = getServices(c);
    const importSvc = new ImportService(getDb(c), services.encryption, user.organizationId);
    const result = await importSvc.importMembers(csvContent);
    return c.json(result);
  })

  // GET /members/export — CSV export with filters (admin)
  .get('/export', jwt(), ADMIN, async (c) => {
    const user = getUser(c);
    const services = getServices(c);
    const importSvc = new ImportService(getDb(c), services.encryption, user.organizationId);
    const status = c.req.query('status');
    const memberType = c.req.query('memberType');
    const csv = await importSvc.exportMembers({ status, memberType });
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="members_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  })

  // GET /members/import/template — Download CSV template
  .get('/import/template', jwt(), SUPER_ADMIN, (_c) => {
    return new Response(ImportService.getCsvTemplate(), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="member_import_template.csv"',
      },
    });
  })

  // POST /members/:id/photo — Upload member photo
  .post('/:id/photo', jwt(), ADMIN_WRITE, async (c) => {
    const body = await c.req.parseBody();
    const file = body['photo'];
    if (!file || typeof file === 'string') return c.json({ message: 'Photo file required' }, 400);

    const f = file as File;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      return c.json({ message: 'Only JPEG, PNG, or WebP photos allowed' }, 400);
    }
    if (f.size > 5 * 1024 * 1024) return c.json({ message: 'Photo must be under 5MB' }, 400);

    const memberId = c.req.param('id');
    const user = getUser(c);
    const db = getDb(c);
    const m = members;

    // Derive extension from validated MIME type — never from the uploader-
    // supplied filename, which could contain path traversal or double extensions.
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const ext = mimeToExt[f.type] ?? 'jpg';
    const filename = `photo-${memberId}.${ext}`;
    const uploadPath = getEnv(c).UPLOAD_PATH || './uploads';

    const { writeFile, mkdir } = await import('node:fs/promises');
    const path = await import('node:path');
    const photoDir = path.join(uploadPath, 'photos');
    await mkdir(photoDir, { recursive: true });
    await writeFile(path.join(photoDir, filename), Buffer.from(await f.arrayBuffer()));

    await db
      .update(m)
      .set({ photoPath: `photos/${filename}`, updatedAt: new Date().toISOString() })
      .where(and(eq(m.id, memberId), eq(m.organizationId, user.organizationId)));

    return c.json({ photoPath: `photos/${filename}` });
  })

  // GET /members/:id/photo — Serve member photo
  .get('/:id/photo', jwt(), async (c) => {
    const memberId = c.req.param('id');
    const user = getUser(c);
    const db = getDb(c);
    const m = members;

    // Scope to the caller's organization — prevents cross-tenant photo access.
    const [member] = await db
      .select({ photoPath: m.photoPath })
      .from(m)
      .where(and(eq(m.id, memberId), eq(m.organizationId, user.organizationId)))
      .limit(1);
    if (!member?.photoPath) return c.json({ message: 'No photo' }, 404);

    const uploadPath = getEnv(c).UPLOAD_PATH || './uploads';
    const path = await import('node:path');
    const { readFile } = await import('node:fs/promises');

    try {
      const data = await readFile(path.join(uploadPath, member.photoPath));
      const ext = member.photoPath.split('.').pop();
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      return new Response(data, {
        headers: {
          'Content-Type': mimeMap[ext || 'jpg'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch {
      return c.json({ message: 'Photo not found' }, 404);
    }
  });
