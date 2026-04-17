# Non-Functional Requirements

## 1. Performance

| Metric                         | Target            | Measurement Method                    |
| ------------------------------ | ----------------- | ------------------------------------- |
| Initial page load (cold)       | < 3 seconds       | Lighthouse on 4G throttle             |
| Subsequent page navigation     | < 1 second        | Client-side routing, no full reload   |
| API response (CRUD operations) | < 500 ms (p95)    | Server-side timing middleware         |
| API response (dashboard)       | < 1 second (p95)  | Aggregation queries, measured at API  |
| Search (contacts/companies)    | < 300 ms (p95)    | Debounced input, indexed columns      |
| Kanban drag-and-drop update    | < 200 ms          | Optimistic UI update + async persist  |

### Database Performance

- Indexes on: `contacts.email`, `contacts.last_name`, `companies.name`, `opportunities.stage_id`, `tasks.assignee_id`, `tasks.due_date`, `notes.entity_id`.
- Pagination: All list endpoints return paginated results (default 25, max 100 per page).
- No N+1 queries: Use Prisma `include` or explicit joins for related data.

## 2. Security

### Authentication

- Passwords hashed with bcrypt (cost factor >= 12).
- JWT access tokens with 15-minute expiry.
- Refresh tokens stored in HTTP-only, Secure, SameSite=Strict cookies.
- Rate limiting on login: max 10 attempts per IP per 5-minute window.
- OAuth 2.0 (Authorization Code flow) for Google login.

### Authorization

- Role-Based Access Control (RBAC) with three roles:

| Permission              | Admin | Manager | Rep   |
| ----------------------- | :---: | :-----: | :---: |
| Manage users            | Yes   | No      | No    |
| Configure pipeline      | Yes   | No      | No    |
| View all entities       | Yes   | Yes     | Own   |
| Edit all entities       | Yes   | Yes*    | Own   |
| Delete entities         | Yes   | No      | No    |
| Delete any note         | Yes   | No      | No    |

*Managers can edit entities owned by reps they manage.

- Authorization checks enforced server-side on every API route. Client-side checks are for UX only.

### Input Validation

- All user input validated server-side with Zod schemas.
- Client-side validation mirrors server-side for UX responsiveness.
- SQL injection prevented by Prisma parameterized queries (no raw SQL in MVP).
- XSS prevented by React's default escaping plus Content-Security-Policy headers.

### OWASP Top 10 Mitigations

| Risk                           | Mitigation                                          |
| ------------------------------ | --------------------------------------------------- |
| A01 Broken Access Control      | RBAC enforced server-side on all routes              |
| A02 Cryptographic Failures     | bcrypt passwords, HTTPS-only, no secrets in client   |
| A03 Injection                  | Prisma parameterized queries, Zod input validation   |
| A04 Insecure Design            | Principle of least privilege, soft deletes            |
| A05 Security Misconfiguration  | Secure headers (CSP, HSTS, X-Frame-Options)          |
| A06 Vulnerable Components      | npm audit in CI, Dependabot alerts                   |
| A07 Auth Failures              | Rate limiting, JWT expiry, secure cookie storage     |
| A08 Data Integrity Failures    | Server-side validation, no client-trusted decisions  |
| A09 Logging Failures           | Structured auth/error logs, no sensitive data logged |
| A10 SSRF                       | No user-controlled outbound requests in MVP          |

### Data Protection

- All traffic over HTTPS (TLS 1.2+).
- Database connections use SSL in production.
- Soft deletes for contacts, companies, opportunities (data recovery capability).
- No PII logged (emails, names, phone numbers excluded from application logs).

## 3. Scalability

### MVP Targets

| Dimension            | Target                         |
| -------------------- | ------------------------------ |
| Concurrent users     | 50                             |
| Total user accounts  | 200                            |
| Total contacts       | 50,000                         |
| Total companies      | 10,000                         |
| Total opportunities  | 20,000                         |
| Total tasks          | 100,000                        |
| Total notes          | 500,000                        |

### Design for Growth

- Stateless API layer (horizontally scalable behind a load balancer if needed).
- Database connection pooling via Prisma (pool size configurable).
- No in-memory session state on the server (JWT-based).
- Pagination on all list endpoints to bound response size.

## 4. Reliability

| Metric                | Target                              |
| --------------------- | ----------------------------------- |
| Uptime                | 99.5% (monthly, excluding planned maintenance) |
| Recovery Time (RTO)   | < 1 hour                            |
| Recovery Point (RPO)  | < 1 hour (database backups)         |
| Error rate            | < 1% of API requests return 5xx     |

- Graceful error handling: API returns structured error responses (never raw stack traces).
- Database backups: automated daily with point-in-time recovery enabled.
- Health check endpoint: `GET /api/health` returns 200 with DB connectivity status.

## 5. Accessibility

### WCAG 2.1 Level AA Compliance

- All interactive elements keyboard-navigable.
- Focus indicators visible on all focusable elements.
- Color contrast ratios meet AA minimums (4.5:1 for normal text, 3:1 for large text).
- Form fields have associated labels (no placeholder-only labels).
- Error messages announced to screen readers via ARIA live regions.
- Drag-and-drop (Kanban, stage reorder) has keyboard-accessible alternative (move via dropdown/buttons).
- Page structure uses semantic HTML (headings hierarchy, landmarks, lists).
- Images and icons have alt text or aria-label.

### Testing

- Automated: axe-core in integration tests.
- Manual: keyboard-only navigation test for all core flows.

## 6. Browser Support

| Browser              | Minimum Version |
| -------------------- | --------------- |
| Chrome               | Last 2 major    |
| Firefox              | Last 2 major    |
| Safari               | Last 2 major    |
| Edge                 | Last 2 major    |

- No IE11 support.
- Responsive design: functional on viewports >= 375px wide (mobile phones).
- Optimized layout at >= 1024px (desktop).
- Touch-friendly tap targets (>= 44x44 CSS pixels) for mobile.

## 7. Maintainability

- TypeScript strict mode enabled.
- ESLint + Prettier enforced in CI.
- Prisma migrations for all schema changes (no manual SQL).
- Component-level unit tests with React Testing Library.
- API route tests with supertest or similar.
- Minimum 80% code coverage for business logic.

## 8. Deployment

- Single `docker-compose.yml` bringing up the Next.js app and PostgreSQL.
- Environment configuration via `.env` file (12-factor).
- Zero-downtime deploys via container replacement.
- Seed script for default pipeline stages and initial admin account.

## 9. Observability

- Structured JSON logging (request ID, user ID, action, duration).
- API request/response logging (no PII in logs).
- Error tracking integration-ready (Sentry-compatible error boundaries).
- Health endpoint for uptime monitoring.
