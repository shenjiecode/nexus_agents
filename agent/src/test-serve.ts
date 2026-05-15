// test-serve.ts - Verify opencode serve communication inside container

import * as serveClient from './serve-client.js';
import { createLogger } from './logger.js';

const logger = createLogger('test');

async function test() {
  logger.info('Testing opencode serve connection...');
  
  // Test 1: Health check
  logger.info('1. Health check...');
  const healthy = await serveClient.healthCheck();
  if (!healthy) {
    logger.error('Health check failed - opencode serve not reachable');
    process.exit(1);
  }
  logger.info('✓ Health check passed');
  
  // Test 2: Create session
  logger.info('2. Creating session...');
  const sessionId = await serveClient.createSession('You are a test assistant. Reply briefly.');
  logger.info({ sessionId }, '✓ Session created');
  
  // Test 3: Send message
  logger.info('3. Sending message...');
  const response = await serveClient.sendMessage(sessionId, 'Hello, say "OK" briefly.');
  logger.info({ parts: response.parts.length }, '✓ Message sent');
  
  // Extract text
  const text = response.parts
    .filter((p: any) => p.type === 'text' && p.text)
    .map((p: any) => p.text)
    .join('\n');
  logger.info({ response: text.slice(0, 200) }, '✓ Response received');
  
  // Test 4: Cleanup
  logger.info('4. Deleting session...');
  await serveClient.deleteSession(sessionId);
  logger.info('✓ Session deleted');
  
  logger.info('All tests passed! Container internal communication works.');
}

test().catch(err => {
  logger.error({ err }, 'Test failed');
  process.exit(1);
});
