# Problem Space — SME CRM

## The Problem

Small and medium enterprises (5–50 employees) managing sales pipelines rely on spreadsheets, email threads, or enterprise CRM tools that are overbuilt for their needs. This creates three core problems:

1. **Data fragmentation** — Contact details, deal status, and task ownership live across spreadsheets, email, and chat. No single source of truth exists.
2. **Pipeline opacity** — Sales managers cannot see pipeline value, stage distribution, or deal velocity without manual aggregation.
3. **Tool overfit** — Enterprise CRMs (Salesforce, Dynamics) impose configuration overhead, per-seat costs, and feature bloat that SME teams neither need nor use.

## Who Feels the Pain

| Role | Pain Point |
|------|-----------|
| Sales rep | Wastes 30–60 min/day updating spreadsheets and searching email for contact context |
| Sales manager | Cannot forecast revenue or identify stalled deals without manual data pulls |
| Admin/Owner | Pays for enterprise seats (£50–150/user/mo) while the team uses <10% of features |

## Why Now

- Remote/hybrid work increased reliance on digital deal tracking (post-2020 shift is permanent).
- Postgres-based managed databases (Neon, Supabase) reduced infrastructure cost to near-zero for small deployments.
- Next.js App Router + Server Components enable full-stack apps with minimal architecture overhead.

## Constraints on the Solution

- Must be deployable by a non-technical admin (Vercel + managed Postgres).
- Must reach useful state within 15 minutes of first sign-up (invite team, import contacts, see pipeline).
- Must not require a dedicated administrator for day-to-day use.
- MVP scope is fixed: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard. No feature creep.

## What Success Looks Like

A sales team of 10 people replaces their shared Google Sheet with the CRM, can see their pipeline in a dashboard, and completes their daily workflow (log calls, move deals, assign tasks) without leaving the app.
