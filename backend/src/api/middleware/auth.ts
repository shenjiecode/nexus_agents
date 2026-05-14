import { Context, Next } from 'hono';
import { verifyApiKey } from '../../services/org-service.js';

/**
 * Auth middleware for organization-level API key authentication
 * 
 * Supports two header formats:
 * - X-Api-Key: nexus_live_xxx
 * - Authorization: Bearer nexus_live_xxx
 * 
 * Attaches org context to request: c.set('org', { id, name, slug })
 */
export async function authMiddleware(c: Context, next: Next) {
  // Get API key from headers
  const apiKeyFromHeader = c.req.header('X-Api-Key');
  const authHeader = c.req.header('Authorization');
  
  let apiKey: string | undefined;
  
  if (apiKeyFromHeader) {
    apiKey = apiKeyFromHeader;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7);
  }
  
  if (!apiKey) {
    return c.json({
      success: false,
      error: 'Missing API key. Provide X-Api-Key header or Authorization: Bearer <key>',
    }, 401);
  }
  
  // Verify API key
  const org = await verifyApiKey(apiKey);
  
  if (!org) {
    return c.json({
      success: false,
      error: 'Invalid or revoked API key',
    }, 401);
  }
  
  // Verify URL slug matches API key's organization
  const urlSlug = c.req.param('slug') || c.req.param('orgSlug');
  if (urlSlug && org.slug !== urlSlug) {
    return c.json({
      success: false,
      error: 'API key does not match organization in URL',
    }, 403);
  }
  
  // Attach org context to request
  c.set('org', org);
  
  await next();
}

/**
 * Get organization context from request (after auth middleware)
 */
export function getOrgContext(c: Context): { id: string; name: string; slug: string } {
  const org = c.get('org');
  if (!org) {
    throw new Error('Organization context not found - auth middleware may not be applied');
  }
  return org;
}

/**
 * Optional auth middleware - allows requests without API key for certain routes
 * (e.g., organization creation which doesn't require auth)
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const apiKeyFromHeader = c.req.header('X-Api-Key');
  const authHeader = c.req.header('Authorization');
  
  let apiKey: string | undefined;
  
  if (apiKeyFromHeader) {
    apiKey = apiKeyFromHeader;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7);
  }
  
  if (apiKey) {
    const org = await verifyApiKey(apiKey);
    if (org) {
      c.set('org', org);
    }
  }
  
  await next();
}