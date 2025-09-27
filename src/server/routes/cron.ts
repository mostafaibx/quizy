import { Hono } from 'hono';
import * as fileService from '../services/file.service';
import { ApiErrors } from '../middleware/error';
import { HonoEnv } from '../hono';

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

  const result = await fileService.processPendingFiles(c.env);

  if (!result.success) {
     throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
});

export default app;