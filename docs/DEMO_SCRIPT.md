# Demo Script — 5 Minutes

**Read this once before presenting.** It is written so that someone who has never opened the
code can give a confident demo. Every click is spelled out, and every screen has a line to say.

---

## Before you start

```bash
npm run dev
```

Open **http://localhost:3000** and leave it on the login page.

**Two minutes of preparation that prevent every common disaster:**

1. Run `npm run db:reset` the night before, not five minutes before. It re-seeds cleanly.
2. Open the app once and click through Dashboard → Tickets → a ticket detail. This warms the
   Next.js dev compiler; the first load of each page is slow, every load after is instant.
3. Close other applications. Keep the browser at 100% zoom.
4. If you have a second screen, put this file on it.

**If something goes wrong mid-demo:** stay on the screen that works and talk about it. Every
screen here has enough substance to fill the time. Do not debug in front of judges.

---

## The 30-second opening

Say this while the login page is on screen:

> "Ministry of Power runs IT for NTPC, POWERGRID, NHPC and the regional load despatch centres.
> Today, when an employee has an IT problem, they phone someone or walk to the IT room. Nothing
> is recorded, nothing is prioritised, and one coordinator manually forwards every request.
>
> We built a helpdesk where the triage happens automatically. Let me show you."

---

## Part 1 — The employee raises a ticket (90 seconds)

**This is the most important part of the demo. Do not rush it.**

### 1.1 Log in

Click **"Sign in as Employee"**. No typing.

> "This is Amit Sharma, an employee in the Applications department."

### 1.2 Go to Raise a Ticket

Click **"Raise a Ticket"** in the sidebar.

### 1.3 Type this title — slowly, so the judges watch the right panel

```
VPN not connecting from Korba regional office
```

Then this description:

```
Since this morning I am unable to connect to the office VPN. The client
shows authentication failed even though my domain password works fine on
the intranet portal. Three colleagues in the same office have the same issue.
```

### 1.4 Stop typing and point at the right-hand panel

Three things appeared without the user doing anything. Point at each:

> **"First — the system read the description and classified it. Network category, High priority.
> And it tells you *why*: these are the words it matched. It is not a black box.**
>
> **Second — it found a similar open ticket and warned about a possible duplicate. It does not
> block submission, because a false positive must never stop someone reporting a real problem.**
>
> **Third — it suggested knowledge-base articles. If the VPN guide solves it, the ticket is never
> raised at all. We measure that — I will show you the number in a moment."**

### 1.5 Submit

Click **Raise Ticket**. You land on the ticket detail page.

> "The ticket number is generated, the SLA clock has started, and it has already been assigned to
> the Network Operations team — because a routing rule matched. No human touched this."

Point at the SLA panel on the right.

> "First response is due in one hour, resolution in eight — and those count working hours only.
> A ticket raised on Friday evening is due Monday, not over the weekend."

---

## Part 2 — The agent works the ticket (60 seconds)

### 2.1 Switch user

Click your name (top right) → **Sign out**. Then **"Sign in as Agent"**.

> "This is Priya Nair from IT Infrastructure."

### 2.2 Show the queue

You land on the Dashboard. Click **All Tickets** in the sidebar.

> "The agent sees the whole queue, with SLA countdowns on every row. Red means breached, amber
> means due soon. Notice the labels — we never use colour alone, because a colour-blind user
> still needs to read the state."

Use a filter — set **Priority = Critical**.

> "Filters, search, sorting — all driven through the URL, so any view is a shareable link."

### 2.3 Open a ticket

Click any ticket.

> "Everything about this ticket is on one timeline — comments and system events interleaved.
> Who assigned it, when the status changed, when the SLA breached."

### 2.4 The internal note — a strong detail to call out

In the reply box, toggle **Internal note** on and type:

```
Checked the AD logs, this is a gateway issue affecting the whole Korba site.
Escalating to the network vendor.
```

Post it. Point at the amber-bordered note.

> "This is an internal work note. The employee who raised the ticket cannot see it — and that is
> enforced in the database query, not just hidden in the interface."

### 2.5 Resolve it

Set **Status → Resolved** in the right rail.

> "Resolving stamps the resolution time, stops the SLA clock, and writes an audit event."

---

## Part 3 — The manager's view (90 seconds)

### 3.1 Switch to Admin

Sign out → **"Sign in as Admin"**. You land on the Dashboard.

**Pause here and let them look.** Then walk the screen:

> "Six live KPIs — open tickets, unassigned, tickets about to breach, resolved today, average
> first response, and customer satisfaction."

Point at the charts:

> "Ticket volume over thirty days, category and priority breakdowns, workload per agent, and SLA
> compliance. This is the visibility that does not exist today."

### 3.2 The automation-impact card — the point of the whole project

Scroll to it and slow down:

> "This is what the problem statement asked for. A large share of tickets were classified and
> routed with no human involvement, and these are the tickets deflected entirely by
> knowledge-base articles — issues that never became tickets at all.
>
> That is the coordinator bottleneck removed."

### 3.3 Show that the automation is configurable

Click **Routing Rules** in the sidebar.

> "The rules are not hardcoded. An IT manager edits them here — no developer, no deployment.
> Rules evaluate top to bottom, first match wins."

Click **SLA Policies**.

> "Same for SLA targets. And the business-hours logic is explained right on the page, because
> that is the part people always ask about."

---

## Part 4 — Close (30 seconds)

> "Three roles, full audit trail, automatic triage, SLA tracking with escalation, and a knowledge
> base that measurably reduces ticket volume.
>
> One deliberate engineering decision worth mentioning: the automation is pure TypeScript, not an
> external AI service. No API key, no model download — it works offline and behaves identically
> everywhere. For IT supporting critical power infrastructure, triage cannot stop working because
> a network link went down.
>
> It is fully tested — 250 unit tests, 100% coverage on the automation layer — and it deploys to
> free-tier hosting."

---

## Questions judges usually ask

**"Is this real AI or just keywords?"**
> It is a deterministic weighted-keyword classifier with a confidence floor. We chose that over
> an LLM deliberately: it works offline, costs nothing to run, gives the same answer every time,
> and can explain which words drove the decision. Below 35% confidence it declines to guess and
> sends the ticket to human triage rather than filing a confident wrong answer. An LLM could be
> added behind the same interface — the classifier is one pure function.

**"How does it scale?"**
> Stateless application servers behind a load balancer, Postgres with indexes on every filter
> column, and the automation layer does no I/O so it never becomes the bottleneck. The dashboard
> uses aggregate queries rather than loading rows into memory.

**"What if two people create tickets at the same instant?"**
> Ticket number generation runs inside a transaction with a retry on unique-constraint violation.

**"Can it integrate with existing systems?"**
> The channel field already models email, phone and walk-in intake. An email connector would
> create tickets through the same service function that the web form uses, so all the automation
> applies identically.

**"What about the audit requirement?"**
> Every state change writes an immutable event with actor, timestamp and before/after values.
> Events are never updated or deleted. Any ticket's full history can be reconstructed.

**"How long did this take?"**
> Be honest about your actual timeline. Judges respect a straight answer.

---

## If you only remember three things

1. **The live classification panel** in Part 1.4 — that is the "smart automation" the problem
   statement asked for, visible on screen.
2. **The automation-impact card** in Part 3.2 — that is the measurable result.
3. **The internal note** in Part 2.4 — that is the detail that shows real-system thinking.

Everything else is supporting material.
