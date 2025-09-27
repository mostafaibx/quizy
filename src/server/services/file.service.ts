import { drizzle } from 'drizzle-orm/d1';
import { eq, and, lt } from 'drizzle-orm';
import { files } from '@/db/schema';
import { parseFile, type ParsedContent } from '@/lib/file-parser';
import { nanoid } from 'nanoid';
import type {
  AppEnv,
  ServiceResponse,
  UploadResponse,
  ProcessResponse,
  StatusResponse,
  ProcessFileInput,
  FileWithContentResponse,
  CronJobResponse
} from '../types';

// File validation
export const validateFile = (file: File): ServiceResponse<null> => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      success: false,
      error: 'File size exceeds 10MB limit',
      code: 400,
    };
  }

  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: 'Invalid file type. Only PDF, TXT, DOC, DOCX allowed',
      code: 400,
    };
  }

  return { success: true };
};

// Store file in R2
export const storeFileInR2 = async (
  env: AppEnv,
  fileId: string,
  file: File
): Promise<{ r2Key: string; arrayBuffer: ArrayBuffer }> => {
  try {
    const r2Key = `uploads/${fileId}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();

    console.log('Attempting to store in R2 with key:', r2Key);
    console.log('R2 bucket available:', !!env.FILES);

    if (!env.FILES) {
      throw new Error('R2 bucket (FILES) is not configured');
    }

    await env.FILES.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalName: file.name,
      },
    });

    return { r2Key, arrayBuffer };
  } catch (error) {
    console.error('R2 storage error:', error);
    throw new Error(`Failed to store file in R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Store parsed content
export const storeParsedContent = async (
  env: AppEnv,
  fileId: string,
  parsed: ParsedContent
): Promise<void> => {
  await env.FILES.put(
    `parsed/${fileId}.json`,
    JSON.stringify({
      ...parsed,
      fileId,
      parsedAt: new Date().toISOString(),
    }),
    {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { originalFileId: fileId },
    }
  );
};

// Process file in background
export const processInBackground = async (
  env: AppEnv,
  fileId: string,
  content: ArrayBuffer,
  mimeType: string
): Promise<void> => {
  const db = drizzle(env.DB);

  try {
    await db.update(files)
      .set({ status: 'processing', updatedAt: new Date().toISOString() })
      .where(eq(files.id, fileId));

    const parsed = await parseFile(content, mimeType);
    await storeParsedContent(env, fileId, parsed);

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
};

// Queue file to QStash
export const queueToQStash = async (
  env: AppEnv,
  data: ProcessFileInput
): Promise<boolean> => {
  if (!env.QSTASH_URL || !env.QSTASH_TOKEN) {
    return false;
  }

  try {
    const response = await fetch(
      `${env.QSTASH_URL}/v2/publish/https://quizy.workers.dev/api/files/process`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Upstash-Retries': '3',
          'Upstash-Delay': '2s',
        },
        body: JSON.stringify(data),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('QStash error:', error);
    return false;
  }
};

// Upload file
export const uploadFile = async (
  env: AppEnv,
  file: File,
  userId: string,
  ctx?: ExecutionContext
): Promise<ServiceResponse<UploadResponse>> => {
  try {
    console.log('Starting file upload for user:', userId);
    console.log('File details:', { name: file.name, size: file.size, type: file.type });

    // Validate file
    const validation = validateFile(file);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
        code: 400,
      };
    }

    const db = drizzle(env.DB);
    const fileId = nanoid();
    console.log('Generated file ID:', fileId);

    // Store in R2
    console.log('Storing file in R2...');
    const { r2Key, arrayBuffer } = await storeFileInR2(env, fileId, file);
    console.log('File stored in R2 with key:', r2Key);

    // Save metadata to D1
    console.log('Saving metadata to D1...');
    const [newFile] = await db.insert(files).values({
      id: fileId,
      ownerId: userId,
      name: file.name,
      r2Key,
      sizeBytes: file.size,
      mime: file.type,
      status: 'pending',
    }).returning();
    console.log('Metadata saved:', newFile);

    // Process based on size
    if (file.size < 1_000_000) {
      // Small files: Process immediately
      if (ctx?.waitUntil) {
        ctx.waitUntil(processInBackground(env, fileId, arrayBuffer, file.type));
      }

      return {
        success: true,
        data: {
          file: { ...newFile, status: 'processing' },
          mode: 'immediate',
        },
      };
    }

    // Large files: Queue to QStash
    const queued = await queueToQStash(env, {
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

    // Fallback: Mark for cron processing
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
    console.error('Error details:', errorMessage);
    return {
      success: false,
      error: `Failed to upload file: ${errorMessage}`,
      code: 500,
    };
  }
};

// Process file
export const processFile = async (
  env: AppEnv,
  input: {
    fileId: string;
    r2Key: string;
    mimeType: string;
  }
): Promise<ServiceResponse<ProcessResponse>> => {
  const db = drizzle(env.DB);

  try {
    const { fileId, r2Key, mimeType } = input;

    // Check if file exists
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

    // Update status to processing
    await db.update(files)
      .set({ status: 'processing', updatedAt: new Date().toISOString() })
      .where(eq(files.id, fileId));

    // Get file from R2
    const r2Object = await env.FILES.get(r2Key);
    if (!r2Object) {
      throw new Error(`File not found in R2: ${r2Key}`);
    }

    const content = await r2Object.arrayBuffer();

    // Parse the file
    const parsed = await parseFile(content, mimeType);

    // Store parsed content
    await storeParsedContent(env, fileId, parsed);

    // Update file status
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

    // Update status to error
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
};

// Get file status
export const getFileStatus = async (
  env: AppEnv,
  fileId: string
): Promise<ServiceResponse<StatusResponse>> => {
  const db = drizzle(env.DB);

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

    // Calculate progress
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

    // Check if parsed content exists
    let hasContent = false;
    if (file.status === 'completed') {
      const parsedObject = await env.FILES.head(`parsed/${fileId}.json`);
      hasContent = !!parsedObject;
    }

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
};

// Get file with content
export const getFileWithContent = async (
  env: AppEnv,
  fileId: string
): Promise<ServiceResponse<FileWithContentResponse>> => {
  const db = drizzle(env.DB);

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
      const parsedObject = await env.FILES.get(`parsed/${fileId}.json`);
      if (parsedObject) {
        const content = await parsedObject.json() as {
          text: string;
          pageCount: number;
          metadata?: Record<string, unknown>;
          fileId: string;
          parsedAt: string;
        };
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
};

// Delete file
export const deleteFile = async (
  env: AppEnv,
  fileId: string
): Promise<ServiceResponse<{ message: string }>> => {
  const db = drizzle(env.DB);

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

    // Delete from R2
    await env.FILES.delete(file.r2Key);
    await env.FILES.delete(`parsed/${fileId}.json`);

    // Delete from D1
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
};

// Process pending files for cron
export const processPendingFiles = async (
  env: AppEnv
): Promise<ServiceResponse<CronJobResponse>> => {
  const db = drizzle(env.DB);

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
};