# Workflow patterns (SME sales + service, bounded CRM MVP)

This document captures recurring workflow patterns that appear in real SME customer-facing work and that fit inside the bounded CRM MVP scope.

## Pattern 1: start from a company or person, not from a process
SME work usually begins with a name: a company, a contact, or someone calling back. Users often need to answer basic questions quickly:

- Do we already know this person?
- Which company are they part of?
- Is there already an open opportunity?
- What happened last time we spoke?

Implications for the MVP:

- Company and contact search must be fast and obvious.
- Company and contact detail views must show linked notes, tasks, and opportunities.
- Creating a new contact or company should not require unnecessary setup.

## Pattern 2: one account can move between sales and service moments
In SMEs, the same account may move fluidly between prospecting, quoting, onboarding, and follow-up service. Even if the MVP does not model formal service cases, the CRM still needs to preserve continuity across those moments.

Implications for the MVP:

- Company and contact records must remain useful even when there is no active opportunity.
- Notes and tasks must be attachable directly to companies and contacts, not only to opportunities.
- Users must be able to understand the latest state of a customer from the record page alone.

## Pattern 3: opportunities represent active commercial intent
An opportunity is usually created when the team believes there is a meaningful revenue event to track: a new sale, upsell, renewal, or quote in progress. The critical behavior is not advanced forecasting; it is keeping that work visible and current.

Implications for the MVP:

- Opportunities need a required stage and clear linkage to the relevant company.
- Users need an easy way to move an opportunity from one stage to another.
- Opportunity detail should show notes and tasks because those are the evidence behind stage confidence.

## Pattern 4: every meaningful interaction should end in either a note, a task, or both
After a call, meeting, or service check-in, small teams typically need to capture what happened and what happens next. If either piece is missing, continuity suffers.

Implications for the MVP:

- Adding a note must be low friction and timestamped.
- Creating a task must be possible from the same working context as the note.
- Tasks should support due dates and completion so the team can tell what is still outstanding.

## Pattern 5: daily work is managed through triage, not formal process diagrams
Most SMEs do not manage customer work through complex workflows. They review the day by checking what is overdue, what changed, and which deals or accounts need attention.

Implications for the MVP:

- The dashboard should show overdue tasks and upcoming tasks prominently.
- The dashboard should show counts of opportunities by stage.
- The dashboard should show recent activity from note creation, task updates, and stage changes.

## Pattern 6: handoffs depend on shared record context
Coverage gaps happen constantly in small teams: staff are in meetings, on leave, or switching between responsibilities. Another teammate must be able to pick up the thread without reconstructing history from inboxes.

Implications for the MVP:

- Notes need to be visible in reverse chronological order on the relevant record.
- Task status must be visible so the next person knows what is still pending.
- Linked data matters: users should be able to move from company to contact to opportunity without losing context.

## Pattern 7: setup must be light enough for a founder, manager, or team lead to own
SMEs often do not have a CRM administrator. The system has to work with minimal configuration and clear defaults.

Implications for the MVP:

- Authentication and first-use access should be straightforward.
- The pipeline should have a simple default stage model out of the box.
- The value of the product should appear after a small amount of initial data entry, not after extensive customization.

## Summary
The bounded CRM MVP succeeds if it supports a simple operational rhythm:

1. Find or create the right company/contact.
2. Create or update the related opportunity when there is active commercial work.
3. Capture notes and next-step tasks as interactions happen.
4. Review the dashboard to see what needs attention and what changed.

That rhythm is enough to support real SME sales and service coordination without expanding beyond the MVP boundary.
