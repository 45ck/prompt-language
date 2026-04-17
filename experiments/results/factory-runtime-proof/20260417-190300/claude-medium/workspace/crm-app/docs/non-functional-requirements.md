# Non-Functional Requirements

## NFR-01: Performance

| Metric | Target |
|---|---|
| Page load (initial, cold) | Under 3 seconds on standard broadband |
| Page navigation (client-side) | Under 500ms |
| API response (single record CRUD) | Under 200ms at p95 |
| API response (list with search, up to 10,000 records) | Under 500ms at p95 |
| Dashboard aggregation queries | Under 1 second at p95 |
| Kanban drag-and-drop stage update | Under 300ms perceived latency |

### Database
- Indexes on all foreign key columns and commonly searched fields (contact name, email, company name).
- Pagination on all list endpoints (default 25 records per page).

---

## NFR-02: Security

### Authentication
- Passwords hashed with bcrypt (minimum cost factor 10).
- Session tokens are HttpOnly, Secure, SameSite=Strict cookies.
- Password reset tokens expire after 1 hour and are single-use.
- Minimum password length: 8 characters.

### Authorization
- Role-based access: admin and member.
- Members can CRUD contacts, companies, opportunities, and tasks (CRM data is shared across the team).
- Only admins can rename pipeline stages and manage user roles.
- Users can only edit or delete their own notes.

### Data Protection
- All traffic over HTTPS in production.
- SQL injection prevented by Prisma parameterized queries (no raw SQL in MVP).
- XSS prevention via React's default escaping and Content-Security-Policy headers.
- CSRF protection via SameSite cookies and framework defaults.
- No sensitive data (passwords, tokens) in API responses or client logs.

### Dependencies
- Zero known critical or high-severity vulnerabilities in production dependencies (`npm audit`).

---

## NFR-03: Scalability

MVP targets are modest and intentional for small-to-medium teams.

| Dimension | Target |
|---|---|
| Concurrent users | 20 without degradation |
| Total users per instance | Up to 50 |
| Total contacts | Up to 50,000 |
| Total opportunities | Up to 10,000 |
| Database size | Under 1 GB |

- Single PostgreSQL instance is sufficient for MVP.
- Stateless application server (Next.js) allows horizontal scaling later if needed.
- No caching layer required for MVP.

---

## NFR-04: Accessibility

- WCAG 2.1 Level AA compliance for all interactive elements.
- All form inputs have associated labels.
- Keyboard navigation for all primary workflows (including a keyboard alternative for pipeline drag-and-drop).
- Color is not the sole means of conveying information.
- Minimum contrast ratio of 4.5:1 for normal text, 3:1 for large text.
- Screen reader compatible: semantic HTML, ARIA attributes where needed.

---

## NFR-05: Reliability

| Metric | Target |
|---|---|
| Uptime | 99% monthly (~7 hours downtime/month) |
| Data durability | Daily automated PostgreSQL backups, 7-day retention |
| Error handling | All API errors return structured JSON with appropriate HTTP status codes |
| Graceful degradation | Dashboard shows error messages on query failure, not blank screens |

- Soft-delete for contacts, companies, and opportunities.
- Database migrations managed through Prisma Migrate with version control.
- Application logs structured (JSON) to stdout for container compatibility.

---

## NFR-06: Maintainability

- TypeScript strict mode enabled across the entire codebase.
- ESLint and Prettier enforced in CI.
- Prisma schema is the single source of truth for the database schema.
- All API routes covered by integration tests.
- Component tests for key UI interactions (pipeline drag-and-drop, form validation).
- Test coverage target: 80% line coverage for API routes and business logic.

---

## NFR-07: Browser Support

- **Browsers:** Latest two major versions of Chrome, Firefox, Safari, and Edge.
- **Viewport:** Responsive design from 360px (mobile) to 1920px (desktop). Pipeline Kanban board scrolls horizontally on narrow viewports.
- **Screen sizes:** Usable on tablet and desktop. Mobile is functional but not optimized for MVP.

---

## NFR-08: Deployment

- Deployable as a Docker container or to Vercel / similar platform.
- Environment configuration via environment variables (DATABASE_URL, SESSION_SECRET, SMTP settings).
- Database migrations run automatically on deploy via Prisma Migrate.
- Build time under 2 minutes.
- Zero-downtime deploys not required for MVP but the architecture should not prevent them.
