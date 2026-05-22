import { config } from 'dotenv';
import { z } from 'zod';

// Load .env from monorepo root and local
config({ path: '../../.env' });
config({ path: '.env' });

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Encryption
  ENCRYPTION_KEY: z.string().length(64),

  // Email
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@example.org'),

  // Captcha (Altcha proof-of-work)
  ALTCHA_HMAC_KEY: z.string().default(''),

  // Cron secret — required to call /cron/* endpoints from scheduled jobs.
  // Must be at least 32 chars when set. Production startup fails if empty
  // (enforced separately in loadEnv()).
  CRON_SECRET: z
    .string()
    .default('')
    .refine(
      (s) => s === '' || s.length >= 32,
      'CRON_SECRET must be at least 32 characters when set',
    ),

  // Redis (optional — falls back to in-memory rate limiting)
  REDIS_URL: z.string().optional(),

  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_PATH: z.string().default('./uploads'),
  LOG_LEVEL: z.string().default('info'),

  // Production domain (used by Caddy for TLS)
  DOMAIN: z.string().default('localhost'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  const env = result.data;

  // Production-only hard requirements. The schema allows empty strings so that
  // dev/test environments can start without real keys. In production a missing
  // or placeholder value would silently disable security features, so we reject
  // startup immediately.
  if (env.NODE_ENV === 'production') {
    const missing: string[] = [];

    if (!env.ALTCHA_HMAC_KEY) missing.push('ALTCHA_HMAC_KEY');
    if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 're_your_resend_api_key')
      missing.push('RESEND_API_KEY');
    if (!env.CRON_SECRET) missing.push('CRON_SECRET');

    if (missing.length > 0) {
      console.error(
        `[FATAL] Production startup blocked — required env vars are missing or set to placeholder values: ${missing.join(', ')}`,
      );
      process.exit(1);
    }
  }

  _env = env;
  return _env;
}
