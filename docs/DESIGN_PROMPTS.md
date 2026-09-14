# Claude Design prompts — SIH25195 deliverables

Paste one prompt per conversation at [claude.ai](https://claude.ai). Prompts 1–3 are the ones
SIH actually requires; 4–6 are optional polish.

**What Claude Design does well here:** slide decks, one-page posters, architecture and flow
diagrams, and mockups. It does not need the codebase to produce any of these — every prompt
below already contains the real numbers, so paste and go.

**When it asks for the repo:** `https://github.com/7Mudit/smart-helpdesk-sih25195`

---

## 1. The idea-submission slide deck (**required — do this one first**)

SIH wants a 5–6 slide PPT. This is the highest-value item.

```
Create a 6-slide presentation deck for a Smart India Hackathon 2025 submission.
Export it as a PowerPoint file.

PROBLEM STATEMENT: SIH25195 — Smart Helpdesk Ticketing Solution for IT Services
ORGANISATION: Ministry of Power (MoP) · CATEGORY: Smart Automation · THEME: Software
TEAM: [fill in your team name]

Design: clean government-enterprise style. Deep institutional blue as the
primary colour, generous white space, one idea per slide, minimal text —
these are presented aloud, so slides support the speaker rather than replace
them. Use diagrams and numbers over paragraphs. Sans-serif throughout.

SLIDE 1 — Title
Smart Helpdesk: Automated IT Service Desk for the Ministry of Power.
Problem statement ID SIH25195, category and theme, team name.

SLIDE 2 — The problem
Ministry of Power runs IT for NTPC, POWERGRID, NHPC, DVC and the regional
load despatch centres. Today an employee with an IT problem phones the IT
room, emails, or walks over. Five consequences, as a clean visual list:
  - No record — nobody can say how many issues were raised last month
  - No prioritisation — a locked password and a substation network outage
    sit in the same queue
  - A human bottleneck — one coordinator reads and forwards every request
  - No institutional memory — the same twenty questions answered weekly
  - No visibility — no MTTR, no backlog trend, no SLA compliance
Close with: when a control-room system is down and its ticket sits behind
forty routine requests, the impact reaches grid operations.

SLIDE 3 — Our solution
A horizontal flow diagram of what happens when a ticket is raised:
  Employee describes the problem in plain language
    -> System CLASSIFIES it (category + priority) and shows which words drove it
    -> Warns about DUPLICATES among the user's own open tickets
    -> Suggests KNOWLEDGE-BASE articles that may remove the need for a ticket
    -> ROUTES to the right department, load-balanced across agents
    -> SLA CLOCK starts, counting working hours only, escalates on breach
    -> Every change writes an IMMUTABLE AUDIT EVENT
One line under the diagram: the coordinator bottleneck disappears.

SLIDE 4 — What makes it different
Five points, each one line:
  1. The automation needs no internet, no API key and no GPU. Deterministic
     TypeScript, not a cloud LLM — so triage cannot stop because an API key
     expired or a link went down. Zero cost per ticket.
  2. It declines to guess. Below 35% confidence it routes to human triage
     instead of filing a confident wrong answer.
  3. SLA maths that matches how offices work. Friday 17:00 + 8 hours is due
     Monday 16:00, not Saturday 01:00. The clock pauses while waiting on the
     requester.
  4. Deflection is measured, not claimed — articles opened from the ticket
     form are counted.
  5. Audit-grade by construction. Append-only event log, never edited.

SLIDE 5 — Technical approach and feasibility
Left: the stack — Next.js 15, TypeScript, Prisma, SQLite to PostgreSQL,
Tailwind, Vitest, Playwright. A simple layer diagram: Pages / API routes /
Services / Pure automation functions / Database.
Right: proof it is real —
  - 373 automated tests passing, 100% statement coverage on the automation layer
  - 13 screens, 23 API endpoints, 3 roles enforced server-side
  - Runs in three commands with no Docker, no cloud account, no API key
  - Deploys to free-tier hosting with two environment variables

SLIDE 6 — Impact
Four short columns: Employee / IT agent / IT manager / The ministry, each
with two lines on what changes for them. Then a strip of measurable outcomes
to track after deployment: ticket volume deflected, time to first response,
share of tickets triaged without a human, SLA compliance, CSAT.
```

---

## 2. Architecture diagram (**for the deck and the report**)

```
Create a clean technical architecture diagram as a single image, suitable for
a hackathon submission slide and also readable when printed.

SYSTEM: Smart Helpdesk — an IT service desk for India's Ministry of Power.

Draw four horizontal layers, top to bottom, each a labelled band:

1. CLIENT — a browser. Note: server-rendered pages, minimal client JavaScript.

2. NEXT.JS 15 APPLICATION (one deployable unit — this is worth emphasising).
   Inside it, two columns:
   - Pages (Server Components, read the database directly):
     Login · Ticket list · Raise ticket · Ticket detail · Knowledge base ·
     Dashboard · Admin
   - API routes (Zod-validated, permission-guarded): 23 endpoints

3. Two sub-layers beneath, stacked:
   - SERVICE LAYER — orchestration: transactions, audit events, side effects
   - AUTOMATION LAYER — highlight this box distinctly, it is the core
     contribution. Label it "pure functions — no I/O, 100% test coverage" and
     list its six modules: classifier, router, sla, duplicates, kb-suggest,
     ticket-number

4. DATA — Prisma ORM, then a database box reading
   "SQLite (local demo)  ·  PostgreSQL (production) — same schema"

To one side, a small box labelled SECURITY with arrows into the layers it
touches: JWT in an httpOnly cookie · one permission matrix · role scoping
enforced in SQL, not the UI · append-only audit trail

Style: deep blue and grey, white background, rounded rectangles, clear arrows
showing request flow downward. Label every arrow. No gradients or 3D effects.
The automation layer should be visually the most prominent element.
```

---

## 3. Ticket-lifecycle flow diagram (**explains the automation visually**)

```
Create a flowchart showing what happens automatically when an employee raises
an IT ticket. This is for a hackathon judging panel — it must make the
automation obvious at a glance.

START: Employee types a problem description in plain language.

Then, BEFORE they submit (draw these three as parallel live actions, since
they happen as the user types):
  - CLASSIFY: weighted keyword matching returns a category and priority with a
    confidence score and the matched terms. Add a decision diamond:
    "confidence >= 35%?" — Yes: use it. No: mark for human triage. Annotate
    this branch "declines to guess rather than filing a confident wrong answer".
  - DUPLICATE CHECK: compare against the user's own open tickets from the last
    7 days. Above 55% similarity, warn — but never block submission.
  - SUGGEST ARTICLES: TF-IDF ranking over the knowledge base. If the user
    opens one and abandons the draft, count it as a DEFLECTED ticket
    (a terminal end-state, drawn in green).

ON SUBMIT:
  - ROUTE: walk the admin-configured rules in order, first match wins. If the
    matched rule names no agent, LOAD-BALANCE to the least-loaded agent in
    that department.
  - START SLA CLOCK: compute first-response and resolution deadlines using
    working hours only (Mon-Fri, 09:00-18:00). Annotate: "Friday 17:00 + 8h
    is due Monday 16:00".
  - WRITE AUDIT EVENTS: created, auto-classified, assigned.

THEN the agent working loop:
  Agent replies -> first response recorded -> status changes (In Progress /
  On Hold / Resolved). Show a small loop off On Hold labelled "SLA clock
  pauses while waiting on the requester".

BREACH PATH (draw in amber/red, branching off the SLA clock):
  Resolution deadline passes -> mark breached -> escalate priority one level
  -> notify the service manager. Note that it is automatic.

END STATES: Resolved -> requester rates it (feeds CSAT) -> Closed.
Also show Reopen looping back from Resolved.

Style: top-to-bottom flow, deep blue for the normal path, green for
deflection, amber for the breach path. Decision points as diamonds. Label
every branch. Mark clearly which boxes need NO human action — that is the
whole point of the diagram.
```

---

## 4. One-page poster (optional — for a hardware round or a stall)

```
Design a single-page A3 poster, portrait, for a Smart India Hackathon project.
It will be printed and pinned next to a laptop running the demo, so it must
read from two metres away.

TITLE: Smart Helpdesk
SUBTITLE: Automated IT Service Desk for the Ministry of Power
Small line: Problem Statement SIH25195 · Smart Automation · [team name]

Sections, top to bottom:

THE PROBLEM (one short paragraph)
IT issues across NTPC, POWERGRID, NHPC and the regional load despatch centres
arrive by phone, email and walk-in. Nothing is recorded, nothing is
prioritised, and one coordinator manually forwards every request.

THE SOLUTION — four icon-led points
  Classifies every ticket automatically, and shows why
  Routes it to the right team, load-balanced across agents
  Tracks SLAs in working hours, escalating breaches on its own
  Deflects tickets with knowledge-base articles, and measures it

WHY IT IS DIFFERENT — pull this out as a highlighted band
No cloud AI service. No API key. No GPU. The triage logic is deterministic
TypeScript that runs offline and costs nothing per ticket — because IT
supporting critical power infrastructure cannot have its triage stop when a
network link goes down.

BY THE NUMBERS — four large figures in a row
  373 automated tests
  100% coverage on the triage logic
  13 screens · 23 API endpoints
  3 roles, enforced server-side

Leave a clear space at the bottom right labelled "Scan for the repository"
for a QR code, with the URL github.com/7Mudit/smart-helpdesk-sih25195
printed beneath it.

Style: deep institutional blue and white, one accent colour, lots of white
space. Large type. No stock photography. This should look like a government
engineering document, not a startup pitch.
```

---

## 5. Dashboard mockup (optional — only if you want to restyle the UI)

Skip this unless you dislike how the built app looks. The app already has a working dashboard.

```
Design a web dashboard mockup at 1440x1024 for an IT service desk used by the
Indian Ministry of Power. Support both light and dark variants.

Left sidebar: product wordmark "Smart Helpdesk / Ministry of Power", then nav
items — Dashboard, All Tickets, Raise a Ticket, Knowledge Base, then an
ADMINISTRATION group with Users, SLA Policies, Routing Rules, KB Editor.
Top bar: ticket search, theme toggle, user menu showing a name and role.

Main area, top row: six KPI tiles, each with a small label, a large number, a
one-line context sentence beneath, and a subtle icon chip:
  Open tickets 63 — "4 raised today"
  Unassigned 7 — "11% of the open queue awaiting an owner"
  Breaching soon 2 — "resolution due within 4 hours"
  Resolved today 4 — "129 resolved within SLA all-time"
  Avg first response 2h 26m — "across 213 tickets with an agent reply"
  CSAT 4.0 / 5 — "mean of 101 requester ratings"

Below: a 2x2 chart grid — a 30-day area chart of tickets raised vs resolved,
a category donut with a legend carrying counts and percentages, a priority
bar chart, and a horizontal bar chart of per-agent workload.

Then a full-width highlighted panel titled "Automation impact", reading:
"78.2% of tickets triaged without human intervention — classified and routed
automatically the moment they were raised." Three supporting figures beneath:
auto-classified 78.2%, auto-routed 83.2%, mean classifier confidence 66.6%.
Then, set apart: "244 tickets deflected by the knowledge base".

Design system: 8pt spacing grid, Inter, restrained palette with one deep-blue
primary and semantic colours reserved for priority and SLA state. Rounded
cards on a subtle grey page background, thin borders, no heavy shadows.
Accessible contrast throughout — never encode meaning in colour alone, always
pair it with a label.
```

---

## 6. Demo video storyboard (optional — if a video is required)

```
Write a storyboard for a 3-minute demo video of an IT helpdesk web
application, for a Smart India Hackathon submission. Present it as a table:
timestamp, what is on screen, and the exact voiceover line.

The application is Smart Helpdesk, for India's Ministry of Power. Cover, in
order:

0:00-0:20 — The problem. IT issues arrive by phone and walk-in; nothing is
recorded or prioritised, and one coordinator forwards every request.

0:20-1:10 — An employee raises a ticket. This is the centrepiece: as they
type "VPN not connecting from Korba regional office", the screen shows the
predicted category and priority with the matched terms, a duplicate warning,
and suggested knowledge-base articles — all before they submit. Emphasise
that nobody triaged this.

1:10-1:50 — An agent works it. The queue with SLA countdowns, opening the
ticket, the unified timeline of comments and audit events, adding an internal
work note that the requester cannot see, and resolving it.

1:50-2:40 — The manager's view. The dashboard KPIs, the charts, and then the
automation-impact panel: the share of tickets triaged with no human involved
and the count deflected by the knowledge base. Then the routing-rules page,
to show an IT manager can change triage behaviour without a developer.

2:40-3:00 — Close. The automation is deterministic TypeScript, not a cloud AI
service: it works offline and costs nothing per ticket. 373 automated tests,
and it deploys to free-tier hosting.

Keep the voiceover plain and factual — no marketing adjectives. Note where to
pause so a viewer can read a number on screen.
```

---

## Where the code is, if you need to attach it

| What | Where |
|---|---|
| GitHub repository | https://github.com/7Mudit/smart-helpdesk-sih25195 |
| Local folder | `/Users/muditkapoor/Downloads/smart-helpdesk` |
| Demo walkthrough | `docs/DEMO_SCRIPT.md` |
| Architecture write-up | `docs/ARCHITECTURE.md` |
| Submission narrative | `docs/SIH_PRESENTATION.md` |

For SIH, the GitHub link is what you submit — you never need to attach a zip. If a form insists
on a file:

```bash
cd /Users/muditkapoor/Downloads
zip -r smart-helpdesk-sih25195.zip smart-helpdesk \
  -x "*/node_modules/*" "*/.next/*" "*/.git/*" "*.db" "*/.env"
```
