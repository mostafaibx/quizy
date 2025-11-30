
/**
 * File Processing Service
 * Handles business logic and database operations for file processing
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { files, parsingJobs, type File as DbFile } from '@/db/schema';
import { ApiErrors } from '@/server/middleware/error';
import * as r2Storage from '@/server/services/storage/r2.service';
import type { HonoEnv } from '@/types/cloudflare';
import type { Context } from 'hono';
import type {
  ParsedContentStorage,
  AllowedFileType,
} from '@/types/file.types';
import { FILE_CONSTRAINTS } from '@/types/file.types';
import type {
  Language,
  Subject,
  DocumentType,
  ParsingServiceResponse,
  ParsingCallbackBody,
} from '@/types/parsing.types';
import {
  isLanguage,
  isSubject,
  isDocumentType,
  LANGUAGES,
  DOCUMENT_TYPES,
} from '@/types/parsing.types';
import {
  PARSING_VERSION,
  PROGRESS_MESSAGES,
  USER_MESSAGES,
} from '@/server/constants/files';
import { assert } from '@/server/services/validation.service';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ValidatedFileInput {
  file: File;
  language: Language;
  subject: Subject;
  documentType: DocumentType;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates file upload inputs and returns typed values
 */
export function validateFileUpload(formData: FormData): ValidatedFileInput {
  // Extract form data
  const file = formData.get('file') as File | null;
  const languageInput = formData.get('language') as string | null;
  const subjectInput = formData.get('subject') as string | null;
  const documentTypeInput = formData.get('documentType') as string | null;

  // File validation
  if (!file || !(file instanceof File)) {
    throw ApiErrors.badRequest('No file provided or invalid file');
  }

  assert.exists(file.name, 'File must have a name');
  assert.notEmpty(file.name, 'File name cannot be empty');

  if (file.size === 0) {
    throw ApiErrors.badRequest('File is empty');
  }

  if (file.size > FILE_CONSTRAINTS.MAX_SIZE) {
    throw ApiErrors.unprocessable(
      `File size exceeds ${FILE_CONSTRAINTS.MAX_SIZE / 1024 / 1024}MB limit`
    );
  }

  if (!FILE_CONSTRAINTS.ALLOWED_TYPES.includes(file.type as AllowedFileType)) {
    throw ApiErrors.unprocessable(
      'Invalid file type. Only PDF, TXT, DOC, DOCX allowed'
    );
  }

  // Language validation
  if (!languageInput) {
    throw ApiErrors.badRequest(
      `Language is required. Valid values: ${LANGUAGES.join(', ')}`
    );
  }

  if (!isLanguage(languageInput)) {
    throw ApiErrors.unprocessable(
      `Invalid language. Must be one of: ${LANGUAGES.join(', ')}`
    );
  }

  // Subject validation
  if (!subjectInput) {
    throw ApiErrors.badRequest('Subject is required');
  }

  if (!isSubject(subjectInput)) {
    throw ApiErrors.unprocessable(
      'Invalid subject. See API documentation for valid subjects.'
    );
  }

  // Document type validation
  if (!documentTypeInput) {
    throw ApiErrors.badRequest(
      `Document type is required. Valid values: ${DOCUMENT_TYPES.join(', ')}`
    );
  }

  if (!isDocumentType(documentTypeInput)) {
    throw ApiErrors.unprocessable(
      `Invalid document type. Must be one of: ${DOCUMENT_TYPES.join(', ')}`
    );
  }

  return {
    file,
    language: languageInput,
    subject: subjectInput,
    documentType: documentTypeInput,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates parsed content storage object
 */
export function createParsedContentStorage(
  parsedResponse: ParsingServiceResponse,
  fileId: string,
  version: string = PARSING_VERSION
): ParsedContentStorage {
  return {
    text: parsedResponse.data!.text,
    pageCount: parsedResponse.data!.pages?.length || 0,
    pages: parsedResponse.data!.pages,
    metadata: parsedResponse.data!.metadata,
    fileId,
    parsedAt: new Date().toISOString(),
    version,
  };
}

/**
 * Calculates progress and message based on job/file status
 */
export function getProgressInfo(status: string, error?: string | null) {
  const statusMap: Record<string, { progress: number; message: string }> = {
    queued: PROGRESS_MESSAGES.QUEUED,
    processing: PROGRESS_MESSAGES.PROCESSING,
    completed: PROGRESS_MESSAGES.COMPLETED,
    failed: { progress: 0, message: error || PROGRESS_MESSAGES.FAILED.message },
    pending: PROGRESS_MESSAGES.PENDING,
  };

  return statusMap[status] || PROGRESS_MESSAGES.PENDING;
}

/**
 * Decodes QStash callback body
 * @param qstashBody - The raw QStash callback body
 * @returns The decoded callback body
 */
export function decodeQStashBody(qstashBody: ParsingCallbackBody): ParsingCallbackBody {
  assert.exists(qstashBody, 'QStash body is required');

  if (qstashBody.data) {
    try {
      const decodedBody = Buffer.from(JSON.stringify(qstashBody.data), 'base64').toString('utf-8');
      return JSON.parse(decodedBody) as ParsingCallbackBody;
    } catch (error) {
      throw ApiErrors.badRequest('Failed to decode QStash body');
    }
  }
  return qstashBody;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Updates parsing job to completed status
 */
export async function markParsingJobCompleted(
  db: ReturnType<typeof drizzle>,
  jobId: string,
  parsedContentKey: string,
  processingMetrics?: unknown
) {
  assert.exists(jobId, 'Job ID is required');
  assert.exists(parsedContentKey, 'Parsed content key is required');

  await db.update(parsingJobs)
    .set({
      status: 'completed',
      completedAt: new Date(),
      parsedContentR2Key: parsedContentKey,
      processingMetrics: processingMetrics ? JSON.stringify(processingMetrics) : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(parsingJobs.id, jobId));
}

/**
 * Updates parsing job to failed status
 */
export async function markParsingJobFailed(
  db: ReturnType<typeof drizzle>,
  jobId: string,
  error: string
) {
  assert.exists(jobId, 'Job ID is required');
  assert.exists(error, 'Error message is required');

  await db.update(parsingJobs)
    .set({
      status: 'failed',
      error,
      completedAt: new Date(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(parsingJobs.id, jobId));
}

/**
 * Updates file to completed status
 */
export async function markFileCompleted(
  db: ReturnType<typeof drizzle>,
  fileId: string,
  pageCount: number
) {
  assert.exists(fileId, 'File ID is required');
  assert.isPositive(pageCount, 'Page count must be positive');

  await db.update(files)
    .set({
      status: 'completed',
      pageCount,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(files.id, fileId));
}

/**
 * Updates file to error status
 */
export async function markFileFailed(
  db: ReturnType<typeof drizzle>,
  fileId: string
) {
  assert.exists(fileId, 'File ID is required');

  await db.update(files)
    .set({
      status: 'error',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(files.id, fileId));
}

// ============================================================================
// BUSINESS LOGIC / PROCESSING HANDLERS
// ============================================================================

/**
 * Handles direct processing response (< 2MB files)
 */
export async function handleDirectProcessing(
  c: Context<HonoEnv>,
  parsedResponse: ParsingServiceResponse,
  fileId: string,
  parsingJobId: string,
  newFile: DbFile
) {
  const db = drizzle(c.env.DB);

  if (parsedResponse.success && parsedResponse.data) {
    console.log('[Upload] Parsing successful - storing content in R2');

    const parsedContent = createParsedContentStorage(parsedResponse, fileId);
    await r2Storage.storeParsedContent(c.env, fileId, parsedContent);

    await markParsingJobCompleted(
      db,
      parsingJobId,
      `parsed/${fileId}.json`,
      parsedResponse.processing_metrics
    );

    await markFileCompleted(db, fileId, parsedContent.pageCount);

    console.log('[Upload] Direct processing completed successfully');

    return c.json({
      success: true,
      data: {
        file: {
          ...newFile,
          status: 'completed',
          pageCount: parsedContent.pageCount,
        },
        parsingJobId,
        mode: 'direct',
        message: USER_MESSAGES.DIRECT_SUCCESS,
        content: parsedContent,
      },
    });
  } else {
    // Parsing failed
    console.error('[Upload] Parsing failed:', parsedResponse.error);

    const errorMessage = parsedResponse.error?.message || 'Parsing failed';

    await markParsingJobFailed(db, parsingJobId, errorMessage);
    await markFileFailed(db, fileId);

    console.log('[Upload] Direct processing failed - returning error details to user');

    return c.json({
      success: false,
      error: {
        code: parsedResponse.error?.code || 'PARSE_ERROR',
        message: errorMessage,
        retryable: parsedResponse.error?.retry_able || false,
      },
      data: {
        file: {
          ...newFile,
          status: 'error',
        },
        parsingJobId,
        mode: 'direct',
      },
    }, 422);
  }
}

/**
 * Handles queued processing response (>= 2MB files)
 */
export async function handleQueuedProcessing(
  c: Context<HonoEnv>,
  parsingJobId: string,
  messageId: string,
  newFile: DbFile
) {
  const db = drizzle(c.env.DB);

  console.log('[Upload] Queued processing mode - will be processed asynchronously');

  await db.update(parsingJobs)
    .set({
      qstashMessageId: messageId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(parsingJobs.id, parsingJobId));

  return c.json({
    success: true,
    data: {
      file: newFile,
      parsingJobId,
      messageId,
      mode: 'queued',
      message: USER_MESSAGES.QUEUED_SUCCESS,
    },
  });
}

