# Risk Register

## Overview

This document catalogs technical, market, and operational risks for the CRM MVP. Each risk is rated by likelihood (L) and impact (I) on a 1-5 scale, with a composite score (L x I). Mitigation strategies are specific and actionable.

## Risk Summary

| ID | Category | Risk | L | I | Score | Priority |
|---|---|---|---|---|---|---|
| T1 | Technical | Prisma migration failures in production | 3 | 4 | 12 | High |
| T2 | Technical | Next.js SSR/RSC complexity | 3 | 3 | 9 | Medium |
| T3 | Technical | Auth implementation vulnerabilities | 2 | 5 | 10 | High |
| T4 | Technical | PostgreSQL performance at scale | 2 | 3 | 6 | Low |
| T5 | Technical | State management complexity | 3 | 3 | 9 | Medium |
| T6 | Technical | Data model rigidity | 3 | 4 | 12 | High |
| M1 | Market | Crowded CRM market | 4 | 3 | 12 | High |
| M2 | Market | Low switching costs | 4 | 3 | 12 | High |
| M3 | Market | Free tier expectations | 3 | 3 | 9 | Medium |
| M4 | Market | Enterprise CRM price drops | 2 | 4 | 8 | Medium |
| O1 | Operational | Scope creep | 4 | 4 | 16 | Critical |
| O2 | Operational | Small team capacity | 3 | 4 | 12 | High |
| O3 | Operational | Self-hosting support burden | 3 | 3 | 9 | Medium |
| O4 | Operational | Data migration complexity | 3 | 3 | 9 | Medium |

## Technical Risks

### T1: Prisma Migration Failures in Production

**Risk**: Prisma migrations that work in development fail or cause downtime in production. Schema changes on tables with existing data (adding non-nullable columns, renaming fields, changing relations) can lock tables or fail entirely.

**Likelihood**: 3/5 -- common issue as schema evolves post-launch.

**Impact**: 4/5 -- failed migration can leave database in inconsistent state, blocking all users.

**Mitigation**:
- Always use `prisma migrate dev` locally and `prisma migrate deploy` in production (never `db push` in prod)
- Add non-nullable columns in two steps: add as nullable, backfill data, then alter to non-nullable
- Test every migration against a production-size dataset before deploying
- Maintain a rollback migration for each forward migration
- Use a staging environment with a copy of production data for migration testing
- Set `lock_timeout` on PostgreSQL to prevent long-running migration locks

### T2: Next.js SSR/RSC Complexity

**Risk**: React Server Components and the App Router introduce complexity around server/client boundaries. Mixing server and client components incorrectly causes hydration mismatches, unexpected re-renders, or serialization errors.

**Likelihood**: 3/5 -- the RSC model is still maturing and documentation has gaps.

**Impact**: 3/5 -- manifests as bugs that are hard to diagnose, slowing development velocity.

**Mitigation**:
- Establish clear conventions: pages and layouts are Server Components; interactive UI uses `"use client"` directive
- Keep data fetching in Server Components, pass serializable props to Client Components
- Use server actions for mutations instead of API routes where possible
- Add `"use client"` boundary components that isolate interactive sections
- Test SSR output with `next build` regularly, not just `next dev` (dev mode masks hydration issues)

### T3: Auth Implementation Vulnerabilities

**Risk**: Custom auth implementation has security flaws -- session fixation, CSRF, insecure token storage, or missing rate limiting on login endpoints.

**Likelihood**: 2/5 -- using a well-tested auth library reduces this significantly.

**Impact**: 5/5 -- auth breach exposes all customer data.

**Mitigation**:
- Use NextAuth.js (Auth.js) instead of rolling custom auth
- Enable CSRF protection (built into NextAuth)
- Store sessions in the database (Prisma adapter), not JWTs in localStorage
- Add rate limiting on login/register endpoints (e.g., `@upstash/ratelimit` or express-rate-limit)
- Enforce password hashing with bcrypt (cost factor >= 12)
- Add security headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`
- Conduct a focused security review before public launch

### T4: PostgreSQL Performance at Scale

**Risk**: Queries become slow as contact/opportunity tables grow beyond 100K rows. Missing indexes, N+1 queries from Prisma's relation loading, or full-text search on notes cause degradation.

**Likelihood**: 2/5 -- unlikely at MVP scale (most SMEs have < 10K contacts).

**Impact**: 3/5 -- slow UI degrades experience but does not cause data loss.

**Mitigation**:
- Add indexes on all foreign keys and commonly filtered columns (status, stage, assignee, created_at)
- Use Prisma's `include` and `select` deliberately to avoid loading unnecessary relations
- Add `EXPLAIN ANALYZE` checks for dashboard queries during development
- Set up basic query performance monitoring (pg_stat_statements)
- Defer full-text search to post-MVP; use simple `ILIKE` for MVP contact search
- Set connection pooling (PgBouncer or Prisma's built-in connection pool) from day one

### T5: State Management Complexity

**Risk**: Managing form state, optimistic updates, cache invalidation, and server state across contacts, companies, opportunities, tasks, and notes becomes unwieldy. Stale data on the dashboard after a pipeline stage change, for example.

**Likelihood**: 3/5 -- increases with each entity type added.

**Impact**: 3/5 -- causes confusing UI behavior and data inconsistencies.

**Mitigation**:
- Use React Server Components for read-heavy pages (dashboard, lists) -- eliminates client-side cache issues
- Use server actions with `revalidatePath()` for mutations
- For interactive features (drag-and-drop pipeline), use a minimal client state library (Zustand or React context)
- Avoid caching strategies until proven necessary -- server-rendered pages with fresh data are simpler
- Keep forms simple with React Hook Form; avoid complex multi-step wizards in MVP

### T6: Data Model Rigidity

**Risk**: The initial Prisma schema does not accommodate future needs -- custom fields, multiple pipelines, or team hierarchies. Schema changes post-launch disrupt existing users.

**Likelihood**: 3/5 -- nearly certain that the first schema will need evolution.

**Impact**: 4/5 -- migration pain scales with user count.

**Mitigation**:
- Design the initial schema with known extension points: a JSONB `metadata` column on contacts, companies, and opportunities for future custom fields
- Use UUIDs for primary keys (easier for distributed systems later)
- Keep pipeline stages as a separate table (not an enum) so users can customize
- Add `created_at`, `updated_at`, `deleted_at` (soft delete) from day one
- Document schema decisions and constraints in a schema changelog

## Market Risks

### M1: Crowded CRM Market

**Risk**: The CRM market has hundreds of products. Launching yet another CRM gets lost in noise, regardless of quality.

**Likelihood**: 4/5 -- the market is objectively crowded.

**Impact**: 3/5 -- affects growth rate but does not prevent building a useful product.

**Mitigation**:
- Position specifically as "CRM for small sales teams" -- not "CRM for everyone"
- Focus distribution on developer communities (self-hosted, open-source angle)
- Prioritize word-of-mouth by making the product genuinely pleasant to use
- Write content targeting specific pain points: "Moving from spreadsheets to a CRM" rather than generic CRM marketing
- Consider vertical specialization post-MVP (CRM for agencies, CRM for recruiters)

### M2: Low Switching Costs

**Risk**: Users can easily switch between CRMs. CSV export/import is standard. Retention depends entirely on ongoing value, not lock-in.

**Likelihood**: 4/5 -- switching costs in CRM are structurally low.

**Impact**: 3/5 -- churn risk is high but also means easy acquisition from competitors.

**Mitigation**:
- Make onboarding frictionless (under 5 minutes to first value)
- Build data import from CSV and common CRM exports early (post-MVP priority)
- Create value through accumulated data: activity history, notes, and task completion patterns become more valuable over time
- Make export easy and transparent -- paradoxically, easy export increases trust and reduces churn anxiety

### M3: Free Tier Expectations

**Risk**: SME users expect a generous free tier (set by HubSpot). A product without one may not get initial traction.

**Likelihood**: 3/5 -- depends on distribution channel (developers vs. sales teams).

**Impact**: 3/5 -- blocks acquisition funnel if pricing is the first barrier.

**Mitigation**:
- Self-hosted version is inherently free (open-source)
- If offering managed hosting, provide a free tier for up to 3 users
- Focus MVP on the self-hosted use case; managed hosting is a post-MVP monetization path

### M4: Enterprise CRM Price Drops

**Risk**: Salesforce, HubSpot, or Pipedrive aggressively lower pricing for SME tiers, eliminating the cost advantage.

**Likelihood**: 2/5 -- enterprise vendors rarely cannibalize their own pricing.

**Impact**: 4/5 -- removes a key differentiator.

**Mitigation**:
- Do not compete on price alone; compete on simplicity, focus, and self-hosting
- Open-source model means the product is always free to self-host regardless of competitor pricing
- Build community and ecosystem value that transcends pricing competition

## Operational Risks

### O1: Scope Creep (Critical)

**Risk**: Requests for email integration, workflow automation, custom fields, reporting, mobile app, and API push the MVP timeline from weeks to months. Each "small" addition compounds complexity.

**Likelihood**: 4/5 -- scope creep is the default state of product development.

**Impact**: 4/5 -- delays launch, increases bug surface, dilutes focus.

**Mitigation**:
- Define the MVP boundary explicitly: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard. Nothing else ships in V1.
- Maintain a "post-MVP" backlog that captures requests without acting on them
- Every feature request must answer: "Does this block a user from tracking contacts, managing deals, or viewing their pipeline?" If no, it is post-MVP.
- Set a hard deadline for MVP launch and cut scope to meet it, never extend the deadline
- Review the scope boundary weekly

### O2: Small Team Capacity

**Risk**: A small development team (1-3 people) cannot simultaneously build features, fix bugs, handle support, and maintain infrastructure.

**Likelihood**: 3/5 -- directly proportional to team size.

**Impact**: 4/5 -- burnout, quality degradation, or stalled progress.

**Mitigation**:
- Leverage the Next.js + Prisma stack for maximum productivity (fewer infrastructure decisions)
- Use managed PostgreSQL (Neon, Supabase, or Railway) to eliminate database ops burden
- Automate CI/CD from day one (Vercel deployment, GitHub Actions for tests)
- Limit support channels to one (GitHub Issues for self-hosted; email for managed)
- Defer documentation beyond README and inline help until post-MVP

### O3: Self-Hosting Support Burden

**Risk**: Self-hosted users encounter environment-specific issues (Docker versions, PostgreSQL compatibility, reverse proxy configuration) and expect support.

**Likelihood**: 3/5 -- common for open-source products.

**Impact**: 3/5 -- drains development time without generating revenue.

**Mitigation**:
- Provide a single official deployment path: Docker Compose with PostgreSQL
- Pin specific versions of Node.js, PostgreSQL, and Prisma in the Docker image
- Include a health check endpoint that validates database connectivity and schema version
- Create a troubleshooting FAQ based on early adopter issues
- Set expectations clearly: self-hosted = community support; paid hosting = official support

### O4: Data Migration Complexity

**Risk**: Users wanting to move from spreadsheets or other CRMs cannot easily import their data. Manual entry of 500+ contacts is a non-starter.

**Likelihood**: 3/5 -- every user has existing data somewhere.

**Impact**: 3/5 -- blocks adoption for teams with established contact databases.

**Mitigation**:
- Build CSV import for contacts and companies as a P2 priority (simple column mapping UI)
- Defer CRM-specific import (Salesforce, HubSpot export formats) to post-MVP
- Provide a CSV template that users can populate
- Validate imported data before committing (show preview, flag duplicates)

## Risk Review Schedule

Review this register at the end of each development sprint. Update likelihood and impact scores based on new information. Add new risks as they emerge. Close risks that are fully mitigated or no longer relevant.
