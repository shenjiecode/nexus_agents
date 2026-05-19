import 'dotenv/config';
import { initDatabase, users } from './src/db/index.js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await initDatabase();
  
  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.slug, 'test-user')).limit(1);
  if (existing.length > 0) {
    console.log('User already exists');
    return;
  }
  
  const hash = await bcrypt.hash('test123', 10);
  await db.insert(users).values({
    id: 'test-1',
    name: 'Test User',
    slug: 'test-user',
    password: hash
  }).execute();
  console.log('User created');
}

main().catch(console.error);