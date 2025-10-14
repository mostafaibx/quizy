import { getServerSession } from "next-auth";
import { getAuthOptions } from "./auth";
import { redirect } from "next/navigation";

export async function getAuthSession() {
  const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions);
  return session;
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/auth/signin");
  }
  return session;
}