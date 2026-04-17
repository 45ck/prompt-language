# Use Cases

## UC-01: User Registration and Login

**Actors:** Unregistered User, Registered User

### Registration
1. User enters name, email, and password on the registration page
2. System validates email uniqueness and password strength (8+ chars, at least one letter and one number)
3. System creates account with "Member" role and redirects to dashboard

### Login
1. User enters email and password
2. System verifies credentials, issues JWT, redirects to dashboard

### Password Reset
1. User clicks "Forgot Password" and enters email
2. System sends a reset link valid for 1 hour
3. User sets new password via link and is redirected to login

**Alternatives:** Duplicate email shows error; invalid credentials show "Invalid email or password"; expired reset link offers resend.

---

## UC-02: Manage Contacts

**Actors:** Authenticated User

### Create
1. User clicks "Add Contact" and enters first name, last name, and optionally email, phone, job title, company
2. System validates required fields (first name, last name), saves, and shows detail page

### View and Search
1. Contacts list displays paginated table (25/page) with search by name, email, or company

### Update
1. User edits fields on contact detail page; system validates and saves

### Delete
1. User confirms deletion; system removes contact and its notes, redirects to list

---

## UC-03: Manage Companies

**Actors:** Authenticated User

### Create
1. User enters company name (required) and optionally industry, website, phone, address, employee count
2. System saves and shows detail page with linked contacts, opportunities, and notes

### Update / Delete
- Update: edit fields on detail page, system validates and saves
- Delete: on confirmation, company and its notes are deleted; linked contacts and opportunities are preserved with company field set to null

### Search
- Filter by name or industry on the companies list

---

## UC-04: Manage Opportunities

**Actors:** Authenticated User

**Precondition:** At least one pipeline stage exists

### Create
1. User enters name, value (>= 0), expected close date, pipeline stage
2. Optionally links company, contact, and owner (defaults to self)
3. System saves; opportunity appears on Kanban board

### Move Through Pipeline
1. User drags opportunity card to a new stage column on the Kanban board
2. System updates stage immediately without page reload

### Update / Delete
- Update: edit fields including stage on detail page
- Delete: on confirmation, opportunity and its notes are removed

### Filter
- By stage, owner, or expected close date range

---

## UC-05: Manage Pipeline Stages

**Actors:** Admin only

1. Admin navigates to Settings > Pipeline Stages
2. Admin can add (name + position), rename, reorder (drag-and-drop), or delete stages
3. Deletion blocked if stage has assigned opportunities; system shows count of opportunities that must be moved first

**Default stages:** Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost

---

## UC-06: Manage Tasks

**Actors:** Authenticated User

### Create
1. User enters title, due date, priority (low/medium/high)
2. Optionally assigns to a team member and links to a contact, company, or opportunity
3. System saves with status "open"

### Complete
1. User clicks "Mark Complete"; system sets status to "completed" with timestamp

### View
- Paginated list with filters: status, priority, assignee, due date range
- Overdue tasks visually highlighted

### Update / Delete
- Edit any field; delete with confirmation

---

## UC-07: Add Notes

**Actors:** Authenticated User

### Add
1. User types text on a contact, company, or opportunity detail page and clicks "Add Note"
2. System saves with current user as author and current timestamp
3. Note appears in reverse-chronological feed

### Edit / Delete
- Users can edit or delete their own notes; edited notes show "edited" indicator
- Admins can delete any note; Members cannot modify others' notes

---

## UC-08: View Dashboard

**Actors:** Authenticated User

Dashboard is the default landing page after login. It displays:
- Total contacts, companies, and open opportunities count
- Pipeline value by stage (bar chart)
- Upcoming tasks due in next 7 days
- 5 most recently added contacts
- Win/loss count for the current calendar month

**Empty state:** Each section shows a zero-state message with call-to-action (e.g., "Add your first contact").
