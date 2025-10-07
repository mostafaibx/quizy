import { Hono } from 'hono';
import { verifyQStashSignature } from '../middleware/qstash-auth';
import { getProvider } from '../services/ai/provider-registry';
import { checkAllLimits } from '../services/rate-limiter';
import { createPipelineTracker } from '../services/monitoring';
import { createError, shouldRetry, handleProviderError } from '../services/error-handler';
import { drizzle } from 'drizzle-orm/d1';
import { generationJobs, quizzes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { HonoEnv } from '@/types/cloudflare';
import type { CloudflareBindings } from '@/types/cloudflare';
import type { QuizGenerationQStashBody, ProcessedFileContent } from '@/types/qstash.types';
import { Client } from '@upstash/qstash';

const router = new Hono<HonoEnv>();

router.post('/api/quiz/generate', verifyQStashSignature, async (c) => {
  // Type-safe extraction of QStash body
  const parsedBody = c.get('parsedBody');

  // Validate and type the parsed body
  if (!parsedBody || typeof parsedBody !== 'object') {
    throw createError('Invalid request body', 400, 'INVALID_INPUT');
  }

  const { fileId, userId, jobId, retryCount = 0 } = parsedBody as QuizGenerationQStashBody;

  // Validate required fields
  if (!fileId || !userId || !jobId) {
    throw createError('Missing required fields', 400, 'INVALID_INPUT');
  }

  const tracker = createPipelineTracker(
    c.env.ANALYTICS_ENGINE,
    c.env.NODE_ENV
  );

  tracker.info('Quiz generation started', { fileId, userId, jobId, retryCount });

  const db = drizzle(c.env.DB);

  try {
    // Update job status with proper timestamp
    const startedAt = new Date();
    await db.update(generationJobs)
      .set({
        status: 'processing',
        startedAt
      })
      .where(eq(generationJobs.id, jobId));

    // Rate limiting check
    if (c.env.KV) {
      const rateLimit = await checkAllLimits(
        c.env.KV,
        userId,
        'free', // TODO: Get user tier from DB
        'gemini-free'
      );

      if (!rateLimit.allowed) {
        if (retryCount < 3) {
          await scheduleRetry(
            c.env,
            { fileId, userId, jobId, retryCount },
            rateLimit.retryAfter || 60
          );
          return c.json({
            status: 'rate_limited',
            retryAfter: rateLimit.retryAfter
          });
        }
        throw createError('Rate limit exceeded', 429, 'RATE_LIMITED', true);
      }

      tracker.trackStep('rate_limit_passed', { remaining: rateLimit.remaining });
    }

    // Fetch content from R2
    const contentKey = `processed/${fileId}.json`;
    const contentObject = await c.env.FILES.get(contentKey);

    if (!contentObject) {
      throw createError(`Content not found: ${contentKey}`, 404, 'NOT_FOUND');
    }

    const content = await contentObject.json<ProcessedFileContent>();

    // Validate content structure
    if (!content.text || content.text.trim().length === 0) {
      throw createError('No text content found in processed file', 400, 'INVALID_INPUT');
    }

    const textContent = content.text;

    tracker.trackStep('content_fetched', {
      size: textContent.length,
      pageCount: content.pageCount,
      hasPages: !!content.pages?.length,
      wordCount: content.metadata?.wordCount
    });

    // Generate quiz with validated API key
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw createError('Gemini API key not configured', 500, 'INTERNAL_ERROR');
    }

    const provider = getProvider('gemini');
    const quiz = await provider.generateQuiz(
      {
        content: {
          text: textContent,
          metadata: {
            subject: content.metadata?.subject,
            grade: content.metadata?.grade,
            language: content.metadata?.language || 'en'
          }
        },
        config: {
          numQuestions: 10,
          difficulty: 'mixed',
          questionTypes: ['multiple-choice', 'true-false'],
          language: 'en',
          includeExplanations: true
        }
      },
      apiKey
    );

    tracker.trackStep('quiz_generated', {
      questions: quiz.questions.length,
      provider: quiz.metadata.provider
    });

    // Store quiz with proper typing
    const quizId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(quizzes).values({
      id: quizId,
      fileId,
      fromPage: 1,
      toPage: content.pageCount || 1,
      topic: content.metadata?.subject || null,
      model: quiz.metadata.model || 'gemini-2.5-flash',
      status: 'ready',
      createdBy: userId
    });

    // Store questions in R2 with metadata
    const quizMetadata: Record<string, string> = {
      userId,
      fileId,
      provider: quiz.metadata.provider,
      generatedAt: now
    };

    await c.env.FILES.put(
      `quizzes/${quizId}.json`,
      JSON.stringify(quiz.questions),
      {
        customMetadata: quizMetadata
      }
    );

    // Update job status with completion
    const completedAt = new Date();
    const jobMetadata = {
      quizId,
      provider: quiz.metadata.provider,
      tokensUsed: quiz.metadata.tokensUsed,
      cost: quiz.metadata.cost
    };

    await db.update(generationJobs)
      .set({
        status: 'completed',
        completedAt,
        metadata: JSON.stringify(jobMetadata)
      })
      .where(eq(generationJobs.id, jobId));

    // Track metrics
    tracker.trackMetrics({
      tokensUsed: quiz.metadata.tokensUsed,
      cost: quiz.metadata.cost,
      processingTimeMs: quiz.metadata.processingTimeMs,
      questionsGenerated: quiz.questions.length,
      provider: quiz.metadata.provider
    });

    tracker.complete(true, { quizId });

    return c.json({
      success: true,
      quizId,
      questionsGenerated: quiz.questions.length
    });

  } catch (error: unknown) {
    // Type-safe error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorObj = error instanceof Error ? error : new Error(errorMessage);

    tracker.error('Quiz generation failed', errorObj, { fileId, userId, retryCount });

    // Update job with error
    const failedAt = new Date();
    await db.update(generationJobs)
      .set({
        status: 'failed',
        error: errorMessage,
        completedAt: failedAt
      })
      .where(eq(generationJobs.id, jobId));

    // Retry if applicable
    if (shouldRetry(errorObj) && retryCount < 3) {
      await scheduleRetry(
        c.env,
        { fileId, userId, jobId, retryCount },
        60 * Math.pow(2, retryCount)
      );
      return c.json({ status: 'retrying', attempt: retryCount + 1 });
    }

    tracker.complete(false, { error: errorMessage });

    // Handle provider-specific errors
    if (errorMessage.includes('gemini') || errorMessage.includes('AI')) {
      throw handleProviderError(errorObj);
    }

    throw errorObj;
  }
});

// Helper to schedule retry with QStash - properly typed
async function scheduleRetry(
  env: CloudflareBindings,
  data: QuizGenerationQStashBody,
  delaySeconds: number
): Promise<void> {
  if (!env.QSTASH_TOKEN || !env.NEXT_PUBLIC_APP_URL) {
    console.warn('QStash not configured for retry');
    return;
  }

  const client = new Client({ token: env.QSTASH_TOKEN });

  const retryBody: QuizGenerationQStashBody = {
    ...data,
    retryCount: (data.retryCount || 0) + 1
  };

  await client.publishJSON({
    url: `${env.NEXT_PUBLIC_APP_URL}/api/quiz/generate`,
    body: retryBody,
    delay: delaySeconds
  });
}

export { router as quizGenerationRouter };