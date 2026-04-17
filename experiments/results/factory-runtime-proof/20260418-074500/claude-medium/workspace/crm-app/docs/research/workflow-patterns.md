# SME Sales & Service Workflow Patterns

## Core Daily Workflows

### 1. Lead-to-Opportunity Conversion
**Actor**: Sales rep
**Trigger**: New inquiry (phone, email, referral)
**Steps**:
1. Create contact (name, email, phone, source)
2. Link contact to existing company or create new company
3. Qualify lead through initial conversation
4. Create opportunity (name, value, expected close date)
5. Assign to pipeline stage ("New Lead")
6. Add note summarizing initial conversation

**System support**: Contact form, company lookup/create, opportunity creation with stage assignment.

### 2. Pipeline Progression
**Actor**: Sales rep
**Trigger**: Deal status changes (meeting held, proposal sent, negotiation)
**Steps**:
1. Open pipeline board
2. Drag opportunity to next stage (e.g., "Proposal" → "Negotiation")
3. Add note about what happened
4. Update expected close date and value if changed
5. Create follow-up task with due date

**System support**: Drag-and-drop pipeline, inline note add, task creation from opportunity view.

### 3. Daily Task Review
**Actor**: Sales rep
**Trigger**: Start of workday
**Steps**:
1. View tasks due today (dashboard or task list)
2. For each task: complete action, mark done, add note to linked contact/opportunity
3. Review overdue tasks, reschedule or escalate

**System support**: Dashboard task widget (due today, overdue). Task list with filtering.

### 4. Pipeline Review (Manager)
**Actor**: Sales manager
**Trigger**: Weekly team meeting
**Steps**:
1. View pipeline dashboard (total value per stage, deal count)
2. Identify stalled deals (no activity in >7 days)
3. Review individual rep pipelines
4. Reassign or escalate stuck opportunities

**System support**: Dashboard with pipeline value summary, activity recency indicator on opportunities.

### 5. Contact/Company Data Maintenance
**Actor**: Admin or sales rep
**Trigger**: New data batch
**Steps**:
1. Import contacts from CSV
2. Review import summary (created, skipped, errors)
3. Link orphan contacts to companies manually

**System support**: CSV import with header validation and error reporting.

## Workflow Boundaries (Out of MVP Scope)

| Workflow | Status | Reason |
|----------|--------|--------|
| Email sequences/campaigns | Out | Requires email integration — post-MVP |
| Lead scoring | Out | Requires historical data + ML — post-MVP |
| Quote/proposal generation | Out | Requires document engine — post-MVP |
| Customer support tickets | Out | Different domain — not CRM MVP |
| Calendar sync | Out | Requires OAuth integration — post-MVP |
| Phone call logging | Out | Requires VoIP integration — post-MVP |

## Entity Relationships in Workflows

```
Contact ──┬── belongs to ──→ Company
          ├── has many ────→ Notes
          ├── has many ────→ Tasks
          └── linked to ──→ Opportunity ──→ Pipeline Stage

Dashboard aggregates:
  - Opportunities grouped by Pipeline Stage (value, count)
  - Tasks due today / overdue
  - Recent activity (notes, stage changes)
```
