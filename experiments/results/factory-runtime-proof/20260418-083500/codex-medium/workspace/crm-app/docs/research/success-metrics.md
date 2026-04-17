# Success metrics (bounded CRM MVP)

These metrics are limited to the bounded CRM MVP and are meant to reflect observable improvement in real SME sales and service coordination.

## Primary outcome 1: better follow-up reliability
This product should make next actions visible and harder to forget.

- Percentage of open tasks completed on or before due date.
- Median age of open overdue tasks.
- Percentage of active opportunities with at least one open or recently completed task.
- Percentage of companies or contacts with a next-step task after a recent note or stage change.

## Primary outcome 2: higher confidence in shared pipeline state
The CRM should replace subjective pipeline conversations with visible, current records.

- Percentage of active opportunities assigned to a valid pipeline stage.
- Weekly count of stage changes per active organization.
- Percentage of opportunities with a note added in the last 14 days.
- Percentage of opportunities with no note and no stage movement in 30 days or more.

## Primary outcome 3: faster retrieval of customer context
Teams should be able to open a customer record and understand the current situation without hunting through other tools.

- Time from search/list interaction to opening the intended company, contact, or opportunity record.
- Percentage of contacts linked to a company.
- Percentage of opportunities linked to a company.
- Percentage of viewed opportunities that also have at least one note or task attached.

## Activation metrics
These indicate whether a new SME team can get enough structure into the system to make it useful quickly.

- Time from signup to first company created.
- Time from signup to first contact created.
- Time from signup to first opportunity created.
- Percentage of new workspaces creating at least one company, one contact, and one opportunity within the first session.

## Engagement metrics
These measure whether the CRM becomes part of normal operating rhythm.

- Weekly active users per workspace.
- Percentage of active users who visit the dashboard at least once per work week.
- Weekly counts of created notes, tasks, and opportunities per active workspace.
- Percentage of active users who complete at least one task per week.

## Product health metrics
These ensure the core workflows remain usable.

- p95 page or endpoint latency for dashboard, company list, contact list, opportunity list, and task list.
- Error rate on create/update flows for contacts, companies, opportunities, tasks, and notes.
- Search success proxy: percentage of search sessions that end in a record open.

## Guardrail metrics
These prevent false positives where usage goes up but data quality or trust goes down.

- Duplicate-contact proxy: same email used on multiple contact records within a workspace.
- Duplicate-company proxy: repeated or highly similar company names created within a short period.
- Percentage of contacts without a linked company where a company relationship is expected.
- Percentage of overdue tasks older than 7 days.
- Percentage of opportunities with no recent note, no open task, and no recent stage movement.

## Measurement notes
- Metrics should be computed per workspace because SME operating patterns differ by team size and sales/service mix.
- Metrics should favor signals tied to actual workflow completion, not just raw record counts.
- Success for this MVP is improved team coordination around customers, opportunities, tasks, and notes, not expansion into adjacent feature areas.
