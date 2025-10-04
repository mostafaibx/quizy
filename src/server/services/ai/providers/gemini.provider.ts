import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import type { AIProvider, QuizGenerationRequest, GeneratedQuiz, QuizGenerationResponse } from '@/types/ai.types';

const QuizResponseSchema = z.object({
  questions: z.array(z.object({
    type: z.enum(['multiple-choice', 'true-false', 'short-answer']),
    question: z.string(),
    options: z.array(z.string()).optional(),
    correctAnswer: z.union([z.string(), z.number()]),
    explanation: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    topic: z.string().optional()
  }))
});

const buildPrompt = (request: QuizGenerationRequest): string => {
  const { content, config } = request;

  return `You are an expert educational content creator. Generate a quiz based on the following content.

CONTENT:
${content.text}

REQUIREMENTS:
- Generate exactly ${config.numQuestions} questions
- Difficulty: ${config.difficulty}
- Question types: ${config.questionTypes.join(', ')}
- Language: ${config.language}
- Include explanations: ${config.includeExplanations}

RULES:
1. Questions must be directly based on the provided content
2. For multiple-choice, provide exactly 4 options
3. Ensure one clear correct answer
4. correctAnswer for multiple-choice should be the index (0-3)
5. correctAnswer for true-false should be the string "true" or "false" (NOT boolean)
6. correctAnswer for short-answer should be a string
7. Return valid JSON matching this exact schema

OUTPUT FORMAT:
{
  "questions": [
    {
      "type": "multiple-choice",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "...",
      "difficulty": "medium",
      "topic": "..."
    },
    {
      "type": "true-false",
      "question": "...",
      "correctAnswer": "true",
      "explanation": "...",
      "difficulty": "medium",
      "topic": "..."
    }
  ]
}`;
};

export const geminiProvider: AIProvider = {
  name: 'gemini',

  async generateQuiz(request: QuizGenerationRequest, apiKey: string): Promise<GeneratedQuiz> {
    const startTime = Date.now();
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      }
    });

    const prompt = buildPrompt(request);
    const result = await model.generateContent(prompt);
    const response = result.response;

    const text = response.text();
    const parsed = JSON.parse(text);
    const validated = QuizResponseSchema.parse(parsed);

    const tokensUsed = (await model.countTokens(prompt)).totalTokens;
    const cost = this.calculateCost(tokensUsed);

    return {
      id: crypto.randomUUID(),
      questions: validated.questions.map(q => ({
        ...q,
        id: crypto.randomUUID()
      })),
      metadata: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        tokensUsed,
        processingTimeMs: Date.now() - startTime,
        cost,
        timestamp: Date.now()
      }
    };
  },

  validateResponse(response: QuizGenerationResponse): boolean {
    try {
      QuizResponseSchema.parse(response);
      return true;
    } catch {
      return false;
    }
  },

  calculateCost(tokens: number): number {
    // Gemini 2.5 Flash: $0.075 per 1M input tokens
    return (tokens / 1_000_000) * 0.075;
  }
};