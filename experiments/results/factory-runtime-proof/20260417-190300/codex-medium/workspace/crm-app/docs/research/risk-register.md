# Risk register (Discovery)

Scope: bounded CRM MVP (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard) built with Next.js + TypeScript + PostgreSQL + Prisma.

## Product / user risks
| Risk | Likelihood | Impact | Mitigation (MVP-appropriate) |
| --- | --- | --- | --- |
| Users don’t update records consistently (stale CRM) | High | High | Make “update stage + add note + add task” a fast loop; dashboard highlights overdue tasks and stale opportunities. |
| Pipeline stages don’t match how teams talk about work | Medium | High | Keep stages simple and editable; require minimal fields; avoid complex forecasting assumptions. |
| Sales vs service teams interpret “opportunity” differently | Medium | Medium | Define “opportunity” as “work item” (deal/job) with stages; keep language neutral in UI copy later. |
| Too much data entry required to get value | High | High | Minimal required fields; defaults; progressive disclosure; quick-add actions. |
| Permission expectations don’t match reality | Medium | Medium | Keep permissions simple for MVP: strict org scoping; within an org, allow members to perform needed CRUD; add roles later if required. |

## Technical risks
| Risk | Likelihood | Impact | Mitigation (MVP-appropriate) |
| --- | --- | --- | --- |
| Schema churn slows development | Medium | Medium | Use Prisma migrations; keep entities minimal; avoid premature extensibility (custom fields, plugins). |
| Poor query performance on lists/search | Medium | Medium | Add baseline indexes for common queries (by org, owner, stage, dueDate); paginate lists. |
| Auth/session security mistakes | Medium | High | Use proven auth approach; secure cookies; CSRF protection where applicable; least-privilege access checks per org. |
| Multi-tenant data leakage | Low | High | Enforce org scoping in every query; tests for access control; avoid “global” queries. |
| Timezone/date handling breaks task due dates | Medium | Medium | Store timestamps consistently (UTC); clarify due-date semantics; test boundary cases. |

## Delivery / operations risks
| Risk | Likelihood | Impact | Mitigation (MVP-appropriate) |
| --- | --- | --- | --- |
| No clear definition of “done” leads to scope creep | High | High | Keep explicit non-goals; acceptance criteria tied to MVP entities and flows only. |
| QA misses regressions in key flows | Medium | High | Acceptance criteria -> test plan; focus on create/update flows and access control. |
| Lack of observability slows debugging | Medium | Medium | Add structured logging for auth and key mutations; ensure errors are visible to operators. |
