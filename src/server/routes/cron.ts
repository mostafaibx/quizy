import { Hono } from 'hono';
import * as fileProcessor from '../services/processing/file-processor.service';
import { ApiErrors } from '../middleware/error';
import type { HonoEnv } from '@/types/cloudflare';

const app = new Hono<HonoEnv>()

// Cron job for processing pending files
.get(
  '/',
  async (c) => {
  // Simple auth check for cron
  const cronSecret = c.req.header('x-cron-secret');

  if (cronSecret !== 'your-cron-secret-key') {
    console.warn('Unauthorized cron access attempt');
    // In production, return 401
  }

  const result = await fileProcessor.processPendingFiles(c.env);

  if (!result.success) {
     throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
});

export default app;