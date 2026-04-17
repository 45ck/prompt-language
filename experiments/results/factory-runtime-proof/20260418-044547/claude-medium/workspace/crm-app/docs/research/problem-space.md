# Problem Space: SME Sales Team Pain Points

## Overview

Small-medium enterprise (SME) sales teams of 2-25 people operate under constraints that enterprise teams do not face: no dedicated ops staff, limited budget, and zero tolerance for lengthy onboarding. Their tools must work immediately or they revert to spreadsheets.

## Pain Point 1: Spreadsheet Chaos

### What happens

Sales reps maintain personal spreadsheets (Google Sheets, Excel) for contacts and deals. Each rep has a different structure, naming convention, and update cadence. The "CRM" is a shared Google Sheet that drifts out of sync within days.

### Real consequences

- Duplicate contacts across rep spreadsheets lead to multiple reps calling the same prospect.
- No single source of truth for deal stage. Manager asks "what's in the pipeline?" and gets a different answer from each rep.
- Copy-paste errors corrupt phone numbers, email addresses, and deal values.
- Version conflicts when two reps edit the shared sheet simultaneously.
- Historical data is lost when reps leave or sheets are accidentally deleted.

### Who feels it

- **Sales reps**: waste 30-60 minutes/day on data entry and cross-referencing.
- **Sales managers**: cannot produce a reliable pipeline report without manually aggregating spreadsheets.
- **Founders/owners**: make revenue forecasts based on stale or inconsistent data.

## Pain Point 2: Lost Follow-Ups

### What happens

Follow-up tasks live in a mix of calendar reminders, sticky notes, email flags, and memory. There is no centralized task system tied to contacts or deals. When a rep is busy closing one deal, follow-ups for other prospects slip through the cracks.

### Real consequences

- Prospects go cold because nobody followed up within 48 hours.
- Reps double-contact prospects ("Didn't my colleague already call you?").
- No escalation path: if a follow-up is overdue, nobody is automatically notified.
- Warm referrals from existing customers are lost because the note was on a Post-it.

### Who feels it

- **Sales reps**: lose winnable deals due to timing failures.
- **Customers/prospects**: receive inconsistent communication, eroding trust.
- **Sales managers**: discover lost opportunities only in retrospective reviews.

## Pain Point 3: No Pipeline Visibility

### What happens

Without a visual pipeline, deals exist as line items in a flat list. There is no stage-based view showing how many deals are in qualification vs. proposal vs. negotiation. Forecasting is guesswork.

### Real consequences

- Manager cannot identify bottlenecks (e.g., 15 deals stuck in "proposal sent" for 3+ weeks).
- No early warning when pipeline coverage drops below target.
- Revenue forecasts are off by 30-50% because stage probabilities are not tracked.
- End-of-quarter surprises: deals that were "95% sure" fall through with no warning.

### Who feels it

- **Sales managers**: spend hours building manual pipeline reports.
- **Founders**: make hiring and investment decisions on unreliable revenue projections.
- **Finance**: cannot plan cash flow without pipeline data.

## Pain Point 4: Manual Reporting

### What happens

Weekly sales meetings require reports that are assembled manually: pulling data from spreadsheets, email, and memory. The report is outdated by the time it is presented.

### Real consequences

- 2-4 hours/week per manager spent assembling reports instead of coaching reps.
- Reports reflect last week's reality, not today's.
- Inconsistent metrics: each report uses slightly different definitions of "qualified lead" or "active deal."
- No trend analysis because historical snapshots are not preserved.

### Who feels it

- **Sales managers**: the primary report assembler.
- **Executives**: receive reports they cannot trust or compare week-over-week.
- **Sales reps**: attend meetings driven by inaccurate data.

## Pain Point 5: Context Loss on Handoffs

### What happens

When a deal is handed from an SDR to an AE, or when a rep goes on vacation, the receiving person has no structured record of prior interactions. Notes are scattered across email threads, chat messages, and personal documents.

### Real consequences

- New rep asks the prospect to repeat information already shared, damaging credibility.
- Important details about budget, timeline, or decision-makers are lost.
- Onboarding a new rep takes weeks because tribal knowledge is not captured.

### Who feels it

- **Incoming reps**: start from zero on handed-off deals.
- **Prospects**: frustrated by repeating themselves.
- **Managers**: see deal velocity drop during transitions.

## Pain Point 6: Onboarding Friction with Existing CRMs

### What happens

Enterprise CRMs (Salesforce, Dynamics) are too complex and expensive. Even mid-market CRMs require significant setup: custom fields, pipeline stages, integrations, user roles. SME teams try a CRM, spend a week configuring it, and abandon it because adoption stalls.

### Real consequences

- Teams cycle through 2-3 CRMs before giving up and returning to spreadsheets.
- Sunk cost of configuration time (often 10-20 hours) with no return.
- Data scattered across abandoned CRM trials.

### Who feels it

- **Everyone on the team**: wasted time on tools that did not stick.
- **IT/admin**: pressured to support tools the team stops using.

## SME-Specific Constraints

| Constraint | Implication for MVP |
|---|---|
| No IT department | Setup must be self-service, under 15 minutes |
| Budget under $50/user/month | Pricing must undercut or match HubSpot Free tier value |
| Teams of 2-25 | Multi-user collaboration from day one, but no complex role hierarchies |
| Non-technical users | UI must be immediately intuitive, no training required |
| Data already in spreadsheets | CSV import is a day-one requirement |
| Mobile usage | Reps in the field need mobile-responsive access at minimum |

## Target User Profiles

**Sales Manager (2-10 reps):** Needs pipeline visibility, opportunity aging indicators, and a dashboard view without manual spreadsheet work.

**Account Executive:** Needs a fast way to log contacts, track opportunity stages, set follow-up tasks, and review notes before calls.

**Service/Support Lead:** Needs to see customer history, log interaction notes, assign follow-up tasks to team members.

**Founder/Owner (solo or small team):** Wears all hats. Needs the simplest possible system that keeps customer relationships from falling through the cracks.

## What the MVP Must Solve

1. **Single source of truth** for contacts, companies, and deals (eliminates spreadsheet chaos).
2. **Task management tied to contacts/deals** with due dates and assignments (eliminates lost follow-ups).
3. **Visual pipeline** with drag-and-drop stage management (provides pipeline visibility).
4. **Dashboard with key metrics** updated in real-time (eliminates manual reporting).
5. **Notes on every record** with timestamps and author attribution (eliminates context loss).

## What the MVP Explicitly Does Not Solve

- Email integration / tracking
- Marketing automation
- Phone/VoIP integration
- Advanced analytics / AI forecasting
- Custom field builder
- API / third-party integrations
- Territory management
- Quote / proposal generation
