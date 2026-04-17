# Problem space (SME CRM MVP)

## Target market
Small and medium-sized businesses (SMEs) with a small sales and/or service team (typically 2–25 people) who need a lightweight, shared system of record for relationships, deal progress, and follow-ups.

## The job to be done
Help a team:
- Keep a consistent view of who they’re talking to (contacts) and which organization they belong to (companies).
- Track revenue work-in-progress (opportunities) through a simple pipeline.
- Coordinate follow-ups (tasks) and capture context (notes) so nothing is lost when handoffs happen.
- See a quick snapshot of what matters today (dashboard).

## Current-state reality in SMEs (common patterns)
Within the bounded MVP scope (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard), SMEs commonly run on:
- Spreadsheets for contacts + a separate sheet for deals.
- Email + chat for collaboration, with context scattered across threads.
- Personal to-do apps where follow-ups aren’t visible to the team.
- “Pipeline” defined differently per person, causing inconsistent forecasts and stage updates.

## Core pains (within MVP scope)
1. **Fragmented customer context**
   - Notes and meeting context live in personal documents or chat; others can’t pick up a conversation reliably.
2. **Inconsistent pipeline hygiene**
   - Opportunities exist but are stale (no next step, unclear stage, no owner clarity).
3. **Follow-ups fall through**
   - Tasks aren’t centralized, aren’t linked to the customer/deal, or aren’t visible during handoffs.
4. **Poor visibility for the owner/manager**
   - Hard to answer: “What’s closing this month?”, “What deals are stuck?”, “Who needs follow-up today?”

## MVP boundaries (explicit)
This discovery pack and downstream build assume the CRM MVP is limited to:
- Authentication and basic account access (no SSO requirement in MVP).
- Contacts and companies as the primary customer records.
- Opportunities with configurable pipeline stages.
- Tasks and notes linked to contacts, companies, and/or opportunities.
- Dashboard summaries of pipeline and activity.

Out of scope for the MVP:
- Marketing automation, campaigns, lead scoring.
- Email/calendar sync, calling, SMS, and inbox integration.
- Ticketing/helpdesk, SLAs, knowledge base.
- Quotes, invoicing, subscriptions, inventory, CPQ.
- Complex forecasting, territory management, multi-currency, advanced permissions, audit/compliance suites.

## Why a new bounded CRM (problem framing)
Many CRMs become heavy quickly. SMEs need:
- A fast “single place” for relationships and next steps.
- Consistent pipeline stages and lightweight governance.
- Low admin overhead and clear defaults.

The MVP aims to prove value with a narrow, repeatable workflow: create/maintain customer records, track opportunities through stages, and manage tasks/notes with a dashboard that drives daily action.

