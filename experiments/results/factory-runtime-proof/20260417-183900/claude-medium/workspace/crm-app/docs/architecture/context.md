# C4 Context Diagram -- CRM MVP

## System: CRM Application

A web-based CRM for small-to-medium sales and service teams (5-50 users). Provides contact management, opportunity tracking, task management, notes, and pipeline visibility.

## Diagram

```
+------------------+       +-------------------+       +------------------+
|   Sales Rep      |       |  Sales Manager    |       |  Service Agent   |
|  (Person)        |       |  (Person)         |       |  (Person)        |
+--------+---------+       +---------+---------+       +--------+---------+
         |                           |                          |
         |  Creates contacts,        |  Views dashboard,        |  Searches contacts,
         |  opportunities, tasks,    |  reviews pipeline,       |  logs notes during
         |  moves deals through      |  monitors overdue        |  calls
         |  pipeline stages          |  tasks across team       |
         |                           |                          |
         +----------+----------------+-----------+--------------+
                    |                            |
                    v                            v
         +---------------------------------------------------+
         |                                                   |
         |              CRM Application                      |
         |                                                   |
         |  - User authentication and role-based access      |
         |  - Contact and company management                 |
         |  - Opportunity pipeline tracking                  |
         |  - Task management with due dates                 |
         |  - Notes on contacts, companies, opportunities    |
         |  - Dashboard with pipeline summary                |
         |                                                   |
         +---------------------------+-----------------------+
                                     |
                    +----------------+
                    |  Admin         |
                    |  (Person)      |
                    |                |
                    |  Manages users,|
                    |  roles, and    |
                    |  pipeline      |
                    |  stage config  |
                    +----------------+
```

## External Actors

| Actor | Role | Key Interactions |
|-------|------|------------------|
| Sales Rep | Primary user. Manages own contacts, deals, and tasks. | CRUD contacts, companies, opportunities, tasks, notes. Moves opportunities through pipeline stages. |
| Sales Manager | Supervisory user. Oversees team pipeline and performance. | Views dashboard with pipeline value by stage. Filters by owner. Reviews overdue tasks across the team. |
| Service Agent | Post-sale support user. Handles inbound customer inquiries. | Searches contacts by name/email/company. Logs notes on contacts during calls. Creates follow-up tasks. |
| Admin | System administrator. Controls access and configuration. | Invites users, assigns roles, configures pipeline stages for the organization. |

## External Systems

| System | Type | Interaction |
|--------|------|-------------|
| PostgreSQL Database | Data store | Stores all application data: users, organizations, contacts, companies, opportunities, pipeline stages, tasks, notes. |

## Boundary Notes

- No email integration in MVP. Notes serve as manual call/email logs.
- No third-party integrations (Slack, calendar, etc.) in MVP.
- No mobile native app. The web application uses responsive design.
- Single-tenant database with organization-level data isolation (orgId on all records).
