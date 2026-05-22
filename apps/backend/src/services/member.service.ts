import { eq, and, or, desc, asc, sql, isNotNull } from 'drizzle-orm';
import { members, users } from '../db/schema.js';
import { EncryptionService } from '../lib/encryption.js';
import { EmailService } from '../lib/email.js';
import { NotFound, BadRequest } from '../lib/errors.js';
import type { Db } from '../db/index.js';

const CRITICAL_FIELDS = [
  'firstName',
  'lastName',
  'streetAddress',
  'city',
  'state',
  'zipCode',
  'county',
  'dlNumber',
];

export class MemberService {
  constructor(
    private db: Db,
    private encryption: EncryptionService,
    private email?: EmailService,
  ) {}

  /** Build blind search index from member fields. Call after any PII change. */
  buildSearchIndex(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    city?: string;
    zipCode?: string;
    memberNumber?: string;
  }): string {
    const parts = [
      data.firstName,
      data.lastName,
      data.email,
      data.city,
      data.zipCode,
      data.memberNumber,
    ].filter(Boolean);
    return parts.map((p) => this.encryption.blindIndex(p!)).join(' ');
  }

  /** Update the searchIndex column for a member by decrypting and re-indexing. */
  async refreshSearchIndex(memberId: string): Promise<void> {
    const [m] = await this.db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (!m) return;
    try {
      const idx = this.buildSearchIndex({
        firstName: this.encryption.decrypt(m.firstNameEnc),
        lastName: this.encryption.decrypt(m.lastNameEnc),
        email: this.encryption.decrypt(m.emailEnc),
        city: m.city,
        zipCode: m.zipCode,
        memberNumber: m.memberNumber || undefined,
      });
      await this.db.update(members).set({ searchIndex: idx }).where(eq(members.id, memberId));
    } catch {
      /* skip corrupt records */
    }
  }

  /** Rebuild search indexes for ALL members (call after encryption/index algorithm changes). */
  async rebuildAllSearchIndexes(organizationId: string): Promise<number> {
    const allMembers = await this.db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.organizationId, organizationId));
    let count = 0;
    for (const m of allMembers) {
      await this.refreshSearchIndex(m.id);
      count++;
    }
    return count;
  }

  // ============================================================
  // LIST MEMBERS (Admin)
  // ============================================================

  async listMembers(
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      search?: string;
      status?: string;
      memberType?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(members.organizationId, organizationId)];
    if (query.status) conditions.push(eq(members.status, query.status as any));
    if (query.memberType) conditions.push(eq(members.memberType, query.memberType as any));

    const where = and(...conditions);
    const orderCol = query.sortBy === 'createdAt' ? members.createdAt : members.applicationDate;
    const orderFn = query.sortOrder === 'asc' ? asc : desc;

    if (query.search) {
      const s = query.search.toLowerCase().trim();

      // For plain-text fields (city, county, zip, memberNumber), use direct SQL
      // For encrypted fields (name, email), use blind index HMAC tokens
      const searchToken = this.encryption.blindIndex(s).split(' ')[0]; // Primary HMAC token
      const blindCondition = sql`${members.searchIndex} LIKE ${'%' + searchToken + '%'}`;
      const plainCondition = or(
        sql`LOWER(${members.city}) LIKE ${'%' + s + '%'}`,
        sql`LOWER(${members.county}) LIKE ${'%' + s + '%'}`,
        sql`${members.zipCode} LIKE ${'%' + s + '%'}`,
        sql`LOWER(${members.memberNumber}) LIKE ${'%' + s + '%'}`,
      );

      const searchWhere = and(where!, or(blindCondition, plainCondition));

      const [searchRows, searchCount] = await Promise.all([
        this.db
          .select()
          .from(members)
          .where(searchWhere)
          .orderBy(orderFn(orderCol))
          .limit(limit)
          .offset(offset),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(members)
          .where(searchWhere),
      ]);

      const searchTotal = searchCount[0]?.count ?? 0;
      return {
        data: searchRows.map((m) => this.decryptMember(m)),
        meta: { page, limit, total: searchTotal, totalPages: Math.ceil(searchTotal / limit) },
      };
    }

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(members)
        .where(where)
        .orderBy(orderFn(orderCol))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(members)
        .where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    const decrypted = rows.map((m) => this.decryptMember(m));

    return {
      data: decrypted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================
  // GET MEMBER
  // ============================================================

  async getMember(memberId: string, organizationId: string) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
      .limit(1);

    if (!member) throw NotFound('Member not found');
    return this.decryptMember(member);
  }

  // ============================================================
  // GET OWN PROFILE
  // ============================================================

  async getOwnProfile(userId: string) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1);
    if (!member) throw NotFound('Member profile not found');
    return this.decryptMember(member);
  }

  // ============================================================
  // UPDATE MEMBER (Admin)
  // ============================================================

  async updateMember(memberId: string, organizationId: string, data: Record<string, unknown>) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
      .limit(1);
    if (!member) throw NotFound('Member not found');

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    const encMap: Record<string, string> = {
      firstName: 'firstNameEnc',
      lastName: 'lastNameEnc',
      middleName: 'middleNameEnc',
      email: 'emailEnc',
      phone: 'phoneEnc',
      dob: 'dobEnc',
      dlNumber: 'dlNumberEnc',
      streetAddress: 'streetAddressEnc',
    };

    for (const [plain, enc] of Object.entries(encMap)) {
      if (data[plain] !== undefined)
        updateData[enc] = this.encryption.encrypt(data[plain] as string);
    }

    // Only allow non-sensitive fields — status/memberType are managed by approve/reject/classify
    for (const field of ['city', 'state', 'zipCode', 'county', 'gender']) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    const [updated] = await this.db
      .update(members)
      .set(updateData as any)
      .where(eq(members.id, memberId))
      .returning();

    // Refresh search index if any searchable field changed
    if (data.firstName || data.lastName || data.email || data.city || data.zipCode) {
      await this.refreshSearchIndex(memberId);
    }

    return this.decryptMember(updated);
  }

  // ============================================================
  // APPROVE MEMBER
  // ============================================================

  async approveMember(memberId: string, organizationId: string, approvedById: string) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(
        and(
          eq(members.id, memberId),
          eq(members.organizationId, organizationId),
          eq(members.status, 'PENDING'),
        ),
      )
      .limit(1);
    if (!member) throw NotFound('Pending member not found');

    const email = this.encryption.decrypt(member.emailEnc);
    const now = new Date().toISOString();

    await this.db.transaction(async (tx) => {
      await tx
        .update(members)
        .set({
          status: 'APPROVED',
          approvedAt: now,
          approvedBy: approvedById,
          membershipStartDate: now,
          updatedAt: now,
        })
        .where(eq(members.id, memberId));

      await tx.insert(users).values({
        organizationId,
        email: email.toLowerCase(),
        role: 'MEMBER',
        updatedAt: now,
      });
    });

    // Link user to member
    const [newUser] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), eq(users.organizationId, organizationId)))
      .limit(1);

    if (newUser) {
      await this.db
        .update(members)
        .set({ userId: newUser.id, updatedAt: now })
        .where(eq(members.id, memberId));
    }

    // Send approval email
    if (this.email) {
      const finalMember = await this.getMember(memberId, organizationId);
      const [admin] = await this.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, approvedById))
        .limit(1);
      this.email
        .sendApplicationApproved(
          email,
          `${(finalMember as any).firstName} ${(finalMember as any).lastName}`,
          member.memberNumber || memberId,
          (finalMember as any).memberType || 'GENERAL',
          admin?.email || 'Admin',
          now,
        )
        .catch(console.error);
    }

    return this.getMember(memberId, organizationId);
  }

  // ============================================================
  // REJECT MEMBER
  // ============================================================

  async rejectMember(
    memberId: string,
    organizationId: string,
    rejectedById: string,
    reason: string,
  ) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(
        and(
          eq(members.id, memberId),
          eq(members.organizationId, organizationId),
          eq(members.status, 'PENDING'),
        ),
      )
      .limit(1);
    if (!member) throw NotFound('Pending member not found');

    const memberEmail = this.encryption.decrypt(member.emailEnc);
    const memberName = `${this.encryption.decrypt(member.firstNameEnc)} ${this.encryption.decrypt(member.lastNameEnc)}`;
    const now = new Date().toISOString();
    const [updated] = await this.db
      .update(members)
      .set({
        status: 'REJECTED',
        rejectedAt: now,
        rejectedBy: rejectedById,
        rejectionReason: reason,
        updatedAt: now,
      })
      .where(eq(members.id, memberId))
      .returning();

    // Send rejection email
    if (this.email) {
      const [admin] = await this.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, rejectedById))
        .limit(1);
      this.email
        .sendApplicationRejected(
          memberEmail,
          memberName,
          member.memberNumber || memberId,
          reason,
          admin?.email || 'Admin',
          now,
        )
        .catch(console.error);
    }

    return this.decryptMember(updated);
  }

  // ============================================================
  // DELETE MEMBER
  // ============================================================

  async deleteMember(memberId: string, organizationId: string) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
      .limit(1);
    if (!member) throw NotFound('Member not found');

    if (member.userId) {
      await this.db.delete(users).where(eq(users.id, member.userId));
    }
    await this.db.delete(members).where(eq(members.id, memberId));
    return { message: 'Member deleted successfully' };
  }

  // ============================================================
  // MEMBER SELF-SERVICE
  // ============================================================

  async updateOwnProfile(userId: string, data: { phone?: string; email?: string }) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1);
    if (!member) throw NotFound('Member profile not found');

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (data.phone) updateData.phoneEnc = this.encryption.encrypt(data.phone);
    if (data.email) {
      updateData.emailEnc = this.encryption.encrypt(data.email);
      await this.db
        .update(users)
        .set({ email: data.email.toLowerCase(), updatedAt: new Date().toISOString() })
        .where(eq(users.id, userId));
    }

    if (Object.keys(updateData).length <= 1) throw BadRequest('No fields to update');

    const [updated] = await this.db
      .update(members)
      .set(updateData as any)
      .where(eq(members.id, member.id))
      .returning();
    return this.decryptMember(updated);
  }

  async requestProfileChange(userId: string, changes: Record<string, string>) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1);
    if (!member) throw NotFound('Member profile not found');

    const invalidFields = Object.keys(changes).filter((f) => !CRITICAL_FIELDS.includes(f));
    if (invalidFields.length > 0)
      throw BadRequest(
        `Non-critical fields should be updated directly: ${invalidFields.join(', ')}`,
      );

    const decrypted = this.decryptMember(member);
    const changeRequest: Record<string, { from: string; to: string }> = {};
    for (const [field, newValue] of Object.entries(changes)) {
      changeRequest[field] = { from: ((decrypted as any)[field] as string) || '', to: newValue };
    }

    await this.db
      .update(members)
      .set({ pendingChanges: changeRequest, updatedAt: new Date().toISOString() })
      .where(eq(members.id, member.id));
    return { message: 'Change request submitted for admin review', changes: changeRequest };
  }

  async listChangeRequests(organizationId: string) {
    const rows = await this.db
      .select()
      .from(members)
      .where(and(eq(members.organizationId, organizationId), isNotNull(members.pendingChanges)));

    return rows.map((m) => ({
      memberId: m.id,
      member: this.decryptMember(m),
      changes: m.pendingChanges,
    }));
  }

  async approveChangeRequest(memberId: string, organizationId: string) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
      .limit(1);
    if (!member || !member.pendingChanges) throw NotFound('No pending change request found');

    const changes = member.pendingChanges as Record<string, { from: string; to: string }>;
    const updateData: Record<string, unknown> = {
      pendingChanges: null,
      updatedAt: new Date().toISOString(),
    };

    const encMap: Record<string, string> = {
      firstName: 'firstNameEnc',
      lastName: 'lastNameEnc',
      streetAddress: 'streetAddressEnc',
      dlNumber: 'dlNumberEnc',
    };

    for (const [field, { to }] of Object.entries(changes)) {
      if (encMap[field]) updateData[encMap[field]] = this.encryption.encrypt(to);
      else updateData[field] = to;
    }

    await this.db
      .update(members)
      .set(updateData as any)
      .where(eq(members.id, memberId));

    return this.getMember(memberId, organizationId);
  }

  async denyChangeRequest(memberId: string, organizationId: string) {
    const [member] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
      .limit(1);
    if (!member || !member.pendingChanges) throw NotFound('No pending change request found');

    await this.db
      .update(members)
      .set({ pendingChanges: null, updatedAt: new Date().toISOString() })
      .where(eq(members.id, memberId));
    return { message: 'Change request denied' };
  }

  // ============================================================
  // DECRYPT HELPER
  // ============================================================

  decryptMember(member: any) {
    try {
      return {
        ...member,
        firstName: member.firstNameEnc ? this.encryption.decrypt(member.firstNameEnc) : null,
        lastName: member.lastNameEnc ? this.encryption.decrypt(member.lastNameEnc) : null,
        middleName: member.middleNameEnc ? this.encryption.decrypt(member.middleNameEnc) : null,
        email: member.emailEnc ? this.encryption.decrypt(member.emailEnc) : null,
        phone: member.phoneEnc ? this.encryption.decrypt(member.phoneEnc) : null,
        dob: member.dobEnc ? this.encryption.decrypt(member.dobEnc) : null,
        dlNumber: member.dlNumberEnc ? this.encryption.decrypt(member.dlNumberEnc) : null,
        streetAddress: member.streetAddressEnc
          ? this.encryption.decrypt(member.streetAddressEnc)
          : null,
        firstNameEnc: undefined,
        lastNameEnc: undefined,
        middleNameEnc: undefined,
        emailEnc: undefined,
        phoneEnc: undefined,
        dobEnc: undefined,
        dlNumberEnc: undefined,
        streetAddressEnc: undefined,
      };
    } catch {
      return member;
    }
  }
}
