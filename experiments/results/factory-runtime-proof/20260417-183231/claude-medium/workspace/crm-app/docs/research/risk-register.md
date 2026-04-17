# Risk Register: CRM MVP

## Overview

This register catalogs risks specific to the CRM MVP build targeting SME sales and service teams. Stack: Next.js + TypeScript + PostgreSQL + Prisma. Scope: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard.

Likelihood and Impact are rated: Low, Medium, High.

## Risk Table

| ID | Risk | Category | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | **Scope creep beyond MVP boundaries.** Stakeholders or developers add email integration, automation, reporting features, or mobile app during MVP phase. | Scope | High | High | Enforce written MVP scope (8 entities only). Maintain a "V2 backlog" for all out-of-scope requests. Every feature must map to auth, contacts, companies, opportunities, pipeline stages, tasks, notes, or dashboard. Code review checks for scope violations. |
| R-02 | **Data model changes mid-build.** Schema redesign after initial migration breaks existing seed data, test fixtures, and deployed instances. | Technical | Medium | High | Design schema upfront with Prisma schema review before any code. Use Prisma migrations with explicit naming. Write migration tests that verify up/down paths. Keep seed data minimal and regenerable. |
| R-03 | **User adoption failure.** Target users continue using spreadsheets because the CRM adds friction without enough perceived value. | Adoption | Medium | High | Optimize first-run experience to under 15 minutes (signup to first contact created). Provide CSV import for existing spreadsheet data. Ensure core workflows (add contact, move deal through pipeline, create task) take fewer clicks than the spreadsheet equivalent. |
| R-04 | **Data migration from spreadsheets is lossy or painful.** Users have inconsistent data formats, duplicates, missing fields in their existing spreadsheets. | Data | High | Medium | Build a forgiving CSV importer that handles common variations (phone format, date format, empty fields). Provide a preview step before import commits. Log skipped/malformed rows with clear messages. Do not require all fields on import. |
| R-05 | **Performance degrades with realistic data volumes.** Slow queries on contacts/opportunities lists as data grows to 5K-50K records. | Performance | Medium | Medium | Add database indexes on foreign keys and commonly filtered/sorted columns from day one. Implement cursor-based pagination (not offset). Set up query performance tests with 10K contact dataset. Use Prisma query logging in development to catch N+1 queries. |
| R-06 | **Authentication vulnerabilities.** Insecure session handling, password storage, or missing CSRF protection in the auth implementation. | Security | Medium | High | Use NextAuth.js (Auth.js) with battle-tested providers. Bcrypt for password hashing with minimum 12 rounds. HTTP-only secure cookies for sessions. CSRF tokens on all mutations. Rate limiting on login endpoint. Do not build custom auth crypto. |
| R-07 | **SQL injection or data exposure via Prisma misuse.** Raw queries or improper input validation allow data access beyond user permissions. | Security | Low | High | Use Prisma's parameterized queries exclusively; prohibit `$queryRaw` with string interpolation. Implement row-level access checks in data access layer (not just UI). Input validation with Zod schemas on all API endpoints. Automated security linting in CI. |
| R-08 | **No third-party integrations limits utility.** Teams need email sync, calendar, or Slack integration to make the CRM their daily driver. | Scope | Medium | Medium | Accept this limitation for MVP. Document it clearly. Design the data model and API layer to be integration-friendly (REST endpoints, webhook-ready event model). Prioritize email integration as first V2 feature based on user feedback. |
| R-09 | **Multi-tenancy data isolation failure.** One organization's data is visible to users from another organization. | Security | Low | High | Enforce tenant ID filtering at the data access layer, not just at the API route level. Every database query must include a `WHERE organizationId = ?` clause. Write integration tests that verify cross-tenant isolation. Consider row-level security policies in PostgreSQL as a defense-in-depth measure. |
| R-10 | **Prisma migration conflicts in team development.** Multiple developers create conflicting migrations on separate branches. | Technical | Medium | Low | Establish migration naming convention with date prefix. Run `prisma migrate diff` before merging. Use a shared development database for migration testing. Document the "migration conflict resolution" process in CONTRIBUTING.md. |
| R-11 | **Dashboard performance with complex aggregations.** Pipeline summary, task counts, and activity timelines require joins across multiple tables. | Performance | Medium | Medium | Use materialized views or pre-computed summary tables for dashboard queries. Cache dashboard data with short TTL (30-60 seconds). Limit dashboard to 5-7 widgets with specific, optimized queries rather than a generic query builder. |
| R-12 | **Deployment complexity for self-hosted users.** Target users (SME teams without IT staff) cannot deploy Next.js + PostgreSQL on their own infrastructure. | Adoption | High | Medium | Provide Docker Compose one-command deployment. Document deployment on 3 platforms: Railway, Fly.io, and a generic VPS with Docker. Include health check endpoint. Provide a hosted option as fallback for teams that cannot self-host. |
| R-13 | **Data loss from lack of backup strategy.** Self-hosted instances have no automated backups; a database crash loses all customer data. | Reliability | Medium | High | Include `pg_dump` backup script in the Docker Compose setup with cron schedule. Document backup/restore procedure. Add a database health check that warns when last backup is older than 24 hours. Implement soft-delete on critical entities (contacts, companies, opportunities). |
| R-14 | **Pipeline stage customization is insufficient.** Default stages do not match every team's sales process; teams need custom stages but the MVP provides limited customization. | Scope | Medium | Medium | Make pipeline stages a database-driven entity (not hardcoded). Provide default stages on setup but allow rename, reorder, add, and archive via UI. Do not support multiple pipelines in MVP (V2 feature). |
| R-15 | **Note and task UX is too basic to replace existing tools.** Teams expect rich text, file attachments, @mentions, or due date reminders that the MVP does not include. | Adoption | Medium | Medium | Implement plain text notes with timestamps and author attribution. Tasks get: title, description, due date, assignee, status (open/completed), and linked entity (contact/company/opportunity). Accept that power users will supplement with external tools. Rich text and attachments are V2. |
| R-16 | **TypeScript/Prisma type safety gaps at API boundaries.** Runtime data does not match TypeScript types due to missing validation, causing silent data corruption. | Technical | Medium | Medium | Use Zod schemas that mirror Prisma types for all API input validation. Generate TypeScript types from Zod schemas (not manually duplicated). Test API endpoints with invalid input payloads. Enable TypeScript strict mode from day one. |
| R-17 | **Search performance is poor without full-text indexing.** Users expect to search contacts by name, email, company, and notes content. LIKE queries do not scale. | Performance | Medium | Medium | Use PostgreSQL full-text search (tsvector/tsquery) on contacts and notes from the start. Create GIN indexes on searchable columns. Implement search-as-you-type with debounced API calls. Limit search scope to current organization. |
| R-18 | **Browser compatibility issues with Next.js App Router.** Edge cases in Server Components, streaming, or client/server boundary cause bugs on specific browsers. | Technical | Low | Low | Test on Chrome, Firefox, Safari (latest 2 versions). Use progressive enhancement: core CRUD works without JavaScript (form submissions via Server Actions). Avoid bleeding-edge Next.js features that lack browser support. |
| R-19 | **Concurrent edit conflicts on shared records.** Two users edit the same contact or opportunity simultaneously; last write wins and data is lost. | Data | Medium | Low | Implement optimistic concurrency control with `updatedAt` timestamp check on writes. Return 409 Conflict when the record has changed since the client last read it. Show the conflicting values and let the user resolve. Acceptable for MVP; real-time collaboration is V2. |
| R-20 | **Regulatory compliance gaps (GDPR, CCPA).** Storing customer PII without proper consent tracking, data export, or deletion capabilities. | Legal | Medium | High | Implement contact data export (CSV) from day one. Implement hard-delete capability for contacts (with confirmation). Add a "data processing" note in terms of service. Log all data access in audit trail. Full GDPR compliance (consent management, DPA, data processing records) is V2 but the architecture must not block it. |

## Risk Summary by Category

| Category | Count | High Impact | Immediate Action Required |
|---|---|---|---|
| Scope | 2 | 1 | Enforce MVP boundary document |
| Technical | 3 | 1 | Schema review before coding |
| Security | 3 | 3 | Use NextAuth.js, parameterized queries, tenant filtering |
| Performance | 3 | 0 | Indexes and pagination from day one |
| Adoption | 3 | 1 | Optimize first-run experience |
| Data | 2 | 0 | CSV importer with preview |
| Reliability | 1 | 1 | Include backup script in deployment |
| Legal | 1 | 1 | Data export and deletion from day one |

## Review Schedule

This register should be reviewed:
- At the start of each development sprint
- When any new feature is proposed (scope creep check)
- After any security-related code change
- Before the first production deployment
