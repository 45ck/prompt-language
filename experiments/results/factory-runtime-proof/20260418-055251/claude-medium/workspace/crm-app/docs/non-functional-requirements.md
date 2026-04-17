# Non-Functional Requirements — SME CRM MVP

## 1. Performance

| Metric                          | Target        | Measurement                              |
|---------------------------------|---------------|------------------------------------------|
| API response time (p95)         | < 200ms       | Server-side, excluding network latency   |
| Dashboard load (p95)            | < 500ms       | Full page render including aggregations  |
| Pipeline kanban render (p95)    | < 300ms       | With up to 200 opportunities             |
| Contact/company list (p95)      | < 200ms       | Paginated, 50 records per page           |
| Search results (p95)            | < 300ms       | Across contacts, companies, opportunities|
| Drag-and-drop stage change      | < 100ms       | Optimistic UI update, async persist      |
| Time to Interactive (TTI)       | < 2s          | First meaningful paint on modern browser |

### Implementation Notes
- Use database indexes on frequently queried columns (email, name, stage, owner, due date).
- Dashboard aggregations use materialized counts or optimized SQL (not N+1 queries).
- Paginate all list views (default 50, max 100 per page).
- Pipeline view loads only open opportunities.

## 2. Security

### Authentication
- Passwords hashed with bcrypt (cost factor 12+).
- Session tokens are HTTP-only, Secure, SameSite=Lax cookies.
- Session expiry: 24 hours of inactivity, absolute maximum 7 days.
- Rate limiting on login: 5 failed attempts per email per 15 minutes, then 15-minute lockout.
- CSRF protection via SameSite cookies and origin header validation.

### Authorization (RBAC)
| Role   | Contacts | Companies | Opportunities | Tasks    | Notes    | Pipeline Config | User Mgmt |
|--------|----------|-----------|---------------|----------|----------|-----------------|-----------|
| Admin  | CRUD all | CRUD all  | CRUD all      | CRUD all | CRUD all | Full            | Full      |
| Member | CRUD all | CRUD all  | CRUD all      | CRUD all | CRUD own | View only       | None      |

- All data is scoped to the organization (tenant). Users cannot access data from other organizations.
- Soft-deleted records are excluded from all queries except admin recovery (post-MVP).

### Data Protection
- All traffic over HTTPS (TLS 1.2+). HTTP redirects to HTTPS.
- Database connections use SSL.
- No sensitive data in URL query parameters.
- Passwords are never logged or returned in API responses.
- Input validation and parameterized queries (Prisma handles this) to prevent SQL injection.
- Output encoding to prevent XSS.

## 3. Scalability

### MVP Targets
| Dimension                   | Target                           |
|-----------------------------|----------------------------------|
| Concurrent users            | 100                              |
| Organizations (tenants)     | 500                              |
| Contacts per organization   | 10,000                           |
| Companies per organization  | 2,000                            |
| Opportunities per org       | 5,000                            |
| Tasks per organization      | 20,000                           |
| Notes per organization      | 50,000                           |

### Design Principles
- Stateless application tier — horizontal scaling via additional instances.
- Database connection pooling (PgBouncer or Prisma connection pool).
- Tenant-scoped queries with indexed `organizationId` foreign key on all tables.
- No file uploads in MVP (avoids blob storage complexity).

## 4. Availability

| Metric             | Target   |
|--------------------|----------|
| Uptime SLA         | 99.5%    |
| Max planned downtime per month | 4 hours (maintenance window) |
| Recovery Time Objective (RTO)  | 1 hour   |
| Recovery Point Objective (RPO) | 1 hour   |

### Implementation Notes
- Deploy on Vercel (frontend) with managed PostgreSQL (e.g., Neon, Supabase, or Railway).
- Database provider handles replication and failover.
- Health check endpoint at `/api/health` returning database connectivity status.
- Graceful degradation: if database is temporarily unavailable, show cached dashboard data with staleness indicator.

## 5. Accessibility

### WCAG 2.1 AA Compliance
- All interactive elements are keyboard-navigable.
- Color contrast ratio minimum 4.5:1 for normal text, 3:1 for large text.
- All images and icons have appropriate alt text or aria-labels.
- Form inputs have associated labels.
- Error messages are announced to screen readers via ARIA live regions.
- Focus management: modals trap focus, dialogs return focus on close.
- Pipeline kanban board is operable via keyboard (arrow keys to move between columns, Enter to grab/drop).

### Testing
- Automated accessibility testing with axe-core in CI.
- Manual screen reader testing (VoiceOver, NVDA) before launch.

## 6. Data Management

### Backup
- Automated daily database backups retained for 30 days.
- Point-in-time recovery within the last 7 days (provided by managed PostgreSQL).
- Backup restoration tested quarterly.

### Export
- Users can export contacts and companies to CSV from list views (P2 feature).
- Admin can request a full data export (all entities) as a ZIP of CSVs (post-MVP).

### Retention
- Soft-deleted records retained for 90 days, then permanently purged.
- Active data retained indefinitely while the account is active.
- Account deletion: all data purged within 30 days of account closure request.

## 7. Observability

| Concern        | Tool / Approach                              |
|----------------|----------------------------------------------|
| Error tracking | Sentry or similar (capture unhandled errors) |
| Logging        | Structured JSON logs (request ID, user ID, org ID) |
| Uptime monitoring | External ping on `/api/health` every 60s  |
| Performance    | Vercel Analytics or custom p95 tracking      |

### Log Levels
- `error`: Unhandled exceptions, database failures, auth failures.
- `warn`: Rate limit triggers, slow queries (> 500ms), deprecated endpoint usage.
- `info`: Sign-in/sign-out events, record creation/deletion.
- `debug`: Query parameters, session validation steps (disabled in production).

## 8. Development and Deployment

| Concern             | Standard                                          |
|---------------------|---------------------------------------------------|
| Code style          | ESLint + Prettier, enforced in CI                  |
| Type safety         | TypeScript strict mode, no `any`                   |
| Testing             | Vitest for unit, Playwright for E2E, > 80% coverage |
| CI pipeline         | Lint, typecheck, test, build on every PR           |
| Deployment          | Vercel preview deploys on PR, production on merge to main |
| Database migrations | Prisma Migrate, reviewed in PR, applied on deploy  |
| Branch strategy     | Trunk-based: short-lived feature branches, squash merge |

## 9. Browser Support

| Browser         | Minimum Version    |
|-----------------|--------------------|
| Chrome          | Last 2 major       |
| Firefox         | Last 2 major       |
| Safari          | Last 2 major       |
| Edge            | Last 2 major       |
| Mobile browsers | Not in MVP scope   |
