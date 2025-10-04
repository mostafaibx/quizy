'use client';

import { useState, useEffect, useCallback } from 'react';
import { quizRpc } from '@/lib/rpc/quiz';
import type { QuizDocument } from '@/types/quiz.types';
import type { AIQuestion } from '@/types/ai.types';
import type { QuizJobStatus } from '@/lib/rpc/quiz';

interface UseQuizOptions {
  quizId?: string;
  fileId?: string;
  autoFetch?: boolean;
}

export function useQuiz({ quizId, fileId, autoFetch = true }: UseQuizOptions = {}) {
  const [quiz, setQuiz] = useState<QuizDocument | null>(null);
  const [quizzes, setQuizzes] = useState<QuizDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch single quiz
  const fetchQuiz = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await quizRpc.getQuiz(id);
      if (response.success) {
        setQuiz(response.data);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch quiz');
      setError(error);
      console.error('Error fetching quiz:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch quizzes for a file
  const fetchFileQuizzes = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await quizRpc.listFileQuizzes(id);
      if (response.success) {
        setQuizzes(response.data);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch quizzes');
      setError(error);
      console.error('Error fetching quizzes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update quiz
  const updateQuiz = useCallback(async (id: string, updates: Partial<QuizDocument>) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await quizRpc.updateQuiz(id, updates);
      if (response.success) {
        // Refresh quiz data
        await fetchQuiz(id);
      }
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update quiz');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchQuiz]);

  // Update question
  const updateQuestion = useCallback(async (
    quizId: string,
    questionIndex: number,
    updates: Partial<AIQuestion>
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await quizRpc.updateQuestion(quizId, questionIndex, updates);
      if (response.success) {
        // Refresh quiz data
        await fetchQuiz(quizId);
      }
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update question');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchQuiz]);

  // Add question
  const addQuestion = useCallback(async (quizId: string, question: Omit<AIQuestion, 'id'>) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await quizRpc.addQuestion(quizId, question);
      if (response.success) {
        // Refresh quiz data
        await fetchQuiz(quizId);
      }
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add question');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchQuiz]);

  // Delete question
  const deleteQuestion = useCallback(async (quizId: string, questionIndex: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await quizRpc.deleteQuestion(quizId, questionIndex);
      if (response.success) {
        // Refresh quiz data
        await fetchQuiz(quizId);
      }
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete question');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchQuiz]);

  // Reorder questions
  const reorderQuestions = useCallback(async (quizId: string, newOrder: number[]) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await quizRpc.reorderQuestions(quizId, newOrder);
      if (response.success) {
        // Refresh quiz data
        await fetchQuiz(quizId);
      }
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reorder questions');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchQuiz]);

  // Auto-fetch on mount
  useEffect(() => {
    if (!autoFetch) return;

    if (quizId) {
      fetchQuiz(quizId);
    } else if (fileId) {
      fetchFileQuizzes(fileId);
    }
  }, [quizId, fileId, autoFetch, fetchQuiz, fetchFileQuizzes]);

  return {
    quiz,
    quizzes,
    isLoading,
    error,
    fetchQuiz,
    fetchFileQuizzes,
    updateQuiz,
    updateQuestion,
    addQuestion,
    deleteQuestion,
    reorderQuestions,
  };
}

// Hook for quiz generation job status
export function useQuizJob(jobId: string | null) {
  const [status, setStatus] = useState<string>('idle');
  const [jobData, setJobData] = useState<QuizJobStatus | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const checkStatus = useCallback(async (id: string) => {
    try {
      const response = await quizRpc.getJobStatus(id);
      if (response.success) {
        setStatus(response.data.status);
        setJobData(response.data);
        return response.data;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to check job status');
      setError(error);
      throw error;
    }
  }, []);

  const startPolling = useCallback((id: string, onComplete?: (data: QuizJobStatus) => void) => {
    if (isPolling) return;

    setIsPolling(true);
    setError(null);

    const pollInterval = setInterval(async () => {
      try {
        const data = await checkStatus(id);

        if (data?.status === 'completed') {
          clearInterval(pollInterval);
          setIsPolling(false);
          if (onComplete) {
            onComplete(data);
          }
        } else if (data?.status === 'failed') {
          clearInterval(pollInterval);
          setIsPolling(false);
          setError(new Error(data.error || 'Job failed'));
        }
      } catch (err) {
        clearInterval(pollInterval);
        setIsPolling(false);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      if (isPolling) {
        clearInterval(pollInterval);
        setIsPolling(false);
        setError(new Error('Job timed out'));
      }
    }, 5 * 60 * 1000);
  }, [isPolling, checkStatus]);

  useEffect(() => {
    if (jobId) {
      checkStatus(jobId);
    }
  }, [jobId, checkStatus]);

  return {
    status,
    jobData,
    error,
    isPolling,
    checkStatus,
    startPolling,
  };
}