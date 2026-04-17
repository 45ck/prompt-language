# Workflow patterns

This document captures common SME sales and service workflows that the bounded CRM MVP should support directly. Each pattern is expressed only in terms of auth, contacts, companies, opportunities, pipeline stages, tasks, notes, and dashboard.

## Pattern 1: inbound enquiry to tracked opportunity

Typical triggers:

- Website form
- Referral
- Phone call
- Walk-in or direct outreach response

Observed workflow:

1. Search for an existing company and contact before creating anything new.
2. Create the company if it does not exist.
3. Create or update the contact and link it to the company.
4. Create an opportunity with an initial stage.
5. Add a note capturing the immediate context.
6. Create the next follow-up task with an owner and due date.

Why this matters:

- This is the most common first-use path for a small-team CRM.
- It combines record creation, context capture, and action capture in one short flow.

MVP implication:

- Opportunity creation should not make it hard to add both context (notes) and next action (tasks) immediately.

## Pattern 2: multi-touch deal progression

Typical reality:

- Deals move through a few simple checkpoints rather than a complex sales methodology.
- Each checkpoint usually produces another commitment: call back, send proposal, confirm decision, chase approval.

Observed workflow:

1. Open the opportunity.
2. Update the current stage.
3. Add a note about what changed.
4. Complete, reschedule, or create the next task.

Common failure mode:

- Teams update the stage but do not log the next step.

MVP implication:

- The product should keep stage updates and task management within the same workflow (without requiring automation).

## Pattern 3: account follow-up after sale or during service delivery

Typical reality:

- In SMEs, the same CRM often supports lightweight post-sale coordination even without a dedicated help desk.
- Work is usually framed as "something we owe this customer" rather than a formal ticket.

Observed workflow:

1. Find the company and relevant contact.
2. Add a note describing the request, issue, or promised action.
3. Create one or more tasks for the responsible people.
4. Review open and overdue tasks until the work is complete.

Why this matters:

- The MVP does not need full ticketing to support real service coordination.
- Tasks and notes linked to company context are often enough for small teams.

MVP implication:

- Tasks and notes must be usable outside pure sales-opportunity workflows.

## Pattern 4: weekly manager pipeline review

Typical reality:

- Owner-operators and small sales managers run a short weekly review rather than daily forecasting ceremonies.
- The questions are operational and immediate, not highly analytical.

Observed workflow:

1. Open the dashboard.
2. Review opportunity counts by stage.
3. Review overdue tasks and tasks due today.
4. Inspect recently updated opportunities.
5. Open opportunities as needed to confirm the latest notes and next-step tasks.
6. Reassign or create tasks where needed.

Questions the dashboard must answer:

- What is currently in play?
- What is stuck?
- What is overdue?
- Who needs to act next?

MVP implication:

- The dashboard should prioritize actionable review over advanced reporting.

## Pattern 5: handoff between teammates

Typical triggers:

- Leave or absence
- Account reassignment
- Shared ownership on a deal
- A manager stepping in to unblock progress

Observed workflow:

1. Open the company or opportunity.
2. Read the latest notes to understand context.
3. Check the current stage.
4. Review open tasks and ownership.
5. Continue the next action without reconstructing history from inboxes.

Why this matters:

- Continuity is one of the first tangible benefits a CRM provides to a small team.

MVP implication:

- Notes must be easy to browse in reverse chronological order and tasks must show clear ownership.

## Pattern 6: dashboard-driven daily execution

Typical reality:

- Individual users start the day by asking what needs action now.
- They do not need a complex home page; they need a usable work queue.

Observed workflow:

1. Sign in.
2. Review tasks due today and overdue.
3. Open the linked company or opportunity from the task.
4. Add a note after the interaction.
5. Mark the task done or create the next one.

MVP implication:

- The dashboard is not only for managers. It should also help reps and coordinators work their day.

## Cross-pattern design principle

The consistent workflow pattern across SME CRM use is:

- record the customer
- record the current commercial state
- record the next action
- preserve just enough context for the next person or next day

The MVP should stay centered on that loop.
