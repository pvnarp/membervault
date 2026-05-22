import { createMiddleware } from 'hono/factory';
import { BadRequest } from '../lib/errors.js';
import type { Env } from '../config/env.js';

/** Altcha proof-of-work verification middleware. Skips if ALTCHA_HMAC_KEY is not configured. */
export const captcha = () =>
  createMiddleware<{ Variables: { env: Env } }>(async (c, next) => {
    const env = c.get('env');
    const hmacKey = (env as any).ALTCHA_HMAC_KEY;

    // Skip validation when no key is configured (dev mode)
    if (!hmacKey) {
      await next();
      return;
    }

    const body = await c.req.json().catch(() => ({}));
    const altchaPayload = body?.captchaToken;

    if (!altchaPayload) {
      throw BadRequest('Captcha token is required');
    }

    const { verifySolution } = await import('altcha-lib');
    const ok = await verifySolution(altchaPayload, hmacKey);

    if (!ok) {
      throw BadRequest('Captcha verification failed');
    }

    await next();
  });
