import initSqlJs from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { 
  organizations, 
  roles, 
  roleVersions, 
  containers, 
  sessions 
} from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database file path
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'database.db');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Database instance
let db: ReturnType<typeof drizzle> | null = null;
let sqlDb: any = null;

// Auto-save interval (30 seconds)
const AUTO_SAVE_INTERVAL = 30000;
let saveInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Save database to file
 */
function saveDatabaseToFile(database: any): void {
  try {
    const data = database.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

/**
 * Initialize database with schema
 */
async function initSchema(database: any): Promise<void> {
  database.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      version TEXT NOT NULL DEFAULT '1.0.0',
      image_name TEXT,
      config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS role_versions (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      version TEXT NOT NULL,
      image_name TEXT NOT NULL,
      config TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS containers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      role_version TEXT NOT NULL DEFAULT 'latest',
      container_id TEXT NOT NULL,
      port INTEGER NOT NULL,
      status TEXT NOT NULL,
      health_status TEXT NOT NULL,
      memory_path TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      container_id TEXT NOT NULL,
      opencode_session_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (container_id) REFERENCES containers(id)
    );
  `);
}

/**
 * Initialize database - load from file or create new
 */
export async function initDatabase(): Promise<ReturnType<typeof drizzle>> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(__dirname, '../../node_modules/sql.js/dist', file),
  });

  // Try to load existing database
  if (existsSync(DB_PATH)) {
    try {
      const fileBuffer = readFileSync(DB_PATH);
      sqlDb = new SQL.Database(fileBuffer);
      console.log('Database loaded from:', DB_PATH);
    } catch (error) {
      console.error('Failed to load database, creating new one:', error);
      sqlDb = new SQL.Database();
      await initSchema(sqlDb);
    }
  } else {
    // Create new database
    sqlDb = new SQL.Database();
    await initSchema(sqlDb);
    console.log('New database created at:', DB_PATH);
  }

  db = drizzle(sqlDb);

  // Setup auto-save
  saveInterval = setInterval(() => {
    if (sqlDb) {
      saveDatabaseToFile(sqlDb);
    }
  }, AUTO_SAVE_INTERVAL);

  // Save on process exit
  process.on('beforeExit', () => {
    if (sqlDb) {
      saveDatabaseToFile(sqlDb);
    }
  });

  return db;
}

/**
 * Force save database to file
 */
export function saveDatabase(): void {
  if (sqlDb) {
    saveDatabaseToFile(sqlDb);
  }
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (saveInterval) {
    clearInterval(saveInterval);
  }
  if (sqlDb) {
    saveDatabaseToFile(sqlDb);
    sqlDb.close();
    sqlDb = null;
    db = null;
  }
}

// Export tables
export { 
  organizations, 
  roles, 
  roleVersions, 
  containers, 
  sessions 
};
