# Use cases (bounded MVP)

## UC-01 Sign in and access the CRM
**Actor:** Any user  
**Outcome:** User can access CRM data for their organization only.

## UC-02 Create a company and contact from an interaction
**Actor:** Sales Rep / Ops Coordinator  
**Trigger:** New inquiry or conversation  
**Main flow:**
1. Create company (if needed).
2. Create contact and associate to company.
3. Add a note with context.
4. Create a follow-up task with due date.

## UC-03 Create an opportunity and set initial stage
**Actor:** Sales Rep  
**Trigger:** Qualified need identified  
**Main flow:**
1. Create opportunity linked to company (and optional primary contact).
2. Set stage and owner.
3. Add a note with qualification summary.
4. Create next-step task (demo/call/proposal).

## UC-04 Progress an opportunity through stages
**Actor:** Sales Rep / Sales Manager  
**Trigger:** Deal status changes  
**Main flow:**
1. Update opportunity stage.
2. Add a note describing outcome/decision.
3. Ensure next-step task exists or explicitly close out follow-ups.

## UC-05 Track follow-ups via tasks
**Actor:** Any user  
**Trigger:** Daily work planning  
**Main flow:**
1. View tasks due today and overdue.
2. Complete tasks when done.
3. Reschedule tasks and optionally add a note to capture outcome.

## UC-06 Capture and review context via notes
**Actor:** Any user  
**Trigger:** Call/meeting/outcome  
**Main flow:**
1. Add a note to contact/company/opportunity.
2. Review notes timeline before a follow-up or during a handoff.

## UC-07 Configure pipeline stages
**Actor:** Sales Manager / Owner  
**Trigger:** Align team process  
**Main flow:**
1. Create/edit/reorder stages.
2. Use stages consistently when creating/updating opportunities.

## UC-08 Review dashboard for pipeline and activity
**Actor:** Sales Manager / Owner / Rep  
**Trigger:** Daily/weekly review  
**Main flow:**
1. Review overdue/due tasks.
2. Review opportunities by stage.
3. Identify items needing attention (stale updates or missing next steps).
