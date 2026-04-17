# Risk register (bounded CRM MVP)

## Product / scope risks
| Risk | Why it matters | Mitigation (within MVP scope) |
| --- | --- | --- |
| Scope creep (requests for email sync, tickets, quotes) | Blows timeline and muddies MVP value | Explicit non-goals in `docs/prd.md`; defer to post-MVP |
| “CRM fatigue” (too much data entry) | Users abandon quickly | Optimize for minimal required fields; fast create/edit flows; shortcuts |
| Pipeline stages don’t match real process | Users stop updating stage | Make stages configurable; provide sane default stages; require stage selection |
| Tasks not used consistently | Follow-ups still fall through | Tight linking of tasks to entities; dashboard highlights overdue tasks |
| Notes aren’t captured | Handoffs fail | Make adding notes frictionless; encourage short notes with timestamps |

## Technical risks
| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Data model ambiguity (contact vs company ownership, linking) | Causes rework and confusing UI | Define a simple relational model early; enforce consistent linking rules |
| Authorization mistakes | Cross-account data exposure | Keep auth model simple; add tests for access boundaries |
| Migration churn (schema changes early) | Slows iteration | Use Prisma migrations carefully; keep MVP entities stable |
| Performance of list pages at scale | Slow UI kills adoption | Pagination, indexed queries, pragmatic list limits |

## Delivery / operations risks
| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Unclear acceptance criteria | Hard to validate success | Strong AC in `docs/acceptance-criteria.md` tied to use cases |
| Lack of observability in early builds | Hard to debug in SME environments | Basic structured logging, error tracking hooks, health checks |

