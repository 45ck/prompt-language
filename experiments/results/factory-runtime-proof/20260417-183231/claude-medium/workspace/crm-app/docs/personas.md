# Personas

## 1. Sarah Chen -- Sales Representative

**Role:** Inside Sales Rep
**Age:** 28 | **Tech Comfort:** High
**Team Size Context:** Works on a 12-person sales team at a SaaS company with 80 employees.

### Goals

- Close deals efficiently without losing track of follow-ups.
- Spend time selling, not doing data entry.
- See at a glance which deals need attention this week.
- Keep notes on every prospect interaction so nothing falls through the cracks.

### Frustrations

- Currently tracks deals in a shared Google Sheet that frequently has merge conflicts.
- Forgets follow-ups because reminders live in her personal calendar, not linked to deals.
- Wastes 20 minutes daily searching emails and Slack to reconstruct conversation history with prospects.
- Has no quick way to see how her pipeline total compares to quota.

### Daily Workflow

1. Morning: Check which tasks are due today and which deals are closest to close.
2. Mid-morning: Make calls, update deal stages and values after conversations.
3. Afternoon: Add notes from meetings, create follow-up tasks.
4. End of day: Quick scan of pipeline board to prioritize tomorrow.

### What She Needs from the CRM

- Fast contact and deal creation (fewer than 30 seconds).
- A Kanban board showing her personal pipeline at a glance.
- Task list filtered to "my tasks, due today/this week."
- Easy note-taking on any contact or deal from the detail page.
- Search that finds contacts by name or email instantly.

---

## 2. David Park -- Sales Manager

**Role:** VP of Sales / Sales Team Lead
**Age:** 42 | **Tech Comfort:** Medium
**Team Size Context:** Manages 3 sales teams totaling 15 reps.

### Goals

- Understand team pipeline health without asking each rep for updates.
- Identify stalled deals and coach reps on how to move them forward.
- Forecast revenue by looking at stage distribution and expected close dates.
- Ensure every prospect has an owner and a next action.

### Frustrations

- Spends Friday afternoons manually compiling pipeline data from individual spreadsheets.
- Has no visibility into whether reps are following up on time.
- Cannot tell which reps are overloaded and which have bandwidth.
- When a rep leaves, their deal context (notes, history) is scattered across personal tools.

### Daily Workflow

1. Morning: Check the dashboard for team-wide pipeline summary.
2. Review recently modified deals to spot movement (or lack of it).
3. Spot-check tasks: are overdue tasks accumulating for any rep?
4. Weekly: Walk the Kanban board in team meeting, filter by rep.

### What He Needs from the CRM

- A dashboard showing pipeline value by stage, aggregated across all reps.
- Ability to filter contacts, deals, and tasks by owner/rep.
- Visibility into task completion rates and overdue items.
- Confidence that when a rep leaves, all their notes and deal history remain in the system.
- Simple enough that adoption is not a battle -- reps must actually use it.

---

## 3. Maria Gonzalez -- Service / Support Agent

**Role:** Customer Service Agent
**Age:** 34 | **Tech Comfort:** Medium-High
**Team Size Context:** Part of a 6-person service team supporting existing customers.

### Goals

- Quickly look up a customer's company and contact info when they call or email.
- Log every interaction so the next agent has full context.
- Track follow-up tasks (callbacks, escalations) with due dates.
- Know which deals are associated with a customer's company so she can route upsell hints to sales.

### Frustrations

- Customers repeat their issue to every agent because there is no shared note history.
- She tracks her callbacks in a personal to-do app, disconnected from customer records.
- Has to ask sales reps for deal context when a customer mentions their contract renewal.
- No single place to see "everything about this company."

### Daily Workflow

1. Receive inbound call/email -- search contact by name or company.
2. Review recent notes on the contact for prior interaction context.
3. Resolve or escalate -- add a note summarizing the interaction.
4. If follow-up required, create a task linked to the contact with a due date.
5. End of day: check "my tasks" for anything due tomorrow.

### What She Needs from the CRM

- Fast search by contact name, email, or company name.
- A company detail page showing all linked contacts, opportunities, and notes.
- One-click note creation from any entity page.
- Tasks linked to contacts with clear due dates and status.
- Read access to opportunity data (she does not manage deals herself).

---

## 4. James Okafor -- System Administrator

**Role:** IT Admin / Office Manager (wears multiple hats)
**Age:** 38 | **Tech Comfort:** High
**Team Size Context:** Sole IT person for a 50-employee company.

### Goals

- Set up the CRM quickly and keep it running with minimal maintenance.
- Control who has access and what they can do (roles).
- Configure the sales pipeline stages to match the company's process.
- Onboard new hires and offboard departures without data loss.

### Frustrations

- Previous tools required expensive consultants to configure.
- User management in spreadsheet-based systems is nonexistent.
- Has been burned by tools where deleting a user also deleted their data.
- Needs something that runs on the existing Docker infrastructure.

### Daily Workflow (CRM-specific)

1. Occasional: Invite new users, set their roles.
2. Occasional: Deactivate departed employees (preserve their data).
3. Rare: Add or reorder pipeline stages when the sales process changes.
4. Rare: Delete inappropriate notes if flagged.

### What He Needs from the CRM

- User management panel: invite, deactivate, role assignment.
- Pipeline stage configuration: add, rename, reorder, archive.
- Docker Compose deployment that "just works."
- Clear role separation (Admin, Manager, Rep) with sensible defaults.
- Data is never lost when a user is deactivated.

---

## Persona-to-Feature Mapping

| Feature Area      | Sarah (Rep) | David (Mgr) | Maria (Service) | James (Admin) |
| ----------------- | :---------: | :----------: | :--------------: | :-----------: |
| Auth / Login      | Uses        | Uses         | Uses             | Configures    |
| Contacts          | Creates     | Views        | Searches         | --            |
| Companies         | Creates     | Views        | Searches         | --            |
| Opportunities     | Manages     | Monitors     | Views            | --            |
| Pipeline Stages   | Views       | Views        | Views            | Configures    |
| Tasks             | Creates     | Monitors     | Creates          | --            |
| Notes             | Creates     | Reads        | Creates          | Deletes       |
| Dashboard         | Personal    | Team-wide    | Personal         | --            |
| User Management   | --          | --           | --               | Full control  |
