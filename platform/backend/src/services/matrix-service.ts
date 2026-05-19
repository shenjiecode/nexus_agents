/**
 * Matrix Service
 * Handles Matrix account registration (shared-secret admin API) and room management
 */

import { createHmac } from 'crypto';
import logger from '../lib/logger.js';

const MATRIX_HOMESERVER_URL = process.env.MATRIX_HOMESERVER_URL || 'http://localhost:8008';
const MATRIX_REGISTRATION_SECRET = process.env.MATRIX_REGISTRATION_SECRET || 'dev-secret-change-in-production';

export interface MatrixAccount {
  userId: string;
  accessToken: string;
  deviceId: string;
}

/**
 * Register a new Matrix user via Dendrite shared-secret admin API
 * @param username - Desired username (without @ and :domain)
 * @param password - User password
 * @param displayName - Optional display name
 * @param admin - Whether to register as admin (default: false)
 */
export async function registerMatrixUserAdmin(
  username: string,
  password: string,
  displayName?: string,
  admin: boolean = false
): Promise<MatrixAccount> {
  const nonceUrl = `${MATRIX_HOMESERVER_URL}/_synapse/admin/v1/register`;

  try {
    // Step 1: Get nonce
    const nonceResponse = await fetch(nonceUrl);
    if (!nonceResponse.ok) {
      throw new Error(`Failed to get registration nonce: ${nonceResponse.statusText}`);
    }
    const { nonce } = (await nonceResponse.json()) as { nonce: string };

    // Step 2: Compute HMAC-SHA1
    const mac = createHmac('sha1', MATRIX_REGISTRATION_SECRET)
      .update(`${nonce}\0${username}\0${password}\0${admin ? 'admin' : 'notadmin'}`)
      .digest('hex');

    // Step 3: Register user
    const registerResponse = await fetch(nonceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce,
        username,
        password,
        displayname: displayName || username,
        admin,
        mac,
      }),
    });

    if (!registerResponse.ok) {
      const error = (await registerResponse.json()) as Record<string, string>;
      throw new Error(`Matrix admin registration failed: ${error.error || registerResponse.statusText}`);
    }

    const data = (await registerResponse.json()) as Record<string, string>;

    logger.info({ userId: data.user_id, username, admin }, 'Matrix user registered via admin API');

    return {
      userId: data.user_id,
      accessToken: data.access_token,
      deviceId: data.device_id,
    };
  } catch (error) {
    logger.error({ error, username }, 'Failed to register Matrix user via admin API');
    throw error;
  }
}

/**
 * Login to existing Matrix account
 */
export async function loginMatrixUser(
  username: string,
  password: string,
  deviceId?: string
): Promise<MatrixAccount> {
  const url = `${MATRIX_HOMESERVER_URL}/_matrix/client/v3/login`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      user: username,
      password,
      device_id: deviceId,
    }),
  });

  if (!response.ok) {
    const error = await response.json() as Record<string, any>;
    throw new Error(`Matrix login failed: ${error.error || response.statusText}`);
  }

    const data = await response.json() as Record<string, any>;

  return {
    userId: data.user_id,
    accessToken: data.access_token,
    deviceId: data.device_id,
  };
}

/**
 * Create a Matrix room
 */
export async function createRoom(
  name: string,
  alias: string,
  creatorAccessToken: string,
  isPublic: boolean = false,
  topic?: string,
): Promise<{ roomId: string; alias: string }> {
  const url = `${MATRIX_HOMESERVER_URL}/_matrix/client/v3/createRoom`;

  try {
    const body: Record<string, unknown> = {
      name,
      room_alias_name: alias,
      visibility: isPublic ? 'public' : 'private',
      preset: isPublic ? 'public_chat' : 'private_chat',
    };
    if (topic) {
      body.topic = topic;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creatorAccessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = (await response.json()) as Record<string, string>;
      throw new Error(`Failed to create room: ${error.error || response.statusText}`);
    }

    const data = (await response.json()) as { room_id: string; room_alias: string };
    logger.info({ roomId: data.room_id, alias: data.room_alias, name }, 'Matrix room created');

    return {
      roomId: data.room_id,
      alias: data.room_alias,
    };
  } catch (error) {
    logger.error({ error, name, alias }, 'Failed to create Matrix room');
    throw error;
  }
}

/**
 * Invite a user to a room
 */
export async function inviteToRoom(
  roomId: string,
  userId: string,
  inviterAccessToken: string,
): Promise<void> {
  const url = `${MATRIX_HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${inviterAccessToken}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const error = (await response.json()) as Record<string, string>;
      // M_ALREADY_IN_ROOM is not an error
      if (error.errcode === 'M_ALREADY_IN_ROOM') {
        logger.info({ roomId, userId }, 'User already in room');
        return;
      }
      throw new Error(`Failed to invite to room: ${error.error || response.statusText}`);
    }

    logger.info({ roomId, userId }, 'User invited to room');
  } catch (error) {
    logger.error({ error, roomId, userId }, 'Failed to invite user to room');
    throw error;
  }
}

/**
 * Join a room
 * @returns The room_id
 */
export async function joinRoom(
  roomIdOrAlias: string,
  userAccessToken: string,
): Promise<string> {
  const url = `${MATRIX_HOMESERVER_URL}/_matrix/client/v3/join/${encodeURIComponent(roomIdOrAlias)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = (await response.json()) as Record<string, string>;
      throw new Error(`Failed to join room: ${error.error || response.statusText}`);
    }

    const data = (await response.json()) as { room_id: string };
    logger.info({ roomIdOrAlias, roomId: data.room_id }, 'Joined Matrix room');

    return data.room_id;
  } catch (error) {
    logger.error({ error, roomIdOrAlias }, 'Failed to join Matrix room');
    throw error;
  }
}

/**
 * Send a message to a room
 * @returns event_id
 */
export async function sendRoomMessage(
  roomId: string,
  message: string,
  senderAccessToken: string,
): Promise<string> {
  const txnId = `nexus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = `${MATRIX_HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${senderAccessToken}`,
      },
      body: JSON.stringify({
        msgtype: 'm.text',
        body: message,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as Record<string, string>;
      throw new Error(`Failed to send message: ${error.error || response.statusText}`);
    }

    const data = (await response.json()) as { event_id: string };
    logger.info({ roomId, eventId: data.event_id }, 'Message sent to Matrix room');

    return data.event_id;
  } catch (error) {
    logger.error({ error, roomId }, 'Failed to send message to Matrix room');
    throw error;
  }
}

/**
 * Generate a unique Matrix username for an employee
 * Format: nexus-{orgSlug}-{roleId}-{timestamp}
 */
export function generateMatrixUsername(orgSlug: string, roleSlug: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `nexus-${orgSlug}-${roleSlug}-${timestamp}${random}`.toLowerCase();
}

/**
 * Generate a secure random password
 */
export function generateMatrixPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Get room messages (paginated timeline)
 * @param roomId - The Matrix room ID
 * @param accessToken - User's access token
 * @param params - Pagination parameters
 */
export async function getRoomMessages(
  roomId: string,
  accessToken: string,
  params?: { from?: string; dir?: 'f' | 'b'; limit?: number }
): Promise<{ chunk: any[]; start: string; end?: string }> {
  const encodedRoomId = encodeURIComponent(roomId);
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.dir) query.set('dir', params.dir);
  if (params?.limit) query.set('limit', params.limit.toString());

  const url = `${MATRIX_HOMESERVER_URL}/_matrix/client/v3/rooms/${encodedRoomId}/messages?${query.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as Record<string, string>;
      throw new Error(`Failed to get room messages: ${error.error || response.statusText}`);
    }

    const data = (await response.json()) as { chunk: any[]; start: string; end?: string };
    logger.info({ roomId, count: data.chunk.length }, 'Retrieved room messages');

    return data;
  } catch (error) {
    logger.error({ error, roomId }, 'Failed to get room messages');
    throw error;
  }
}

/**
 * Get room members
 * @param roomId - The Matrix room ID
 * @param accessToken - User's access token
 */
export async function getRoomMembers(
  roomId: string,
  accessToken: string
): Promise<Array<{ user_id: string; display_name?: string; avatar_url?: string }>> {
  const encodedRoomId = encodeURIComponent(roomId);
  const url = `${MATRIX_HOMESERVER_URL}/_matrix/client/v3/rooms/${encodedRoomId}/members`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as Record<string, string>;
      throw new Error(`Failed to get room members: ${error.error || response.statusText}`);
    }

    const data = (await response.json()) as { chunk: Array<{ state_key: string; content: { displayname?: string; avatar_url?: string } }> };

    const members = data.chunk.map((event) => ({
      user_id: event.state_key,
      display_name: event.content.displayname,
      avatar_url: event.content.avatar_url,
    }));

    logger.info({ roomId, count: members.length }, 'Retrieved room members');

    return members;
  } catch (error) {
    logger.error({ error, roomId }, 'Failed to get room members');
    throw error;
  }
}

/**
 * Get room state (name, topic, etc.)
 * @param roomId - The Matrix room ID
 * @param accessToken - User's access token
 */
export async function getRoomState(
  roomId: string,
  accessToken: string
): Promise<{ name?: string; topic?: string; [key: string]: any }> {
  const encodedRoomId = encodeURIComponent(roomId);
  const url = `${MATRIX_HOMESERVER_URL}/_matrix/client/v3/rooms/${encodedRoomId}/state`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as Record<string, string>;
      throw new Error(`Failed to get room state: ${error.error || response.statusText}`);
    }

    const events = (await response.json()) as Array<{ type: string; content: Record<string, any> }>;

    // Extract useful state events
    const state: { name?: string; topic?: string; [key: string]: any } = {};

    for (const event of events) {
      if (event.type === 'm.room.name' && event.content.name) {
        state.name = event.content.name as string;
      } else if (event.type === 'm.room.topic' && event.content.topic) {
        state.topic = event.content.topic as string;
      } else {
        // Store other state events by type
        state[event.type] = event.content;
      }
    }

    logger.info({ roomId, state }, 'Retrieved room state');

    return state;
  } catch (error) {
    logger.error({ error, roomId }, 'Failed to get room state');
    throw error;
  }
}
