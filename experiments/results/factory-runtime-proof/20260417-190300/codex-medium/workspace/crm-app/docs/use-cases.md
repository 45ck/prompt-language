# Use cases (Bounded CRM MVP)

Scope: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard.

## UC1: Sign in and access an organization workspace
**Actor:** any user
**Outcome:** user can access only their organization’s data.

## UC2: Create and maintain a company record
**Actor:** rep/coordinator
**Outcome:** company exists and can be linked to contacts and opportunities.

## UC3: Create and maintain a contact record
**Actor:** rep/coordinator
**Outcome:** contact exists and can be linked to a company and opportunities.

## UC4: Create an opportunity (deal/job/work item)
**Actor:** rep/coordinator
**Outcome:** opportunity is created with an initial pipeline stage and ownership.

## UC5: Advance or update an opportunity stage
**Actor:** rep/coordinator/manager
**Outcome:** opportunity stage reflects the current status.

## UC6: Add an interaction note
**Actor:** rep/coordinator
**Outcome:** note is saved and visible on the relevant record (contact/company/opportunity).

## UC7: Create a follow-up task with due date
**Actor:** rep/coordinator/manager
**Outcome:** task is assigned (to self or teammate), has a due date, and is trackable.

## UC8: Complete a task and record outcome
**Actor:** task assignee
**Outcome:** task is marked complete; optional note captures what happened.

## UC9: Daily review via dashboard
**Actor:** manager/owner
**Outcome:** sees overdue tasks and opportunities by stage; can navigate to take action.

## UC10: Search and navigate across records
**Actor:** any user
**Outcome:** can find a contact/company/opportunity quickly to update notes/tasks.

