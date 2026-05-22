import { createMiddleware } from 'hono/factory';
import { Forbidden } from '../lib/errors.js';
import type { AuthUser, UserRole } from '../lib/types.js';

/** RBAC middleware factory. Checks if the authenticated user has one of the required roles. */
export const requireRoles = (...roles: UserRole[]) =>
  createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
    const user = c.get('user');
    if (!user) {
      throw Forbidden('No user context found');
    }
    if (!roles.includes(user.role)) {
      throw Forbidden(`Insufficient permissions. Required roles: ${roles.join(', ')}`);
    }
    await next();
  });
