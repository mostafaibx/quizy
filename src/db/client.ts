import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import * as relations from "./relations";

export function createD1Client(d1: D1Database) {
  return drizzle(d1, {
    schema: {
      ...schema,
      ...relations,
    },
  });
}

export type D1Client = ReturnType<typeof createD1Client>;