# Workflow Patterns: SME Sales & Service

## Overview

This document maps common SME sales and service workflows to the CRM entities available in the MVP: contacts, companies, opportunities, pipeline stages, tasks, notes, and dashboard.

## Primary Sales Workflow

### Stage 1: Lead Capture

**What happens:** A potential customer reaches out via phone, email, web form, or referral. A rep records their information.

| Action | CRM Entity | Details |
|---|---|---|
| Record person's name, email, phone | Contact | Create new contact with source field (web, referral, cold call, event) |
| Link to their employer | Company | Create or link to existing company record |
| Add initial context | Note | Attach note to contact: how they found us, what they asked about |
| Schedule first call | Task | Create task with due date, linked to contact |

### Stage 2: Qualification

**What happens:** Rep has a discovery call to determine if the lead is a fit (budget, authority, need, timing).

| Action | CRM Entity | Details |
|---|---|---|
| Log call notes | Note | Attach to contact: budget range, decision-maker, timeline, pain points |
| Update contact details | Contact | Add job title, direct phone, preferred contact method |
| Qualify or disqualify | Decision point | If qualified, create opportunity. If not, mark contact as "not a fit" and archive. |
| Schedule follow-up | Task | Next step task linked to contact |

### Stage 3: Opportunity Creation

**What happens:** A qualified lead becomes a deal with an estimated value and target close date.

| Action | CRM Entity | Details |
|---|---|---|
| Create deal | Opportunity | Name, estimated value, expected close date, linked to contact and company |
| Set initial stage | Pipeline Stage | "Qualification" or "Discovery" (first stage after creation) |
| Record deal context | Note | Attach to opportunity: what they need, competitors mentioned, objections |
| Assign tasks | Task | Proposal prep, demo scheduling, reference check -- each with due dates |

### Stage 4: Pipeline Management

**What happens:** Rep moves the deal through stages as the sales process progresses. Manager reviews pipeline for forecasting.

**Default pipeline stages for MVP:**

```
New Lead --> Qualification --> Proposal --> Negotiation --> Closed Won / Closed Lost
```

| Action | CRM Entity | Details |
|---|---|---|
| Advance stage | Opportunity | Drag deal to next stage on pipeline board |
| Log meeting notes | Note | After each touchpoint, attach note to opportunity |
| Track blockers | Note/Task | "Waiting for legal review" as a note; "Follow up on contract" as a task |
| Review pipeline | Dashboard | Total deals per stage, total value, deals closing this month |

### Stage 5: Close (Won or Lost)

**What happens:** Deal reaches a final outcome.

**Closed Won:**

| Action | CRM Entity | Details |
|---|---|---|
| Move to Closed Won | Opportunity | Update stage; record actual close date and final value |
| Record win reason | Note | Why they chose us: price, features, relationship, timing |
| Create onboarding tasks | Task | Handoff to service team, kickoff meeting, account setup |

**Closed Lost:**

| Action | CRM Entity | Details |
|---|---|---|
| Move to Closed Lost | Opportunity | Update stage; record loss date |
| Record loss reason | Note | Why we lost: price, competitor, timing, no decision |
| Schedule re-engagement | Task | "Check back in 6 months" task linked to contact |

### Stage 6: Post-Sale Service

**What happens:** After closing, the service team manages onboarding, support, and renewal.

| Action | CRM Entity | Details |
|---|---|---|
| Log support interactions | Note | Attach to contact or company: issue described, resolution |
| Track service tasks | Task | Onboarding steps, training sessions, check-in calls |
| Identify upsell | Opportunity | New opportunity linked to same company, enters pipeline |

## Secondary Workflows

### Referral Tracking

1. Existing contact refers a new lead.
2. Create new contact with note: "Referred by [existing contact name]."
3. Link both contacts to relevant companies.
4. Standard qualification flow begins.

### Account Management (Multiple Contacts per Company)

1. Company record serves as the parent entity.
2. Multiple contacts linked to the same company (champion, decision-maker, end user).
3. Opportunities link to company, with a primary contact designated.
4. Notes and tasks can be viewed at the company level to see all activity across contacts.

### Pipeline Review Meeting (Weekly)

1. Manager opens dashboard: deals by stage, total pipeline value, deals closing this week.
2. Filter by rep to review individual pipelines.
3. Identify stalled deals (no stage change or note in 14+ days).
4. Create tasks for reps: "Update status on [deal name]" or "Schedule follow-up with [contact]."

## Entity Relationship Summary

```
Company (1) ---< (many) Contact
Contact (1) ---< (many) Opportunity
Opportunity (1) ---< (many) Note
Opportunity (1) ---< (many) Task
Contact  (1) ---< (many) Note
Contact  (1) ---< (many) Task
Opportunity (1) ---> (1) Pipeline Stage
```

## Workflow-to-Feature Mapping

| Workflow Step | Required MVP Feature |
|---|---|
| Lead capture | Contact creation form, company linking |
| Qualification | Notes on contacts, task creation with due dates |
| Opportunity creation | Opportunity form with value, date, contact/company link |
| Pipeline management | Kanban board with drag-and-drop stage transitions |
| Close tracking | Stage update to Closed Won/Lost, notes for reasons |
| Post-sale service | Tasks and notes on existing contacts and companies |
| Pipeline review | Dashboard with stage counts, values, and overdue task alerts |
