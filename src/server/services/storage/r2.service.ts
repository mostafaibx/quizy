
import type { AppEnv } from '@/types/cloudflare';
import type { FileStorageResult, FileMetadata, ParsedContentStorage } from '@/types/file.types';
import { Errors } from '@/server/services/error-handler';
import { assert } from '@/server/services/validation.service';

export async function storeFile(
  env: AppEnv,
  fileId: string,
  file: File
): Promise<FileStorageResult> {
  if (!env.FILES) {
    throw Errors.internal('R2 bucket (FILES) is not configured');
  }

  assert.exists(fileId, 'File ID is required');
  assert.exists(file, 'File is required');
  assert.notEmpty(file.name, 'File name cannot be empty');

  const r2Key = `uploads/${fileId}-${file.name}`;

  try {
    const arrayBuffer = await file.arrayBuffer();

    await env.FILES.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalName: file.name,
      } satisfies FileMetadata,
    });

    return { r2Key, arrayBuffer };
  } catch (error) {
    throw Errors.storage(
      'Failed to store file in R2',
      {
        fileId,
        fileName: file.name,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

export async function getFile(
  env: AppEnv,
  r2Key: string
): Promise<ArrayBuffer | null> {
  if (!env.FILES) {
    throw Errors.internal('R2 bucket (FILES) is not configured');
  }

  assert.exists(r2Key, 'R2 key is required');
  assert.notEmpty(r2Key, 'R2 key cannot be empty');

  try {
    const object = await env.FILES.get(r2Key);
    if (!object) return null;
    return object.arrayBuffer();
  } catch (error) {
    throw Errors.storage(
      'Failed to retrieve file from R2',
      {
        r2Key,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

export async function deleteFile(
  env: AppEnv,
  r2Key: string
): Promise<void> {
  if (!env.FILES) {
    throw Errors.internal('R2 bucket (FILES) is not configured');
  }

  assert.exists(r2Key, 'R2 key is required');
  assert.notEmpty(r2Key, 'R2 key cannot be empty');

  try {
    await env.FILES.delete(r2Key);
  } catch (error) {
    throw Errors.storage(
      'Failed to delete file from R2',
      {
        r2Key,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

export async function storeParsedContent(
  env: AppEnv,
  fileId: string,
  content: ParsedContentStorage
): Promise<void> {
  if (!env.FILES) {
    throw Errors.internal('R2 bucket (FILES) is not configured');
  }

  assert.exists(fileId, 'File ID is required');
  assert.exists(content, 'Content is required');

  const key = `parsed/${fileId}.json`;

  try {
    await env.FILES.put(
      key,
      JSON.stringify(content),
      {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: { originalFileId: fileId },
      }
    );
  } catch (error) {
    throw Errors.storage(
      'Failed to store parsed content in R2',
      {
        fileId,
        key,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

export async function getParsedContent(
  env: AppEnv,
  fileId: string
): Promise<ParsedContentStorage | null> {
  if (!env.FILES) {
    throw Errors.internal('R2 bucket (FILES) is not configured');
  }

  assert.exists(fileId, 'File ID is required');

  const key = `parsed/${fileId}.json`;

  try {
    const object = await env.FILES.get(key);
    if (!object) return null;
    return object.json() as Promise<ParsedContentStorage>;
  } catch (error) {
    throw Errors.storage(
      'Failed to retrieve parsed content from R2',
      {
        fileId,
        key,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

export async function deleteParsedContent(
  env: AppEnv,
  fileId: string
): Promise<void> {
  if (!env.FILES) {
    throw Errors.internal('R2 bucket (FILES) is not configured');
  }

  assert.exists(fileId, 'File ID is required');

  try {
    await env.FILES.delete(`parsed/${fileId}.json`);
  } catch (error) {
    throw Errors.storage(
      'Failed to delete parsed content from R2',
      {
        fileId,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

export async function checkContentExists(
  env: AppEnv,
  fileId: string
): Promise<boolean> {
  if (!env.FILES) {
    throw Errors.internal('R2 bucket (FILES) is not configured');
  }

  assert.exists(fileId, 'File ID is required');

  try {
    const object = await env.FILES.head(`parsed/${fileId}.json`);
    return !!object;
  } catch (error) {
    // Head operation failures are treated as non-existent
    return false;
  }
}