# Non-Functional Requirements

## 1. Performance

| Metric | Target | Measurement |
|---|---|---|
| Page load (initial, p95) | < 2 seconds | Lighthouse or WebPageTest on production build |
| Page navigation (client-side, p95) | < 500 milliseconds | Browser performance API |
| API response time (p95) | < 500 milliseconds | Server-side request logging |
| Database query time (p95) | < 200 milliseconds | Prisma query logging |
| Pipeline board render (50 opportunities) | < 1 second | Manual profiling with React DevTools |
| Search/filter response | < 300 milliseconds | Server-side request logging |

All measurements taken under MVP load conditions (10 concurrent users, 1000 contacts).

## 2. Security

**Authentication**
- Passwords hashed with bcrypt (minimum 10 rounds).
- Session tokens stored in HTTP-only, Secure, SameSite=Strict cookies.
- Sessions expire after 24 hours of inactivity.
- Login rate limiting: maximum 10 attempts per email per 15-minute window.

**Authorization**
- Role-based access control enforced server-side on every API route.
- Three roles: Admin, Manager, Rep.
- Admin: full access including user management and pipeline stage configuration.
- Manager: full CRUD on all entities; read access to all users' data.
- Rep: full CRUD on own data; read access to shared entities (contacts, companies).
- Note edit/delete restricted to the authoring user (all roles).

**Input Validation**
- All user input validated server-side using Zod schemas.
- Client-side validation for immediate feedback only; never trusted.
- SQL injection prevented by Prisma parameterized queries (no raw SQL).
- XSS prevented by React's default output escaping; no `dangerouslySetInnerHTML`.

**Data Protection**
- HTTPS required for all traffic in production.
- Database credentials stored in environment variables, never committed to source.
- No sensitive data (passwords, tokens) returned in API responses.

## 3. Scalability (MVP Targets)

| Dimension | MVP Target |
|---|---|
| Contacts | 1,000 records |
| Companies | 200 records |
| Opportunities | 500 records |
| Tasks | 2,000 records |
| Notes | 5,000 records |
| Concurrent users | 10 |
| Registered users | 25 |

These are validation targets, not hard limits. The schema and queries must perform within the stated performance targets at these volumes. Scaling beyond these numbers is a post-MVP concern.

**Database**
- Indexes on foreign keys and commonly queried fields (email, name, stage, status, due date).
- Pagination on all list endpoints (default 25, max 100 per page).
- No N+1 queries; use Prisma `include` for related data on detail pages.

## 4. Accessibility

Target: WCAG 2.1 Level AA compliance.

- All interactive elements reachable and operable via keyboard.
- Focus indicators visible on all focusable elements.
- Color contrast ratios meet AA minimums (4.5:1 for normal text, 3:1 for large text).
- Form fields have associated labels. Error messages linked to fields via `aria-describedby`.
- Drag-and-drop pipeline board has a keyboard-accessible alternative (dropdown stage selector).
- Page structure uses semantic HTML (headings, landmarks, lists).
- Images and icons have appropriate alt text or `aria-label`.
- No information conveyed by color alone.

## 5. Reliability

| Metric | Target |
|---|---|
| Uptime | 99.5% (measured monthly) |
| Data loss tolerance | Zero (PostgreSQL with WAL) |
| Recovery time objective (RTO) | < 1 hour |
| Recovery point objective (RPO) | < 5 minutes (WAL archiving) |
| Error rate (5xx responses) | < 0.1% of requests |

**Error Handling**
- Unhandled exceptions caught by a global error boundary; user sees a friendly error page.
- API errors return structured JSON with status code and message; no stack traces in production.
- Database connection failures trigger automatic retry (3 attempts, exponential backoff).

## 6. Maintainability

- TypeScript strict mode enabled; no `any` types except in third-party type gaps.
- ESLint and Prettier enforced in CI.
- Prisma schema is the single source of truth for database structure.
- Environment configuration via `.env` files with a documented `.env.example`.
- Application logs to stdout in structured JSON format for production.

## 7. Browser Support

Last two major versions of:
- Chrome
- Firefox
- Safari
- Edge

No Internet Explorer support. Mobile browsers supported via responsive design (no native app).
