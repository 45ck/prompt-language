# Competitors and positioning (bounded CRM MVP)

## Why competitor research matters here
SMEs rarely compare a new CRM only against other CRMs. They compare it against the tools they already tolerate: spreadsheets, inbox folders, personal reminders, and whatever lightweight system currently tracks deals. This scan is meant to validate the minimum believable shape of the MVP within scope: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, and dashboard.

## What SMEs commonly use instead of a focused CRM
### Spreadsheets + inbox + individual reminders
This is the true baseline competitor for many small teams.

- Strengths: familiar, flexible, no training required.
- Weaknesses: poor linking between companies, contacts, opportunities, tasks, and notes; weak shared visibility; easy to lose follow-ups.
- MVP takeaway: the product must beat a spreadsheet on shared context and accountability, not on advanced features.

### Work management tools configured as a CRM
Teams often use boards or generic databases to model leads, deals, or accounts.

- Strengths: flexible setup, lightweight adoption, visible status columns.
- Weaknesses: customer records and relationship data become inconsistent unless someone actively maintains structure.
- MVP takeaway: relational linking and predictable record views should be a strength of this CRM, not an afterthought.

## CRM competitor patterns
### HubSpot CRM
Common SME choice because it is easy to start and presents a clean core model.

- Sets expectation for: companies, contacts, deals/opportunities, notes, tasks, and dashboard-style visibility.
- Why teams choose it: approachable entry point and low perceived setup burden.
- Where it goes beyond this MVP: marketing, service tooling, automation, email integration, broader ecosystem.
- Positioning implication: this MVP should match the clarity of core recordkeeping, not the breadth of platform features.

### Pipedrive
Pipeline-centric CRM popular with sales-led SMEs.

- Sets expectation for: clear deal stages, fast stage movement, activities/tasks, and notes attached to deals.
- Why teams choose it: pipeline view stays front and center for day-to-day selling.
- Where it goes beyond this MVP: deeper reporting, automation, email sync, broader sales tooling.
- Positioning implication: opportunity progression and follow-up capture must feel direct and lightweight.

### Zoho CRM
Often considered by SMEs wanting a broad suite at lower cost.

- Sets expectation for: standard CRM entities, pipeline management, tasks, notes, and dashboards.
- Why teams choose it: breadth and configurability.
- Common downside for small teams: more surface area than they can operationalize well.
- Positioning implication: this MVP should prefer coherence and low-admin setup over configurability.

### Salesforce (SME-oriented editions)
Represents the canonical CRM data model, even when many small teams find it too heavy.

- Sets expectation for: accounts/companies, contacts, opportunities, activities, and reporting.
- Why teams consider it: brand credibility and perceived completeness.
- Common downside for SMEs: admin burden, complexity, and cost of customization.
- Positioning implication: the MVP should preserve recognizable CRM primitives while avoiding enterprise overhead.

### Freshsales / Freshworks CRM
Common in small teams that want structured sales tracking without full enterprise weight.

- Sets expectation for: accounts, contacts, deals, tasks, notes, and basic dashboards.
- Why teams choose it: balanced breadth for small sales teams.
- Where it goes beyond this MVP: communications and automation features.
- Positioning implication: core workflow support must be solid even without integrated comms.

### Copper
Common with small Google Workspace-heavy teams.

- Sets expectation for: simple record management, opportunities, activity tracking, and low-friction usage.
- Why teams choose it: straightforwardness and low-friction operating model.
- Where it goes beyond this MVP: ecosystem integration and deeper workspace alignment.
- Positioning implication: simplicity and fast data entry are not optional; they are the main reason SMEs accept a CRM at all.

### Close
Used by some smaller, high-velocity sales teams.

- Sets expectation for: deal tracking, tasks, notes, and fast day-to-day seller workflow.
- Why teams choose it: productivity for active outbound/inbound sales execution.
- Where it goes beyond this MVP: calling, email, and comms-heavy workflows.
- Positioning implication: the CRM can stay bounded, but tasks and notes still need to support a high-tempo working rhythm.

## Minimum believable CRM expectations
Across competitors, the bounded MVP needs to satisfy the same basic expectations:

- A company and contact model that users immediately recognize.
- Opportunities that clearly belong in pipeline stages.
- Tasks that represent next actions, not generic project work.
- Notes that preserve interaction history on the relevant record.
- A dashboard that surfaces workload and movement at a glance.

If any of these are weak, SMEs will see the product as less useful than the tools they already have.

## Positioning for this MVP
### What this product is
- A focused internal CRM for SMEs that need shared memory and follow-up discipline.
- A place to manage companies, contacts, opportunities, tasks, and notes without platform sprawl.
- A tool for daily operational visibility rather than marketing or customer support automation.

### What this product is not
- Not a communications hub.
- Not a marketing platform.
- Not a ticketing system.
- Not a configurable enterprise CRM platform.

## Design implications from the competitor landscape
- The fastest path to value is making record creation, linking, and retrieval feel obvious.
- Pipeline stages must support a shared sales language without requiring heavy setup.
- Tasks and notes must be available directly from company, contact, and opportunity pages.
- The dashboard must answer "what needs action now?" rather than trying to provide advanced analytics.
- The product should win on coherence, not feature count.
