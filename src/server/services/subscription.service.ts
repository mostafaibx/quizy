
import { nanoid } from "nanoid";
import { eq, and, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  plans,
  subscriptions,
  paymentHistory,
  usageTracking,
  type Plan,
  type Subscription,
  type NewSubscription,
} from "@/db/schema";

export interface PlanLimits {
  maxFiles?: number;
  maxQuizzes?: number;
  maxQuestionsPerQuiz?: number;
  maxFileSize?: number; // in MB
  aiModels?: string[];
  features?: string[];
}

export interface PlanFeatures {
  name: string;
  description?: string;
  enabled: boolean;
}

const DEFAULT_FREE_PLAN: Partial<Plan> = {
  id: "plan_free",
  name: "Free",
  slug: "free",
  description: "Perfect for getting started",
  price: 0,
  currency: "USD",
  interval: "lifetime",
  features: JSON.stringify([
    "Upload up to 5 PDFs",
    "Create up to 10 quizzes",
    "Basic AI models",
    "Community support"
  ]),
  limits: JSON.stringify({
    maxFiles: 5,
    maxQuizzes: 10,
    maxQuestionsPerQuiz: 20,
    maxFileSize: 10, // 10 MB
    aiModels: ["gpt-3.5-turbo"],
    features: ["basic_quiz", "pdf_upload"]
  } as PlanLimits)
};

export async function createFreePlanIfNotExists() {
  const db = await getDb();
  const existingPlan = await db
    .select()
    .from(plans)
    .where(eq(plans.slug, "free"))
    .limit(1);

  if (!existingPlan.length) {
    await db.insert(plans).values(DEFAULT_FREE_PLAN as Plan);
  }

  return await db
    .select()
    .from(plans)
    .where(eq(plans.slug, "free"))
    .limit(1)
    .then(rows => rows[0]);
}

export async function assignFreePlanToUser(userId: string) {
  const db = await getDb();
  const freePlan = await createFreePlanIfNotExists();

  if (!freePlan) {
    throw new Error("Failed to create or find free plan");
  }

  const existingSubscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existingSubscription.length > 0) {
    return existingSubscription[0];
  }

  const now = new Date();
  const subscription: NewSubscription = {
    id: nanoid(),
    userId,
    planId: freePlan.id,
    status: "active",
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: new Date(2099, 11, 31).toISOString(), // Lifetime for free plan
    cancelAtPeriodEnd: 0,
    canceledAt: null,
    trialStart: null,
    trialEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    metadata: null
  };

  await db.insert(subscriptions).values(subscription);
  return subscription;
}

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const db = await getDb();
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active")
      )
    )
    .limit(1);

  return subscription[0] || null;
}

export async function getUserPlan(userId: string): Promise<Plan | null> {
  const db = await getDb();
  let subscription = await getUserSubscription(userId);

  if (!subscription) {
    // Auto-assign free plan if no subscription exists
    const newSub = await assignFreePlanToUser(userId);
    subscription = newSub as Subscription;
  }

  if (!subscription) return null;

  const plan = await db
    .select()
    .from(plans)
    .where(eq(plans.id, subscription.planId))
    .limit(1);

  return plan[0] || null;
}

export async function getPlanLimits(userId: string): Promise<PlanLimits> {
  const plan = await getUserPlan(userId);

  if (!plan || !plan.limits) {
    // Return default free limits if no plan found
    return {
      maxFiles: 5,
      maxQuizzes: 10,
      maxQuestionsPerQuiz: 20,
      maxFileSize: 10,
      aiModels: ["gpt-3.5-turbo"],
      features: ["basic_quiz", "pdf_upload"]
    };
  }

  return JSON.parse(plan.limits) as PlanLimits;
}

export async function checkUsageLimit(userId: string, metric: string): Promise<{ allowed: boolean; current: number; limit: number | undefined }> {
  const limits = await getPlanLimits(userId);
  const usage = await getCurrentUsage(userId, metric);

  let limit: number | undefined;
  switch (metric) {
    case "files_uploaded":
      limit = limits.maxFiles;
      break;
    case "quizzes_created":
      limit = limits.maxQuizzes;
      break;
    default:
      limit = undefined;
  }

  return {
    allowed: limit === undefined || usage < limit,
    current: usage,
    limit
  };
}

export async function getCurrentUsage(userId: string, metric: string): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

  const usage = await db
    .select()
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.metric, metric),
        gte(usageTracking.periodStart, periodStart),
        lte(usageTracking.periodEnd, periodEnd)
      )
    )
    .limit(1);

  return usage[0]?.count || 0;
}

export async function incrementUsage(userId: string, metric: string, count: number = 1): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

  const existing = await db
    .select()
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.metric, metric),
        eq(usageTracking.periodStart, periodStart)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(usageTracking)
      .set({
        count: existing[0].count + count,
        updatedAt: now.toISOString()
      })
      .where(eq(usageTracking.id, existing[0].id));
  } else {
    await db.insert(usageTracking).values({
      id: nanoid(),
      userId,
      metric,
      count,
      periodStart,
      periodEnd
    });
  }
}

export async function canUpgradeFrom(currentPlanId: string, newPlanId: string): Promise<boolean> {
  const db = await getDb();
  const [currentPlan, newPlan] = await Promise.all([
    db.select().from(plans).where(eq(plans.id, currentPlanId)).limit(1),
    db.select().from(plans).where(eq(plans.id, newPlanId)).limit(1)
  ]);

  if (!currentPlan[0] || !newPlan[0]) return false;

  // Can upgrade if new plan price is higher or moving from free to paid
  return newPlan[0].price > currentPlan[0].price;
}

export async function recordPayment(
  userId: string,
  subscriptionId: string | null,
  amount: number,
  currency: string,
  status: string,
  stripePaymentIntentId?: string
): Promise<void> {
  const db = await getDb();
  await db.insert(paymentHistory).values({
    id: nanoid(),
    userId,
    subscriptionId,
    amount,
    currency,
    status,
    stripePaymentIntentId: stripePaymentIntentId || null,
    description: null,
    invoiceId: null,
    failureReason: null,
    paidAt: status === "succeeded" ? new Date().toISOString() : null
  });
}