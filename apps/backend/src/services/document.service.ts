import { eq } from 'drizzle-orm';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { members, documents } from '../db/schema.js';
import { NotFound, BadRequest } from '../lib/errors.js';
import type { Db } from '../db/index.js';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export class DocumentService {
  constructor(
    private db: Db,
    private uploadPath: string,
  ) {}

  async upload(
    memberId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  ) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw BadRequest(
        `File type ${file.mimetype} not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
    if (file.size > MAX_FILE_SIZE) throw BadRequest('File too large. Max size: 10 MB');

    const [member] = await this.db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (!member) throw NotFound('Member not found');

    const ext = path.extname(file.originalname);
    const secureFilename = `${memberId}-${crypto.randomUUID()}${ext}`;
    const filePath = path.join(this.uploadPath, secureFilename);

    await fs.mkdir(this.uploadPath, { recursive: true });
    await fs.writeFile(filePath, file.buffer);

    const [doc] = await this.db
      .insert(documents)
      .values({
        memberId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        filePath: secureFilename,
        fileSize: file.size,
      })
      .returning();
    return doc;
  }

  async getDocument(documentId: string) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (!doc) throw NotFound('Document not found');

    const fullPath = path.join(this.uploadPath, doc.filePath);
    try {
      await fs.access(fullPath);
    } catch {
      throw NotFound('Document file not found on disk');
    }

    return { ...doc, fullPath };
  }

  async listDocuments(memberId: string) {
    return this.db.select().from(documents).where(eq(documents.memberId, memberId));
  }

  async deleteDocument(documentId: string) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (!doc) throw NotFound('Document not found');

    const fullPath = path.join(this.uploadPath, doc.filePath);
    try {
      await fs.unlink(fullPath);
    } catch {
      /* file may be gone */
    }

    await this.db.delete(documents).where(eq(documents.id, documentId));
    return { message: 'Document deleted successfully' };
  }
}
