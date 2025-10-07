import type { AuthenticatedUser } from './auth.types';

export type CloudflareBindings = {
  DB: D1Database;
  FILES: R2Bucket;
  KV?: KVNamespace;
  NEXT_INC_CACHE_KV?: KVNamespace;
  ANALYTICS_ENGINE?: AnalyticsEngineDataset;
  NEXTAUTH_SECRET?: string;
  // Environment variables
  ALLOWED_ORIGINS?: string;
  RESEND_API_KEY?: string;
  NEXT_PUBLIC_EMAIL_FROM?: string;
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_WEBAPP_ENV?: string;
  NODE_ENV?: string;
  QSTASH_URL?: string;
  QSTASH_TOKEN?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
  GEMINI_API_KEY?: string;
  PARSER_SERVICE_URL?: string;
  R2_PUBLIC_URL?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
};

export type HonoEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    user?: AuthenticatedUser;
    requestId?: string;
    userId?: string;
    parsedBody?: unknown;
    [key: string]: unknown;
  };
};

export interface AppEnv {
  DB: D1Database;
  FILES: R2Bucket;
  QSTASH_URL?: string;
  QSTASH_TOKEN?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
  NEXT_PUBLIC_APP_URL?: string;
  PARSER_SERVICE_URL?: string;
  R2_PUBLIC_URL?: string;
}

export interface AppContext {
  env: AppEnv;
  ctx?: ExecutionContext;
}