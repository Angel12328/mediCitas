# AGENTS.md

## Project Structure

Two-package repo (not a monorepo tool — just two independent `package.json`s):

- **Root** = Fastify API (`medicitas-api`) — ESM, Prisma 7, PostgreSQL
- **`web/`** = Next.js 15 frontend (`web`) — React 19, Tailwind v4, shadcn/ui

## Key Commands

### API (root)

```bash
npm run dev          # tsx watch src/main.ts — port 3000
npm run build        # tsc → dist/
npm run lint         # eslint src
npm run format       # prettier --write "src/**/*.ts"
npm run test         # vitest run (serial, uses real DB)
npm run test:watch   # vitest (watch mode)
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

### Frontend (`web/`)

```bash
npm run dev          # next dev --turbopack — port 3000
npm run build        # next build --turbopack
npm run lint         # eslint
npm run test         # vitest run (jsdom + MSW)
npm run test:watch
npm run test:e2e     # playwright test — port 3002
npm run api:schema   # regenerate openapi-typescript types from running API
```

## Architecture Notes

### API

- Entry: `src/main.ts` → `src/app.ts` (buildApp factory)
- Modules: `src/modules/{auth,users,locations,employees,doctors,patients,contacts,appointments}/`
- Shared: `src/shared/{auth,config,database,errors,logging,mail,pagination,validation}/`
- Prisma client generated to `src/generated/prisma/` (excluded from eslint + tsconfig)
- All imports use `.js` extension (ESM requirement with NodeNext resolution)
- Swagger docs at `/docs` (dev only, disabled in production)

### Frontend

- App Router (`src/app/`)
- Path alias: `@/` → `./src/`
- shadcn/ui: new-york style, Radix UI, lucide icons
- State: TanStack React Query, React Hook Form, Zod v4
- E2E: Playwright at `web/e2e/tests/`
- MSW for API mocking in unit tests
- `next.config.ts` rewrites `/api/v1/*` → production API (`https://medicitas-api.onrender.com`)

## Testing

### API tests (`vitest.config.ts`)

- **Run serially** (`fileParallelism: false`) — tests share one DB
- Setup file: `tests/setup.ts` (loads dotenv, sets `NODE_ENV=test`)
- To run a single file: `npx vitest run tests/path/to/file.test.ts`
- DB must be running (Docker on port 5433)

### Frontend tests (`web/vitest.config.ts`)

- jsdom environment, globals enabled, MSW in setup
- Coverage thresholds: lines 60%, branches 50%, functions 60%
- Playwright uses port 3002, Chromium only

## Database

- PostgreSQL 17 via Docker Compose (`docker-compose.yml`)
- Host port **5433** (mapped to 5432 inside container)
- Prisma 7 with `@prisma/adapter-pg` driver adapter
- Schema: `prisma/schema.prisma`
- Seed: `npm run db:seed` (runs `tsx prisma/seed.ts`)
- All tables use UUID PKs, soft delete (`deleted_at`), audit columns (`created_at`, `updated_at`)

## Code Style

- **Prettier**: single quotes, semicolons, trailing commas, 100-char width, LF line endings
- **ESLint rules that trip people up**:
  - `no-console: error` — use logger, not console.log
  - `@typescript-eslint/explicit-function-return-type: warn` — every function needs a return type
  - `@typescript-eslint/no-unused-vars` — prefix unused with `_`
  - `src/modules/appointments/**` has `@typescript-eslint/ban-ts-comment: off` (exception)
- TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`, target ES2022

## Gotchas

- **Prisma 7** uses `@prisma/adapter-pg` — not the old direct connection. Config in `prisma.config.ts`.
- **`npm run dev` for API** uses `tsx watch` — no build step needed, but `.env` must be present.
- **Playwright baseURL** defaults to `http://localhost:3002` — ensure the frontend dev server is running there first.
- **API tests depend on a live database** — no mocking of Prisma. Run `docker compose up db` before tests.
- **Dockerfile** copies pre-built `dist/` — run `npm run build` before `docker build`.
- **`.env`** contains dev secrets — never commit production values.
