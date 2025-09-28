import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import files from './routes/files';
import cron from './routes/cron';
import { NextRequest } from 'next/server';
import { errorHandler, ApiErrors } from './middleware/error';
import type { HonoEnv } from '@/types/cloudflare';


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
  // Get Cloudflare context for bindings
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const cfContext = await getCloudflareContext();

  // Pass the request with Cloudflare bindings
  return app.fetch(req, cfContext?.env);
}

