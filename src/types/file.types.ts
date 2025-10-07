export interface FileValidationResult {
  success: boolean;
  error?: string;
  code?: number;
}

export interface ParsedContent {
  text: string;
  pageCount: number;
  pages?: Array<{
    pageNumber: number;
    content: string;
  }>;
  metadata?: {
    title?: string;
    subject?: string;
    grade?: string;
    language?: string;
    wordCount?: number;
    lineCount?: number;
    [key: string]: unknown;
  };
}

export interface FileStorageResult {
  r2Key: string;
  arrayBuffer: ArrayBuffer;
}

export interface FileMetadata {
  uploadedAt: string;
  originalName: string;
}

export interface ParsedContentStorage extends ParsedContent {
  fileId: string;
  parsedAt: string;
  version: string;
}

export const FILE_CONSTRAINTS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,
} as const;

export type AllowedFileType = typeof FILE_CONSTRAINTS.ALLOWED_TYPES[number];