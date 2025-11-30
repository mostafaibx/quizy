export interface QuizGenerationRequest {
  content: {
    text: string;
    metadata?: {
      title?: string;
      subject?: string;
      grade?: string;
      language: string;
    };
  };
  config: QuizConfig;
}

export interface QuizGenerationResponse {
  questions: AIQuestion[];
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    processingTimeMs: number;
    cost: number;
    timestamp: number;
  };
}

export interface QuizConfig {
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionTypes: Array<'multiple-choice' | 'true-false' | 'short-answer'>;
  language: string;
  includeExplanations: boolean;
}

export interface AIQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;
}

export interface GeneratedQuiz {
  id: string;
  questions: AIQuestion[];
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    processingTimeMs: number;
    cost: number;
    timestamp: number;
  };
}

export interface AIProvider {
  name: string;
  generateQuiz: (request: QuizGenerationRequest, apiKey: string) => Promise<GeneratedQuiz>;
  validateResponse: (response: QuizGenerationResponse) => boolean;
  calculateCost: (tokens: number) => number;
}