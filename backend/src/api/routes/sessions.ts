import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import { getOrganizationBySlug } from '../../services/org-service.js';
import { getContainer } from '../../services/container-manager.js';
import {
  createQASession,
  sendMessageQA,
  getHistory,
  closeSession,
} from '../../services/qa-service.js';

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, error: message, status };
}

// Create sessions router
const sessions = new Hono();

// POST /api/orgs/:orgSlug/containers/:containerId/sessions - Create session
sessions.post('/api/orgs/:orgSlug/containers/:containerId/sessions', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const containerId = c.req.param('containerId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    // Verify container belongs to organization
    const container = getContainer(containerId);
    if (!container || container.organizationId !== org.id) {
      return c.json(apiError('Container not found', 404), 404);
    }

    const result = await createQASession(org.id, containerId);

    return c.json(apiSuccess(result), 201);
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to create session', 500), 500);
  }
});

// POST /api/orgs/:orgSlug/sessions/:sessionId/messages - Send message
sessions.post('/api/orgs/:orgSlug/sessions/:sessionId/messages', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const sessionId = c.req.param('sessionId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const body = await c.req.json();
    const content = body.content;

    if (!content || typeof content !== 'string') {
      return c.json(apiError('Missing content field', 400), 400);
    }

    if (content.trim().length === 0) {
      return c.json(apiError('Content cannot be empty', 400), 400);
    }

    if (content.length > 10000) {
      return c.json(apiError('Content too long (max 10000 chars)', 400), 400);
    }

    const result = await sendMessageQA(org.id, sessionId, content);

    return c.json(apiSuccess(result));
  } catch (error: any) {
    logger.error(error, "API error");
    const message = error.message || 'Failed to send message';
    if (message.includes('not found') || message.includes('closed')) {
      return c.json(apiError(message, 404), 404);
    }
    return c.json(apiError(message, 500), 500);
  }
});

// GET /api/orgs/:orgSlug/sessions/:sessionId/messages - Get history
sessions.get('/api/orgs/:orgSlug/sessions/:sessionId/messages', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const sessionId = c.req.param('sessionId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const history = await getHistory(org.id, sessionId);

    return c.json(apiSuccess(history));
  } catch (error: any) {
    logger.error(error, "API error");
    const message = error.message || 'Failed to get history';
    if (message.includes('not found')) {
      return c.json(apiError(message, 404), 404);
    }
    return c.json(apiError(message, 500), 500);
  }
});

// DELETE /api/orgs/:orgSlug/sessions/:sessionId - Close session
sessions.delete('/api/orgs/:orgSlug/sessions/:sessionId', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const sessionId = c.req.param('sessionId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const result = await closeSession(org.id, sessionId);

    return c.json(apiSuccess(result));
  } catch (error: any) {
    logger.error(error, "API error");
    const message = error.message || 'Failed to close session';
    if (message.includes('not found')) {
      return c.json(apiError(message, 404), 404);
    }
    return c.json(apiError(message, 500), 500);
  }
});

export default sessions;
