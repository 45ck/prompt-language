# Success metrics

These metrics measure whether the bounded CRM MVP improves real SME sales and service execution. They avoid dependence on non-MVP features such as email sync, marketing automation, or forecasting.

## Primary outcome metrics

### 1. Active opportunities with a clear next step
Definition:

- Percentage of open opportunities that have at least one open task with an owner and due date

Why it matters:

- This is the clearest indicator that the CRM is supporting real follow-up work instead of becoming a passive deal list

### 2. Overdue task rate
Definition:

- Open overdue tasks divided by total open tasks

Why it matters:

- A high overdue rate signals weak execution and a dashboard that is not driving action

### 3. Weekly dashboard review usage
Definition:

- Percentage of active managers or admins who use the dashboard during the weekly review window

Why it matters:

- The dashboard exists to support operational review, not just passive reporting

### 4. Opportunity record completion
Definition:

- Percentage of active opportunities linked to a company and populated with a stage

Why it matters:

- The pipeline is only useful when each opportunity is attached to a real account and current stage

## Secondary workflow metrics

### Time to first value
Definition:

- Time from first sign-in to first created company, contact, opportunity, and task

Why it matters:

- Small teams adopt tools that let them get operational quickly

### Opportunity update recency
Definition:

- Percentage of active opportunities updated within the last 14 days

Why it matters:

- In SMEs, stale opportunities usually mean the pipeline is not being maintained

### Notes coverage on active work
Definition:

- Percentage of active opportunities or recent service follow-ups with at least one note

Why it matters:

- Notes are the minimum viable continuity layer for handoff and recall

### Task completion timeliness
Definition:

- Percentage of tasks completed on or before due date

Why it matters:

- This shows whether the CRM is helping teams keep promises, not just record them

## Data quality metrics

### Duplicate contact rate
Definition:

- Contacts with the same normalized email address divided by total contacts

### Duplicate company rate
Definition:

- Companies with the same normalized name divided by total companies

### Search-before-create success proxy
Definition:

- Share of new contact or company creation flows that begin with a search and do not immediately result in a duplicate

Why these matter:

- Duplicate customer records are one of the fastest ways to destroy trust in a small-team CRM

## Qualitative validation metrics

### Manager trust in dashboard accuracy
Prompt:

- "The dashboard reflects the real state of our pipeline and follow-up work."

Measure:

- 1 to 5 rating from owner-operators or managers

### Team confidence in handoff continuity
Prompt:

- "I can open a company or opportunity record and understand what happened last and what should happen next."

Measure:

- 1 to 5 rating from team members

## Guardrails

### Scope adherence
Definition:

- Percentage of delivered work mapped directly to MVP objects: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard

Why it matters:

- The discovery outcome is valid only if the product stays focused on the bounded operational loop

## Recommended MVP scorecard

Track these first:

1. Active opportunities with a clear next step
2. Overdue task rate
3. Weekly dashboard review usage
4. Opportunity record completion
5. Duplicate contact and company rate
