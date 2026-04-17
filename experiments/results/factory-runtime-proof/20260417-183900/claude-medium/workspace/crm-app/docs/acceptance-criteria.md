# Acceptance Criteria

Criteria are numbered AC-01 through AC-18, mapped to user stories US-01 through US-15 from the PRD. Format: Given/When/Then.

---

## AC-01: Add and Edit Contacts (US-01)

**AC-01a: Create a contact with required fields**
- Given I am logged in as a Sales Rep
- When I navigate to Contacts, click "Add Contact", fill in first name and last name, and submit
- Then a new contact is created, owned by me, visible in the Contacts list

**AC-01b: Validation rejects missing required fields**
- Given I am on the Add Contact form
- When I submit without a first name or last name
- Then the form shows a validation error and the contact is not created

**AC-01c: Edit an existing contact**
- Given a contact exists that I own
- When I open its detail page, change the phone number, and save
- Then the contact record is updated and the new phone number is displayed

---

## AC-02: Contact Ownership (US-01)

**AC-02a: Contact is scoped to organization**
- Given I belong to Organization A
- When I create a contact
- Then the contact is associated with Organization A and not visible to Organization B users

---

## AC-03: Contact Detail View (US-02)

**AC-03a: Detail page shows linked data**
- Given a contact exists with notes, linked opportunities, and open tasks
- When I open the contact detail page
- Then I see the contact's basic info, all notes (most recent first), linked opportunities with stage, and open tasks with due dates

**AC-03b: Navigation to linked entities**
- Given I am viewing a contact detail page with a linked company
- When I click the company name
- Then I am navigated to the company detail page

---

## AC-04: Create Opportunities (US-03)

**AC-04a: Create an opportunity with required fields**
- Given I am logged in as a Sales Rep and at least one pipeline stage exists
- When I create an opportunity with title, value, expected close date, and select a stage
- Then the opportunity appears in the pipeline board in the selected stage

**AC-04b: Validation on opportunity creation**
- Given I am on the Create Opportunity form
- When I submit without a title or without selecting a stage
- Then the form shows a validation error and the opportunity is not created

---

## AC-05: Move Opportunities Through Pipeline (US-03)

**AC-05a: Change opportunity stage**
- Given an opportunity exists in stage "Qualification"
- When I move it to stage "Proposal"
- Then the opportunity's stage is updated to "Proposal" and the pipeline board reflects the change

**AC-05b: Stage transition is recorded**
- Given I move an opportunity from one stage to another
- When I view the opportunity detail
- Then the last stage change timestamp is visible

---

## AC-06: Create Tasks (US-04)

**AC-06a: Create a task with due date**
- Given I am logged in
- When I create a task with title "Follow up with Acme" and due date of tomorrow
- Then the task appears in my task list with the correct due date

**AC-06b: Link task to entity**
- Given a contact "Jane Doe" exists
- When I create a task linked to that contact
- Then the task appears on Jane Doe's detail page under tasks

---

## AC-07: Complete Tasks (US-04)

**AC-07a: Mark task complete**
- Given a task exists that is assigned to me and not completed
- When I mark it as completed
- Then the task shows as completed with a timestamp and no longer appears in overdue lists

---

## AC-08: Add Notes (US-05)

**AC-08a: Add a note to a contact**
- Given I am viewing a contact detail page
- When I type a note and submit
- Then the note is saved with my name as author and the current timestamp, and appears at the top of the notes list

**AC-08b: Notes are visible to all org members**
- Given User A adds a note to a contact
- When User B (same org) views that contact
- Then User B sees User A's note

---

## AC-09: Dashboard Pipeline Summary (US-06)

**AC-09a: Pipeline value by stage**
- Given opportunities exist across multiple stages
- When I view the Dashboard
- Then I see each stage with its total opportunity value and count

**AC-09b: Click-through to filtered view**
- Given I am on the Dashboard
- When I click a pipeline stage in the summary
- Then I see a filtered list of opportunities in that stage

---

## AC-10: Dashboard Overdue Tasks (US-07)

**AC-10a: Manager sees team-wide overdue tasks**
- Given I am logged in as a Sales Manager and tasks assigned to my team members are past due
- When I view the Dashboard
- Then I see all overdue tasks across my team with assignee names and due dates

**AC-10b: Rep sees only personal overdue tasks**
- Given I am logged in as a Sales Rep with overdue tasks
- When I view the Dashboard
- Then I see only my own overdue tasks, not those of other reps

---

## AC-11: Search Contacts (US-09)

**AC-11a: Search by name**
- Given contacts "Jane Doe" and "John Smith" exist in my org
- When I type "Jane" in the search bar
- Then "Jane Doe" appears in results and "John Smith" does not

**AC-11b: Search by email**
- Given a contact with email "jane@acme.com" exists
- When I search for "jane@acme"
- Then the contact appears in results

**AC-11c: Search respects org boundary**
- Given "Jane Doe" exists in Org A and "Jane Roe" exists in Org B
- When I (Org A user) search for "Jane"
- Then only "Jane Doe" appears; "Jane Roe" is not returned

---

## AC-12: Invite Users (US-11)

**AC-12a: Admin invites a new user**
- Given I am logged in as an Admin
- When I enter an email address and select role "Sales Rep" and submit
- Then a new user account is created (or invitation sent) with the Sales Rep role in my organization

**AC-12b: Non-admin cannot invite users**
- Given I am logged in as a Sales Rep
- When I attempt to access the user management page
- Then I am denied access (403 or UI hides the option)

---

## AC-13: Manage Roles (US-11)

**AC-13a: Admin changes a user's role**
- Given I am an Admin and user "Bob" has the role Sales Rep
- When I change Bob's role to Sales Manager
- Then Bob's permissions update to match Sales Manager on his next request

**AC-13b: Admin deactivates a user**
- Given I am an Admin and user "Bob" is active
- When I deactivate Bob's account
- Then Bob cannot log in and his session is invalidated

---

## AC-14: Configure Pipeline Stages (US-12)

**AC-14a: Admin adds a stage**
- Given I am an Admin
- When I add a new stage "Negotiation" at position 3
- Then the stage appears in the pipeline board at position 3 for all users

**AC-14b: Admin reorders stages**
- Given stages exist in order: Prospect, Qualification, Proposal, Closed
- When I move "Proposal" to position 2
- Then the pipeline board shows: Prospect, Proposal, Qualification, Closed

**AC-14c: Cannot remove stage with opportunities**
- Given stage "Qualification" contains 5 opportunities
- When I attempt to delete "Qualification"
- Then the system rejects the deletion with a message indicating the stage is in use

---

## AC-15: Authentication (US-13, US-14)

**AC-15a: Successful login**
- Given I have a registered account with email "user@example.com" and a valid password
- When I enter correct credentials on the login page
- Then I am redirected to the Dashboard and see only my organization's data

**AC-15b: Failed login**
- Given I enter an incorrect password
- When I submit the login form
- Then I see "Invalid email or password" and no session is created

**AC-15c: Session expiry**
- Given I have been inactive for more than 24 hours
- When I attempt to access a protected page
- Then I am redirected to the login page

**AC-15d: Org data isolation**
- Given I am logged into Org A
- When I request any API endpoint
- Then the response contains only Org A data, regardless of query parameters

---

## AC-16: Filter by Owner (US-08)

**AC-16a: Manager filters contacts by owner**
- Given I am logged in as a Sales Manager and contacts exist owned by different reps
- When I select a rep from the owner filter on the Contacts list
- Then only contacts owned by that rep are displayed

**AC-16b: Manager filters opportunities by owner**
- Given I am logged in as a Sales Manager and opportunities exist owned by different reps
- When I select a rep from the owner filter on the Pipeline view
- Then only that rep's opportunities are displayed

---

## AC-17: Service Agent Logs Notes (US-10)

**AC-17a: Service agent adds note during call**
- Given I am logged in as a Service Agent and viewing a contact detail page
- When I type a note and submit
- Then the note is saved with my name as author and the current timestamp, and is visible to all org members

---

## AC-18: Link Contacts to Companies (US-15)

**AC-18a: Link contact to existing company**
- Given I am editing a contact and a company "Acme Corp" exists in my org
- When I select "Acme Corp" from the company field and save
- Then the contact is linked to "Acme Corp" and appears on the company's detail page under contacts

**AC-18b: View company from contact**
- Given a contact is linked to company "Acme Corp"
- When I view the contact detail page
- Then "Acme Corp" is displayed as a clickable link that navigates to the company detail page

---

## Traceability Matrix

| AC | User Story | Use Case | Persona |
|----|-----------|----------|---------|
| AC-01 | US-01 | UC-01 | P1, P3 |
| AC-02 | US-01 | UC-01 | P1, P3 |
| AC-03 | US-02 | UC-02 | P1, P3 |
| AC-04 | US-03 | UC-03 | P1 |
| AC-05 | US-03 | UC-03 | P1 |
| AC-06 | US-04 | UC-04 | P1, P3 |
| AC-07 | US-04 | UC-04 | P1, P3 |
| AC-08 | US-05 | UC-05 | P1, P3 |
| AC-09 | US-06 | UC-06 | P2 |
| AC-10 | US-07 | UC-06 | P2 |
| AC-11 | US-09 | UC-07 | P3 |
| AC-12 | US-11 | UC-08 | P4 |
| AC-13 | US-11 | UC-08 | P4 |
| AC-14 | US-12 | UC-09 | P4 |
| AC-15 | US-13, US-14 | UC-10 | All |
| AC-16 | US-08 | UC-06 | P2 |
| AC-17 | US-10 | UC-05 | P3 |
| AC-18 | US-15 | UC-01 | P1 |
