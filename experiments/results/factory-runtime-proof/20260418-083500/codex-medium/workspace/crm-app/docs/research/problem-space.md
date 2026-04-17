# Problem space (SME CRM MVP)

## Context
Small and medium-sized businesses usually do not fail at selling or servicing because they lack a sophisticated CRM. They fail because customer context lives in too many places at once: inboxes, spreadsheets, notebooks, shared drives, and people’s heads. In teams of roughly 2-50 staff, the same person may prospect, quote, onboard, and handle support follow-up. That operating model creates predictable problems:

- A contact is known by one teammate but not visible to the rest of the team.
- A company record exists somewhere, but the latest interaction note is buried in email or chat.
- An opportunity is verbally described as "hot" or "waiting" without a shared stage definition.
- A promised follow-up sits on an individual to-do list instead of in the shared system.
- Managers can ask "What moved since last review?" or "What is overdue?" and get opinion instead of evidence.

The bounded CRM MVP is meant to solve these routine coordination failures, not to replace email, support desks, marketing automation, or ERP systems.

## Real SME sales and service workflow realities
SME customer work usually follows a simple loop:

1. Someone learns about a company or contact from a referral, inbound enquiry, repeat purchase, renewal, or service issue.
2. The team needs to know whether that person and company already exist in the system.
3. If there is commercial potential, an opportunity is created and placed into a shared pipeline stage.
4. Each call, email, meeting, or service interaction creates either a note, a next-step task, or both.
5. The team checks a dashboard or list view to see what is overdue, what moved, and what needs attention today.

The MVP only needs to support the internal recordkeeping and coordination layer of that loop.

## Core problems within scope
### 1) Customer context is fragmented
In small teams, information about one customer is often split across spreadsheets, inboxes, and memory. A rep may know the contact, a founder may know the commercial history, and an operations person may know the latest service issue. Without shared records:

- Teams duplicate outreach because they cannot see prior contact.
- Staff lose time asking "Who owns this?" or "Have we spoken to them before?"
- Handoffs break when one person is away or leaves.

Within MVP scope, this creates a need for reliable company and contact records with linked notes, tasks, and opportunities.

### 2) Follow-up discipline breaks under interruptions
SME work is interruption-heavy. A seller or service lead moves from calls to admin to delivery issues throughout the day. Important next steps are easy to forget unless they are captured immediately in a shared place. Common failures:

- A quote follow-up is promised but never tracked.
- A customer issue is discussed, but no task is assigned or due-dated.
- Work is "known" informally until the original owner is unavailable.

Within MVP scope, tasks tied to contacts, companies, and opportunities are the minimum control needed to stop follow-ups from disappearing.

### 3) Pipeline visibility becomes subjective
Many SMEs say they have a pipeline, but in practice it is a spreadsheet column, a whiteboard, or a set of personal judgments. The result is low-confidence pipeline review:

- Different people interpret stage names differently.
- Opportunities sit untouched because no one can see staleness.
- Leaders cannot compare current-stage mix week to week.

Within MVP scope, opportunities need explicit pipeline stages and visible stage changes so the team shares the same picture of active work.

### 4) Notes are not captured where the team can use them
Short notes are the main way SMEs preserve continuity: what was promised, what the customer cares about, what blocked the last call, who asked for what. When notes stay in inboxes or private documents:

- Service and sales handoffs lose nuance.
- Teams repeat discovery questions customers already answered.
- Context is rebuilt from memory instead of read from the record.

Within MVP scope, notes must be quick to add and easy to review from the relevant company, contact, or opportunity.

### 5) Daily review lacks a shared operating view
Small teams often run by daily triage rather than formal forecasting. A manager, founder, or team lead wants quick answers:

- What deals are active and where are they sitting?
- Which follow-ups are overdue?
- What changed since yesterday?

Within MVP scope, the dashboard exists to answer those operational questions using counts by stage, overdue/upcoming tasks, and recent activity.

## What the MVP must support
- Secure sign-in and sign-out for internal team members.
- Company records as the anchor for business customers.
- Contact records linked to companies where known.
- Opportunity records with a required stage and optional commercial detail.
- Tasks linked to companies, contacts, and/or opportunities.
- Notes linked to companies, contacts, and/or opportunities.
- A dashboard that summarizes current pipeline shape, task urgency, and recent updates.

## Explicit scope limits
The problem space stops at internal CRM coordination. It does not extend to:

- Email sync, inbox management, or calendar sync.
- Calling, SMS, chat, or ticketing.
- Lead capture forms, campaigns, or automation.
- Quotes, invoices, payments, or contracts.
- Custom objects, workflow engines, or advanced permissions.
- Forecasting, commission logic, or territory management.

## Why this bounded scope is enough for an MVP
For SMEs, the first value of a CRM is not sophistication. It is shared memory plus shared follow-up discipline. If the product makes it easy to create core records, move opportunities through simple stages, capture next steps, and review the day’s work, it solves the most common operational failures without forcing teams into a larger platform commitment.
