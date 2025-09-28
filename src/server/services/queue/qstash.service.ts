import type { AppEnv } from '@/types/cloudflare';
import type { ProcessFileInput } from '@/types/requests';
import { createHmac } from 'crypto';

export async function queueFileProcessing(
  env: AppEnv,
  data: ProcessFileInput
): Promise<boolean> {
  if (!env.QSTASH_URL || !env.QSTASH_TOKEN) {
    return false;
  }

  try {
    const response = await fetch(
      `${env.QSTASH_URL}/v2/publish/${env.NEXT_PUBLIC_APP_URL}/api/files/process`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Upstash-Retries': '3',
          'Upstash-Delay': '2s',
        },
        body: JSON.stringify(data),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('QStash error:', error);
    return false;
  }
}

function validateSignature(
  signature: string | null,
  signingKey: string | null,
  url: string,
  body: string
): boolean {
  if (!signature || !signingKey) {
    return false;
  }

  try {
    const hmac = createHmac('sha256', signingKey);
    hmac.update(url);
    hmac.update('\n');
    hmac.update(body);
    const expectedSignature = hmac.digest('base64url');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}

export function verifyQStashSignature(
  env: AppEnv,
  headers: Record<string, string>,
  url: string,
  body: string
): boolean {
  const signature = headers['upstash-signature'];

  if (!signature || !env.QSTASH_CURRENT_SIGNING_KEY) {
    return false;
  }

  const isValid = validateSignature(
    signature,
    env.QSTASH_CURRENT_SIGNING_KEY,
    url,
    body
  );

  if (!isValid && env.QSTASH_NEXT_SIGNING_KEY) {
    return validateSignature(
      signature,
      env.QSTASH_NEXT_SIGNING_KEY,
      url,
      body
    );
  }

  return isValid;
}

export function isQStashConfigured(env: AppEnv): boolean {
  return !!(env.QSTASH_URL && env.QSTASH_TOKEN);
}