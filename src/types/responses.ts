import type { File } from '@/db/schema';

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

export interface ListFilesResponse {
  files: Array<{
    id: string;
    name: string;
    status: string;
    mime: string;
    sizeBytes: number;
    pageCount: number | null;
    createdAt: string;
    updatedAt: string;
    hasContent: boolean;
  }>;
  total: number;
}