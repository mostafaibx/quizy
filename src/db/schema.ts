import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  r2Key: text("r2_key").notNull().unique(),
  sizeBytes: integer("size_bytes").notNull(),
  mime: text("mime").notNull(),
  pageCount: integer("page_count"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  fileId: text("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  fromPage: integer("from_page").notNull(),
  toPage: integer("to_page").notNull(),
  topic: text("topic"),
  model: text("model"),
  status: text("status").notNull(),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  fileIdIdx: index("quizzes_file_id_idx").on(table.fileId),
}));

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  qtype: text("qtype").notNull(),
  position: integer("position").notNull(),
  stem: text("stem").notNull(),
  explanation: text("explanation"),
  payloadJson: text("payload_json"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  quizPositionUnique: uniqueIndex("questions_quiz_position_unique").on(table.quizId, table.position),
  quizPositionIdx: index("questions_quiz_position_idx").on(table.quizId, table.position),
}));

export const questionOptions = sqliteTable("question_options", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  text: text("text").notNull(),
  isCorrect: integer("is_correct"),
}, (table) => ({
  questionIdxUnique: uniqueIndex("question_options_question_idx_unique").on(table.questionId, table.idx),
  questionIdIdx: index("question_options_question_id_idx").on(table.questionId),
}));

export const questionShortAccept = sqliteTable("question_short_accept", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  answer: text("answer").notNull(),
}, (table) => ({
  questionIdIdx: index("question_short_accept_question_id_idx").on(table.questionId),
}));

export const questionNumericKey = sqliteTable("question_numeric_key", {
  questionId: text("question_id").primaryKey().references(() => questions.id, { onDelete: "cascade" }),
  answer: real("answer").notNull(),
  tolerance: real("tolerance").notNull().default(0),
});

export const questionOrderItems = sqliteTable("question_order_items", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  itemIdx: integer("item_idx").notNull(),
  text: text("text").notNull(),
}, (table) => ({
  questionIdxUnique: uniqueIndex("question_order_items_question_idx_unique").on(table.questionId, table.itemIdx),
  questionIdIdx: index("question_order_items_question_id_idx").on(table.questionId),
}));

export const questionPairs = sqliteTable("question_pairs", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  leftIdx: integer("left_idx").notNull(),
  leftText: text("left_text").notNull(),
  rightIdx: integer("right_idx").notNull(),
  rightText: text("right_text").notNull(),
}, (table) => ({
  questionLeftUnique: uniqueIndex("question_pairs_question_left_unique").on(table.questionId, table.leftIdx),
  questionRightUnique: uniqueIndex("question_pairs_question_right_unique").on(table.questionId, table.rightIdx),
  questionIdIdx: index("question_pairs_question_id_idx").on(table.questionId),
}));

export const questionBlanks = sqliteTable("question_blanks", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  blankNo: integer("blank_no").notNull(),
}, (table) => ({
  questionBlankUnique: uniqueIndex("question_blanks_question_blank_unique").on(table.questionId, table.blankNo),
}));

export const questionBlankAccept = sqliteTable("question_blank_accept", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  blankNo: integer("blank_no").notNull(),
  answer: text("answer").notNull(),
}, (table) => ({
  questionBlankAnswerUnique: uniqueIndex("question_blank_accept_unique").on(table.questionId, table.blankNo, table.answer),
  questionBlankIdx: index("question_blank_accept_idx").on(table.questionId, table.blankNo),
}));

export const quizAttempts = sqliteTable("quiz_attempts", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
  totalQuestions: integer("total_questions").notNull(),
  totalCorrect: integer("total_correct").default(0),
  scorePct: real("score_pct"),
  optionShuffleSeed: integer("option_shuffle_seed"),
}, (table) => ({
  quizUserStartUnique: uniqueIndex("quiz_attempts_unique").on(table.quizId, table.userId, table.startedAt),
  userStartIdx: index("quiz_attempts_user_start_idx").on(table.userId, table.startedAt),
}));

export const attemptAnswers = sqliteTable("attempt_answers", {
  attemptId: text("attempt_id").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  answerJson: text("answer_json").notNull(),
  isCorrect: integer("is_correct").notNull(),
  partialPct: real("partial_pct"),
  answeredAt: text("answered_at").notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  attemptIdIdx: index("attempt_answers_attempt_id_idx").on(table.attemptId),
  pk: uniqueIndex("attempt_answers_pk").on(table.attemptId, table.questionId),
}));

export const quizImports = sqliteTable("quiz_imports", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  rawJson: text("raw_json").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  error: text("error"),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type File = InferSelectModel<typeof files>;
export type NewFile = InferInsertModel<typeof files>;
export type Quiz = InferSelectModel<typeof quizzes>;
export type NewQuiz = InferInsertModel<typeof quizzes>;
export type Question = InferSelectModel<typeof questions>;
export type NewQuestion = InferInsertModel<typeof questions>;
export type QuestionOption = InferSelectModel<typeof questionOptions>;
export type NewQuestionOption = InferInsertModel<typeof questionOptions>;
export type QuestionShortAccept = InferSelectModel<typeof questionShortAccept>;
export type NewQuestionShortAccept = InferInsertModel<typeof questionShortAccept>;
export type QuestionNumericKey = InferSelectModel<typeof questionNumericKey>;
export type NewQuestionNumericKey = InferInsertModel<typeof questionNumericKey>;
export type QuestionOrderItem = InferSelectModel<typeof questionOrderItems>;
export type NewQuestionOrderItem = InferInsertModel<typeof questionOrderItems>;
export type QuestionPair = InferSelectModel<typeof questionPairs>;
export type NewQuestionPair = InferInsertModel<typeof questionPairs>;
export type QuestionBlank = InferSelectModel<typeof questionBlanks>;
export type NewQuestionBlank = InferInsertModel<typeof questionBlanks>;
export type QuestionBlankAccept = InferSelectModel<typeof questionBlankAccept>;
export type NewQuestionBlankAccept = InferInsertModel<typeof questionBlankAccept>;
export type QuizAttempt = InferSelectModel<typeof quizAttempts>;
export type NewQuizAttempt = InferInsertModel<typeof quizAttempts>;
export type AttemptAnswer = InferSelectModel<typeof attemptAnswers>;
export type NewAttemptAnswer = InferInsertModel<typeof attemptAnswers>;
export type QuizImport = InferSelectModel<typeof quizImports>;
export type NewQuizImport = InferInsertModel<typeof quizImports>;