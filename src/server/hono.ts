import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import files from './routes/files';
import cron from './routes/cron';
import { NextRequest } from 'next/server';
import { errorHandler, ApiErrors } from './middleware/error';
//import type { AppContext } from './types';

//const app = new Hono<{ Bindings: AppContext['env'] }>();

// Cloudflare bindings type
export type CloudflareBindings = {
  DB: D1Database;
  FILES: R2Bucket;
  KV?: KVNamespace;
  NEXT_INC_CACHE_KV?: KVNamespace;
  ANALYTICS_ENGINE?: AnalyticsEngineDataset;
  // Environment variables
  ALLOWED_ORIGINS?: string;
  RESEND_API_KEY?: string;
  NEXT_PUBLIC_EMAIL_FROM?: string;
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_WEBAPP_ENV?: string;
  NODE_ENV?: string;
  QSTASH_URL?: string;
  QSTASH_TOKEN?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
};

// Extend Hono's environment with our bindings
export type HonoEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    user?: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: string;
      permissions?: string[];
    };
    requestId?: string;
    userId?: string;
    parsedBody?: unknown;
    [key: string]: unknown; // For validated data storage
  };
};


const app = new Hono<HonoEnv>().basePath('/api')

// Request ID middleware - should be first
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
});

// Global middleware
app.use('*', logger());

// CORS configuration
app.use('/api/*', cors({
  origin: (origin) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  credentials: true,
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Mount routes
const routes = app
  .route('/files', files)
  .route('/cron', cron);

// 404 handler
app.notFound((c) => {
  throw ApiErrors.notFound('Endpoint');
});

// Global error handler
app.onError(errorHandler);

export default app;
export type AppType = typeof routes;

// Export error utilities for use in routes
export { ApiErrors } from './middleware/error';


// Custom Next.js API route handler for Hono
export async function honoHandler(req: NextRequest) {
  // Since we're using basePath, we just need to pass the request directly
  return app.fetch(req);
}

