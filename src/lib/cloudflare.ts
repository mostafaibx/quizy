import type { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { getEnv } from '@/utils/helpers';

/**
 * Helper method to get the DB client from Cloudflare bindings
 * This maintains backward compatibility
 */
export async function getDbClientFromBindings() {
  return getDb();
}

/**
 * Get Cloudflare properties from a request
 */
export function getCloudflareProperties(request?: NextRequest) {
  if (request?.cf) {
    return request.cf;
  }
  return {};
}

/**
 * KV Store operations
 */
export async function getKVValue(key: string) {
  const env = await getEnv();
  const isLocal = env.NEXT_PUBLIC_WEBAPP_ENV === 'local';
  if (isLocal) {
    return null;
  }

  const kv = env.NEXT_INC_CACHE_KV as unknown as KVNamespace;
  if (!kv) {
    throw new Error('KV namespace not found');
  }
  return kv.get(key);
}

export async function setKVValue(key: string, value: string) {
  const env = await getEnv();
  const isLocal = env.NEXT_PUBLIC_WEBAPP_ENV === 'local';
  if (isLocal) {
    return;
  }

  const kv = env.NEXT_INC_CACHE_KV as unknown as KVNamespace;
  if (!kv) {
    throw new Error('KV namespace not found');
  }
  return kv.put(key, value);
}

export async function deleteKVValue(key: string) {
  const env = await getEnv();
  const isLocal = env.NEXT_PUBLIC_WEBAPP_ENV === 'local';
  if (isLocal) {
    return;
  }

  const kv = env.NEXT_INC_CACHE_KV as unknown as KVNamespace;
  if (!kv) {
    throw new Error('KV namespace not found');
  }
  return kv.delete(key);
}
