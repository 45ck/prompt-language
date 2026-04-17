# Traceability Matrix

Maps every acceptance criterion to its user story, planned test file, and demo step.

## Authentication

| AC ID | User Story | Test File | Demo Step |
|-------|-----------|-----------|-----------|
| AC-AUTH-01 | AU-1 | `__tests__/integration/auth/register.test.ts` | Register a new user with email and password; verify redirect to dashboard |
| AC-AUTH-02 | AU-2 | `__tests__/integration/auth/login.test.ts` | Log in with valid credentials; verify session cookie is set |
| AC-AUTH-03 | AU-2 | `__tests__/integration/auth/login.test.ts` | Log in with invalid credentials; verify error message displayed |
| AC-AUTH-04 | AU-3 | `__tests__/integration/auth/roles.test.ts` | Admin assigns Manager role; verify role persists and permissions update |
| AC-AUTH-05 | AU-4 | `__tests__/e2e/auth/protected-routes.spec.ts` | Unauthenticated user visits /dashboard; verify redirect to /login |
| AC-AUTH-06 | AU-4 | `__tests__/api/auth/middleware.test.ts` | Rep attempts to access /settings/users; verify 403 response |
| AC-AUTH-07 | AU-5 | `__tests__/integration/auth/logout.test.ts` | Click logout; verify session destroyed and redirect to /login |

## Contacts

| AC ID | User Story | Test File | Demo Step |
|-------|-----------|-----------|-----------|
| AC-CON-01 | CO-1 | `__tests__/integration/contacts/create.test.ts` | Create contact with name, email, phone; verify saved in DB |
| AC-CON-02 | CO-1 | `__tests__/unit/validations/contacts.test.ts` | Submit contact with missing required fields; verify validation errors |
| AC-CON-03 | CO-2 | `__tests__/integration/contacts/list.test.ts` | Open contacts list; verify paginated table with sortable columns |
| AC-CON-04 | CO-3 | `__tests__/integration/contacts/search.test.ts` | Search contacts by name; verify filtered results |
| AC-CON-05 | CO-3 | `__tests__/integration/contacts/search.test.ts` | Filter contacts by company; verify only matching contacts shown |
| AC-CON-06 | CO-4 | `__tests__/integration/contacts/update.test.ts` | Edit contact email; verify change persisted |
| AC-CON-07 | CO-4 | `__tests__/unit/validations/contacts.test.ts` | Edit contact with invalid email format; verify validation error |
| AC-CON-08 | CO-5 | `__tests__/integration/contacts/delete.test.ts` | Delete contact; verify removed from DB and list |
| AC-CON-09 | CO-5 | `__tests__/e2e/contacts/delete-confirm.spec.ts` | Delete contact; verify confirmation dialog before deletion |

## Companies

| AC ID | User Story | Test File | Demo Step |
|-------|-----------|-----------|-----------|
| AC-COM-01 | CM-1 | `__tests__/integration/companies/create.test.ts` | Create company with name and industry; verify saved in DB |
| AC-COM-02 | CM-2 | `__tests__/integration/companies/list.test.ts` | Open companies list; verify paginated table |
| AC-COM-03 | CM-3 | `__tests__/integration/companies/update.test.ts` | Edit company name; verify change persisted |
| AC-COM-04 | CM-4 | `__tests__/integration/companies/contacts.test.ts` | View company detail; verify linked contacts shown |
| AC-COM-05 | CM-4 | `__tests__/integration/companies/contacts.test.ts` | Link contact to company; verify association saved |

## Opportunities

| AC ID | User Story | Test File | Demo Step |
|-------|-----------|-----------|-----------|
| AC-OPP-01 | OP-1 | `__tests__/integration/opportunities/create.test.ts` | Create opportunity with name, value, stage; verify saved |
| AC-OPP-02 | OP-1 | `__tests__/unit/validations/opportunities.test.ts` | Create opportunity with negative value; verify validation error |
| AC-OPP-03 | OP-2 | `__tests__/integration/opportunities/stages.test.ts` | Drag opportunity to next stage; verify stage updated |
| AC-OPP-04 | OP-3 | `__tests__/integration/opportunities/list.test.ts` | Open opportunities list; verify sortable by value and close date |
| AC-OPP-05 | OP-3 | `__tests__/integration/opportunities/filter.test.ts` | Filter opportunities by stage; verify correct subset shown |
| AC-OPP-06 | OP-4 | `__tests__/integration/opportunities/update.test.ts` | Edit opportunity value; verify change persisted |
| AC-OPP-07 | OP-5 | `__tests__/integration/opportunities/delete.test.ts` | Mark opportunity as won; verify status updated |
| AC-OPP-08 | OP-5 | `__tests__/integration/opportunities/delete.test.ts` | Mark opportunity as lost with reason; verify reason saved |

## Tasks

| AC ID | User Story | Test File | Demo Step |
|-------|-----------|-----------|-----------|
| AC-TASK-01 | TA-1 | `__tests__/integration/tasks/create.test.ts` | Create task with title, due date, assignee; verify saved |
| AC-TASK-02 | TA-1 | `__tests__/unit/validations/tasks.test.ts` | Create task with past due date; verify validation error |
| AC-TASK-03 | TA-2 | `__tests__/integration/tasks/list.test.ts` | Open task list; verify grouped by status |
| AC-TASK-04 | TA-3 | `__tests__/integration/tasks/update.test.ts` | Mark task complete; verify status changed and timestamp set |
| AC-TASK-05 | TA-3 | `__tests__/integration/tasks/update.test.ts` | Reopen completed task; verify status reverted |
| AC-TASK-06 | TA-4 | `__tests__/integration/tasks/assign.test.ts` | Assign task to rep; verify assignee updated |
| AC-TASK-07 | TA-4 | `__tests__/api/tasks/permissions.test.ts` | Rep tries to assign task to another rep; verify forbidden |
| AC-TASK-08 | TA-5 | `__tests__/integration/tasks/link.test.ts` | Link task to opportunity; verify association visible on both records |

## Notes

| AC ID | User Story | Test File | Demo Step |
|-------|-----------|-----------|-----------|
| AC-NOTE-01 | NO-1 | `__tests__/integration/notes/create.test.ts` | Add note to contact; verify note saved with timestamp and author |
| AC-NOTE-02 | NO-1 | `__tests__/unit/validations/notes.test.ts` | Submit empty note; verify validation error |
| AC-NOTE-03 | NO-2 | `__tests__/integration/notes/list.test.ts` | View contact detail; verify notes listed chronologically |
| AC-NOTE-04 | NO-2 | `__tests__/integration/notes/list.test.ts` | View opportunity detail; verify associated notes shown |
| AC-NOTE-05 | NO-3 | `__tests__/integration/notes/update.test.ts` | Edit own note; verify change persisted |
| AC-NOTE-06 | NO-3 | `__tests__/api/notes/permissions.test.ts` | Rep tries to edit another rep's note; verify forbidden |

## Dashboard

| AC ID | User Story | Test File | Demo Step |
|-------|-----------|-----------|-----------|
| AC-DASH-01 | DA-1 | `__tests__/integration/dashboard/metrics.test.ts` | Open dashboard; verify total pipeline value displayed |
| AC-DASH-02 | DA-1 | `__tests__/integration/dashboard/metrics.test.ts` | Open dashboard; verify opportunity count by stage |
| AC-DASH-03 | DA-2 | `__tests__/integration/dashboard/charts.test.ts` | Open dashboard; verify win/loss chart renders with correct data |
| AC-DASH-04 | DA-2 | `__tests__/integration/dashboard/charts.test.ts` | Filter dashboard by date range; verify chart updates |
| AC-DASH-05 | DA-3 | `__tests__/integration/dashboard/tasks.test.ts` | Open dashboard; verify upcoming tasks widget shows next 5 tasks |
| AC-DASH-06 | DA-3 | `__tests__/integration/dashboard/tasks.test.ts` | Open dashboard; verify overdue tasks highlighted |
| AC-DASH-07 | DA-4 | `__tests__/integration/dashboard/activity.test.ts` | Open dashboard; verify recent activity feed shows last 10 actions |

## Cross-Cutting

| AC ID | User Story | Test File | Demo Step |
|-------|-----------|-----------|-----------|
| AC-CROSS-01 | (all) | `__tests__/api/auth/middleware.test.ts` | Verify all API routes require authentication |
| AC-CROSS-02 | (all) | `__tests__/unit/validations/*.test.ts` | Verify all form inputs sanitized via Zod schemas |
| AC-CROSS-03 | (all) | `__tests__/e2e/responsive.spec.ts` | Open app at 375px width; verify layout is usable on mobile |
| AC-CROSS-04 | (all) | `__tests__/integration/audit/trail.test.ts` | Perform CRUD operations; verify audit log entries created |
| AC-CROSS-05 | (all) | `__tests__/e2e/pagination.spec.ts` | Load 100+ contacts; verify pagination works with correct page sizes |
