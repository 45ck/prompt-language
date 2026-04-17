# Risk Register (Discovery)

Scope: bounded CRM MVP (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard).

| ID | Risk | Impact | Likelihood | Mitigation (MVP-appropriate) | Owner |
| --- | --- | --- | --- | --- | --- |
| R-001 | Low adoption due to extra data entry vs spreadsheets | High | Medium | Minimize required fields; make search fast; provide clear “today” dashboard value | Product |
| R-002 | Poor data quality (duplicates, inconsistent naming) | High | Medium | Basic validation; dedupe guidance; enforce unique email for contacts where present | Product/Eng |
| R-003 | Pipeline stages don’t match how team sells/serves | Medium | Medium | Provide a small default set; allow renaming/reordering stages within one org (bounded) | Product |
| R-004 | Permission / data access confusion | High | Low | Start with single-organization model; keep roles minimal (e.g., member/admin) | Eng |
| R-005 | Multi-user concurrency conflicts (simultaneous edits) | Medium | Low | Use optimistic UI with last-write-wins; show updated timestamps | Eng |
| R-006 | Reporting/dashboard not credible (counts don’t match expectations) | High | Medium | Define metrics precisely; align dashboard to acceptance criteria; add tests for queries | Eng |
| R-007 | Performance degrades with growth (search, lists) | Medium | Medium | Index core fields (email, name, stage, due date); paginate lists; avoid N+1 queries | Eng |
| R-008 | Security issues (password/session handling) | High | Low | Use proven auth approach; secure cookies; rate limiting; audit basic auth flows | Eng |
| R-009 | Scope creep (email sync, quoting, automation) | High | High | Explicit non-goals; acceptance criteria act as guardrails; defer integrations | Product |
| R-010 | Migration from existing spreadsheets is painful | Medium | Medium | Define CSV import as post-MVP; in MVP provide clear manual entry + consistent fields | Product |

