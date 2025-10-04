import { Hono } from 'hono';
import { verifyQStashSignature } from '../middleware/qstash-auth';
import { requireAuth } from '../middleware/auth';
import { getProvider } from '../services/ai/provider-registry';
import { checkAllLimits } from '../services/rate-limiter';
import { createPipelineTracker } from '../services/monitoring';
import { createError, shouldRetry, handleProviderError } from '../services/error-handler';
import { drizzle } from 'drizzle-orm/d1';
import { generationJobs, quizzes, files } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { HonoEnv } from '@/types/cloudflare';
import type { ProcessedFileContent } from '@/types/qstash.types';
import type { QuizConfig } from '@/types/ai.types';
import { Client } from '@upstash/qstash';
import { nanoid } from 'nanoid';
import { ApiErrors } from '../middleware/error';
import {
  saveQuizToFirestore,
  getQuizFromFirestore,
  updateQuizInFirestore,
  updateQuestionInFirestore,
  addQuestionToFirestore,
  deleteQuestionFromFirestore,
  reorderQuestionsInFirestore,
  listUserQuizzesFromFirestore,
  listFileQuizzesFromFirestore
} from '../services/firestore.service';
import { ParsedContentStorage } from '@/types/file.types';

interface QStashProcessBody {
  fileId: string;
  userId: string;
  jobId: string;
  fromPage?: number;
  toPage?: number;
  config?: Partial<QuizConfig>;
  retryCount?: number;
}

const app = new Hono<HonoEnv>()

// Manual trigger endpoint - called from UI
.post('/generate', requireAuth(), async (c) => {
  const user = c.get('user');
  const userId = user?.id;

  if (!userId) {
    throw ApiErrors.unauthorized('User not authenticated');
  }

  const { fileId, fromPage = 1, toPage, config } = await c.req.json();

  if (!fileId) {
    throw ApiErrors.badRequest('File ID is required');
  }

  const db = drizzle(c.env.DB);

  // Verify file exists and belongs to user
  const [file] = await db.select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw ApiErrors.notFound('File', fileId);
  }

  if (file.ownerId !== userId) {
    throw ApiErrors.forbidden('You do not have access to this file');
  }

  if (file.status !== 'completed') {
    throw ApiErrors.badRequest('File processing not completed');
  }

  // Create generation job
  const jobId = nanoid();
  await db.insert(generationJobs).values({
    id: jobId,
    fileId,
    userId,
    status: 'queued',
    retryCount: 0,
    metadata: JSON.stringify({ fromPage, toPage, config }),
    createdAt: new Date().toISOString()
  });

  // Queue with QStash if configured
  if (c.env.QSTASH_TOKEN) {
    const client = new Client({ token: c.env.QSTASH_TOKEN });

    const message = await client.publishJSON({
      url: `${c.env.NEXT_PUBLIC_APP_URL}/api/quiz/process`,
      body: {
        fileId,
        userId,
        jobId,
        fromPage,
        toPage,
        config: config || {},
        retryCount: 0
      },
      delay: 1
    });

    // Update job with QStash message ID
    await db.update(generationJobs)
      .set({ qstashMessageId: message.messageId })
      .where(eq(generationJobs.id, jobId));
  }

  return c.json({
    success: true,
    jobId,
    message: 'Quiz generation queued'
  });
})

// QStash webhook endpoint - processes the actual generation
.post('/process', verifyQStashSignature, async (c) => {
  const { fileId, userId, jobId, fromPage = 1, toPage, config = {}, retryCount = 0 } = c.get('parsedBody') as QStashProcessBody;

  const tracker = createPipelineTracker(
    c.env.ANALYTICS_ENGINE,
    c.env.NODE_ENV
  );

  tracker.info('Quiz generation started', { fileId, userId, jobId, retryCount });

  const db = drizzle(c.env.DB);

  try {
    // Update job status
    await db.update(generationJobs)
      .set({
        status: 'processing',
        startedAt: new Date()
      })
      .where(eq(generationJobs.id, jobId));

    // Get user tier for rate limiting
    // const [userRecord] = await db.select()
    //   .from(users)
    //   .where(eq(users.id, userId))
    //   .limit(1);

    const userTier = 'free'; // TODO: Get from subscription

    // Rate limiting
    if (c.env.KV) {
      const rateLimit = await checkAllLimits(
        c.env.KV,
        userId,
        userTier,
        'gemini-free'
      );

      if (!rateLimit.allowed) {
        if (retryCount < 3) {
          await scheduleRetry(c.env,
            { fileId, userId, jobId, fromPage, toPage, config, retryCount },
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

    // Fetch parsed content from R2
    const contentKey = `parsed/${fileId}.json`;
    const contentObject = await c.env.FILES.get(contentKey);

    if (!contentObject) {
      throw createError(`Content not found: ${contentKey}`, 404, 'NOT_FOUND');
    }

    const parsedContent = await contentObject.json<ParsedContentStorage>();
    tracker.trackStep('content_fetched', { pages: parsedContent.pageCount });

    // Extract content for specified pages
    let textContent = parsedContent.text;
    if (parsedContent.pageCount && fromPage && toPage) {
      textContent = Array.from({ length: parsedContent.pageCount }, (_, i) => i + 1)
        .filter((p) => p >= fromPage && p <= toPage)
        .map((p) => p.toString())
        .join('\n\n');
    }

    // Generate quiz using AI provider
    const provider = getProvider('gemini');
    const quizConfig = {
      numQuestions: config.numQuestions || 10,
      difficulty: config.difficulty || 'mixed',
      questionTypes: config.questionTypes || ['multiple-choice', 'true-false'],
      language: config.language || 'en',
      includeExplanations: config.includeExplanations !== false
    };

    const quiz = await provider.generateQuiz(
      {
        content: {
          text: textContent || '',
          metadata: {
            subject: parsedContent.metadata?.subject as string,
            grade: parsedContent.metadata?.grade as string,
            language: parsedContent.metadata?.language as string || 'en'
          }
        },
        config: quizConfig
      },
      c.env.GEMINI_API_KEY!
    );

    tracker.trackStep('quiz_generated', {
      questions: quiz.questions.length,
      provider: quiz.metadata.provider
    });

    // Store quiz metadata in D1 (for quick queries)
    const quizId = quiz.id;
    await db.insert(quizzes).values({
      id: quizId,
      fileId,
      fromPage,
      toPage: toPage || parsedContent.pageCount || 1,
      topic: parsedContent.metadata?.subject as string,
      model: quiz.metadata.model,
      status: 'ready',
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Store full quiz in Firestore (for editing and retrieval)
    const firestoreConfig = {
      projectId: c.env.FIREBASE_PROJECT_ID!,
      apiKey: c.env.FIREBASE_API_KEY!
    };

    await saveQuizToFirestore(
      firestoreConfig,
      quiz,
      userId,
      fileId,
      {
        fromPage,
        toPage: toPage || parsedContent.pageCount || 1,
        config: quizConfig
      }
    );

    // Update job status
    await db.update(generationJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        metadata: JSON.stringify({
          quizId,
          provider: quiz.metadata.provider,
          tokensUsed: quiz.metadata.tokensUsed,
          cost: quiz.metadata.cost,
          questionsGenerated: quiz.questions.length
        })
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

  } catch (error) {
    tracker.error('Quiz generation failed', error instanceof Error ? error : new Error(String(error)), { fileId, userId, retryCount });

    // Update job with error
    await db.update(generationJobs)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date()
      })
      .where(eq(generationJobs.id, jobId));

    // Retry if applicable
    if (shouldRetry(error instanceof Error ? error : new Error(String(error))) && retryCount < 3) {
      await scheduleRetry(c.env,
        { fileId, userId, jobId, fromPage, toPage, config, retryCount },
        60 * Math.pow(2, retryCount)
      );
      return c.json({ status: 'retrying', attempt: retryCount + 1 });
    }

    tracker.complete(false, { error: error instanceof Error ? error.message : String(error) });

    // Handle provider-specific errors
    if (error instanceof Error && (error.message?.includes('gemini') || error.message?.includes('AI'))) {
      throw handleProviderError(error);
    }

    throw error;
  }
})

// Get generation job status
.get('/status/:jobId', requireAuth(), async (c) => {
  const jobId = c.req.param('jobId');
  const db = drizzle(c.env.DB);

  const [job] = await db.select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw ApiErrors.notFound('Job', jobId);
  }

  // Parse metadata if exists
  let metadata = null;
  if (job.metadata) {
    try {
      metadata = JSON.parse(job.metadata);
    } catch {}
  }

  return c.json({
    success: true,
    data: {
      id: job.id,
      status: job.status,
      error: job.error,
      metadata,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    }
  });
})

// Get quiz by ID
.get('/:quizId', requireAuth(), async (c) => {
  const quizId = c.req.param('quizId');

  const firestoreConfig = {
    projectId: c.env.FIREBASE_PROJECT_ID!,
    apiKey: c.env.FIREBASE_API_KEY!
  };

  const quiz = await getQuizFromFirestore(firestoreConfig, quizId);

  if (!quiz) {
    throw ApiErrors.notFound('Quiz', quizId);
  }

  return c.json({
    success: true,
    data: quiz
  });
})

// List user's quizzes
.get('/user/:userId', requireAuth(), async (c) => {
  const userId = c.req.param('userId');
  const user = c.get('user');

  // Verify user can access these quizzes
  if (user?.id !== userId) {
    throw ApiErrors.forbidden('You can only view your own quizzes');
  }

  const firestoreConfig = {
    projectId: c.env.FIREBASE_PROJECT_ID!,
    apiKey: c.env.FIREBASE_API_KEY!
  };

  const quizzes = await listUserQuizzesFromFirestore(firestoreConfig, userId);

  return c.json({
    success: true,
    data: quizzes
  });
})

// List quizzes for a file
.get('/file/:fileId', requireAuth(), async (c) => {
  const fileId = c.req.param('fileId');
  const db = drizzle(c.env.DB);

  // Verify file exists and user has access
  const [file] = await db.select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw ApiErrors.notFound('File', fileId);
  }

  const user = c.get('user');
  if (file.ownerId !== user?.id) {
    throw ApiErrors.forbidden('You do not have access to this file');
  }

  const firestoreConfig = {
    projectId: c.env.FIREBASE_PROJECT_ID!,
    apiKey: c.env.FIREBASE_API_KEY!
  };

  const quizzes = await listFileQuizzesFromFirestore(firestoreConfig, fileId);

  return c.json({
    success: true,
    data: quizzes
  });
})

// Update quiz metadata
.patch('/:quizId', requireAuth(), async (c) => {
  const quizId = c.req.param('quizId');
  const updates = await c.req.json();

  const firestoreConfig = {
    projectId: c.env.FIREBASE_PROJECT_ID!,
    apiKey: c.env.FIREBASE_API_KEY!
  };

  // Verify quiz exists and user owns it
  const quiz = await getQuizFromFirestore(firestoreConfig, quizId);
  if (!quiz) {
    throw ApiErrors.notFound('Quiz', quizId);
  }

  const user = c.get('user');
  if (quiz.userId !== user?.id) {
    throw ApiErrors.forbidden('You do not have permission to edit this quiz');
  }

  // Update quiz
  await updateQuizInFirestore(firestoreConfig, quizId, {
    ...updates,
    updatedAt: new Date().toISOString()
  });

  return c.json({
    success: true,
    message: 'Quiz updated successfully'
  });
})

// Update a specific question
.patch('/:quizId/questions/:questionIndex', requireAuth(), async (c) => {
  const quizId = c.req.param('quizId');
  const questionIndex = parseInt(c.req.param('questionIndex'));
  const updates = await c.req.json();

  const firestoreConfig = {
    projectId: c.env.FIREBASE_PROJECT_ID!,
    apiKey: c.env.FIREBASE_API_KEY!
  };

  // Verify quiz exists and user owns it
  const quiz = await getQuizFromFirestore(firestoreConfig, quizId);
  if (!quiz) {
    throw ApiErrors.notFound('Quiz', quizId);
  }

  const user = c.get('user');
  if (quiz.userId !== user?.id) {
    throw ApiErrors.forbidden('You do not have permission to edit this quiz');
  }

  if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
    throw ApiErrors.badRequest('Invalid question index');
  }

  // Update question
  await updateQuestionInFirestore(firestoreConfig, quizId, questionIndex, updates);

  return c.json({
    success: true,
    message: 'Question updated successfully'
  });
})

// Add a new question
.post('/:quizId/questions', requireAuth(), async (c) => {
  const quizId = c.req.param('quizId');
  const newQuestion = await c.req.json();

  const firestoreConfig = {
    projectId: c.env.FIREBASE_PROJECT_ID!,
    apiKey: c.env.FIREBASE_API_KEY!
  };

  // Verify quiz exists and user owns it
  const quiz = await getQuizFromFirestore(firestoreConfig, quizId);
  if (!quiz) {
    throw ApiErrors.notFound('Quiz', quizId);
  }

  const user = c.get('user');
  if (quiz.userId !== user?.id) {
    throw ApiErrors.forbidden('You do not have permission to edit this quiz');
  }

  // Add question with new ID
  const questionWithId = {
    ...newQuestion,
    id: newQuestion.id || crypto.randomUUID()
  };

  await addQuestionToFirestore(firestoreConfig, quizId, questionWithId);

  return c.json({
    success: true,
    message: 'Question added successfully',
    questionId: questionWithId.id
  });
})

// Delete a question
.delete('/:quizId/questions/:questionIndex', requireAuth(), async (c) => {
  const quizId = c.req.param('quizId');
  const questionIndex = parseInt(c.req.param('questionIndex'));

  const firestoreConfig = {
    projectId: c.env.FIREBASE_PROJECT_ID!,
    apiKey: c.env.FIREBASE_API_KEY!
  };

  // Verify quiz exists and user owns it
  const quiz = await getQuizFromFirestore(firestoreConfig, quizId);
  if (!quiz) {
    throw ApiErrors.notFound('Quiz', quizId);
  }

  const user = c.get('user');
  if (quiz.userId !== user?.id) {
    throw ApiErrors.forbidden('You do not have permission to edit this quiz');
  }

  if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
    throw ApiErrors.badRequest('Invalid question index');
  }

  await deleteQuestionFromFirestore(firestoreConfig, quizId, questionIndex);

  return c.json({
    success: true,
    message: 'Question deleted successfully'
  });
})

// Reorder questions
.put('/:quizId/questions/reorder', requireAuth(), async (c) => {
  const quizId = c.req.param('quizId');
  const { newOrder } = await c.req.json();

  if (!Array.isArray(newOrder)) {
    throw ApiErrors.badRequest('newOrder must be an array of indices');
  }

  const firestoreConfig = {
    projectId: c.env.FIREBASE_PROJECT_ID!,
    apiKey: c.env.FIREBASE_API_KEY!
  };

  // Verify quiz exists and user owns it
  const quiz = await getQuizFromFirestore(firestoreConfig, quizId);
  if (!quiz) {
    throw ApiErrors.notFound('Quiz', quizId);
  }

  const user = c.get('user');
  if (quiz.userId !== user?.id) {
    throw ApiErrors.forbidden('You do not have permission to edit this quiz');
  }

  // Validate new order
  if (newOrder.length !== quiz.questions.length) {
    throw ApiErrors.badRequest('Invalid reorder array length');
  }

  await reorderQuestionsInFirestore(firestoreConfig, quizId, newOrder);

  return c.json({
    success: true,
    message: 'Questions reordered successfully'
  });
});

// Helper to schedule retry
async function scheduleRetry(
  env: HonoEnv['Bindings'],
  data: Omit<QStashProcessBody, 'retryCount'> & { retryCount: number },
  delaySeconds: number
) {
  if (!env.QSTASH_TOKEN) return;

  const client = new Client({ token: env.QSTASH_TOKEN });

  await client.publishJSON({
    url: `${env.NEXT_PUBLIC_APP_URL}/api/quiz/process`,
    body: {
      ...data,
      retryCount: data.retryCount + 1
    },
    delay: delaySeconds
  });
}

export default app;