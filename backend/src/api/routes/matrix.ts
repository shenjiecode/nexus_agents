import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import { handleError } from '../../lib/format-error.js';
import { getOrganizationBySlugWithMatrix } from '../../services/org-service.js';
import {
  getRoomMessages,
  getRoomMembers,
  getRoomState,
  sendRoomMessage,
} from '../../services/matrix-service.js';

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, message, status };
}

// Create matrix router
const matrixRoutes = new Hono();

// GET /api/orgs/:orgSlug/matrix/messages - Get room messages
matrixRoutes.get('/api/orgs/:orgSlug/matrix/messages', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const query = c.req.query();

    // Verify organization exists with Matrix info
    const org = await getOrganizationBySlugWithMatrix(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    if (!org.internalRoomId || !org.matrixAdminAccessToken) {
      return c.json(apiError('Organization Matrix configuration not found', 400), 400);
    }

    // Parse pagination params - default to backward direction
    const params: { from?: string; dir?: 'f' | 'b'; limit?: number } = { dir: 'b' };
    if (query.from) params.from = query.from;
    if (query.dir === 'f' || query.dir === 'b') params.dir = query.dir;
    if (query.limit) {
      const limit = parseInt(query.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        params.limit = Math.min(limit, 100); // Max 100 messages
      }
    }

    const result = await getRoomMessages(
      org.internalRoomId,
      org.matrixAdminAccessToken,
      params
    );

    return c.json(apiSuccess({
      messages: result.chunk,
      start: result.start,
      end: result.end,
    }));
  } catch (error: any) {
    logger.error(error, 'Failed to get room messages');
    return handleError(c, error, 'Failed to get room messages');
  }
});

// GET /api/orgs/:orgSlug/matrix/members - Get room members
matrixRoutes.get('/api/orgs/:orgSlug/matrix/members', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');

    // Verify organization exists with Matrix info
    const org = await getOrganizationBySlugWithMatrix(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    if (!org.internalRoomId || !org.matrixAdminAccessToken) {
      return c.json(apiError('Organization Matrix configuration not found', 400), 400);
    }

    const members = await getRoomMembers(
      org.internalRoomId,
      org.matrixAdminAccessToken
    );

    return c.json(apiSuccess({
      members: members.map(m => ({
        userId: m.user_id,
        displayName: m.display_name,
        avatarUrl: m.avatar_url,
      })),
    }));
  } catch (error: any) {
    logger.error(error, 'Failed to get room members');
    return handleError(c, error, 'Failed to get room members');
  }
});

// GET /api/orgs/:orgSlug/matrix/state - Get room state
matrixRoutes.get('/api/orgs/:orgSlug/matrix/state', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');

    // Verify organization exists with Matrix info
    const org = await getOrganizationBySlugWithMatrix(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    if (!org.internalRoomId || !org.matrixAdminAccessToken) {
      return c.json(apiError('Organization Matrix configuration not found', 400), 400);
    }

    const state = await getRoomState(
      org.internalRoomId,
      org.matrixAdminAccessToken
    );

    return c.json(apiSuccess({
      name: state.name,
      topic: state.topic,
      state,
    }));
  } catch (error: any) {
    logger.error(error, 'Failed to get room state');
    return handleError(c, error, 'Failed to get room state');
  }
});

// POST /api/orgs/:orgSlug/matrix/send - Send message to room
matrixRoutes.post('/api/orgs/:orgSlug/matrix/send', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const body = await c.req.json();

    // Verify organization exists with Matrix info
    const org = await getOrganizationBySlugWithMatrix(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    if (!org.internalRoomId || !org.matrixAdminAccessToken) {
      return c.json(apiError('Organization Matrix configuration not found', 400), 400);
    }

    if (!body.content || typeof body.content !== 'string') {
      return c.json(apiError('Message content required', 400), 400);
    }

    const eventId = await sendRoomMessage(
      org.internalRoomId,
      body.content,
      org.matrixAdminAccessToken
    );

    return c.json(apiSuccess({ eventId }));
  } catch (error: any) {
    logger.error(error, 'Failed to send Matrix message');
    return handleError(c, error, 'Failed to send Matrix message');
  }
});

export default matrixRoutes;
