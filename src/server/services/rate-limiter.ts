
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

const PROVIDER_LIMITS: Record<string, RateLimitConfig> = {
  'gemini-free': { windowMs: 60000, maxRequests: 60 },
  'gemini-paid': { windowMs: 60000, maxRequests: 360 },
};

const USER_LIMITS: Record<string, RateLimitConfig> = {
  'free': { windowMs: 3600000, maxRequests: 10 },
  'basic': { windowMs: 3600000, maxRequests: 50 },
  'premium': { windowMs: 3600000, maxRequests: 200 },
};

// File upload limits (per hour)
const FILE_UPLOAD_LIMITS: Record<string, RateLimitConfig> = {
  'free': { windowMs: 3600000, maxRequests: 10 },      // 10 uploads/hour
  'basic': { windowMs: 3600000, maxRequests: 30 },     // 30 uploads/hour
  'premium': { windowMs: 3600000, maxRequests: 100 },  // 100 uploads/hour
};

// Update operation limits (per hour)
const UPDATE_LIMITS: Record<string, RateLimitConfig> = {
  'phone': { windowMs: 3600000, maxRequests: 5 },      // 5 phone updates/hour
  'profile': { windowMs: 3600000, maxRequests: 10 },   // 10 profile updates/hour
  'delete': { windowMs: 3600000, maxRequests: 20 },    // 20 deletes/hour
};

export const checkRateLimit = async (
  kv: KVNamespace,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> => {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const data = await kv.get<{ requests: number[] }>(key, 'json') || { requests: [] };

  const activeRequests = data.requests.filter(timestamp => timestamp > windowStart);

  if (activeRequests.length >= config.maxRequests) {
    const oldestRequest = Math.min(...activeRequests);
    const resetAt = oldestRequest + config.windowMs;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil((resetAt - now) / 1000)
    };
  }

  activeRequests.push(now);

  await kv.put(
    key,
    JSON.stringify({ requests: activeRequests }),
    { expirationTtl: Math.ceil(config.windowMs / 1000) }
  );

  return {
    allowed: true,
    remaining: config.maxRequests - activeRequests.length,
    resetAt: now + config.windowMs
  };
};

export const checkAllLimits = async (
  kv: KVNamespace,
  userId: string,
  userTier: string = 'free',
  provider: string = 'gemini-free'
): Promise<RateLimitResult> => {
  const checks = await Promise.all([
    checkRateLimit(kv, `rate:user:${userId}`, USER_LIMITS[userTier] || USER_LIMITS.free),
    checkRateLimit(kv, `rate:provider:${provider}`, PROVIDER_LIMITS[provider] || PROVIDER_LIMITS['gemini-free']),
    checkRateLimit(kv, 'rate:global', { windowMs: 60000, maxRequests: 1000 })
  ]);

  const blocked = checks.find(c => !c.allowed);
  if (blocked) return blocked;

  return checks.reduce((min, current) =>
    current.remaining < min.remaining ? current : min
  );
};

// Check file upload rate limit
export const checkFileUploadLimit = async (
  kv: KVNamespace,
  userId: string,
  userTier: string = 'free'
): Promise<RateLimitResult> => {
  return checkRateLimit(
    kv, 
    `rate:file-upload:${userId}`, 
    FILE_UPLOAD_LIMITS[userTier] || FILE_UPLOAD_LIMITS.free
  );
};

// Check update operation rate limit
export const checkUpdateLimit = async (
  kv: KVNamespace,
  userId: string,
  operation: 'phone' | 'profile' | 'delete'
): Promise<RateLimitResult> => {
  return checkRateLimit(
    kv,
    `rate:update:${operation}:${userId}`,
    UPDATE_LIMITS[operation]
  );
};