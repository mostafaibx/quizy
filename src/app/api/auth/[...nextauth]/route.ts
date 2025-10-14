import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

async function handler(req: NextRequest) {
  const authOptions = await getAuthOptions();
  return NextAuth(authOptions)(req, req as NextRequest);
}

export { handler as GET, handler as POST };