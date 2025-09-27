import fs from 'node:fs';
import path from 'node:path';

import type { Config } from 'drizzle-kit';
import { defineConfig } from 'drizzle-kit';

const LOCAL_DB_PATH = path.join(
  process.cwd(),
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
);
function findLocalDbFile() {
  try {
    const files = fs.readdirSync(LOCAL_DB_PATH);
    const dbFile = files.find(file => file.endsWith('.sqlite'));
    return dbFile ? path.join(LOCAL_DB_PATH, dbFile) : null;
  } catch {
    return null;
  }
}

export default process.env.NEXT_PUBLIC_WEBAPP_ENV === 'local'
  ? defineConfig({
      schema: './src/db/schema.ts',
      out: './src/db/migrations',
      dialect: 'sqlite',
      dbCredentials: {
        url: findLocalDbFile() || path.join(LOCAL_DB_PATH, 'database.sqlite'),
      },
    })
  : (defineConfig({
      schema: './src/db/schema.ts',
      out: './src/db/migrations',
      driver: 'd1-http',
      dialect: 'sqlite',
      dbCredentials: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_I!,
        token: process.env.CLOUDFLARE_API_TOKEN!,
        databaseId: process.env.D1_DATABASE_ID!,
      },
    }) satisfies Config);
