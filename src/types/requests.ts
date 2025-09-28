import { z } from 'zod';

export const FileUploadSchema = z.object({
  file: z.instanceof(File),
  userId: z.string().optional().default('anonymous'),
});

export const ProcessFileSchema = z.object({
  fileId: z.string(),
  r2Key: z.string(),
  mimeType: z.string(),
  userId: z.string(),
});

export const FileStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'error']),
  pageCount: z.number().nullable(),
  sizeBytes: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListFilesQuerySchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
});

export type FileUploadInput = z.infer<typeof FileUploadSchema>;
export type ProcessFileInput = z.infer<typeof ProcessFileSchema>;
export type FileStatus = z.infer<typeof FileStatusSchema>;
export type ListFilesQuery = z.infer<typeof ListFilesQuerySchema>;