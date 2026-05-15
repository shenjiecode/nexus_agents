// agent.ts - Simplified Matrix client using native fetch

import { existsSync, readFileSync } from 'fs';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import * as serveClient from './serve-client.js';

const config = loadConfig();
const logger = createLogger('agent');

// Validate required config
if (!config.matrix.homeserverUrl) throw new Error('MATRIX_HOMESERVER_URL required');
if (!config.matrix.accessToken) throw new Error('MATRIX_ACCESS_TOKEN required');
if (!config.matrix.userId) throw new Error('MATRIX_USER_ID required');

// Global session (opencode manages memory internally)
let currentSessionId: string | null = null;
let nextBatch: string | null = null;

// Matrix API helpers
const matrixGet = (path: string, params?: Record<string, string>) => {
  const url = new URL(`/_matrix/client/v3${path}`, config.matrix.homeserverUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return fetch(url, {
    headers: { 'Authorization': `Bearer ${config.matrix.accessToken}` }
  }).then(r => r.json());
};

const matrixPut = (path: string, body: object) =>
  fetch(new URL(`/_matrix/client/v3${path}`, config.matrix.homeserverUrl), {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${config.matrix.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }).then(r => r.json());

/**
 * Check if message is a simple greeting (skip AI)
 */
function isSimpleGreeting(message: string): boolean {
  const patterns = [
    /^\s*(hi|hello|hey|greetings)\s*[!.,]*\s*$/i,
    /^\s*(thanks?|thank you|ty)\s*[!.,]*\s*$/i,
    /^\s*(ok|okay|got it)\s*[!.,]*\s*$/i,
    /^\s*(bye|goodbye)\s*[!.,]*\s*$/i,
  ];
  return patterns.some(p => p.test(message.trim()));
}

/**
 * Load AGENTS.md content for system prompt
 */
function loadAgentsContent(): string {
  if (!existsSync(config.agentsFile)) return '';
  try {
    return readFileSync(config.agentsFile, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Send message to room
 */
async function sendMessage(roomId: string, body: string): Promise<void> {
  const txnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await matrixPut(`/rooms/${roomId}/send/m.room.message/${txnId}`, {
    msgtype: 'm.text',
    body
  });
}

/**
 * Set typing indicator
 */
async function setTyping(roomId: string, typing: boolean, timeout: number = 5000): Promise<void> {
  await matrixPut(`/rooms/${roomId}/typing/${encodeURIComponent(config.matrix.userId!)}`, {
    typing,
    timeout: typing ? timeout : 0
  });
}

/**
 * Handle incoming Matrix message
 */
async function handleMessage(roomId: string, event: any): Promise<void> {
  // Skip own messages
  if (event.sender === config.matrix.userId) return;
  
  // Skip non-text
  if (event.content?.msgtype !== 'm.text') return;
  
  const message = event.content.body;
  if (!message) return;

  logger.info({ roomId, sender: event.sender }, 'Received message');

  // Simple greeting check
  if (isSimpleGreeting(message)) {
    await sendMessage(roomId, '👋 Hello! How can I help you?');
    return;
  }

  // Ensure session exists
  if (!currentSessionId) {
    const agentsContent = loadAgentsContent();
    currentSessionId = await serveClient.createSession(agentsContent || undefined);
    logger.info({ sessionId: currentSessionId }, 'Created session');
  }

  // Send typing indicator
  await setTyping(roomId, true);

  // Call opencode
  try {
    const response = await serveClient.sendMessage(currentSessionId, message);
    
    // Extract text from response
    const text = response.parts
      .filter((p: any) => p.type === 'text' && p.text)
      .map((p: any) => p.text)
      .join('\n');

    // Truncate if too long (Matrix limit)
    const truncated = text.length > 4000 ? text.slice(0, 4000) + '...' : text;

    // Reply to Matrix
    await sendMessage(roomId, truncated);
    
    logger.info({ roomId }, 'Reply sent');
  } catch (error) {
    logger.error({ error }, 'Failed to process message');
    await sendMessage(roomId, '❌ Sorry, an error occurred. Please try again.');
  } finally {
    await setTyping(roomId, false);
  }
}

/**
 * Sync loop - poll for new messages
 */
async function syncLoop(): Promise<void> {
  while (true) {
    try {
      const params: Record<string, string> = { timeout: '30000' };
      if (nextBatch) params.since = nextBatch;

      const data = await matrixGet('/sync', params);
      nextBatch = data.next_batch;

      // Process rooms
      const rooms = data.rooms?.join || {};
      for (const [roomId, roomData] of Object.entries(rooms)) {
        const events = (roomData as any).timeline?.events || [];
        for (const event of events) {
          if (event.type === 'm.room.message') {
            await handleMessage(roomId, event);
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Sync error, retrying in 5s...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Start client
logger.info('Starting Matrix client...');
logger.info(`Agent starting as ${config.matrix.userId}`);
await syncLoop();
