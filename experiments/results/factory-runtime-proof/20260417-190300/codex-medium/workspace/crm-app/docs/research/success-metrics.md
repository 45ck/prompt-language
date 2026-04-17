# Success metrics (MVP)

These metrics are chosen to match the bounded CRM MVP scope (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard) and the target market (small-to-medium sales and service teams).

## Adoption and activation
- **Activation rate:** % of invited users who sign in and create or update at least 1 record within 7 days.
- **Team activation:** orgs with ≥2 active users in the first 14 days.

## Data usefulness (quality, not volume)
- **Contact + company completeness:** % of opportunities linked to both a contact and a company (where applicable to the team’s workflow).
- **Interaction capture:** % of opportunities with at least 1 note in the last 14 days (for in-progress opportunities).

## Execution (follow-up loop)
- **Task creation rate:** average tasks created per active opportunity.
- **On-time follow-up:** % of tasks completed by due date.
- **Overdue backlog:** median overdue tasks per active user.

## Pipeline hygiene and visibility
- **Stage freshness:** % of in-progress opportunities updated (stage change or note) within last 14 days.
- **Stalled work:** count of opportunities with no activity beyond a defined freshness threshold.

## Operational reliability (MVP-level)
- **Error rate on create/update flows:** % of failed mutations for contacts/companies/opportunities/tasks/notes.
- **Median page load / API latency:** baseline p50 and p95 for key list pages (dashboard, opportunities list).

## Guardrails
- Metrics should not incentivize “busywork” data entry.
- Prefer measures that indicate maintained shared context and completed follow-ups.
