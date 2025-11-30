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

  // Log content info for debugging
  console.log('[Gemini Provider] Content info:', {
    textLength: content.text?.length || 0,
    hasText: !!content.text,
    first100Chars: content.text?.substring(0, 100),
    metadata: content.metadata
  });

  if (!content.text || content.text.trim().length < 50) {
    throw new Error(`Insufficient content for quiz generation. Content length: ${content.text?.length || 0}`);
  }

  // Build context section with available metadata
  const contextParts: string[] = [];
  if (content.metadata?.title) {
    contextParts.push(`- Document Title: ${content.metadata.title}`);
  }
  if (content.metadata?.subject) {
    contextParts.push(`- Subject: ${content.metadata.subject}`);
  }
  if (content.metadata?.grade) {
    contextParts.push(`- Education Level: ${content.metadata.grade}`);
  }
  
  const contextSection = contextParts.length > 0 
    ? `\nDOCUMENT CONTEXT:\n${contextParts.join('\n')}\n` 
    : '';

  // Difficulty guidance
  const difficultyGuidance = config.difficulty === 'mixed' 
    ? `- Mix question difficulties (easy, medium, hard) to assess different cognitive levels
- Easy: Test basic recall and comprehension
- Medium: Test application and analysis  
- Hard: Test synthesis and evaluation`
    : `- All questions should be ${config.difficulty} difficulty
- ${config.difficulty === 'easy' ? 'Focus on recall and basic comprehension' : config.difficulty === 'medium' ? 'Focus on application and analysis' : 'Focus on critical thinking and synthesis'}`;

  return `You are an expert educational assessment designer specializing in creating high-quality quiz questions for students.
${contextSection}
SOURCE CONTENT:
${content.text}

===== TASK =====
Create ${config.numQuestions} educational quiz questions in ${config.language} that assess student understanding of the content above.

===== REQUIREMENTS =====
- Question Types: ${config.questionTypes.join(', ')}
- Number of Questions: ${config.numQuestions}
${difficultyGuidance}
- Language: Generate ALL content (questions, options, explanations) in ${config.language}${content.metadata?.grade ? `\n- Target Audience: ${content.metadata.grade} students - use appropriate vocabulary and complexity` : ''}
- Explanations: ${config.includeExplanations ? 'Include clear, educational explanations that teach the concept' : 'Brief explanations only'}

===== PEDAGOGICAL GUIDELINES =====
1. **Question Quality:**
   - Base questions ONLY on information explicitly present in the content
   - Test understanding and application, not just memorization
   - Use clear, unambiguous language appropriate for the education level
   - Avoid trick questions or overly complex wording

2. **For Multiple Choice Questions:**
   - Provide exactly 4 options (A, B, C, D)
   - Make the correct answer clearly right for someone who understands the material
   - Make wrong options (distractors) plausible but clearly incorrect
   - Avoid "all of the above" or "none of the above" options
   - Ensure distractors represent common misconceptions or errors
   - correctAnswer must be the index (0, 1, 2, or 3)

3. **For True/False Questions:**
   - Make statements that are definitively true or false based on the content
   - Avoid absolutes like "always" or "never" unless explicitly in the content
   - Test important concepts, not trivial details
   - correctAnswer must be the string "true" or "false" (NOT boolean)

4. **For Short Answer Questions:**
   - Ask questions that have one clear, concise answer
   - Provide the most complete acceptable answer as correctAnswer
   - Focus on key terms, definitions, or brief explanations
   - correctAnswer must be a string

5. **Explanations:**
   - Explain WHY the answer is correct with reference to the content
   - For multiple choice, briefly explain why wrong options are incorrect
   - Use the explanation as a teaching moment
   - Keep explanations clear and concise

6. **Topic Tagging:**
   - Extract a specific topic/concept name for each question
   - Use clear, descriptive topic labels from the content

===== OUTPUT FORMAT =====
Return ONLY valid JSON (no markdown, no code blocks) in this exact structure:
{
  "questions": [
    {
      "type": "multiple-choice",
      "question": "What is...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 2,
      "explanation": "The correct answer is C because... Option A is wrong because...",
      "difficulty": "medium",
      "topic": "Specific Topic Name"
    }
  ]
}

Generate ${config.numQuestions} questions now:`;
};

export const geminiProvider: AIProvider = {
  name: 'gemini',

  async generateQuiz(request: QuizGenerationRequest, apiKey: string): Promise<GeneratedQuiz> {
    const startTime = Date.now();
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      systemInstruction: "You are an expert educational assessment designer with extensive experience in creating pedagogically sound quiz questions for students at all levels. Your questions are clear, fair, test genuine understanding, and align with learning objectives. You create engaging assessments that help students learn.",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.8, // Slightly higher for more creative question variation
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192, // Ensure enough tokens for detailed explanations
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
        model: 'gemini-1.5-flash',
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
    // Gemini 1.5 Flash pricing (as of 2024):
    // Input: $0.075 per 1M tokens (up to 128K context)
    // For prompts > 128K tokens: $0.15 per 1M tokens
    // Using base rate for simplicity
    return (tokens / 1_000_000) * 0.075;
  }
};