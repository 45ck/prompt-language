# Risk Register

## Overview

Top 10 risks for the CRM MVP build, ordered by combined likelihood and impact. Each risk includes a concrete mitigation plan. Risks are categorized as Technical (T), Market (M), or Scope (S).

## Risk Matrix

Likelihood: 1 (Low) to 5 (High)
Impact: 1 (Low) to 5 (Critical)
Risk Score: Likelihood x Impact

---

## Risk 1: Scope Creep Beyond MVP Boundaries

| Field | Value |
|---|---|
| **Category** | Scope |
| **Likelihood** | 4/5 |
| **Impact** | 4/5 |
| **Risk Score** | 16/25 |

**Description:** Stakeholders or developers add features beyond the defined MVP scope (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard). Common additions that get requested: email integration, custom fields, reporting builder, API access, workflow automation.

**Mitigation:**
- Maintain a hard scope boundary document signed off by all stakeholders.
- Every feature request goes to a "post-MVP" backlog, not into the current sprint.
- Weekly scope review: if any ticket references functionality outside the 8 core entities, it is rejected or deferred.
- Definition of done for MVP does not include "nice to have" items.

---

## Risk 2: Auth Implementation Delays or Vulnerabilities

| Field | Value |
|---|---|
| **Category** | Technical |
| **Likelihood** | 3/5 |
| **Impact** | 4/5 |
| **Risk Score** | 12/25 |

**Description:** Authentication is the first feature built but blocks all other work. Rolling custom auth introduces security vulnerabilities (session fixation, CSRF, insecure password storage). Using NextAuth.js introduces dependency risk and configuration complexity.

**Mitigation:**
- Use NextAuth.js with credentials provider and email/password as the primary flow.
- Do not build custom session management; rely on NextAuth.js JWT or database sessions.
- Set a hard timebox of 3 days for auth. If not complete, cut to email-only magic links.
- Run OWASP top-10 checks before launch: password hashing (bcrypt), CSRF tokens, secure cookies, rate limiting on login.

---

## Risk 3: CSV Import Fails on Real-World Data

| Field | Value |
|---|---|
| **Category** | Technical |
| **Likelihood** | 4/5 |
| **Impact** | 3/5 |
| **Risk Score** | 12/25 |

**Description:** SME teams migrating from spreadsheets will import CSV files with inconsistent formatting: mixed date formats, phone numbers with varying country codes, duplicate entries, special characters in names, BOM markers, mixed encodings.

**Mitigation:**
- Build a preview step: show first 10 rows with column mapping before import.
- Validate required fields (email or phone for contacts, name for companies) and reject rows that fail with a downloadable error report.
- Handle common encoding issues: strip BOM, detect UTF-8/Latin-1.
- Deduplicate on email address during import with a merge-or-skip option.
- Limit import size to 10,000 rows per batch to prevent timeout.

---

## Risk 4: Low Adoption After Initial Setup

| Field | Value |
|---|---|
| **Category** | Market |
| **Likelihood** | 3/5 |
| **Impact** | 4/5 |
| **Risk Score** | 12/25 |

**Description:** Teams sign up, import contacts, and then stop using the product within 2 weeks. The spreadsheet habit is strong and the CRM adds friction without immediate visible payoff.

**Mitigation:**
- First-run experience must deliver value in under 5 minutes: import contacts, see them in a pipeline, create one task.
- Track activation metrics: define "activated" as user who has created 5+ contacts AND 3+ tasks AND viewed pipeline.
- If activation rate is below 40% after 30 days, run user interviews to identify friction points.
- Sensible defaults for pipeline stages so teams do not need to configure anything before starting.

---

## Risk 5: Prisma Schema Migrations Break in Production

| Field | Value |
|---|---|
| **Category** | Technical |
| **Likelihood** | 3/5 |
| **Impact** | 4/5 |
| **Risk Score** | 12/25 |

**Description:** Schema changes during development are easy with `prisma migrate dev`. Production migrations can fail due to data conflicts, missing nullable defaults, or long-running ALTER TABLE operations on growing tables.

**Mitigation:**
- Design the initial schema carefully. Define all MVP tables (User, Contact, Company, Opportunity, PipelineStage, Task, Note) before first deployment.
- All columns that may be added later should be nullable or have explicit defaults.
- Test migrations against a staging database with realistic data volume (10K contacts, 1K deals) before production deploy.
- Use `prisma migrate deploy` in CI/CD, never `prisma migrate dev` in production.
- Keep a rollback migration script for every forward migration.

---

## Risk 6: Timeline Underestimation

| Field | Value |
|---|---|
| **Category** | Scope |
| **Likelihood** | 4/5 |
| **Impact** | 3/5 |
| **Risk Score** | 12/25 |

**Description:** Even with a bounded MVP, the 8 core features each require CRUD UI, API routes, database schema, validation, and tests. The total surface area is larger than it appears.

**Mitigation:**
- Break each feature into explicit subtasks: schema, API, UI list, UI detail, UI create/edit, tests.
- Track velocity after the first feature (auth + contacts) and re-estimate remaining work.
- If behind schedule after week 2, cut the dashboard to a single metric (total pipeline value) and defer detailed charts.
- Ship incrementally: auth + contacts + companies first, then opportunities + pipeline, then tasks + notes, then dashboard.

---

## Risk 7: Multi-Tenancy Data Isolation Failure

| Field | Value |
|---|---|
| **Category** | Technical |
| **Likelihood** | 2/5 |
| **Impact** | 5/5 |
| **Risk Score** | 10/25 |

**Description:** In a multi-tenant architecture (shared database, tenant ID column), a missing WHERE clause or broken middleware exposes one team's data to another team.

**Mitigation:**
- Implement tenant isolation at the Prisma middleware level: every query automatically includes `WHERE tenantId = currentTenant`.
- Write integration tests that explicitly try to access cross-tenant data and assert failure.
- Use PostgreSQL Row-Level Security (RLS) as a defense-in-depth layer.
- Security review all API routes before launch, specifically checking for tenant scoping.

---

## Risk 8: Data Model Does Not Match SME Workflows

| Field | Value |
|---|---|
| **Category** | Market |
| **Likelihood** | 3/5 |
| **Impact** | 3/5 |
| **Risk Score** | 9/25 |

**Description:** The data model assumes a specific sales workflow (contact belongs to company, opportunity has stages). Real SME teams may have different patterns: solo contacts without companies, service-based deals without pipeline stages, or tasks unrelated to any deal.

**Mitigation:**
- Make Company optional on Contact (nullable foreign key).
- Make Opportunity optional on Task (tasks can be standalone).
- Pipeline stages should be configurable, not hardcoded. Provide sensible defaults but allow renaming and reordering.
- Validate the data model against 3-5 real SME teams before finalizing schema.

---

## Risk 9: Dashboard Performance with Growing Data

| Field | Value |
|---|---|
| **Category** | Technical |
| **Likelihood** | 3/5 |
| **Impact** | 3/5 |
| **Risk Score** | 9/25 |

**Description:** The dashboard aggregates data across contacts, opportunities, tasks, and pipeline stages. As data grows (10K+ contacts, 5K+ opportunities), queries slow down.

**Mitigation:**
- Use database-level aggregation (SQL GROUP BY, COUNT) rather than fetching all records to the application layer.
- Add database indexes on: `opportunity.stageId`, `opportunity.createdAt`, `task.dueDate`, `task.assignedToId`, `contact.companyId`.
- Set a performance budget: dashboard must load in under 2 seconds with 50K records.
- If PostgreSQL aggregation is insufficient, add materialized views for pipeline summary.

---

## Risk 10: Self-Hosting Complexity Deters Users

| Field | Value |
|---|---|
| **Category** | Technical |
| **Likelihood** | 3/5 |
| **Impact** | 2/5 |
| **Risk Score** | 6/25 |

**Description:** Self-hosted deployment requires Docker, PostgreSQL setup, environment variables, and DNS configuration. Non-technical SME teams may not have the skills to deploy.

**Mitigation:**
- Provide a Docker Compose file that starts the app + PostgreSQL with one command.
- Document environment variables clearly with a `.env.example` file.
- Test the setup flow on a fresh machine before launch.
- Offer a managed deployment path (Vercel + managed PostgreSQL) as an alternative to self-hosting.

---

## Risk Summary Table

| Rank | Risk | Score | Category |
|---|---|---|---|
| 1 | Scope creep beyond MVP | 16 | Scope |
| 2 | Auth delays/vulnerabilities | 12 | Technical |
| 3 | CSV import failures | 12 | Technical |
| 4 | Low adoption after setup | 12 | Market |
| 5 | Prisma migration failures | 12 | Technical |
| 6 | Timeline underestimation | 12 | Scope |
| 7 | Multi-tenancy data leak | 10 | Technical |
| 8 | Data model mismatch | 9 | Market |
| 9 | Dashboard performance | 9 | Technical |
| 10 | Self-hosting complexity | 6 | Technical |

## Risk Response Summary

- **Accept:** Risk 10 (manageable at MVP scale with Docker Compose)
- **Mitigate:** Risks 1-9 (active mitigation strategies defined above)
- **Monitor:** Risks 4, 8 (require user feedback data to validate mitigations)
