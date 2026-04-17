# C4 Context Diagram -- CRM MVP

## System Boundary

```
+--------------------------------------------------------------------+
|                        CRM Application                             |
|  (Web-based CRM for small-to-medium sales/service teams, 5-50)    |
+--------------------------------------------------------------------+
```

## External Actors

| Actor          | Role                                                    |
| -------------- | ------------------------------------------------------- |
| Sales Rep      | Creates/manages contacts, companies, opportunities,     |
|                | tasks, and notes. Moves deals through pipeline stages.  |
| Manager        | Everything a Rep can do, plus views dashboard, manages  |
|                | team pipeline, and reassigns opportunities.             |
| Service Agent  | Views contacts and companies, creates tasks and notes.  |
|                | Read-only access to opportunities.                      |
| Admin          | Full system access. Manages users, roles, pipeline      |
|                | stage configuration, and invitation links.              |

## External Systems

| System          | Description                                            |
| --------------- | ------------------------------------------------------ |
| PostgreSQL      | Primary relational data store. Hosts all CRM entities. |
| Google OAuth    | Identity provider for SSO login via NextAuth.js.       |

## Data Flow Diagram

```
                     +---------------+
                     | Google OAuth  |
                     |  (IdP / SSO)  |
                     +-------+-------+
                             |
                     OAuth 2.0 token exchange
                             |
                             v
+----------+         +------+-------+         +--------------+
| Sales    | HTTPS   |              | SQL/TCP |              |
| Rep      +-------->+              +-------->+  PostgreSQL  |
+----------+         |              |         |  Database    |
                     |  CRM App     |<--------+              |
+----------+  HTTPS  |  (Next.js)   |         +--------------+
| Manager  +-------->+              |
+----------+         |              |
                     |              |
+----------+  HTTPS  |              |
| Service  +-------->+              |
| Agent    |         |              |
+----------+         |              |
                     |              |
+----------+  HTTPS  |              |
| Admin    +-------->+              |
+----------+         +--------------+
```

## Data Flow Summary

1. **Browser to CRM App** -- All actors interact via HTTPS. The Next.js App Router serves both the React UI and the API routes from a single deployment.
2. **CRM App to Google OAuth** -- NextAuth.js initiates the OAuth 2.0 authorization code flow. Google returns an ID token; the app maps it to a local User record.
3. **CRM App to PostgreSQL** -- Prisma ORM issues SQL queries over a TCP connection. All reads and writes for contacts, companies, opportunities, pipeline stages, tasks, notes, and user/role data flow through this channel.
4. **PostgreSQL to CRM App** -- Query results and change confirmations return to the API layer, which serializes them as JSON for the frontend.

## Trust Boundaries

- **Browser boundary**: All input from the browser is untrusted. Server-side validation is required on every API route.
- **Database boundary**: The application owns the database schema. No direct external access is permitted. Connection credentials are injected via environment variables and never exposed to the client.
- **OAuth boundary**: Token validation occurs server-side in NextAuth.js callbacks. The client never sees raw OAuth secrets.
