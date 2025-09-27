import { Hono } from 'hono';
import * as fileService from '../services/file.service';
import { verifyQStashSignature, extractUserId } from '../middleware/auth';
import { ApiErrors } from '../middleware/error';
import type { HonoEnv } from '../hono';

const app = new Hono<HonoEnv>()

// Upload file
.post('/upload', extractUserId, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const userId = c.get('userId') as string;

  if (!file) {
    throw ApiErrors.badRequest('No file provided');
  }

  const ctx = (globalThis as { __cf_context?: ExecutionContext }).__cf_context;
  const result = await fileService.uploadFile(c.env, file, userId, ctx);

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

  const result = await fileService.processFile(c.env, {
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
.get('/:id', async (c) => {
  const fileId = c.req.param('id');
  const result = await fileService.getFileWithContent(c.env, fileId);

  if (!result.success) {
    if (result.code === 404) {
      throw ApiErrors.notFound('File', fileId);
    }
    throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
})

// Get file status
.get('/:id/status', async (c) => {
  const fileId = c.req.param('id');
  const result = await fileService.getFileStatus(c.env, fileId);

  if (!result.success) {
    if (result.code === 404) {
      throw ApiErrors.notFound('File', fileId);
    }
    throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
})

// Delete file
.delete('/:id', async (c) => {
  const fileId = c.req.param('id');
  const result = await fileService.deleteFile(c.env, fileId);

  if (!result.success) {
    if (result.code === 404) {
      throw ApiErrors.notFound('File', fileId);
    }
    throw ApiErrors.internal(result.error);
  }

  return c.json({ success: true, data: result.data });
})

// List files (for completeness)
.get('/', extractUserId, async (c) => {
  const userId = c.get('userId') as string;
  const includeDeleted = c.req.query('deleted') === 'true';

  // This would need implementation in the service layer
  return c.json({
    success: true,
    data: [],
    message: 'List files endpoint not yet implemented'
  });
})

export default app;