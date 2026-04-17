# Success Metrics

## Guiding Principle

The MVP succeeds if an SME team adopts it as their daily system for managing contacts, opportunities, and tasks -- replacing spreadsheets and scattered notes within 30 days of deployment.

## Primary Metrics

### M1: Daily Active Usage

**Metric:** Percentage of registered users who log in at least once per business day.

**Target:** >= 60% of registered users active on any given business day within 30 days of team onboarding.

**Why this matters:** CRM value is proportional to usage. A CRM that 3 of 8 reps use is worse than a shared spreadsheet because data is split across two systems.

**How to measure (MVP):** Count distinct user sessions per day via session cookie creation timestamps. No analytics SDK required -- query the session/auth table.

### M2: Pipeline Data Completeness

**Metric:** Percentage of opportunities with all required fields populated (name, value, stage, expected close date, owner).

**Target:** >= 80% of open opportunities have all required fields.

**Why this matters:** Incomplete pipeline data makes the dashboard unreliable. If managers cannot trust the numbers, they revert to asking reps directly.

**How to measure (MVP):** Query opportunities table for null/empty values in required columns. Report as a ratio.

### M3: Time to First Value

**Metric:** Time from account registration to creating the first contact with a linked opportunity.

**Target:** <= 5 minutes for a new user following no external documentation.

**Why this matters:** If the first experience is slow or confusing, the user associates the tool with friction and avoids it.

**How to measure (MVP):** Timestamp difference between user creation and first opportunity creation for that user.

## Secondary Metrics

### M4: Task Completion Rate

**Metric:** Percentage of tasks marked completed before or on their due date.

**Target:** >= 50% of tasks with due dates are completed on time.

**Why this matters:** If reps create tasks but do not complete them, the task system is not driving behavior. Low completion rates suggest tasks are created for appearance rather than action.

**How to measure (MVP):** Compare task.completedAt against task.dueDate for completed tasks. Report on-time vs. overdue.

### M5: Notes Per Interaction

**Metric:** Average number of notes created per contact per week, across active users.

**Target:** >= 1 note per active contact per week (for contacts with activity).

**Why this matters:** Notes are the primary mechanism for capturing interaction context. If reps do not log notes, the CRM fails at its core promise of shared context.

**How to measure (MVP):** Count notes created per week, grouped by linked contact. Exclude contacts with no activity.

### M6: Pipeline Stage Progression

**Metric:** Percentage of opportunities that move forward at least one stage within 14 days of creation.

**Target:** >= 40% of opportunities advance beyond their initial stage within 14 days.

**Why this matters:** Stale opportunities that never move indicate either a broken sales process or reps not updating the system. Either signals low value delivery.

**How to measure (MVP):** Track stage changes via updated_at timestamps on opportunities. Compare creation stage to current stage after 14 days.

### M7: Dashboard Load Time

**Metric:** Server response time for the dashboard page.

**Target:** <= 1 second (p95) with 500 opportunities and 200 open tasks in the database.

**Why this matters:** If the dashboard is slow, it will not become the daily landing page. Managers will stop checking it and revert to manual pipeline reviews.

**How to measure (MVP):** Server-side timing on the dashboard API route. Log p50, p95, and p99 response times.

## Anti-Metrics (What Not to Optimize)

### A1: Feature Count

Do not measure success by the number of features shipped. More features increase complexity and reduce learnability. The MVP scope is intentionally small.

### A2: Time Spent in App

Longer sessions do not mean higher value. A CRM should enable reps to log data quickly and get back to selling. Optimize for fast in-and-out, not engagement.

### A3: Number of Records Created

Raw record counts without quality indicators are misleading. 500 contacts with no emails are less valuable than 100 contacts with full details.

## Measurement Timeline

| Period | Focus | Key Metric |
|---|---|---|
| Week 1 | Onboarding friction | M3: Time to first value |
| Week 2-3 | Adoption | M1: Daily active usage |
| Week 4 | Value delivery | M2: Pipeline completeness, M4: Task completion |
| Ongoing | Sustained use | M1, M5, M6 |

## MVP Release Decision Criteria

The MVP is ready for team deployment when:

1. All user stories from the PRD are implemented and verified.
2. Acceptance criteria pass (see acceptance-criteria.md).
3. M3 (time to first value) is achievable in a walkthrough test: a new user can register and create a linked contact + opportunity in under 5 minutes.
4. M7 (dashboard load time) meets the 1-second p95 target with seed data.
5. No critical or high-severity bugs remain open.
