/**
 * Matrix Service
 * Handles Matrix account registration for employees
 */

import logger from '../lib/logger.js';

const MATRIX_HOMESERVER_URL = process.env.MATRIX_HOMESERVER_URL || 'http://localhost:8008';

export interface MatrixAccount {
  userId: string;
  accessToken: string;
  deviceId: string;
}

/**
 * Register a new Matrix user
 * @param username - Desired username (without @ and :domain)
 * @param password - User password
 * @param displayName - Optional display name
 */
export async function registerMatrixUser(
  username: string,
  password: string,
  displayName?: string
): Promise<MatrixAccount> {
  const url = `${MATRIX_HOMESERVER_URL}/_matrix/client/v3/register`;

  // Generate device ID
  const deviceId = `nexus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        device_id: deviceId,
        initial_device_display_name: displayName || `Nexus Agent: ${username}`,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as Record<string, any>;

      // User already exists - try to login instead
      if (error.errcode === 'M_USER_IN_USE') {
        logger.info({ username }, 'Matrix user exists, logging in');
        return await loginMatrixUser(username, password, deviceId);
      }

      throw new Error(`Matrix registration failed: ${error.error || response.statusText}`);
    }

    const data = await response.json() as Record<string, any>;

    logger.info({ userId: data.user_id, username }, 'Matrix user registered');

    return {
      userId: data.user_id,
      accessToken: data.access_token,
      deviceId: data.device_id,
    };
  } catch (error) {
    logger.error({ error, username }, 'Failed to register Matrix user');
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
