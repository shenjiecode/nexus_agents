import logger from '../lib/logger.js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  organizations,
  skills,
  mcps,
  employees,
  marketplaceRoles,
} from './schema.js';

const schema = {
  organizations,
  skills,
  mcps,
  employees,
  marketplaceRoles,
};

const connectionString = process.env.DATABASE_URL || (() => { throw new Error('DATABASE_URL environment variable is required'); })();

// Database instances
const client = postgres(connectionString);
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize database connection
 */
export async function initDatabase(): Promise<ReturnType<typeof drizzle>> {
  if (db) return db;

  db = drizzle(client, { schema });
  logger.info({ connectionString: connectionString.replace(/:([^@]+)@/, ':****@') }, 'Connected to PostgreSQL');

  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    db = null;
    logger.info('Database connection closed');
  }
}

// Export tables
export {
  organizations,
  skills,
  mcps,
  employees,
  marketplaceRoles,
};
