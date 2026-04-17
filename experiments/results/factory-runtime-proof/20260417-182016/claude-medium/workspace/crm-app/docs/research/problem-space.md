# Problem Space: SME Sales & Service Teams

## Overview

Small-to-medium enterprise (SME) sales and service teams of 5-50 people operate under constraints that differ fundamentally from enterprise organizations. They lack dedicated CRM administrators, have limited IT budgets, and need tools that work immediately without weeks of configuration. This document identifies the core problems our bounded MVP addresses.

## Problem 1: Scattered Contact Data

Sales reps store contacts across personal phones, email address books, spreadsheets, and sticky notes. When a rep leaves, their relationships leave with them. Service agents re-ask customers for information already collected by sales.

**Real workflow impact:** A sales rep receives an inbound inquiry. They search Outlook, then Gmail, then a shared Google Sheet, then ask a colleague on Slack. The prospect waits 20 minutes for a response that should take 30 seconds.

**What teams need:** A single canonical contact record linked to a company, with interaction history visible to anyone on the team. No duplicate hunting across systems.

## Problem 2: Lost Deals and Pipeline Blindness

Without a shared pipeline, managers cannot answer basic questions: How many deals are in negotiation? What is the forecast for this quarter? Which deals have stalled? Reps track opportunities in personal spreadsheets or not at all.

**Real workflow impact:** A weekly sales meeting consists of each rep verbally reporting their deals from memory. The manager compiles a forecast in a spreadsheet that is outdated by the next morning. Stalled deals go unnoticed for weeks.

**What teams need:** A pipeline view with defined stages (lead, qualified, proposal, negotiation, closed-won, closed-lost) that updates in real time as reps move deals forward. Dashboard summaries for managers.

## Problem 3: Manual Follow-Up Tracking

Reps rely on memory, calendar reminders, or email flags to track follow-ups. Tasks fall through the cracks. A prospect who requested a callback on Friday gets contacted the following Wednesday, if at all.

**Real workflow impact:** A service agent resolves a ticket but forgets to follow up in 48 hours as promised. The customer calls back frustrated. A sales rep misses a proposal deadline because the reminder was in a personal to-do app that crashed.

**What teams need:** Tasks tied to contacts, companies, or opportunities with due dates and assignees. A daily view of overdue and upcoming tasks per user.

## Problem 4: No Shared Context on Interactions

When a customer calls, the person who answers has no visibility into previous conversations, quotes sent, or issues raised. The customer repeats themselves. Internal handoffs between sales and service lose context entirely.

**Real workflow impact:** A customer calls about an open support issue. The agent who answers was not involved and has no notes. They put the customer on hold, search email threads, and eventually ask the customer to explain the situation again.

**What teams need:** Timestamped notes attached to contacts and opportunities, visible to all team members. A chronological activity feed showing calls, emails logged, tasks completed, and stage changes.

## Problem 5: Onboarding Friction with Existing Tools

Teams that have tried HubSpot, Salesforce, or Zoho report the same pattern: initial enthusiasm, two weeks of setup, growing frustration with complexity, and gradual abandonment back to spreadsheets. The tools solve enterprise problems at enterprise complexity.

**Real workflow impact:** A 10-person sales team signs up for a SaaS CRM. The free tier lacks the one feature they need. The paid tier requires annual commitment. The admin interface requires a certification course. Three months later, only two reps actually use it.

**What teams need:** A self-hosted, developer-friendly CRM that a technical founder or in-house developer can deploy, customize, and maintain without vendor lock-in or per-seat pricing pressure.

## Scope Boundary

This MVP targets the intersection of these five problems with the smallest feature set that delivers value:

| In Scope | Out of Scope |
|----------|-------------|
| Auth (login, roles) | Marketing automation |
| Contacts & companies | Email integration |
| Opportunities & pipeline stages | Phone/VoIP integration |
| Tasks with due dates | Workflow automation rules |
| Notes on any entity | Reporting beyond dashboard |
| Summary dashboard | API for third-party integrations |

## Target User Profiles

**Sales Rep (primary):** Needs to log contacts, track deals through stages, and see daily tasks. Spends 80% of time in the pipeline and contact views.

**Service Agent (secondary):** Needs to look up contact history, add notes, and create follow-up tasks. Spends 80% of time in contact detail and task views.

**Team Lead / Manager (tertiary):** Needs pipeline summary, team task overview, and deal velocity indicators. Spends 80% of time on the dashboard.

## Success Criteria

The MVP succeeds if a 10-person team can replace their spreadsheet-based contact and deal tracking within one day of deployment, with no training beyond a 5-minute walkthrough.
