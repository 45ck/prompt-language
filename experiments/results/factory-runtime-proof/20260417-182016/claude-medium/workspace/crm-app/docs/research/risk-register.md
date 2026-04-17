# Risk Register

## Overview

This register tracks the top 10 risks for the bounded CRM MVP. Each risk is rated on likelihood (1-5) and impact (1-5), producing a risk score (L x I). Risks scoring 12 or above require active mitigation before development proceeds.

## Risk Scoring Key

| Rating | Likelihood | Impact |
|--------|-----------|--------|
| 1 | Rare | Negligible |
| 2 | Unlikely | Minor |
| 3 | Possible | Moderate |
| 4 | Likely | Major |
| 5 | Almost certain | Critical |

---

## R1: Scope Creep Beyond MVP Boundary

**Description:** Stakeholders or developers add features beyond the eight bounded modules (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard). Email integration, reporting engine, or workflow automation slip in.

**Likelihood:** 5 | **Impact:** 4 | **Score: 20**

**Mitigation:** Maintain a written scope boundary document reviewed at every planning session. Any feature request outside the eight modules is logged but deferred to a post-MVP backlog. Pull requests touching new domain areas require explicit scope approval.

---

## R2: Authentication and Authorization Complexity

**Description:** Implementing secure auth (password hashing, session management, CSRF protection, role-based access) consumes disproportionate development time and introduces security vulnerabilities if done incorrectly.

**Likelihood:** 4 | **Impact:** 4 | **Score: 16**

**Mitigation:** Use NextAuth.js (Auth.js) with the Prisma adapter for session and credential management. Limit roles to two (admin, member) in MVP. Defer OAuth/SSO providers to post-MVP. Follow OWASP session management guidelines. Add rate limiting on login endpoints from day one.

---

## R3: Data Migration from Existing Tools

**Description:** Target teams already have contacts and deals in spreadsheets, HubSpot, or other systems. Without an import path, adoption stalls because re-entering data manually is prohibitive.

**Likelihood:** 4 | **Impact:** 3 | **Score: 12**

**Mitigation:** Provide a CSV import utility for contacts and companies at launch. Define a canonical CSV schema with required and optional columns. Validate and preview before committing. Defer API-based imports (HubSpot, Pipedrive) to post-MVP.

---

## R4: Performance Degradation at Scale

**Description:** PostgreSQL queries slow down as contacts, opportunities, and notes accumulate. The dashboard aggregation queries become bottlenecks. List views without pagination time out.

**Likelihood:** 3 | **Impact:** 4 | **Score: 12**

**Mitigation:** Implement cursor-based pagination on all list endpoints from the start. Add database indexes on foreign keys, created_at, and status columns in the initial migration. Use Prisma's `select` to avoid over-fetching. Set a target: all list queries return in under 200ms with 100,000 contacts. Load test before launch with realistic data volumes.

---

## R5: Prisma ORM Limitations

**Description:** Prisma's query engine may not support required query patterns (complex aggregations for dashboard, full-text search on contacts, bulk upserts for CSV import). Workarounds add complexity.

**Likelihood:** 3 | **Impact:** 3 | **Score: 9**

**Mitigation:** Prototype dashboard aggregation queries early. Use Prisma's `$queryRaw` for any query that the generated client cannot express cleanly. Keep the raw SQL isolated in repository-layer functions. Evaluate the dashboard query feasibility in week one of development.

---

## R6: Self-Hosted Deployment Complexity

**Description:** Target users (technical founders, small dev teams) struggle with deployment. PostgreSQL setup, environment variables, TLS termination, and backup configuration create friction that defeats the "deploy in under an hour" goal.

**Likelihood:** 3 | **Impact:** 4 | **Score: 12**

**Mitigation:** Provide a Docker Compose file with PostgreSQL, the Next.js app, and a reverse proxy pre-configured. Include a `.env.example` with documented variables. Write a single-page deployment guide covering VPS, Docker, and Railway/Render. Test the deployment path on a fresh Ubuntu 22.04 VPS as part of the release process.

---

## R7: Insufficient Test Coverage Leading to Regressions

**Description:** Without adequate test coverage, changes to shared logic (pipeline stage transitions, permission checks, contact deduplication) introduce regressions caught only by end users.

**Likelihood:** 3 | **Impact:** 3 | **Score: 9**

**Mitigation:** Require unit tests for all domain logic and integration tests for API routes. Use Vitest for unit tests and Playwright for critical UI flows (login, create contact, move deal through pipeline). Set a coverage floor of 80% on business logic. Run the full test suite in CI on every pull request.

---

## R8: UI/UX Does Not Meet Minimum Usability Bar

**Description:** The interface is functional but confusing. Users cannot discover how to create a contact, move a deal, or find overdue tasks without instructions. Adoption fails despite correct functionality.

**Likelihood:** 3 | **Impact:** 4 | **Score: 12**

**Mitigation:** Use a proven component library (shadcn/ui) for consistent patterns. Follow established CRM layout conventions: sidebar navigation, list-detail views, kanban pipeline board. Conduct a usability walkthrough with three non-technical users before launch. Prioritize the five most common actions: create contact, create deal, move deal stage, create task, view dashboard.

---

## R9: Single-Developer Maintenance Risk

**Description:** The deploying developer leaves the team. Remaining team members cannot maintain, update, or troubleshoot the self-hosted CRM. The system becomes abandonware.

**Likelihood:** 3 | **Impact:** 3 | **Score: 9**

**Mitigation:** Use a conventional, well-documented stack (Next.js, Prisma, PostgreSQL) that any TypeScript developer can pick up. Keep the codebase under 15,000 lines of application code. Maintain inline documentation on non-obvious decisions. Provide a CONTRIBUTING.md with architecture overview, setup instructions, and common maintenance tasks.

---

## R10: Data Loss from Inadequate Backup Strategy

**Description:** A database corruption, accidental deletion, or failed migration causes permanent data loss. Self-hosted deployments lack the automatic backup infrastructure of SaaS platforms.

**Likelihood:** 2 | **Impact:** 5 | **Score: 10**

**Mitigation:** Include a backup script in the Docker Compose setup that runs `pg_dump` daily to a configurable destination. Document restore procedures. Add a health check endpoint that verifies database connectivity. Recommend WAL archiving for teams with higher data sensitivity. Test the backup-restore cycle as part of the release process.

---

## Risk Summary Matrix

| Risk | Score | Status |
|------|-------|--------|
| R1: Scope creep | 20 | Active - requires ongoing governance |
| R2: Auth complexity | 16 | Active - mitigated by NextAuth.js |
| R3: Data migration | 12 | Active - CSV import in MVP |
| R4: Performance at scale | 12 | Active - pagination and indexing from day one |
| R6: Deployment complexity | 12 | Active - Docker Compose provided |
| R8: UI usability | 12 | Active - shadcn/ui + usability testing |
| R10: Data loss | 10 | Monitored - backup script included |
| R5: Prisma limitations | 9 | Monitored - prototype early |
| R7: Test coverage | 9 | Monitored - CI enforcement |
| R9: Maintenance risk | 9 | Monitored - conventional stack |
