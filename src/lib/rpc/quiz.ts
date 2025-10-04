import type { QuizDocument } from '@/types/quiz.types';
import type { AIQuestion } from '@/types/ai.types';

interface GenerateQuizRequest {
  fileId: string;
  fromPage?: number;
  toPage?: number;
  config?: {
    numQuestions?: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
    questionTypes?: Array<'multiple-choice' | 'true-false' | 'short-answer'>;
    language?: string;
    includeExplanations?: boolean;
  };
}

interface GenerateQuizResponse {
  success: boolean;
  jobId: string;
  message: string;
}

export interface QuizJobStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string | null;
  metadata?: {
    quizId?: string;
    provider?: string;
    tokensUsed?: number;
    cost?: number;
  };
  createdAt: string;
  completedAt?: string;
}

interface QuizResponse {
  success: boolean;
  data: QuizDocument;
}

interface QuizListResponse {
  success: boolean;
  data: QuizDocument[];
}

export const quizRpc = {
  // Generate a new quiz
  async generateQuiz(request: GenerateQuizRequest): Promise<GenerateQuizResponse> {
    const response = await fetch('/api/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Failed to generate quiz' } }));
      throw new Error((errorData as { error?: { message?: string } }).error?.message || 'Failed to generate quiz');
    }

    return response.json();
  },

  // Check job status
  async getJobStatus(jobId: string): Promise<{ success: boolean; data: QuizJobStatus }> {
    const response = await fetch(`/api/quiz/status/${jobId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch job status');
    }

    return response.json();
  },

  // Get quiz by ID
  async getQuiz(quizId: string): Promise<QuizResponse> {
    const response = await fetch(`/api/quiz/${quizId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch quiz');
    }

    return response.json();
  },

  // List quizzes for a file
  async listFileQuizzes(fileId: string): Promise<QuizListResponse> {
    const response = await fetch(`/api/quiz/file/${fileId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch quizzes');
    }

    return response.json();
  },

  // Update quiz
  async updateQuiz(quizId: string, updates: Partial<QuizDocument>): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/quiz/${quizId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update quiz');
    }

    return response.json();
  },

  // Update question
  async updateQuestion(
    quizId: string,
    questionIndex: number,
    updates: Partial<AIQuestion>
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/quiz/${quizId}/questions/${questionIndex}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update question');
    }

    return response.json();
  },

  // Add question
  async addQuestion(quizId: string, question: Omit<AIQuestion, 'id'>): Promise<{ success: boolean; message: string; questionId: string }> {
    const response = await fetch(`/api/quiz/${quizId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(question),
    });

    if (!response.ok) {
      throw new Error('Failed to add question');
    }

    return response.json();
  },

  // Delete question
  async deleteQuestion(quizId: string, questionIndex: number): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/quiz/${quizId}/questions/${questionIndex}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete question');
    }

    return response.json();
  },

  // Reorder questions
  async reorderQuestions(quizId: string, newOrder: number[]): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`/api/quiz/${quizId}/questions/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newOrder }),
    });

    if (!response.ok) {
      throw new Error('Failed to reorder questions');
    }

    return response.json();
  },
};