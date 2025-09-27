import { honoHandler } from '@/server/hono';

// Export handlers for all HTTP methods

export const GET = honoHandler;
export const POST = honoHandler;
export const PUT = honoHandler;
export const DELETE = honoHandler;
export const PATCH = honoHandler;