# Non-Functional Requirements: Bounded CRM MVP

## NFR-1: Tenant isolation
- All reads and writes must be scoped to the authenticated user’s organization/workspace.
- Cross-tenant access must be prevented at the application and data access layers.

## NFR-2: Security baseline
- Authentication must protect all CRM pages from unauthenticated access.
- Secrets must remain server-side.
- Database access must use parameterized queries or ORM protections against injection.
- User-supplied content must be rendered safely to avoid script injection.

## NFR-3: Reliability
- Core CRUD flows for companies, contacts, opportunities, tasks, and notes must either complete successfully or return an explicit error to the user.
- The system must avoid silent data loss.
- Production data must be backed up and restorable.

## NFR-4: Performance
- Primary list views and the dashboard must feel responsive for expected SME usage.
- Lists must support pagination or another bounded loading approach.
- Record detail views and dashboard queries must avoid obvious N+1 access patterns.

## NFR-5: Accessibility
- Core flows must be usable with a keyboard.
- Forms must expose labels, validation messages, and actionable errors.
- Stage and task status must not rely on color alone.

## NFR-6: Auditability and observability
- Server-side errors must be logged with enough context for diagnosis, excluding sensitive data.
- Recent activity must be derived from persisted system events or auditable record changes, not transient UI state.
- At minimum, operators must be able to see error rate and request latency for key routes (dashboard and core list/detail views) via logs and/or metrics.

## NFR-7: Maintainability
- The architecture boundary `presentation -> infrastructure -> application -> domain` must be preserved.
- The domain layer must not take external dependencies.
- TypeScript strictness and existing quality gates must not be weakened.

## NFR-8: Simplicity by design
- The MVP must prefer fixed product defaults over admin configuration where that does not block core workflows.
- New requirements that introduce integration surfaces, automation engines, schema customization, or cross-product workflows must be treated as out of scope unless explicitly re-scoped by humans.

## NFR-9: Data model discipline
- Companies, contacts, opportunities, tasks, and notes must remain the only first-class business records in MVP.
- Pipeline stages must be a fixed bounded set for MVP, not a user-defined schema system.

## NFR-10: Privacy and data minimization
- Only data required for the bounded CRM workflows should be collected and stored.
- The product must not expand into communication content ingestion such as mailbox sync or call recording in MVP.
