import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { ApiErrors } from '../middleware/error';
import type { HonoEnv } from '@/types/cloudflare';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../services/logger.service';
import { checkUpdateLimit } from '../services/rate-limiter';

const app = new Hono<HonoEnv>()

// Get user phone status
.get('/phone-status', requireAuth(), async (c) => {
  const user = c.get('user');
  const userId = user?.id;

  if (!userId) {
    throw ApiErrors.unauthorized('User not authenticated');
  }

  const db = await getDb();
  const dbUser = await db
    .select({ phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then(r => r[0]);

  if (!dbUser) {
    throw ApiErrors.notFound('User', userId);
  }

  return c.json({
    success: true,
    data: {
      hasPhoneNumber: !!dbUser.phone,
      phoneNumber: dbUser.phone
    }
  });
})

// Update user phone number
.put('/phone', requireAuth(), async (c) => {
  const user = c.get('user');
  const userId = user?.id;
  const logger = createLogger('UpdatePhone', c.env.NODE_ENV);

  if (!userId) {
    throw ApiErrors.unauthorized('User not authenticated');
  }

  // Rate limiting for phone updates
  if (c.env.KV) {
    const rateLimit = await checkUpdateLimit(c.env.KV, userId, 'phone');
    if (!rateLimit.allowed) {
      logger.warn('Phone update rate limit exceeded', { userId });
      return c.json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many phone updates. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        },
      }, 429);
    }
  }

  const body = await c.req.json();
  const { phone } = body;

  // Validate phone number format (basic validation, adjust as needed)
  if (phone && !/^[+]?[\d\s()-]+$/.test(phone)) {
    throw ApiErrors.badRequest('Invalid phone number format');
  }

  const db = await getDb();

  try {
    const [updatedUser] = await db
      .update(users)
      .set({ phone: phone || null })
      .where(eq(users.id, userId))
      .returning({ phone: users.phone });

    if (!updatedUser) {
      throw ApiErrors.notFound('User', userId);
    }

    logger.info('Phone number updated', { userId, hasPhone: !!phone });
    return c.json({
      success: true,
      data: {
        phone: updatedUser.phone,
        message: phone ? 'Phone number updated successfully' : 'Phone number removed successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to update phone number', error instanceof Error ? error : undefined, { userId });
    throw ApiErrors.internal('Failed to update phone number');
  }
})

export default app;