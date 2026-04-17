# Workflow patterns (SME sales + service within MVP scope)

This document captures real workflow patterns that can be supported using only: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, and dashboard.

## Pattern A — New relationship captured from any channel
**Trigger:** inbound email, referral call, networking event, web inquiry (captured manually).
**Goal:** create a shared record and ensure follow-up is owned.
**Supported by MVP:**
1. Create a **Company** (if known) and **Contact**.
2. Add a **Note** with the source and key context (who, why, next step).
3. Create a **Task** “Follow up” with due date and owner.

## Pattern B — Opportunity creation after initial qualification
**Trigger:** a contact expresses a need that could become revenue.
**Goal:** make work visible in a pipeline with a clear next step.
**Supported by MVP:**
1. Create an **Opportunity** linked to the company/contact.
2. Select initial **Pipeline Stage** (e.g., “Qualified”).
3. Create a **Task** for the next customer action (demo, call, proposal).
4. Add a **Note** for qualification details and constraints.

## Pattern C — Stage progression driven by explicit next action
**Trigger:** a meeting or deliverable changes deal status.
**Goal:** keep pipeline current and prevent “stuck” deals.
**Supported by MVP:**
1. Move the **Opportunity** to the new **Stage**.
2. Add a **Note** with outcome and decision rationale.
3. Ensure there is always at least one open **Task** (or explicitly none needed).

## Pattern D — Handoff between team members
**Trigger:** ownership changes, PTO coverage, or support/sales collaboration.
**Goal:** preserve context so the next person can act immediately.
**Supported by MVP:**
1. Review the **Contact/Company** notes timeline.
2. Review the linked **Opportunity** stage and open tasks.
3. Add a **Note**: “Handoff summary” and create/assign next tasks.

## Pattern E — Light “service follow-up” without ticketing
**Trigger:** customer needs help or onboarding assistance, but no ticketing system in MVP.
**Goal:** track commitments and context using tasks/notes.
**Supported by MVP:**
1. Add a **Note** on the contact/company describing the request and promised outcome.
2. Create a **Task** (or multiple) with due dates and owners.
3. Optionally link to an **Opportunity** if it affects renewal/upsell.

## Pattern F — Daily standup / weekly review using dashboard
**Trigger:** owner/manager wants a quick health check.
**Goal:** focus attention on pipeline and follow-ups.
**Supported by MVP dashboard:**
- What’s due today/overdue (tasks)
- Opportunities by stage (counts)
- Opportunities with no recent activity (requires a simple “last updated” signal)

## Data hygiene conventions (MVP-friendly)
These conventions keep the system usable without adding new modules:
- Every opportunity has: owner, stage, and at least one next-step task (or a note stating no next step).
- Every meaningful interaction produces a short note (2–5 lines).
- Stage changes always have a note explaining “what changed”.
