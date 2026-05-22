import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { auditLogs } from '../db/schema.js';
import type { AuthUser } from '../lib/types.js';
import type { Db } from '../db/index.js';
import { logger } from '../lib/logger.js';

type AuditCtx = Context<{ Variables: { user?: AuthUser; db: Db } }>;

// Keys whose values must never be persisted to the audit log, either because
// they are credentials or because they decrypt to PII that already lives
// encrypted in the primary tables. The key name is still recorded so that
// reviewers can see *which* fields were touched, just not their values.
const SENSITIVE_KEYS = new Set([
  // Credentials & tokens
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'magicLinkToken',
  'mfaToken',
  'mfaSecret',
  'mfaCode',
  'otp',
  'totp',
  'secret',
  'apiKey',
  'captchaToken',
  // PII fields that are encrypted at rest — do not duplicate in plaintext
  'firstName',
  'lastName',
  'email',
  'phone',
  'dateOfBirth',
  'dob',
  'streetAddress',
  'address',
  'driverLicenseNumber',
  'dlNumber',
  'ssn',
  'ssnLast4',
  'photoPath',
]);

const MAX_BODY_BYTES = 4096;

function redact(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(redact);
  if (typeof input !== 'object') return input;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      out[key] = redact(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function clientIp(c: AuditCtx): string {
  // Trust the last hop of X-Forwarded-For (set by the reverse proxy) rather
  // than the first, which is whatever the client claimed to be.
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp;
  // Node adapter exposes the underlying socket via env.incoming
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } })?.incoming;
  return incoming?.socket?.remoteAddress ?? 'unknown';
}

function extractTableName(path: string): string {
  // /api/v1/members/... → members; /api/v1/admin/users/... → users
  const parts = path.split('/').filter(Boolean);
  const apiIndex = parts.indexOf('v1');
  if (apiIndex < 0) return 'unknown';
  // Skip 'admin' namespace prefix to get the resource name
  let cursor = apiIndex + 1;
  if (parts[cursor] === 'admin' && parts[cursor + 1]) cursor += 1;
  return parts[cursor] || 'unknown';
}

async function extractRecordId(c: AuditCtx): Promise<string> {
  // Prefer the route param :id when present.
  const idParam = c.req.param('id');
  if (idParam) return idParam;

  // For create endpoints (POST without :id), peek at the response body to
  // recover the new id. Cloning the response avoids consuming the original.
  if (c.req.method === 'POST' && c.res.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = (await c.res.clone().json()) as { id?: string; data?: { id?: string } };
      if (body?.id) return body.id;
      if (body?.data?.id) return body.data.id;
    } catch {
      // Non-JSON or unreadable body — fall through
    }
  }

  // Last resort: the request path itself, so the row is at least diagnosable.
  return c.req.path;
}

async function extractNewValues(c: AuditCtx): Promise<unknown> {
  if (c.req.method === 'DELETE') return null;
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;

  try {
    // Hono caches the parsed body internally, so re-reading after the handler
    // has already consumed the stream returns the same object.
    const body = await c.req.json();
    const redacted = redact(body);
    const serialised = JSON.stringify(redacted);
    if (serialised.length > MAX_BODY_BYTES) return { _truncated: true };
    return redacted;
  } catch {
    return null;
  }
}

/**
 * Audit logging middleware. Logs successful mutating operations only.
 *
 * What gets captured:
 *  - userId        (from JWT context)
 *  - tableName     (parsed from URL)
 *  - recordId      (URL :id param, or response body id, or path fallback)
 *  - action        ('METHOD:STATUS', e.g. 'PATCH:200')
 *  - newValues     (request body with credentials & encrypted PII redacted)
 *  - ipAddress     (last hop of XFF, or X-Real-IP, or socket address)
 *
 * Notes:
 *  - Requests that resulted in a 4xx/5xx are skipped — they did not mutate.
 *  - oldValues is left null. Capturing before-state requires service-layer
 *    instrumentation, which is tracked separately.
 */
export const audit = () =>
  createMiddleware<{ Variables: { user?: AuthUser; db: Db } }>(async (c, next) => {
    await next();

    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method)) return;
    if (c.res.status >= 400) return;

    try {
      const user = c.get('user');
      const db = c.get('db');
      const tableName = extractTableName(c.req.path);
      const [recordId, newValues] = await Promise.all([extractRecordId(c), extractNewValues(c)]);

      await db.insert(auditLogs).values({
        organizationId: user?.organizationId ?? null,
        userId: user?.id ?? null,
        tableName,
        recordId,
        action: `${c.req.method}:${c.res.status}`,
        oldValues: null,
        newValues: newValues as never,
        ipAddress: clientIp(c),
      });
    } catch (error) {
      // Audit failures must never break the request itself.
      logger.error({ err: error, path: c.req.path }, 'Audit log insert failed');
    }
  });
