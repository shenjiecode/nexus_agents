import logger from '../lib/logger.js';
import { employees, initDatabase } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import {
  createClient,
  createSession,
  sendMessage,
  extractTextFromResponse,
  deleteSession,
  type OpencodeClient,
  type MessageResponse,
} from '../integrations/opencode.js';

// Session timeout: 300 seconds
const SESSION_TIMEOUT_MS = 300 * 1000;

// In-memory session storage for active sessions with timeout handles
interface ActiveSession {
  id: string;
  organizationId: string;
  containerId: string;
  opencodeSessionId: string;
  containerUrl: string;
  containerPassword: string;
  client: OpencodeClient;
  status: 'active' | 'closed';
  createdAt: number;
  lastActivityAt: number;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  messageHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
}

const activeSessions = new Map<string, ActiveSession>();

// Helper to get database instance
let db: any = null;

async function getDb() {
  if (!db) {
    db = await initDatabase();
  }
  return db;
}

/**
 * Creates a new QA session for an organization's employee
 */
export async function createQASession(
  organizationId: string,
  containerId: string
): Promise<{
  id: string;
  sessionId: string;
  opencodeSessionId: string;
  containerId: string;
  organizationId: string;
  status: string;
  createdAt: number;
}> {
  // Verify employee belongs to organization
  const database = await getDb();
  const employeeRecords = await database
    .select()
    .from(employees)
    .where(and(
      eq(employees.containerId, containerId),
      eq(employees.organizationId, organizationId)
    ));

  if (employeeRecords.length === 0) {
    throw new Error('Employee not found or does not belong to organization');
  }

  // Get employee instance from employee-manager
  const { getEmployee } = await import('./employee-manager.js');
  const employeeInstance = getEmployee(containerId);

  if (!employeeInstance) {
    throw new Error('Employee instance not found in memory');
  }

  if (employeeInstance.status !== 'running') {
    throw new Error('Employee is not running');
  }

  // Create OpenCode client for this employee
  const client = createClient(
    employeeInstance.url,
    employeeInstance.password,
    'opencode'
  );

  // Create session in OpenCode
  const opencodeSessionId = await createSession(client, `Org: ${organizationId}`);

  // Generate our session ID
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const now = Date.now();

  // Note: no longer writing session to database; in-memory only

  // Store in active memory with timeout
  const timeoutHandle = setTimeout(() => {
    closeSession(organizationId, sessionId).catch((err) => logger.error(err, 'Failed to close session'));
  }, SESSION_TIMEOUT_MS);

  activeSessions.set(sessionId, {
    id: sessionId,
    organizationId: organizationId,
    containerId: containerId,
    opencodeSessionId: opencodeSessionId,
    containerUrl: employeeInstance.url,
    containerPassword: employeeInstance.password,
    client: client,
    status: 'active',
    createdAt: now,
    lastActivityAt: now,
    timeoutHandle: timeoutHandle,
    messageHistory: [],
  });

  return {
    id: sessionId,
    sessionId: sessionId,
    opencodeSessionId: opencodeSessionId,
    containerId: containerId,
    organizationId: organizationId,
    status: 'active',
    createdAt: now,
  };
}

/**
 * Sends a message to an existing QA session
 */
export async function sendMessageQA(
  organizationId: string,
  sessionId: string,
  content: string
): Promise<{
  response: string;
  sessionId: string;
}> {
  const activeSession = activeSessions.get(sessionId);

  if (!activeSession) {
    throw new Error('Session not found or closed');
  }

  if (activeSession.organizationId !== organizationId) {
    throw new Error('Session does not belong to this organization');
  }

  if (activeSession.status === 'closed') {
    throw new Error('Session is closed');
  }

  // Reset timeout on activity
  if (activeSession.timeoutHandle) {
    clearTimeout(activeSession.timeoutHandle);
  }
  activeSession.timeoutHandle = setTimeout(() => {
    closeSession(organizationId, sessionId).catch((err) => logger.error(err, 'Failed to close session'));
  }, SESSION_TIMEOUT_MS);

  // Add user message to history
  activeSession.messageHistory.push({
    role: 'user',
    content: content,
    timestamp: Date.now(),
  });
  activeSession.lastActivityAt = Date.now();

  // Call OpenCode API
  let responseText: string;
  try {
    const response: MessageResponse = await sendMessage(
      activeSession.client,
      activeSession.opencodeSessionId,
      content
    );
    responseText = extractTextFromResponse(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to send message to OpenCode';
    throw new Error(errMsg);
  }

  // Add assistant response to history
  activeSession.messageHistory.push({
    role: 'assistant',
    content: responseText,
    timestamp: Date.now(),
  });

  return {
    response: responseText,
    sessionId: sessionId,
  };
}

/**
 * Gets the message history for a session
 */
export async function getHistory(
  organizationId: string,
  sessionId: string
): Promise<Array<{
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}>> {
  const activeSession = activeSessions.get(sessionId);

  if (!activeSession) {
    throw new Error('Session not found or closed');
  }

  if (activeSession.organizationId !== organizationId) {
    throw new Error('Session does not belong to this organization');
  }

  return activeSession.messageHistory;
}

/**
 * Closes a QA session
 */
export async function closeSession(
  organizationId: string,
  sessionId: string
): Promise<{ success: boolean }> {
  const activeSession = activeSessions.get(sessionId);

  if (!activeSession) {
    return { success: true };
  }

  if (activeSession.organizationId !== organizationId) {
    throw new Error('Session does not belong to this organization');
  }

  // Clear timeout
  if (activeSession.timeoutHandle) {
    clearTimeout(activeSession.timeoutHandle);
  }

  // Delete session from OpenCode
  try {
    await deleteSession(activeSession.client, activeSession.opencodeSessionId);
  } catch (error) {
    logger.error(error, 'Failed to delete OpenCode session');
  }

  // Update status
  activeSession.status = 'closed';

  // Note: no longer updating session in database; in-memory only

  // Remove from active sessions
  activeSessions.delete(sessionId);

  return { success: true };
}