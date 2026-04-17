# Workflow Patterns

## Overview

This document maps the real-world sales workflows that SME teams follow daily and shows how the MVP's feature set (contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard) supports each workflow. The goal is to ensure the data model and UI serve actual work patterns rather than abstract entity management.

## Core Sales Workflow: Lead to Close

The primary workflow for any SME sales team follows a predictable progression. The specific stage names vary by industry, but the pattern is consistent.

### Standard Pipeline Stages

| Stage | Description | Typical duration | Key actions |
|---|---|---|---|
| Lead | New contact or inbound inquiry, not yet qualified | 1-3 days | Add contact, log source, initial outreach |
| Qualified | Confirmed as a real opportunity with budget and need | 3-7 days | Discovery call, add notes, link to company |
| Proposal | Proposal or quote sent to the prospect | 5-14 days | Create proposal, send, set follow-up task |
| Negotiation | Active discussion on terms, pricing, or scope | 7-21 days | Update deal value, log call notes, adjust terms |
| Closed Won | Deal signed and payment initiated | Terminal | Mark won, record final value, celebrate |
| Closed Lost | Deal did not proceed | Terminal | Mark lost, record reason, set re-engage task |

### Workflow Detail: Lead Stage

**Trigger**: A new lead arrives via website form, referral, cold outreach response, or event.

**Actions in MVP**:
1. Create a **contact** with name, email, phone, source
2. Create or link to a **company** if the contact is associated with an organization
3. Create an **opportunity** in the "Lead" stage with estimated value
4. Add a **note** recording how the lead arrived and initial impressions
5. Create a **task** for first outreach (call or email) with a due date

**Data relationships**:
- Contact belongs to Company (optional)
- Opportunity belongs to Contact and Company
- Note is attached to the Opportunity
- Task is attached to the Opportunity and assigned to a user

### Workflow Detail: Qualification

**Trigger**: Initial outreach completed, prospect responded positively.

**Actions in MVP**:
1. Move opportunity from "Lead" to "Qualified" (drag in pipeline view or select stage)
2. Add a **note** summarizing the discovery call: budget, timeline, decision-maker, pain points
3. Update opportunity **value** if better information is available
4. Create **tasks** for: send case study, schedule demo, prepare proposal
5. Update **contact** with additional details learned (title, direct phone)

**Decision point**: If the prospect is not a fit (no budget, wrong timing, no authority), move to "Closed Lost" with a reason note instead.

### Workflow Detail: Proposal

**Trigger**: Qualification complete, prospect wants a proposal.

**Actions in MVP**:
1. Move opportunity to "Proposal" stage
2. Add a **note** with proposal details (scope, pricing, timeline)
3. Create a **task** for follow-up after sending proposal (typically 3-5 days)
4. Update opportunity value to match proposal amount

**What the MVP does not do** (and that is acceptable): The MVP does not generate proposals, send emails, or track email opens. The user creates the proposal in their existing tool and uses the CRM to track that the proposal was sent and when to follow up.

### Workflow Detail: Negotiation

**Trigger**: Prospect received the proposal and is discussing terms.

**Actions in MVP**:
1. Move opportunity to "Negotiation" stage
2. Add **notes** after each call or email exchange summarizing positions
3. Update opportunity **value** if pricing changes during negotiation
4. Create **tasks** for: send revised proposal, schedule decision meeting, follow up on contract review

### Workflow Detail: Close

**Trigger**: Prospect agrees to terms (Closed Won) or declines (Closed Lost).

**Actions in MVP for Closed Won**:
1. Move opportunity to "Closed Won"
2. Add a **note** with final terms and any onboarding details
3. Create **tasks** for handoff to delivery/support team
4. Update final deal value

**Actions in MVP for Closed Lost**:
1. Move opportunity to "Closed Lost"
2. Add a **note** recording the reason for loss (pricing, timing, competitor, no decision)
3. Optionally create a **task** to re-engage in 3-6 months

## Supporting Workflows

### Contact Management Workflow

Not all contacts are tied to active deals. Teams also need to manage:

**Networking contacts**: People met at events or through referrals who are not yet leads.
- Create contact with source "Event" or "Referral"
- Add a note with context (where met, what discussed)
- Create a task to follow up within a week

**Existing customer contacts**: People at companies that have already closed.
- Contact remains linked to company
- Notes track ongoing relationship (check-in calls, upsell conversations)
- Tasks track renewal dates or expansion opportunities

**Dormant contacts**: Old leads that went cold.
- Search contacts by last activity date
- Create tasks for re-engagement campaigns
- Add notes when re-engaging to capture updated context

### Company-Level Workflow

Companies aggregate multiple contacts and opportunities:

**Account planning**:
- View all contacts at a company
- View all opportunities (open and closed) for a company
- Review notes across all company interactions
- Identify patterns: multiple closed-lost may indicate a structural mismatch

**Multi-threaded selling** (common in B2B):
- Track multiple contacts at the same company (champion, decision-maker, influencer)
- Link a single opportunity to the company, with notes referencing different contacts
- Create tasks for different contacts (demo for champion, ROI doc for decision-maker)

### Task Management Workflow

Tasks are the "do not forget" layer of the CRM. They prevent follow-ups from falling through the cracks.

**Daily task review**:
1. User opens dashboard or task list
2. Views tasks due today and overdue tasks
3. Completes tasks or reschedules them
4. Creates new tasks from calls and meetings throughout the day

**Task patterns by pipeline stage**:

| Stage | Common tasks |
|---|---|
| Lead | Initial outreach, research company, qualify fit |
| Qualified | Schedule demo, send case study, prepare proposal |
| Proposal | Follow up on proposal, schedule review call |
| Negotiation | Send revised terms, get legal review, schedule close meeting |
| Closed Won | Send contract, schedule onboarding, introduce to support |
| Closed Lost | Log loss reason, set re-engage reminder |

**Task assignment**:
- Tasks are assigned to a specific user (the owner)
- Managers can view all team tasks to check workload distribution
- Overdue tasks surface on the dashboard as an alert

### Notes Workflow

Notes are the institutional memory of the CRM. They capture context that structured fields cannot.

**After every interaction**:
1. Open the relevant contact, company, or opportunity
2. Add a note with: date, interaction type (call, email, meeting), summary, next steps
3. Notes appear in reverse chronological order (most recent first)

**Note patterns**:
- **Call notes**: "Spoke with Jane. Budget approved for Q2. Needs proposal by Friday. Decision-maker is her VP, Tom Smith."
- **Email summary**: "Sent proposal at $24K/year. Highlighted migration support. Jane will review with Tom this week."
- **Meeting notes**: "Demo went well. Jane excited about pipeline view. Tom asked about data export and security. Need to send SOC 2 cert."
- **Internal notes**: "Flagging this account -- they went through a reorg. New VP may not have context. Approach carefully."

**Search and discovery**: Users should be able to search notes by keyword to find past context. "What did we discuss about pricing with Acme Corp?" should be answerable by searching notes on the Acme company record.

## Dashboard Patterns

The dashboard is the first thing a user sees when they open the CRM. It must answer the question "How is my pipeline looking?" within 5 seconds.

### Pipeline Funnel

**What it shows**: A horizontal funnel or bar chart showing the number of opportunities and total value in each pipeline stage.

**Example**:
```
Lead:         8 deals  |  $42,000
Qualified:    5 deals  |  $78,000
Proposal:     3 deals  |  $56,000
Negotiation:  2 deals  |  $34,000
---
Total open:  18 deals  |  $210,000
```

**Why it matters**: Shows pipeline health at a glance. A healthy funnel is wider at the top and narrower at the bottom. An inverted funnel (more deals in Negotiation than Lead) means the pipeline will dry up soon.

**Interaction**: Clicking a stage navigates to the filtered opportunity list for that stage.

### Deal Aging / Stale Deals

**What it shows**: Opportunities that have been in their current stage for longer than a threshold (configurable, default 14 days) with no activity (no notes, no task completions, no stage changes).

**Example**:
```
Stale deals (no activity > 14 days):
- Acme Corp - Website Redesign    | Proposal | 21 days stale | $15,000
- Beta Inc - Consulting Retainer  | Qualified | 18 days stale | $8,000
```

**Why it matters**: Stale deals are the most common source of lost revenue. A rep who forgets to follow up on a proposal loses deals that were winnable. This widget surfaces forgotten opportunities.

### Activity Feed

**What it shows**: A chronological list of recent actions across the team.

**Example**:
```
Today:
  Sarah moved "Acme Corp - Redesign" to Negotiation
  Mike added a note on "Beta Inc - Retainer"
  Sarah completed task: "Follow up on Gamma proposal"
  Mike created opportunity: "Delta Corp - Migration" ($22,000)

Yesterday:
  Sarah added contact: Tom Smith (Acme Corp)
  Mike moved "Epsilon Ltd - Support" to Closed Won ($12,000)
```

**Why it matters**: Gives managers visibility into team activity without micromanaging. Also helps reps see what teammates are doing, preventing duplicate outreach.

### My Tasks (Due Today / Overdue)

**What it shows**: The current user's tasks due today and any overdue tasks.

**Example**:
```
Overdue:
  [ ] Follow up on Acme proposal (due 2 days ago)
  [ ] Send case study to Beta Inc (due yesterday)

Due today:
  [ ] Call Jane at Gamma Corp
  [ ] Prepare proposal for Delta Corp
  [ ] Schedule demo with Epsilon Ltd

Upcoming (next 3 days):
  [ ] Send contract to Acme Corp
  [ ] Check in with Beta Inc
```

**Why it matters**: This is the action-oriented view. Users open the dashboard, see what needs to be done today, and start working through the list.

### Closed Deals Summary

**What it shows**: Deals closed (won and lost) in the current month/quarter with totals.

**Example**:
```
April 2026:
  Won:  4 deals | $48,000
  Lost: 2 deals | $19,000
  Win rate: 67%
```

**Why it matters**: Provides a sense of progress and performance. The win rate helps teams understand their conversion efficiency.

## Pipeline View (Kanban Board)

In addition to the dashboard, the pipeline view is a dedicated page showing opportunities as a kanban board.

### Layout

- Columns represent pipeline stages (left to right: Lead through Closed)
- Cards represent individual opportunities
- Each card shows: company name, deal name, value, days in stage, assigned rep
- Cards can be dragged between columns to change stage

### Card detail

Clicking a card opens a side panel or modal with:
- Full opportunity details (value, expected close date, assigned rep)
- Related contact and company (clickable links)
- Notes (most recent first, with ability to add)
- Tasks (with ability to add and complete)
- Stage history (when the deal moved between stages)

### Filtering

- By assigned rep (for managers viewing team pipeline)
- By value range (focus on large deals)
- By days in stage (find stale deals)
- By expected close date (focus on this month's pipeline)

## Workflow-to-Feature Mapping Summary

| Workflow | Contacts | Companies | Opportunities | Stages | Tasks | Notes | Dashboard |
|---|---|---|---|---|---|---|---|
| Lead intake | Create | Create/link | Create in Lead | Lead | First outreach | Source/context | -- |
| Qualification | Update details | -- | Move stage | Qualified | Demo/proposal prep | Call summary | -- |
| Proposal | -- | -- | Move stage, update value | Proposal | Follow-up | Proposal details | -- |
| Negotiation | -- | -- | Move stage, update value | Negotiation | Revised terms | Call summaries | -- |
| Close | -- | -- | Move to terminal | Won/Lost | Handoff/re-engage | Final terms/reason | Won/lost summary |
| Daily review | Search | -- | -- | -- | Due today view | Search | Funnel + tasks |
| Manager oversight | -- | -- | -- | -- | Team tasks | -- | Activity feed |
| Account planning | View all | View all | View history | -- | -- | Review all | -- |

This mapping confirms that all seven MVP entities participate in the core workflows. No entity is redundant, and no critical workflow step requires a feature outside the MVP scope.
