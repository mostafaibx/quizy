import type { AppEnv } from '@/types/cloudflare';
import type { FileStorageResult, FileMetadata, ParsedContentStorage } from '@/types/file.types';

export async function storeFile(
  env: AppEnv,
  fileId: string,
  file: File
): Promise<FileStorageResult> {
  if (!env.FILES) {
    throw new Error('R2 bucket (FILES) is not configured');
  }

  const r2Key = `uploads/${fileId}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();

  await env.FILES.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      originalName: file.name,
    } satisfies FileMetadata,
  });

  return { r2Key, arrayBuffer };
}

export async function getFile(
  env: AppEnv,
  r2Key: string
): Promise<ArrayBuffer | null> {
  const object = await env.FILES.get(r2Key);
  if (!object) return null;
  return object.arrayBuffer();
}

export async function deleteFile(
  env: AppEnv,
  r2Key: string
): Promise<void> {
  await env.FILES.delete(r2Key);
}

export async function storeParsedContent(
  env: AppEnv,
  fileId: string,
  content: ParsedContentStorage
): Promise<void> {
  const key = `parsed/${fileId}.json`;
  await env.FILES.put(
    key,
    JSON.stringify(content),
    {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { originalFileId: fileId },
    }
  );
}

export async function getParsedContent(
  env: AppEnv,
  fileId: string
): Promise<ParsedContentStorage | null> {
  const object = await env.FILES.get(`parsed/${fileId}.json`);
  if (!object) return null;
  return object.json() as Promise<ParsedContentStorage>;
}

export async function deleteParsedContent(
  env: AppEnv,
  fileId: string
): Promise<void> {
  await env.FILES.delete(`parsed/${fileId}.json`);
}

export async function checkContentExists(
  env: AppEnv,
  fileId: string
): Promise<boolean> {
  const object = await env.FILES.head(`parsed/${fileId}.json`);
  return !!object;
}