import {
  pgTable,
  varchar,
  timestamp,
  text,
  integer,
  index,
  uniqueIndex,
  foreignKey,
  boolean,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Helper for CUID primary keys
const cuid = () =>
  text()
    .primaryKey()
    .$defaultFn(() => createId())
    .notNull();

// Helper for updatedAt columns
const updatedAtCol = (name = 'updated_at') =>
  timestamp(name, { precision: 3, mode: 'string' })
    .$onUpdate(() => new Date().toISOString())
    .notNull();

export const memberStatus = pgEnum('MemberStatus', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'INACTIVE',
]);
export const memberType = pgEnum('MemberType', ['GENERAL', 'VOTING']);
export const userRole = pgEnum('UserRole', [
  'SUPER_ADMIN',
  'MEMBERSHIP_MANAGER',
  'VIEWER',
  'MEMBER',
]);

export const prismaMigrations = pgTable('_prisma_migrations', {
  id: varchar({ length: 36 }).primaryKey().notNull(),
  checksum: varchar({ length: 64 }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  migrationName: varchar('migration_name', { length: 255 }).notNull(),
  logs: text(),
  rolledBackAt: timestamp('rolled_back_at', { withTimezone: true, mode: 'string' }),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  appliedStepsCount: integer('applied_steps_count').default(0).notNull(),
});

export const members = pgTable(
  'members',
  {
    id: cuid(),
    memberNumber: text('member_number'),
    organizationId: text('organization_id').notNull(),
    userId: text('user_id'),
    firstNameEnc: text('first_name_enc').notNull(),
    lastNameEnc: text('last_name_enc').notNull(),
    middleNameEnc: text('middle_name_enc'),
    emailEnc: text('email_enc').notNull(),
    phoneEnc: text('phone_enc').notNull(),
    dobEnc: text('dob_enc').notNull(),
    dlNumberEnc: text('dl_number_enc').notNull(),
    streetAddressEnc: text('street_address_enc').notNull(),
    city: text().notNull(),
    state: text().notNull(),
    zipCode: text('zip_code').notNull(),
    county: text(),
    gender: text().notNull(),
    status: memberStatus().default('PENDING').notNull(),
    memberType: memberType().default('GENERAL').notNull(),
    membershipStartDate: timestamp('membership_start_date', { precision: 3, mode: 'string' }),
    applicationDate: timestamp('application_date', { precision: 3, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    approvedAt: timestamp('approved_at', { precision: 3, mode: 'string' }),
    approvedBy: text('approved_by'),
    rejectedAt: timestamp('rejected_at', { precision: 3, mode: 'string' }),
    rejectedBy: text('rejected_by'),
    rejectionReason: text('rejection_reason'),
    photoPath: text('photo_path'),
    searchIndex: text('search_index'),
    pendingChanges: jsonb('pending_changes'),
    createdAt: timestamp('created_at', { precision: 3, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: updatedAtCol(),
  },
  (table) => [
    index('members_organization_id_memberType_idx').using(
      'btree',
      table.organizationId.asc().nullsLast().op('text_ops'),
      table.memberType.asc().nullsLast().op('enum_ops'),
    ),
    index('members_organization_id_status_idx').using(
      'btree',
      table.organizationId.asc().nullsLast().op('enum_ops'),
      table.status.asc().nullsLast().op('enum_ops'),
    ),
    index('members_organization_id_zip_code_idx').using(
      'btree',
      table.organizationId.asc().nullsLast().op('text_ops'),
      table.zipCode.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('members_user_id_key').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'members_organization_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'members_user_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: cuid(),
    memberId: text('member_id').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size').notNull(),
    uploadedAt: timestamp('uploaded_at', { precision: 3, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [members.id],
      name: 'documents_member_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: cuid(),
    organizationId: text('organization_id'),
    userId: text('user_id'),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    action: text().notNull(),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    ipAddress: text('ip_address'),
    timestamp: timestamp({ precision: 3, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index('audit_logs_organization_id_idx').using(
      'btree',
      table.organizationId.asc().nullsLast().op('text_ops'),
    ),
    index('audit_logs_table_name_record_id_idx').using(
      'btree',
      table.tableName.asc().nullsLast().op('text_ops'),
      table.recordId.asc().nullsLast().op('text_ops'),
    ),
    index('audit_logs_timestamp_idx').using(
      'btree',
      table.timestamp.asc().nullsLast().op('timestamp_ops'),
    ),
    index('audit_logs_user_id_idx').using('btree', table.userId.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'audit_logs_user_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: cuid(),
    userId: text('user_id').notNull(),
    organizationId: text('organization_id').notNull(),
    type: text().notNull(), // 'approval', 'rejection', 'change_request', 'downgrade', 'voting_event'
    title: text().notNull(),
    message: text().notNull(),
    relatedId: text('related_id'), // ID of related entity (member, event, etc.)
    readAt: timestamp('read_at', { precision: 3, mode: 'string' }),
    createdAt: timestamp('created_at', { precision: 3, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index('notifications_user_id_read_at_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('text_ops'),
      table.readAt.asc().nullsLast().op('timestamp_ops'),
    ),
    index('notifications_organization_id_idx').using(
      'btree',
      table.organizationId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'notifications_user_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'notifications_organization_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const organizations = pgTable(
  'organizations',
  {
    id: cuid(),
    name: text().notNull(),
    slug: text().notNull(),
    settings: jsonb().default({}).notNull(),
    createdAt: timestamp('created_at', { precision: 3, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: updatedAtCol(),
  },
  (table) => [
    uniqueIndex('organizations_slug_key').using(
      'btree',
      table.slug.asc().nullsLast().op('text_ops'),
    ),
  ],
);

export const users = pgTable(
  'users',
  {
    id: cuid(),
    organizationId: text('organization_id').notNull(),
    email: text().notNull(),
    role: userRole().default('MEMBER').notNull(),
    passwordHash: text('password_hash'),
    mfaSecret: text('mfa_secret'),
    mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
    refreshToken: text('refresh_token'),
    magicLinkToken: text('magic_link_token'),
    magicLinkExpiry: timestamp('magic_link_expiry', { precision: 3, mode: 'string' }),
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at', { precision: 3, mode: 'string' }),
    createdAt: timestamp('created_at', { precision: 3, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: updatedAtCol(),
  },
  (table) => [
    uniqueIndex('users_email_organization_id_key').using(
      'btree',
      table.email.asc().nullsLast().op('text_ops'),
      table.organizationId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'users_organization_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);
