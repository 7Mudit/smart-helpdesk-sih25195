# Smart Helpdesk — IT Service Management Portal

**Smart India Hackathon · Problem Statement SIH25195**
**Organisation:** Ministry of Power (MoP) · **Category:** Smart Automation · **Theme:** Software

A production-grade IT service desk that replaces phone calls, emails and walk-ins with a single
tracked system — and, critically, **triages tickets automatically** so no human coordinator sits
in the middle of the queue.

---

## Quick start

Three commands. No Docker, no cloud account, no API key.

```bash
npm install
npm run setup
npm run dev
```

Open **http://localhost:3000**.

`npm run setup` generates the Prisma client, creates the SQLite database and seeds it with 220
realistic tickets, 18 users, 12 knowledge-base articles, 4 SLA policies and 6 routing rules.

### Demo accounts

The login page has **one-click buttons for all three roles** — you never need to type these.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@mop.gov.in` | `password123` |
| Agent | `agent@mop.gov.in` | `password123` |
| Employee | `employee@mop.gov.in` | `password123` |

---

## The problem

Ministry of Power runs a large IT estate across NTPC, POWERGRID, NHPC, DVC and the regional load
despatch centres. Today an employee with an IT problem calls a number, sends an email, or walks
to the IT room. The consequences:

- **No record.** Nobody can say how many issues were raised last month, or how long they took.
- **No prioritisation.** A locked account and a substation network outage join the same queue.
- **A human bottleneck.** One coordinator manually reads and forwards every request.
- **No institutional memory.** The same twenty questions are answered from scratch every week.
- **No management visibility.** No MTTR, no backlog trend, no workload data, no SLA compliance.

## The solution

A role-based ticketing portal where the **automation layer does the triage**:

1. An employee describes their problem in plain language.
2. The system classifies it — category and priority — and explains which words drove the decision.
3. A rules engine routes it to the right department, then load-balances across available agents.
4. An SLA clock starts, counting **working hours only**, and escalates automatically on breach.
5. Before submitting, the employee is shown relevant knowledge-base articles and warned about
   duplicates — deflecting tickets that never needed to be raised.

Everything is auditable: every state change writes an immutable event, so any ticket's full
history can be reconstructed — a hard requirement for a government IT department.

---

## What makes it "Smart Automation"

The automation runs as **deterministic TypeScript with no external dependency**. No LLM API, no
Python service, no model download. It behaves identically on a laptop and in the cloud, works
with no internet, and is covered by 373 tests at 100% statement coverage on the automation layer.

That is a deliberate engineering decision, not a shortcut. An IT helpdesk for critical power
infrastructure cannot have its triage stop working because an API key expired or a network link
went down.

### Auto-classification
Weighted keyword lexicons across 8 categories, tuned for Indian power-sector vocabulary — SAP
transaction codes, DSC tokens, e-tendering portals, substation systems. Title matches count
double. Below a confidence floor of 0.35 the system declines to guess and routes to human
triage rather than filing a confident wrong answer. The UI shows the matched terms, so the
decision is explainable rather than a black box.

### Auto-routing
An admin-editable rules engine. Rules evaluate in priority order, first match wins, and each
rule can match on category, keywords, priority, or a combination. When a rule names no specific
agent, the ticket is **load-balanced** to whoever in that department has the fewest open
tickets, tie-broken by who has been idle longest.

### SLA engine with business-hours mathematics
Deadlines count only working minutes — Monday to Friday, 09:00 to 18:00. A low-priority ticket
raised on Friday evening is due mid-week, not over the weekend. The clock **pauses** while a
ticket is On Hold awaiting user input and resumes when they reply, so agents are not penalised
for delays outside their control. Breaches escalate automatically: priority rises one level and
the service manager is notified.

### Duplicate detection
Token-set Jaccard similarity blended with character-bigram overlap, run against the requester's
own open tickets from the last seven days. Above the threshold the user sees a warning with a
link to the existing ticket — but is never blocked from submitting, because a false positive
must not prevent someone reporting a real problem.

### Knowledge-base deflection
TF-IDF ranking suggests articles live as the user types their description. Articles opened from
that widget are counted, and the dashboard reports **tickets deflected** — a measurable
reduction in queue volume rather than a claimed one.

---

## Features

### For employees
- Raise tickets with live category/priority prediction, duplicate warnings and article suggestions
- Track every ticket with a full timeline of comments and status changes
- SLA countdown showing exactly when a response is due
- Reopen a ticket if the problem returns
- Rate the resolution — the ratings feed the CSAT metric on the dashboard
- Search the knowledge base

### For agents
- Role-scoped queue with filters on status, priority, category, department and assignee
- Full-text search across ticket numbers, titles and descriptions
- **Internal work notes** invisible to the requester, filtered out in the database query itself
- Status, priority, category and assignee controls with automatic audit logging
- SLA progress bars showing time remaining or overdue
- Related knowledge-base articles surfaced on every ticket

### For administrators
- Analytics dashboard: 6 KPI tiles, volume trend, category and priority breakdowns, agent
  workload, SLA compliance gauge, recent breaches, and an automation-impact panel
- User management with roles and departments
- SLA policy editor
- Visual routing-rule builder with reordering
- Knowledge-base authoring

---

## Architecture

```
Next.js 15 App Router  ──  one process serves both UI and API
        │
        ├── app/(app)/**          Server Components — read Prisma directly
        ├── app/api/**            Route handlers — Zod-validated, RBAC-guarded
        │
        ├── lib/automation/**     Pure functions. No I/O. 100% test coverage.
        │     classifier · router · sla · duplicates · kb-suggest · ticket-number
        │
        ├── lib/services/**       Orchestration — transactions, events, side effects
        ├── lib/rbac.ts           The single permission matrix
        └── lib/auth.ts           JWT in an httpOnly cookie
              │
        Prisma ORM
              │
     SQLite (local)  ·  PostgreSQL (production) — same schema
```

The automation layer is deliberately **pure**: it takes data in and returns decisions, touching
no database and no network. That is what makes 100% test coverage achievable and what makes the
behaviour identical in every environment.

Full detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | One deployable unit — UI and API together |
| Language | TypeScript (strict) | No `any`, errors caught at compile time |
| Database | Prisma + SQLite / Postgres | Zero-setup locally, production-ready in the cloud |
| Styling | Tailwind CSS | Token-driven light and dark themes |
| Charts | Recharts | |
| Auth | `jose` JWT + `bcryptjs` | No third-party auth provider to configure |
| Validation | Zod | Every API boundary validated |
| Testing | Vitest + Playwright | 250 unit tests, E2E journeys |

---

## Testing

```bash
npm test              # unit + integration
npm run test:coverage # with the coverage gate
npm run test:e2e      # Playwright end-to-end
npm run typecheck     # tsc --noEmit
```

The coverage gate requires **100% statements on `lib/automation/**`**. The business logic that
decides how a ticket is triaged is exhaustively tested — including the awkward cases: SLA
deadlines landing exactly on 18:00, Friday-evening tickets rolling to Monday, routing when no
agent is available, and classifier input that is pure punctuation.

---

## Security

- **The app refuses to start with a placeholder `JWT_SECRET`.** `npm run setup` generates a
  random one per machine, so a secret is never committed to the repository — a committed secret
  is a public one, and anyone could use it to forge an admin session
- The SLA sweep endpoint requires either an admin session or a matching `x-cron-secret` header,
  and is POST-only so it cannot be triggered cross-site
- Passwords hashed with bcrypt (cost 10); the API never returns a hash
- JWT stored in an httpOnly, sameSite=lax cookie — unreadable to JavaScript, so XSS cannot steal it
- Every session re-validates against the database, so a deactivated user loses access immediately
- Every permission decision routes through one matrix in `lib/rbac.ts`, unit-tested across every
  role × permission combination
- Employees are restricted to their own tickets in the **SQL where clause**, not in the UI
- Internal work notes are excluded at the query level for users without permission
- Every API input parsed through Zod; Prisma's parameterised queries prevent SQL injection
- The audit trail is append-only — events are never updated or deleted

---

## Deployment

Free tier, roughly ten minutes.

### 1. Database — [Neon](https://neon.tech)
Create a project and copy the connection string.

### 2. Switch Prisma to Postgres
In `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 3. Deploy — [Vercel](https://vercel.com)
Import the repository and set two environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | The Neon connection string |
| `JWT_SECRET` | A random string of 32+ characters |

### 4. Seed production
```bash
DATABASE_URL="<neon-url>" npx prisma db push
DATABASE_URL="<neon-url>" npm run db:seed
```

### 5. SLA sweep (optional)
`vercel.json` schedules `/api/cron/sla-sweep` hourly to detect breaches and escalate. The
endpoint is idempotent, so running it repeatedly is safe.

---

## Project layout

```
app/
  (app)/            Authenticated pages sharing the app shell
    dashboard/      Analytics
    tickets/        List · create · detail
    kb/             Knowledge base
    admin/          Users · SLA · routing rules · KB editor
  api/              Route handlers
  login/
components/
  ui/               Design-system primitives
  layout/           App shell, sidebar, topbar
  charts/           Recharts wrappers
lib/
  automation/       The smart layer — pure, 100% covered
  services/         Orchestration
  rbac.ts           Permission matrix
prisma/
  schema.prisma
  seed.ts           Deterministic — identical output on every machine
tests/
docs/
```

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | **Five-minute click-by-click walkthrough.** Start here before presenting. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Data model, automation internals, request lifecycle |
| [`docs/SIH_PRESENTATION.md`](docs/SIH_PRESENTATION.md) | Problem, solution, USP, impact, scalability |
| [`SPEC.md`](SPEC.md) | Full functional specification |
| [`docs/DESIGN_PROMPTS.md`](docs/DESIGN_PROMPTS.md) | Ready-to-paste prompts for the submission deck, diagrams and poster |

---

## Troubleshooting

**Port 3000 in use** — `npm run dev -- -p 3001`

**Database errors after pulling changes** — `npm run db:reset` (drops and re-seeds)

**`JWT_SECRET` error on startup** — run `npm run setup`, which generates one for you

**Charts not rendering** — hard-refresh; Recharts mounts client-side only

---

Built for Smart India Hackathon 2025 · Problem Statement SIH25195 · Ministry of Power
