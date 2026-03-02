# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev                        # Next.js dev server (Turbopack, port 3000) — loads .env automatically
pnpm dev:all                    # Start Next.js + Python backend concurrently
pnpm build                      # Production build
pnpm lint                       # Lint all packages

# Database (Drizzle)
pnpm drizzle:push               # Push schema to database (no migration history)
pnpm drizzle:generate           # Generate migration files
pnpm drizzle:studio             # Open Drizzle Studio GUI

# Tests (Vitest)
pnpm test                       # Run all tests once
pnpm --filter app test          # Run app-main tests only
# Run a single test file:
pnpm --filter app with-env vitest run src/app/api/__tests__/myfile.test.ts

# Python backend
pnpm python:install             # Install Python deps with uv
pnpm python:dev                 # FastAPI dev server on port 8000

# Azure Functions
cd azure-functions && func start   # Run functions locally
```

## Architecture

### Monorepo Layout
```
packages/
  app-main/          # Next.js 16 app — all routes, API, DB access
  common/            # Shared UI components, hooks, utils (no server code)
  python-backend/    # FastAPI + LangGraph AI backend
azure-functions/     # Cron jobs (progress checks, notifications)
scripts/             # generate-types.ts: Python schemas → TS types
```

### app-main Structure
- `src/app/(platform)/` — authenticated route group, guarded by `requireAuthGuard()` in the layout
- `src/app/api/` — API routes; every handler calls `requireAuth()` as the first step
- `src/db/schema/` — Drizzle table definitions, `index.ts` re-exports everything
- `src/db/client.ts` — Drizzle + `node-postgres` pool; supports PgBouncer via `USE_PGBOUNCER=true`
- `src/lib/auth.ts` — Better Auth server config (Drizzle adapter, 2FA, Azure email)
- `src/lib/auth-client.ts` — Better Auth React client (import `authClient` for client-side calls)
- `src/lib/authorization.ts` — `requireAuth()`: handles session, role checks, rate limiting, dev bypass
- `src/lib/auth-guard.ts` — `requireAuthGuard()`: server component guard used in `(platform)/layout.tsx`
- `src/lib/stores/` — Zustand stores: `userStore`, `chatStore`, `uiStore`, `modalStore`

### Database (Drizzle + PostgreSQL)
**Not Prisma** — SETUP.md and README are outdated. The ORM is Drizzle with `drizzle-kit`. Schema tables:
- Auth: `users`, `sessions`, `accounts`, `verifications`, `twoFactors`, `loginHistory`
- Goals: `userGoalSets`, `goals`, `goalProgressEstimates`, `goalUpdates`
- Expert AI: `expertReviews`, `goalExpertSelections`
- Teams: `teams`, `teamMembers`, `teamInvitations`
- Events: `teamEvents`, `teamEventAttendees`
- Activities: `dailyUpdates`, `extractedActivities`
- Chat: `chatSessions`, `chatMessages`, `updateFollowUps`
- Gamification: `achievements`, `userAchievements`
- Misc: `notificationSettings`, `adminSettings`, `goalGuides`, `userTodos`, `auditLogs`

Use `db.query.*` for relational queries; `db.insert/update/delete` for mutations. Always import `db` from `@/lib/db`.

### Auth & Authorization
- **Domain restriction**: sign-up/sign-in blocked for non-`koning.ca` emails via `isAllowedDomain()`
- **2FA**: enforced server-side in `requireAuthGuard()`; session age tracked via `lastTwoFactorAt`
- **Roles**: `user` | `admin` — checked via `requireAuth({ permissions: { role: "admin" } })`
- **Dev bypass**: set `AUTH_BYPASS_ENABLED=true` in `.env` to skip auth (non-production only)
- **Rate limiting**: Upstash Redis via `requireAuth({ rateLimit: "expensive_llm" })` — tiers defined in `src/lib/rate-limit/`

### AI Systems
**Python backend** (`packages/python-backend/src/assistant/`):
- `agent/agent.py` — LangGraph `create_react_agent` with weather/commute/GO Train tools
- `graphs/expert_council.py` — Multi-expert goal review workflow
- `api/` — FastAPI routers; Next.js proxies `/api/chat` here

**Next.js LangGraph** (TypeScript, in app-main API routes):
- Goal validation: `/api/goals/validate`
- Expert review: `/api/goals/experts/review`
- Activity extraction: `/api/daily-updates/extract`
- The "Expert Council" has 8 AI roles (Progress Tracker, Motivation Coach, Strategic Planner, etc.)

### common Package
Import via `@common/components/ui/ComponentName` (note: PascalCase filenames). Transpiled by Next.js via `transpilePackages: ["common"]` in `next.config.ts`. Contains shadcn/ui components, 36+ hooks, 60+ utilities.

### Azure Functions
Serverless cron for progress checks and notifications. Authenticates with Next.js via `CRON_SECRET` header. Deploy with `func azure functionapp publish <name>`.

## Key Patterns

**API route pattern:**
```typescript
export async function POST(request: Request) {
  const authResult = await requireAuth({ rateLimit: "standard_llm" });
  if (!authResult.success) return authResult.response;
  const { user } = authResult;
  // ... handler logic
}
```

**Goal lifecycle:** `draft` → `pending_review` → `pending_approval` → `active` → `completed`/`abandoned`. Goals are editable within 14 days of `startDate` (`editableUntil` field).

**Environment**: All scripts use `dotenv -e ../../.env` to inject env vars. Use `getRequiredEnv()` from `@/lib/environment` for required vars that throw on missing.

**pnpm catalog**: Shared dependency versions are in `pnpm-workspace.yaml` under `catalog:`. Use `catalog:` as the version when adding a cataloged dep to multiple packages.
