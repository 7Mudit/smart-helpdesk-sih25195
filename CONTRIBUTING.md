# Development Guide

## Setup

```bash
npm install
npm run setup   # generate client, create DB, seed demo data
npm run dev
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server on :3000 |
| `npm run build` | Production build |
| `npm test` | Unit + integration tests |
| `npm run test:coverage` | Tests with the coverage gate |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:reset` | Drop and re-seed the database |

## Where things live

| Path | Contents |
|---|---|
| `lib/automation/` | Pure decision logic. **100% test coverage required.** |
| `lib/services/` | Orchestration — transactions, audit events, side effects |
| `lib/rbac.ts` | The permission matrix. Every authorisation decision goes through `can()`. |
| `app/api/` | Route handlers. Thin — parse, authorise, delegate to a service. |
| `app/(app)/` | Authenticated pages. Server Components query Prisma directly. |
| `components/ui/` | Design-system primitives |

## Conventions

**Adding an enum value** — edit `lib/constants.ts` only. The union type, the Zod schema and the
display labels all derive from it.

**Adding a permission** — add it to `PERMISSIONS` in `lib/rbac.ts` and add a case to
`tests/rbac.test.ts`. Never check `user.role === 'ADMIN'` inline; always go through `can()`.

**Adding automation logic** — it belongs in `lib/automation/` only if it is pure: no database,
no network, no `new Date()` without an injectable override. Write the test first; the coverage
gate will fail the build otherwise.

**Filtering by role** — always in the SQL `where` clause, never after fetching. Data the user
may not see must never leave the database.

## Testing

`lib/automation/**` is gated at 100% statements. Everything there is a pure function, so there
is no excuse for an uncovered branch — and a bug in that layer silently misroutes tickets rather
than throwing a visible error.

Integration tests in `tests/integration/` run against the seeded SQLite database and cover the
authorisation boundaries: employee scoping, internal-note filtering, and the ticket lifecycle.

## Switching to PostgreSQL

Change the `provider` in `prisma/schema.prisma` to `postgresql`, set `DATABASE_URL`, then:

```bash
npx prisma db push
npm run db:seed
```

No application code changes.
