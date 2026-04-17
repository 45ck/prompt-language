# Competitor Analysis

## Overview

This document compares six CRM products against the needs of SME sales teams (2-20 people). The focus is on pricing, complexity, and fit for teams that need contact management, pipeline tracking, tasks, and a simple dashboard -- nothing more.

## Competitor Comparison Matrix

| Feature | Salesforce | HubSpot | Pipedrive | Freshsales | Attio | Folk |
|---|---|---|---|---|---|---|
| Free tier | No | Yes (limited) | No | Yes (limited) | No | Yes (limited) |
| Entry price/user/mo | $25 | $15 (Starter) | $14 | $9 | $29 | $20 |
| Mid-tier price/user/mo | $80 | $90 (Pro) | $28 | $39 | $59 | $40 |
| Setup time | Weeks | Days | Hours | Hours | Hours | Hours |
| Admin required | Yes | No (but helps) | No | No | No | No |
| Pipeline view | Yes | Yes | Yes (core) | Yes | Yes | Yes |
| Contact management | Excellent | Good | Basic | Good | Excellent | Good |
| Task management | Yes (Activities) | Yes | Yes (Activities) | Yes | Limited | Limited |
| Custom fields | Extensive | Yes | Yes | Yes | Yes (flexible) | Yes |
| Reporting | Enterprise-grade | Good | Good | Good | Basic | Basic |
| Mobile app | Yes | Yes | Yes | Yes | Yes | No |
| SME fit (1-5) | 1 | 3 | 4 | 4 | 3 | 3 |

## Individual Assessments

### Salesforce

**Positioning**: Enterprise CRM market leader.

**Strengths**:
- Unmatched customization and extensibility
- Massive ecosystem (AppExchange, integrations)
- Industry-specific solutions

**Weaknesses for SMEs**:
- Essentials ($25/user/mo) is a stripped version that still requires Salesforce-specific knowledge
- No useful free tier
- Configuration overhead: objects, page layouts, profiles, validation rules
- Lightning UI is heavyweight -- slow loads on modest hardware
- Requires a trained admin for anything beyond basic setup

**Cost for a 10-person team**: $3,000-$9,600/year (Essentials to Professional)

**Verdict**: Designed for 50+ person orgs with dedicated ops. Overkill in every dimension for SMEs.

### HubSpot

**Positioning**: Freemium CRM with upsell into marketing/sales/service hubs.

**Strengths**:
- Generous free tier (up to 1M contacts, basic pipeline)
- Clean, modern UI
- Good email tracking in paid tiers
- Strong content marketing and inbound tools

**Weaknesses for SMEs**:
- Free tier lacks: custom reporting, multiple pipelines, workflow automation, sequences
- Pricing jumps are steep: Free to Starter ($15/user/mo) to Professional ($90/user/mo)
- The platform pushes you toward the full HubSpot ecosystem
- Feature-heavy UI with marketing/service/CMS sections that SME sales teams do not need
- Contact-based pricing in marketing hub creates unpredictable costs

**Cost for a 10-person team**: $0 (free, limited) to $10,800/year (Professional)

**Verdict**: Best free option, but the upgrade path is expensive and the platform is broader than what sales-only SMEs need.

### Pipedrive

**Positioning**: Sales-first CRM for small teams.

**Strengths**:
- Pipeline-centric design matches how sales teams think
- Visual drag-and-drop deal management
- Simple, focused UI with minimal distractions
- Good activity tracking (calls, emails, meetings as "Activities")
- Reasonable pricing for small teams

**Weaknesses for SMEs**:
- Contact and company management feels secondary to deals
- No free tier -- 14-day trial only
- Essential plan ($14/user/mo) lacks workflow automation and email sync
- Custom fields and reporting require Advanced ($28/user/mo) or higher
- Task management is coupled to the "Activities" concept, not standalone

**Cost for a 10-person team**: $1,680-$3,360/year (Essential to Advanced)

**Verdict**: Closest competitor to our MVP's positioning. Pipeline-first design is right, but contact management and task tracking are weaker.

### Freshsales (Freshworks)

**Positioning**: Affordable CRM within the Freshworks suite.

**Strengths**:
- Low entry price ($9/user/mo for Growth plan)
- Built-in phone and email
- AI-powered lead scoring (paid tiers)
- Clean interface
- Free tier for up to 3 users

**Weaknesses for SMEs**:
- Free tier is very limited (100 contacts, no pipeline management)
- Part of the Freshworks ecosystem -- pressure to adopt Freshdesk, Freshchat, etc.
- Growth plan lacks custom reports and workflows
- Enterprise features (territory management, audit logs) inflate higher tiers
- Indian-headquartered support team can mean timezone gaps for US/EU SMEs

**Cost for a 10-person team**: $1,080-$4,680/year (Growth to Pro)

**Verdict**: Good value at the low end, but free tier is too restrictive and the ecosystem push adds complexity.

### Attio

**Positioning**: Modern, flexible CRM for startups and small teams.

**Strengths**:
- Highly flexible data model (custom objects, relationships)
- Modern UI with real-time collaboration
- Strong API and webhook support
- Automatic data enrichment from email/calendar
- Good for relationship-heavy businesses

**Weaknesses for SMEs**:
- No free tier
- $29/user/mo entry price is above average
- Flexibility comes with setup complexity -- must define your own data model
- Task management is minimal (relies on integrations)
- Pipeline visualization is less mature than Pipedrive
- Younger product with smaller support ecosystem

**Cost for a 10-person team**: $3,480-$7,080/year (Plus to Pro)

**Verdict**: Innovative product but the flexibility-first approach requires more setup effort than SMEs want. Pricing is premium for the segment.

### Folk

**Positioning**: Lightweight CRM for relationship management.

**Strengths**:
- Simple, spreadsheet-like interface (low learning curve)
- Good Chrome extension for importing contacts from LinkedIn, Gmail
- Pipeline views with drag-and-drop
- Mail merge and bulk outreach features
- Group-based contact organization

**Weaknesses for SMEs**:
- Limited free tier (100 contacts)
- Weak task management -- no standalone task system
- Reporting is minimal
- No native mobile app
- Company/contact relationships are basic
- Pipeline management is secondary to contact organization

**Cost for a 10-person team**: $2,400-$4,800/year (Standard to Premium)

**Verdict**: Good for contact-heavy use cases (recruiting, networking) but lacks the pipeline depth and task tracking that sales teams need.

## Gap Analysis: Where Our MVP Fits

### Gaps in the current market for SMEs

1. **No truly free, full-featured pipeline CRM**: HubSpot's free tier is closest but lacks pipeline customization. Folk and Freshsales free tiers are too restrictive.

2. **Contact + Pipeline + Tasks as equal citizens**: Pipedrive prioritizes pipeline over contacts. Folk prioritizes contacts over pipeline. Attio prioritizes flexibility over simplicity. No product treats all three as equally important.

3. **Zero-config onboarding**: Every competitor requires at least some initial setup (pipeline stages, custom fields, import). An opinionated default setup (standard pipeline stages, common fields) could enable productive use within minutes.

4. **Transparent, simple pricing**: Per-seat pricing with feature gates at each tier creates anxiety about hitting limits. A simpler model (or self-hosted option) would appeal to cost-conscious SMEs.

5. **Notes as first-class activity**: Most CRMs bury notes under activity logs or require structured logging (call type, duration, outcome). Simple, timestamped notes on any entity is an underserved need.

### Our MVP's positioning

| Gap | Our MVP Approach |
|---|---|
| Free pipeline CRM | Open-source, self-hostable, no per-seat fees |
| Equal contact/pipeline/task focus | All three are core entities with full CRUD and relationships |
| Zero-config start | Default pipeline stages, standard fields, auth-and-go |
| Simple cost model | Self-hosted = free; managed hosting at flat team rate (future) |
| First-class notes | Notes entity linked to contacts, companies, and opportunities |

### Competitive advantages

- **Self-hostable**: no vendor lock-in, data stays on the team's infrastructure
- **Next.js + TypeScript + Prisma**: modern stack that developers can extend and customize
- **Focused scope**: no marketing hub, service desk, or CMS -- just sales CRM
- **Opinionated defaults**: works out of the box without a configuration wizard

### Competitive disadvantages (honest assessment)

- **No email integration**: every competitor offers some level of email tracking
- **No mobile app**: competitors with native apps have an advantage for field sales
- **No AI features**: Freshsales and Attio offer lead scoring; we do not
- **No import tools**: migrating from another CRM requires manual effort
- **Single-developer risk**: competitors have full engineering teams and support orgs

## Key Takeaway

The SME CRM market has a gap between "free but limited" (HubSpot Free, Freshsales Free) and "capable but expensive" (Pipedrive Advanced, Attio Plus). Our MVP targets the middle: a fully functional contacts + pipeline + tasks + notes CRM with zero cost barrier and minimal setup friction. The trade-off is fewer integrations and no mobile app -- acceptable for an MVP validating core value.
