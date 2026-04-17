# Risk register

Scope: bounded CRM MVP covering auth, contacts, companies, opportunities, pipeline stages, tasks, notes, and dashboard.

Scale:

- Likelihood: Low, Medium, High
- Impact: Low, Medium, High

## Product and workflow risks
| Risk | Likelihood | Impact | Why it matters in SME workflows | Mitigation |
| --- | --- | --- | --- | --- |
| Users create opportunities without a next-step task | High | High | A stage without a concrete follow-up is the most common reason deals stall | Keep task creation clearly available from opportunity workflows; validate MVP with team practice before adding any dashboard hygiene surfacing |
| Teams use stages inconsistently | High | High | Managers lose trust in pipeline review when stages represent different realities | Keep the default stage set small; define plain-language stage meaning; avoid stage sprawl in MVP |
| Tasks are created without clear ownership or due date | Medium | High | Small teams depend on visible accountability rather than automation | Require owner and due date; default owner to creator where appropriate; make overdue tasks prominent |
| Notes are too sparse to support handoff | Medium | Medium | SMEs often rely on memory and email, so weak notes reduce continuity | Place notes close to record actions; order by recency; encourage note capture at stage changes and customer requests |
| Duplicate contacts or companies erode trust | High | Medium | Once users see duplicate customer records, they stop trusting search and dashboards | Encourage search-before-create; normalize core fields; surface linked company and related contacts clearly |
| Dashboard becomes informational but not actionable | Medium | High | SME managers need a work list, not just charts | Keep dashboard focused on overdue tasks, due today, recent opportunity movement, and stage counts |
| Product scope expands into non-MVP CRM features | High | High | Email sync, automation, and service tooling can consume the roadmap before core workflow reliability is proven | Hold PRD boundaries; reject requirements not mapped to MVP objects; prioritize workflow completion over breadth |

## Delivery and engineering risks
| Risk | Likelihood | Impact | Why it matters | Mitigation |
| --- | --- | --- | --- | --- |
| Auth and authorization are implemented inconsistently | Medium | High | Customer and opportunity records are sensitive by default | Centralize server-side authorization checks; test member versus admin access explicitly |
| Record relationships are modeled ambiguously | Medium | High | Contacts, companies, opportunities, tasks, and notes are the core graph of the product | Lock relationship rules early; keep task and note linking rules explicit in schema and tests |
| Search and list views are too slow once data grows beyond a single-user spreadsheet replacement | Medium | Medium | Search-before-create and daily dashboard use are high-frequency actions | Index searchable and sortable fields; paginate list views; keep dashboard queries simple |
| Stage changes and task updates are easy to save in partial or invalid states | Medium | High | The value of the system depends on trustworthy operational state | Validate required fields server-side; use simple state rules; test stage and task edge cases |
| Reporting expectations exceed what the dashboard actually provides | Medium | Medium | Managers may assume forecasting or detailed analytics are included | Define dashboard scope narrowly as counts, recent movement, and overdue work |

## Adoption and operating risks
| Risk | Likelihood | Impact | Why it matters | Mitigation |
| --- | --- | --- | --- | --- |
| Teams continue to work from inboxes and spreadsheets instead of the CRM | High | High | The CRM only works if it becomes the place where next steps live | Make create, update, and review flows faster than existing workarounds; anchor weekly review on dashboard data |
| Users enter only minimum data and skip context | Medium | Medium | Thin records reduce handoff value and searchability | Keep required fields minimal but make notes easy to add at the point of work |
| Managers use the dashboard for accountability before the team trusts the data | Medium | Medium | Premature measurement can create resistance | Start with the MVP’s visible basics: overdue tasks, tasks due today, pipeline counts by stage, and recent updates |

## Compliance and security risks
| Risk | Likelihood | Impact | Why it matters | Mitigation |
| --- | --- | --- | --- | --- |
| Contact data is stored without sufficient access control | Medium | High | Contact records contain personally identifiable business information | Use secure auth defaults; enforce role checks server-side; restrict administrative actions clearly |
| Data retention and deletion expectations are unclear | Medium | Medium | SMEs still need confidence that customer data can be corrected | For MVP, support correction via edits; document that retention controls and deletion workflows are out of scope |

## Highest-priority risks for MVP validation

1. Pipeline records do not reflect real work.
2. Tasks do not reliably capture next actions.
3. Duplicate data reduces trust in the system.
4. Dashboard visibility is not actionable enough to support weekly review.
