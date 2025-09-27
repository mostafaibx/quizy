import { relations } from "drizzle-orm";
import {
  users,
  files,
  quizzes,
  questions,
  questionOptions,
  questionShortAccept,
  questionNumericKey,
  questionOrderItems,
  questionPairs,
  questionBlanks,
  questionBlankAccept,
  quizAttempts,
  attemptAnswers,
  quizImports,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  files: many(files),
  quizzes: many(quizzes),
  quizAttempts: many(quizAttempts),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  owner: one(users, {
    fields: [files.ownerId],
    references: [users.id],
  }),
  quizzes: many(quizzes),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  file: one(files, {
    fields: [quizzes.fileId],
    references: [files.id],
  }),
  createdByUser: one(users, {
    fields: [quizzes.createdBy],
    references: [users.id],
  }),
  questions: many(questions),
  attempts: many(quizAttempts),
  imports: many(quizImports),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [questions.quizId],
    references: [quizzes.id],
  }),
  options: many(questionOptions),
  shortAccept: many(questionShortAccept),
  numericKey: one(questionNumericKey, {
    fields: [questions.id],
    references: [questionNumericKey.questionId],
  }),
  orderItems: many(questionOrderItems),
  pairs: many(questionPairs),
  blanks: many(questionBlanks),
  blankAccept: many(questionBlankAccept),
  attemptAnswers: many(attemptAnswers),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const questionShortAcceptRelations = relations(questionShortAccept, ({ one }) => ({
  question: one(questions, {
    fields: [questionShortAccept.questionId],
    references: [questions.id],
  }),
}));

export const questionNumericKeyRelations = relations(questionNumericKey, ({ one }) => ({
  question: one(questions, {
    fields: [questionNumericKey.questionId],
    references: [questions.id],
  }),
}));

export const questionOrderItemsRelations = relations(questionOrderItems, ({ one }) => ({
  question: one(questions, {
    fields: [questionOrderItems.questionId],
    references: [questions.id],
  }),
}));

export const questionPairsRelations = relations(questionPairs, ({ one }) => ({
  question: one(questions, {
    fields: [questionPairs.questionId],
    references: [questions.id],
  }),
}));

export const questionBlanksRelations = relations(questionBlanks, ({ one }) => ({
  question: one(questions, {
    fields: [questionBlanks.questionId],
    references: [questions.id],
  }),
}));

export const questionBlankAcceptRelations = relations(questionBlankAccept, ({ one }) => ({
  question: one(questions, {
    fields: [questionBlankAccept.questionId],
    references: [questions.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  answers: many(attemptAnswers),
}));

export const attemptAnswersRelations = relations(attemptAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [attemptAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [attemptAnswers.questionId],
    references: [questions.id],
  }),
}));

export const quizImportsRelations = relations(quizImports, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizImports.quizId],
    references: [quizzes.id],
  }),
}));