import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentService } from './document.service.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('aaaa-bbbb-cccc-dddd'),
}));

describe('DocumentService', () => {
  let service: DocumentService;
  let mockDb: any;
  const uploadPath = '/tmp/test-uploads';

  const mockDocument = {
    id: 'doc-1',
    memberId: 'member-1',
    fileName: 'test.pdf',
    mimeType: 'application/pdf',
    filePath: 'member-1-aaaa-bbbb-cccc-dddd.pdf',
    fileSize: 1024,
    uploadedAt: '2025-01-01',
  };

  const mockMember = {
    id: 'member-1',
    organizationId: 'org-1',
    status: 'APPROVED',
  };

  const validFile = {
    originalname: 'test.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('fake pdf content'),
    size: 1024,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new DocumentService(mockDb, uploadPath);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // UPLOAD
  // ============================================================
  describe('upload', () => {
    it('should create file and db record', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      const insertChain: any = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockDocument]),
        }),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const result = await service.upload('member-1', validFile);

      expect(result).toEqual(mockDocument);
      expect(mockDb.insert).toHaveBeenCalled();

      const fs = await import('node:fs/promises');
      expect(fs.mkdir).toHaveBeenCalledWith(uploadPath, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('member-1-aaaa-bbbb-cccc-dddd.pdf'),
        validFile.buffer,
      );
    });

    it('should reject disallowed MIME type', async () => {
      const badFile = { ...validFile, mimetype: 'application/zip' };

      await expect(service.upload('member-1', badFile)).rejects.toThrow(
        'File type application/zip not allowed',
      );
    });

    it('should reject oversized files', async () => {
      const bigFile = { ...validFile, size: 11 * 1024 * 1024 }; // 11 MB

      await expect(service.upload('member-1', bigFile)).rejects.toThrow('File too large');
    });

    it('should throw NotFound for missing member', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.upload('bad-member', validFile)).rejects.toThrow('Member not found');
    });
  });

  // ============================================================
  // GET DOCUMENT
  // ============================================================
  describe('getDocument', () => {
    it('should return document with full path', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDocument]),
          }),
        }),
      });

      const result = await service.getDocument('doc-1');
      expect(result).toEqual(
        expect.objectContaining({
          id: 'doc-1',
          fileName: 'test.pdf',
          fullPath: expect.stringContaining(mockDocument.filePath),
        }),
      );
    });

    it('should throw NotFound when document does not exist', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.getDocument('bad-id')).rejects.toThrow('Document not found');
    });

    it('should throw NotFound when file is missing from disk', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDocument]),
          }),
        }),
      });

      const fs = await import('node:fs/promises');
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));

      await expect(service.getDocument('doc-1')).rejects.toThrow('Document file not found on disk');
    });
  });

  // ============================================================
  // LIST DOCUMENTS
  // ============================================================
  describe('listDocuments', () => {
    it('should return documents for a member', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockDocument]),
        }),
      });

      const result = await service.listDocuments('member-1');
      expect(result).toEqual([mockDocument]);
    });

    it('should return empty array when member has no documents', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.listDocuments('member-1');
      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // DELETE DOCUMENT
  // ============================================================
  describe('deleteDocument', () => {
    it('should delete file and db record', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDocument]),
          }),
        }),
      });
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const result = await service.deleteDocument('doc-1');
      expect(result).toEqual({ message: 'Document deleted successfully' });

      const fs = await import('node:fs/promises');
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining(mockDocument.filePath));
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFound when document does not exist', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.deleteDocument('bad-id')).rejects.toThrow('Document not found');
    });

    it('should succeed even if file is already deleted from disk', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDocument]),
          }),
        }),
      });
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const fs = await import('node:fs/promises');
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('ENOENT'));

      const result = await service.deleteDocument('doc-1');
      expect(result).toEqual({ message: 'Document deleted successfully' });
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
