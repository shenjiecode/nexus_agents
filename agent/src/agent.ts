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
const matrixGet = async (path: string, params?: Record<string, string>) => {
  const url = new URL(`/_matrix/client/v3${path}`, config.matrix.homeserverUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${config.matrix.accessToken}` }
  });
  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(`Matrix API error: ${error.error || response.statusText}`);
  }
  return response.json();
};

const matrixPut = async (path: string, body: object) => {
  const response = await fetch(new URL(`/_matrix/client/v3${path}`, config.matrix.homeserverUrl), {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${config.matrix.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(`Matrix API error: ${error.error || response.statusText}`);
  }
  return response.json();
};

const matrixPost = async (path: string, body?: object) => {
  const response = await fetch(new URL(`/_matrix/client/v3${path}`, config.matrix.homeserverUrl), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.matrix.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(`Matrix API error: ${error.error || response.statusText}`);
  }
  return response.json();
};

/**
 * Join a room by accepting an invite
 */
async function joinRoom(roomId: string): Promise<void> {
  try {
    await matrixPost(`/rooms/${encodeURIComponent(roomId)}/join`);
    logger.info({ roomId }, 'Joined room');
  } catch (error) {
    logger.error({ error, roomId }, 'Failed to join room');
  }
}

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

// ============== Room Info ============== 

// Cache for room member counts (to detect DM vs group)
const roomMemberCache = new Map<string, number>();

async function getRoomMemberCount(roomId: string): Promise<number> {
  // Check cache first
  const cached = roomMemberCache.get(roomId);
  if (cached !== undefined) return cached;

  try {
    const data = await matrixGet(`/rooms/${roomId}/members`);
    // Matrix returns { chunk: [...member events] }
    // Filter for joined members
    const chunk = data?.chunk || [];
    const joinedCount = chunk.filter((e: any) => 
      e.content?.membership === 'join'
    ).length;
    roomMemberCache.set(roomId, joinedCount);
    logger.info({ roomId, joinedCount, totalEvents: chunk.length }, 'Room member count');
    return joinedCount;
  } catch (error) {
    logger.warn({ error, roomId }, 'Failed to get member count, assuming group room');
    return 10; // Assume it's a group room
  }
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

  // Debug: log raw event content to see @ format
  logger.info({
    roomId,
    sender: event.sender,
    body: message,
    formattedBody: event.content.formatted_body,
    relatesTo: event.content['m.relates_to'],
  }, 'Raw message event');
  // Check room type (DM vs group)
  const memberCount = await getRoomMemberCount(roomId);
  const isDM = memberCount <= 2; // DM = 2 members (agent + sender)
  logger.info({ roomId, memberCount, isDM }, 'Room type detection');

  // Check for mention in message
  // Matrix @ format: formatted_body contains <a href="matrix.to/#/@userId">displayName</a>
  const myUserId = config.matrix.userId || '';
  // Extract localpart from userId (@localpart:server → localpart)
  const localpart = myUserId.startsWith('@') ? myUserId.split(':')[0].substring(1) : myUserId;
  const isMentioned =
    // Check if formatted_body contains our user ID link
    (event.content.formatted_body && event.content.formatted_body.includes(myUserId)) ||
    // Check if body contains our display name (fallback)
    message.includes(localpart) ||
    // Replies count as mentions
    (event.content['m.relates_to']?.['m.in_reply_to']?.event_id);

  if (isMentioned) {
    logger.info({ roomId, sender: event.sender }, 'Message mentions me');
  }

  // In group rooms, only respond when mentioned; in DM, respond to all messages
  if (!isDM && !isMentioned) {
    logger.info({ roomId, sender: event.sender }, 'Group message not addressed to me, ignoring');
    return;
  }

  logger.info({ roomId, sender: event.sender, isDM, isMentioned }, 'Processing message');

  logger.info({ roomId, sender: event.sender }, 'Received mention');

  // Strip the mention prefix from message before sending to AI
  // Matrix @ format: "displayName: actual message" in body
  const formattedBody = event.content.formatted_body || '';
  let cleanMessage = message;
  if (formattedBody.includes(myUserId)) {
    // It's a Matrix @ mention - strip "displayName: " prefix
    const colonIdx = cleanMessage.indexOf(': ');
    if (colonIdx > 0 && colonIdx < 50) {
      cleanMessage = cleanMessage.substring(colonIdx + 2).trim();
    }
  }

  if (!cleanMessage) {
    await sendMessage(roomId, '👋 Hello! How can I help you?');
    return;
  }

  if (!currentSessionId) {
    const agentsContent = loadAgentsContent();
    logger.info({ hasAgents: !!agentsContent, agentsLength: agentsContent?.length }, 'Creating opencode session...');
    currentSessionId = await serveClient.createSession(agentsContent || undefined);
    logger.info({ sessionId: currentSessionId }, 'Session created');
  }

  // Send typing indicator
  await setTyping(roomId, true);

  // Call opencode
  try {
    const response = await serveClient.sendMessage(currentSessionId, cleanMessage);
    
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
 * Handle invite events - auto-accept invitations
 */
async function handleInvite(roomId: string, event: any): Promise<void> {
  // Check if this is an invite for us
  if (event.content?.membership !== 'invite') return;
  if (event.state_key !== config.matrix.userId) return;
  
  logger.info({ roomId, sender: event.sender }, 'Received room invite, joining...');
  await joinRoom(roomId);
}

/**
 * Sync loop - poll for new messages and invites
 */
async function syncLoop(): Promise<void> {
  while (true) {
    try {
      const params: Record<string, string> = { timeout: '30000' };
      if (nextBatch) params.since = nextBatch;

      const data = await matrixGet('/sync', params);
      nextBatch = data.next_batch;

      // Process invites (rooms we're invited to)
      const invitedRooms = data.rooms?.invite || {};
      for (const [roomId, roomData] of Object.entries(invitedRooms)) {
        const events = (roomData as any).invite_state?.events || [];
        for (const event of events) {
          if (event.type === 'm.room.member') {
            await handleInvite(roomId, event);
          }
        }
      }

      // Process joined rooms - messages
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
      const errDetails = error instanceof Error ? { message: error.message, stack: error.stack } : String(error);
      logger.error({ err: errDetails }, 'Sync error, retrying in 5s...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Start client
logger.info('Starting Matrix client...');
logger.info({
  matrixUrl: config.matrix.homeserverUrl,
  userId: config.matrix.userId,
  opencodeUrl: config.opencode.baseUrl,
  hasPassword: !!config.opencode.password,
  agentsFile: config.agentsFile,
}, 'Configuration loaded');

// Health check opencode serve
const healthy = await serveClient.healthCheck();
if (!healthy) {
  logger.error('OpenCode serve not healthy, exiting');
  process.exit(1);
}
logger.info('OpenCode serve is healthy');

logger.info(`Agent starting as ${config.matrix.userId}`);
await syncLoop();
