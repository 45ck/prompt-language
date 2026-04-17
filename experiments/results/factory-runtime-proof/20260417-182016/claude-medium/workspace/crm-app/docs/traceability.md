# Traceability Matrix

Maps each acceptance criterion to its feature area, API endpoint(s), planned test file, and demo step.

## Authentication

| AC   | Feature Area     | API Endpoint(s)                          | Test File                              | Demo Step |
|------|------------------|------------------------------------------|----------------------------------------|-----------|
| AC-01 | Registration    | `POST /api/auth/register`                | `auth/register.test.ts`                | Register new user, verify redirect to dashboard |
| AC-02 | Registration    | `POST /api/auth/register`                | `auth/register.test.ts`                | Attempt duplicate email, verify error message |
| AC-03 | Login           | `POST /api/auth/[...nextauth]`           | `auth/login.test.ts`                   | Log in with valid credentials, verify dashboard |
| AC-04 | Login           | `POST /api/auth/[...nextauth]`           | `auth/login.test.ts`                   | Submit wrong password, verify generic error |
| AC-05 | Session         | NextAuth session config                  | `auth/session.test.ts`                 | Wait 24h (or mock expiry), verify redirect |
| AC-06 | Auth Guard      | Middleware `middleware.ts`               | `auth/guard.test.ts`                   | Access /dashboard without session, verify redirect |

## Contacts

| AC   | Feature Area     | API Endpoint(s)                          | Test File                              | Demo Step |
|------|------------------|------------------------------------------|----------------------------------------|-----------|
| AC-07 | Create Contact  | `POST /api/contacts`                     | `contacts/crud.test.ts`               | Fill form, save, verify detail page |
| AC-08 | Edit Contact    | `PATCH /api/contacts/[id]`               | `contacts/crud.test.ts`               | Edit phone, save, verify updated value |
| AC-09 | Delete Contact  | `DELETE /api/contacts/[id]`              | `contacts/crud.test.ts`               | Delete contact, confirm dialog, verify redirect |
| AC-10 | Search Contacts | `GET /api/contacts?search=smith`         | `contacts/search.test.ts`             | Type "smith", verify filtered results |
| AC-11 | Validation      | `POST /api/contacts`                     | `contacts/validation.test.ts`         | Submit empty last name, verify field error |

## Companies

| AC   | Feature Area     | API Endpoint(s)                          | Test File                              | Demo Step |
|------|------------------|------------------------------------------|----------------------------------------|-----------|
| AC-12 | Create Company  | `POST /api/companies`                    | `companies/crud.test.ts`              | Fill form, save, verify detail page |
| AC-13 | Company Detail  | `GET /api/companies/[id]`                | `companies/detail.test.ts`            | View company with linked contacts and opportunities |
| AC-14 | Edit Company    | `PATCH /api/companies/[id]`              | `companies/crud.test.ts`              | Edit industry, save, verify updated value |

## Opportunities

| AC   | Feature Area     | API Endpoint(s)                          | Test File                              | Demo Step |
|------|------------------|------------------------------------------|----------------------------------------|-----------|
| AC-15 | Create Opportunity | `POST /api/opportunities`             | `opportunities/crud.test.ts`          | Fill form, save, verify board placement |
| AC-16 | Drag-and-Drop   | `PATCH /api/opportunities/[id]/stage`    | `opportunities/pipeline.test.ts`      | Drag card from Lead to Qualified, refresh, verify |
| AC-17 | Edit Opportunity | `PATCH /api/opportunities/[id]`         | `opportunities/crud.test.ts`          | Change stage via dropdown, save, verify board |
| AC-18 | List View       | `GET /api/opportunities?sort=value:desc` | `opportunities/list.test.ts`          | Sort by value descending, verify order |
| AC-19 | Delete Opportunity | `DELETE /api/opportunities/[id]`       | `opportunities/crud.test.ts`          | Delete opportunity, confirm, verify removal |

## Pipeline Stages

| AC   | Feature Area     | API Endpoint(s)                          | Test File                              | Demo Step |
|------|------------------|------------------------------------------|----------------------------------------|-----------|
| AC-20 | Default Stages  | `GET /api/stages`                        | `stages/defaults.test.ts`             | View board after fresh seed, verify 6 columns |
| AC-21 | Add Stage       | `POST /api/stages`                       | `stages/admin.test.ts`                | Add "Discovery" stage, verify board column |
| AC-22 | Rename Stage    | `PATCH /api/stages/[id]`                 | `stages/admin.test.ts`                | Rename Lead to New Lead, verify header and data |
| AC-23 | Archive Stage   | `PATCH /api/stages/[id]` (archive flag)  | `stages/admin.test.ts`                | Archive stage, verify hidden from board, list accessible |
| AC-24 | RBAC            | `GET /api/stages/settings`               | `stages/rbac.test.ts`                 | Rep attempts settings page, verify 403 |

## Tasks

| AC   | Feature Area     | API Endpoint(s)                          | Test File                              | Demo Step |
|------|------------------|------------------------------------------|----------------------------------------|-----------|
| AC-25 | Create Task     | `POST /api/tasks`                        | `tasks/crud.test.ts`                  | Create task, verify list entry |
| AC-26 | Complete Task   | `PATCH /api/tasks/[id]`                  | `tasks/crud.test.ts`                  | Toggle complete, verify dashboard removal |
| AC-27 | Linked Task     | `GET /api/contacts/[id]` (include tasks) | `tasks/linked.test.ts`                | View contact detail, verify task in Tasks section |
| AC-28 | Filter Tasks    | `GET /api/tasks?filter=overdue`          | `tasks/filter.test.ts`                | Filter by overdue, verify only past-due shown |

## Notes

| AC   | Feature Area     | API Endpoint(s)                          | Test File                              | Demo Step |
|------|------------------|------------------------------------------|----------------------------------------|-----------|
| AC-29 | Add Note        | `POST /api/notes`                        | `notes/crud.test.ts`                  | Add note on contact page, verify timestamp and author |
| AC-30 | Edit Note       | `PATCH /api/notes/[id]`                  | `notes/crud.test.ts`                  | Edit own note, verify updated text |
| AC-31 | Ownership       | `GET /api/notes/[id]`                    | `notes/ownership.test.ts`             | View other user's note, verify no edit/delete controls |
| AC-32 | Delete Note     | `DELETE /api/notes/[id]`                 | `notes/crud.test.ts`                  | Delete own note, confirm dialog, verify removal |

## Dashboard

| AC   | Feature Area     | API Endpoint(s)                          | Test File                              | Demo Step |
|------|------------------|------------------------------------------|----------------------------------------|-----------|
| AC-33 | Pipeline Summary | `GET /api/dashboard/pipeline`           | `dashboard/pipeline.test.ts`          | View dashboard, verify stage counts and totals |
| AC-34 | Overdue Tasks   | `GET /api/dashboard/tasks-overdue`       | `dashboard/tasks.test.ts`             | View dashboard with overdue tasks, verify listing |
| AC-35 | My Open Tasks   | `GET /api/dashboard/tasks-mine`          | `dashboard/tasks.test.ts`             | View dashboard, verify own open tasks count |
| AC-36 | Recent Opps     | `GET /api/dashboard/recent-opportunities`| `dashboard/recent.test.ts`            | View dashboard, verify 4 recently updated shown |
| AC-37 | Navigation      | N/A (client-side routing)                | `dashboard/navigation.e2e.ts`         | Click opportunity in summary, verify detail page |

## Role-Based Access Control

| AC   | Feature Area     | API Endpoint(s)                          | Test File                              | Demo Step |
|------|------------------|------------------------------------------|----------------------------------------|-----------|
| AC-38 | RBAC            | `GET /api/admin/users`                   | `admin/rbac.test.ts`                  | Rep attempts user management, verify 403 |
| AC-39 | Role Change     | `PATCH /api/admin/users/[id]`            | `admin/users.test.ts`                 | Admin changes Rep to Manager, verify next request |
| AC-40 | Deactivate User | `PATCH /api/admin/users/[id]` (deactivate)| `admin/users.test.ts`                | Deactivate user, attempt login, verify rejection |
