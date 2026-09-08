# Smart Helpdesk Ticketing Solution for IT Services
**SIH25195 · Ministry of Power (MoP) · Smart Automation · Software**

---

## 1. Problem framing

Ministry of Power runs large IT estates (NTPC, POWERGRID, NHPC, DVC, regional load despatch
centres). Employees raise IT issues — laptop won't boot, VPN down, SAP access needed, printer
jammed, email quota full — through phone calls, emails and walk-ins. The result:

- No single record of what was raised, by whom, when.
- No SLA tracking, so critical issues sit unattended while trivial ones get fixed first.
- Every ticket is routed manually by a coordinator who becomes a bottleneck.
- The same 20 questions get asked every week; nobody builds a knowledge base.
- Management has zero visibility: no MTTR, no backlog trend, no agent workload data.

**"Smart Automation" is the category**, so the differentiator is not the ticket CRUD — it is
what the system does *without a human*: classify, prioritise, route, escalate, suggest
resolutions, and detect duplicates.

---

## 2. Users and roles

| Role | Who | Can do |
|---|---|---|
| `EMPLOYEE` | Any MoP staff member | Raise tickets, track own tickets, reply, reopen, rate resolution, search KB |
| `AGENT` | IT support engineer | Work assigned queue, reply, change status, escalate, log worknotes, resolve |
| `ADMIN` | IT service manager | Everything + user management, SLA policy config, routing rules, KB authoring, full analytics |

Role escalation is server-enforced on every route. An `EMPLOYEE` must never read another
employee's ticket; an `AGENT` sees only tickets in the departments they cover plus unassigned
ones; `ADMIN` sees all.

---

## 3. Core domain model

### Ticket
| Field | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `ticketNumber` | string | Human-readable, `MOP-2026-00042`. Generated, unique, monotonic per year. |
| `title` | string | 5–150 chars |
| `description` | text | 10–5000 chars |
| `category` | enum | `HARDWARE` `SOFTWARE` `NETWORK` `ACCESS` `EMAIL` `SAP_ERP` `SECURITY` `OTHER` |
| `priority` | enum | `LOW` `MEDIUM` `HIGH` `CRITICAL` |
| `status` | enum | `OPEN` `IN_PROGRESS` `ON_HOLD` `RESOLVED` `CLOSED` `REOPENED` |
| `channel` | enum | `WEB` `EMAIL` `PHONE` `WALK_IN` — proves multi-channel intake |
| `createdById` | fk User | |
| `assignedToId` | fk User? | null = unassigned queue |
| `department` | enum | `IT_INFRA` `APPLICATIONS` `NETWORK_OPS` `SECURITY` `GENERAL` |
| `slaPolicyId` | fk SlaPolicy | snapshot at creation |
| `firstResponseDueAt` | datetime | computed from SLA at creation |
| `resolutionDueAt` | datetime | computed from SLA at creation |
| `firstRespondedAt` | datetime? | set on first agent-visible reply |
| `resolvedAt` | datetime? | |
| `closedAt` | datetime? | |
| `slaBreached` | boolean | denormalised for fast dashboard queries |
| `autoClassified` | boolean | true if the classifier set category/priority |
| `classifierConfidence` | float? | 0–1 |
| `satisfactionRating` | int? | 1–5, set by requester after resolution |
| `satisfactionComment` | string? | |
| `createdAt` / `updatedAt` | datetime | |

### Comment
`id`, `ticketId`, `authorId`, `body` (text), `isInternal` (bool — worknote invisible to
requester), `createdAt`. **`isInternal` filtering is a security boundary**, not a UI nicety.

### Attachment
`id`, `ticketId`, `filename`, `mimeType`, `sizeBytes`, `storagePath`, `uploadedById`, `createdAt`.

### TicketEvent (immutable audit trail)
`id`, `ticketId`, `actorId?`, `type`, `fromValue?`, `toValue?`, `metadata` (json), `createdAt`.
Types: `CREATED` `ASSIGNED` `REASSIGNED` `STATUS_CHANGED` `PRIORITY_CHANGED` `COMMENTED`
`ESCALATED` `SLA_BREACHED` `RESOLVED` `REOPENED` `CLOSED` `AUTO_CLASSIFIED` `MERGED`.
Append-only — never updated, never deleted. This is what makes it audit-grade for a ministry.

### SlaPolicy
`id`, `name`, `priority`, `firstResponseMins`, `resolutionMins`, `businessHoursOnly` (bool),
`isActive`. Seeded defaults:

| Priority | First response | Resolution |
|---|---|---|
| CRITICAL | 15 min | 4 h |
| HIGH | 1 h | 8 h |
| MEDIUM | 4 h | 24 h |
| LOW | 8 h | 72 h |

### RoutingRule
`id`, `name`, `priority` (int, evaluation order), `matchCategory?`, `matchKeywords` (string[]),
`matchPriority?`, `assignDepartment`, `assignToUserId?`, `setPriority?`, `isActive`.
First matching rule wins. Admin-editable from the UI.

### KbArticle
`id`, `slug`, `title`, `body` (markdown), `category`, `tags` (string[]), `authorId`,
`isPublished`, `viewCount`, `helpfulCount`, `notHelpfulCount`, `createdAt`, `updatedAt`.

### User
`id`, `email`, `passwordHash`, `name`, `role`, `department?`, `employeeCode?`, `isActive`,
`createdAt`.

---

## 4. The "Smart Automation" layer — the differentiator

All of it is **deterministic, dependency-free TypeScript**. No LLM API, no Python service, no
model download. It runs identically on a laptop and on Vercel, works offline, and is fully
unit-testable — which is exactly why it survives a live demo.

### 4.1 Auto-classification (`lib/automation/classifier.ts`)
Weighted keyword scoring over title + description.

- Category: each of the 8 categories has a keyword lexicon with weights (e.g. `NETWORK`:
  `vpn` 3, `wifi` 3, `internet` 2, `lan` 2, `dns` 3, `proxy` 2, `firewall` 2). Title matches
  count double. Highest score wins; confidence = `topScore / (totalScore || 1)`.
- Priority: severity lexicon (`down` `outage` `production` `urgent` `cannot work` `entire team`
  → CRITICAL; `blocked` `asap` `deadline` → HIGH) plus escalation for multi-user impact phrases
  ("whole department", "everyone in").
- Below a confidence floor of `0.35` it returns `OTHER`/`MEDIUM` and marks
  `autoClassified: false` so a human triages. Honest degradation, not fake certainty.

### 4.2 Auto-routing (`lib/automation/router.ts`)
Evaluates active `RoutingRule` rows in `priority` order. First match assigns department and
optionally a specific agent. If a rule names no agent, falls through to **load-balanced
assignment**: among active agents in that department, pick the one with the fewest open
tickets, tie-broken by longest-idle. Deterministic given the same DB state → testable.

### 4.3 SLA engine (`lib/automation/sla.ts`)
- On create: look up the active policy for the ticket's priority, compute
  `firstResponseDueAt` / `resolutionDueAt`. If `businessHoursOnly`, add only working minutes
  (Mon–Fri 09:00–18:00 IST), skipping weekends. **This calendar math is the highest-value
  unit-test target** — write the tests first.
- On priority change: recompute both deadlines from the original `createdAt`.
- Clock stops while status is `ON_HOLD`; elapsed hold time is added back to the deadlines.
- A `/api/cron/sla-sweep` route marks breaches, writes `SLA_BREACHED` events and escalates
  (bump priority one level, notify admin). Idempotent — safe to hit repeatedly.

### 4.4 Duplicate detection (`lib/automation/duplicates.ts`)
On submit, token-set Jaccard similarity + bigram overlap against the requester's open tickets
from the last 7 days. Above `0.55` the UI warns *"This looks similar to MOP-2026-00031"* with a
link, but never blocks submission.

### 4.5 KB suggestion (`lib/automation/kb-suggest.ts`)
TF-IDF over published articles, cosine-ranked against the draft ticket text. Shown live in the
ticket form ("Before you submit, these might help") and to the agent on the ticket page.
Deflection — a KB article opened from this widget that leads to abandoning the draft — is
counted and shown on the dashboard as **tickets deflected**, a genuinely strong demo metric.

---

## 5. Screens

| Route | Role | Contents |
|---|---|---|
| `/login` | public | Email + password. Three one-click demo-login buttons (Employee / Agent / Admin) — critical, the friend must not have to remember credentials. |
| `/` | all | Role-aware landing → redirects to the right dashboard |
| `/tickets/new` | all | Form with live KB suggestions, live duplicate warning, live predicted category/priority chip, attachment upload |
| `/tickets` | all | Role-scoped list: filters (status, priority, category, department, assignee, date range), full-text search, sort, pagination, SLA countdown badge per row |
| `/tickets/[id]` | all | Timeline (comments + audit events interleaved), reply box, internal-worknote toggle (agent/admin only), status & priority & assignee controls, SLA panel, attachments, related KB, satisfaction survey when resolved |
| `/dashboard` | agent/admin | KPI tiles (open, unassigned, breaching soon, resolved today, avg first response, MTTR, CSAT), volume-over-time area chart, category donut, priority bar, agent-workload bar, SLA compliance gauge |
| `/kb` | all | Article browser + search |
| `/kb/[slug]` | all | Article view, helpful / not-helpful voting |
| `/admin/users` | admin | User CRUD, role and department assignment, activate/deactivate |
| `/admin/sla` | admin | SLA policy editor |
| `/admin/rules` | admin | Routing-rule builder with drag-to-reorder priority |
| `/admin/kb` | admin | KB article editor (markdown), publish toggle |

---

## 6. Tech stack

Chosen for **one-command local start** and **zero-config free hosting**.

- **Next.js 15** (App Router) + **TypeScript strict** — one process serves UI and API, so
  hosting is a single Vercel deploy.
- **Prisma 6** + **SQLite** locally, **Postgres** in production. Same schema via the
  `provider` env switch — no code changes to deploy.
- **Tailwind CSS 4** + **shadcn-style components** hand-rolled in `components/ui` (no CLI
  dependency at build time).
- **Auth**: JWT in an httpOnly, sameSite=lax cookie, signed with `jose`; `bcryptjs` for
  hashing. Deliberately not NextAuth — fewer moving parts, no provider config, and the demo
  needs zero external accounts.
- **Recharts** for the dashboard.
- **Vitest** + **@testing-library/react** for unit/component tests, **Playwright** for E2E.
- **Zod** for every API input boundary.

### Non-negotiable constraints
1. `npm install && npm run setup && npm run dev` must give a fully working, seeded app.
2. No paid service, no API key, no Docker required to run the demo.
3. Deploy to Vercel + Neon free tier with only `DATABASE_URL` and `JWT_SECRET` set.
4. Works with no internet after install (no runtime CDN, no external font fetch).

---

## 7. Testing strategy (TDD — tests written before implementation)

**Unit (Vitest)** — the automation layer is pure functions, so it is tested exhaustively:
- `classifier.test.ts` — ~30 cases: each category's happy path, priority escalation phrases,
  low-confidence fallback, empty/garbage input, case and punctuation insensitivity.
- `sla.test.ts` — business-hours math: mid-day start, after-hours start, Friday-evening start
  rolling to Monday, weekend start, exact-boundary start, multi-day spans, hold-time credit.
- `router.test.ts` — rule precedence, keyword match, fallthrough to load balancing, no agents
  available, inactive agents excluded.
- `duplicates.test.ts` — near-identical, paraphrased, unrelated, empty corpus.
- `kb-suggest.test.ts` — ranking order, no-match case.
- `ticket-number.test.ts` — format, monotonicity, year rollover, concurrent generation.
- `rbac.test.ts` — the permission matrix, every role × every action.

**Integration (Vitest + in-memory SQLite)** — API routes end to end against a real DB:
create → auto-classify → auto-route → comment → resolve → reopen; plus authorisation
negative tests (employee reading another's ticket → 403, employee seeing internal notes → filtered).

**E2E (Playwright)** — three journeys: employee raises and tracks a ticket; agent picks up,
adds an internal note and resolves; admin edits an SLA policy and sees the dashboard update.

**Coverage gate**: `lib/automation/**` at 100 % statements. That is where the marks are.

---

## 8. Seed data (demo realism)

- 3 demo accounts with obvious credentials, plus ~14 more users (8 agents across departments).
- **220 tickets** spread over the last 90 days with a realistic arrival curve (weekday peaks,
  Monday spike), realistic status mix (≈55 % closed/resolved, 25 % in progress, 20 % open),
  a deliberate ~12 % SLA-breach rate so the compliance gauge is not a boring 100 %, and
  genuine Indian-PSU-flavoured ticket text (SAP MM module, VPN for regional office, NTPC
  intranet portal, biometric attendance machine, DSC token for e-tendering).
- Comments and audit events on every ticket so timelines look lived-in.
- 12 published KB articles matching the common categories.
- 6 routing rules, 4 SLA policies.

Seeding is **deterministic** (fixed PRNG seed) so the dashboard looks identical on every
machine — no "it looked different in rehearsal" surprises.

---

## 9. Deliverables

1. Working application, all of the above.
2. `README.md` — one-command setup, demo credentials, feature tour, deploy guide.
3. `docs/ARCHITECTURE.md` — diagrams, data model, automation-layer explanation.
4. `docs/DEMO_SCRIPT.md` — a 5-minute click-by-click walkthrough for someone who has never
   seen the app. **This is what makes the friend self-sufficient.**
5. `docs/SIH_PRESENTATION.md` — problem, solution, USP, tech, impact, scalability, in the
   order SIH judges expect.
6. Passing test suite with the coverage gate met.
