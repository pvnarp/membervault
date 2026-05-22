import { Hono } from 'hono';
import { jwt } from '../middleware/auth.js';
import { NotificationService } from '../services/notification.service.js';
import type { AppVariables } from '../app.js';
import { getDb, getUser, getServices, getEnv } from '../lib/context.js';

export const notificationRoutes = new Hono<{ Variables: AppVariables }>()
  .use('*', jwt())

  // List notifications for current user
  .get('/', async (c) => {
    const db = c.get('db');
    const user = getUser(c);
    const unreadOnly = c.req.query('unreadOnly') === 'true';
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const svc = new NotificationService(db);
    const items = await svc.listForUser(user.id, { unreadOnly, limit, offset });
    const unreadCount = await svc.getUnreadCount(user.id);

    return c.json({ items, unreadCount });
  })

  // Mark single notification as read
  .patch('/:id/read', async (c) => {
    const db = c.get('db');
    const user = getUser(c);
    const { id } = c.req.param();

    const svc = new NotificationService(db);
    await svc.markAsRead(id, user.id);

    return c.json({ success: true });
  })

  // Mark all notifications as read
  .patch('/read-all', async (c) => {
    const db = c.get('db');
    const user = getUser(c);

    const svc = new NotificationService(db);
    await svc.markAllRead(user.id);

    return c.json({ success: true });
  });
