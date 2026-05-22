import { z } from 'zod';

export const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  sortBy: z.string().default('applicationDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'INACTIVE']).optional(),
  memberType: z.enum(['GENERAL', 'VOTING']).optional(),
});

export const updateMemberSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  middleName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
  dlNumber: z.string().max(20).optional(),
  streetAddress: z.string().min(1).max(500).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(2).max(2).optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'Must be 5-digit or 5+4 zip')
    .optional(),
  county: z.string().max(100).optional(),
  gender: z.string().min(1).max(50).optional(),
  // status and memberType are system-managed — NOT directly editable via update
  // Use approve/reject/classify endpoints instead
});

export const rejectMemberSchema = z.object({
  reason: z.string().min(1),
});

export const changeRequestSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    streetAddress: z.string().min(1).max(500).optional(),
    city: z.string().min(1).max(100).optional(),
    state: z.string().min(2).max(2).optional(),
    zipCode: z
      .string()
      .regex(/^\d{5}(-\d{4})?$/, 'Must be 5-digit or 5+4 zip')
      .optional(),
    county: z.string().max(100).optional(),
    dlNumber: z.string().min(1).max(20).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const updateOwnProfileSchema = z
  .object({
    phone: z.string().min(7).max(20).optional(),
    email: z.string().email().max(255).optional(),
  })
  .refine((data) => data.phone !== undefined || data.email !== undefined, {
    message: 'At least one field (phone or email) must be provided',
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

export const bulkApproveSchema = z.object({
  memberIds: z.array(z.string()).min(1).max(200),
});

export const bulkRejectSchema = z.object({
  memberIds: z.array(z.string()).min(1).max(200),
  reason: z.string().min(1),
});
