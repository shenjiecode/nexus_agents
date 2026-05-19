import pino from 'pino';

/**
 * Shared logger instance for the entire backend
 * 
 * Log levels (controlled by LOG_LEVEL env var):
 * - 'trace': Most detailed, for development debugging
 * - 'debug': Detailed info, for troubleshooting
 * - 'info': General operational messages (default)
 * - 'warn': Warning conditions
 * - 'error': Error conditions
 * - 'fatal': Severe errors
 * 
 * Usage:
 *   logger.info('Message')
 *   logger.info({ key: 'value' }, 'Message with context')
 *   logger.error(error, 'Operation failed')
 *   logger.error({ err: error, userId: '123' }, 'User operation failed')
 */

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  
  // Pretty print in development, JSON in production
  transport: process.env.NODE_ENV === 'production' 
    ? undefined 
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});

/**
 * Create a child logger with additional context
 * Useful for module-specific logging
 * 
 * Example:
 *   const roleLogger = createLogger('role-service');
 *   roleLogger.info('Creating role', { slug: 'researcher' });
 */
export function createLogger(module: string) {
  return logger.child({ module });
}

export default logger;