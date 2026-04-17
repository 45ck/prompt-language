# Risk Register

## Risk Scoring

- **Likelihood:** Low (1), Medium (2), High (3)
- **Impact:** Low (1), Medium (2), High (3)
- **Score:** Likelihood x Impact (1-9)

## Product Risks

### R1: Low Adoption by Sales Reps

| Attribute | Value |
|---|---|
| Likelihood | High (3) |
| Impact | High (3) |
| Score | 9 |
| Category | Product |

**Description:** Reps revert to spreadsheets because the CRM adds friction to their daily workflow. This is the most common failure mode for SME CRM deployments.

**Indicators:** Login frequency drops below 3x/week per rep within 30 days of launch. Notes and task creation rates decline over time.

**Mitigation:**
- Design for speed: fast search, one-click stage changes, minimal required fields.
- Ensure the pipeline Kanban is the landing page -- immediate value on every login.
- Keep the contact/opportunity creation flow under 30 seconds.
- Dashboard shows personal tasks so reps have a reason to check daily.

### R2: Data Quality Degradation

| Attribute | Value |
|---|---|
| Likelihood | High (3) |
| Impact | Medium (2) |
| Score | 6 |
| Category | Product |

**Description:** Without validation rules or required fields beyond the minimum, reps create incomplete records -- contacts without emails, opportunities without values, tasks without due dates.

**Indicators:** >30% of contacts missing email. >20% of opportunities missing value or close date.

**Mitigation:**
- Mark email and value as required in the UI (not just DB constraints).
- Show data completeness hints on record detail pages (e.g., "Missing: phone, company").
- Accept that MVP will have weaker data quality than enterprise CRMs; optimize for adoption first.

### R3: Pipeline Stage Mismatch

| Attribute | Value |
|---|---|
| Likelihood | Medium (2) |
| Impact | Medium (2) |
| Score | 4 |
| Category | Product |

**Description:** The default stages (Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost) may not match the team's actual sales process, reducing perceived value.

**Indicators:** Admin renames all stages within the first week. Reps skip stages or cluster deals in one stage.

**Mitigation:**
- Allow admin to rename stages (in scope).
- Default stages reflect the most common B2B sales process.
- Document that stage count and ordering changes are post-MVP.

## Technical Risks

### R4: Session/Auth Security Vulnerabilities

| Attribute | Value |
|---|---|
| Likelihood | Medium (2) |
| Impact | High (3) |
| Score | 6 |
| Category | Technical |

**Description:** Email/password auth with session cookies has well-known attack surfaces: session fixation, CSRF, credential stuffing, insecure password storage.

**Indicators:** Security review findings, failed penetration tests.

**Mitigation:**
- Use bcrypt with cost factor >= 10 for password hashing.
- Secure session cookies: HttpOnly, Secure, SameSite=Lax, short expiry.
- CSRF protection on all state-changing routes.
- Rate-limit login attempts.
- Password reset tokens with short expiry and single use.

### R5: N+1 Query Performance on Dashboard

| Attribute | Value |
|---|---|
| Likelihood | Medium (2) |
| Impact | Medium (2) |
| Score | 4 |
| Category | Technical |

**Description:** The dashboard aggregates data across opportunities, tasks, and activity. Naive Prisma queries can produce N+1 patterns that degrade as data grows.

**Indicators:** Dashboard load time exceeds 2 seconds with 500+ opportunities.

**Mitigation:**
- Use Prisma aggregation queries (groupBy, count) for pipeline summary.
- Limit activity feed to 20 most recent entries with a single query.
- Index opportunity.stageId, task.dueDate, task.assigneeId.
- Load-test dashboard with 1000 opportunities during development.

### R6: Drag-and-Drop State Desynchronization

| Attribute | Value |
|---|---|
| Likelihood | Medium (2) |
| Impact | Low (1) |
| Score | 2 |
| Category | Technical |

**Description:** Client-side drag-and-drop updates the UI optimistically. If the server update fails (network error, validation), the board shows a stage that does not match the database.

**Indicators:** Opportunity appears in wrong stage on refresh. User reports "deal moved back" after page reload.

**Mitigation:**
- Optimistic update with rollback on server error.
- Show toast notification on failure with "Retry" action.
- Re-fetch board state after drag completion as a safety net.

## Operational Risks

### R7: No Backup or Data Export Path

| Attribute | Value |
|---|---|
| Likelihood | Low (1) |
| Impact | High (3) |
| Score | 3 |
| Category | Operational |

**Description:** Bulk export is out of scope. If the database is lost or corrupted, users have no way to recover their data.

**Indicators:** Database failure with no recent backup.

**Mitigation:**
- Document PostgreSQL backup procedures in deployment guide.
- Recommend automated daily pg_dump in production deployment.
- Accept that in-app export is post-MVP; the database is the export mechanism for now.

### R8: Single-Tenant Deployment Complexity

| Attribute | Value |
|---|---|
| Likelihood | Low (1) |
| Impact | Medium (2) |
| Score | 2 |
| Category | Operational |

**Description:** Multi-tenant is out of scope. Each team needs its own deployment, increasing operational burden for anyone hosting multiple teams.

**Indicators:** Host manages 3+ separate instances with diverging versions.

**Mitigation:**
- Provide clear deployment documentation (Docker, environment variables).
- Accept single-tenant as an MVP constraint; multi-tenant is a post-MVP architectural decision.

## Scope Risks

### R9: Feature Creep During Development

| Attribute | Value |
|---|---|
| Likelihood | High (3) |
| Impact | Medium (2) |
| Score | 6 |
| Category | Scope |

**Description:** During implementation, pressure to add "just one more thing" -- email integration, custom fields, advanced filters -- extends the timeline and complicates the codebase.

**Indicators:** PRD out-of-scope items appear in development tasks. Sprint scope grows beyond original estimates.

**Mitigation:**
- The PRD explicitly lists out-of-scope items. Any feature not listed in the bounded scope requires a scope change discussion.
- Use acceptance criteria as the definition of done -- not "would be nice to have."
- Defer all enhancements to a post-MVP backlog.

### R10: Insufficient Test Coverage on Auth Flows

| Attribute | Value |
|---|---|
| Likelihood | Medium (2) |
| Impact | High (3) |
| Score | 6 |
| Category | Scope |

**Description:** Auth is the most security-sensitive feature and the easiest to under-test. Edge cases in password reset, session expiry, and role enforcement are often discovered late.

**Indicators:** Auth bugs found in manual testing or post-deployment.

**Mitigation:**
- Write integration tests for all auth flows: register, login, logout, reset, role check.
- Test edge cases: expired tokens, duplicate emails, wrong passwords, session expiry.
- Include auth in acceptance criteria with explicit pass/fail conditions.

## Risk Summary (sorted by score)

| ID | Risk | Score | Category |
|---|---|---|---|
| R1 | Low adoption by reps | 9 | Product |
| R2 | Data quality degradation | 6 | Product |
| R4 | Auth security vulnerabilities | 6 | Technical |
| R9 | Feature creep | 6 | Scope |
| R10 | Insufficient auth test coverage | 6 | Scope |
| R3 | Pipeline stage mismatch | 4 | Product |
| R5 | N+1 query performance | 4 | Technical |
| R7 | No backup/export path | 3 | Operational |
| R6 | Drag-and-drop desync | 2 | Technical |
| R8 | Single-tenant complexity | 2 | Operational |
