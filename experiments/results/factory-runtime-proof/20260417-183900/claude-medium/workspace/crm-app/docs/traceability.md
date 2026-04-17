# Traceability Matrix

Maps each acceptance criterion to its user story, use case, required test types, and demo step.

| AC | Sub | User Story | Use Case | Test Types | Demo Step |
|----|-----|-----------|----------|------------|-----------|
| AC-01 | a | US-01 | Contact CRUD | Unit, E2E | Navigate to Contacts, click "Add Contact", fill first/last name, submit. Verify contact appears in list. |
| AC-01 | b | US-01 | Contact CRUD | Unit | Submit Add Contact form with empty first name. Verify validation error is shown. |
| AC-01 | c | US-01 | Contact CRUD | Integration, E2E | Open contact detail, change phone number, save. Verify updated value displays. |
| AC-02 | a | US-01 | Contact CRUD | Integration | Create contact as Org A user. Log in as Org B user. Verify contact is not visible. |
| AC-03 | a | US-02 | Contact Detail | Integration, E2E | Open contact with notes, opportunities, and tasks. Verify all linked data displays. |
| AC-03 | b | US-02 | Contact Detail | E2E | On contact detail page, click linked company name. Verify navigation to company detail. |
| AC-04 | a | US-03 | Opportunity Pipeline | Unit, E2E | Create opportunity with title, value, close date, stage. Verify it appears on pipeline board. |
| AC-04 | b | US-03 | Opportunity Pipeline | Unit | Submit opportunity form without title or stage. Verify validation error. |
| AC-05 | a | US-03 | Opportunity Pipeline | Integration, E2E | Move opportunity from "Qualification" to "Proposal". Verify board updates. |
| AC-05 | b | US-03 | Opportunity Pipeline | Integration | Move opportunity between stages. Verify stage change timestamp on detail page. |
| AC-06 | a | US-04 | Task Management | Unit, E2E | Create task with title and due date. Verify it appears in task list. |
| AC-06 | b | US-04 | Task Management | Integration | Create task linked to a contact. Verify task appears on contact detail page. |
| AC-07 | a | US-04 | Task Management | Integration, E2E | Mark task as completed. Verify completed timestamp and removal from overdue list. |
| AC-08 | a | US-05 | Notes | Unit, Integration | Add note to contact. Verify note saved with author and timestamp, shown at top. |
| AC-08 | b | US-05 | Notes | Integration | User A adds note. User B (same org) views contact. Verify note is visible. |
| AC-09 | a | US-06 | Dashboard | Integration, E2E | View dashboard with opportunities in multiple stages. Verify value/count per stage. |
| AC-09 | b | US-06 | Dashboard | E2E | Click pipeline stage on dashboard. Verify filtered opportunity list. |
| AC-10 | a | US-07 | Dashboard | Integration | Log in as Sales Manager with team overdue tasks. Verify all team overdue tasks shown. |
| AC-10 | b | US-07 | Dashboard | Integration | Log in as Sales Rep with overdue tasks. Verify only own overdue tasks shown. |
| AC-11 | a | US-09 | Contact Search | Unit, Integration | Search "Jane". Verify "Jane Doe" appears, "John Smith" does not. |
| AC-11 | b | US-09 | Contact Search | Integration | Search "jane@acme". Verify matching contact appears. |
| AC-11 | c | US-09 | Contact Search | Integration | Org A user searches "Jane". Verify only Org A results returned. |
| AC-12 | a | US-11 | User Management | Integration, E2E | As Admin, invite user with email and role. Verify account created in org. |
| AC-12 | b | US-11 | User Management | Integration | As Sales Rep, request user management page. Verify 403 or hidden UI. |
| AC-13 | a | US-11 | User Management | Integration | As Admin, change user role from Sales Rep to Sales Manager. Verify permissions update. |
| AC-13 | b | US-11 | User Management | Integration | As Admin, deactivate user. Verify login is blocked and session invalidated. |
| AC-14 | a | US-12 | Pipeline Config | Integration | As Admin, add stage "Negotiation" at position 3. Verify it appears for all users. |
| AC-14 | b | US-12 | Pipeline Config | Integration | Reorder stages. Verify pipeline board reflects new order. |
| AC-14 | c | US-12 | Pipeline Config | Integration | Attempt to delete stage with opportunities. Verify rejection with error message. |
| AC-15 | a | US-13, US-14 | Authentication | Integration, E2E | Enter valid credentials. Verify redirect to dashboard with org-scoped data. |
| AC-15 | b | US-13 | Authentication | Integration | Enter wrong password. Verify error message and no session created. |
| AC-15 | c | US-13 | Authentication | Integration | Simulate 24h inactivity. Verify redirect to login. |
| AC-15 | d | US-14 | Authentication | Integration | As Org A user, request API endpoints. Verify only Org A data returned. |
| AC-16 | a | US-08 | Owner Filtering | Integration, E2E | As Sales Manager, filter contacts by owner. Verify filtered results. |
| AC-16 | b | US-08 | Owner Filtering | Integration | As Sales Manager, filter opportunities by owner. Verify filtered results. |
| AC-17 | a | US-10 | Notes | Integration | As Service Agent, add note on contact. Verify saved with author and visible to org. |
| AC-18 | a | US-15 | Contact-Company Link | Integration, E2E | Edit contact, select company "Acme Corp". Verify link and contact on company page. |
| AC-18 | b | US-15 | Contact-Company Link | E2E | View contact linked to company. Click company link. Verify navigation. |
