import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  registerSchema,
  adminLoginSchema,
  magicLinkRequestSchema,
  mfaVerifySchema,
} from '../validators/auth.schema.js';
import { jwt } from '../middleware/auth.js';
import { captcha } from '../middleware/captcha.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { AuthService } from '../services/auth.service.js';
import type { AppVariables } from '../app.js';
import { getEnv } from '../lib/context.js';

const authRateLimit = rateLimit({ windowMs: 60_000, limit: 5 });

const cookieOpts = (env: string) => ({
  httpOnly: true,
  secure: env === 'production',
  sameSite: 'Strict' as const,
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  path: '/api/v1/auth',
});

function getAuthService(c: { get: (k: string) => unknown }): AuthService {
  const services = c.get('services') as { encryption: unknown; email: unknown };
  const db = c.get('db') as import('../db/index.js').Db;
  const env = c.get('env') as import('../config/env.js').Env;
  return new AuthService(db, services.encryption as any, services.email as any, env);
}

export const authRoutes = new Hono<{ Variables: AppVariables }>()

  // GET /auth/captcha/challenge (public — generate proof-of-work challenge)
  .get('/captcha/challenge', async (c) => {
    const { createChallenge } = await import('altcha-lib');
    const env = getEnv(c);
    const hmacKey = env.ALTCHA_HMAC_KEY || 'dev-altcha-key-not-for-production';
    const challenge = await createChallenge({ hmacKey, maxNumber: 50000 });
    return c.json(challenge);
  })

  // POST /auth/register (public, captcha, rate limited)
  .post('/register', authRateLimit, captcha(), zValidator('json', registerSchema), async (c) => {
    const auth = getAuthService(c);
    const org = await auth.getDefaultOrganization();
    const data = c.req.valid('json');
    const result = await auth.register({ ...data, organizationId: org.id });
    return c.json(result, 201);
  })

  // POST /auth/magic-link/request (public, rate limited)
  .post(
    '/magic-link/request',
    authRateLimit,
    zValidator('json', magicLinkRequestSchema),
    async (c) => {
      const auth = getAuthService(c);
      const org = await auth.getDefaultOrganization();
      const { email } = c.req.valid('json');
      const result = await auth.requestMagicLink(email, org.id);
      return c.json(result);
    },
  )

  // POST /auth/magic-link/verify (public, rate limited)
  .post('/magic-link/verify', authRateLimit, async (c) => {
    const auth = getAuthService(c);
    const body = await c.req.json();
    const result = await auth.verifyMagicLink(body.token);
    const env = c.get('env');
    setCookie(c, 'refreshToken', result.refreshToken, cookieOpts(env.NODE_ENV));
    return c.json({ accessToken: result.accessToken, user: result.user });
  })

  // POST /auth/demo-login (public, rate limited — direct auth for demo member)
  .post('/demo-login', authRateLimit, async (c) => {
    const auth = getAuthService(c);
    const org = await auth.getDefaultOrganization();
    const result = await auth.demoLogin(org.id);
    const env = c.get('env');
    setCookie(c, 'refreshToken', result.refreshToken, cookieOpts(env.NODE_ENV));
    return c.json({ accessToken: result.accessToken, user: result.user });
  })

  // POST /auth/forgot-password (public, rate limited)
  .post(
    '/forgot-password',
    authRateLimit,
    zValidator('json', magicLinkRequestSchema),
    async (c) => {
      const auth = getAuthService(c);
      const org = await auth.getDefaultOrganization();
      const { email } = c.req.valid('json');
      return c.json(await auth.requestPasswordReset(email, org.id));
    },
  )

  // POST /auth/reset-password (public, rate limited)
  .post('/reset-password', authRateLimit, async (c) => {
    const { token, password } = await c.req.json();
    if (!token || !password || password.length < 12) {
      return c.json({ message: 'Token and password (min 12 chars) required' }, 400);
    }
    const auth = getAuthService(c);
    return c.json(await auth.resetPassword(token, password));
  })

  // POST /auth/login (public, rate limited)
  .post('/login', authRateLimit, zValidator('json', adminLoginSchema), async (c) => {
    const auth = getAuthService(c);
    const org = await auth.getDefaultOrganization();
    const { email, password } = c.req.valid('json');
    const result = await auth.loginAdmin(email, password, org.id);

    if ('mfaRequired' in result) {
      return c.json(result);
    }

    const env = c.get('env');
    setCookie(c, 'refreshToken', result.refreshToken, cookieOpts(env.NODE_ENV));
    return c.json({ accessToken: result.accessToken, user: result.user });
  })

  // POST /auth/mfa/verify (public, rate limited)
  .post('/mfa/verify', authRateLimit, zValidator('json', mfaVerifySchema), async (c) => {
    const auth = getAuthService(c);
    const { tempToken, code } = c.req.valid('json');
    const result = await auth.verifyMfa(tempToken, code);

    const env = c.get('env');
    setCookie(c, 'refreshToken', result.refreshToken, cookieOpts(env.NODE_ENV));
    return c.json({ accessToken: result.accessToken, user: result.user });
  })

  // POST /auth/mfa/setup (JWT required)
  .post('/mfa/setup', jwt(), async (c) => {
    const auth = getAuthService(c);
    const user = c.get('user');
    return c.json(await auth.setupMfa(user.id));
  })

  // POST /auth/refresh (public, uses cookie)
  .post('/refresh', async (c) => {
    const refreshToken = getCookie(c, 'refreshToken');
    if (!refreshToken) {
      return c.json({ statusCode: 401, message: 'No refresh token provided' }, 401);
    }

    const auth = getAuthService(c);
    const result = await auth.refreshTokens(refreshToken);

    const env = c.get('env');
    setCookie(c, 'refreshToken', result.refreshToken, cookieOpts(env.NODE_ENV));
    return c.json({ accessToken: result.accessToken, user: result.user });
  })

  // POST /auth/logout (JWT required)
  .post('/logout', jwt(), async (c) => {
    const auth = getAuthService(c);
    const user = c.get('user');
    await auth.logout(user.id);

    // Blacklist access token in Redis (4h TTL matching token expiry)
    const token = c.req.header('Authorization')!.slice(7);
    const redis = c.get('redis' as any) as import('ioredis').default | null;
    if (redis) {
      try {
        await redis.set(`bl:${token.slice(-32)}`, '1', 'EX', 4 * 60 * 60);
      } catch {
        // Redis unavailable — token still invalidated via refresh token removal
      }
    }

    deleteCookie(c, 'refreshToken', { path: '/api/v1/auth' });
    return c.json({ message: 'Logged out successfully' });
  });
