import { relations } from 'drizzle-orm/relations';
import { organizations, members, users, documents, auditLogs } from './schema';

export const membersRelations = relations(members, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(members),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  members: many(members),
  auditLogs: many(auditLogs),
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  member: one(members, {
    fields: [documents.memberId],
    references: [members.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
