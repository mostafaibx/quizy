import type { AIQuestion, GeneratedQuiz } from '@/types/ai.types';
import type {
  QuizDocument,
  QuizUpdateData,
  FirestoreConfig,
  QuizConfig
} from '@/types/quiz.types';
import type {
  FirestoreValue,
  FirestoreFields,
  FirestoreDocument,
  FirestoreQueryResponse,
  FirestoreRunQueryRequest,
  JSValue
} from '@/types/firestore.types';
import {
  isNullValue,
  isBooleanValue,
  isIntegerValue,
  isDoubleValue,
  isStringValue,
  isTimestampValue,
  isArrayValue,
  isMapValue
} from '@/types/firestore.types';

// Convert JavaScript value to Firestore format
const toFirestoreValue = (value: JSValue): FirestoreValue => {
  if (value === null) {
    return { nullValue: null };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: value.toString() }
      : { doubleValue: value };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((v: JSValue) => toFirestoreValue(v))
      }
    };
  }

  if (typeof value === 'object' && value !== null) {
    const fields: FirestoreFields = {};
    for (const [key, val] of Object.entries(value)) {
      fields[key] = toFirestoreValue(val as JSValue);
    }
    return {
      mapValue: { fields }
    };
  }

  // Fallback for any unhandled types
  return { stringValue: String(value) };
};

// Convert Firestore value to JavaScript
const fromFirestoreValue = (value: FirestoreValue): JSValue => {
  if (isNullValue(value)) {
    return null;
  }

  if (isBooleanValue(value)) {
    return value.booleanValue;
  }

  if (isIntegerValue(value)) {
    return parseInt(value.integerValue, 10);
  }

  if (isDoubleValue(value)) {
    return value.doubleValue;
  }

  if (isStringValue(value)) {
    return value.stringValue;
  }

  if (isTimestampValue(value)) {
    return new Date(value.timestampValue);
  }

  if (isArrayValue(value)) {
    return value.arrayValue.values?.map((v: FirestoreValue) => fromFirestoreValue(v)) || [];
  }

  if (isMapValue(value)) {
    const result: Record<string, JSValue> = {};
    for (const [key, val] of Object.entries(value.mapValue.fields || {})) {
      result[key] = fromFirestoreValue(val);
    }
    return result;
  }

  return null;
};

// Convert QuizDocument to Firestore document
const quizToFirestoreDocument = (quiz: QuizDocument): FirestoreDocument => {
  const quizRecord: Record<string, JSValue> = {
    id: quiz.id,
    userId: quiz.userId,
    fileId: quiz.fileId,
    status: quiz.status,
    metadata: quiz.metadata as unknown as JSValue,
    config: quiz.config as unknown as JSValue,
    questions: quiz.questions as unknown as JSValue,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt
  };

  const fields: FirestoreFields = {};
  for (const [key, value] of Object.entries(quizRecord)) {
    fields[key] = toFirestoreValue(value);
  }

  return { fields };
};

// Convert Firestore document to QuizDocument
const firestoreDocumentToQuiz = (doc: FirestoreDocument): QuizDocument => {
  const result: Record<string, JSValue> = {};

  for (const [key, value] of Object.entries(doc.fields || {})) {
    result[key] = fromFirestoreValue(value);
  }

  return result as unknown as QuizDocument;
};

// Get Firestore base URL
const getFirestoreUrl = (projectId: string): string => {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
};

// Build update mask for PATCH requests
const buildUpdateMask = (keys: string[]): string => {
  return keys.map(key => `updateMask.fieldPaths=${key}`).join('&');
};

// Save quiz to Firestore
export const saveQuizToFirestore = async (
  config: FirestoreConfig,
  quiz: GeneratedQuiz,
  userId: string,
  fileId: string,
  quizConfig: { fromPage: number; toPage: number; config: QuizConfig }
): Promise<string> => {
  const baseUrl = getFirestoreUrl(config.projectId);

  const quizDoc: QuizDocument = {
    id: quiz.id,
    userId,
    fileId,
    status: 'ready',
    metadata: {
      fromPage: quizConfig.fromPage || 1,
      toPage: quizConfig.toPage || 1,
      questionCount: quiz.questions.length,
      provider: quiz.metadata.provider,
      model: quiz.metadata.model,
      tokensUsed: quiz.metadata.tokensUsed,
      cost: quiz.metadata.cost,
      generatedAt: new Date(quiz.metadata.timestamp).toISOString(),
    },
    config: quizConfig.config,
    questions: quiz.questions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const firestoreDoc = quizToFirestoreDocument(quizDoc);

  const response = await fetch(
    `${baseUrl}/quizzes?documentId=${quiz.id}&key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreDoc),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore error: ${error}`);
  }

  return quiz.id;
};

// Get quiz from Firestore
export const getQuizFromFirestore = async (
  config: FirestoreConfig,
  quizId: string
): Promise<QuizDocument | null> => {
  const baseUrl = getFirestoreUrl(config.projectId);

  const response = await fetch(
    `${baseUrl}/quizzes/${quizId}?key=${config.apiKey}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.text();
    throw new Error(`Firestore error: ${error}`);
  }

  const data: FirestoreDocument = await response.json();
  return firestoreDocumentToQuiz(data);
};

// Update quiz
export const updateQuizInFirestore = async (
  config: FirestoreConfig,
  quizId: string,
  updates: QuizUpdateData
): Promise<void> => {
  const baseUrl = getFirestoreUrl(config.projectId);
  const updateMask = buildUpdateMask(Object.keys(updates));

  const updateRecord: Record<string, JSValue> = {};
  for (const [key, value] of Object.entries(updates)) {
    updateRecord[key] = value as JSValue;
  }

  const fields: FirestoreFields = {};
  for (const [key, value] of Object.entries(updateRecord)) {
    fields[key] = toFirestoreValue(value);
  }

  const firestoreDoc: FirestoreDocument = { fields };

  const response = await fetch(
    `${baseUrl}/quizzes/${quizId}?${updateMask}&key=${config.apiKey}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreDoc),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore error: ${error}`);
  }
};

// Update a single question
export const updateQuestionInFirestore = async (
  config: FirestoreConfig,
  quizId: string,
  questionIndex: number,
  updates: Partial<AIQuestion>
): Promise<void> => {
  const quiz = await getQuizFromFirestore(config, quizId);
  if (!quiz) throw new Error('Quiz not found');

  if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
    throw new Error('Invalid question index');
  }

  quiz.questions[questionIndex] = {
    ...quiz.questions[questionIndex],
    ...updates
  };

  await updateQuizInFirestore(config, quizId, {
    questions: quiz.questions,
    updatedAt: new Date().toISOString()
  });
};

// Add a new question
export const addQuestionToFirestore = async (
  config: FirestoreConfig,
  quizId: string,
  question: AIQuestion
): Promise<void> => {
  const quiz = await getQuizFromFirestore(config, quizId);
  if (!quiz) throw new Error('Quiz not found');

  quiz.questions.push(question);

  await updateQuizInFirestore(config, quizId, {
    questions: quiz.questions,
    updatedAt: new Date().toISOString()
  });
};

// Delete a question
export const deleteQuestionFromFirestore = async (
  config: FirestoreConfig,
  quizId: string,
  questionIndex: number
): Promise<void> => {
  const quiz = await getQuizFromFirestore(config, quizId);
  if (!quiz) throw new Error('Quiz not found');

  if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
    throw new Error('Invalid question index');
  }

  quiz.questions.splice(questionIndex, 1);

  await updateQuizInFirestore(config, quizId, {
    questions: quiz.questions,
    updatedAt: new Date().toISOString()
  });
};

// Reorder questions
export const reorderQuestionsInFirestore = async (
  config: FirestoreConfig,
  quizId: string,
  newOrder: number[]
): Promise<void> => {
  const quiz = await getQuizFromFirestore(config, quizId);
  if (!quiz) throw new Error('Quiz not found');

  if (newOrder.length !== quiz.questions.length) {
    throw new Error('New order array must have same length as questions array');
  }

  const reorderedQuestions = newOrder.map(index => {
    if (index < 0 || index >= quiz.questions.length) {
      throw new Error(`Invalid index in new order: ${index}`);
    }
    return quiz.questions[index];
  });

  await updateQuizInFirestore(config, quizId, {
    questions: reorderedQuestions,
    updatedAt: new Date().toISOString()
  });
};

// List quizzes for a user
export const listUserQuizzesFromFirestore = async (
  config: FirestoreConfig,
  userId: string,
  limit = 20
): Promise<QuizDocument[]> => {
  const baseUrl = getFirestoreUrl(config.projectId);

  const queryRequest: FirestoreRunQueryRequest = {
    structuredQuery: {
      from: [{ collectionId: 'quizzes' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'userId' },
          op: 'EQUAL',
          value: { stringValue: userId }
        }
      },
      orderBy: [{
        field: { fieldPath: 'createdAt' },
        direction: 'DESCENDING'
      }],
      limit
    }
  };

  const response = await fetch(
    `${baseUrl}:runQuery?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryRequest)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore error: ${error}`);
  }

  const data: FirestoreQueryResponse[] = await response.json();
  const quizzes: QuizDocument[] = [];

  for (const item of data) {
    if (item.documents) {
      for (const doc of item.documents) {
        quizzes.push(firestoreDocumentToQuiz(doc));
      }
    }
  }

  return quizzes;
};

// List quizzes for a file
export const listFileQuizzesFromFirestore = async (
  config: FirestoreConfig,
  fileId: string,
  limit = 20
): Promise<QuizDocument[]> => {
  const baseUrl = getFirestoreUrl(config.projectId);

  const queryRequest: FirestoreRunQueryRequest = {
    structuredQuery: {
      from: [{ collectionId: 'quizzes' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'fileId' },
          op: 'EQUAL',
          value: { stringValue: fileId }
        }
      },
      orderBy: [{
        field: { fieldPath: 'createdAt' },
        direction: 'DESCENDING'
      }],
      limit
    }
  };

  const response = await fetch(
    `${baseUrl}:runQuery?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryRequest)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore error: ${error}`);
  }

  const data: FirestoreQueryResponse[] = await response.json();
  const quizzes: QuizDocument[] = [];

  for (const item of data) {
    if (item.documents) {
      for (const doc of item.documents) {
        quizzes.push(firestoreDocumentToQuiz(doc));
      }
    }
  }

  return quizzes;
};