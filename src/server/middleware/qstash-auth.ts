import { Context, Next } from 'hono';

async function createSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  // Convert ArrayBuffer to base64url
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export const verifyQStashSignature = async (c: Context, next: Next) => {
  const env = c.env as {
    NODE_ENV?: string;
    PARSER_SERVICE_URL?: string;
    QSTASH_CURRENT_SIGNING_KEY?: string;
    QSTASH_NEXT_SIGNING_KEY?: string;
  };

  // Skip signature verification ONLY in development/testing scenarios:
  // 1. Development mode (NODE_ENV=development)
  // 2. Using local parser (localhost/127.0.0.1) for testing
  // 
  // ⚠️  SECURITY NOTE: Direct processing (< 2MB files) does NOT use this endpoint!
  // Direct calls return responses synchronously without callbacks.
  // Therefore, ALL production requests to this endpoint MUST have valid signatures.
  const isLocalDevelopment = env.NODE_ENV === 'development';
  const isLocalParser = env.PARSER_SERVICE_URL?.includes('localhost') || 
                        env.PARSER_SERVICE_URL?.includes('127.0.0.1');
  
  if (isLocalDevelopment || isLocalParser) {
    const body = await c.req.text();
    const reason = isLocalDevelopment ? 'development mode' : 'local parser (testing)';
    console.log(`[QStash Auth] ⚠️  Skipping signature verification - ${reason}`);
    console.log('[QStash Auth] Raw body:', body);
    try {
      const parsed = JSON.parse(body);
      console.log('[QStash Auth] Parsed body:', parsed);
      c.set('parsedBody', parsed);
    } catch (error) {
      console.error('[QStash Auth] Failed to parse body:', error);
      c.set('parsedBody', {});
    }
    await next();
    return;
  }

  // Production: REQUIRE valid QStash signature
  const signature = c.req.header('upstash-signature');
  
  if (!signature) {
    console.error('[QStash Auth] ❌ Missing signature in production - rejecting request');
    return c.json({ error: 'Missing QStash signature' }, 401);
  }

  const body = await c.req.text();

  const keys = [
    env.QSTASH_CURRENT_SIGNING_KEY,
    env.QSTASH_NEXT_SIGNING_KEY
  ].filter((key): key is string => Boolean(key));

  let isValid = false;
  const url = new URL(c.req.url);
  const fullUrl = `${url.protocol}//${url.host}${url.pathname}`;

  for (const key of keys) {
    const expectedSignature = await createSignature(`${fullUrl}.${body}`, key);

    if (signature === expectedSignature) {
      isValid = true;
      break;
    }
  }

  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  // Store parsed body for route handler
  c.set('parsedBody', JSON.parse(body));
  await next();
};

export const extractUserId = async (c: Context, next: Next) => {
  const userId = c.req.header('x-user-id') || 'anonymous';
  c.set('userId', userId);
  await next();
};