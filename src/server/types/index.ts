import { z } from 'zod';
import type { File } from '@/db/schema';

export interface AppEnv {
  DB: D1Database;
  FILES: R2Bucket;
  QSTASH_URL?: string;
  QSTASH_TOKEN?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
}

export interface AppContext {
  env: AppEnv;
  ctx?: ExecutionContext;
}

export const FileUploadSchema = z.object({
  file: z.instanceof(File),
  userId: z.string().optional().default('anonymous'),
});

export const ProcessFileSchema = z.object({
  fileId: z.string(),
  r2Key: z.string(),
  mimeType: z.string(),
  userId: z.string(),
});

export const FileStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'error']),
  pageCount: z.number().nullable(),
  sizeBytes: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type FileUploadInput = z.infer<typeof FileUploadSchema>;
export type ProcessFileInput = z.infer<typeof ProcessFileSchema>;
export type FileStatus = z.infer<typeof FileStatusSchema>;

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

export interface UploadResponse {
  file: File;
  mode: 'immediate' | 'queued' | 'scheduled';
  message?: string;
}

export interface ProcessResponse {
  fileId: string;
  pageCount?: number;
}

export interface StatusResponse {
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

export interface FileWithContentResponse {
  file: {
    id: string;
    name: string;
    status: string;
    mimeType: string;
    sizeBytes: number;
    pageCount?: number | null;
    createdAt: string;
    updatedAt: string;
    message?: string;
  };
  content?: {
    text: string;
    pageCount: number;
    metadata?: Record<string, unknown>;
    fileId: string;
    parsedAt: string;
  };
}

export interface CronJobResponse {
  processed: number;
  results: Array<{
    fileId: string;
    status: 'success' | 'error';
    error?: string;
  }>;
  timestamp: string;
}