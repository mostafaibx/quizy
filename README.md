# Quizy - Quiz Application with Drizzle ORM & Cloudflare D1

This is a quiz application built with Next.js, Drizzle ORM, and Cloudflare D1 (SQLite).

## Database Setup

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Cloudflare account with D1 database created
- Wrangler CLI installed (`npm i -g wrangler`)

### Environment Variables

Create a `.env` file with:

```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_DATABASE_ID=your-d1-database-id
CLOUDFLARE_D1_TOKEN=your-d1-token
```

### Database Migration & Seeding

#### 1. Generate Migrations

Generate migration files from the schema:

```bash
npx drizzle-kit generate
```

#### 2. Push Migrations to D1

Apply migrations to your D1 database:

```bash
npx drizzle-kit push
```

Or using Wrangler directly:

```bash
wrangler d1 execute YOUR_DB_NAME --file=./drizzle/migrations/0000_init.sql
```

#### 3. Run Seed Script

To seed the database with sample data, you'll need to create a worker script that imports the seed function:

```typescript
// worker-seed.ts
import { seed } from './scripts/seed';

export default {
  async fetch(request: Request, env: Env) {
    await seed(env.DB);
    return new Response('Seeded successfully');
  }
}
```

Then deploy and run it:

```bash
wrangler dev worker-seed.ts --local
# Visit the URL to trigger seeding
```

### Example: Querying a Quiz with All Questions

Here's how to query a quiz with all its questions and answer keys using Drizzle's relational queries:

```typescript
import { createD1Client } from './src/db/client';
import { eq } from 'drizzle-orm';
import { quizzes } from './src/db/schema';

// In your Cloudflare Worker or Next.js API route
export async function getQuizWithQuestions(d1: D1Database, quizId: string) {
  const db = createD1Client(d1);

  const quiz = await db.query.quizzes.findFirst({
    where: eq(quizzes.id, quizId),
    with: {
      questions: {
        with: {
          options: true,           // For MCQ/True-False
          shortAccept: true,       // For short text
          numericKey: true,        // For numeric
          orderItems: true,        // For ordering
          pairs: true,             // For matching
          blanks: true,            // For fill-blank
          blankAccept: true,       // For fill-blank answers
        },
        orderBy: (questions, { asc }) => [asc(questions.position)],
      },
      file: true,
      createdByUser: true,
    },
  });

  return quiz;
}

// Example usage in API route
export async function GET(request: Request, env: { DB: D1Database }) {
  const quizId = 'some-quiz-id';
  const quiz = await getQuizWithQuestions(env.DB, quizId);

  return Response.json(quiz);
}
```

### Database Schema Overview

The database includes the following main tables:

- **users**: User accounts
- **files**: Uploaded PDF files
- **quizzes**: Quiz metadata and settings
- **questions**: Question definitions with 8 types (MCQ single/multi, true/false, short text, numeric, ordering, matching, fill-blank)
- **question_options**: MCQ and true/false options
- **question_short_accept**: Acceptable answers for short text
- **question_numeric_key**: Numeric answers with tolerance
- **question_order_items**: Correct order for ordering questions
- **question_pairs**: Matching pairs
- **question_blanks** & **question_blank_accept**: Fill-in-the-blank answers
- **quiz_attempts**: User quiz attempts
- **attempt_answers**: User answers to questions
- **quiz_imports**: Raw JSON import tracking

### Helper Views

The database includes several views for quick answer key access:

- `v_answer_key_mcq`: MCQ correct answers
- `v_answer_key_short`: Short text acceptable answers
- `v_answer_key_numeric`: Numeric answers with tolerance
- `v_answer_key_ordering`: Correct sequence
- `v_answer_key_matching`: Matching pairs
- `v_answer_key_fill`: Fill-blank acceptable answers

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Deployment

Deploy to Cloudflare Pages:

```bash
npm run build
wrangler pages deploy ./out
```

Make sure your D1 database binding is configured in your `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "your-database-name"
database_id = "your-database-id"
```
