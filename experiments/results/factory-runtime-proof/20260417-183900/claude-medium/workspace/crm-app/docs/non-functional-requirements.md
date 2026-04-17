# Non-Functional Requirements

## NFR-01: Performance

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Page load (initial) | < 2s on 4G (10 Mbps) | Lighthouse Performance score >= 80 |
| Page navigation (SPA) | < 500ms | Client-side timing API |
| API response (p95) | < 500ms | Server-side request logging |
| API response (p99) | < 1s | Server-side request logging |
| Search results | < 300ms for queries against 10k contacts | Database query explain + timing |
| Dashboard render | < 1s including aggregation queries | End-to-end timing |

**Constraints**
- Database queries must use indexes; no full table scans for list/search endpoints.
- Pipeline aggregation uses a single query with GROUP BY, not N+1 fetches.
- Next.js static assets served with cache headers (immutable, max-age 1 year).

---

## NFR-02: Security

| Requirement | Detail |
|-------------|--------|
| Authentication | Email/password with bcrypt (cost factor >= 12). Session tokens via HTTP-only secure cookies. |
| Authorization | Role-based access control (RBAC) with four roles: Admin, Sales Manager, Sales Rep, Service Agent. |
| Multi-tenancy isolation | All queries scoped by orgId. Row-level filtering enforced at the data access layer, not just the API layer. |
| Password policy | Minimum 8 characters. No complexity rules for MVP (revisit post-launch). |
| Session management | Sessions expire after 24 hours of inactivity. Logout invalidates the session server-side. |
| Input validation | All user input validated and sanitized server-side. Prisma parameterized queries prevent SQL injection. |
| CSRF protection | Next.js built-in CSRF tokens for mutations. |
| Error messages | Generic auth errors ("Invalid email or password"). No stack traces in production responses. |
| HTTPS | All traffic over TLS. HTTP redirects to HTTPS. |
| Secrets management | Database credentials, session secret stored in environment variables, never in code. |

**RBAC Matrix (MVP)**

| Action | Admin | Sales Manager | Sales Rep | Service Agent |
|--------|-------|---------------|-----------|---------------|
| Manage users/roles | Yes | No | No | No |
| Configure pipeline stages | Yes | No | No | No |
| View all org data | Yes | Yes | Own + team | Own + team |
| Create/edit contacts | Yes | Yes | Yes | Yes |
| Create/edit opportunities | Yes | Yes | Yes | No |
| Create/edit tasks | Yes | Yes | Yes | Yes |
| Add notes | Yes | Yes | Yes | Yes |
| View dashboard | Yes | Yes | Yes (own) | No |

---

## NFR-03: Reliability

| Metric | Target |
|--------|--------|
| Uptime | 99.5% monthly (allows ~3.6 hours downtime/month) |
| Data durability | Daily automated database backups with 7-day retention |
| Error rate | < 0.1% of API requests return 5xx |
| Recovery time objective (RTO) | < 1 hour |
| Recovery point objective (RPO) | < 24 hours (daily backup) |

**Constraints**
- Database connection pooling to handle connection exhaustion gracefully.
- Application logs structured (JSON) and shipped to a central location.
- Health check endpoint (`/api/health`) returns 200 with db connectivity status.

---

## NFR-04: Accessibility

| Requirement | Standard |
|-------------|----------|
| Compliance target | WCAG 2.1 Level AA |
| Keyboard navigation | All interactive elements reachable and operable via keyboard |
| Screen reader support | Semantic HTML, ARIA labels on custom components, meaningful alt text |
| Color contrast | Minimum 4.5:1 for normal text, 3:1 for large text |
| Focus indicators | Visible focus ring on all interactive elements |
| Form labels | All form inputs have associated labels; error messages linked to fields |
| Responsive design | Usable on viewport widths from 375px to 1920px |

**Testing**
- Automated: axe-core in CI pipeline.
- Manual: keyboard-only walkthrough of core workflows during QA.

---

## NFR-05: Scalability

| Dimension | MVP Target |
|-----------|------------|
| Concurrent users | 50 |
| Total contacts per org | 10,000 |
| Total opportunities per org | 2,000 |
| Organizations (tenants) | 10 |
| API requests/minute | 500 |

**Constraints**
- Stateless application tier (session data in database or cookie, not in-memory).
- Database indexes on: orgId (all tables), email (contacts), ownerId (contacts, opportunities), stageId (opportunities), dueDate + completed (tasks).
- Connection pooling sized for concurrent user target (pool size >= 20).
- Single-instance deployment is sufficient for MVP. Avoid sticky sessions so horizontal scaling remains possible post-MVP without rearchitecting.

---

## NFR-06: Maintainability

| Requirement | Detail |
|-------------|--------|
| Type safety | TypeScript strict mode across the codebase |
| Linting | ESLint with Next.js recommended rules; zero warnings policy |
| Formatting | Prettier with consistent config |
| Testing | Unit tests for business logic; integration tests for API routes; E2E for core workflows |
| Test coverage | >= 80% line coverage for business logic |
| Database migrations | Prisma Migrate for all schema changes; no manual DDL |
| Dependency management | Lock file committed; monthly dependency audit |
