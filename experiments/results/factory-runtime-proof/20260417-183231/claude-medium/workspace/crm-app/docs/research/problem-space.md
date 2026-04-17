# Problem Space: SME Sales & Service Customer Management

## Executive Summary

Small-to-medium enterprise (SME) sales and service teams of 3-25 people consistently struggle with fragmented customer data, invisible pipelines, and manual coordination. This document defines the core problems the CRM MVP addresses and why existing market solutions fail this segment.

## Target Audience

- **Team size:** 3-25 people across sales and customer service
- **Revenue range:** $500K-$20M annual
- **Industry:** B2B services, SaaS, consulting, professional services, agencies
- **Tech maturity:** Comfortable with web apps but no dedicated IT staff or CRM admin

## The Core Problem

SME sales and service teams manage customer relationships using a patchwork of spreadsheets, email threads, shared drives, and memory. As the team grows past 3-5 people, this approach breaks down in predictable ways:

1. **No single source of truth** for customer data
2. **Pipeline stages exist only in people's heads** or in a spreadsheet that drifts out of date
3. **Follow-ups are forgotten** because they depend on individual memory or calendar reminders
4. **Handoffs between team members lose context** because notes live in personal email or local files

The result: lost deals, duplicated outreach, inconsistent customer experience, and management with zero visibility into what the team is actually doing.

## Pain Points in Detail

### 1. Scattered Customer Data

**Symptom:** Contact information, conversation history, and deal status live across 4-7 different tools (email, spreadsheets, phone notes, Slack messages, shared docs).

**Impact:**
- Reps spend 15-25 minutes per day searching for customer context before calls
- Duplicate outreach to the same contact from different reps
- Stale phone numbers and email addresses because no single record gets updated
- When a rep leaves, their customer knowledge leaves with them

**What teams actually do today:**
- Google Sheets with columns for name, email, phone, status, last contact date
- A shared Google Drive folder with one doc per major account
- Slack channels per deal or per client (searchable but unstructured)
- Individual email folders and contact lists

### 2. No Pipeline Visibility

**Symptom:** Management cannot answer "how many deals are in proposal stage?" or "what is our expected revenue for next quarter?" without asking each rep individually.

**Impact:**
- Revenue forecasting is guesswork
- Bottlenecks in specific stages go undetected for weeks
- No way to identify which deals are stalled
- Resource allocation (who needs help, who has capacity) is reactive

**What teams actually do today:**
- A spreadsheet with columns for stage, probability, expected close date
- Updated weekly in a team meeting (already stale by Tuesday)
- Manager asks each rep for updates via Slack or standup
- Monthly "pipeline review" meetings where spreadsheet gets bulk-updated

### 3. Manual Follow-Up Tracking

**Symptom:** Next actions after calls, demos, or emails are tracked via personal to-do lists, calendar events, or memory. When workload spikes, follow-ups slip.

**Impact:**
- 20-30% of qualified leads go cold due to missed follow-ups (industry surveys)
- Average follow-up delay of 3-5 days instead of 24-48 hours
- No team-level view of overdue tasks
- Reps carry cognitive load of remembering every pending action

**What teams actually do today:**
- Calendar reminders ("Call back John re: proposal")
- Sticky notes or personal to-do apps (Todoist, Apple Reminders)
- Email "snooze" or "star" features
- Spreadsheet column for "next step" that rarely gets updated

### 4. No Shared Context

**Symptom:** When a customer calls in, the person who answers has no quick way to see the full history: who spoke to them last, what was discussed, what is pending, what has been promised.

**Impact:**
- Customer repeats their situation to every new person
- Contradictory promises from different team members
- Service issues escalate because the history is invisible
- New hires take months to get context on existing accounts

**What teams actually do today:**
- Ask the previous rep via Slack before calling back
- Check email threads (if they were CC'd)
- Rely on the customer to re-explain
- Keep a running Google Doc per account (only the primary rep updates it)

## Why Existing CRM Tools Fail SME Teams

### Salesforce

- **Pricing:** $25-$300/user/month; realistic cost for a 10-person team with needed features is $75-$150/user/month ($9K-$18K/year)
- **Complexity:** Requires a dedicated admin for configuration; 200+ settings screens
- **Setup time:** 2-6 months for a proper implementation; SME teams need value in days
- **Overhead:** Data entry burden is so high that reps resist using it; adoption rates below 50% are common in SME deployments
- **Mismatch:** Built for enterprises with 50+ person sales orgs, multiple business units, and complex approval workflows. SME teams use 10% of features and pay for 100%.

### HubSpot (Free/Starter)

- **Free tier limitations:** Contact limits (1,000 marketing contacts), limited reporting, HubSpot branding on forms/emails
- **Upgrade pressure:** Useful features (sequences, automation, custom reports) locked behind $45-$800/month tiers
- **Scope creep:** HubSpot is a marketing platform first; CRM is a wedge to sell marketing automation. SME sales teams get pulled into marketing features they do not need.
- **Data ownership:** Customer data lives in HubSpot's cloud with export limitations on free/starter tiers
- **Bloat:** The UI presents marketing, sales, service, and CMS features simultaneously. For a team that just needs contacts + pipeline + tasks, 70% of the navigation is noise.

### Pipedrive

- **Closest fit** for SME sales teams, but:
- Service/support workflows are bolted on (separate product, extra cost)
- $14-$99/user/month; mid-tier features ($49/user) needed for useful reporting
- Limited customization without developer involvement
- No self-hosted option for teams with data residency requirements

### General Patterns of Misfit

| Problem | Enterprise CRM Response | SME Reality |
|---|---|---|
| Too many features | "Just hide what you don't need" | Team has no admin to configure this |
| High per-seat cost | "ROI justifies the investment" | $10K/year is a real budget decision for a 10-person SME |
| Long onboarding | "We offer implementation services" | Team needs to be productive this week, not in 3 months |
| Rigid data model | "Use custom objects" | Team wants contacts, deals, and tasks -- not a data modeling exercise |
| Integration requirements | "Connect via our marketplace" | Team uses email + spreadsheets + maybe Slack, not 15 SaaS tools |

## The Gap This MVP Fills

A CRM that is:

- **Right-sized:** Auth, contacts, companies, opportunities with pipeline stages, tasks, notes, and a dashboard. Nothing more.
- **Fast to adopt:** A team of 10 should be entering data on day one, not configuring workflows
- **Self-hostable:** Next.js + PostgreSQL stack that can run on a single VPS or container
- **Low per-seat cost:** Open-source core or flat pricing, not $50/user/month
- **Service-aware:** Tasks and notes work for both sales follow-ups and service tickets without requiring a separate product
- **Context-rich:** Every interaction with a contact is visible in one place to every team member

## Bounded MVP Scope

The MVP deliberately excludes:

- Email integration / inbox sync
- Marketing automation (drip campaigns, lead scoring)
- Phone/VoIP integration
- Document generation (proposals, contracts)
- Territory management
- Advanced forecasting / AI predictions
- Mobile app (responsive web only)
- Workflow automation / triggers
- API for third-party integrations

These are all valid features for a V2+. The MVP proves that a focused tool covering contacts, companies, opportunities, pipeline stages, tasks, notes, and a dashboard delivers immediate value to SME teams currently using spreadsheets.

## Key Assumptions to Validate

1. SME teams will adopt a new tool if setup takes less than 1 hour
2. Pipeline visibility alone (without forecasting) is valuable enough to drive daily use
3. Shared notes on contacts replace the "ask the last person who talked to them" pattern
4. Tasks tied to contacts/opportunities reduce missed follow-ups measurably
5. A dashboard showing pipeline stages and overdue tasks is sufficient for management visibility

## References

- Capterra SMB CRM adoption surveys (2023-2024)
- Nucleus Research: CRM ROI studies for companies under 50 employees
- Gartner Magic Quadrant for CRM (enterprise bias acknowledged)
- Direct interviews with 3 SME sales teams (agency, SaaS startup, consulting firm) -- informal, not cited
