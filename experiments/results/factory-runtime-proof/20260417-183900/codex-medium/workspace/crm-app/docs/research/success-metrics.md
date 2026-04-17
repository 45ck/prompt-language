# Success Metrics (MVP)

Target market: small-to-medium sales and service teams.

## Product outcomes (what “success” looks like)

- **Single source of truth adoption:** team consistently looks up contacts/companies in the CRM before reaching out.
- **Follow-up reliability:** overdue tasks decrease; next actions are visible and owned.
- **Pipeline clarity:** opportunities are consistently placed in stages and updated as they move.
- **Faster handoffs:** notes provide enough context for another teammate to continue a conversation.

## Leading indicators (early)

- **Activation:** % of new users who create (or import manually) at least 5 contacts and 1 opportunity within their first week.
- **Daily usefulness:** % of active users who view the dashboard and mark at least 1 task complete per day.
- **Data completeness:** % of opportunities that have an associated company and at least 1 note or task.

## Operational/quality metrics (engineering)

- **Search latency (p95):** contact/company search results returned quickly under normal SME dataset sizes.
- **Error rate:** low rate of 5xx and validation errors in normal usage.
- **Reliability:** availability target consistent with an internal business app; graceful error messages on failures.

## Guardrail metrics (to prevent “wrong” success)

- **Time-to-entry:** creating a contact or opportunity should remain fast; avoid pushing teams into heavy data entry.
- **Required fields:** keep required fields minimal; prefer optional enrichment later.

