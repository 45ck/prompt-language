# Product Requirements Document — SME CRM MVP

## 1. Vision

A lightweight, fast CRM purpose-built for small and medium enterprise sales teams (2-20 users). Replace spreadsheets and sticky notes with a single source of truth for contacts, deals, and tasks — without the bloat and cost of enterprise CRM platforms.

## 2. Goals

- **G1**: Enable SME sales teams to track contacts, companies, and opportunities in one place.
- **G2**: Provide a visual pipeline so managers see deal flow at a glance.
- **G3**: Keep task and note management tightly coupled to sales objects.
- **G4**: Deliver a sub-200ms UI so the CRM never feels slower than the spreadsheet it replaces.
- **G5**: Ship an MVP in 8 weeks with a team of 2-3 engineers.

## 3. Target User

SME sales teams of 2-20 people. Typical company size: 5-100 employees, revenue $500K-$20M. Users are non-technical. They need something simpler than Salesforce but more structured than a shared Google Sheet.

## 4. Tech Stack

| Layer       | Choice                  |
|-------------|-------------------------|
| Frontend    | Next.js 14 (App Router) |
| Language    | TypeScript (strict)     |
| Database    | PostgreSQL 15+          |
| ORM         | Prisma                  |
| Auth        | NextAuth.js             |
| Hosting     | Vercel + managed PG     |

## 5. MVP Feature List

### P0 — Must Ship

| ID   | Feature                     | Description                                                        |
|------|-----------------------------|--------------------------------------------------------------------|
| F-01 | Authentication              | Email/password sign-up, sign-in, sign-out, session management      |
| F-02 | Contact management          | CRUD contacts with name, email, phone, company link                |
| F-03 | Company management          | CRUD companies with name, domain, industry, size                   |
| F-04 | Opportunity management      | CRUD opportunities with value, stage, expected close, owner        |
| F-05 | Pipeline view               | Kanban board of opportunities grouped by stage, drag-and-drop      |
| F-06 | Task management             | Create, assign, complete tasks linked to contacts/companies/opps   |
| F-07 | Notes                       | Add timestamped notes to contacts, companies, or opportunities     |
| F-08 | Dashboard                   | Summary cards: open deals, total pipeline value, tasks due, recent |

### P1 — Should Ship

| ID   | Feature                     | Description                                                    |
|------|-----------------------------|----------------------------------------------------------------|
| F-09 | Search                      | Global search across contacts, companies, opportunities        |
| F-10 | Pipeline stage config       | Admin can rename, reorder, add/remove pipeline stages          |
| F-11 | Activity timeline           | Chronological feed of changes on a contact/company/opportunity |
| F-12 | Basic RBAC                  | Admin and Member roles with scoped permissions                 |

### P2 — Nice to Have (post-MVP)

| ID   | Feature                     | Description                                    |
|------|-----------------------------|------------------------------------------------|
| F-13 | Bulk import (CSV)           | Import contacts and companies from CSV         |
| F-14 | Data export                 | Export contacts/opportunities to CSV            |
| F-15 | User invitation flow        | Admin invites users via email link              |

## 6. Out of Scope

The following are explicitly excluded from the MVP and any near-term roadmap discussion:

- **Email integration** (Gmail, Outlook, SMTP send)
- **Calendar sync** (Google Calendar, Outlook)
- **Third-party integrations** (Slack, Zapier, webhooks, API)
- **Reporting / analytics** beyond the dashboard summary cards
- **Mobile app** (native iOS/Android)
- **Marketing automation** (drip campaigns, sequences)
- **Document management** (proposals, contracts, e-signatures)
- **Phone/VoIP integration**
- **Custom fields or custom objects**
- **Multi-currency support**
- **Territory management**
- **Lead scoring or AI features**
- **Workflow automation / triggers**
- **Multi-language / i18n**

## 7. Success Criteria

| Metric                          | Target                              |
|---------------------------------|-------------------------------------|
| Time to first deal created      | < 5 minutes from sign-up           |
| API response time (p95)         | < 200ms (non-dashboard)            |
| Dashboard load (p95)            | < 500ms                            |
| User retention (week 2)         | > 45% of sign-ups return           |
| Data accuracy                   | Dashboard totals match raw queries  |
| Uptime                          | 99.5%                              |
| Test coverage                   | > 80% (unit + integration)         |

## 8. Assumptions and Constraints

- Users have modern browsers (Chrome, Firefox, Safari, Edge — last 2 versions).
- Team size per account will not exceed 20 users in MVP.
- All users are in the same timezone per account (no multi-timezone handling).
- Single pipeline per account in MVP.
- English only.
