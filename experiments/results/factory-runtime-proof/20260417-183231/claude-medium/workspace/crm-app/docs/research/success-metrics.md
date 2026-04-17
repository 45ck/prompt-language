# Success Metrics: CRM MVP

## Overview

This document defines key performance indicators (KPIs) for the CRM MVP. Metrics are scoped to what can be measured within the MVP's feature set: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, and dashboard. No metrics depend on features outside MVP scope (email integration, automation, advanced reporting).

## Metric Categories

1. **User Adoption** -- Are teams actually using the CRM daily?
2. **Pipeline Effectiveness** -- Is pipeline visibility improving deal management?
3. **Operational Efficiency** -- Is the CRM reducing manual work?
4. **Data Quality** -- Is the CRM becoming the source of truth?

---

## 1. User Adoption Metrics

### 1.1 Daily Active Users (DAU) / Total Users

**What it measures:** Percentage of registered users who log in and perform at least one action per day.

| Attribute | Detail |
|---|---|
| Target | 60% DAU rate within 30 days of team onboarding |
| Measurement | Count distinct users with at least one API request per calendar day, divided by total active (non-deactivated) users. Tracked via server-side request logging. |
| Timeframe | Measured weekly, starting from the day the team completes onboarding (first contact imported). |
| Baseline | 0% (new product). Compare against industry benchmark: 30-40% DAU is typical for SME SaaS tools. |
| Success threshold | 40% = acceptable, 60% = good, 75%+ = excellent |

### 1.2 Time to First Value

**What it measures:** Elapsed time from user signup to creating their first contact record.

| Attribute | Detail |
|---|---|
| Target | Median under 15 minutes |
| Measurement | Timestamp difference between account creation and first contact record creation. Tracked via database timestamps. |
| Timeframe | Measured per user at onboarding. Aggregated monthly. |
| Baseline | N/A (new product). Industry benchmark for SME tools: 30-60 minutes. |
| Success threshold | < 10 min = excellent, < 15 min = good, < 30 min = acceptable, > 30 min = investigate friction |

### 1.3 Feature Breadth Adoption

**What it measures:** Percentage of teams using all core features (contacts, companies, opportunities, tasks, notes, dashboard) within 14 days.

| Attribute | Detail |
|---|---|
| Target | 70% of teams use all 6 feature areas within 14 days |
| Measurement | Track first usage of each feature area per organization: create contact, create company, create opportunity, create task, create note, view dashboard. |
| Timeframe | Measured at 14-day mark per organization. |
| Baseline | N/A. |
| Success threshold | 50% = acceptable, 70% = good. If a feature area has < 30% adoption, investigate whether it is discoverable. |

### 1.4 7-Day Retention

**What it measures:** Percentage of users who return in week 2 after signing up in week 1.

| Attribute | Detail |
|---|---|
| Target | 70% week-2 retention |
| Measurement | Users who performed at least one action in days 8-14 after signup, divided by users who signed up in that cohort. |
| Timeframe | Measured weekly by signup cohort. |
| Baseline | Industry benchmark for SME SaaS: 40-60% week-2 retention. |
| Success threshold | 50% = acceptable, 70% = good, 80%+ = excellent |

---

## 2. Pipeline Effectiveness Metrics

### 2.1 Pipeline Conversion Rate

**What it measures:** Percentage of opportunities that move from first stage (Lead) to Closed Won.

| Attribute | Detail |
|---|---|
| Target | Measurable conversion rate established within 60 days; improvement trend visible by 90 days |
| Measurement | Count opportunities reaching "Closed Won" divided by total opportunities created, per month. Break down by stage-to-stage conversion to identify bottlenecks. |
| Timeframe | Monthly measurement. Requires 60+ days of data for meaningful analysis. |
| Baseline | Teams typically do not know their current conversion rate (that is part of the problem). First 60 days establish the baseline. |
| Success threshold | Having the data at all is the initial win. A 5-10% improvement in conversion rate after 6 months of CRM use would indicate the pipeline visibility is driving better behavior. |

### 2.2 Average Time in Stage

**What it measures:** How long opportunities sit in each pipeline stage before advancing or being lost.

| Attribute | Detail |
|---|---|
| Target | Identify and reduce the longest stage by 20% within 90 days |
| Measurement | Timestamp difference between opportunity entering and leaving each stage. Calculated from opportunity update history. |
| Timeframe | Weekly measurement per stage. Requires 30+ days of data. |
| Baseline | Established from first 30 days of usage. |
| Success threshold | Reduction in average time for the longest stage. Any reduction indicates that visibility is driving action. |

### 2.3 Stale Opportunity Rate

**What it measures:** Percentage of open opportunities with no activity (note, task completion, stage change) in the last 14 days.

| Attribute | Detail |
|---|---|
| Target | Less than 15% of open opportunities are stale at any time |
| Measurement | Count open opportunities where last activity timestamp is older than 14 days, divided by total open opportunities. Dashboard widget displays this. |
| Timeframe | Real-time dashboard metric, reviewed weekly. |
| Baseline | Establish from first 30 days. |
| Success threshold | < 10% = excellent, < 15% = good, < 25% = acceptable, > 25% = teams are not maintaining pipeline hygiene |

---

## 3. Operational Efficiency Metrics

### 3.1 Time to Log an Interaction

**What it measures:** How long it takes a user to create a note on a contact or opportunity.

| Attribute | Detail |
|---|---|
| Target | Median under 30 seconds for a text note |
| Measurement | Client-side timing from "click add note" to "note saved" confirmation. Tracked via frontend instrumentation. |
| Timeframe | Measured continuously. Aggregated weekly. |
| Baseline | Estimated current state (updating a spreadsheet row): 1-3 minutes including finding the right row. |
| Success threshold | < 20 sec = excellent, < 30 sec = good, < 60 sec = acceptable, > 60 sec = UX needs work |

### 3.2 Task Completion Rate

**What it measures:** Percentage of tasks marked complete versus total tasks created.

| Attribute | Detail |
|---|---|
| Target | 75% completion rate within task due dates |
| Measurement | Tasks marked complete on or before due date, divided by total tasks with due dates, per month. |
| Timeframe | Monthly measurement. |
| Baseline | Teams currently have no measurable task completion rate (tasks are in personal tools). |
| Success threshold | 60% = acceptable (indicates adoption), 75% = good, 85%+ = excellent |

### 3.3 Overdue Task Reduction

**What it measures:** Trend in the number of overdue tasks over time.

| Attribute | Detail |
|---|---|
| Target | Declining trend in overdue tasks after the first 30 days |
| Measurement | Count of tasks past due date and not completed, measured daily. |
| Timeframe | Daily snapshot, trend measured monthly. |
| Baseline | Established from days 15-30 (allow team to build up task history first). |
| Success threshold | Month-over-month reduction in overdue percentage. An increase suggests the task system adds burden without enough value. |

### 3.4 Context Lookup Time

**What it measures:** How quickly a user can find the full history of a contact before a call or meeting.

| Attribute | Detail |
|---|---|
| Target | Median under 10 seconds from search to viewing contact detail page |
| Measurement | Client-side timing from search initiation to contact detail page render. |
| Timeframe | Measured continuously. |
| Baseline | Estimated current state (searching email + spreadsheet + Slack): 2-5 minutes. |
| Success threshold | < 5 sec = excellent, < 10 sec = good, < 30 sec = acceptable |

---

## 4. Data Quality Metrics

### 4.1 Contact Completeness

**What it measures:** Percentage of contact records with key fields populated (name, email, phone, company association).

| Attribute | Detail |
|---|---|
| Target | 80% of contacts have name + email + company link within 60 days |
| Measurement | Count contacts with all three fields populated, divided by total contacts. |
| Timeframe | Weekly measurement. |
| Baseline | After initial CSV import, measure starting completeness. |
| Success threshold | 60% = acceptable, 80% = good. Below 50% suggests the import process or data entry flow needs improvement. |

### 4.2 Opportunity-Contact Association Rate

**What it measures:** Percentage of opportunities linked to at least one contact.

| Attribute | Detail |
|---|---|
| Target | 90% of opportunities linked to a contact |
| Measurement | Count opportunities with at least one associated contact, divided by total opportunities. |
| Timeframe | Weekly measurement. |
| Baseline | Establish from first 30 days. |
| Success threshold | 80% = acceptable, 90% = good. Below 70% suggests the UX for linking contacts to opportunities is too cumbersome. |

### 4.3 Single Source of Truth Adoption

**What it measures:** Whether the CRM has replaced spreadsheets as the primary customer data store.

| Attribute | Detail |
|---|---|
| Target | Team self-reports CRM as primary source within 60 days |
| Measurement | Qualitative survey at 30 and 60 days: "Where do you look first for customer information?" Options: CRM, spreadsheet, email, Slack, other. |
| Timeframe | Survey at 30 and 60 days post-onboarding. |
| Baseline | 0% (pre-CRM, spreadsheet/email is primary). |
| Success threshold | 60% of team members report CRM as primary source at 60 days. |

---

## Measurement Infrastructure (MVP Scope)

The following instrumentation is required within the MVP to support these metrics:

1. **Server-side request logging:** Timestamp, user ID, organization ID, endpoint, method. Used for DAU, feature adoption, retention.
2. **Entity timestamps:** `createdAt` and `updatedAt` on all records. Used for time-to-first-value, pipeline stage timing, stale opportunity detection.
3. **Opportunity stage history:** A separate table logging stage transitions with timestamps. Used for conversion rate, time-in-stage.
4. **Dashboard queries:** Pre-built queries for stale opportunities, overdue tasks, pipeline summary. Used for operational metrics.
5. **Client-side timing (optional in MVP):** Frontend performance marks for note creation and search-to-detail flows. Can be deferred to V2 and estimated from server-side logs initially.

## Review Cadence

| Frequency | Metrics Reviewed | Audience |
|---|---|---|
| Weekly | DAU, overdue tasks, stale opportunities | Development team |
| Monthly | All adoption and efficiency metrics | Product + development team |
| Quarterly | Pipeline effectiveness, data quality, source-of-truth survey | Full stakeholder review |

## Anti-Metrics (What NOT to Optimize For)

- **Total records created.** More contacts is not better if they are duplicates or low quality.
- **Time spent in app.** Longer sessions likely mean the UX is slow, not that users are engaged.
- **Number of features shipped.** Feature count does not correlate with adoption or value delivery.
- **Pipeline total value.** Inflated deal values create false confidence. Focus on conversion rate and velocity instead.
