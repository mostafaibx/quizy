export interface ParsingServiceRequest {
  file_id: string;
  file_url: string;
  mime_type: string;
  user_id: string;
  options?: {
    extract_images?: boolean;
    extract_tables?: boolean;
    extract_metadata?: boolean;
    ocr_enabled?: boolean;
    ai_description_enabled?: boolean;
    max_pages?: number;
  };
}

export interface ParsingServiceResponse {
  success: boolean;
  file_id: string;
  data?: {
    text: string;
    pageCount: number;
    pages?: Array<{
      pageNumber: number;
      content: string;
    }>;
    metadata?: {
      title?: string;
      subject?: string;
      wordCount?: number;
      language?: string;
      grade?: string;
    };
  };
  r2_key?: string;
  processing_metrics?: {
    duration_ms: number;
    pages_processed: number;
    images_extracted?: number;
    tables_extracted?: number;
    memory_used_mb?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
    retry_able: boolean;
  };
}

export interface ParsingQStashBody {
  fileId: string;
  userId: string;
  r2Key: string;
  mimeType: string;
  jobId: string;
  retryCount?: number;
  parserServiceUrl?: string;
}

export interface ParsingCallbackBody {
  success: boolean;
  file_id: string;
  job_id: string;
  data?: {
    text: string;
    pageCount: number;
    pages?: Array<{
      pageNumber: number;
      content: string;
    }>;
    metadata?: {
      title?: string;
      subject?: string;
      wordCount?: number;
      language?: string;
      grade?: string;
    };
  };
  r2_key?: string;
  processing_metrics?: {
    duration_ms: number;
    pages_processed: number;
    images_extracted?: number;
    tables_extracted?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

export type ParsingJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ParsingJobStatusResponse {
  id: string;
  fileId: string;
  status: ParsingJobStatus;
  progress: number;
  message: string;
  error?: string;
  processingMetrics?: {
    duration_ms?: number;
    pages_processed?: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

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