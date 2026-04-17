# Non-Functional Requirements

## NFR-01: Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Page load (initial) | < 2 seconds | Lighthouse on 4G throttle |
| Page load (subsequent navigation) | < 500ms | Client-side routing |
| API response time (p95) | < 300ms | Server-side timing middleware |
| API response time (p99) | < 1 second | Server-side timing middleware |
| Database query time | < 100ms per query | Prisma query logging |
| Dashboard render | < 2 seconds | Aggregation queries, no real-time |

### Implementation Notes
- Use Next.js Server Components for initial page loads
- Paginate all list endpoints (default 25 items per page)
- Add database indexes on frequently queried columns (email, name, company_id, stage, due_date)
- Use connection pooling for PostgreSQL (pool size 10-20 for MVP)

---

## NFR-02: Security

### Authentication
- Passwords hashed with bcrypt (cost factor 12)
- JWT-based session tokens with 24-hour expiry
- Refresh tokens with 7-day expiry, stored httpOnly
- Password reset tokens expire after 1 hour
- Minimum password requirements: 8 characters, at least one letter and one number

### Authorization
- Role-based access control: Admin and Member roles
- Admin: full access including pipeline stage management and user management
- Member: CRUD on contacts, companies, opportunities, tasks, notes; can only edit/delete own notes
- All API routes validate JWT and check role before processing

### Data Protection
- All traffic over HTTPS (TLS 1.2+)
- Input validation and sanitization on all user inputs
- Parameterized queries via Prisma (prevents SQL injection)
- CSRF protection via SameSite cookies
- Rate limiting: 100 requests per minute per user for API endpoints
- No sensitive data in URL query parameters

### Headers
- Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security

---

## NFR-03: Reliability

| Metric | Target |
|--------|--------|
| Uptime | 99.5% (allows ~3.6 hours downtime/month) |
| Data durability | No data loss on application crash |
| Recovery time | < 30 minutes from failure detection |

### Implementation Notes
- PostgreSQL with daily automated backups
- Database transactions for multi-table operations (e.g., deleting a company and unlinking contacts)
- Graceful error handling: application errors return structured JSON, never stack traces
- Health check endpoint at `/api/health`

---

## NFR-04: Scalability

### MVP Targets
- 50 concurrent users
- 50,000 contacts
- 10,000 companies
- 20,000 opportunities
- 100,000 notes
- 50,000 tasks

### Implementation Notes
- Stateless application tier (JWT, no server-side sessions) enables horizontal scaling later
- Database connection pooling sized for MVP load
- No caching layer required for MVP; design queries to be efficient at stated data volumes
- Pagination on all list views and API endpoints

---

## NFR-05: Accessibility

### Standard
- WCAG 2.1 Level AA compliance

### Requirements
- All interactive elements are keyboard navigable
- All images and icons have alt text or aria-label
- Color contrast ratio of at least 4.5:1 for normal text, 3:1 for large text
- Form inputs have associated labels
- Error messages are programmatically associated with their fields
- Focus indicators are visible on all interactive elements
- Screen reader compatible: proper heading hierarchy, landmark regions, ARIA attributes where needed
- No content relies solely on color to convey meaning

---

## NFR-06: Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome  | Last 2 major versions |
| Firefox | Last 2 major versions |
| Safari  | Last 2 major versions |
| Edge    | Last 2 major versions |

- No Internet Explorer support
- Responsive design: functional on viewports 1024px and wider (desktop-first for MVP)
- Mobile viewport (< 1024px): readable but not optimized (mobile app is out of scope)

---

## NFR-07: Maintainability

- TypeScript strict mode enabled
- ESLint and Prettier enforced in CI
- Prisma schema as single source of truth for database structure
- Component-based frontend architecture
- API routes organized by resource (contacts, companies, opportunities, tasks, notes)
- Environment configuration via `.env` files (no hardcoded secrets)

---

## NFR-08: Testability

| Test Type | Coverage Target | Tool |
|-----------|----------------|------|
| Unit tests | > 80% of business logic | Vitest or Jest |
| Integration tests | All API endpoints | Vitest or Jest + Supertest |
| E2E tests | Core user flows (login, CRUD, pipeline) | Playwright |

- CI pipeline runs all tests on every pull request
- Database tests use isolated test databases or transactions that roll back
