import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null; image?: string | null }
  }
}

declare module "next-auth/jwt" {
  interface JWT { id: string }
}

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(await getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      credentials: {
        email: { type: "email" },
        password: { type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = await getDb();
        const user = await db.select().from(users)
          .where(eq(users.email, credentials.email))
          .limit(1).then(r => r[0]);

        if (!user?.password || !await bcrypt.compare(credentials.password, user.password)) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: ({ session, token }) => {
      session.user.id = token.id;
      return session;
    },
    signIn: async ({ user, account }) => {
      if (account?.provider !== "credentials") {
        const { assignFreePlanToUser } = await import("@/server/services/subscription.service");
        await assignFreePlanToUser(user.id);
      }
      return true;
    },
  },
  pages: { signIn: "/auth/signin" },
};

export const createUser = async (email: string, password: string, name?: string) => {
  const db = await getDb();
  const userId = nanoid();

  const [user] = await db.insert(users).values({
    id: userId,
    email,
    password: await bcrypt.hash(password, 12),
    name,
  }).returning();

  const { assignFreePlanToUser } = await import("@/server/services/subscription.service");
  await assignFreePlanToUser(userId);

  return user;
};