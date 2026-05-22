import { Hono } from 'hono';
import * as fs from 'node:fs/promises';
import { jwt } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { DocumentService } from '../services/document.service.js';
import { Forbidden } from '../lib/errors.js';
import { members } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { AppVariables } from '../app.js';
import { getDb, getUser, getServices, getEnv } from '../lib/context.js';

const ADMIN = requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER', 'VIEWER');
const ADMIN_WRITE = requireRoles('SUPER_ADMIN', 'MEMBERSHIP_MANAGER');
const SUPER_ADMIN = requireRoles('SUPER_ADMIN');

function getDocService(c: { get: (k: string) => unknown }): DocumentService {
  const env = getEnv(c);
  return new DocumentService(getDb(c), env.UPLOAD_PATH);
}

async function verifyMemberOrg(c: any, memberId: string) {
  const db = c.get('db');
  const user = c.get('user');
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.organizationId, user.organizationId)))
    .limit(1);
  if (!member) throw Forbidden('Member not found in your organization');
}

export const documentRoutes = new Hono<{ Variables: AppVariables }>()

  // POST /documents/:memberId/upload
  .post('/:memberId/upload', jwt(), ADMIN_WRITE, async (c) => {
    await verifyMemberOrg(c, c.req.param('memberId'));
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || typeof file === 'string') throw Forbidden('No file uploaded');

    const buffer = Buffer.from(await (file as File).arrayBuffer());
    const svc = getDocService(c);
    return c.json(
      await svc.upload(c.req.param('memberId'), {
        originalname: (file as File).name,
        mimetype: (file as File).type,
        buffer,
        size: buffer.length,
      }),
      201,
    );
  })

  // GET /documents/member/:memberId
  .get('/member/:memberId', jwt(), ADMIN, async (c) => {
    await verifyMemberOrg(c, c.req.param('memberId'));
    const svc = getDocService(c);
    return c.json(await svc.listDocuments(c.req.param('memberId')));
  })

  // GET /documents/:id/download
  .get('/:id/download', jwt(), ADMIN, async (c) => {
    const svc = getDocService(c);
    const doc = await svc.getDocument(c.req.param('id'));
    // Verify document's member belongs to user's organization
    await verifyMemberOrg(c, doc.memberId);
    const buffer = await fs.readFile(doc.fullPath);
    return new Response(buffer, {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `attachment; filename="${doc.fileName}"`,
      },
    });
  })

  // DELETE /documents/:id
  .delete('/:id', jwt(), SUPER_ADMIN, async (c) => {
    const svc = getDocService(c);
    const doc = await svc.getDocument(c.req.param('id'));
    // Verify document's member belongs to user's organization
    await verifyMemberOrg(c, doc.memberId);
    return c.json(await svc.deleteDocument(c.req.param('id')));
  });
