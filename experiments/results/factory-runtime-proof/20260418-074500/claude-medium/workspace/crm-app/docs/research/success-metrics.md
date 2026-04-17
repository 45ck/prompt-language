# Success Metrics — SME CRM MVP

## Primary Metrics (MVP Launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first pipeline view | < 15 minutes from sign-up | Timer from account creation to first opportunity created |
| Daily active usage | Team uses app 4+ days/week within 2 weeks | Login frequency per org |
| Contact data completeness | >80% of contacts have company + email + phone | Query against contact records |
| Pipeline accuracy | Opportunity stages updated within 24h of real status change | Compare last-modified timestamps to deal activity |

## Secondary Metrics (Post-Launch, 30 days)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Spreadsheet abandonment | Team stops updating parallel spreadsheet within 30 days | Self-reported survey |
| Task completion rate | >70% of assigned tasks marked complete | Tasks completed / tasks created |
| CSV import success rate | >95% of import attempts succeed without error | Import logs |
| Page load P95 | < 2 seconds | Server-side timing middleware |

## Anti-Metrics (Things We Explicitly Do NOT Optimize For)

| Anti-Metric | Reason |
|-------------|--------|
| Number of features | MVP scope is fixed. More features ≠ more value. |
| Contact volume | We target quality of workflow, not data warehouse scale. |
| Integration count | No integrations in MVP. Measure core workflow completion instead. |
| Customization depth | Fixed schema. Customization is a post-MVP concern. |

## Definition of MVP Success

The MVP is successful if a 10-person sales team can:
1. Import their existing contacts from CSV
2. Create and manage a sales pipeline with custom stage names
3. Track tasks and notes against contacts and opportunities
4. View a dashboard showing pipeline value and upcoming tasks
5. Complete all of the above without external documentation or support
