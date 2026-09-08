# Architecture

**SIH25195 · Smart Helpdesk Ticketing Solution for IT Services · Ministry of Power**

---

## 1. System overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React 19)                       │
│   Server-rendered pages + client islands for interactivity      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼────────────────────────────────────┐
│                    Next.js 15 (App Router)                      │
│                                                                 │
│  app/(app)/**          Server Components — query Prisma direct  │
│  app/api/**            Route handlers — Zod + RBAC guarded      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  lib/services/          orchestration, transactions,      │  │
│  │                         audit events, side effects        │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  lib/automation/        PURE FUNCTIONS — no I/O            │  │
│  │    classifier · router · sla · duplicates                 │  │
│  │    kb-suggest · ticket-number                             │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  lib/rbac.ts            one permission matrix             │  │
│  │  lib/auth.ts            JWT / httpOnly cookie             │  │
│  │  lib/validation.ts      Zod schemas per boundary          │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ Prisma ORM
┌────────────────────────────▼────────────────────────────────────┐
│         SQLite (local demo)   ·   PostgreSQL (production)       │
│                    Identical schema, one-line switch            │
└─────────────────────────────────────────────────────────────────┘
```

### The central design decision

`lib/automation/` contains **only pure functions**. They accept plain data and return decisions.
They never touch the database, the network, the clock (time is always injected), or the file
system.

Three consequences follow, and all three matter:

1. **100% test coverage is achievable.** No mocking, no fixtures, no test database. Every branch
   is reachable by passing different arguments.
2. **Behaviour is identical everywhere.** Laptop, CI, Vercel, offline — same input, same output.
3. **The logic is portable.** Swapping the keyword classifier for an ML model means replacing one
   function behind an unchanged signature. Nothing else in the system knows the difference.

Services above them handle the impure work: transactions, audit events, and side effects.

---

## 2. Data model

```
User ──────┬──< Ticket (createdBy)
           ├──< Ticket (assignedTo)
           ├──< Comment
           ├──< TicketEvent (actor)
           └──< KbArticle (author)

Ticket ────┬──< Comment
           ├──< Attachment
           ├──< TicketEvent
           └──── SlaPolicy

RoutingRule ──── User (optional fixed assignee)
```

### Ticket — the core entity

Beyond the obvious fields, four groups carry the system's intelligence:

**SLA tracking** — `firstResponseDueAt`, `resolutionDueAt`, `firstRespondedAt`, `slaBreached`,
`holdMinutes`, `onHoldSince`. Deadlines are computed once at creation and recomputed only when
priority changes. `slaBreached` is denormalised so the dashboard never scans and compares dates
across the whole table.

**Automation metadata** — `autoClassified`, `classifierConfidence`, `autoRouted`, `matchedRuleId`.
This is what lets the dashboard report how much triage happened without a human, and it is what
makes the automation auditable after the fact.

**Hold accounting** — when a ticket goes On Hold, `onHoldSince` is stamped. When it leaves, the
elapsed minutes are added to `holdMinutes` and credited back to the deadlines. Agents are not
penalised for time spent waiting on the requester.

**Satisfaction** — `satisfactionRating` and `satisfactionComment`, feeding the CSAT metric.

### TicketEvent — the audit trail

Append-only. Never updated, never deleted. Every state change writes one, capturing actor,
timestamp, and before/after values.

For a government department this is not a nice-to-have. "Who changed this ticket's priority, and
when?" must have an answer, and the answer must not be something an application bug could
silently rewrite.

### Why string columns instead of database enums

SQLite has no native enum type. Rather than diverge between local and production schemas, all
enum-like fields are strings, constrained by:

- TypeScript union types in `lib/constants.ts` — compile-time safety
- Zod schemas in `lib/validation.ts` — runtime validation at every API boundary

The single source of truth is `lib/constants.ts`. Adding a category means editing one file.

---

## 3. The automation layer

### 3.1 Classification — `lib/automation/classifier.ts`

```
classifyTicket(title, description) → {
  category, priority, confidence, autoClassified, matchedTerms
}
```

Weighted keyword lexicons across 8 categories, built around Indian power-sector vocabulary —
SAP transaction codes, DSC tokens, e-tendering portals, biometric attendance, substation systems.

- Input is normalised: lowercased, punctuation stripped, tokenised.
- **Title matches count double** — a word in the title is a stronger signal than one buried in
  paragraph three.
- Multi-word phrases are matched before single tokens.
- `confidence = topScore / totalScoreAcrossAllCategories`.
- **Below 0.35 confidence the classifier declines**: category `OTHER`, `autoClassified: false`,
  routed to human triage.

That last rule is the important one. A triage system that guesses confidently when it does not
know is worse than one that admits uncertainty — a misfiled critical ticket costs far more than
one that waited for a human to read it.

Priority uses a separate severity lexicon. Phrases indicating multi-user impact ("whole
department", "all users", "entire team") force a floor of HIGH, because scope is a better
predictor of business impact than any adjective the requester chooses.

`matchedTerms` is returned so the interface can show *why* — the classification is explainable,
not a black box.

### 3.2 Routing — `lib/automation/router.ts`

```
routeTicket(ticket, rules, agents) → {
  department, assignedToId, priority, matchedRuleId, autoRouted
}
```

Two stages:

**Rule matching.** Active rules sort by their `priority` field ascending; the first whose
criteria all match wins. A rule may match on category, keywords, priority, or any combination.
Rules are database rows, editable by an admin in the UI — no deployment needed to change routing.

**Load balancing.** When the matched rule names no specific agent (or no rule matched), the
ticket goes to the agent in that department with the fewest open tickets, tie-broken by longest
idle. Agents who have never been assigned anything sort first.

Given the same inputs the result is always the same, which is what makes it testable.

### 3.3 SLA engine — `lib/automation/sla.ts`

The most intricate part of the system, and the most thoroughly tested.

```
addBusinessMinutes(from, minutes) → Date
businessMinutesBetween(start, end) → number
computeSlaTargets(createdAt, policy) → { firstResponseDueAt, resolutionDueAt }
slaStatus(dueAt, completedAt, now?, startedAt?) → ON_TRACK | AT_RISK | BREACHED | MET
```

Working hours are Monday–Friday, 09:00–18:00 — 540 minutes per day. The rules:

- Arrival before 09:00 on a working day → the clock starts at 09:00 that day.
- Arrival after 18:00, or on a weekend → the clock starts at 09:00 on the next working day.
- Minutes spilling past 18:00 roll to the following working day.
- A deadline may land exactly on 18:00; only genuinely remaining minutes roll over.

So a High-priority ticket raised Friday at 17:00 with an 8-hour target is due Monday at 16:00 —
not Saturday at 01:00, which is what naive wall-clock arithmetic produces.

**Hold accounting.** Time in On Hold is credited back, so waiting on the requester does not
consume the agent's SLA budget.

**Breach sweep.** `POST /api/cron/sla-sweep` finds open tickets past their resolution deadline,
marks them breached, writes an `SLA_BREACHED` event, escalates priority one level, and writes an
`ESCALATED` event. It is idempotent — already-breached tickets are skipped — so it can run on any
schedule, or be triggered manually during a demo, without corrupting state.

### 3.4 Duplicate detection — `lib/automation/duplicates.ts`

```
similarity(a, b) = 0.6 × tokenSetJaccard + 0.4 × characterBigramOverlap
```

Both texts are normalised and stripped of English stopwords first. The blend is deliberate:
Jaccard catches shared vocabulary, bigrams catch typos and morphological variants that token
matching alone would miss.

Compared against the requester's own open tickets from the last 7 days. Above 0.55 the UI shows
a warning with a link — and **never blocks submission**. A false positive that prevents someone
reporting a real outage is a far worse failure than a duplicate ticket.

### 3.5 Knowledge-base suggestion — `lib/automation/kb-suggest.ts`

TF-IDF over article title (weight 3), tags (weight 2) and body (weight 1), cosine-ranked against
the draft ticket text. The top 3 appear live in the ticket form.

Articles opened from that widget increment `deflectionCount`, surfaced on the dashboard as
tickets deflected — a measured reduction in queue volume, not a claimed one.

---

## 4. Request lifecycle: creating a ticket

```
POST /api/tickets
  │
  ├─ requireUser()                     401 if no valid session
  ├─ can(role, 'ticket:create')        403 if not permitted
  ├─ createTicketSchema.parse(body)    400 with field-level issues
  │
  └─ ticketService.createTicket()
        │
        ├─ classifyTicket()            category + priority, when not supplied
        ├─ load active RoutingRules
        ├─ load agent open-ticket counts
        ├─ routeTicket()               department + assignee
        ├─ load SlaPolicy for priority
        ├─ computeSlaTargets()         business-hours deadlines
        │
        └─ prisma.$transaction
              ├─ nextTicketNumber()    from the latest, retry once on collision
              ├─ create Ticket
              └─ create TicketEvents   CREATED, AUTO_CLASSIFIED, ASSIGNED
```

Ticket numbers are generated inside the transaction with a retry on unique-constraint violation,
so two simultaneous submissions cannot collide.

---

## 5. Security

### Authentication
JWT signed with `jose` (HS256), stored in an **httpOnly, sameSite=lax** cookie. httpOnly means
JavaScript cannot read it, so an XSS bug cannot exfiltrate the session. Every request
re-validates the user against the database — a deactivated account loses access immediately
rather than at token expiry.

Passwords are bcrypt-hashed at cost 10. No API response ever includes a hash.

### Authorisation
Every decision routes through `can(role, permission)` in `lib/rbac.ts`. One matrix, one place,
unit-tested across every role × permission combination.

Two boundaries are enforced **in the database query**, not in the interface:

1. **Employees see only their own tickets** — `createdById` is in the WHERE clause. Guessing a
   ticket id gets a 403, not someone else's data.
2. **Internal work notes are excluded** for users without `comment:readInternal` — filtered in
   the query, so they are never serialised to the client at all.

Enforcing these in the UI alone would mean the data still reaches the browser, where anyone can
read it in the network tab.

### Input validation
Every API boundary parses through a Zod schema before the handler runs. Prisma's parameterised
queries prevent SQL injection. React escapes output by default, preventing XSS.

### Auditability
Append-only `TicketEvent` rows. No update path, no delete path.

---

## 6. Performance

**Indexes** on every column used for filtering or sorting: `status`, `priority`, `category`,
`department`, `createdById`, `assignedToId`, `createdAt`, `slaBreached`.

**Denormalised `slaBreached`** so compliance queries are an indexed boolean scan rather than a
date comparison across the table.

**Aggregate queries** for the dashboard — `groupBy` and `aggregate` push the work to the
database rather than loading rows into application memory.

**Server Components** render on the server with no client-side data fetch for initial page load.
Only genuinely interactive pieces ship JavaScript.

**Pagination** everywhere, capped at 100 rows per page.

---

## 7. Scaling path

The application is **stateless** — sessions live in the JWT, not in server memory — so it scales
horizontally behind a load balancer with no sticky sessions and no shared cache.

| Concern | Now | At scale |
|---|---|---|
| Database | SQLite / single Postgres | Postgres with read replicas for dashboards |
| Search | SQL `contains` | Postgres full-text, or OpenSearch |
| Attachments | Local filesystem | S3 or equivalent object storage |
| SLA sweep | Cron endpoint | Same endpoint, triggered by a job scheduler |
| Notifications | In-app | Email/SMS worker consuming a queue |
| Classification | Keyword lexicons | ML model behind the same function signature |

The last row is the point of the pure-function design: replacing the classifier means changing
one file whose signature the rest of the system already depends on.

---

## 8. Testing

| Layer | Tool | Coverage |
|---|---|---|
| Automation | Vitest | **100% statements** (enforced gate) |
| RBAC | Vitest | Every role × permission |
| API routes | Vitest + SQLite | Happy path + authorisation negatives |
| Pages | Playwright | Three end-to-end journeys |

The coverage gate on `lib/automation/**` is deliberate. That is where the decisions are made, it
is pure and therefore fully testable, and a bug there silently misroutes tickets rather than
throwing a visible error.

The awkward cases are covered explicitly: SLA deadlines landing exactly on 18:00, Friday-evening
tickets rolling to Monday, weekend arrivals, routing when no agent is available, classifier input
that is pure punctuation, and duplicate detection against an empty corpus.
