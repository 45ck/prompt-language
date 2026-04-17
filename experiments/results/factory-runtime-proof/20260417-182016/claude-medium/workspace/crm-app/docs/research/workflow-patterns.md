# Workflow Patterns: SME Sales and Service

## Overview

This document maps the concrete workflows that SME sales and service teams execute daily. Each workflow is described as a sequence of steps, mapped to the MVP modules that support it, and annotated with the data entities created or modified at each step. These patterns directly inform the UI layout, navigation flow, and API design.

## Sales Workflows

### Workflow S1: Lead Capture to Qualification

**Trigger:** Inbound inquiry via website form, phone call, referral, or trade show.

**Steps:**

1. **Create contact** with name, email, phone, and source field (web, referral, event). Associate with existing company or create new company record.
2. **Add initial note** describing the inquiry: what the prospect needs, budget signals, timeline mentioned.
3. **Create opportunity** linked to the contact and company. Set stage to "Lead." Enter estimated value if known.
4. **Create qualification task** assigned to the rep: "Call [contact] to qualify by [date]." Due date within 24-48 hours.
5. **Qualify or disqualify.** After the call, move opportunity to "Qualified" or "Closed-Lost" with a note explaining the decision.

**Entities touched:** Contact (create), Company (create/link), Note (create), Opportunity (create, update), Task (create, complete).

**MVP module mapping:** Contacts, Companies, Notes, Opportunities, Pipeline Stages, Tasks.

### Workflow S2: Qualified Opportunity to Proposal

**Trigger:** Opportunity reaches "Qualified" stage.

**Steps:**

1. **Review contact and company details.** Confirm decision-maker, budget, and timeline from notes.
2. **Move opportunity** to "Proposal" stage. Update value if refined during qualification.
3. **Create proposal task** assigned to the rep: "Send proposal to [contact] by [date]."
4. **Add note** with proposal details: line items, pricing, terms discussed.
5. **Complete task** when proposal is sent. Add note confirming delivery method and recipient confirmation.

**Entities touched:** Contact (read), Company (read), Opportunity (update), Task (create, complete), Note (create).

### Workflow S3: Negotiation to Close

**Trigger:** Prospect responds to proposal.

**Steps:**

1. **Move opportunity** to "Negotiation" stage. Add note with prospect feedback.
2. **Create follow-up tasks** for each action item: revised pricing, legal review, reference call scheduling.
3. **Iterate.** Each interaction generates a note. Tasks are created and completed as negotiations progress.
4. **Close.** Move opportunity to "Closed-Won" or "Closed-Lost." Add final note with outcome details (why won, why lost, competitor chosen).
5. **Post-close task** (won): "Send welcome packet to [contact] by [date]." This bridges the sales-to-service handoff.

**Entities touched:** Opportunity (update x multiple), Task (create x multiple, complete), Note (create x multiple).

### Workflow S4: Pipeline Review (Manager)

**Trigger:** Weekly or bi-weekly team meeting.

**Steps:**

1. **Open dashboard.** Review total pipeline value, deal count by stage, and deals closed this period.
2. **Identify stalled deals.** Filter opportunities that have not changed stage in 14+ days.
3. **Review per-rep task completion.** Check overdue tasks grouped by assignee.
4. **Drill into specific opportunities.** Read notes, check stage history, and verify next steps are tasked.
5. **Assign action items.** Create tasks for reps to follow up on stalled deals.

**Entities touched:** Dashboard (read), Opportunity (read, filter), Task (read, create), Note (read).

**MVP module mapping:** Dashboard, Opportunities, Tasks, Notes.

## Service Workflows

### Workflow V1: Ticket Intake to Triage

**Trigger:** Customer contacts the team with a problem via phone, email, or chat.

**Note:** The MVP does not include a dedicated ticketing module. Service workflows are modeled using tasks (as service requests) and notes (as interaction logs) attached to existing contacts.

**Steps:**

1. **Look up contact** by name, email, or phone. If not found, create a new contact record.
2. **Review existing notes** for context: previous issues, open opportunities, recent interactions.
3. **Create a task** representing the service request. Title format: "[Issue type]: [Brief description]." Assign to the appropriate agent. Set priority via due date (urgent = today, normal = 2 business days).
4. **Add note** to the contact with the full issue description, steps to reproduce, and customer impact.

**Entities touched:** Contact (read/create), Note (read, create), Task (create).

### Workflow V2: Investigation and Resolution

**Trigger:** Agent picks up an assigned service task.

**Steps:**

1. **Read task details and associated notes.** Understand the issue and customer context.
2. **Investigate.** Add notes documenting findings at each step. If the issue involves a product or contract, check the associated company and opportunity records.
3. **Resolve.** Add a resolution note describing the fix or answer provided.
4. **Complete the task.** Mark the service task as done.
5. **Create follow-up task** if needed: "Confirm resolution with [contact] in 48 hours."

**Entities touched:** Task (read, complete), Note (create x multiple), Contact (read), Company (read), Opportunity (read).

### Workflow V3: Follow-Up and Closure

**Trigger:** Follow-up task due date arrives.

**Steps:**

1. **Contact the customer.** Confirm the issue is resolved.
2. **Add note** with follow-up outcome: confirmed resolved, new issue identified, or no response.
3. **Complete follow-up task.** If a new issue was identified, create a new service task (back to V1).
4. **Update contact record** if any details changed (new phone, new role, new company).

**Entities touched:** Task (complete), Note (create), Contact (read/update).

## Cross-Functional Workflows

### Workflow X1: Sales-to-Service Handoff

**Trigger:** Opportunity moves to "Closed-Won."

**Steps:**

1. Sales rep adds a **handoff note** to the contact: key agreements, SLA expectations, known issues flagged during sales.
2. Sales rep creates a **task** assigned to the service lead: "Onboard [company] - [contact]."
3. Service lead reads the contact notes, company record, and closed opportunity details.
4. Service lead adds an **onboarding note** and creates service-specific follow-up tasks.

**Key requirement:** Notes and tasks must be visible across roles. The MVP auth model (admin, member) supports this because all members see all records.

### Workflow X2: Service-Informed Upsell

**Trigger:** Service agent identifies expansion opportunity during issue resolution.

**Steps:**

1. Service agent adds a **note** to the contact flagging the upsell signal: "Customer asked about [feature]. Currently on [plan]."
2. Service agent creates a **task** assigned to the sales rep: "Follow up on upsell opportunity for [company]."
3. Sales rep reviews notes, creates a new **opportunity** linked to the existing contact and company, and enters the pipeline at "Lead" or "Qualified."

## Workflow-to-Module Mapping Summary

| Module | S1 | S2 | S3 | S4 | V1 | V2 | V3 | X1 | X2 |
|--------|----|----|----|----|----|----|----|----|-----|
| Auth | x | x | x | x | x | x | x | x | x |
| Contacts | C | R | R | R | C/R | R | R/U | R | R |
| Companies | C/L | R | R | R | - | R | - | R | R |
| Opportunities | C/U | U | U | R | - | R | - | R | C |
| Pipeline Stages | x | x | x | x | - | - | - | - | x |
| Tasks | C/D | C/D | C/D | C/R | C | R/D | D | C | C |
| Notes | C | C | C | R | C | C | C | C | C |
| Dashboard | - | - | - | R | - | - | - | - | - |

**Legend:** C = Create, R = Read, U = Update, D = Complete (done), L = Link, x = required context, - = not involved.

## Design Implications

1. **Contact detail page is the hub.** Every workflow starts or passes through the contact record. The contact detail view must surface associated companies, opportunities, tasks, and notes without navigation.

2. **Notes are append-only chronological.** No workflow edits past notes. The note creation form should be minimal (text area + save) and always visible on contact and opportunity detail views.

3. **Tasks drive daily work.** The "My Tasks" view (today's tasks, overdue, upcoming) is the landing page for reps and agents. Task creation must be fast: title, assignee, due date, linked entity.

4. **Pipeline board is for managers.** Reps interact with opportunities from the contact detail page. Managers interact via the kanban board. Both views must stay synchronized.

5. **Search is critical.** Workflows V1 and X2 start with looking up a contact. Search must cover name, email, phone, and company name. Response time under 200ms.
