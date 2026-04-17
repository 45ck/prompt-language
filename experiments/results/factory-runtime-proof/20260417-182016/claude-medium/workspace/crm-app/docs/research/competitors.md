# Competitive Landscape

## Overview

The CRM market for SMEs is dominated by SaaS platforms that bundle sales, marketing, and service into tiered pricing models. Each competitor solves real problems but introduces friction points that create an opening for a bounded, self-hosted, developer-friendly alternative.

## HubSpot CRM (Free Tier)

**Strengths:** Generous free tier with contacts, deals, tasks, and a basic dashboard. Strong brand recognition. Excellent onboarding UX with guided setup wizards. Ecosystem of integrations through the HubSpot marketplace.

**Weaknesses for SMEs:**
- Free tier caps at 1,000,000 contacts but limits pipeline views to one pipeline
- Critical features gated behind Starter ($20/user/mo): custom reporting, multiple pipelines, email sequences
- Data lives on HubSpot infrastructure with no self-hosting option
- Export limitations make switching painful once data is entrenched
- UI has grown complex over the years; new users face feature overload

**Gap we fill:** Teams that want full control of their data, no per-seat cost pressure, and a focused feature set without upsell friction.

## Pipedrive

**Strengths:** Pipeline-first UX that sales reps genuinely enjoy. Drag-and-drop deal management is best-in-class. Strong mobile app. Activity-based selling methodology baked into the product.

**Weaknesses for SMEs:**
- No free tier; starts at $14/user/mo (Essential plan)
- Essential plan lacks workflow automation, email integration, and group emailing
- No self-hosting option; EU data residency available but limited
- Custom fields and reporting require Professional tier ($49/user/mo)
- Service/support workflows are not a focus; no ticketing capability

**Gap we fill:** Teams that want Pipedrive's pipeline simplicity without monthly per-seat costs, plus basic service workflow support in the same tool.

## Freshsales (Freshworks)

**Strengths:** AI-powered lead scoring on paid tiers. Built-in phone and email. Clean modern interface. Part of the broader Freshworks suite (Freshdesk, Freshchat) for service teams.

**Weaknesses for SMEs:**
- Free tier limited to 3 users with basic contact and deal management
- Growth plan ($9/user/mo) still lacks visual pipeline, territory management
- Tight coupling to Freshworks ecosystem; standalone use feels incomplete
- Frequent UI changes and feature reorganization confuse existing users
- Self-hosting not available

**Gap we fill:** Teams larger than 3 users who need a free, self-hosted solution without ecosystem lock-in.

## Zoho CRM

**Strengths:** Extremely feature-rich at every tier. Free tier for up to 3 users. Strong customization engine (Canvas, Blueprint). Part of the massive Zoho ecosystem (45+ apps).

**Weaknesses for SMEs:**
- Free tier is severely limited: no custom dashboards, no workflow rules, no integrations
- Standard plan ($14/user/mo) still lacks scoring, custom signals, and advanced analytics
- Configuration complexity rivals Salesforce; small teams report "admin fatigue"
- UI feels dated compared to newer competitors
- Self-hosting only via Zoho Creator custom apps, not CRM itself
- Performance complaints on larger datasets in shared-tenant environments

**Gap we fill:** Teams that want Zoho-level customizability through code (not admin UI), with a modern stack they can extend themselves.

## Competitive Positioning Matrix

| Capability | HubSpot Free | Pipedrive | Freshsales | Zoho CRM | Our MVP |
|-----------|-------------|-----------|------------|----------|---------|
| Free tier | Yes (limited) | No | 3 users | 3 users | Unlimited (self-hosted) |
| Self-hosted | No | No | No | No | Yes |
| Contacts & companies | Yes | Yes | Yes | Yes | Yes |
| Pipeline management | 1 pipeline | Yes | Paid only | Yes | Yes |
| Tasks & follow-ups | Yes | Yes | Yes | Yes | Yes |
| Notes & activity log | Yes | Yes | Yes | Yes | Yes |
| Dashboard | Basic | Yes | Paid only | Paid only | Yes |
| Developer extensibility | API only | API only | API only | Creator | Full source access |
| Setup time | 1-2 hours | 30 min | 1 hour | 2-4 hours | < 1 hour |
| Per-seat cost at 10 users | $0-$200/mo | $140-$490/mo | $90-$390/mo | $140-$400/mo | $0 (infra only) |

## Our Differentiation

**Self-hosted by default.** Customer data never leaves infrastructure the team controls. Compliance with data residency requirements is automatic. No vendor sunset risk.

**Developer-friendly stack.** Next.js, TypeScript, PostgreSQL, Prisma. A technical founder or staff developer can read, modify, and extend every line. No proprietary scripting language or admin console.

**Bounded scope.** Eight modules (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard) with no feature bloat. The constraint is the feature. Teams use what they need without wading through capabilities they do not.

**Zero per-seat economics.** The only cost is infrastructure: a single VPS or container deployment. Adding the 11th user does not trigger a pricing tier change.

## Risks of This Positioning

- Self-hosted requires technical capability to deploy and maintain
- No ecosystem of integrations out of the box
- Single-developer maintenance risk if the deploying developer leaves
- Feature gap perception compared to mature SaaS platforms

These risks are addressed in the risk register and mitigated by keeping the stack conventional and the codebase small.
