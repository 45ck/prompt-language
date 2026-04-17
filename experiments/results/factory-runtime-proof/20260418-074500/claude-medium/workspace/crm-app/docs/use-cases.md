# Use Cases — SME CRM MVP

## UC-1: Sign Up and Create Organization

**Actor**: Alex (Admin)
**Precondition**: None
**Main flow**:
1. Navigate to `/signup`
2. Enter name, email, password, organization name
3. System creates org and admin user
4. Redirect to `/dashboard`

**Postcondition**: Org exists with one admin user. Default pipeline stages created (New Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost).

---

## UC-2: Invite Team Member

**Actor**: Alex (Admin)
**Precondition**: Logged in as admin
**Main flow**:
1. Navigate to `/settings`
2. Enter team member email
3. System sends invite email with signup link
4. Team member signs up via link, joins org as "member" role

**Postcondition**: New user exists in org with member role.

---

## UC-3: Import Contacts from CSV

**Actor**: Alex (Admin)
**Precondition**: Logged in. Has CSV file with columns: firstName, lastName, email, phone, companyName
**Main flow**:
1. Navigate to `/contacts/import`
2. Upload CSV file
3. System validates headers and shows preview (first 5 rows)
4. Confirm import
5. System creates contacts and auto-creates companies by companyName (dedup by name)
6. Show import summary (created, skipped, errors)

**Alternate flow**: CSV has missing required fields → show error listing missing columns, abort import.
**Postcondition**: Contacts and companies created. Error rows reported.

---

## UC-4: Create Contact

**Actor**: Sam (Sales Rep)
**Precondition**: Logged in
**Main flow**:
1. Click "New Contact" from contacts list or global action
2. Enter firstName, lastName, email (required), phone, select company
3. Save

**Postcondition**: Contact created, linked to company if selected.

---

## UC-5: Create Opportunity and Assign to Pipeline

**Actor**: Sam (Sales Rep)
**Precondition**: Logged in. At least one contact exists.
**Main flow**:
1. From contact detail or pipeline board, click "New Opportunity"
2. Enter name, value, expected close date, select contact, select company, select stage
3. Save

**Postcondition**: Opportunity created at selected stage, visible on pipeline board.

---

## UC-6: Move Opportunity Through Pipeline

**Actor**: Sam (Sales Rep)
**Precondition**: Opportunity exists on pipeline board
**Main flow**:
1. Open pipeline board at `/pipeline`
2. Drag opportunity card from current stage to target stage
3. System updates stage, logs activity

**Postcondition**: Opportunity stage updated. Activity feed shows the change.

---

## UC-7: Create and Complete Task

**Actor**: Sam (Sales Rep)
**Precondition**: Logged in
**Main flow**:
1. From contact or opportunity detail, click "New Task"
2. Enter title, description (optional), due date, assignee
3. Save
4. Later: mark task as complete from task list or detail page

**Postcondition**: Task created and linked. Completion recorded.

---

## UC-8: Add Note to Contact

**Actor**: Sam (Sales Rep)
**Precondition**: Viewing contact detail
**Main flow**:
1. Type note content in text area
2. Save

**Postcondition**: Note created with author and timestamp, visible on contact detail.

---

## UC-9: View Dashboard

**Actor**: Maria (Sales Manager)
**Precondition**: Logged in. Pipeline has opportunities.
**Main flow**:
1. Navigate to `/dashboard`
2. View pipeline value by stage (bar chart)
3. View tasks due today
4. View overdue tasks
5. View recent activity feed

**Postcondition**: None (read-only).

---

## UC-10: Configure Pipeline Stages

**Actor**: Alex (Admin)
**Precondition**: Logged in as admin
**Main flow**:
1. Navigate to `/settings`
2. View current pipeline stages
3. Add, rename, reorder, or remove stages (cannot remove stage with active opportunities)

**Postcondition**: Pipeline stages updated. Board reflects new order.
