# Success Metrics

## Overview

This document defines the metrics that determine whether the CRM MVP is succeeding. Metrics are organized into a hierarchy: one north star metric, user lifecycle metrics (activation, engagement, retention), and technical health metrics. All metrics are scoped to the MVP feature set (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard).

## North Star Metric

### Weekly Active Pipeline Users (WAPU)

**Definition**: The number of unique users who view or modify at least one opportunity in a 7-day rolling window.

**Why this metric**:
- It captures the core value proposition: pipeline management
- "View or modify" includes moving deals between stages, adding notes to deals, creating tasks on deals, and viewing the pipeline/dashboard
- Weekly cadence matches SME sales rhythm (daily is too granular; monthly hides churn)
- It filters out users who only manage contacts but never use the pipeline (incomplete adoption)

**Target**: For the first 90 days post-launch:
- Month 1: 20 WAPU (approximately 4-5 teams)
- Month 2: 50 WAPU
- Month 3: 100 WAPU

**Measurement**: Query `opportunities` table joins with `audit_log` or `updated_at` timestamps grouped by user, weekly.

## User Lifecycle Metrics

### Activation

Activation measures whether a new user reaches the "aha moment" -- the point where they experience the product's core value.

#### Primary activation metric: Time to First Pipeline View

**Definition**: Elapsed time from account creation to first visit to the pipeline/dashboard page with at least one opportunity visible.

**Target**: Under 10 minutes for 80% of new users.

**Why**: If a user can create an account, add a contact, create an opportunity, and see it on their pipeline within 10 minutes, the product has demonstrated its core value.

#### Activation funnel steps

| Step | Action | Target completion rate |
|---|---|---|
| 1 | Account created | 100% (baseline) |
| 2 | First contact added | 80% within session 1 |
| 3 | First company added | 60% within session 1 |
| 4 | First opportunity created | 50% within session 1 |
| 5 | Pipeline viewed with data | 45% within session 1 |
| 6 | First task created | 30% within session 1 |

**Drop-off alerts**: If fewer than 50% of new users reach step 4 within their first session, investigate onboarding friction. Possible causes: unclear UI, too many required fields, no guided setup.

#### Secondary activation metrics

- **Team invitation rate**: Percentage of account creators who invite at least one teammate within 7 days. Target: 40%. A CRM used by one person is a contact list; team adoption is critical.
- **Second session return**: Percentage of activated users who return for a second session within 48 hours. Target: 60%.

### Engagement

Engagement measures ongoing usage patterns for activated users.

#### Daily actions per user

**Definition**: Average number of create/update/delete actions per active user per day. Actions include: adding contacts, creating opportunities, moving pipeline stages, completing tasks, adding notes.

**Target**: 8-15 actions per active user per day.

**Why**: Below 5 suggests the product is opened but not used. Above 20 may indicate friction (too many clicks to accomplish tasks). 8-15 represents a healthy sales workflow: check dashboard, update a few deals, add notes from calls, create follow-up tasks.

#### Feature usage distribution

Track weekly active usage of each core feature:

| Feature | Healthy usage rate (% of active users) |
|---|---|
| Dashboard view | > 80% |
| Contact list/search | > 70% |
| Opportunity create/update | > 60% |
| Pipeline stage changes | > 50% |
| Task create/complete | > 40% |
| Notes added | > 30% |
| Company management | > 20% |

**Interpretation**: If dashboard usage is high but task creation is below 20%, the task feature may have UX problems or the wrong abstraction. If notes are below 15%, consider whether the notes UI is accessible enough (should be one click from any entity).

#### Pipeline velocity

**Definition**: Average number of days an opportunity spends in each pipeline stage.

**Why**: This is not a product health metric directly, but it tells us whether users are actively working their pipeline or abandoning it. Stagnant deals (> 30 days in one stage) with no notes or tasks suggest the user has stopped engaging.

**Target**: At least 50% of opportunities should move stages within 14 days of creation.

### Retention

Retention measures whether users continue to use the product over time.

#### Weekly retention cohorts

**Definition**: For each weekly signup cohort, what percentage are still active (at least one action) in weeks 1, 2, 4, 8, and 12?

**Targets**:

| Week | Retention target |
|---|---|
| Week 1 | 60% |
| Week 2 | 45% |
| Week 4 | 35% |
| Week 8 | 25% |
| Week 12 | 20% |

**Why these numbers**: CRM products that achieve 20%+ retention at week 12 are viable. SME tools typically see steep early drop-off (teams that try it but do not adopt) followed by a flattening curve (teams that adopt it as their system of record).

#### Team retention vs. individual retention

Track retention at both levels. A team where 3 of 5 members are active is healthier than a team where 1 of 5 is active. Team-level retention (at least 2 members active) should exceed individual retention by 10-15 points.

**Target**: Team-level week-12 retention of 30%.

#### Churn indicators

Early warning signals that a team is about to churn:

- No login by any team member for 7+ consecutive days
- No opportunity updates for 14+ consecutive days
- Zero tasks created in the last 14 days
- Dashboard not viewed in 10+ days

When 2 or more indicators are true, the team is at high churn risk.

## Technical Health Metrics

### Availability

**Definition**: Percentage of time the application responds to health check requests with HTTP 200 within 5 seconds.

**Target**: 99.5% uptime (approximately 1.8 days downtime per year).

**Why 99.5% and not 99.9%**: An MVP operated by a small team cannot commit to 99.9% (8.7 hours/year). 99.5% is honest and acceptable for SME teams who are not running mission-critical operations on the CRM.

**Measurement**: External uptime monitor (e.g., Better Uptime, UptimeRobot) hitting `/api/health` every 60 seconds.

### Response Time

**Targets**:

| Endpoint type | p50 target | p95 target | p99 target |
|---|---|---|---|
| Page loads (SSR) | < 200ms | < 500ms | < 1000ms |
| API mutations | < 150ms | < 400ms | < 800ms |
| Dashboard (aggregation) | < 300ms | < 800ms | < 1500ms |
| Search (contacts) | < 100ms | < 300ms | < 600ms |

**Measurement**: Application-level timing middleware logging to a metrics service. For MVP, structured logging with timestamp deltas is sufficient; dedicated APM (Datadog, New Relic) is post-MVP.

### Error Rate

**Definition**: Percentage of HTTP requests that result in 5xx responses.

**Target**: Below 0.1% of all requests.

**Alert threshold**: If 5xx rate exceeds 1% over a 5-minute window, trigger an alert.

### Database Performance

**Targets**:

| Metric | Target |
|---|---|
| Active connections | < 80% of pool size |
| Slow queries (> 500ms) | < 5 per hour |
| Migration success rate | 100% (zero failed migrations in production) |
| Database size | Monitor only (no target for MVP) |

### Build and Test Health

| Metric | Target |
|---|---|
| Test suite pass rate | 100% on main branch |
| Test coverage (lines) | > 80% |
| Build time | < 3 minutes |
| Deployment time | < 5 minutes (push to live) |
| Type check errors | 0 |
| Lint warnings | 0 |

### Security Metrics

| Metric | Target |
|---|---|
| Dependency vulnerabilities (critical/high) | 0 |
| Auth failures (brute force) | Rate limited to 5 attempts per IP per minute |
| Data exposure incidents | 0 |
| Time to patch critical vulnerability | < 48 hours |

## Metric Collection Strategy for MVP

The MVP should not invest in a full analytics stack. The following approach balances insight with simplicity:

### Phase 1 (MVP launch)

- **Server-side event logging**: Log key actions (signup, contact_created, opportunity_created, stage_changed, task_completed, note_added, dashboard_viewed) to a structured log (JSON lines).
- **Database queries**: Compute retention, activation, and engagement metrics from the database directly using scheduled scripts.
- **External uptime monitor**: Free tier of UptimeRobot or similar.
- **Error tracking**: Sentry free tier for 5xx errors and unhandled exceptions.

### Phase 2 (post-MVP, if metrics justify)

- Dedicated analytics service (Posthog self-hosted, or Mixpanel free tier)
- APM for detailed performance monitoring
- Automated retention cohort reports
- Churn risk flagging based on early warning indicators (rule-based, not AI)

## Metric Review Cadence

| Cadence | Metrics reviewed |
|---|---|
| Daily | Error rate, uptime, p95 latency |
| Weekly | WAPU (north star), activation funnel, feature usage |
| Biweekly | Retention cohorts, churn indicators, pipeline velocity |
| Monthly | All metrics, trend analysis, target adjustments |
