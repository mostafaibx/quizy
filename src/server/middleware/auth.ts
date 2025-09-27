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
  const signature = c.req.header('upstash-signature');

  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const body = await c.req.text();
  const env = c.env as {
    QSTASH_CURRENT_SIGNING_KEY?: string;
    QSTASH_NEXT_SIGNING_KEY?: string;
  };

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