# Competitive Landscape

## Overview

The SME CRM market is dominated by four products that offer free or low-cost tiers. Each has tradeoffs that create openings for a focused MVP. This analysis evaluates them strictly against SME sales team needs: contacts, companies, opportunities, pipeline, tasks, notes, and dashboard.

## HubSpot CRM Free

### Overview

HubSpot Free is the default choice for SME teams starting with CRM. It offers contacts, companies, deals, and a pipeline view at zero cost. It is the benchmark our MVP must meet or exceed in core workflows.

### Strengths

- **Zero cost** for unlimited users and up to 1,000,000 contacts.
- **Pipeline view** is polished and intuitive with drag-and-drop.
- **Contact/company linking** is automatic from email domain matching.
- **Ecosystem**: upgrades to Marketing Hub, Sales Hub, Service Hub when teams grow.
- **Brand trust**: well-known, easy to get internal buy-in.

### Weaknesses for SME teams

- **Feature bloat**: free tier includes marketing tools, chatbots, forms, and meeting scheduling that clutter the UI for teams that only need sales CRM.
- **Upsell pressure**: key features (sequences, custom reporting, multiple pipelines) are gated behind $20-$100/user/month Starter/Pro tiers.
- **Slow load times**: the app is heavy; reps on weak connections or older machines notice lag.
- **Data model rigidity**: custom properties exist but default fields assume a specific B2B SaaS workflow.
- **Task management is minimal**: tasks exist but lack subtasks, dependencies, or board views.
- **Data ownership**: all data hosted by HubSpot with no self-hosting option. Export limitations create vendor lock-in.

### Our opening

A lighter, faster product focused purely on the sales workflow without marketing/service bloat. Full data ownership via self-hosting. Simpler UI that does not require ignoring 70% of the navigation.

## Pipedrive

### Overview

Pipedrive is built pipeline-first and is popular with SME sales teams of 5-50 reps. Pricing starts at $14/user/month (Essential plan).

### Strengths

- **Pipeline-centric UI**: the entire product is organized around the deal pipeline.
- **Activity-based selling**: built-in methodology that prompts reps to schedule next actions.
- **Clean interface**: less cluttered than HubSpot, focused on sales.
- **Mobile app**: strong mobile experience for field reps.
- **Customizable pipelines**: multiple pipelines with custom stages.

### Weaknesses for SME teams

- **No free tier**: $14/user/month is a barrier for 2-3 person teams exploring CRM for the first time.
- **Reporting is limited on lower tiers**: custom reports require Professional ($49/user/month).
- **Contact/company management is secondary**: contact records feel like an afterthought compared to the deal view.
- **Note-taking is basic**: plain text only, no rich formatting or file attachments in base tier.
- **No built-in task board**: activities are listed, not visualized.

### Our opening

Free tier with pipeline quality comparable to Pipedrive, plus stronger contact/company management and a task board view.

## Zoho CRM

### Overview

Zoho CRM offers a free tier for up to 3 users and paid plans from $14/user/month. It is part of the larger Zoho ecosystem (40+ apps).

### Strengths

- **Free tier for 3 users**: viable for very small teams.
- **Highly customizable**: modules, fields, layouts, and workflows are all configurable.
- **Zoho ecosystem**: integrates with Zoho Books, Zoho Desk, Zoho Campaigns seamlessly.
- **Multi-currency and multi-language**: good for international SMEs.
- **Self-hosted option**: available via Zoho Creator for on-premise needs.

### Weaknesses for SME teams

- **Complex setup**: the customization power comes with a steep learning curve.
- **UI feels dated**: the interface is functional but not modern compared to HubSpot or Pipedrive.
- **3-user free limit is restrictive**: most SME sales teams are 5-15 people.
- **Performance**: the app can be slow, especially with custom workflows enabled.
- **Feature overload**: many features feel half-built, documentation quality is inconsistent.
- **Support quality varies**: free tier support is community-only.

### Our opening

Modern UI with zero configuration required. Works for teams of 5-15 without hitting a user cap on the free tier.

## Freshsales (Freshworks)

### Overview

Freshsales offers a free tier for up to 3 users with basic CRM features. Paid plans start at $9/user/month.

### Strengths

- **Built-in phone and email**: integrated communication channels without add-ons.
- **AI-powered lead scoring**: available on Growth tier ($9/user/month).
- **Clean, modern UI**: interface is intuitive and visually polished.
- **Affordable paid tiers**: $9/user/month Growth plan is the cheapest paid CRM tier among major players.

### Weaknesses for SME teams

- **Free tier is very limited**: 3 users, no visual pipeline, no reports, no workflows on free plan.
- **Pipeline view requires paid plan**: the core feature SME teams need is not free.
- **Freshworks ecosystem is less mature**: fewer integrations than HubSpot or Zoho.
- **Company records are secondary**: contact-first data model, company management is basic.
- **Task management is an afterthought**: no dedicated task board or Kanban view.
- **AI features gated behind higher tiers**: lead scoring and other Freddy AI capabilities require Pro plan.

### Our opening

Free pipeline view and dashboard that Freshsales gates behind paid plans. Stronger task management and company records. No user cap on the free tier.

## Competitive Positioning Matrix

| Capability | HubSpot Free | Pipedrive | Zoho Free | Freshsales Free | Our MVP |
|---|---|---|---|---|---|
| Free pipeline view | Yes | No ($14/mo) | Yes (3 users) | No ($9/mo) | Yes |
| Free user limit | Unlimited | None (paid) | 3 users | 3 users | Unlimited |
| Contact management | Strong | Basic | Strong | Strong | Core focus |
| Company management | Strong | Basic | Strong | Basic | Core focus |
| Task board | No | No | No | No | Yes |
| Dashboard | Basic | Basic | Basic | No | Core focus |
| Notes on records | Yes | Basic | Yes | Yes | Yes |
| Self-hosted option | No | No | Partial | No | Yes |
| Data ownership | Vendor | Vendor | Vendor | Vendor | Full |
| Setup time | ~1 hour | ~30 min | ~2 hours | ~30 min | Under 15 min |
| UI complexity | High (bloat) | Low | High (config) | Medium | Low |
| Developer-friendly | API only | API only | API only | API only | Code-level |

## MVP Differentiation Strategy

1. **Pure sales focus**: no marketing tools, no service desk, no chatbots. Every screen serves the sales workflow.
2. **Zero-config setup**: working pipeline in under 15 minutes with sensible defaults for SME sales.
3. **Task-first design**: tasks are a primary entity, not an afterthought. Board view tied to contacts and deals.
4. **Self-hosted and open**: full data ownership. Deploy on your own infrastructure or a managed platform. No vendor lock-in.
5. **Developer-friendly**: built with Next.js, TypeScript, PostgreSQL, and Prisma. Teams with developers can extend and customize directly in code.
6. **Modern, fast UI**: Next.js server components for fast initial loads, responsive design for mobile access.

## What We Do Not Compete On

- Ecosystem breadth (HubSpot, Zoho win here)
- AI/ML features (not in MVP scope)
- Built-in communication channels (Freshsales wins here)
- Deep customization (Zoho wins here)
- Mobile native app (all competitors win; we offer responsive web only)
