/**
 * Matrix Client Module
 * Handles Matrix protocol communication with sync loop
 */

import { MatrixClient, SimpleRetryJoinStrategy, LogLevel } from 'matrix-bot-sdk';
import { logger } from './logger';
import { MatrixClientConfig, MessageContext } from './types';

// Global client instance
let client: MatrixClient | null = null;
let messageHandler: ((context: MessageContext) => void) | null = null;
let currentUserId: string | null = null;

/**
 * Extract @mention from message body
 * Handles both @user:domain and @user formats
 */
function extractMention(body: string, userId: string): boolean {
  const userParts = userId.split(':');
  const localPart = userParts[0].toLowerCase();
  const domainPart = userParts[1] || '';

  // Match @localpart:domain or @localpart
  const mentionRegex = new RegExp(
    `@${localPart}(?::${domainPart})?`,
    'i'
  );

  return mentionRegex.test(body);
}

/**
 * Check if room is a direct message (1:1 chat)
 */
async function isDirectRoom(roomId: string): Promise<boolean> {
  if (!client) return false;

  try {
    const members = await client.getJoinedRoomMembers(roomId);

    // DM typically has exactly 2 members (the bot and one other)
    return members.length === 2;
  } catch {
    return false;
  }
}

/**
 * Process incoming room message event
 */
async function handleRoomMessage(
  roomId: string,
  event: {
    sender: string;
    content: {
      body: string;
      msgtype?: string;
    };
    origin_server_ts: number;
  }
): Promise<void> {
  if (!client || !messageHandler) return;

  // Skip own messages
  if (event.sender === currentUserId) return;

  // Skip non-text messages
  if (event.content.msgtype && event.content.msgtype !== 'm.text') {
    return;
  }

  const messageBody = event.content.body;
  if (!messageBody) return;

  const isDm = await isDirectRoom(roomId);

  // In group chats, only respond to @mentions
  if (!isDm) {
    if (!currentUserId) return;
    const hasMention = extractMention(messageBody, currentUserId);
    if (!hasMention) {
      logger.debug(`Ignoring group message without mention in ${roomId}`);
      return;
    }
  }

  // Build message context
  const context: MessageContext = {
    roomId,
    sender: event.sender,
    message: messageBody,
    timestamp: event.origin_server_ts,
  };

  logger.info(`Processing message from ${event.sender} in ${roomId}: ${messageBody.substring(0, 50)}...`);

  // Call the message handler
  try {
    messageHandler(context);
  } catch (error) {
    logger.error('Error in message handler:', error);
  }
}

/**
 * Start the Matrix client with sync loop
 */
export async function startMatrixClient(
  config: MatrixClientConfig,
  handler: (context: MessageContext) => void
): Promise<void> {
  if (client) {
    logger.warn('Matrix client already running');
    return;
  }

  messageHandler = handler;
  currentUserId = config.userId;

  // Create client instance
  client = new MatrixClient(
    config.homeserverUrl,
    config.accessToken
  );

  // Set up retry join strategy for better reliability
  (client as MatrixClient & { joinStrategy?: any }).joinStrategy = new SimpleRetryJoinStrategy();

  // Configure logging
  (client as MatrixClient & { logLevel?: any }).logLevel = LogLevel.WARN;

  // Listen to room message events
  client.on('room.message', async (roomId: string, event: any) => {
    await handleRoomMessage(roomId, event);
  });

  // Start the sync loop
  try {
    await client.start();
    logger.info(`Matrix client started for user ${config.userId}`);
  } catch (error) {
    logger.error('Failed to start Matrix client:', error);
    client = null;
    messageHandler = null;
    currentUserId = null;
    throw error;
  }
}

/**
 * Stop the Matrix client and logout
 */
export async function stopMatrixClient(): Promise<void> {
  if (!client) {
    logger.warn('No Matrix client to stop');
    return;
  }

  try {
    await client.stop();
    logger.info('Matrix client stopped');
  } catch (error) {
    logger.error('Error stopping Matrix client:', error);
  } finally {
    client = null;
    messageHandler = null;
    currentUserId = null;
  }
}

/**
 * Send a text message to a room
 */
export async function sendMessage(roomId: string, content: string): Promise<void> {
  if (!client) {
    throw new Error('Matrix client not initialized');
  }

  try {
    await client.sendMessage(roomId, {
      msgtype: 'm.text',
      body: content,
    });
    logger.debug(`Sent message to ${roomId}: ${content.substring(0, 50)}...`);
  } catch (error) {
    logger.error(`Failed to send message to ${roomId}:`, error);
    throw error;
  }
}

/**
 * Send typing indicator to a room
 */
export async function sendTyping(roomId: string): Promise<void> {
  if (!client) {
    throw new Error('Matrix client not initialized');
  }

  try {
    // Send typing indicator for 5 seconds
    await client.setTyping(roomId, true, 5000);
    logger.debug(`Sent typing indicator to ${roomId}`);
  } catch (error) {
    logger.error(`Failed to send typing to ${roomId}:`, error);
    // Non-critical, don't throw
  }
}