import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { eq, and, sql } from 'drizzle-orm';
import { members } from '../db/schema.js';
import type { Db } from '../db/index.js';
import type { EncryptionService } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';

const MAX_IMPORT_ROWS = 5000;

/** Prevent CSV injection — prepend single quote for formula characters */
function sanitizeCsvCell(value: string): string {
  if (!value) return value;
  if (['=', '+', '-', '@', '\t', '\r'].includes(value[0])) return `'${value}`;
  return value;
}

/** Safe decrypt — returns placeholder on failure instead of throwing */
function safeDecrypt(encryption: EncryptionService, value: string): string {
  try {
    return encryption.decrypt(value);
  } catch {
    return '[ENCRYPTED]';
  }
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

const CSV_COLUMNS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'dob',
  'gender',
  'streetAddress',
  'city',
  'state',
  'zipCode',
  'county',
] as const;

export class ImportService {
  constructor(
    private db: Db,
    private encryption: EncryptionService,
    private organizationId: string,
  ) {}

  async importMembers(csvContent: string): Promise<ImportResult> {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length > MAX_IMPORT_ROWS) {
      return {
        total: records.length,
        imported: 0,
        skipped: records.length,
        errors: [{ row: 0, message: `CSV exceeds maximum of ${MAX_IMPORT_ROWS} rows` }],
      };
    }

    const result: ImportResult = { total: records.length, imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // 1-indexed + header row

      try {
        // Validate required fields
        for (const col of CSV_COLUMNS) {
          if (col === 'county') continue; // optional
          if (!row[col]?.trim()) {
            throw new Error(`Missing required field: ${col}`);
          }
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row.email.trim())) {
          throw new Error(`Invalid email format: ${row.email}`);
        }

        await this.db.insert(members).values({
          organizationId: this.organizationId,
          firstNameEnc: this.encryption.encrypt(row.firstName.trim()),
          lastNameEnc: this.encryption.encrypt(row.lastName.trim()),
          emailEnc: this.encryption.encrypt(row.email.trim().toLowerCase()),
          phoneEnc: this.encryption.encrypt(row.phone.trim()),
          dobEnc: this.encryption.encrypt(row.dob.trim()),
          dlNumberEnc: this.encryption.encrypt('pending-verification'),
          streetAddressEnc: this.encryption.encrypt(row.streetAddress.trim()),
          city: row.city.trim(),
          state: row.state.trim(),
          zipCode: row.zipCode.trim(),
          county: row.county?.trim() || null,
          gender: row.gender.trim(),
          status: 'PENDING',
          memberType: 'GENERAL',
          updatedAt: new Date().toISOString(),
        });

        result.imported++;
      } catch (err) {
        result.errors.push({ row: rowNum, message: (err as Error).message });
        result.skipped++;
      }
    }

    logger.info({ ...result, errors: result.errors.length }, 'CSV import completed');
    return result;
  }

  async exportMembers(filters?: { status?: string; memberType?: string }): Promise<string> {
    const conditions = [eq(members.organizationId, this.organizationId)];

    if (filters?.status) {
      conditions.push(eq(members.status, filters.status as any));
    }
    if (filters?.memberType) {
      conditions.push(eq(members.memberType, filters.memberType as any));
    }

    const rows = await this.db
      .select()
      .from(members)
      .where(and(...conditions));

    const decrypted = rows.map((m) => ({
      memberNumber: m.memberNumber || '',
      firstName: sanitizeCsvCell(safeDecrypt(this.encryption, m.firstNameEnc)),
      lastName: sanitizeCsvCell(safeDecrypt(this.encryption, m.lastNameEnc)),
      email: sanitizeCsvCell(safeDecrypt(this.encryption, m.emailEnc)),
      phone: sanitizeCsvCell(safeDecrypt(this.encryption, m.phoneEnc)),
      dob: safeDecrypt(this.encryption, m.dobEnc),
      gender: m.gender,
      streetAddress: sanitizeCsvCell(safeDecrypt(this.encryption, m.streetAddressEnc)),
      city: sanitizeCsvCell(m.city),
      state: m.state,
      zipCode: m.zipCode,
      county: sanitizeCsvCell(m.county || ''),
      status: m.status,
      memberType: m.memberType,
      applicationDate: m.applicationDate,
      membershipStartDate: m.membershipStartDate || '',
    }));

    return stringify(decrypted, { header: true });
  }

  static getCsvTemplate(): string {
    return stringify(
      [
        {
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phone: '555-123-4567',
          dob: '1990-01-15',
          gender: 'Female',
          streetAddress: '123 Main St',
          city: 'Dallas',
          state: 'TX',
          zipCode: '75001',
          county: 'Dallas',
        },
      ],
      { header: true, columns: CSV_COLUMNS as unknown as string[] },
    );
  }
}
