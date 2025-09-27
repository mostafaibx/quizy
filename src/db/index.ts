import { drizzle } from 'drizzle-orm/d1';

import { getEnv } from '../utils/helpers';

import * as schema from './schema';

// Initialize with null and create on first use
let dbInstance: ReturnType<typeof drizzle> | null = null;

export async function getDb(): Promise<ReturnType<typeof drizzle>> {
  if (!dbInstance) {
    const env = await getEnv();
    // Async path when env needs to be fetched
    dbInstance = drizzle(env.DB as D1Database, {
      schema,
      logger: env.NODE_ENV !== 'production',
    });
  }

  return dbInstance;
}
