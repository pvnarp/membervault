import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { notifications } from '../db/schema.js';
import type { Db } from '../db/index.js';

export class NotificationService {
  constructor(private db: Db) {}

  async create(data: {
    userId: string;
    organizationId: string;
    type: string;
    title: string;
    message: string;
    relatedId?: string;
  }) {
    const [notification] = await this.db.insert(notifications).values(data).returning();
    return notification;
  }

  async listForUser(
    userId: string,
    opts?: { unreadOnly?: boolean; limit?: number; offset?: number },
  ) {
    const conditions = [eq(notifications.userId, userId)];
    if (opts?.unreadOnly) {
      conditions.push(isNull(notifications.readAt));
    }

    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);

    return rows;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return result[0]?.count ?? 0;
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async markAllRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }

  // Notify all admins in an organization
  async notifyAdmins(
    db: Db,
    organizationId: string,
    data: { type: string; title: string; message: string; relatedId?: string },
  ) {
    const { users } = await import('../db/schema.js');
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.isActive, true),
          sql`${users.role} IN ('SUPER_ADMIN', 'MEMBERSHIP_MANAGER')`,
        ),
      );

    for (const admin of admins) {
      await this.create({ userId: admin.id, organizationId, ...data });
    }
  }
}
