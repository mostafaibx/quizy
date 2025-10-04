// QStash request body types
export interface QuizGenerationQStashBody {
  fileId: string;
  userId: string;
  jobId: string;
  retryCount?: number;
}

export interface ProcessedFileContent {
  text?: string;
  content?: string;
  pageCount?: number;
  metadata?: {
    subject?: string;
    grade?: string;
    language?: string;
    pageCount?: number;
    title?: string;
  };
  pages?: Array<{
    pageNumber: number;
    content: string;
  }>;
}