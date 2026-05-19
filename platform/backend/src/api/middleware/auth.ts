import type { Context, Next } from 'hono';

export interface UserContext {
  role: 'admin' | 'org' | 'user';
  id: string; // admin ID or organization ID
  orgId?: string; // only for org/user role
}

/**
 * Auth middleware - extracts user info from headers
 * Frontend should send X-User-Role and X-User-Id headers
 * 
 * For org/user role, also sends X-User-OrgId header
 */
export async function authMiddleware(c: Context, next: Next) {
  const role = c.req.header('X-User-Role') as 'admin' | 'org' | 'user' | null;
  const userId = c.req.header('X-User-Id');
  const orgId = c.req.header('X-User-OrgId');

  if (!role || !userId) {
    // No auth info - treat as unauthenticated
    // Allow read-only operations to proceed without auth
    c.set('user', null);
    await next();
    return;
  }

  if (role !== 'admin' && role !== 'org' && role !== 'user') {
    c.set('user', null);
    await next();
    return;
  }

  const user: UserContext = {
    role,
    id: userId,
    ...((role === 'org' || role === 'user') && orgId ? { orgId } : {}),
  };

  c.set('user', user);
  await next();
}

/**
 * Get user context from context
 */
export function getUser(c: Context): UserContext | null {
  return c.get('user') as UserContext | null;
}

/**
 * Check if user is admin
 */
export function isAdmin(c: Context): boolean {
  const user = getUser(c);
  return user?.role === 'admin';
}

/**
 * Check if user owns the resource (orgId matches)
 */
export function isOwner(c: Context, resourceOrgId: string | null | undefined): boolean {
  const user = getUser(c);
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.orgId === resourceOrgId;
}
