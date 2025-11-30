// Supported languages
export type Language = 'en' | 'ar' | 'de' | 'fr' | 'es' | 'it';

// Supported subjects
export type Subject = 
  | 'science' | 'biology' | 'chemistry' | 'physics' | 'earth_science'
  | 'math' | 'algebra' | 'geometry' | 'calculus' | 'statistics'
  | 'english' | 'arabic' | 'german' | 'french' | 'spanish'
  | 'history' | 'geography' | 'civics' | 'economics' | 'philosophy' | 'psychology'
  | 'computer_science' | 'engineering' | 'health' | 'business'
  | 'general';

// Supported document types
export type DocumentType = 'explanation' | 'exercises' | 'mixed';

// Type guards for runtime validation
export const LANGUAGES: Language[] = ['en', 'ar', 'de', 'fr', 'es', 'it'];

export const SUBJECTS: Subject[] = [
  'science', 'biology', 'chemistry', 'physics', 'earth_science',
  'math', 'algebra', 'geometry', 'calculus', 'statistics',
  'english', 'arabic', 'german', 'french', 'spanish',
  'history', 'geography', 'civics', 'economics', 'philosophy', 'psychology',
  'computer_science', 'engineering', 'health', 'business',
  'general'
];

export const DOCUMENT_TYPES: DocumentType[] = ['explanation', 'exercises', 'mixed'];

export function isLanguage(value: string): value is Language {
  return LANGUAGES.includes(value as Language);
}

export function isSubject(value: string): value is Subject {
  return SUBJECTS.includes(value as Subject);
}

export function isDocumentType(value: string): value is DocumentType {
  return DOCUMENT_TYPES.includes(value as DocumentType);
}

export interface ParsingServiceRequest {
  file_id: string;
  file_url: string;
  mime_type: string;
  language: Language;        // REQUIRED
  subject: Subject;          // REQUIRED
  document_type: DocumentType; // REQUIRED
  user_id?: string;          // Optional (not in API spec)
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
  language: Language;        // REQUIRED
  subject: Subject;          // REQUIRED
  documentType: DocumentType; // REQUIRED
  fileSizeBytes: number;     // For routing decision
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