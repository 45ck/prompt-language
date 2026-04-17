# Product Requirements Document: Bounded CRM MVP

## Product intent
Deliver a small, dependable CRM for SME teams that need one place to track companies, contacts, opportunities, tasks, and notes. The MVP exists to improve follow-up discipline and pipeline visibility, not to replace email, marketing, finance, or support platforms.

## Problem statement
SME teams often run customer-facing work across spreadsheets, inboxes, chat, and individual memory. That creates four predictable failures:

- company and contact context is fragmented
- opportunity status is inconsistent and subjective
- follow-up actions get lost
- managers cannot reliably see what changed or what is at risk

## Target users
- Owner-operator or sales lead who needs basic control and visibility
- Sales rep or account manager who needs fast updates during the day
- Generalist who handles both selling and customer follow-up

## MVP objective
Enable a small team to answer these questions inside one app:

- Who is this company or contact?
- What opportunity is active and what stage is it in?
- What is the next follow-up task?
- What happened most recently on this record?
- What needs attention today?

## In-scope capabilities
### 1. Authentication and workspace access
- Sign in and sign out
- Restrict all data to the current organization/workspace boundary

### 2. Company records
- Create, view, edit, and delete companies
- Search companies by name
- View linked contacts, opportunities, tasks, and notes from the company record

### 3. Contact records
- Create, view, edit, and delete contacts
- Require at least one practical identifier at creation: name or email
- Optionally link a contact to a company
- Search contacts by name and email

### 4. Opportunity tracking
- Create, view, edit, and delete opportunities
- Require opportunity name, company, and stage
- Support a fixed pipeline stage set for MVP:
  - New
  - Qualified
  - Proposal
  - Negotiation
  - Closed Won
  - Closed Lost
- Filter opportunities by stage
- Move an opportunity between stages

### 5. Task tracking
- Create, view, edit, and complete tasks
- Support required title, optional due date, and open/completed status
- Allow tasks to be linked to a company, contact, and/or opportunity
- Filter tasks by status and time relevance such as overdue or upcoming

### 6. Notes
- Add timestamped notes to a company, contact, or opportunity
- Show notes in reverse chronological order on the related record

### 7. Dashboard
- Show opportunity counts by stage
- Show overdue tasks
- Show upcoming tasks
- Show recent activity from note creation, task creation/completion, and opportunity stage changes

## Explicit non-goals
The following are out of scope for this MVP and should be rejected if proposed as "small additions":

- email sync, calendar sync, calling, SMS, or chat
- reminders, notifications, digests, or background jobs beyond core app behavior
- lead capture forms, marketing campaigns, sequences, or automation rules
- quotes, invoices, subscriptions, payments, or revenue recognition
- attachments, comments, mentions, shared documents, or file storage
- import/export, CSV upload/download, migration tools, or bulk editing
- custom fields, custom objects, configurable workflows, or custom pipelines
- advanced forecasting, dashboards beyond the defined overview, commissions, or territory management
- customer portals, external collaboration, or multi-organization sharing
- public APIs, webhooks, integrations, or marketplace connectivity
- advanced permissions beyond the bounded workspace model

## Product principles
- Fast to learn: low setup burden for an owner-led team
- Operationally useful: every feature must support daily customer work, not future platform ambitions
- Linked records over loose notes: context should live on the relevant company, contact, or opportunity
- Clear boundaries: prefer a smaller coherent product over a wider but shallow one

## Success criteria
- A new team can create its first company, contact, and opportunity without training
- A rep can capture a next-step task and note from the relevant record in one session
- A lead can open the dashboard and identify overdue work and stage distribution immediately
- Opportunity stage changes and note/task activity are visible without manual reporting

## Assumptions
- The product serves a single internal team per workspace
- The initial pipeline stage set is fixed by the product, not user-configurable
- Users are trusted internal staff, but tenant isolation is still mandatory
- Search is lightweight lookup, not full-text analytics

## Scope guardrails
- If a request primarily supports communication, automation, reporting depth, or ecosystem connectivity, it is outside MVP scope
- If a request requires background processing, external system sync, or user-configurable schemas, it is outside MVP scope
- If a request can be deferred without blocking the daily workflows above, it should be deferred
