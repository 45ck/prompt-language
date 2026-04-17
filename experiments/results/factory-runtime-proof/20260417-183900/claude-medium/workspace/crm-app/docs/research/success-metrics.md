# Success Metrics: CRM MVP

## Overview

These metrics define measurable success criteria for the MVP launch. Each metric includes a target threshold, measurement method, and rationale. Metrics are grouped by category and prioritized for the first 30 days post-launch.

## Activation Metrics

| Metric | Target | Measurement | Rationale |
|---|---|---|---|
| User activation rate | >= 60% of signups complete onboarding | Count of users who create at least 1 contact within first session / total signups | A user who never adds a contact will not return. First-contact creation is the activation moment. |
| Time to first contact | < 3 minutes from login | Timestamp delta between first login and first contact record saved | Speed-to-value is the primary differentiator. If setup takes longer than 3 minutes, we are losing to spreadsheets. |
| Pipeline creation in first session | >= 40% of activated users | Count of users who create at least 1 opportunity in session one / activated users | Pipeline visibility is the core promise. Users who do not create a deal in session one are unlikely to build a pipeline later. |
| Contact creation in first session | >= 3 contacts created | Count of contacts created in first session / activated users | Users who add several contacts in session one are committing to the tool as their system of record. |

## Engagement Metrics (First 30 Days)

| Metric | Target | Measurement | Rationale |
|---|---|---|---|
| Weekly active users (WAU) | >= 40% of activated users | Distinct users with at least 1 session per week / activated users | A CRM that is not used weekly is abandoned. Weekly return indicates habit formation. |
| Task completion rate | >= 50% of created tasks marked done | Tasks with status "completed" / total tasks created | Tasks drive follow-up discipline. Low completion means reminders are ignored or tasks are poorly designed. |
| Notes per opportunity | >= 1 note per opportunity on average | Total notes linked to opportunities / total opportunities | Notes capture context. Zero-note opportunities suggest reps are not using the CRM as their system of record. |
| Pipeline stage transitions | >= 3 transitions per active user per week | Count of opportunity stage changes / active users / weeks | Movement through the pipeline indicates the CRM is reflecting real sales activity, not just static data entry. |

## Outcome Metrics (First 90 Days)

| Metric | Target | Measurement | Rationale |
|---|---|---|---|
| Time to first deal closed | < 30 days from signup | Timestamp delta between signup and first opportunity marked "Closed Won" | Demonstrates end-to-end pipeline utility. If no deals close in 30 days, the CRM is not integrated into the sales process. |
| Deal close rate | Establish baseline (no target yet) | Opportunities marked "Closed Won" / total opportunities reaching "Proposal" stage or later | MVP launch is too early for a target, but tracking from day one enables future benchmarking. |
| User retention at day 30 | >= 30% of activated users | Users with at least 1 session in days 25-30 / activated users | 30-day retention separates tools that stick from tools that are tried and dropped. |
| Qualitative feedback collected | >= 5 responses in first 90 days | Manual outreach to active users via email | Early qualitative signal of satisfaction. In-app NPS surveys are post-MVP. |

## Data Quality Metrics

| Metric | Target | Measurement | Rationale |
|---|---|---|---|
| Duplicate contact rate | < 10% of total contacts | Count of contacts sharing email or phone / total contacts | High duplicates signal missing deduplication or poor import. Degrades trust in the system. |
| Contacts with company linked | >= 70% | Contacts with a non-null company association / total contacts | Unlinked contacts mean no account-level view. Pipeline forecasting by company becomes impossible. |
| Opportunities with valid close date | >= 80% | Opportunities with a future or recent close date / total open opportunities | Deals without dates cannot appear in forecasts. Missing dates indicate reps are not planning. |

## Measurement Infrastructure

For MVP, metrics collection should be lightweight:

- **Server-side event logging**: Record key actions (contact created, opportunity stage changed, task completed) to an append-only events table with timestamp and user ID.
- **Weekly SQL queries**: No analytics platform needed at launch. Run queries against the events table weekly.
- **User feedback**: Manual email outreach to active users at day 30 and day 60. No in-app survey for MVP.
- **Dashboard counters**: Surface total contacts, open opportunities, and overdue tasks on the main dashboard as real-time indicators.

## Metric Review Schedule

| Timeframe | Review Focus |
|---|---|
| Week 1 | Activation rate, time to first contact, import completion |
| Week 2-4 | WAU, task completion, pipeline transitions |
| Day 30 | Retention, begin manual feedback outreach |
| Day 90 | Deal close rate baseline, time to first deal closed |
