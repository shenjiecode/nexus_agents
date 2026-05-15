/**
 * Agent Daemon Types
 * Type definitions for the agent-proxy architecture
 */

// =============================================================================
// OpenCode Base Types
// =============================================================================

export interface MessagePart {
  type: 'text' | 'step-start' | 'step-finish' | 'reasoning';
  text?: string;
  id?: string;
  sessionID?: string;
  messageID?: string;
}

export interface OpenCodeMessage {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  parentID?: string;
  mode?: string;
  agent?: string;
}

export interface OpenCodeSession {
  id: string;
  slug?: string;
  projectID?: string;
  directory?: string;
  path?: string;
}

// =============================================================================
// Matrix Client Types
// =============================================================================

export interface MatrixClientConfig {
  homeserverUrl: string;
  accessToken?: string;
  userId: string;
  roomId: string;
}

// =============================================================================
// Message Context
// =============================================================================

export interface MessageContext {
  roomId: string;
  sender: string;
  sessionId?: string;
  message: string;
  timestamp: number;
}

// =============================================================================
// Response Types
// =============================================================================

export interface RawResponse {
  message: OpenCodeMessage;
  parts: MessagePart[];
}