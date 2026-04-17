# Competitor Analysis

## Market Context

The CRM market for SME teams is split between two extremes: enterprise platforms that are over-featured and expensive, and lightweight tools that sacrifice structure for simplicity. The MVP targets the gap between these -- structured enough to replace spreadsheets, simple enough that reps actually use it.

## Direct Competitors

### HubSpot CRM (Free Tier)

**What it is:** Free CRM with contacts, companies, deals, and tasks. Paid tiers add email tracking, sequences, and reporting.

**Strengths:**
- Free for unlimited users (core CRM).
- Polished UI with drag-and-drop pipeline.
- Built-in email tracking and logging (paid).
- Large ecosystem of integrations.

**Weaknesses for SME teams:**
- Free tier has limited customization; useful features gate behind paid tiers ($20-50/user/month).
- Overwhelming feature surface -- reps get lost in marketing/service/operations tabs they do not use.
- Onboarding requires understanding HubSpot's object model (contacts vs. leads vs. companies vs. deals).
- Data lives on HubSpot's infrastructure; no self-hosting option.

**MVP differentiation:** Simpler scope, faster to learn, self-hostable, no upsell pressure.

### Pipedrive

**What it is:** Sales-focused CRM built around a visual pipeline. Starts at $14/user/month.

**Strengths:**
- Pipeline-first design matches how reps think about deals.
- Activity-based selling methodology built in.
- Clean mobile app.
- Reasonable price for small teams.

**Weaknesses for SME teams:**
- Per-user pricing adds up for 20+ person teams ($280+/month at base tier).
- Lacks service/support features -- purely sales.
- Limited task management; no linking tasks to contacts independent of deals.
- Custom fields and reporting require higher-priced tiers.

**MVP differentiation:** No per-user cost, includes task management for service workflows, self-hostable.

### Freshsales (Freshworks CRM)

**What it is:** CRM with built-in phone, email, and AI lead scoring. Free tier for up to 3 users; paid starts at $9/user/month.

**Strengths:**
- Built-in phone dialer and email integration.
- AI-powered lead scoring and deal insights (paid).
- Affordable entry price.
- Part of a broader Freshworks suite (support, marketing).

**Weaknesses for SME teams:**
- Free tier is limited to 3 users -- insufficient for most SME teams.
- Feature bloat at higher tiers distracts from core CRM.
- Configuration complexity increases with each add-on module.
- Vendor lock-in to Freshworks ecosystem.

**MVP differentiation:** No user limits at MVP scope, simpler feature set, no vendor ecosystem dependency.

### Zoho CRM

**What it is:** Full-featured CRM in the Zoho suite. Free tier for up to 3 users; paid starts at $14/user/month.

**Strengths:**
- Extremely feature-rich (workflow rules, scoring, reports, web forms).
- Integrates with 45+ Zoho products.
- Competitive pricing in paid tiers.
- Customization through Canvas design studio.

**Weaknesses for SME teams:**
- UI is dense and dated; steep learning curve.
- Free tier is limited to 3 users.
- Performance can be sluggish on complex views.
- Configuration requires significant time investment.

**MVP differentiation:** Faster, cleaner UI; learnable in 30 minutes vs. hours; no 3-user cap.

## Indirect Competitors (Spreadsheet-Adjacent)

### Google Sheets / Excel

**What it is:** The default "CRM" for most SME teams before they adopt dedicated software.

**Why teams start here:**
- Zero cost, zero setup.
- Familiar interface; no training needed.
- Flexible -- any data model, any column, any formula.

**Why teams leave:**
- No multi-user collaboration controls (concurrent edits cause overwrites).
- No structured relationships (contact -> company -> opportunity).
- No pipeline visualization.
- No task management or reminders.
- Data quality degrades quickly without validation.

**MVP position:** The CRM is the structured upgrade from spreadsheets -- keeps the simplicity, adds relationships, pipeline views, and shared task tracking.

### Notion / Airtable

**What it is:** Flexible database/workspace tools that can be configured as lightweight CRMs.

**Strengths:**
- Highly flexible; users build their own schema.
- Good for teams that want to customize everything.
- Modern, clean interfaces.

**Weaknesses for SME teams:**
- Requires significant setup to function as a CRM (building views, relations, automations).
- No built-in pipeline Kanban without configuration.
- Breaks down at scale (50+ contacts, complex filtering).
- Per-user pricing applies to meaningful feature tiers.

**MVP position:** Pre-built CRM structure removes the "blank canvas" problem. Teams get a working pipeline and task system without building it themselves.

## Competitive Summary

| Capability | MVP | HubSpot Free | Pipedrive | Sheets |
|---|---|---|---|---|
| Contacts + Companies | Yes | Yes | Yes | Manual |
| Pipeline Kanban | Yes | Yes | Yes | No |
| Tasks with assignees | Yes | Yes | Limited | Manual |
| Notes on records | Yes | Yes | Yes | Manual |
| Dashboard | Yes | Yes (limited) | Yes | Manual |
| Self-hostable | Yes | No | No | N/A |
| Per-user cost | None | None (free tier) | $14+/user | None |
| Setup time | Minutes | Hours | Hours | Minutes |
| Learning curve | 30 min | 2-4 hours | 1-2 hours | None |

## Key Takeaway

The MVP competes not by having more features, but by having fewer -- exactly the right ones for an SME team replacing spreadsheets. The win condition is adoption: if reps use it daily, it beats every competitor. If they do not, even the best feature set fails.
