# Problem Space: CRM for SME Teams

## Overview

Small-medium enterprise (SME) sales teams of 2-20 people need a structured way to track contacts, companies, deals, and activities. Most either use spreadsheets or are forced into enterprise CRMs designed for organizations 10x their size. This document defines the problem space for a lightweight CRM MVP targeting this underserved segment.

## The Core Problem

SME sales teams lack a single, affordable system that gives them:

1. **A shared view of all contacts and companies** they interact with
2. **Pipeline visibility** showing where every deal stands
3. **Activity tracking** so nothing falls through the cracks
4. **Lightweight reporting** to understand revenue trajectory

Without this, teams operate in the dark -- reps duplicate outreach, deals stall without anyone noticing, and managers cannot forecast revenue.

## Current Pain Points

### Spreadsheet-based tracking

The most common starting point for SME teams is a shared Google Sheet or Excel file.

- **No relational data**: contacts, companies, and deals live in separate tabs with no linkage. Updating a company name means manually updating every row that references it.
- **No activity history**: there is no log of calls, emails, or meetings tied to a contact. Context lives in individual inboxes.
- **Concurrency issues**: multiple reps editing the same sheet causes overwrites and version confusion.
- **No pipeline visualization**: a flat list of rows cannot show deal progression through stages.
- **No reminders or tasks**: follow-ups rely on personal memory or separate to-do apps.

### Scattered tools

Teams that outgrow spreadsheets often cobble together multiple tools:

- Google Contacts or Outlook for contact storage
- Trello or Asana for deal tracking
- Slack or email threads for activity notes
- Calendar apps for follow-up reminders

This creates **fragmented context**. A rep preparing for a call must check 3-4 places to understand the full picture. New team members have no single onboarding source.

### No pipeline visibility

Without a CRM, managers cannot answer basic questions:

- How many deals are in each stage right now?
- Which deals have been stagnant for more than 14 days?
- What is our expected close rate this quarter?
- Which rep is overloaded and which has capacity?

These questions are critical for forecasting and resource allocation. Spreadsheets can approximate answers but require manual maintenance that quickly falls behind reality.

### Lost institutional knowledge

When a rep leaves or goes on vacation, their contacts and deal context leave with them. Notes live in personal notebooks, email threads, or memory. The next person starts from scratch.

## Why Existing CRMs Miss the Mark for SMEs

### Salesforce

- **Complexity**: Salesforce is built for enterprises with dedicated admins. Setup requires configuring objects, fields, page layouts, profiles, and permission sets. An SME team without a Salesforce admin will spend weeks on initial setup.
- **Cost**: Essentials starts at $25/user/month but lacks key features (workflow automation, custom reports). Professional at $80/user/month is where real functionality begins. For a 10-person team, that is $9,600/year.
- **Over-engineering**: features like Apex triggers, Flow Builder, and multi-org architecture are irrelevant to a team tracking 500 contacts and 50 active deals.

### HubSpot

- **Free tier limitations**: the free CRM is genuinely useful but becomes a funnel into paid Marketing/Sales/Service Hubs. Once a team needs more than basic pipeline views, costs jump to $90/month (Starter) or $800/month (Professional).
- **Ecosystem lock-in**: HubSpot works best when you also use HubSpot for email marketing, forms, and support. SMEs using other tools for these functions get a fragmented experience.
- **Feature bloat**: even the free tier exposes marketing, service, and CMS features that distract from core sales workflows.

### Pipedrive

- Closest to SME needs but still $14-99/user/month.
- Pipeline-first design is good, but contact and company management is secondary.
- Limited task management -- follow-ups require the "Activities" abstraction which adds friction.

### General issues with existing solutions

- **Onboarding overhead**: most CRMs require 1-2 weeks of configuration before first productive use.
- **Per-seat pricing**: scales poorly for growing teams. Adding 3 reps at $50/user/month is an immediate $1,800/year commitment.
- **Feature creep**: enterprise CRMs add features for large-org use cases (territory management, CPQ, partner portals) that clutter the UI for small teams.

## Target User Profile

### Team composition

- **Size**: 2-20 people
- **Roles**: 1-3 managers/founders, 2-15 sales reps, 0-2 support/ops people
- **Technical skill**: comfortable with web apps but no dedicated IT staff or CRM admin
- **Industry**: B2B services, agencies, SaaS, consulting, real estate, recruiting

### Behavioral characteristics

- Manage 100-5,000 contacts and 20-200 active deals at any time
- Sales cycle is 1 week to 3 months (not multi-year enterprise deals)
- Pipeline has 4-7 stages (not 15+ stages with approval gates)
- Need task reminders, not workflow automation engines
- Want a dashboard they can glance at, not a reporting suite they must configure

### Current state

- Using spreadsheets, basic free tools, or a CRM they find too complex
- Spending 30-60 minutes/day on data entry and context-switching between tools
- Missing follow-ups because there is no centralized reminder system
- Cannot answer "how is the pipeline looking?" without manual aggregation

## MVP Scope Alignment

The bounded MVP (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard) directly addresses the core pain points:

| Pain Point | MVP Feature |
|---|---|
| Scattered contact data | Contacts + Companies with relationships |
| No pipeline visibility | Opportunities + Pipeline Stages + Dashboard |
| Lost follow-ups | Tasks tied to contacts/opportunities |
| No activity history | Notes on contacts/companies/opportunities |
| No shared access | Auth with team-based access |
| No quick overview | Dashboard with funnel and activity feed |

What the MVP intentionally excludes:

- Email integration (complex, requires OAuth with providers)
- Workflow automation (premature for MVP validation)
- Custom fields (adds schema complexity before validating core value)
- Reporting builder (dashboard covers the 80% case)
- API / integrations (build after core is validated)
- Mobile app (responsive web is sufficient for MVP)

## Validation Questions

The MVP should help answer these questions:

1. Will SME teams adopt a CRM if onboarding takes under 10 minutes?
2. Is the contacts + pipeline + tasks combination sufficient for daily use?
3. Do teams return daily once they start using it?
4. At what team size does the MVP become insufficient?
5. Which missing feature is the first requested?
