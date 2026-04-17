# Non-Functional Requirements — SME CRM MVP

## Performance

| Requirement | Target |
|-------------|--------|
| Page load (P95) | < 2 seconds |
| Pipeline board render (50 opportunities) | < 1 second |
| Dashboard data aggregation | < 500ms |
| CSV import (1000 rows) | < 10 seconds |
| API response (CRUD operations) | < 300ms |
| Concurrent users supported | 50 |

## Security

| Requirement | Implementation |
|-------------|---------------|
| Password hashing | bcrypt with cost factor 12 |
| Session management | NextAuth.js JWT sessions, 24h expiry |
| CSRF protection | NextAuth.js built-in CSRF tokens |
| Rate limiting | Login endpoint: 5 attempts per minute per IP |
| Input validation | Zod schemas on all Server Actions |
| SQL injection prevention | Prisma parameterized queries (no raw SQL in MVP) |
| XSS prevention | React default escaping + no dangerouslySetInnerHTML |
| HTTPS | Enforced by Vercel deployment |

## Data & Privacy (GDPR-aware)

| Requirement | Implementation |
|-------------|---------------|
| Soft deletes | Contacts and companies use `deletedAt` timestamp |
| Data export | JSON export endpoint for all org data |
| Right to deletion | Hard delete after 30-day soft delete retention |
| Audit trail | `createdBy`, `createdAt` on all entities |
| Data isolation | All queries filtered by `orgId` |

## Reliability

| Requirement | Target |
|-------------|--------|
| Uptime | 99.5% (Vercel + managed Postgres SLA) |
| Data backup | Managed Postgres daily backups (provider SLA) |
| Error handling | User-facing errors show friendly message. Errors logged server-side. |
| Graceful degradation | If dashboard aggregation fails, show error message |

## Usability

| Requirement | Target |
|-------------|--------|
| Time to first value | < 15 minutes (sign up → import → pipeline view) |
| Mobile responsiveness | All pages usable on 375px+ viewport |
| Keyboard navigation | Tab-navigable forms, Enter to submit |
| Loading states | Skeleton screens on data-heavy pages |

## Deployment & Operations

| Requirement | Implementation |
|-------------|---------------|
| Deployment | Vercel (zero-config Next.js) |
| Database | Managed PostgreSQL (Neon or Supabase) |
| Environment config | Environment variables only (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL) |
| Migrations | Prisma Migrate with explicit migration files in version control |
| Monitoring | Vercel built-in analytics + error reporting |

## Scalability Boundaries (MVP)

- Designed for single organization with up to 50 users
- Up to 100k contacts, 10k opportunities
- No horizontal scaling required for MVP
- Connection pooling via Prisma for database efficiency
