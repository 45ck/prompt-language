# Workflow Patterns: SME Sales & Service Teams

## Overview

This document maps common SME sales and service workflows to the CRM MVP's entity model: contacts, companies, opportunities, pipeline stages, tasks, notes, and dashboard. The goal is to verify that the MVP scope covers the core workflows without requiring features outside scope.

## Entity Model Reference

```
User (auth)
  |
  +-- Contact (person)
  |     +-- Notes
  |     +-- Tasks
  |     +-- Opportunities
  |
  +-- Company (organization)
  |     +-- Contacts (many)
  |     +-- Notes
  |     +-- Tasks
  |     +-- Opportunities
  |
  +-- Opportunity (deal or project)
  |     +-- Pipeline Stage
  |     +-- Contacts (many)
  |     +-- Company
  |     +-- Notes
  |     +-- Tasks
  |
  +-- Pipeline Stage (ordered list)
  |
  +-- Dashboard (aggregated views)
```

---

## Part 1: Sales Workflows

### Workflow S1: Lead Capture

**Real-world trigger:** A potential customer fills out a form, sends an email, calls in, or is referred by an existing customer.

**Current SME practice:** Rep adds a row to the spreadsheet, or saves the email and plans to "deal with it later."

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Create contact | Contact | Name, email, phone, source (manual tag in notes) |
| 2 | Link to company (if known) | Company | Create or select existing company |
| 3 | Add context note | Note on Contact | How they found us, initial interest, any details from the conversation |
| 4 | Create follow-up task | Task on Contact | "Initial qualification call" with due date (24-48 hours) |

**What the dashboard shows:** New contacts created this week. Tasks due today.

**MVP coverage:** Full. No features outside scope required.

---

### Workflow S2: Qualification

**Real-world trigger:** Rep has an initial conversation and determines whether the lead is a fit.

**Current SME practice:** Rep updates the spreadsheet status column. Maybe sends a Slack message to the manager. Notes stay in the rep's head or email.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Log qualification call | Note on Contact | Call summary, needs identified, budget range, timeline, decision maker |
| 2 | Create opportunity (if qualified) | Opportunity | Title, estimated value, expected close date, linked to contact + company |
| 3 | Set pipeline stage | Pipeline Stage | "Qualified" |
| 4 | Create next task | Task on Opportunity | "Send intro materials" or "Schedule demo" with due date |
| 5 | (If not qualified) Add note and close | Note on Contact | Reason for disqualification. No opportunity created. |

**What the dashboard shows:** Opportunities in "Qualified" stage. Opportunity value by stage.

**MVP coverage:** Full.

---

### Workflow S3: Proposal / Demo

**Real-world trigger:** Qualified prospect is ready for a detailed proposal or product demo.

**Current SME practice:** Rep creates a proposal doc (Google Docs, Word), emails it, and sets a personal reminder to follow up.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Move opportunity to "Proposal" stage | Opportunity | Stage change |
| 2 | Log proposal details | Note on Opportunity | What was proposed, pricing, terms, any objections raised |
| 3 | Create follow-up task | Task on Opportunity | "Follow up on proposal" with due date (3-5 days) |
| 4 | Add additional contacts if needed | Contact | Decision maker, technical evaluator, procurement |
| 5 | Link contacts to opportunity | Opportunity-Contact | Associate all involved people |

**What the dashboard shows:** Opportunities in "Proposal" stage. Overdue follow-up tasks.

**MVP coverage:** Full. Note: The MVP does not include document generation or email tracking. The proposal itself is created outside the CRM. The CRM tracks that a proposal was sent and captures the follow-up.

---

### Workflow S4: Negotiation and Close

**Real-world trigger:** Prospect responds to proposal with questions, counter-offers, or acceptance.

**Current SME practice:** Email back-and-forth. Rep updates spreadsheet when the deal closes. Manager finds out at the weekly meeting.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Move to "Negotiation" stage | Opportunity | Stage change |
| 2 | Log each interaction | Note on Opportunity | Counter-offer details, concessions, revised terms |
| 3 | Update opportunity value if terms change | Opportunity | Updated estimated value and close date |
| 4 | On win: move to "Closed Won" | Opportunity | Stage change, actual close date |
| 5 | On loss: move to "Closed Lost" | Opportunity | Stage change + note with loss reason |
| 6 | Create onboarding tasks (if won) | Task on Opportunity/Contact | "Send welcome email", "Schedule kickoff call" |

**What the dashboard shows:** Won/lost ratio. Revenue closed this month. Pipeline value by stage.

**MVP coverage:** Full.

---

### Workflow S5: Post-Sale Handoff

**Real-world trigger:** Deal is closed; the customer needs to be onboarded or transitioned to the service team.

**Current SME practice:** Sales rep sends a Slack message to the service lead with a summary. Context is partially lost in the handoff.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Assign tasks to service team member | Task on Contact/Company | "Onboard customer", assigned to service rep |
| 2 | Service rep reviews contact and opportunity notes | Contact, Opportunity | All existing notes are visible |
| 3 | Service rep adds their own notes | Note on Contact | Onboarding progress, configuration details |

**What the dashboard shows:** Tasks assigned to each team member. Overdue onboarding tasks.

**MVP coverage:** Full. The shared notes and tasks on contacts/opportunities provide the context transfer that currently requires manual Slack/email handoffs.

---

## Part 2: Service Workflows

### Workflow V1: Issue Intake

**Real-world trigger:** Existing customer reports a problem via email, phone, or chat.

**Current SME practice:** Service rep reads the email, maybe adds a row to a "tickets" spreadsheet or creates a sticky note. Often the issue lives only in the email thread.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Find the contact | Contact | Search by name, email, or company |
| 2 | Review context | Contact + Notes | See previous interactions, current opportunities, recent activity |
| 3 | Create a task for the issue | Task on Contact | Title describing the issue, description with details, due date based on severity |
| 4 | Log initial note | Note on Contact | What the customer reported, any troubleshooting attempted |

**What the dashboard shows:** Open tasks by assignee. Overdue tasks.

**MVP note:** The MVP uses tasks for service issues rather than a dedicated ticket entity. For SME teams handling 5-20 service requests per week, this is sufficient. Teams handling 50+ requests per week need a dedicated ticketing system (V2 or external tool).

**MVP coverage:** Adequate for low-to-medium volume. Tasks serve as lightweight tickets.

---

### Workflow V2: Assignment and Triage

**Real-world trigger:** A service issue needs to be routed to the right person based on skill, availability, or account ownership.

**Current SME practice:** Manager reads the email/Slack and @-mentions the right person. Or the first person who sees it handles it.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Review unassigned tasks | Dashboard/Task list | Filter: tasks with no assignee or assigned to a queue/intake user |
| 2 | Assign to team member | Task | Update assignee field |
| 3 | Add triage note | Note on Contact or Task | Priority assessment, any relevant context |

**What the dashboard shows:** Unassigned tasks count. Tasks per assignee.

**MVP coverage:** Basic. The MVP does not include priority fields on tasks (use notes for priority), SLA tracking, or automatic routing. For a 3-10 person service team, manual assignment via the task list is workable.

---

### Workflow V3: Resolution

**Real-world trigger:** Assigned team member works on the issue and resolves it.

**Current SME practice:** Rep fixes the issue, replies to the customer email, and maybe updates the spreadsheet. Often no internal record of what was done.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Work on the issue | (External -- the actual work happens outside the CRM) | |
| 2 | Log resolution notes | Note on Contact | What was done, root cause, any workarounds |
| 3 | Mark task complete | Task | Status: completed |
| 4 | Create follow-up task if needed | Task on Contact | "Check in after fix" with due date (3-7 days) |

**What the dashboard shows:** Tasks completed this week. Average tasks completed per team member.

**MVP coverage:** Full.

---

### Workflow V4: Follow-Up and Account Health

**Real-world trigger:** After resolving an issue, the team wants to ensure the customer is satisfied and identify any upsell opportunities.

**Current SME practice:** Rarely happens systematically. Depends on individual rep initiative.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Follow-up task triggers | Task on Contact | "Customer health check" due date arrives |
| 2 | Review full contact history | Contact + Notes | All sales and service notes in one timeline |
| 3 | Log follow-up | Note on Contact | Customer sentiment, additional needs identified |
| 4 | Create opportunity (if upsell identified) | Opportunity | New opportunity linked to existing contact/company |

**What the dashboard shows:** Upcoming follow-up tasks. New opportunities created from existing accounts.

**MVP coverage:** Full. This workflow demonstrates the value of combining sales and service data in one system.

---

## Part 3: Cross-Cutting Workflows

### Workflow X1: Pipeline Review Meeting

**Real-world trigger:** Weekly or biweekly team meeting to review active deals.

**Current SME practice:** Manager pulls up the spreadsheet. Each rep gives a verbal update. Manager updates the spreadsheet live. Takes 30-60 minutes.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Open dashboard | Dashboard | Pipeline summary by stage, total values, stale opportunities |
| 2 | Review stale opportunities | Opportunity list | Filter: no activity in 14+ days |
| 3 | Drill into specific deals | Opportunity detail | Notes, tasks, stage history |
| 4 | Update stages and add notes in real-time | Opportunity | Stage changes, new notes during the meeting |
| 5 | Create action items | Task | New tasks assigned to reps with due dates |

**Impact:** Meeting time reduced from 30-60 minutes to 15-20 minutes because the data is already current. Manager can prepare by reviewing the dashboard before the meeting.

**MVP coverage:** Full. This is a primary value driver for management.

---

### Workflow X2: New Team Member Onboarding

**Real-world trigger:** A new sales or service rep joins the team and needs to get up to speed on existing accounts.

**Current SME practice:** Shadowing senior reps for 1-2 weeks. Reading old email threads. Asking "who is this customer?" repeatedly.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | Create user account | Auth | New user with appropriate role |
| 2 | New rep browses contacts and companies | Contact, Company | Full history of notes, tasks, opportunities visible |
| 3 | Reassign tasks/opportunities | Task, Opportunity | Transfer ownership from departing rep or redistribute |
| 4 | New rep starts adding their own notes | Note | Continuity of record |

**Impact:** Ramp-up time reduced from weeks to days. No customer context is lost when reps leave.

**MVP coverage:** Full.

---

### Workflow X3: Account Review

**Real-world trigger:** Quarterly or annual review of a key account's health, activity, and revenue.

**Current SME practice:** Manager asks the account rep to "put together a summary." Rep spends 1-2 hours gathering data from email, spreadsheets, and memory.

**CRM workflow:**

| Step | Action | Entity | Fields |
|---|---|---|---|
| 1 | View company detail | Company | All linked contacts, opportunities, notes, tasks |
| 2 | Review opportunity history | Opportunity list for company | Won, lost, and active opportunities with values |
| 3 | Review service history | Notes and tasks on company/contacts | Issues raised, resolution times, satisfaction signals |
| 4 | Identify next actions | Task | New tasks for renewal, upsell, or relationship maintenance |

**Impact:** Account review prep time reduced from 1-2 hours to 10-15 minutes.

**MVP coverage:** Full. The company entity serves as the aggregation point for account-level views.

---

## Entity-Workflow Mapping Summary

| Entity | Sales Workflows | Service Workflows | Cross-Cutting |
|---|---|---|---|
| **Contact** | S1 (capture), S2 (qualify), S3 (proposal contacts) | V1 (find customer), V3 (resolution notes) | X2 (browse accounts) |
| **Company** | S2 (link to opportunity), S5 (handoff context) | V1 (customer context) | X3 (account review) |
| **Opportunity** | S2 (create), S3 (proposal), S4 (negotiate/close) | V4 (upsell from service) | X1 (pipeline review) |
| **Pipeline Stage** | S2-S4 (stage progression) | -- | X1 (pipeline summary) |
| **Task** | S1 (follow-up), S3 (proposal follow-up), S4 (onboarding) | V1 (issue), V2 (assign), V3 (resolve), V4 (follow-up) | X1 (action items), X2 (reassign) |
| **Note** | S1 (initial context), S2 (qualification), S3 (proposal details), S4 (negotiation) | V1 (issue details), V3 (resolution), V4 (health check) | X2 (history), X3 (review) |
| **Dashboard** | Pipeline value, conversion, stale deals | Open tasks, overdue tasks, completed tasks | Pipeline review meeting, team workload |
| **Auth** | -- | -- | X2 (new user), role-based access |

## Workflow Coverage Assessment

| Workflow | MVP Coverage | Gaps | Gap Severity |
|---|---|---|---|
| S1: Lead Capture | Full | No web form or email-to-contact automation | Low (manual creation is acceptable at SME volume) |
| S2: Qualification | Full | No lead scoring | Low (reps qualify manually) |
| S3: Proposal | Full | No document generation or email tracking | Medium (reps use external tools for proposals) |
| S4: Negotiation/Close | Full | No e-signature or contract management | Low (external tools) |
| S5: Post-Sale Handoff | Full | No automated handoff workflow | Low (task assignment is sufficient) |
| V1: Issue Intake | Adequate | No dedicated ticket entity, no email-to-task | Medium (works for low volume, breaks at 50+ issues/week) |
| V2: Triage | Basic | No priority field, no auto-routing, no SLA | Medium (manual assignment works for small teams) |
| V3: Resolution | Full | No time tracking | Low |
| V4: Follow-Up | Full | No automated reminders (just due dates) | Low |
| X1: Pipeline Review | Full | No forecasting | Low (visibility is the primary value) |
| X2: Onboarding | Full | No role-based access control beyond auth | Medium (V2) |
| X3: Account Review | Full | No revenue reporting or trend charts | Low (basic dashboard is sufficient) |

## Key Insight

Every core workflow is either fully covered or adequately covered by the MVP entity model. The gaps (email integration, document generation, advanced ticketing, automation) are real but represent V2 priorities rather than MVP blockers. The most important value propositions -- shared customer context, pipeline visibility, and task tracking -- are fully addressed by contacts, companies, opportunities, pipeline stages, tasks, notes, and the dashboard.
