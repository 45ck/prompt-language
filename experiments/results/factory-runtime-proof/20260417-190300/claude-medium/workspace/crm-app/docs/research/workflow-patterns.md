# Workflow Patterns

## Overview

This document describes the real daily workflows of SME sales and service teams that the CRM MVP must support. Each pattern maps to specific MVP features and explains why the workflow matters.

## Pattern 1: Morning Pipeline Review

**Who:** Sales rep (Sarah), Sales manager (Marcus)

**Trigger:** Start of business day.

**Steps:**
1. Open the CRM dashboard.
2. Scan upcoming tasks due today and this week.
3. Review pipeline Kanban for deals requiring action (e.g., proposal follow-up, negotiation check-in).
4. Click into specific opportunities to review recent notes and decide next action.
5. Create follow-up tasks for any deals that need outreach today.

**MVP features used:** Dashboard (upcoming tasks, pipeline summary), Pipeline Kanban, Opportunity detail, Notes (read), Tasks (create).

**What breaks without the CRM:** Reps reconstruct their priority list from memory, email search, and personal notes. Managers have no way to do this review across the team without asking each rep individually.

**Frequency:** Daily, 5-10 minutes.

## Pattern 2: Post-Call Logging

**Who:** Sales rep (Sarah), Service agent (Priya)

**Trigger:** After a phone call, video meeting, or email exchange with a prospect or client.

**Steps:**
1. Search for the contact by name or email.
2. Open the contact detail page.
3. Add a note summarizing the interaction: what was discussed, what was promised, next steps.
4. If a follow-up is needed, create a task linked to the contact with a due date.
5. If a deal stage changed, navigate to the opportunity and drag it to the new stage.

**MVP features used:** Contact search, Contact detail, Notes (create), Tasks (create, link to contact), Pipeline Kanban (drag-and-drop).

**What breaks without the CRM:** Notes go into a personal app or nowhere. Follow-up tasks live in the rep's head. Stage changes are not communicated to the manager.

**Frequency:** 3-8 times per day per rep, depending on call volume.

**Critical path:** This is the highest-frequency workflow. If it takes more than 60 seconds, reps will skip it. Search must be fast, note creation must be inline (not a separate page), and task creation should be 2-3 clicks.

## Pattern 3: Deal Progression

**Who:** Sales rep (Sarah)

**Trigger:** A prospect moves from one sales stage to the next (e.g., from Qualified to Proposal).

**Steps:**
1. Open the pipeline Kanban board.
2. Find the opportunity card in the current stage column.
3. Drag the card to the new stage column.
4. Optionally, open the opportunity to update the expected close date or deal value.
5. Add a note explaining why the stage changed (e.g., "Proposal sent via email, follow up Thursday").

**MVP features used:** Pipeline Kanban (drag-and-drop), Opportunity edit, Notes (create on opportunity).

**What breaks without the CRM:** Stage changes are tracked in a spreadsheet column that other team members may not check. The manager discovers the change days later during a 1:1.

**Frequency:** 2-5 times per week per rep.

## Pattern 4: Weekly Pipeline Review (Manager)

**Who:** Sales manager (Marcus)

**Trigger:** Weekly team meeting or 1:1 with reps.

**Steps:**
1. Open the dashboard to review pipeline summary (count and total value per stage).
2. Identify stages with unusually high deal counts (bottlenecks).
3. Filter opportunities by stage to see specific deals.
4. Filter by owner to prepare for 1:1 conversations.
5. Open individual opportunities to read recent notes and assess deal health.
6. Check win/loss counts for the current month.

**MVP features used:** Dashboard (pipeline summary, win/loss counts), Opportunity list (filter by stage, filter by owner), Opportunity detail, Notes (read).

**What breaks without the CRM:** Manager spends 30-60 minutes before the meeting merging spreadsheets and asking reps for updates. The resulting picture is already stale by the time the meeting starts.

**Frequency:** Weekly, 15-30 minutes.

## Pattern 5: Client Lookup Before a Call

**Who:** Service agent (Priya), Sales rep (Sarah)

**Trigger:** Incoming call or scheduled meeting with a client.

**Steps:**
1. Search for the contact by name, email, or company.
2. Open the contact detail page.
3. Read recent notes to recall the last interaction and any open commitments.
4. Check linked opportunities to understand the business relationship.
5. Review open tasks linked to this contact.

**MVP features used:** Contact search, Contact detail (linked company, opportunities, tasks, notes).

**What breaks without the CRM:** The rep or agent goes into the call without context. They ask the client to repeat information, which damages trust and wastes time.

**Frequency:** 3-10 times per day per service agent; 2-5 times per day per sales rep.

**Critical path:** Search-to-context must take under 10 seconds. The contact detail page must show notes, tasks, and opportunities without additional navigation.

## Pattern 6: New Lead Entry

**Who:** Sales rep (Sarah)

**Trigger:** A new prospect is identified (inbound inquiry, referral, event contact).

**Steps:**
1. Check if the contact already exists (search by email).
2. If not, create a new contact with name, email, phone.
3. Check if the company exists. If not, create the company with name, domain, industry.
4. Link the contact to the company.
5. Create an opportunity in the Lead stage, linked to the contact and company.
6. Set the opportunity value (estimated) and expected close date.
7. Create an initial follow-up task (e.g., "Send intro email by tomorrow").

**MVP features used:** Contact search, Contact create, Company search, Company create, Opportunity create, Tasks (create, link to opportunity).

**What breaks without the CRM:** The lead goes into a spreadsheet row with incomplete information. No follow-up task is created. The manager does not know the lead exists until the next pipeline review.

**Frequency:** 1-5 times per week per rep, depending on lead volume.

**Critical path:** The full flow (search, create contact, create company, create opportunity, create task) must take under 3 minutes. Any friction here means reps will defer entry and eventually forget.

## Pattern 7: Task Triage

**Who:** Service agent (Priya), Sales rep (Sarah)

**Trigger:** Start of day or after completing a batch of tasks.

**Steps:**
1. View tasks filtered to "my tasks" and "open" status.
2. Sort or scan by due date to identify overdue and due-today items.
3. Work through tasks in priority order.
4. Mark each task complete after action is taken.
5. Create new follow-up tasks as needed.

**MVP features used:** Task list (filter by assignee, filter by status), Task update (mark complete), Task create.

**What breaks without the CRM:** Tasks live in personal to-do apps. Managers cannot see which tasks are overdue across the team. Colleagues covering for someone cannot see their open tasks.

**Frequency:** 1-3 times per day.

## Pattern 8: Account Handoff

**Who:** Service agent (Priya), Sales rep (Sarah), Manager (Marcus)

**Trigger:** A rep goes on vacation, leaves the company, or an account is reassigned.

**Steps:**
1. Manager reassigns open opportunities to another rep (edit opportunity owner).
2. Manager reassigns open tasks to the covering rep (edit task assignee).
3. Covering rep reviews the contact and company detail pages to understand account context.
4. Covering rep reads recent notes to catch up on interaction history.

**MVP features used:** Opportunity edit (change owner), Task edit (change assignee), Contact detail (notes, tasks, opportunities), Company detail (linked contacts).

**What breaks without the CRM:** The covering rep has no access to the previous rep's notes, email history, or task list. They start from scratch, and clients feel the discontinuity.

**Frequency:** Occasional (vacations, turnover), but high-impact when it happens.

## Pattern Summary

| Pattern | Frequency | Time Budget | Primary MVP Feature |
|---|---|---|---|
| Morning pipeline review | Daily | 5-10 min | Dashboard, Pipeline Kanban |
| Post-call logging | 3-8x/day | < 60 sec each | Contact search, Notes, Tasks |
| Deal progression | 2-5x/week | < 30 sec each | Pipeline drag-and-drop |
| Weekly pipeline review | Weekly | 15-30 min | Dashboard, Opportunity filters |
| Client lookup | 3-10x/day | < 10 sec each | Contact search, detail page |
| New lead entry | 1-5x/week | < 3 min each | Contact/Company/Opportunity create |
| Task triage | 1-3x/day | 5-10 min | Task list, filters |
| Account handoff | Occasional | 30-60 min | Opportunity/Task reassignment, Notes |

## Design Implications

1. **Search is the most-used feature.** It must be fast (< 500ms), prominent (always accessible), and forgiving (partial matches, case-insensitive).
2. **Note creation is the highest-frequency write operation.** It must be inline on the record page, not a separate form or modal.
3. **The pipeline Kanban is the primary value signal.** If the board is slow or awkward, the CRM feels broken even if everything else works.
4. **Task filtering by assignee is essential for both reps and managers.** Reps need "my tasks"; managers need "all tasks" and "tasks by rep."
5. **The contact detail page is the hub.** It must show linked company, opportunities, tasks, and notes in a single view without additional page loads.
