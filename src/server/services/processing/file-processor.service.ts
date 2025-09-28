import { eq, and, lt } from 'drizzle-orm';
import { files } from '@/db/schema';
import { parseFile } from '@/lib/file-parser';
import { nanoid } from 'nanoid';
import { getDb } from '@/db';
import type { AppEnv } from '@/types/cloudflare';
import type {
  ServiceResponse,
  UploadResponse,
  ProcessResponse,
  StatusResponse,
  FileWithContentResponse,
  CronJobResponse,
  ListFilesResponse,
} from '@/types/responses';
import type { FileValidationResult, ParsedContentStorage } from '@/types/file.types';
import { FILE_CONSTRAINTS, type AllowedFileType } from '@/types/file.types';
import * as r2Storage from '../storage/r2.service';
import * as qstash from '../queue/qstash.service';

export function validateFile(file: File): FileValidationResult {
  if (file.size > FILE_CONSTRAINTS.MAX_SIZE) {
    return {
      success: false,
      error: 'File size exceeds 10MB limit',
      code: 400,
    };
  }

  if (!FILE_CONSTRAINTS.ALLOWED_TYPES.includes(file.type as AllowedFileType)) {
    return {
      success: false,
      error: 'Invalid file type. Only PDF, TXT, DOC, DOCX allowed',
      code: 400,
    };
  }

  return { success: true };
}

export async function uploadFile(
  env: AppEnv,
  file: File,
  userId: string
): Promise<ServiceResponse<UploadResponse>> {
  try {
    const validation = validateFile(file);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
        code: validation.code,
      };
    }

    const db = await getDb();
    const fileId = nanoid();

    const { r2Key } = await r2Storage.storeFile(env, fileId, file);

    const [newFile] = await db.insert(files).values({
      id: fileId,
      ownerId: userId,
      name: file.name,
      r2Key,
      sizeBytes: file.size,
      mime: file.type,
      status: 'pending',
    }).returning();

    const queued = await qstash.queueFileProcessing(env, {
      fileId,
      r2Key,
      mimeType: file.type,
      userId,
    });

    if (queued) {
      return {
        success: true,
        data: {
          file: newFile,
          mode: 'queued',
        },
      };
    }

    return {
      success: true,
      data: {
        file: newFile,
        mode: 'scheduled',
        message: 'File will be processed within 5 minutes',
      },
    };
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to upload file: ${errorMessage}`,
      code: 500,
    };
  }
}

export async function processFile(
  env: AppEnv,
  input: {
    fileId: string;
    r2Key: string;
    mimeType: string;
  }
): Promise<ServiceResponse<ProcessResponse>> {
  const db = await getDb();

  try {
    const { fileId, r2Key, mimeType } = input;

    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      return {
        success: false,
        error: 'File not found',
        code: 404,
      };
    }

    if (file.status === 'completed') {
      return {
        success: true,
        data: {
          fileId,
          pageCount: file.pageCount || undefined,
        },
      };
    }

    await db.update(files)
      .set({ status: 'processing', updatedAt: new Date().toISOString() })
      .where(eq(files.id, fileId));

    const content = await r2Storage.getFile(env, r2Key);
    if (!content) {
      throw new Error(`File not found in R2: ${r2Key}`);
    }

    const parsed = await parseFile(content, mimeType);

    const parsedContent: ParsedContentStorage = {
      ...parsed,
      fileId,
      parsedAt: new Date().toISOString(),
    };

    await r2Storage.storeParsedContent(env, fileId, parsedContent);

    await db.update(files)
      .set({
        status: 'completed',
        pageCount: parsed.pageCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(files.id, fileId));

    return {
      success: true,
      data: {
        fileId,
        pageCount: parsed.pageCount,
      },
    };
  } catch (error) {
    console.error('Processing error:', error);

    try {
      await db.update(files)
        .set({ status: 'error', updatedAt: new Date().toISOString() })
        .where(eq(files.id, input.fileId));
    } catch {}

    return {
      success: false,
      error: 'Processing failed',
      code: 500,
    };
  }
}

export async function getFileStatus(
  env: AppEnv,
  fileId: string
): Promise<ServiceResponse<StatusResponse>> {
  const db = await getDb();

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      return {
        success: false,
        error: 'File not found',
        code: 404,
      };
    }

    let progress = 0;
    let message = '';

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

    const hasContent = file.status === 'completed'
      ? await r2Storage.checkContentExists(env, fileId)
      : false;

    return {
      success: true,
      data: {
        id: file.id,
        name: file.name,
        status: file.status,
        progress,
        message,
        pageCount: file.pageCount || undefined,
        sizeBytes: file.sizeBytes,
        hasContent,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      },
    };
  } catch (error) {
    console.error('Status check error:', error);
    return {
      success: false,
      error: 'Failed to check status',
      code: 500,
    };
  }
}

export async function getFileWithContent(
  env: AppEnv,
  fileId: string
): Promise<ServiceResponse<FileWithContentResponse>> {
  const db = await getDb();

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      return {
        success: false,
        error: 'File not found',
        code: 404,
      };
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
      const content = await r2Storage.getParsedContent(env, fileId);
      if (content) {
        response.content = content;
      }
    } else if (file.status === 'pending' || file.status === 'processing') {
      response.file.message = 'File is still being processed';
    } else if (file.status === 'error') {
      response.file.message = 'File processing failed';
    }

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error fetching file:', error);
    return {
      success: false,
      error: 'Failed to fetch file',
      code: 500,
    };
  }
}

export async function deleteFile(
  env: AppEnv,
  fileId: string
): Promise<ServiceResponse<{ message: string }>> {
  const db = await getDb();

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      return {
        success: false,
        error: 'File not found',
        code: 404,
      };
    }

    await r2Storage.deleteFile(env, file.r2Key);
    await r2Storage.deleteParsedContent(env, fileId);

    await db.delete(files).where(eq(files.id, fileId));

    return {
      success: true,
      data: {
        message: 'File deleted successfully',
      },
    };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      success: false,
      error: 'Failed to delete file',
      code: 500,
    };
  }
}

export async function processInBackground(
  env: AppEnv,
  fileId: string,
  content: ArrayBuffer,
  mimeType: string
): Promise<void> {
  const db = await getDb();

  try {
    await db.update(files)
      .set({ status: 'processing', updatedAt: new Date().toISOString() })
      .where(eq(files.id, fileId));

    const parsed = await parseFile(content, mimeType);

    const parsedContent: ParsedContentStorage = {
      ...parsed,
      fileId,
      parsedAt: new Date().toISOString(),
    };

    await r2Storage.storeParsedContent(env, fileId, parsedContent);

    await db.update(files)
      .set({
        status: 'completed',
        pageCount: parsed.pageCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(files.id, fileId));
  } catch (error) {
    console.error(`Background processing error for ${fileId}:`, error);
    await db.update(files)
      .set({ status: 'error', updatedAt: new Date().toISOString() })
      .where(eq(files.id, fileId));
  }
}

export async function processPendingFiles(
  env: AppEnv
): Promise<ServiceResponse<CronJobResponse>> {
  const db = await getDb();

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const pendingFiles = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.status, 'pending'),
          lt(files.createdAt, tenMinutesAgo)
        )
      )
      .limit(5);

    const results: CronJobResponse['results'] = [];

    for (const file of pendingFiles) {
      const result = await processFile(env, {
        fileId: file.id,
        r2Key: file.r2Key,
        mimeType: file.mime,
      });

      results.push({
        fileId: file.id,
        status: result.success ? 'success' : 'error',
        error: result.error,
      });
    }

    return {
      success: true,
      data: {
        processed: results.length,
        results,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Cron job error:', error);
    return {
      success: false,
      error: 'Cron job failed',
      code: 500,
    };
  }
}

export async function listUserFiles(
  env: AppEnv,
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: string;
  } = {}
): Promise<ServiceResponse<ListFilesResponse>> {
  const db = await getDb();

  try {
    const { limit = 20, offset = 0, status } = options;

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
      .orderBy(files.createdAt)
      .limit(limit)
      .offset(offset);

    const filesWithContentStatus = await Promise.all(
      results.map(async (file) => {
        const hasContent = await r2Storage.checkContentExists(env, file.id);

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

    return {
      success: true,
      data: {
        files: filesWithContentStatus,
        total,
      },
    };
  } catch (error) {
    console.error('List files error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list files',
      code: 500,
    };
  }
}