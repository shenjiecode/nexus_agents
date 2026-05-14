/**
 * OpenCode Serve API Client SDK
 * Type-safe wrapper for OpenCode Serve HTTP API
 */

export interface MessagePart {
  type: 'text' | 'step-start' | 'step-finish' | 'reasoning'
  text?: string
  id?: string
  sessionID?: string
  messageID?: string
  time?: {
    start?: number
    end?: number
  }
  reason?: string
}

export interface OpenCodeMessage {
  id: string
  sessionID: string
  role: 'user' | 'assistant'
  parentID?: string
  mode?: string
  agent?: string
  path?: { cwd: string; root: string }
  cost?: number
  tokens?: {
    total: number
    input: number
    output: number
    reasoning?: number
  }
  time?: {
    created: number
    completed?: number
  }
  finish?: string
}

export interface MessageResponse {
  info: OpenCodeMessage
  parts: MessagePart[]
}

export interface OpenCodeSession {
  id: string
  slug?: string
  projectID?: string
  directory?: string
  path?: string
  title?: string
  version?: string
  time?: {
    created: number
    updated: number
  }
}

export interface OpencodeClient {
  baseUrl: string
  password: string
  username: string
}

class OpencodeError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message)
    this.name = 'OpencodeError'
  }
}

/**
 * Make an authenticated request to OpenCode Serve
 */
async function request<T>(
  client: OpencodeClient,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${client.baseUrl}${path}`

  // Build Basic Auth header
  const auth = Buffer.from(`${client.username}:${client.password}`).toString('base64')

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    // Read body as text first, then try to parse as JSON
    const responseText = await response.text()
    let responseBody: unknown
    try {
      responseBody = JSON.parse(responseText)
    } catch {
      responseBody = responseText
    }
    throw new OpencodeError(
      `OpenCode API error: ${response.statusText}`,
      response.status,
      responseBody
    )
  }

  return response.json() as Promise<T>
}

/**
 * Create an OpenCode Serve client
 * @param baseUrl - Base URL of the OpenCode Serve (e.g., 'http://localhost:4097')
 * @param password - Server password (from OPENCODE_SERVER_PASSWORD)
 * @param username - Username for Basic Auth (default: 'opencode')
 */
export function createClient(baseUrl: string, password: string, username: string = 'opencode'): OpencodeClient {
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    password,
    username,
  }
}

/**
 * Create a new session in OpenCode
 * @param client - OpenCode client
 * @param title - Optional session title
 * @returns Promise resolving to session ID
 */
export async function createSession(
  client: OpencodeClient,
  title?: string
): Promise<string> {
  const result = await request<OpenCodeSession>(
    client,
    'POST',
    '/session',
    title ? { title } : {}
  )
  return result.id
}

/**
 * Send a message to a session and get AI response
 * @param client - OpenCode client
 * @param sessionId - Session ID
 * @param content - Message content
 * @returns Promise resolving to MessageResponse
 */
export async function sendMessage(
  client: OpencodeClient,
  sessionId: string,
  content: string
): Promise<MessageResponse> {
  const result = await request<MessageResponse>(
    client,
    'POST',
    `/session/${sessionId}/message`,
    {
      parts: [
        { type: 'text', text: content }
      ]
    }
  )
  return result
}

/**
 * Get all messages from a session
 * @param client - OpenCode client
 * @param sessionId - Session ID
 * @returns Promise resolving to array of messages
 */
export async function getMessages(
  client: OpencodeClient,
  sessionId: string
): Promise<OpenCodeMessage[]> {
  const result = await request<{ messages: OpenCodeMessage[] }>(
    client,
    'GET',
    `/session/${sessionId}/message`
  )
  return result.messages || []
}

/**
 * Delete a session
 * @param client - OpenCode client
 * @param sessionId - Session ID
 */
export async function deleteSession(
  client: OpencodeClient,
  sessionId: string
): Promise<void> {
  await request<void>(client, 'DELETE', `/session/${sessionId}`)
}

/**
 * Get session info
 * @param client - OpenCode client
 * @param sessionId - Session ID
 */
export async function getSession(
  client: OpencodeClient,
  sessionId: string
): Promise<OpenCodeSession> {
  return await request<OpenCodeSession>(client, 'GET', `/session/${sessionId}`)
}

/**
 * List all sessions
 * @param client - OpenCode client
 */
export async function listSessions(client: OpencodeClient): Promise<OpenCodeSession[]> {
  return await request<OpenCodeSession[]>(client, 'GET', '/session')
}

/**
 * Extract text content from message response
 * @param response - MessageResponse from sendMessage
 * @returns The text content from assistant response
 */
export function extractTextFromResponse(response: MessageResponse): string {
  const textParts = response.parts.filter(p => p.type === 'text' && p.text)
  return textParts.map(p => p.text || '').join('\n')
}

export { OpencodeError }