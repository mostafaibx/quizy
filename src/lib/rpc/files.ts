import { hc } from 'hono/client';
import type { AppType } from '@/server/hono';
import type { File as DBFile } from '@/db/schema';

// RPC client initialization
const client = hc<AppType>(
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
);

// Types
export interface FileUploadResponse {
  file: DBFile & { status: string };
  mode: 'immediate' | 'queued' | 'scheduled';
  message?: string;
}

export interface FileStatusResponse {
  id: string;
  name: string;
  status: string;
  progress: number;
  message: string;
  pageCount?: number;
  sizeBytes: number;
  hasContent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedContent {
  text: string;
  pageCount: number;
  metadata?: Record<string, unknown>;
  fileId: string;
  parsedAt: string;
}

export interface FileWithContent {
  file: {
    id: string;
    name: string;
    status: string;
    mimeType: string;
    sizeBytes: number;
    pageCount?: number;
    createdAt: string;
    updatedAt: string;
    message?: string;
  };
  content?: ParsedContent;
}

/**
 * Upload a file for processing
 *
 * @param file The file to upload
 * @param userId Optional user ID (will use 'anonymous' if not provided)
 * @throws Error if the upload fails
 */
async function uploadFile(
  file: File,
  userId?: string
): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (userId) {
    headers['x-user-id'] = userId;
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/files/upload`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload file – ${res.status}: ${text}`);
  }

  const json = await res.json() as { data: FileUploadResponse };
  return json.data as FileUploadResponse;
}

/**
 * Get file by ID with parsed content
 *
 * @param id The file ID
 * @throws Error if the request fails
 */
async function getFileById(id: string): Promise<FileWithContent> {
  const res = await client.api.files[':id'].$get({
    param: { id },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch file ${id} – ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json.data as FileWithContent;
}

/**
 * Get file processing status
 *
 * @param id The file ID
 * @throws Error if the request fails
 */
async function getFileStatus(id: string): Promise<FileStatusResponse> {
  const res = await client.api.files[':id'].status.$get({
    param: { id },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch file status ${id} – ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json.data as FileStatusResponse;
}

/**
 * Delete a file
 *
 * @param id The file ID to delete
 * @throws Error if the request fails
 */
async function deleteFile(id: string): Promise<{ message: string }> {
  const res = await client.api.files[':id'].$delete({
    param: { id },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete file ${id} – ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json.data as { message: string };
}

/**
 * Poll file status until completed or error
 *
 * @param id The file ID
 * @param options Polling options
 * @returns Final file status
 */
async function pollFileStatus(
  id: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    onProgress?: (status: FileStatusResponse) => void;
  } = {}
): Promise<FileStatusResponse> {
  const { maxAttempts = 60, intervalMs = 2000, onProgress } = options;

  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getFileStatus(id);

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === 'completed' || status.status === 'error') {
      return status;
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Polling timeout for file ${id}`);
}

/**
 * Upload a file and wait for processing to complete
 *
 * @param file The file to upload
 * @param options Upload and polling options
 * @returns The processed file with content
 */
async function uploadAndWait(
  file: File,
  options: {
    userId?: string;
    onProgress?: (status: FileStatusResponse) => void;
    maxAttempts?: number;
    intervalMs?: number;
  } = {}
): Promise<FileWithContent> {
  const { userId, ...pollOptions } = options;

  // Upload the file
  const uploadResult = await uploadFile(file, userId);

  // Poll for completion
  const finalStatus = await pollFileStatus(uploadResult.file.id, pollOptions);

  if (finalStatus.status === 'error') {
    throw new Error(`File processing failed: ${finalStatus.message}`);
  }

  // Get the file with content
  return getFileById(uploadResult.file.id);
}

// Export RPC client
export const fileRpc = {
  uploadFile,
  getFileById,
  getFileStatus,
  deleteFile,
  pollFileStatus,
  uploadAndWait,
};