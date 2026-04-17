# Product Requirements Document — CRM MVP

## 1. Problem Statement

Small-to-medium sales and service teams (5-50 people) rely on spreadsheets, scattered notes, and disconnected tools to track contacts, deals, and tasks. This leads to lost opportunities, duplicated effort, and zero pipeline visibility for managers. They need a simple, affordable CRM that is quick to adopt and covers the essentials without enterprise bloat.

## 2. Target Users

| Segment | Size | Characteristics |
|---------|------|-----------------|
| Small sales teams | 5-20 users | No dedicated IT, need self-service setup |
| Medium sales & service teams | 20-50 users | May have a part-time admin, need basic reporting |

## 3. MVP Scope

### In Scope

- User authentication (email/password, session management)
- Role-based access: Admin, Sales Manager, Sales Rep, Service Agent
- Contact management (CRUD, search, filter)
- Company management (CRUD, link to contacts)
- Opportunity tracking with pipeline stages
- Configurable pipeline stages (per-org)
- Task management (create, assign, complete, due dates)
- Notes on contacts, companies, and opportunities
- Dashboard with pipeline summary and task overview

### Out of Scope (deferred post-MVP)

- Email integration / sync
- Calendar integration
- Workflow automation / triggers
- Custom fields
- Import/export (CSV, etc.)
- Mobile native app (responsive web only)
- Multi-currency support
- Reporting beyond dashboard summaries
- API for third-party integrations
- File attachments
- Lead scoring
- Territories / team hierarchy

## 4. Core Entities

| Entity | Description | Key Fields |
|--------|-------------|------------|
| User | Authenticated team member | id, email, name, role, orgId |
| Organization | Tenant boundary | id, name, createdAt |
| Contact | Individual person | id, firstName, lastName, email, phone, companyId, ownerId |
| Company | Business entity | id, name, industry, website, ownerId |
| Opportunity | Potential deal | id, title, value, stageId, contactId, companyId, ownerId, expectedCloseDate |
| PipelineStage | Column in pipeline board | id, name, position, orgId |
| Task | Action item | id, title, description, dueDate, completed, assigneeId, entityType, entityId |
| Note | Free-text annotation | id, body, authorId, entityType, entityId, createdAt |

## 5. User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| US-01 | Sales Rep | As a sales rep, I want to add and edit contacts so I can maintain my prospect list. | Must |
| US-02 | Sales Rep | As a sales rep, I want to view a contact's details, notes, and linked opportunities in one place. | Must |
| US-03 | Sales Rep | As a sales rep, I want to create opportunities and move them through pipeline stages so I can track deal progress. | Must |
| US-04 | Sales Rep | As a sales rep, I want to create tasks with due dates so I remember follow-ups. | Must |
| US-05 | Sales Rep | As a sales rep, I want to add notes to contacts, companies, and opportunities so I can record context. | Must |
| US-06 | Sales Manager | As a sales manager, I want a dashboard showing pipeline value by stage so I can forecast revenue. | Must |
| US-07 | Sales Manager | As a sales manager, I want to see overdue tasks across my team so I can intervene early. | Must |
| US-08 | Sales Manager | As a sales manager, I want to filter contacts and opportunities by owner so I can review rep performance. | Should |
| US-09 | Service Agent | As a service agent, I want to search contacts by name, email, or company so I can pull up records quickly during calls. | Must |
| US-10 | Service Agent | As a service agent, I want to log notes on a contact during a call so the next agent has context. | Must |
| US-11 | Admin | As an admin, I want to invite users and assign roles so I can control access. | Must |
| US-12 | Admin | As an admin, I want to configure pipeline stages so they match our sales process. | Should |
| US-13 | Any | As a user, I want to log in securely with email and password. | Must |
| US-14 | Any | As a user, I want to see only data belonging to my organization. | Must |
| US-15 | Sales Rep | As a sales rep, I want to link contacts to companies so I can see organizational relationships. | Should |

## 6. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Core workflow completable | A rep can create a contact, add an opportunity, move it through stages, and close it | End-to-end test |
| Page load time | < 2 seconds on 4G connection | Lighthouse / synthetic monitoring |
| Onboarding time | New user can create a contact, add a note, and create a task within 15 minutes without training | Usability test with 3 participants |
| Data isolation | Zero cross-org data leakage | Automated security test |
| Uptime | 99.5% monthly | Monitoring |
| Concurrent users | 50 without degradation | Load test |
