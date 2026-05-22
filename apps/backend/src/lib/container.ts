import type { Db } from '../db/index.js';
import type { Env } from '../config/env.js';
import { EncryptionService } from './encryption.js';
import { EmailService } from './email.js';
import { NotificationService } from '../services/notification.service.js';

export interface Services {
  encryption: EncryptionService;
  email: EmailService;
  notifications: NotificationService;
}

export function createServices(db: Db, env: Env): Services {
  const encryption = new EncryptionService(env.ENCRYPTION_KEY);
  const email = new EmailService(env.RESEND_API_KEY, env.EMAIL_FROM);
  const notificationsSvc = new NotificationService(db);

  return { encryption, email, notifications: notificationsSvc };
}
