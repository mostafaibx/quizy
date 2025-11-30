import { getAuthOptions } from "@/lib/auth";
import NextAuth from "next-auth";

// For App Router, we need to create handler lazily
let handlerInitialized = false;
let handlerModule: ReturnType<typeof NextAuth>;

async function initHandler() {
  if (!handlerInitialized) {
    const authOptions = await getAuthOptions();
    handlerModule = NextAuth(authOptions);
    handlerInitialized = true;
  }
  return handlerModule;
}

// Next.js 15 App Router route context type - params is now a Promise
type RouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

export async function GET(req: Request, context: RouteContext) {
  const handler = await initHandler();
  // Await params in Next.js 15+
  const params = await context.params;
  return handler(req, { params });
}

export async function POST(req: Request, context: RouteContext) {
  const handler = await initHandler();
  // Await params in Next.js 15+
  const params = await context.params;
  return handler(req, { params });
}