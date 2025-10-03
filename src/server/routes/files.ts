import { Hono } from 'hono';
import * as fileProcessor from '../services/processing/file-processor.service';
import { verifyQStashSignature } from '../middleware/qstash-auth';
import { ApiErrors } from '../middleware/error';
import type { HonoEnv } from '@/types/cloudflare';
import { requireAuth } from '../middleware/auth';

const app = new Hono<HonoEnv>()

// Upload file
.post(
  '/upload',
  requireAuth(),
   async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const user = c.get('user');
  const userId = user?.id;

  if (!userId) {
    throw ApiErrors.unauthorized('User not authenticated');
  }

  if (!file) {
    throw ApiErrors.badRequest('No file provided');
  }

  const result = await fileProcessor.uploadFile(c.env, file, userId);

  if (!result.success) {
    throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
})

// Process file (QStash webhook)
.post('/process', verifyQStashSignature, async (c) => {
  const data = c.get('parsedBody') as {
    fileId: string;
    r2Key: string;
    mimeType: string;
    userId: string;
  };

  const result = await fileProcessor.processFile(c.env, {
    fileId: data.fileId,
    r2Key: data.r2Key,
    mimeType: data.mimeType,
  });

  if (!result.success) {
    throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
})

// Get file with content
.get('/:id', requireAuth(), async (c) => {
  const fileId = c.req.param('id');
  const result = await fileProcessor.getFileWithContent(c.env, fileId);

  if (!result.success) {
    if (result.code === 404) {
      throw ApiErrors.notFound('File', fileId);
    }
    throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
})

// Get file status
.get('/:id/status', requireAuth(), async (c) => {
  const fileId = c.req.param('id');
  const result = await fileProcessor.getFileStatus(c.env, fileId);

  if (!result.success) {
    if (result.code === 404) {
      throw ApiErrors.notFound('File', fileId);
    }
    throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
})

// Delete file
.delete('/:id', requireAuth(), async (c) => {
  const fileId = c.req.param('id');
  const result = await fileProcessor.deleteFile(c.env, fileId);

  if (!result.success) {
    if (result.code === 404) {
      throw ApiErrors.notFound('File', fileId);
    }
    throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
})

// List files for user
.get('/', requireAuth(), async (c) => {
  const user = c.get('user');
  const userId = user?.id;

  if (!userId) {
    throw ApiErrors.unauthorized('User not authenticated');
  }
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const status = c.req.query('status');

  const result = await fileProcessor.listUserFiles(c.env, userId, {
    limit,
    offset,
    status,
  });

  if (!result.success) {
    throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
})

export default app;