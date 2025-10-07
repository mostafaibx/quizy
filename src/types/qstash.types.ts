// QStash request body types
export interface QuizGenerationQStashBody {
  fileId: string;
  userId: string;
  jobId: string;
  retryCount?: number;
}

import type { ParsedContent } from './file.types';

export interface ProcessedFileContent extends ParsedContent {
  fileId: string;
  parsedAt: string;
  version: string;
}

// QStash message status response from /v2/messages/{messageId}
export interface QStashMessageStatusResponse {
  messageId: string;
  state: 'pending' | 'delivered' | 'failed' | 'retry';
  retryCount: number;
  createdAt: number;
  updatedAt: number;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  maxRetries?: number;
  notBefore?: number;
  callback?: string;
  failureCallback?: string;
}