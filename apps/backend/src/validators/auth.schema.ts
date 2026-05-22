import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  email: z.string().email().max(255),
  phone: z.string().min(7).max(20),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dlNumber: z.string().min(1).max(20),
  streetAddress: z.string().min(1).max(500),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Must be 5-digit or 5+4 zip'),
  county: z.string().max(100).optional(),
  gender: z.string().min(1).max(50),
  captchaToken: z.string().min(1),
});

export const adminLoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
});

export const magicLinkRequestSchema = z.object({
  email: z.string().email().max(255),
});

export const mfaVerifySchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, 'MFA code must be exactly 6 digits'),
  tempToken: z.string().min(1).max(2000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type MagicLinkRequestInput = z.infer<typeof magicLinkRequestSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
