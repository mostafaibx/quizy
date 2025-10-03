import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
  phone: text("phone"),
  phoneVerified: integer("phone_verified", { mode: 'timestamp' }),
  emailVerified: integer("email_verified", { mode: 'timestamp' }),
  image: text("image"),
  password: text("password"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const accounts = sqliteTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: 'timestamp' }).notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: 'timestamp' }).notNull(),
});

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: real("price").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  interval: text("interval").notNull().default("month"), // month, year, lifetime
  features: text("features_json"), // JSON array of feature strings
  limits: text("limits_json"), // JSON object with limits (e.g., maxFiles, maxQuizzes, etc.)
  isActive: integer("is_active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => plans.id),
  status: text("status").notNull(), // active, canceled, expired, past_due, trialing
  currentPeriodStart: text("current_period_start").notNull(),
  currentPeriodEnd: text("current_period_end").notNull(),
  cancelAtPeriodEnd: integer("cancel_at_period_end").notNull().default(0),
  canceledAt: text("canceled_at"),
  trialStart: text("trial_start"),
  trialEnd: text("trial_end"),
  // Payment provider references
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  // Metadata
  metadata: text("metadata_json"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const paymentHistory = sqliteTable("payment_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  subscriptionId: text("subscription_id").references(() => subscriptions.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(), // succeeded, failed, pending, refunded
  description: text("description"),
  invoiceId: text("invoice_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  failureReason: text("failure_reason"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const usageTracking = sqliteTable("usage_tracking", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(), // files_uploaded, quizzes_created, questions_generated, etc.
  count: integer("count").notNull().default(0),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
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
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  qtype: text("qtype").notNull(),
  position: integer("position").notNull(),
  stem: text("stem").notNull(),
  explanation: text("explanation"),
  payloadJson: text("payload_json"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const questionOptions = sqliteTable("question_options", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  text: text("text").notNull(),
  isCorrect: integer("is_correct"),
});

export const questionShortAccept = sqliteTable("question_short_accept", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  answer: text("answer").notNull(),
});

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
});

export const questionPairs = sqliteTable("question_pairs", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  leftIdx: integer("left_idx").notNull(),
  leftText: text("left_text").notNull(),
  rightIdx: integer("right_idx").notNull(),
  rightText: text("right_text").notNull(),
});

export const questionBlanks = sqliteTable("question_blanks", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  blankNo: integer("blank_no").notNull(),
});

export const questionBlankAccept = sqliteTable("question_blank_accept", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  blankNo: integer("blank_no").notNull(),
  answer: text("answer").notNull(),
});

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
});

export const attemptAnswers = sqliteTable("attempt_answers", {
  attemptId: text("attempt_id").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  answerJson: text("answer_json").notNull(),
  isCorrect: integer("is_correct").notNull(),
  partialPct: real("partial_pct"),
  answeredAt: text("answered_at").notNull().default(sql`(datetime('now'))`),
});

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
export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type VerificationToken = InferSelectModel<typeof verificationTokens>;
export type NewVerificationToken = InferInsertModel<typeof verificationTokens>;
export type Plan = InferSelectModel<typeof plans>;
export type NewPlan = InferInsertModel<typeof plans>;
export type Subscription = InferSelectModel<typeof subscriptions>;
export type NewSubscription = InferInsertModel<typeof subscriptions>;
export type PaymentHistory = InferSelectModel<typeof paymentHistory>;
export type NewPaymentHistory = InferInsertModel<typeof paymentHistory>;
export type UsageTracking = InferSelectModel<typeof usageTracking>;
export type NewUsageTracking = InferInsertModel<typeof usageTracking>;
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