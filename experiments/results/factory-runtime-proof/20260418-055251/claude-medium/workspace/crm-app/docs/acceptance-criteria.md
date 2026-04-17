# Acceptance Criteria — SME CRM MVP

All criteria are in Given/When/Then format. Each feature section covers the happy path and key edge cases.

---

## 1. Authentication

### AC-1.1: Sign up with valid credentials
- **Given** I am on the sign-up page
- **When** I enter a valid name, email, and password (min 8 chars, 1 uppercase, 1 number)
- **Then** the system creates my account and organization, signs me in, and redirects to the dashboard

### AC-1.2: Sign up with existing email
- **Given** an account with email "alex@acme.com" already exists
- **When** I attempt to sign up with "alex@acme.com"
- **Then** the system displays "An account with this email already exists" and does not create a duplicate

### AC-1.3: Sign up with weak password
- **Given** I am on the sign-up page
- **When** I enter a password shorter than 8 characters or missing uppercase/number
- **Then** the system displays a specific validation message and does not create the account

### AC-1.4: Sign in with valid credentials
- **Given** I have an existing account
- **When** I enter the correct email and password
- **Then** the system creates a session and redirects me to the dashboard

### AC-1.5: Sign in with invalid credentials
- **Given** I am on the sign-in page
- **When** I enter an incorrect email or password
- **Then** the system displays "Invalid email or password" without revealing which field is wrong

### AC-1.6: Sign out
- **Given** I am signed in
- **When** I click "Sign out"
- **Then** my session is destroyed and I am redirected to the sign-in page

### AC-1.7: Session expiry
- **Given** I have been inactive for more than 24 hours
- **When** I attempt to access any authenticated page
- **Then** the system redirects me to the sign-in page with the message "Your session has expired"

### AC-1.8: Rate limiting on failed login
- **Given** I have failed to sign in 5 times within 15 minutes
- **When** I attempt a 6th sign-in
- **Then** the system blocks the attempt and displays "Too many login attempts. Try again in 15 minutes."

---

## 2. Contacts

### AC-2.1: Create a contact
- **Given** I am signed in
- **When** I click "New Contact", fill in first name and last name, and click "Save"
- **Then** the system creates the contact and displays the contact detail page

### AC-2.2: Create a contact with company link
- **Given** I am signed in and a company "Acme Corp" exists
- **When** I create a new contact and select "Acme Corp" as the company
- **Then** the contact is linked to "Acme Corp" and appears on the company's detail page

### AC-2.3: Edit a contact
- **Given** a contact "Alex Johnson" exists
- **When** I change the last name to "Smith" and click "Save"
- **Then** the contact is updated and displays "Alex Smith"

### AC-2.4: Delete a contact
- **Given** a contact "Alex Johnson" exists
- **When** I click "Delete" and confirm
- **Then** the contact is removed from the contacts list (soft-deleted)

### AC-2.5: Required field validation
- **Given** I am creating a new contact
- **When** I leave first name blank and click "Save"
- **Then** the system highlights the first name field and prevents save

### AC-2.6: View contacts list
- **Given** 150 contacts exist in my organization
- **When** I navigate to the contacts list
- **Then** the system displays the first 50 contacts with pagination controls

### AC-2.7: Contact detail shows related entities
- **Given** a contact has 2 notes, 1 task, and 1 linked opportunity
- **When** I view the contact detail page
- **Then** I see all related notes, tasks, and opportunities on the page

---

## 3. Companies

### AC-3.1: Create a company
- **Given** I am signed in
- **When** I click "New Company", enter "Acme Corp" as the name, and click "Save"
- **Then** the system creates the company and displays the company detail page

### AC-3.2: Edit a company
- **Given** a company "Acme Corp" exists
- **When** I change the industry to "Technology" and click "Save"
- **Then** the company is updated with industry "Technology"

### AC-3.3: Delete a company with linked contacts
- **Given** "Acme Corp" has 3 linked contacts
- **When** I click "Delete" on "Acme Corp"
- **Then** the system shows a warning listing the 3 linked contacts, and on confirmation, soft-deletes the company and unlinks (but does not delete) the contacts

### AC-3.4: Required field validation
- **Given** I am creating a new company
- **When** I leave the name blank and click "Save"
- **Then** the system highlights the name field and prevents save

### AC-3.5: Company detail shows linked contacts and opportunities
- **Given** a company has 5 contacts and 3 opportunities
- **When** I view the company detail page
- **Then** I see all linked contacts, opportunities, notes, and tasks

---

## 4. Opportunities and Pipeline

### AC-4.1: Create an opportunity
- **Given** I am signed in
- **When** I click "New Opportunity", enter name "Website Redesign", value "$15,000", stage "Qualified", and click "Save"
- **Then** the system creates the opportunity and it appears in the "Qualified" column of the pipeline view

### AC-4.2: Drag and drop stage change
- **Given** an opportunity "Website Redesign" is in the "Qualified" stage
- **When** I drag the opportunity card to the "Proposal" column in the pipeline view
- **Then** the opportunity stage updates to "Proposal" and the card appears in the "Proposal" column

### AC-4.3: Keyboard-accessible stage change
- **Given** I am using keyboard navigation on the pipeline view
- **When** I focus on an opportunity card and press Alt+Right Arrow (or Alt+Left Arrow)
- **Then** the opportunity moves to the next (or previous) stage and focus remains on the card

### AC-4.4: Edit opportunity details
- **Given** an opportunity "Website Redesign" exists with value "$15,000"
- **When** I open it, change the value to "$20,000", and click "Save"
- **Then** the opportunity value updates to "$20,000" and the pipeline view reflects the new value

### AC-4.5: Close opportunity as Won
- **Given** an opportunity is in the "Negotiation" stage
- **When** I move it to "Closed Won"
- **Then** the system records the close date and the opportunity no longer appears in the active pipeline count on the dashboard

### AC-4.6: Close opportunity as Lost
- **Given** an opportunity is in the "Proposal" stage
- **When** I move it to "Closed Lost" and enter a reason "Budget cut"
- **Then** the system records the close date and reason, and the opportunity is excluded from pipeline value

### AC-4.7: Pipeline view shows correct totals
- **Given** 3 opportunities exist: $10K (Qualified), $20K (Proposal), $15K (Closed Won)
- **When** I view the pipeline
- **Then** the "Qualified" column header shows "$10,000 (1)", the "Proposal" column shows "$20,000 (1)", and "Closed Won" shows "$15,000 (1)"

### AC-4.8: Required field validation
- **Given** I am creating a new opportunity
- **When** I leave the name blank and click "Save"
- **Then** the system prevents save and highlights the name field

---

## 5. Tasks

### AC-5.1: Create a task
- **Given** I am signed in
- **When** I click "New Task", enter title "Follow up with Alex", set due date to tomorrow, assign to myself, and click "Save"
- **Then** the system creates the task and it appears in my task list

### AC-5.2: Create a task from a contact detail page
- **Given** I am viewing the contact detail page for "Alex Johnson"
- **When** I click "New Task" on that page and fill in the task
- **Then** the task is created and linked to "Alex Johnson", and appears on both the task list and the contact's detail page

### AC-5.3: Complete a task
- **Given** I have a task "Follow up with Alex" that is open
- **When** I click the checkbox next to it
- **Then** the task is marked completed with a completion timestamp and moves to the "Completed" section

### AC-5.4: Uncomplete a task
- **Given** I have a completed task
- **When** I uncheck the checkbox
- **Then** the task returns to the open task list

### AC-5.5: Edit a task
- **Given** a task "Follow up with Alex" exists with due date tomorrow
- **When** I change the due date to next week and click "Save"
- **Then** the task due date is updated

### AC-5.6: Delete a task
- **Given** a task exists
- **When** I click "Delete" and confirm
- **Then** the task is removed from the task list

### AC-5.7: Required field validation
- **Given** I am creating a new task
- **When** I leave the title blank and click "Save"
- **Then** the system prevents save and highlights the title field

### AC-5.8: Overdue tasks highlighted
- **Given** a task has a due date in the past and is not completed
- **When** I view the task list
- **Then** the task is visually distinguished as overdue (e.g., red text or icon)

---

## 6. Notes

### AC-6.1: Add a note to a contact
- **Given** I am viewing the detail page for contact "Alex Johnson"
- **When** I click "Add Note", type "Discussed Q3 budget. Interested in premium plan.", and click "Save"
- **Then** the note appears on the contact's timeline with my name and the current timestamp

### AC-6.2: Add a note to a company
- **Given** I am viewing the detail page for "Acme Corp"
- **When** I click "Add Note", type "Met with procurement team. Budget cycle starts in Q3.", and click "Save"
- **Then** the note appears on the company's timeline with my name and the current timestamp

### AC-6.3: Add a note to an opportunity
- **Given** I am viewing the opportunity "Website Redesign"
- **When** I click "Add Note", type "Proposal sent. Follow up next Tuesday.", and click "Save"
- **Then** the note appears on the opportunity's timeline with my name and the current timestamp

### AC-6.4: Edit own note
- **Given** I authored a note on a contact
- **When** I click "Edit", change the text, and click "Save"
- **Then** the note text updates and shows an "edited" indicator with the edit timestamp

### AC-6.5: Cannot edit another user's note (Member role)
- **Given** I am a Member and another user authored a note
- **When** I view the note
- **Then** no "Edit" or "Delete" buttons are visible

### AC-6.6: Empty note prevention
- **Given** I am adding a note
- **When** I leave the note body blank and click "Save"
- **Then** the system prevents save

### AC-6.7: Note character limit
- **Given** I am adding a note
- **When** I type more than 5000 characters
- **Then** the system indicates the character limit is reached and prevents save

---

## 7. Dashboard

### AC-7.1: Dashboard displays correct open opportunities count
- **Given** my organization has 10 opportunities: 7 open, 2 Closed Won, 1 Closed Lost
- **When** I view the dashboard
- **Then** the "Open Opportunities" card shows "7"

### AC-7.2: Dashboard displays correct pipeline value
- **Given** my organization has open opportunities totaling $150,000
- **When** I view the dashboard
- **Then** the "Total Pipeline Value" card shows "$150,000"

### AC-7.3: Dashboard displays tasks due today
- **Given** I have 3 incomplete tasks due today and 2 due tomorrow
- **When** I view the dashboard
- **Then** the "Tasks Due Today" card shows "3"

### AC-7.4: Dashboard displays overdue tasks
- **Given** I have 2 incomplete tasks with due dates in the past
- **When** I view the dashboard
- **Then** the "Overdue Tasks" card shows "2"

### AC-7.5: Dashboard shows recent activity
- **Given** the team has added notes, moved deals, and completed tasks today
- **When** I view the dashboard
- **Then** the "Recent Activity" section shows the last 10 activities in reverse chronological order

### AC-7.6: Dashboard cards link to relevant views
- **Given** I am viewing the dashboard
- **When** I click the "Open Opportunities" card
- **Then** I am navigated to the pipeline view filtered to open opportunities

### AC-7.7: Empty state for new accounts
- **Given** I just signed up and have no data
- **When** I view the dashboard
- **Then** I see friendly empty states with prompts like "Create your first contact" and "Add your first deal"

### AC-7.8: Dashboard loads within performance target
- **Given** my organization has 5,000 opportunities, 10,000 contacts, and 20,000 tasks
- **When** I load the dashboard
- **Then** the page renders completely in under 500ms (p95)

### AC-7.9: Dashboard data accuracy
- **Given** I create a new opportunity worth $10,000
- **When** I navigate to the dashboard
- **Then** the "Total Pipeline Value" reflects the new total including the $10,000

---

## 8. Cross-Cutting Acceptance Criteria

### AC-8.1: Tenant data isolation
- **Given** two organizations exist: "Acme Corp" and "Beta Inc"
- **When** a user from "Acme Corp" queries contacts
- **Then** they see only contacts belonging to "Acme Corp", never "Beta Inc" data

### AC-8.2: Unauthorized access returns 401
- **Given** I am not signed in
- **When** I attempt to access any API endpoint or page
- **Then** the system returns HTTP 401 and redirects to sign-in

### AC-8.3: Soft delete does not appear in lists
- **Given** a contact has been soft-deleted
- **When** any user views the contacts list or searches
- **Then** the deleted contact does not appear

### AC-8.4: All list views are paginated
- **Given** more than 50 records exist in any entity type
- **When** I view the list
- **Then** results are paginated with 50 per page and navigation controls

### AC-8.5: Concurrent edit handling
- **Given** two users open the same contact detail page
- **When** both edit and save
- **Then** the second save either succeeds with a last-write-wins policy or displays a conflict warning (last-write-wins acceptable for MVP)
