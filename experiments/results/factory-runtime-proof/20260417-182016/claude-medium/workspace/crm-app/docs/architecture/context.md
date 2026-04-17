# C4 Level 1: System Context Diagram

## Overview

The CRM MVP is a self-hosted web application for small-to-medium sales and service teams (5-25 users). It provides contact management, a visual sales pipeline, task tracking, notes, and a summary dashboard.

## Diagram

```
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|    Sales Rep      |     |     Manager       |     |  Support Agent    |
|                   |     |                   |     |                   |
+--------+----------+     +--------+----------+     +--------+----------+
         |                         |                          |
         |  HTTPS (Browser)        |  HTTPS (Browser)         |  HTTPS (Browser)
         |                         |                          |
         +------------+------------+-----------+--------------+
                      |                        |
                      v                        v
              +-------+------------------------+-------+
              |                                        |
              |            CRM Application             |
              |                                        |
              |  - Contact & company management        |
              |  - Sales pipeline (board + list view)   |
              |  - Task tracking                       |
              |  - Notes on entities                   |
              |  - Dashboard summaries                 |
              |  - Role-based access control           |
              |                                        |
              +---+----------------------------+-------+
                  |                            |
                  | TCP/5432                    | Session cookies
                  v                            v
          +-------+--------+          +--------+-----------+
          |                |          |                    |
          |   PostgreSQL   |          |   NextAuth.js      |
          |   Database     |          |   (Session Store)  |
          |                |          |                    |
          +----------------+          +--------------------+

              +-------------------+
              |                   |
              |      Admin        |
              |                   |
              +--------+----------+
                       |
                       |  HTTPS (Browser)
                       |
                       v
               (CRM Application)
```

## Actors

| Actor | Role | Interactions |
|---|---|---|
| Sales Rep | Manages contacts, companies, and opportunities | Creates and updates contacts, moves deals through pipeline, adds notes |
| Manager | Reviews team performance and pipeline health | Views dashboard, monitors pipeline stages, reviews opportunities |
| Support Agent | Tracks tasks and adds notes to customer records | Creates tasks, adds notes to contacts and companies |
| Admin | Configures system settings | Manages users, roles, and pipeline stage definitions |

## External Systems

| System | Purpose | Protocol |
|---|---|---|
| PostgreSQL Database | Persistent storage for all CRM data (users, contacts, companies, opportunities, stages, tasks, notes) | TCP/5432 (Prisma ORM) |
| NextAuth.js | Authentication and session management via credentials provider | HTTP cookies, server-side session |

## Constraints

- All users access the system through a web browser over HTTPS.
- No third-party integrations or external API consumers in MVP scope.
- Single-server deployment via Docker Compose.
- Single timezone, USD currency, English-only interface.
