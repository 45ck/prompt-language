# Workflow patterns (SME sales + service teams)

This document describes common, bounded patterns that the MVP CRM must support using only: contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard, and authentication.

## Pattern 1: Lead/Inquiry to active work item
**Trigger:** inbound inquiry, referral, or repeat customer request.
**Flow:**
1. Create or find **company** and **contact**.
2. Create an **opportunity** to represent the deal/job.
3. Set initial **pipeline stage** (e.g., “New”).
4. Add a **note** capturing the context (what was requested, constraints).
5. Add a **task** for the next action (call back, schedule visit, send info).

## Pattern 2: Follow-up loop (the core habit)
**Trigger:** any interaction that should produce a next step.
**Flow:**
1. Add a **note** (what happened, decisions, commitments).
2. Create/update a **task** (next action + due date).
3. Optionally move the **opportunity stage** if status changed.
4. Dashboard highlights **overdue tasks** and **recently updated opportunities**.

## Pattern 3: Sales pipeline progression (simple stages)
**Trigger:** progress through known steps (qualification -> proposal -> close).
**Flow:**
1. Move **opportunity** through **pipeline stages** as it advances.
2. Keep a short **note** trail tied to key interactions.
3. Use **tasks** to ensure proposals, follow-ups, and next steps are not missed.

## Pattern 4: Service work progression (status-as-stages)
**Trigger:** work is being delivered to an existing customer (job/service request).
**Flow:**
1. Represent the job as an **opportunity**.
2. Use **pipeline stages** as statuses (e.g., “Scheduled”, “In progress”, “Completed”).
3. Use **tasks** for follow-ups (confirm appointment, gather info, close-out).
4. Use **notes** as service history (what was done, outcomes).

## Pattern 5: Owner/manager daily review (dashboard-driven)
**Trigger:** start-of-day or end-of-week review.
**Flow:**
1. Open **dashboard**.
2. Review:
   - Overdue tasks (team or per user)
   - Opportunities by stage
   - Recently updated vs stalled opportunities
3. Assign/adjust next actions by creating or reassigning **tasks** and updating **stages**.

## What the MVP should not assume
- A single universal pipeline model across all teams.
- Automated communication or integrations.
- Complex forecasting or scoring.

