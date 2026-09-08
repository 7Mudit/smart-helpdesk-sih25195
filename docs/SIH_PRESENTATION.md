# Smart Helpdesk — Presentation Notes

**Problem Statement SIH25195** · Ministry of Power (MoP) · Smart Automation · Software

---

## Slide 1 — The problem

**Ministry of Power runs one of India's largest public-sector IT estates** — NTPC, POWERGRID,
NHPC, DVC, and the regional load despatch centres that keep the national grid running.

When an employee has an IT problem today, they phone the IT room, send an email, or walk over.

That creates five failures:

| Failure | Consequence |
|---|---|
| **No record** | Nobody can say how many issues were raised last month or how long they took |
| **No prioritisation** | A locked password and a substation network outage sit in the same queue |
| **A human bottleneck** | One coordinator reads and forwards every single request |
| **No institutional memory** | The same twenty questions are answered from scratch every week |
| **No visibility** | No MTTR, no backlog trend, no workload data, no SLA compliance |

The cost is not just IT inefficiency. When a control-room system is down and the ticket sits
behind forty routine requests, the impact reaches grid operations.

---

## Slide 2 — Our solution

**A helpdesk where the triage happens automatically.**

An employee describes their problem in plain language. Before they even submit:

1. The system **classifies** it — category and priority — and shows which words drove the decision
2. It **warns about duplicates** among their own open tickets
3. It **suggests knowledge-base articles** that might solve it without a ticket at all

On submission:

4. A rules engine **routes** it to the right department, then **load-balances** across agents
5. An **SLA clock** starts, counting working hours only, and **escalates automatically** on breach
6. Every state change writes an **immutable audit event**

The coordinator bottleneck disappears. The employee gets a tracked ticket with a committed
response time. Management gets a dashboard that did not exist before.

---

## Slide 3 — Our USP

### 1. The automation needs no internet, no API key, and no GPU

Most helpdesk "AI" is a wrapper around a cloud LLM API. Ours is **deterministic TypeScript** —
weighted keyword lexicons, TF-IDF ranking, and business-hours date mathematics.

This was an engineering decision, not a limitation:

- **It works offline.** IT supporting critical power infrastructure cannot have its triage stop
  because a network link went down or an API key expired.
- **It costs nothing per ticket.** No inference bill that scales with volume.
- **It is deterministic.** The same ticket is always classified the same way — auditable, and
  defensible in a government context.
- **It is explainable.** We show the matched terms. A judge, or an IT manager, can see exactly
  why a ticket was classified as it was.
- **It is fully testable.** 100% statement coverage on the decision logic.

And it is not a dead end: the classifier is a single pure function. An ML model can replace it
behind the same signature without touching anything else.

### 2. It declines to guess

Below 35% confidence the classifier returns `OTHER` and routes to human triage. A system that
guesses confidently when it does not know is worse than one that admits uncertainty — a misfiled
critical ticket costs far more than one that waited for a human to read it.

### 3. SLA mathematics that reflects how offices actually work

Deadlines count **working minutes only** — Monday to Friday, 09:00 to 18:00. A ticket raised
Friday at 17:00 with an 8-hour target is due Monday at 16:00, not Saturday at 01:00.

The clock **pauses** while a ticket waits on the requester, so agents are not penalised for
delays outside their control.

### 4. Deflection is measured, not claimed

Every knowledge-base article opened from the ticket-form suggestion widget is counted. The
dashboard reports **tickets deflected** — issues resolved without ever entering the queue.

### 5. Audit-grade by construction

Append-only event log. Every assignment, status change, escalation and breach is recorded with
actor, timestamp and before/after values. Events are never updated or deleted.

---

## Slide 4 — Technical approach

```
Next.js 15 (App Router) · TypeScript strict · Prisma · SQLite → PostgreSQL
Tailwind CSS · Recharts · Zod · jose JWT · Vitest · Playwright
```

**One deployable unit.** UI and API in a single Next.js process — one Vercel deploy, no
microservices to orchestrate for a system of this size.

**Layered:**

```
app/(app)/**       Server Components — render on the server, minimal client JS
app/api/**         Route handlers — Zod-validated, RBAC-guarded
lib/services/**    Orchestration — transactions, audit events, side effects
lib/automation/**  PURE FUNCTIONS — no I/O, 100% test coverage
lib/rbac.ts        One permission matrix, exhaustively tested
```

**Local development needs three commands and no accounts:**

```bash
npm install && npm run setup && npm run dev
```

No Docker, no cloud signup, no API key, no model download.

---

## Slide 5 — Feasibility and viability

### Deployable today, at zero cost
Vercel free tier plus Neon free-tier Postgres. Two environment variables. Roughly ten minutes.

### Scales along a known path
The application is stateless — sessions live in the JWT — so it scales horizontally with no
sticky sessions. Every filterable column is indexed; dashboards use aggregate queries rather
than loading rows into memory.

| Concern | Now | At scale |
|---|---|---|
| Database | Single Postgres | Read replicas for reporting |
| Search | SQL contains | Postgres full-text or OpenSearch |
| Attachments | Filesystem | S3-compatible object storage |
| Notifications | In-app | Queue-backed email/SMS worker |
| Classification | Keyword lexicons | ML model, same function signature |

### Risks we identified, and what we did about them

| Risk | Mitigation |
|---|---|
| Classifier misfiles a critical ticket | Confidence floor routes uncertain tickets to human triage; agents can always override |
| Duplicate detection blocks a real report | It warns, never blocks |
| SLA maths wrong at edges | 70 unit tests covering weekends, boundaries, and hold accounting |
| Concurrent ticket numbers collide | Bounded retry on unique violation; the write pool is sized to SQLite's single-writer model. Verified with 30 parallel submissions |
| Employee reads another's ticket | Enforced in the SQL WHERE clause, not the UI |
| Adoption resistance | Multi-channel intake — email, phone and walk-in tickets are modelled, so the desk can log calls without forcing every user online on day one |

---

## Slide 6 — Impact

### For the employee
A tracked ticket with a committed response time, instead of an unanswered phone call. Often, an
answer from the knowledge base and no ticket at all.

### For the IT agent
A prioritised queue instead of a shouting match. Internal work notes. No coordinator relaying
messages. SLA visibility showing what genuinely needs attention now.

### For the IT manager
Data that does not exist today: volume trends, MTTR, per-agent workload, SLA compliance, CSAT,
and a measure of how much triage happened without human involvement.

### For the ministry
An auditable record of IT service delivery across the organisation — the foundation for capacity
planning, vendor accountability, and identifying which recurring problems deserve a permanent
fix rather than a repeated ticket.

### Measurable outcomes to track after deployment
- Reduction in ticket volume through knowledge-base deflection
- Reduction in mean time to first response through automatic routing
- Percentage of tickets triaged without human intervention
- SLA compliance trend
- CSAT trend

---

## Slide 7 — What is built

Not a prototype. A working system.

| | |
|---|---|
| Roles | 3 — Employee, Agent, Admin, enforced server-side |
| Screens | 13 |
| API endpoints | 23 |
| Automation modules | 6 pure, 100% covered |
| Unit tests | 373 |
| Seeded demo data | 220 tickets, 630 comments, 1,450 audit events |

**Working features:** ticket lifecycle with reopen · auto-classification with explainability ·
rules-based routing with load balancing · business-hours SLA with pause and auto-escalation ·
duplicate detection · knowledge base with deflection tracking · internal work notes · full audit
timeline · satisfaction ratings · analytics dashboard · user, SLA policy and routing-rule
administration · light and dark themes · responsive layout.

---

## Anticipated questions

**"Is this really AI, or just keyword matching?"**
It is a weighted-keyword classifier with a confidence floor, and we chose that deliberately over
an LLM. It runs offline, costs nothing per ticket, gives the same answer every time, and explains
itself. Below 35% confidence it declines to guess. An ML model can replace it behind the same
interface — we designed for that — but for this deployment context, determinism and offline
operation matter more than sophistication.

**"What happens when the classifier is wrong?"**
The agent overrides it in one click, and the change is logged as an audit event. The
classification is a starting point that saves triage time, not an irreversible decision.

**"How is this different from an off-the-shelf helpdesk?"**
Commercial tools are per-agent subscriptions with data hosted outside government control, and
their automation generally requires cloud AI services. This runs entirely on ministry
infrastructure, works offline, has no per-ticket cost, and its routing and SLA rules are
configured by IT managers in the interface rather than by a vendor.

**"Can it handle the ministry's volume?"**
Stateless application servers scale horizontally; the database is indexed on every filter column;
the automation layer does no I/O so it never becomes the bottleneck. The demo seed is 220 tickets
for readability, not a capacity limit.

**"How does it integrate with existing email?"**
The `channel` field already models email, phone and walk-in intake. An email connector would call
the same `createTicket` service function the web form uses, so all the automation applies
identically regardless of how the ticket arrived.
