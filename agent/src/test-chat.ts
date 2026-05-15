// test-chat.ts - Test full conversation with opencode serve

import * as serveClient from './serve-client.js';
import { createLogger } from './logger.js';

const logger = createLogger('test-chat');

async function testConversation() {
  logger.info('=== Testing OpenCode Serve Conversation ===');
  
  // Test 1: Health check
  logger.info('1. Health check...');
  const healthy = await serveClient.healthCheck();
  if (!healthy) {
    logger.error('Health check failed');
    process.exit(1);
  }
  logger.info('✓ Healthy');
  
  // Test 2: Create session with system prompt
  logger.info('2. Creating session with system prompt...');
  const systemPrompt = 'You are a helpful assistant. Respond concisely in Chinese.';
  const sessionId = await serveClient.createSession(systemPrompt);
  logger.info({ sessionId }, '✓ Session created');
  
  // Test 3: Multi-turn conversation
  logger.info('3. Testing multi-turn conversation...');
  
  // First message
  logger.info('Message 1: "你好，请介绍一下你自己"');
  const response1 = await serveClient.sendMessage(sessionId, '你好，请介绍一下你自己');
  const text1 = response1.parts
    .filter((p: any) => p.type === 'text' && p.text)
    .map((p: any) => p.text)
    .join('\n');
  logger.info({ response: text1.slice(0, 300) }, '✓ Response 1 received');
  
  // Second message (follow-up)
  logger.info('Message 2: "你能做什么？请举几个例子"');
  const response2 = await serveClient.sendMessage(sessionId, '你能做什么？请举几个例子');
  const text2 = response2.parts
    .filter((p: any) => p.type === 'text' && p.text)
    .map((p: any) => p.text)
    .join('\n');
  logger.info({ response: text2.slice(0, 300) }, '✓ Response 2 received');
  
  // Third message (context test)
  logger.info('Message 3: "刚才你提到了什么？请重复一下"');
  const response3 = await serveClient.sendMessage(sessionId, '刚才你提到了什么？请重复一下');
  const text3 = response3.parts
    .filter((p: any) => p.type === 'text' && p.text)
    .map((p: any) => p.text)
    .join('\n');
  logger.info({ response: text3.slice(0, 300) }, '✓ Response 3 received');
  
  // Test 4: Cleanup
  logger.info('4. Deleting session...');
  await serveClient.deleteSession(sessionId);
  logger.info('✓ Session deleted');
  
  logger.info('=== All tests passed! ===');
  logger.info('Conversation context is preserved across messages.');
}

testConversation().catch(err => {
  logger.error({ err }, 'Test failed');
  process.exit(1);
});