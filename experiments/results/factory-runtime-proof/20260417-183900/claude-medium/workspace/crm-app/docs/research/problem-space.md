# Problem Space: SME Sales & Service Without a CRM

## Overview

Small-to-medium sales and service teams (5-50 people) commonly operate without a dedicated CRM, relying on spreadsheets, email threads, sticky notes, and tribal knowledge. This document catalogs the real workflow pain points that a CRM MVP must address.

## Core Problems

### 1. Lost Leads

- Inbound inquiries arrive via email, phone, web forms, and referrals with no single intake point.
- Leads sit in individual inboxes; when a rep is out sick or leaves, those leads vanish.
- No systematic way to track where a lead came from.
- Duplicate leads are created when two reps contact the same prospect independently.

### 2. No Pipeline Visibility

- Managers cannot answer "how much revenue is likely to close this month?" without polling each rep.
- Deal stages exist only in reps' heads: "I think they're close" is the best forecast available.
- Stalled deals are invisible until quarterly reviews reveal a prospect went cold weeks ago.
- No way to spot bottlenecks (e.g., 15 deals stuck at "proposal sent" for 30+ days).

### 3. Scattered Notes and Context

- Meeting notes live in personal notebooks, Google Docs, or Slack threads.
- When a deal is handed off (rep change, escalation to manager), context is lost.
- Customer history is reconstructed by searching email, which is slow and incomplete.
- Key details (budget, decision-maker name, competitor mentioned) are not captured consistently.

### 4. Missed Follow-Ups

- Reps rely on memory or personal to-do lists to schedule callbacks and next steps.
- No automated reminders when a follow-up date passes without action.
- Service tickets or post-sale check-ins fall through the cracks after the initial sale.
- Average SME rep forgets 20-30% of promised follow-ups within one week (industry surveys).

### 5. No Reporting or Accountability

- Sales performance is measured anecdotally: "we had a good month."
- Win/loss reasons are not recorded, so the team cannot learn from patterns.
- Activity metrics (calls made, meetings held) are not tracked.
- Forecasting is guesswork, making hiring and inventory decisions unreliable.

### 6. Contact and Company Data Decay

- Customer phone numbers and emails change; spreadsheets are never updated.
- No link between a contact and their company, so account-level context is missing.
- Duplicate contacts accumulate across reps' personal address books.
- Departing employees take their contact lists with them.

## Impact on the Business

| Pain Point | Business Impact |
|---|---|
| Lost leads | Direct revenue loss; wasted marketing spend |
| No pipeline visibility | Inaccurate forecasting; cash flow surprises |
| Scattered notes | Slower deal cycles; poor customer experience |
| Missed follow-ups | Lost deals; customer churn |
| No reporting | Cannot optimize sales process or coach reps |
| Data decay | Redundant outreach; embarrassing mistakes |

## What the MVP Must Solve

The CRM MVP targets the highest-impact, lowest-complexity problems first:

1. **Centralized contact and company records** -- single source of truth, accessible to all reps.
2. **Opportunity tracking with pipeline stages** -- visual pipeline with drag-and-drop stage progression.
3. **Task management with due dates** -- follow-up reminders tied to contacts and deals.
4. **Notes linked to records** -- meeting notes, call logs attached to contacts/opportunities.
5. **Dashboard with pipeline summary** -- real-time view of deal count, value, and stage distribution.

Authentication (login/roles) is a prerequisite for multi-user access but is not a differentiating feature.

## Out of Scope for MVP

- Email integration and tracking
- Marketing automation and lead scoring
- Quoting, invoicing, or CPQ
- Advanced reporting and custom dashboards
- Mobile app (responsive web is sufficient)
- Third-party integrations (Slack, calendar sync)
