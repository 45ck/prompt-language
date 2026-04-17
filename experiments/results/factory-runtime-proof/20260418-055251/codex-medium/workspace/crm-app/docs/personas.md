# Personas: Bounded CRM MVP

These personas are working assumptions derived from the SME CRM problem space in this repo. They are intentionally limited to the MVP scope and must not be used to justify non-goal features.

## Persona 1: Owner-manager
### Summary
Runs a small sales or service team and needs a reliable weekly view of current pipeline and overdue follow-ups.

### Goals
- See current pipeline without asking people for updates.
- Identify overdue work quickly.
- Keep the team using one shared system of record.

### Typical tasks
- Review dashboard.
- Check which opportunities are active by stage.
- Reassign or follow up on overdue tasks.

### Pain points
- Pipeline updates happen late or inconsistently.
- Follow-ups live in personal inboxes or notebooks.
- Team context disappears when someone is unavailable.

### Evidence vs assumption
- Evidence: the problem-space and workflow research both emphasize stale pipeline visibility and dropped follow-ups.
- Assumption: this user does not need advanced forecasting in MVP; simple counts and overdue visibility are sufficient.

## Persona 2: Account owner
### Summary
Manages multiple active customer conversations and needs fast record updates with minimal admin overhead.

### Goals
- Log a new company, contact, or opportunity quickly.
- Keep a clear next action on each active opportunity.
- Preserve context in notes so work can resume later.

### Typical tasks
- Search before creating a record.
- Create or update an opportunity.
- Add a note.
- Create a next-step task with a due date.

### Pain points
- Context is scattered across tools.
- Follow-ups are easy to forget when work is busy.
- Data entry friction causes records to go stale.

### Evidence vs assumption
- Evidence: research notes highlight fragmented knowledge and task follow-through problems.
- Assumption: the user prefers simple forms and a small required field set over rich CRM customization.

## Persona 3: Delivery coordinator
### Summary
Tracks customer commitments after a deal or request is active and needs clarity on ownership and due dates without using a ticketing system.

### Goals
- Make sure promised work is visible and assigned.
- See overdue items before they become escalations.
- Add concise context for handoffs.

### Typical tasks
- Create tasks linked to a company or opportunity.
- Update task status.
- Add notes about customer requests or internal handoff context.

### Pain points
- Requests disappear into chat or email.
- It is hard to know who owns the next action.
- Overdue work is discovered too late.

### Evidence vs assumption
- Evidence: workflow research explicitly calls out follow-up execution and handoff continuity.
- Assumption: this persona can operate inside the same bounded objects as sales users (company, opportunity, tasks, notes) and does not need a separate ticketing model in MVP.

## Persona exclusions
The following are deliberately excluded from persona-driven scope:

- Marketing teams needing campaigns or lead scoring
- Finance teams needing quoting or invoicing
- Support teams needing ticket queues or SLAs
- Field teams needing mobile-first workflows
