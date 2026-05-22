import { z } from 'zod';

export const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  role: z.enum(['SUPER_ADMIN', 'MEMBERSHIP_MANAGER', 'VIEWER', 'MEMBER']),
});

export const updateAdminSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'MEMBERSHIP_MANAGER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
});
