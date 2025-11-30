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
import type { ParsedContentStorage } from '@/types/file.types';
import { nanoid } from 'nanoid';
import type { FileWithContentResponse } from '@/types/responses';
import type { QStashMessageStatusResponse } from '@/types/qstash.types';
import type { 
  ParsingCallbackBody, 
  ParsingServiceResponse,
} from '@/types/parsing.types';
import { USER_MESSAGES, PARSER_SERVICE_VERSION } from '../constants/files';
import {
  validateFileUpload,
  getProgressInfo,
  decodeQStashBody,
  markParsingJobCompleted,
  markParsingJobFailed,
  markFileCompleted,
  markFileFailed,
  handleDirectProcessing,
  handleQueuedProcessing,
} from '../services/files/files.service';
import { createLogger } from '../services/logger.service';
import { createPipelineTracker } from '../services/monitoring';
import { checkFileUploadLimit } from '../services/rate-limiter';

// ============================================================================
// ROUTES
// ============================================================================

const app = new Hono<HonoEnv>()

/**
 * Upload file endpoint
 * Handles file upload, validation, and initiates parsing via external parser service
 * Supports both direct (< 2MB) and queued (>= 2MB) processing modes
 */
.post('/upload', requireAuth(), async (c) => {
  const user = c.get('user');
  const userId = user?.id;

  if (!userId) {
    throw ApiErrors.unauthorized('User not authenticated');
  }

  if (!c.env.PARSER_SERVICE_URL) {
    throw ApiErrors.internal('Parser service not configured');
  }

  // Initialize logger and monitoring
  const logger = createLogger('FileUpload', c.env.NODE_ENV);
  const tracker = createPipelineTracker(c.env.ANALYTICS_ENGINE, c.env.NODE_ENV);

  try {
    // Rate limiting check
    if (c.env.KV) {
      const userTier = 'free'; // TODO: Get from subscription service
      const rateLimit = await checkFileUploadLimit(c.env.KV, userId, userTier);

      if (!rateLimit.allowed) {
        logger.warn('File upload rate limit exceeded', {
          userId,
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        });
        
        return c.json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Upload rate limit exceeded. Please try again later.',
            retryAfter: rateLimit.retryAfter,
          },
        }, 429);
      }

      tracker.trackStep('rate_limit_passed', { remaining: rateLimit.remaining });
    }

    // Validate inputs
    const formData = await c.req.formData();
    const { file, language, subject, documentType } = validateFileUpload(formData);

    const db = drizzle(c.env.DB);
    const fileId = nanoid();
    const parsingJobId = nanoid();

    logger.info('Starting file upload', { 
      fileName: file.name, 
      fileId,
      fileSize: file.size,
      mimeType: file.type,
    });
    tracker.info('Upload started', { fileId, fileName: file.name, fileSize: file.size });

    // Step 1: Upload file to R2
    logger.info('Uploading to R2', { fileId });
    const { r2Key } = await r2Storage.storeFile(c.env, fileId, file);
    logger.info('R2 upload successful', { fileId, r2Key });
    tracker.trackStep('r2_upload_complete', { r2Key, fileSize: file.size });

    // Step 2: Create file record in database
    logger.info('Creating file record in database', { fileId });
    const [newFile] = await db.insert(files).values({
      id: fileId,
      ownerId: userId,
      name: file.name,
      r2Key,
      sizeBytes: file.size,
      mime: file.type,
      status: 'pending',
    }).returning();
    logger.info('File record created', { fileId });
    tracker.trackStep('db_record_created', { fileId });

    // Step 3: Create parsing job record
    logger.info('Creating parsing job', { parsingJobId, fileId });
    await db.insert(parsingJobs).values({
      id: parsingJobId,
      fileId,
      userId,
      status: 'queued',
      parserServiceUrl: c.env.PARSER_SERVICE_URL,
    });
    logger.info('Parsing job created', { parsingJobId });
    tracker.trackStep('parsing_job_created', { jobId: parsingJobId });

    // Step 4: Queue parsing job via QStash
    logger.info('Queueing to parser service', { parsingJobId, fileId });
    const queueResult = await qstash.queueParsingJob(c.env, {
      fileId,
      userId,
      r2Key,
      mimeType: file.type,
      jobId: parsingJobId,
      language,
      subject,
      documentType,
      fileSizeBytes: file.size,
      parserServiceUrl: c.env.PARSER_SERVICE_URL,
    });
    
    logger.info('Queue result received', { 
      success: queueResult.success, 
      mode: queueResult.mode,
      messageId: queueResult.messageId,
    });

    // Handle queue failure
    if (!queueResult.success) {
      logger.error('Processing failed', null, { error: queueResult.error });
      tracker.error('Queue failed', new Error(queueResult.error || 'Unknown error'), { fileId });
      await markParsingJobFailed(db, parsingJobId, queueResult.error || 'Failed to process file');
      tracker.complete(false, { error: queueResult.error });
      throw ApiErrors.internal(queueResult.error || 'Failed to process file');
    }

    // Step 5: Handle response based on processing mode
    // FLOW 1: Direct processing (< 2MB or development)
    if (queueResult.mode === 'direct' && queueResult.parsedData) {
      logger.info('Direct processing mode - handling response immediately', { fileId });
      tracker.trackStep('direct_processing_mode', { fileId });
      const result = await handleDirectProcessing(
        c,
        queueResult.parsedData as ParsingServiceResponse,
        fileId,
        parsingJobId,
        newFile
      );
      tracker.complete(true, { fileId, mode: 'direct' });
      return result;
    }

    // FLOW 2: Queued processing (>= 2MB in production)
    logger.info('Queued processing mode - will receive callback', { 
      fileId, 
      messageId: queueResult.messageId,
    });
    tracker.trackStep('queued_processing_mode', { fileId, messageId: queueResult.messageId });
    const result = await handleQueuedProcessing(c, parsingJobId, queueResult.messageId!, newFile);
    tracker.complete(true, { fileId, mode: 'queued' });
    return result;
    
  } catch (error) {
    logger.error('Upload failed', error instanceof Error ? error : new Error(String(error)));
    tracker.error('Upload failed', error instanceof Error ? error : new Error(String(error)));
    tracker.complete(false, { error: error instanceof Error ? error.message : String(error) });

    // Re-throw API errors as-is
    if (error instanceof Error && error.message.includes('QStash error')) {
      throw ApiErrors.internal(error.message);
    }
    if (error instanceof Error && error.message.includes('Failed to queue')) {
      throw error;
    }

    throw ApiErrors.internal('Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
})

/**
 * Get file with content
 * Returns file metadata and parsed content (if available)
 */
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

    // Attach content and status message based on file status
    switch (file.status) {
      case 'completed':
        const content = await r2Storage.getParsedContent(c.env, fileId);
        if (content) {
          response.content = content;
        }
        break;
      case 'pending':
      case 'processing':
        response.file.message = USER_MESSAGES.PROCESSING;
        break;
      case 'error':
        response.file.message = USER_MESSAGES.FAILED;
        break;
    }

    return c.json({ success: true, data: response });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    const logger = createLogger('GetFile', c.env.NODE_ENV);
    logger.error('Failed to fetch file', error instanceof Error ? error : undefined, { fileId });
    throw ApiErrors.internal('Failed to fetch file');
  }
})

/**
 * Get file status with parsing job info
 * Returns detailed status information including progress
 */
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

    // Get latest parsing job for more accurate status
    const [parsingJob] = await db
      .select()
      .from(parsingJobs)
      .where(eq(parsingJobs.fileId, fileId))
      .orderBy(desc(parsingJobs.createdAt))
      .limit(1);

    // Determine status and progress
    let status = file.status;
    let progressInfo;

    if (parsingJob) {
      // Map parsing job status to file status
      status = parsingJob.status === 'completed' ? 'completed' :
               parsingJob.status === 'failed' ? 'error' :
               parsingJob.status === 'processing' ? 'processing' : 'pending';

      progressInfo = getProgressInfo(parsingJob.status, parsingJob.error);
    } else {
      progressInfo = getProgressInfo(file.status);
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
        progress: progressInfo.progress,
        message: progressInfo.message,
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
    const logger = createLogger('GetFileStatus', c.env.NODE_ENV);
    logger.error('Failed to check status', error instanceof Error ? error : undefined, { fileId });
    throw ApiErrors.internal('Failed to check status');
  }
})

/**
 * Delete file
 * Removes file from R2 storage and database
 */
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

    // Delete from R2 storage
    await Promise.all([
      r2Storage.deleteFile(c.env, file.r2Key),
      r2Storage.deleteParsedContent(c.env, fileId),
    ]);

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
    const logger = createLogger('DeleteFile', c.env.NODE_ENV);
    logger.error('Failed to delete file', error instanceof Error ? error : undefined, { fileId });
    throw ApiErrors.internal('Failed to delete file');
  }
})

/**
 * Serve file from R2 storage
 * Used for local development - allows parser service to download files
 */
.get('/download/:r2Key{.+}', async (c) => {
  const r2Key = c.req.param('r2Key');
  const logger = createLogger('FileDownload', c.env.NODE_ENV);

  try {
    logger.info('Serving file from R2', { r2Key });
    
    const fileContent = await r2Storage.getFile(c.env, r2Key);
    
    if (!fileContent) {
      throw ApiErrors.notFound('File', r2Key);
    }

    // Determine content type from file extension
    const ext = r2Key.split('.').pop()?.toLowerCase();
    const contentType = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';

    logger.info('Successfully serving file', { sizeBytes: fileContent.byteLength });

    return new Response(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    logger.error('Failed to download file', error instanceof Error ? error : undefined, { r2Key });
    throw ApiErrors.internal('Failed to download file');
  }
})

/**
 * List files for authenticated user
 * Supports pagination and filtering by status
 */
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
    // Build query conditions
    const conditions = status
      ? and(eq(files.ownerId, userId), eq(files.status, status))
      : eq(files.ownerId, userId);

    // Get total count
    const totalFiles = await db
      .select()
      .from(files)
      .where(conditions);

    // Get paginated results
    const results = await db
      .select()
      .from(files)
      .where(conditions)
      .orderBy(desc(files.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich with content status
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
        total: totalFiles.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    const logger = createLogger('ListFiles', c.env.NODE_ENV);
    logger.error('Failed to list files', error instanceof Error ? error : undefined);
    throw ApiErrors.internal('Failed to list files');
  }
})

/**
 * Webhook endpoint for parsing completion
 * Called by QStash after parser service finishes processing
 */
.post('/parse-complete', verifyQStashSignature, async (c) => {
  const db = drizzle(c.env.DB);
  const qstashBody = c.get('parsedBody') as ParsingCallbackBody;
  const logger = createLogger('ParseComplete', c.env.NODE_ENV);
  const tracker = createPipelineTracker(c.env.ANALYTICS_ENGINE, c.env.NODE_ENV);

  logger.info('Received callback');
  tracker.info('Parse complete callback received');

  try{
    // Decode QStash callback body
    const body = decodeQStashBody(qstashBody);

    // Validate required fields
    if (!body.job_id || !body.file_id) {
      logger.error('Missing required fields', null, {
        job_id: body?.job_id,
        file_id: body?.file_id,
        hasBody: !!body,
        bodyKeys: body ? Object.keys(body) : []
      });
      throw ApiErrors.badRequest('Missing job_id or file_id');
    }

    const completedAt = new Date();

    if (body.success && body.data) {
      // Success: Store parsed content and update records
      logger.info('Processing successful result', { fileId: body.file_id, jobId: body.job_id });
      tracker.trackStep('processing_success', { pageCount: body.data.pageCount });

      const parsedContent: ParsedContentStorage = {
        text: body.data.text,
        pageCount: body.data.pageCount,
        pages: body.data.pages,
        metadata: body.data.metadata,
        fileId: body.file_id,
        parsedAt: completedAt.toISOString(),
        version: PARSER_SERVICE_VERSION,
      };

      await r2Storage.storeParsedContent(c.env, body.file_id, parsedContent);

      await markParsingJobCompleted(
        db,
        body.job_id,
        body.r2_key || `processed/${body.file_id}.json`,
        body.processing_metrics
      );

      await markFileCompleted(db, body.file_id, body.data.pageCount);

      logger.info('Successfully processed completion', { fileId: body.file_id });
      tracker.complete(true, { fileId: body.file_id, jobId: body.job_id });
    } else {
      // Failure: Update records with error
      logger.error('Processing failed', null, { error: body.error });
      tracker.error('Processing failed', new Error(body.error?.message || 'Unknown error'));

      const errorMessage = body.error?.message || 'Unknown parsing error';

      await markParsingJobFailed(db, body.job_id, errorMessage);
      await markFileFailed(db, body.file_id);

      logger.info('Marked job and file as failed', { fileId: body.file_id });
      tracker.complete(false, { fileId: body.file_id, error: errorMessage });
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error('Failed to process parsing completion', error instanceof Error ? error : undefined);
    tracker.error('Callback processing failed', error instanceof Error ? error : new Error(String(error)));
    tracker.complete(false, { error: error instanceof Error ? error.message : String(error) });
    throw ApiErrors.internal('Failed to process parsing completion');
  }
})

/**
 * Webhook endpoint for parsing failure
 * Called by QStash if delivery fails or parser service reports failure
 */
.post('/parse-failed', verifyQStashSignature, async (c) => {
  const db = drizzle(c.env.DB);
  const qstashBody = c.get('parsedBody') as ParsingCallbackBody;
  const logger = createLogger('ParseFailed', c.env.NODE_ENV);
  const tracker = createPipelineTracker(c.env.ANALYTICS_ENGINE, c.env.NODE_ENV);

  logger.info('Received failure callback');
  tracker.info('Parse failed callback received');

  try {
    // Decode QStash callback body
    const body = decodeQStashBody(qstashBody);

    // Validate required fields
    if (!body.job_id || !body.file_id) {
      logger.error('Missing required fields', null, {
        job_id: body?.job_id,
        file_id: body?.file_id,
        hasBody: !!body,
        bodyKeys: body ? Object.keys(body) : []
      });
      throw ApiErrors.badRequest('Missing job_id or file_id');
    }

    const errorMessage = body.error?.message || 'QStash delivery failed';
    logger.error('Parse failed', null, { error: errorMessage });
    tracker.error('Parse failed', new Error(errorMessage));

    // Update parsing job and file to failed status
    await markParsingJobFailed(db, body.job_id, errorMessage);
    await markFileFailed(db, body.file_id);

    logger.info('Successfully processed failure callback', { fileId: body.file_id });
    tracker.complete(false, { fileId: body.file_id, error: errorMessage });

    return c.json({ success: true });
  } catch (error) {
    logger.error('Failed to process parsing failure', error instanceof Error ? error : undefined);
    tracker.error('Failure callback processing failed', error instanceof Error ? error : new Error(String(error)));
    throw ApiErrors.internal('Failed to process parsing failure');
  }
})

/**
 * Get parsing job status
 * Returns detailed information about a specific parsing job
 */
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

    const progressInfo = getProgressInfo(job.status, job.error);
    const metrics = job.processingMetrics ? JSON.parse(job.processingMetrics) : null;

    return c.json({
      success: true,
      data: {
        id: job.id,
        fileId: job.fileId,
        status: job.status,
        progress: progressInfo.progress,
        message: progressInfo.message,
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
    const logger = createLogger('GetParsingJob', c.env.NODE_ENV);
    logger.error('Failed to get parsing job status', error instanceof Error ? error : undefined, { jobId });
    throw ApiErrors.internal('Failed to get parsing job status');
  }
})

/**
 * Check QStash message status
 * Optional endpoint to check the status of a message in QStash queue
 */
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
        status: status.state,
        retries: status.retryCount,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    const logger = createLogger('CheckQStashStatus', c.env.NODE_ENV);
    logger.error('Failed to check message status', error instanceof Error ? error : undefined, { messageId });
    throw ApiErrors.internal('Failed to check message status');
  }
})

export default app;