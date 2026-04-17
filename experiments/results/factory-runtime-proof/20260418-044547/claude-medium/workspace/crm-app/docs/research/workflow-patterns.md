# Workflow Patterns

## Overview

Common SME sales and service workflows that the CRM MVP must support. Each pattern describes the real-world trigger, the steps involved, and how the MVP's entities (contacts, companies, opportunities, pipeline stages, tasks, notes) map to each step.

---

## Pattern 1: Lead Capture to Qualification

### Trigger

A new potential customer is identified: inbound inquiry, referral, networking event, or cold outreach response.

### Steps

1. **Create contact** with name, email, phone, and source (e.g., "referral from John," "website inquiry").
2. **Associate with company** if known. If the company does not exist, create it with basic info (name, website, industry).
3. **Add initial note** capturing context: how they found us, what they expressed interest in, any timeline mentioned.
4. **Create qualification task** assigned to the responsible rep with a due date of 1-2 business days: "Research company and confirm fit."
5. **Rep researches** the contact/company. Updates notes with findings.
6. **Qualification decision**: if qualified, create an opportunity and move to Pattern 2. If not qualified, add a note with the reason and mark the task complete.

### MVP Entity Mapping

| Step | Entity | Action |
|---|---|---|
| Create contact | Contact | CREATE with name, email, phone |
| Associate company | Company, Contact | CREATE Company (if new), UPDATE Contact.companyId |
| Add context | Note | CREATE (linked to Contact) |
| Schedule follow-up | Task | CREATE (linked to Contact, assigned to rep) |
| Record research | Note | CREATE (linked to Contact) |
| Qualify | Opportunity | CREATE (if qualified), linked to Contact and Company |

---

## Pattern 2: Opportunity Through Pipeline

### Trigger

A contact is qualified and an opportunity is created.

### Steps

1. **Create opportunity** with name, estimated value, expected close date, and assign to the first pipeline stage (e.g., "Qualified").
2. **Link to contact and company**. An opportunity always has a primary contact; company is optional but typical.
3. **Schedule next action** as a task: "Send proposal by Friday," "Schedule demo call," etc.
4. **Discovery/demo** stage: rep conducts discovery. Adds notes after each interaction summarizing what was discussed, objections raised, and next steps.
5. **Proposal** stage: rep moves opportunity to "Proposal" stage. Creates task: "Follow up on proposal in 3 days."
6. **Negotiation** stage: pricing discussions, contract review. Notes capture each round of negotiation.
7. **Decision** stage: verbal commitment or rejection.
8. **Close**: move to "Closed Won" or "Closed Lost" with a closing note explaining the outcome.

### Default Pipeline Stages

| Order | Stage Name | Description |
|---|---|---|
| 1 | Lead | Unqualified, just entered the pipeline |
| 2 | Qualified | Confirmed fit, budget, and authority |
| 3 | Proposal | Proposal or quote sent |
| 4 | Negotiation | Active price/terms discussion |
| 5 | Closed Won | Deal signed and won |
| 6 | Closed Lost | Deal lost or abandoned |

### MVP Entity Mapping

| Step | Entity | Action |
|---|---|---|
| Create opportunity | Opportunity | CREATE with stage, value, closeDate |
| Link records | Opportunity | SET contactId, companyId |
| Schedule actions | Task | CREATE (linked to Opportunity) |
| Record interactions | Note | CREATE (linked to Opportunity) |
| Advance stage | Opportunity | UPDATE stageId (drag-and-drop on pipeline board) |
| Close deal | Opportunity | UPDATE stageId to Closed Won/Lost, add closing Note |

---

## Pattern 3: Task Management (Daily Rep Workflow)

### Trigger

Rep starts their workday and needs to know what to do.

### Steps

1. **View task list**: rep sees all tasks assigned to them, sorted by due date. Overdue tasks are highlighted.
2. **Pick highest priority task**: overdue tasks first, then tasks due today.
3. **Execute task**: make the call, send the email, prepare the document.
4. **Record outcome as a note** on the linked contact or opportunity: "Called John, reviewing with team, follow up Thursday."
5. **Mark task complete**.
6. **Create follow-up task** if needed with future due date.
7. **Repeat** until daily tasks are done.
8. **End of day**: review tomorrow's tasks, reprioritize if needed.

### Task Properties

| Property | Description |
|---|---|
| Title | Short description of what needs to be done |
| Due date | When the task should be completed |
| Assigned to | Which team member owns this task |
| Status | Open, In Progress, Completed |
| Priority | Low, Medium, High |
| Linked contact | Optional: which contact this relates to |
| Linked opportunity | Optional: which deal this relates to |

### Task Views

- **My Tasks**: filtered to current user, sorted by due date
- **Team Tasks**: all tasks across the team, filterable by assignee
- **Record Tasks**: tasks shown on a contact, company, or opportunity detail page

---

## Pattern 4: Note-Taking and Context Building

### Trigger

Any interaction with a contact: phone call, email exchange, meeting, or internal discussion about a deal.

### Steps

1. **Navigate to contact or opportunity record**.
2. **Add note** with timestamp (automatic) and author (automatic from logged-in user).
3. **Note content** typically includes:
   - What was discussed
   - Key decisions or commitments made
   - Objections or concerns raised
   - Agreed-upon next steps
   - Personal details shared for relationship building
4. **Note is visible** to all team members on the record, providing a chronological interaction history.

### Note Characteristics

| Characteristic | MVP Implementation |
|---|---|
| Format | Plain text (rich text is post-MVP) |
| Author | Automatically set from logged-in user |
| Timestamp | Automatically set on creation |
| Linked to | Contact, Company, or Opportunity (one required) |
| Visibility | All team members in the same tenant |
| Editing | Author can edit within 24 hours |
| Ordering | Reverse chronological (newest first) |
| Searchable | By content across all records |

---

## Pattern 5: Pipeline Review (Weekly Manager Workflow)

### Trigger

Weekly sales meeting or manager's Monday morning review.

### Steps

1. **View pipeline board**: visual Kanban-style board showing all open opportunities grouped by stage.
2. **Identify stale deals**: opportunities that have not moved stages or had notes added in 14+ days.
3. **Review deal values**: check that estimated values are realistic. Update if needed.
4. **Check pipeline coverage**: total pipeline value vs. quota. Identify if more leads are needed.
5. **Review overdue tasks**: which reps have overdue follow-ups? Are any deals at risk due to missed actions?
6. **Assign actions**: create tasks for reps to update stale deals, follow up on overdue items, or re-engage cold opportunities.
7. **Check dashboard**: review win rate, deal velocity, and new contacts this month.

### MVP Entity Mapping

| Step | Entity | Action |
|---|---|---|
| View pipeline | Opportunity, PipelineStage | READ (grouped by stage) |
| Check staleness | Opportunity | READ (filter: updatedAt older than 14 days) |
| Update values | Opportunity | UPDATE value |
| Review tasks | Task | READ (filter: overdue, grouped by assignee) |
| Assign actions | Task | CREATE (assigned to specific reps) |
| View metrics | Dashboard | READ (aggregated queries) |

---

## Pattern 6: Company Account Management

### Trigger

Multiple contacts at the same company, or need to track company-level information.

### Steps

1. **Create company** with name, website, industry, and size estimate.
2. **Link contacts**: associate existing contacts with the company.
3. **View company record**: see all associated contacts, opportunities, and notes.
4. **Add company-level notes**: organizational information (e.g., "fiscal year ends March," "CTO approves IT purchases").
5. **Track all opportunities**: view all deals associated with this company across contacts.

### Company Properties

| Property | Description |
|---|---|
| Name | Company name |
| Website | Company website URL |
| Industry | Industry category (free text in MVP) |
| Size | Employee count range (1-10, 11-50, 51-200, 201-500, 500+) |
| Address | Physical address (optional) |
| Contacts | All contacts linked to this company |
| Opportunities | All opportunities linked via contacts |
| Notes | Company-level notes |

---

## Pattern 7: Opportunity Close (Won or Lost)

### Trigger

The customer makes a final decision.

### Steps (Won)

1. Move opportunity to "Closed Won" on the pipeline board.
2. Add a note with deal details: contract terms, start date, key contacts.
3. Create onboarding or delivery tasks linked to the contact/company.

### Steps (Lost)

1. Move opportunity to "Closed Lost" on the pipeline board.
2. Add a note with the loss reason: price, competitor, timing, no decision, poor fit.
3. Optionally create a future follow-up task (e.g., "Check in next quarter").

### System Behavior

- Closed Won and Closed Lost are terminal pipeline stages.
- Closed opportunities are excluded from the active pipeline board but visible via filters.
- Loss reason is captured as a note (structured loss reason dropdown is post-MVP).
- Dashboard win rate updates automatically.

---

## Workflow Interaction Map

```
Lead Capture (Pattern 1)
    |
    v
Qualification Decision
    |
    +-- Not qualified --> Note added, task closed, END
    |
    +-- Qualified --> Create Opportunity
                        |
                        v
                Pipeline Progression (Pattern 2)
                    |
                    +-- Each stage involves:
                    |       Task Management (Pattern 3)
                    |       Note-Taking (Pattern 4)
                    |
                    +-- Weekly reviewed via:
                    |       Pipeline Review (Pattern 5)
                    |
                    +-- Company context from:
                    |       Account Management (Pattern 6)
                    |
                    v
                Close Won or Lost (Pattern 7)
```

---

## MVP Feature-to-Pattern Coverage

| Feature | P1 Lead | P2 Pipeline | P3 Tasks | P4 Notes | P5 Review | P6 Company | P7 Close |
|---|---|---|---|---|---|---|---|
| Auth | x | x | x | x | x | x | x |
| Contacts | x | x | x | x | | x | |
| Companies | x | | | x | | x | |
| Opportunities | | x | x | x | x | x | x |
| Pipeline Stages | | x | | | x | | x |
| Tasks | x | x | x | | x | | x |
| Notes | x | x | | x | | x | x |
| Dashboard | | | | | x | | |

Every MVP feature is used in at least 2 workflow patterns. No feature is orphaned.
