/**
 * OpenCode Serve API Client
 * Type-safe wrapper for OpenCode Serve HTTP API
 */

import { loadConfig } from './config.js';
import type { OpenCodeSession, MessagePart, RawResponse } from './types.js';

const config = loadConfig();

interface ServeClient {
  baseUrl: string;
  username: string;
  password: string;
}

class ServeClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ServeClientError';
  }
}

function getClient(): ServeClient {
  const { opencode } = config;
  // Password is optional - if not set, server runs unsecured (internal only)
  return {
    baseUrl: opencode.baseUrl.replace(/\/$/, ''),
    username: opencode.username || 'opencode',
    password: opencode.password || '',  // Empty string means no auth
  };
}

async function request<T>(
  client: ServeClient,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${client.baseUrl}${path}`;

  // Build headers - only add auth and content-type if needed
  const headers: Record<string, string> = {};

  // Only add Content-Type if we have a body
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  // Only add Basic Auth if password is configured
  if (client.password) {
    headers['Authorization'] = `Basic ${btoa(`${client.username}:${client.password}`)}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const responseText = await response.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
    throw new ServeClientError(
      `Serve API error: ${response.statusText}`,
      response.status,
      responseBody
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Create a new session with optional system prompt
 * @param systemPrompt - Optional system prompt (e.g., AGENTS.md content)
 * @returns Promise resolving to session ID
 */
export async function createSession(systemPrompt?: string): Promise<string> {
  const client = getClient();
  // Always send a body for POST /session
  const body = {
    title: systemPrompt ? systemPrompt.slice(0, 100) : 'Matrix Agent Session',
    ...(systemPrompt && systemPrompt.trim() ? { systemPrompt } : {})
  };
  
  const result = await request<OpenCodeSession>(
    client,
    'POST',
    '/session',
    body
  );
  return result.id;
}

/**
 * Send a message to a session and get AI response
 * @param sessionId - Session ID
 * @param content - Message content
 * @returns Promise resolving to RawResponse
 */
export async function sendMessage(
  sessionId: string,
  content: string
): Promise<RawResponse> {
  const client = getClient();
  const result = await request<RawResponse>(
    client,
    'POST',
    `/session/${sessionId}/message`,
    {
      parts: [
        { type: 'text', text: content }
      ]
    }
  );
  return result;
}

/**
 * Get all messages from a session
 * @param sessionId - Session ID
 * @returns Promise resolving to array of messages
 */
export async function getMessages(sessionId: string): Promise<MessagePart[]> {
  const client = getClient();
  const result = await request<{ messages: MessagePart[] }>(
    client,
    'GET',
    `/session/${sessionId}/message`
  );
  return result.messages || [];
}

/**
 * Delete a session
 * @param sessionId - Session ID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const client = getClient();
  await request<void>(client, 'DELETE', `/session/${sessionId}`);
}

/**
 * Check if the serve is healthy
 * @returns Promise resolving to boolean
 */
export async function healthCheck(): Promise<boolean> {
  const client = getClient();
  try {
    const headers: Record<string, string> = {}; 
    if (client.password) {
      headers['Authorization'] = `Basic ${btoa(`${client.username}:${client.password}`)}`;
    }
    const response = await fetch(`${client.baseUrl}/global/health`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}