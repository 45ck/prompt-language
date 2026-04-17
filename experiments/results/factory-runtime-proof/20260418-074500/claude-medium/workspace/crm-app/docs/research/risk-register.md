# Risk Register — SME CRM MVP

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R1 | Scope creep beyond MVP entities | High | High | Hard scope boundary in PRD. Every feature request evaluated against 8 entity types only. |
| R2 | Prisma schema migrations break prod data | Medium | High | Use Prisma Migrate with explicit migration files. Test migrations against seeded data in CI. |
| R3 | Auth vulnerabilities (credential stuffing, session hijack) | Medium | High | NextAuth.js handles session management. Rate limit login endpoint. bcrypt password hashing. CSRF tokens on all mutations. |
| R4 | Pipeline drag-and-drop performance with >500 opportunities | Medium | Medium | Paginate pipeline stages (20 deals per stage visible). Virtual scrolling if needed post-MVP. |
| R5 | CSV import fails on malformed data | High | Low | Validate CSV headers before import. Skip bad rows with error report. Limit import to 10k rows in MVP. |
| R6 | Managed Postgres connection limits (Neon free tier: 100) | Medium | Medium | Use Prisma connection pooling. Monitor active connections. Document minimum tier requirements. |
| R7 | Vercel serverless cold starts degrade UX | Low | Medium | Use Next.js App Router with streaming. Critical paths use edge runtime where possible. |
| R8 | GDPR compliance gaps (right to deletion, data export) | Medium | High | Soft delete with 30-day purge. Implement data export endpoint (JSON). Document processing basis in privacy policy. |
| R9 | Single-tenant model limits scaling to multi-org | Low | Low | MVP is single-org by design. Multi-tenancy is out of scope — do not pre-optimize. |
| R10 | Team adoption failure (users revert to spreadsheets) | Medium | High | <15 min setup. CSV import on day 1. Pipeline view as landing page. Minimize data entry friction. |
