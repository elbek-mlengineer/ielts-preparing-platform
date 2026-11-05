# IELTS preparation platform

## Local setup

Requires Node.js and a running PostgreSQL server. Create `.env` from `.env.example`, then set:

- `DATABASE_URL`: your PostgreSQL connection string.
- `AUTH_SECRET`: a random secret of at least 32 characters. Changing it signs out existing sessions. Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
- `GEMINI_API_KEY`: a Gemini Developer API key, available only to the server.
- `GEMINI_WRITING_MODEL`: the model to use for writing feedback; defaults to `gemini-3.6-flash`.

```sh
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Open http://localhost:3000, register an account, sign in and open `/writing`.
Review schema changes before running `db push` against an existing database. The seed updates the two bundled practice prompts by their fixed IDs; other prompts remain untouched. Task 1 uses clearly labelled fictional practice data.

## Writing behavior

The server loads published prompts and records a 20-minute Task 1 or 40-minute Task 2 attempt when the learner starts. Refreshing resumes the existing attempt. Drafts are stored in the browser; submitted essays are stored in PostgreSQL before the AI request. The editor locks and attempts submission at the deadline, with a five-second server allowance for network transit. At least 20 words are required for assessment; the task's recommended lengths remain 150/250 words.

Retries assess the first submitted text, including after the deadline. Concurrent requests cannot save duplicate assessments. AI output is validated and the overall writing band is recalculated from its four criteria. Provider failures return a retryable error and never produce a fabricated score. A single task's band is not saved as a complete IELTS overall band. Assessments are visible only to their owner. Historical fallback assessments are hidden from the history and labelled unreliable if opened directly.

Task 1 prompts must include structured `chartDataJson` with `columns` and equal-width `rows`, displayed as an accessible table and supplied to the evaluator. Prompts without required content cannot be started.

AI scores are estimates, not official IELTS results. Browser storage is optional and can be cleared by the browser. API keys and essay text must never be placed in client code or logs.

Tailwind uses standard PostCSS. Development and production use webpack because the installed Turbopack version fails to start its CSS worker on this Windows environment. System fonts avoid external font downloads during build.

## Validation

```sh
npm run lint
npm test
npm run build
```

For integration tests, point `TEST_DATABASE_URL` at a **separate test PostgreSQL database**, initialize it with this Prisma schema, then run `npm run test:integration`. For example in PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:55432/ielts_test?schema=public'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npx prisma db push
npm run test:integration
```

Integration tests use the real database and a deterministic AI stub; they cover authentication, ownership, deadlines, frozen submissions, retries, transaction persistence and parallel requests. Fixture users and content are removed afterwards. A live Gemini call is a separate check and requires a valid key and provider connectivity.
