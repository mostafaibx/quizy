import type { AIQuestion } from './ai.types';

export interface QuizMetadata {
  title?: string;
  description?: string;
  subject?: string;
  grade?: string;
  fromPage: number;
  toPage: number;
  questionCount: number;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  generatedAt: string;
}

export interface QuizConfig {
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionTypes: Array<'multiple-choice' | 'true-false' | 'short-answer'>;
  language: string;
  includeExplanations: boolean;
}

export interface QuizDocument {
  id: string;
  userId: string;
  fileId: string;
  status: 'generating' | 'ready' | 'failed';
  metadata: QuizMetadata;
  config: QuizConfig;
  questions: AIQuestion[];
  createdAt: string;
  updatedAt: string;
}

export type QuizUpdateData = Partial<Omit<QuizDocument, 'id' | 'userId' | 'fileId' | 'createdAt'>>;

export interface FirestoreConfig {
  projectId: string;
  apiKey: string;
}