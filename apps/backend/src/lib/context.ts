import type { Db } from '../db/index.js';
import type { Env } from '../config/env.js';
import type { Services } from './container.js';
import type { AuthUser } from './types.js';
import { Unauthorized } from './errors.js';

// Minimal shape accepted by all helpers — compatible with every Hono context
// regardless of how jwt() or other middleware narrows the intersection type.
type Ctx = { get(key: string): unknown };

/** Typed accessor for the Drizzle DB instance. */
export function getDb(c: Ctx): Db {
  return c.get('db') as Db;
}

/** Typed accessor for validated environment config. */
export function getEnv(c: Ctx): Env {
  return c.get('env') as Env;
}

/** Typed accessor for the services container. */
export function getServices(c: Ctx): Services {
  return c.get('services') as Services;
}

/**
 * Typed accessor for the authenticated user. Throws 401 when called on a
 * route that did not pass through the jwt() middleware.
 */
export function getUser(c: Ctx): AuthUser {
  const user = c.get('user') as AuthUser | undefined;
  if (!user) throw Unauthorized('No authenticated user');
  return user;
}
