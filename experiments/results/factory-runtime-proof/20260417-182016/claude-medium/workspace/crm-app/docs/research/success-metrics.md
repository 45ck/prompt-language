# Success Metrics

## Overview

These KPIs measure whether the CRM MVP delivers value to SME sales and service teams. Metrics are grouped by category and include measurement method, target threshold, and measurement frequency. All metrics are scoped to the eight MVP modules: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, and dashboard.

## Category 1: User Adoption

### M1: Daily Active Users (DAU) / Total Users Ratio

**Definition:** Percentage of registered users who log in and perform at least one action per business day.

**Target:** 60% DAU/total within 30 days of team onboarding.

**Measurement:** Count distinct user IDs with any create, update, or view action per day. Divide by total active (non-deactivated) users. Track via application-level event logging.

**Frequency:** Daily, reviewed weekly.

**Rationale:** CRM value depends on consistent use. Below 40%, the team is reverting to spreadsheets. Above 60% indicates the tool has become part of the daily workflow.

### M2: Time to First Value

**Definition:** Elapsed time from first login to creating the first contact, company, and opportunity.

**Target:** Under 10 minutes for all three actions.

**Measurement:** Record timestamps of first contact creation, first company creation, and first opportunity creation per user. Calculate delta from first login.

**Frequency:** Per user at onboarding, aggregated monthly.

**Rationale:** If a user cannot create core records within 10 minutes, the UI has too much friction.

### M3: User Retention at 30 Days

**Definition:** Percentage of users who performed at least one action in week 4 after their first login.

**Target:** 70% retention at day 30.

**Measurement:** Cohort analysis: group users by signup week, check for any activity in days 22-30.

**Frequency:** Monthly.

## Category 2: Contact and Company Management

### M4: Contact Creation Rate

**Definition:** Number of new contacts created per user per week.

**Target:** 5+ contacts per active user per week during the first month (initial data entry), stabilizing to 2+ per week ongoing.

**Measurement:** Count contact records created, grouped by creating user and week.

**Frequency:** Weekly.

**Rationale:** Low creation rates suggest the team is maintaining contacts elsewhere or the creation flow is too cumbersome.

### M5: Contact Completeness Score

**Definition:** Percentage of contact records with email, phone, and associated company filled in.

**Target:** 70% of contacts have all three fields populated.

**Measurement:** Query contacts where email is not null, phone is not null, and company_id is not null. Divide by total contacts.

**Frequency:** Weekly.

**Rationale:** Incomplete contacts reduce the CRM's value as a shared information source. Low completeness indicates the form design needs improvement or the team is doing quick-entry without follow-up.

## Category 3: Pipeline and Revenue

### M6: Pipeline Stage Conversion Rate

**Definition:** Percentage of opportunities that advance from one stage to the next across the defined pipeline (lead, qualified, proposal, negotiation, closed-won).

**Target:** Stage-to-stage conversion rates tracked and visible. No universal target, but the team should establish baselines within 60 days.

**Measurement:** For each stage transition, count opportunities that moved forward divided by opportunities that entered the stage. Exclude opportunities moved to closed-lost.

**Frequency:** Monthly.

**Rationale:** This is the core analytical value of a pipeline CRM. If the team cannot see conversion rates, the pipeline view is decoration rather than a management tool.

### M7: Average Deal Cycle Time

**Definition:** Median number of days from opportunity creation to closed-won or closed-lost.

**Target:** Baseline established within 60 days. Subsequent goal: 10% reduction in cycle time within 6 months of CRM adoption.

**Measurement:** Calculate the difference between opportunity created_at and the timestamp of the stage change to closed-won or closed-lost.

**Frequency:** Monthly.

### M8: Pipeline Value Accuracy

**Definition:** Ratio of total pipeline value (sum of open opportunity amounts) to actual closed-won revenue in the same period.

**Target:** Pipeline-to-close ratio stabilizes to a predictable range (typically 3:1 to 5:1 for SME sales).

**Measurement:** Sum open opportunity values at period start. Compare to closed-won sum at period end.

**Frequency:** Quarterly.

## Category 4: Task and Follow-Up Discipline

### M9: Task Completion Rate

**Definition:** Percentage of tasks marked complete by their due date.

**Target:** 80% on-time completion.

**Measurement:** Count tasks where completed_at is not null and completed_at is less than or equal to due_date. Divide by total tasks with a due date that has passed.

**Frequency:** Weekly.

**Rationale:** Below 60% indicates the task system is creating overhead without driving follow-through. The team may need fewer, higher-quality tasks rather than more tasks.

### M10: Overdue Task Count per User

**Definition:** Number of tasks past due date and not completed, per user.

**Target:** Fewer than 5 overdue tasks per user at any time.

**Measurement:** Query tasks where due_date is in the past, completed_at is null, grouped by assignee.

**Frequency:** Daily (displayed on dashboard).

## Category 5: System Performance

### M11: API Response Time (P95)

**Definition:** 95th percentile response time for all API endpoints.

**Target:** Under 200ms for list endpoints, under 100ms for single-record endpoints, under 500ms for dashboard aggregation.

**Measurement:** Server-side timing middleware logs response duration per endpoint. Aggregate P50, P95, P99.

**Frequency:** Continuous monitoring, reviewed weekly.

### M12: Page Load Time

**Definition:** Time from navigation to interactive for key pages (contact list, pipeline board, dashboard).

**Target:** Under 2 seconds on a standard broadband connection (50 Mbps).

**Measurement:** Client-side performance API (First Contentful Paint, Time to Interactive). Synthetic monitoring with Lighthouse or equivalent.

**Frequency:** Per release, with regression alerts.

## Measurement Implementation

All metrics except M11 and M12 can be derived from database queries against the existing schema without additional instrumentation. The MVP should include:

1. A `user_actions` table or append-only log capturing user ID, action type, entity type, and timestamp for adoption metrics (M1, M2, M3).
2. Database indexes supporting the aggregation queries for pipeline metrics (M6, M7, M8).
3. Server-side response timing middleware for M11.
4. A dashboard widget showing M9 and M10 per user.

Metrics M6, M7, and M8 require an `opportunity_stage_history` table tracking each stage transition with timestamp. This should be included in the initial schema design.

## Review Cadence

| Frequency | Metrics |
|-----------|---------|
| Daily | M1, M10 (dashboard) |
| Weekly | M4, M5, M9, M11 |
| Monthly | M2, M3, M6, M7 |
| Quarterly | M8 |
| Per release | M12 |
