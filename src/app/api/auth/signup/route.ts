import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SignUpRequest, SignUpResponse } from "@/types/auth.types";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone } = await request.json() as SignUpRequest;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then(rows => rows[0]);

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    const user = await createUser(email, password, name, phone);

    const response: SignUpResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}