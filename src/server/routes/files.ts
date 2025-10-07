import { Hono } from 'hono';
import { verifyQStashSignature } from '../middleware/qstash-auth';
import { ApiErrors } from '../middleware/error';
import type { HonoEnv } from '@/types/cloudflare';
import { requireAuth } from '../middleware/auth';
import { drizzle } from 'drizzle-orm/d1';
import { files, parsingJobs } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import * as r2Storage from '../services/storage/r2.service';
import * as qstash from '../services/queue/qstash.service';
import type { ParsedContentStorage, AllowedFileType } from '@/types/file.types';
import { FILE_CONSTRAINTS } from '@/types/file.types';
import { nanoid } from 'nanoid';
import type { FileWithContentResponse } from '@/types/responses';
import type { QStashMessageStatusResponse } from '@/types/qstash.types';
import type { ParsingCallbackBody } from '@/types/parsing.types';
const app = new Hono<HonoEnv>()

// Upload file - Uses external parser service only
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

  // Validate file
  if (file.size > FILE_CONSTRAINTS.MAX_SIZE) {
    throw ApiErrors.badRequest('File size exceeds 10MB limit');
  }

  if (!FILE_CONSTRAINTS.ALLOWED_TYPES.includes(file.type as AllowedFileType)) {
    throw ApiErrors.badRequest('Invalid file type. Only PDF, TXT, DOC, DOCX allowed');
  }

  // Check if parser service is configured
  if (!c.env.PARSER_SERVICE_URL) {
    throw ApiErrors.internal('Parser service not configured');
  }

  const db = drizzle(c.env.DB);

  try {
    const fileId = nanoid();
    console.log(`[Upload] Starting upload for file: ${file.name}, ID: ${fileId}`);

    // 1. Upload to R2 first (as per api_imp.md)
    console.log(`[Upload] Uploading to R2...`);
    const { r2Key } = await r2Storage.storeFile(c.env, fileId, file);
    console.log(`[Upload] R2 upload successful, key: ${r2Key}`);

    // Create file record in DB
    console.log(`[Upload] Creating file record in DB...`);
    const [newFile] = await db.insert(files).values({
      id: fileId,
      ownerId: userId,
      name: file.name,
      r2Key,
      sizeBytes: file.size,
      mime: file.type,
      status: 'pending',
    }).returning();
    console.log(`[Upload] File record created:`, newFile);

    // Create parsing job record
    const parsingJobId = nanoid();
    console.log(`[Upload] Creating parsing job: ${parsingJobId}`);

    await db.insert(parsingJobs).values({
      id: parsingJobId,
      fileId,
      userId,
      status: 'queued',
      parserServiceUrl: c.env.PARSER_SERVICE_URL,
    });
    console.log(`[Upload] Parsing job created`);

    // 2. Send to QStash (returns immediately)
    console.log(`[Upload] Queueing to QStash...`);
    console.log(`[Upload] QStash Config:`, {
      url: c.env.QSTASH_URL,
      hasToken: !!c.env.QSTASH_TOKEN,
      parserUrl: c.env.PARSER_SERVICE_URL,
      appUrl: c.env.NEXT_PUBLIC_APP_URL,
    });

    const queueResult = await qstash.queueParsingJob(c.env, {
      fileId,
      userId,
      r2Key,
      mimeType: file.type,
      jobId: parsingJobId,
      parserServiceUrl: c.env.PARSER_SERVICE_URL,
    });
    console.log(`[Upload] QStash queue result:`, queueResult);

    if (!queueResult.success) {
      console.error(`[Upload] QStash failed:`, queueResult.error);
      // Update job status to failed
      await db.update(parsingJobs)
        .set({
          status: 'failed',
          error: queueResult.error || 'Failed to queue parsing job',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(parsingJobs.id, parsingJobId));

      throw ApiErrors.internal(queueResult.error || 'Failed to queue parsing job');
    }

    // 3. Save messageId to track job
    await db.update(parsingJobs)
      .set({
        qstashMessageId: queueResult.messageId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(parsingJobs.id, parsingJobId));

    // 4. Return immediately to user
    return c.json({
      success: true,
      data: {
        file: newFile,
        parsingJobId,
        messageId: queueResult.messageId,
        message: "Your document is being processed. We'll notify you when it's ready!",
      },
    });
  } catch (error) {
    console.error('[Upload] Full error:', error);
    console.error('[Upload] Error stack:', error instanceof Error ? error.stack : 'No stack');

    // If it's already an API error, throw it as-is
    if (error instanceof Error && error.message.includes('QStash error')) {
      throw ApiErrors.internal(error.message);
    }
    if (error instanceof Error && error.message.includes('Failed to queue')) {
      throw error;
    }

    // For any other error, log details and throw generic
    throw ApiErrors.internal('Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
})

// DEPRECATED: Edge processing endpoint - no longer used
.post('/process', verifyQStashSignature, async (c) => {
  return c.json({
    success: false,
    error: 'Edge processing is deprecated. All processing now goes through external parser service.',
  }, 410); // 410 Gone
})

// Get file with content
.get('/:id', requireAuth(), async (c) => {
  const fileId = c.req.param('id');
  const db = drizzle(c.env.DB);

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      throw ApiErrors.notFound('File', fileId);
    }

    const response: FileWithContentResponse = {
      file: {
        id: file.id,
        name: file.name,
        status: file.status,
        mimeType: file.mime,
        sizeBytes: file.sizeBytes,
        pageCount: file.pageCount,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      },
    };

    if (file.status === 'completed') {
      const content = await r2Storage.getParsedContent(c.env, fileId);
      if (content) {
        response.content = content;
      }
    } else if (file.status === 'pending' || file.status === 'processing') {
      response.file.message = 'File is still being processed';
    } else if (file.status === 'error') {
      response.file.message = 'File processing failed';
    }

    return c.json({ success: true, data: response });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    console.error('Error fetching file:', error);
    throw ApiErrors.internal('Failed to fetch file');
  }
})

// Get file status with parsing job info
.get('/:id/status', requireAuth(), async (c) => {
  const fileId = c.req.param('id');
  const db = drizzle(c.env.DB);

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      throw ApiErrors.notFound('File', fileId);
    }

    // Get latest parsing job
    const jobs = await db
      .select()
      .from(parsingJobs)
      .where(eq(parsingJobs.fileId, fileId))
      .orderBy(desc(parsingJobs.createdAt))
      .limit(1);

    const parsingJob = jobs[0] || null;

    let progress = 0;
    let message = '';
    let status = file.status;

    // Use parsing job status for better accuracy
    if (parsingJob) {
      status = parsingJob.status === 'completed' ? 'completed' :
               parsingJob.status === 'failed' ? 'error' :
               parsingJob.status === 'processing' ? 'processing' : 'pending';

      switch (parsingJob.status) {
        case 'queued':
          progress = 10;
          message = 'Document queued for parsing';
          break;
        case 'processing':
          progress = 50;
          message = 'Parsing document content...';
          break;
        case 'completed':
          progress = 100;
          message = 'Document parsing completed';
          break;
        case 'failed':
          progress = 0;
          message = parsingJob.error || 'Document parsing failed';
          break;
      }
    } else {
      // Fallback to file status
      switch (file.status) {
        case 'pending':
          progress = 10;
          message = 'File uploaded, waiting to process';
          break;
        case 'processing':
          progress = 50;
          message = 'Processing file content';
          break;
        case 'completed':
          progress = 100;
          message = 'Processing complete';
          break;
        case 'error':
          progress = 0;
          message = 'Processing failed';
          break;
      }
    }

    const hasContent = file.status === 'completed'
      ? await r2Storage.checkContentExists(c.env, fileId)
      : false;

    return c.json({
      success: true,
      data: {
        id: file.id,
        name: file.name,
        status,
        progress,
        message,
        pageCount: file.pageCount || undefined,
        sizeBytes: file.sizeBytes,
        hasContent,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        parsingJobId: parsingJob?.id,
        parsingJobStatus: parsingJob?.status,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    console.error('Status check error:', error);
    throw ApiErrors.internal('Failed to check status');
  }
})

// Delete file
.delete('/:id', requireAuth(), async (c) => {
  const fileId = c.req.param('id');
  const db = drizzle(c.env.DB);

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      throw ApiErrors.notFound('File', fileId);
    }

    // Delete from R2
    await r2Storage.deleteFile(c.env, file.r2Key);
    await r2Storage.deleteParsedContent(c.env, fileId);

    // Delete from database (parsing jobs will cascade delete)
    await db.delete(files).where(eq(files.id, fileId));

    return c.json({
      success: true,
      data: {
        message: 'File deleted successfully',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    console.error('Error deleting file:', error);
    throw ApiErrors.internal('Failed to delete file');
  }
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

  const db = drizzle(c.env.DB);

  try {
    const conditions = status
      ? and(eq(files.ownerId, userId), eq(files.status, status))
      : eq(files.ownerId, userId);

    const totalFiles = await db
      .select()
      .from(files)
      .where(conditions);

    const total = totalFiles.length;

    const results = await db
      .select()
      .from(files)
      .where(conditions)
      .orderBy(desc(files.createdAt))
      .limit(limit)
      .offset(offset);

    const filesWithContentStatus = await Promise.all(
      results.map(async (file) => {
        const hasContent = file.status === 'completed'
          ? await r2Storage.checkContentExists(c.env, file.id)
          : false;

        return {
          id: file.id,
          name: file.name,
          status: file.status,
          mime: file.mime,
          sizeBytes: file.sizeBytes,
          pageCount: file.pageCount,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
          hasContent,
        };
      })
    );

    return c.json({
      success: true,
      data: {
        files: filesWithContentStatus,
        total,
      },
    });
  } catch (error) {
    console.error('List files error:', error);
    throw ApiErrors.internal('Failed to list files');
  }
})

// Webhook endpoint for parsing completion (called by QStash after parser service finishes)
.post('/parse-complete', verifyQStashSignature, async (c) => {
  const db = drizzle(c.env.DB);
  const qstashBody = c.get('parsedBody') as ParsingCallbackBody;

  console.log('[ParseComplete] Raw QStash body:', JSON.stringify(qstashBody));

  // Extract the actual parser response from QStash wrapper
  let parsedResponse;
  if (qstashBody.data) {
    // Decode base64 body from QStash
    const decodedBody = Buffer.from(JSON.stringify(qstashBody.data), 'base64').toString('utf-8');
    console.log('[ParseComplete] Decoded parser response:', decodedBody);
    parsedResponse = JSON.parse(decodedBody);
  } else {
    // Direct callback (not wrapped by QStash)
    parsedResponse = qstashBody;
  }

  console.log('[ParseComplete] Parser response:', JSON.stringify(parsedResponse));

  // Extract data from parser response
  const body = parsedResponse.detail || parsedResponse;

  if (!body.job_id && !body.file_id) {
    console.error('[ParseComplete] Missing required fields in parser response:', {
      job_id: body?.job_id,
      file_id: body?.file_id,
      hasBody: !!body,
      bodyKeys: body ? Object.keys(body) : []
    });
    throw ApiErrors.badRequest('Missing job_id or file_id');
  }

  try {
    const completedAt = new Date();

    if (body.success && body.data) {
      // Store parsed content in R2
      const parsedContent: ParsedContentStorage = {
        text: body.data.text,
        pageCount: body.data.pageCount,
        pages: body.data.pages,
        metadata: body.data.metadata,
        fileId: body.file_id,
        parsedAt: new Date().toISOString(),
        version: '2.0.0', // Parser service version
      };

      await r2Storage.storeParsedContent(c.env, body.file_id, parsedContent);

      // Update parsing job
      await db.update(parsingJobs)
        .set({
          status: 'completed',
          completedAt,
          parsedContentR2Key: body.r2_key || `processed/${body.file_id}.json`,
          processingMetrics: body.processing_metrics ? JSON.stringify(body.processing_metrics) : null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(parsingJobs.id, body.job_id));

      // Update file status
      await db.update(files)
        .set({
          status: 'completed',
          pageCount: body.data.pageCount,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(files.id, body.file_id));

      // TODO: Notify user in the UI (implement real-time notifications)
      // TODO: Optionally trigger quiz generation here

    } else {
      // Handle failure
      await db.update(parsingJobs)
        .set({
          status: 'failed',
          error: body.error?.message || 'Unknown parsing error',
          completedAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(parsingJobs.id, body.job_id));

      await db.update(files)
        .set({
          status: 'error',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(files.id, body.file_id));
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Parse complete webhook error:', error);
    throw ApiErrors.internal('Failed to process parsing completion');
  }
})

// Webhook endpoint for parsing failure (called by QStash if delivery fails)
.post('/parse-failed', verifyQStashSignature, async (c) => {
  const db = drizzle(c.env.DB);
  const qstashBody = c.get('parsedBody') as ParsingCallbackBody;

  console.log('[ParseFailed] Raw QStash body:', JSON.stringify(qstashBody));

  // Extract the actual parser response from QStash wrapper
  let parsedResponse;
  if (qstashBody.data) {
    // Decode base64 body from QStash
    const decodedBody = Buffer.from(JSON.stringify(qstashBody.data), 'base64').toString('utf-8');
    console.log('[ParseFailed] Decoded parser response:', decodedBody);
    parsedResponse = JSON.parse(decodedBody);
  } else {
    // Direct callback (not wrapped by QStash)
    parsedResponse = qstashBody;
  }

  // Extract data from parser response
  const body = parsedResponse.detail || parsedResponse;

  if (!body.job_id && !body.file_id) {
    console.error('[ParseFailed] Missing required fields:', {
      job_id: body?.job_id,
      file_id: body?.file_id,
      hasBody: !!body,
      bodyKeys: body ? Object.keys(body) : []
    });
    throw ApiErrors.badRequest('Missing job_id or file_id');
  }

  try {
    const failedAt = new Date();

    // Update parsing job
    await db.update(parsingJobs)
      .set({
        status: 'failed',
        error: body.error || 'QStash delivery failed',
        completedAt: failedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(parsingJobs.id, body.job_id));

    // Update file status
    await db.update(files)
      .set({
        status: 'error',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(files.id, body.file_id));

    return c.json({ success: true });
  } catch (error) {
    console.error('Parse failed webhook error:', error);
    throw ApiErrors.internal('Failed to process parsing failure');
  }
})

// Get parsing job status
.get('/parsing-job/:jobId', requireAuth(), async (c) => {
  const db = drizzle(c.env.DB);
  const jobId = c.req.param('jobId');

  try {
    const [job] = await db
      .select()
      .from(parsingJobs)
      .where(eq(parsingJobs.id, jobId))
      .limit(1);

    if (!job) {
      throw ApiErrors.notFound('Parsing job', jobId);
    }

    let progress = 0;
    let message = '';

    switch (job.status) {
      case 'queued':
        progress = 10;
        message = 'Document queued for parsing';
        break;
      case 'processing':
        progress = 50;
        message = 'Parsing document content...';
        break;
      case 'completed':
        progress = 100;
        message = 'Document parsing completed';
        break;
      case 'failed':
        progress = 0;
        message = job.error || 'Document parsing failed';
        break;
    }

    const metrics = job.processingMetrics ? JSON.parse(job.processingMetrics) : null;

    return c.json({
      success: true,
      data: {
        id: job.id,
        fileId: job.fileId,
        status: job.status,
        progress,
        message,
        error: job.error,
        processingMetrics: metrics,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt?.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    console.error('Get parsing job error:', error);
    throw ApiErrors.internal('Failed to get parsing job status');
  }
})

// Optional: Check QStash message status (as per api_imp.md section 6)
.get('/job/:messageId/status', requireAuth(), async (c) => {
  const messageId = c.req.param('messageId');

  if (!c.env.QSTASH_TOKEN) {
    throw ApiErrors.internal('QStash not configured');
  }

  try {
    const response = await fetch(`https://qstash.upstash.io/v2/messages/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.QSTASH_TOKEN}`
      }
    });

    if (!response.ok) {
      throw ApiErrors.notFound('Message', messageId);
    }

    const status = await response.json() as QStashMessageStatusResponse;

    return c.json({
      success: true,
      data: {
        status: status.state, // 'pending', 'delivered', 'failed'
        retries: status.retryCount,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    console.error('Check QStash message status error:', error);
    throw ApiErrors.internal('Failed to check message status');
  }
})

export default app;