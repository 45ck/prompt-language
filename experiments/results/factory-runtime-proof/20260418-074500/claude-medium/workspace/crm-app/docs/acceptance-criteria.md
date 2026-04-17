# Acceptance Criteria — SME CRM MVP

## AC-1: Authentication

- [ ] User can sign up with name, email, password, and org name
- [ ] Sign up creates an organization and assigns admin role
- [ ] User can log in with email and password
- [ ] User can log out
- [ ] Invalid credentials show "Invalid email or password" (no enumeration)
- [ ] Admin can invite team members by email
- [ ] Invited user can sign up and joins the correct org as member
- [ ] Unauthenticated users are redirected to `/login`
- [ ] Sessions expire after 24 hours

## AC-2: Contacts

- [ ] User can create a contact with firstName, lastName, email (required), phone, company
- [ ] User can view contact list with search by name or email
- [ ] User can view contact detail showing notes, tasks, and linked opportunities
- [ ] User can edit contact fields
- [ ] User can soft-delete a contact (disappears from list, recoverable for 30 days)
- [ ] Contacts are scoped to the user's organization

## AC-3: Companies

- [ ] User can create a company with name (required), website, industry
- [ ] User can view company list
- [ ] User can view company detail showing linked contacts and opportunities
- [ ] User can edit company fields
- [ ] User can soft-delete a company

## AC-4: CSV Import

- [ ] User can upload a CSV file on `/contacts/import`
- [ ] System validates required headers (firstName, lastName, email)
- [ ] System shows preview of first 5 rows before confirmation
- [ ] On confirm, contacts are created; companies are auto-created by companyName
- [ ] Duplicate companies (by name) are linked, not re-created
- [ ] Rows with missing required fields are skipped and listed in error summary
- [ ] Import capped at 10,000 rows

## AC-5: Opportunities

- [ ] User can create an opportunity with name, value, expected close date, stage, contact, company, assignee
- [ ] User can view opportunity detail with notes and tasks
- [ ] User can edit opportunity fields
- [ ] Opportunity value accepts decimal numbers
- [ ] Expected close date is a valid date (past dates allowed for historical entry)

## AC-6: Pipeline Board

- [ ] Pipeline board shows opportunities as cards grouped by stage columns
- [ ] Cards show opportunity name, value, contact name, and assignee
- [ ] User can drag-and-drop a card to change its stage
- [ ] Pipeline board can be filtered by assignee
- [ ] Default stages are created on org setup: New Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost
- [ ] Stages render in configured position order

## AC-7: Tasks

- [ ] User can create a task with title (required), description, due date, assignee
- [ ] Task can be linked to a contact, opportunity, or both
- [ ] User can mark a task as complete
- [ ] Task list page supports filtering by assignee and due date (today, overdue, upcoming)
- [ ] Tasks are scoped to the user's organization

## AC-8: Notes

- [ ] User can add a note to a contact or opportunity
- [ ] Notes display author name and timestamp
- [ ] Notes are listed in reverse chronological order on detail pages
- [ ] Notes cannot be edited or deleted in MVP (append-only)

## AC-9: Dashboard

- [ ] Dashboard shows pipeline value grouped by stage as a bar chart
- [ ] Dashboard shows tasks due today (count and list)
- [ ] Dashboard shows overdue tasks (count and list)
- [ ] Dashboard shows recent activity feed (last 20 items: notes added, stages changed, tasks completed)
- [ ] Dashboard data loads within 500ms

## AC-10: Pipeline Stage Configuration

- [ ] Admin can add a new pipeline stage
- [ ] Admin can rename an existing stage
- [ ] Admin can reorder stages via drag-and-drop or up/down arrows
- [ ] Admin cannot delete a stage that has active opportunities (show error)
- [ ] Admin can delete an empty stage
- [ ] Members cannot modify pipeline stages

## AC-11: General

- [ ] All pages are responsive down to 375px viewport width
- [ ] All forms show validation errors inline (Zod schema validation)
- [ ] Navigation includes: Dashboard, Contacts, Companies, Pipeline, Tasks, Settings
- [ ] Current user name shown in header with logout option
- [ ] 404 page for unknown routes
- [ ] Loading skeletons on data-heavy pages
