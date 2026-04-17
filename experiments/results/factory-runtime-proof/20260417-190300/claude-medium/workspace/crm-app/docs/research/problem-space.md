# Problem Space Analysis

## The Core Problem

Small-to-medium sales and service teams (5-50 users) lack affordable, low-friction systems for tracking customer relationships. They default to spreadsheets, sticky notes, email threads, and memory -- tools that break down as soon as a second person needs the same information.

## Problem Dimensions

### 1. Scattered Customer Data

**Observed pattern:** Each rep maintains their own contact list -- a personal spreadsheet, phone contacts, email folders. When a colleague needs to cover an account, they start from scratch.

**Impact on SME teams:**
- Duplicate contacts across reps cause conflicting outreach.
- Client history is locked in individual email inboxes.
- Onboarding a new rep means weeks of "ask Sarah about that account."
- Company-level context (industry, size, related contacts) is either missing or inconsistent.

**MVP response:** Shared contact and company records with linking, search, and filtering.

### 2. No Pipeline Visibility

**Observed pattern:** Managers reconstruct pipeline status by asking each rep individually or merging incompatible spreadsheets. The resulting picture is always stale.

**Impact on SME teams:**
- Revenue forecasting is guesswork -- managers cannot answer "what is in negotiation right now?"
- Stalled deals go unnoticed for weeks because no one is tracking stage aging.
- Reps over-invest in low-probability deals while ignoring quick wins.
- End-of-quarter scrambles happen because the pipeline was never visible.

**MVP response:** Opportunities with stages, a Kanban board with drag-and-drop, and a dashboard showing value per stage and win/loss counts.

### 3. Missed Follow-Ups

**Observed pattern:** Follow-up tasks live in reps' heads, personal to-do apps, sticky notes, or calendar reminders mixed with meetings. There is no shared visibility into who promised what.

**Impact on SME teams:**
- Deals go cold because the follow-up call never happened.
- Clients receive duplicate outreach when two reps forget they already contacted them.
- Managers cannot see which reps are overloaded or underactive.
- Service commitments ("I'll send the proposal by Friday") are forgotten.

**MVP response:** Tasks with due dates, assignees, and links to contacts/opportunities. Dashboard showing upcoming tasks within 7 days.

### 4. Lost Interaction Context

**Observed pattern:** After a call, reps either take no notes or jot them in a personal app. When they revisit the account weeks later, they cannot remember what was discussed.

**Impact on SME teams:**
- Clients repeat themselves, damaging trust.
- Handoffs between reps lose critical context.
- Managers cannot review call outcomes without asking the rep directly.
- Institutional knowledge walks out the door when a rep leaves.

**MVP response:** Notes on contacts, companies, and opportunities with reverse-chronological display and author attribution.

### 5. Tool Overhead and Adoption Failure

**Observed pattern:** SME teams that try enterprise CRMs (Salesforce, Dynamics) find them too complex to configure, too expensive per seat, and too burdensome for reps to use daily. Reps revert to spreadsheets within weeks.

**Impact on SME teams:**
- Wasted license costs on shelfware.
- Admin spends more time configuring the tool than the team spends using it.
- Data quality degrades because reps avoid the tool.
- The team loses trust in "CRM" as a category.

**MVP response:** Learnable in under 30 minutes, no configuration consultants, sensible defaults (seeded pipeline stages), and a fast interface that does not punish daily use.

## Who Feels These Problems

| Persona | Primary Pain | Secondary Pain |
|---|---|---|
| Sales rep | Scattered contacts, missed follow-ups | No quick pipeline view |
| Sales manager | No pipeline visibility | Cannot monitor rep activity |
| Service agent | Lost interaction context | No shared task tracking |
| Admin / team lead | Tool overhead, adoption failure | User/role management complexity |

## What the MVP Does Not Solve

The following are real problems for SME teams but are explicitly outside the MVP boundary:

- **Email integration:** Reps must manually log call/email outcomes as notes.
- **Bulk import:** Initial data entry from existing spreadsheets is manual or deferred.
- **Workflow automation:** Stage-change triggers, automatic task creation, and reminders are not included.
- **Custom fields:** Teams with unique data needs must work within fixed schemas.
- **Reporting beyond the dashboard:** Ad-hoc queries, date-range filters, and export are not included.
- **Mobile apps:** Responsive web only; no offline access.

These are intentional trade-offs to keep the MVP shippable and learnable. They represent the most likely areas for post-MVP expansion based on actual usage data.
