# Risk Register: CRM MVP

## Overview

This register tracks project risks across technical, market, and operational dimensions. Each risk is rated on likelihood (L) and impact (I) from 1 (low) to 5 (high). Risk score = L x I.

## Technical Risks

| ID | Risk | L | I | Score | Mitigation |
|---|---|---|---|---|---|
| T1 | Stack complexity slows development | 3 | 4 | 12 | Use proven stack (React + Node/Express + PostgreSQL). Avoid novel frameworks. |
| T2 | Auth implementation has security vulnerabilities | 2 | 5 | 10 | Use established auth library (e.g., Passport.js, Auth.js). No custom crypto. |
| T3 | Data model changes require expensive migrations | 3 | 3 | 9 | Design schema with nullable columns and soft deletes. Use migration tool from day one. |
| T4 | Poor API performance under concurrent users | 2 | 3 | 6 | Add database indexes on foreign keys and common queries. Load test with 50 concurrent users before launch. |
| T5 | Manual data entry errors degrade data quality | 3 | 3 | 9 | Validate required fields and formats (email, phone) on save. Show inline validation errors before submission. |
| T6 | Browser compatibility issues | 2 | 2 | 4 | Target evergreen browsers only (Chrome, Firefox, Edge, Safari latest two versions). |
| T7 | State management complexity in pipeline drag-and-drop | 3 | 3 | 9 | Use a proven drag-and-drop library. Keep optimistic updates simple with server reconciliation. |

## Market Risks

| ID | Risk | L | I | Score | Mitigation |
|---|---|---|---|---|---|
| M1 | HubSpot Free is "good enough" for target users | 4 | 4 | 16 | Differentiate on simplicity and speed-to-first-value, not feature count. |
| M2 | Target users prefer spreadsheets over any CRM | 3 | 4 | 12 | Offer CSV import/export as first-class features. Make the CRM feel like a structured spreadsheet. |
| M3 | SME teams churn after free trial without converting | 3 | 3 | 9 | Focus MVP on habit-forming daily use (tasks, follow-ups). Monetization is post-MVP. |
| M4 | Users expect email integration at launch | 4 | 3 | 12 | Set clear expectations in onboarding. Notes on contacts serve as manual call/email logging. |
| M5 | Users expect mobile app | 3 | 2 | 6 | Build responsive web UI. Native mobile is a post-MVP roadmap item. |

## Operational Risks

| ID | Risk | L | I | Score | Mitigation |
|---|---|---|---|---|---|
| O1 | Scope creep beyond MVP boundaries | 4 | 4 | 16 | Define MVP scope in writing (auth, contacts, companies, opportunities, pipeline, tasks, notes, dashboard). Reject additions until post-launch. |
| O2 | Team capacity insufficient to deliver on schedule | 3 | 4 | 12 | Prioritize ruthlessly: pipeline view and contact management ship first, dashboard last. |
| O3 | Inadequate test coverage leads to regressions | 3 | 3 | 9 | Enforce test coverage threshold in CI. Write tests alongside features, not after. |
| O4 | Deployment and hosting decisions delayed | 2 | 3 | 6 | Choose hosting platform (e.g., Railway, Render, Fly.io) in week one. Containerize from the start. |
| O5 | No user feedback loop during development | 3 | 4 | 12 | Recruit 3-5 SME sales reps for weekly feedback sessions starting at first working prototype. |
| O6 | Data privacy and GDPR compliance gaps | 2 | 5 | 10 | Implement data export and deletion endpoints in MVP. Store minimal PII. Document data handling. |

## Top Risks by Score

| Rank | ID | Risk | Score |
|---|---|---|---|
| 1 | M1 | HubSpot Free is "good enough" | 16 |
| 2 | O1 | Scope creep beyond MVP | 16 |
| 3 | T1 | Stack complexity | 12 |
| 4 | T5 | Manual data entry errors | 9 |
| 5 | M2 | Users prefer spreadsheets | 12 |
| 6 | M4 | Users expect email integration | 12 |
| 7 | O2 | Team capacity | 12 |
| 8 | O5 | No user feedback loop | 12 |

## Review Cadence

This register should be reviewed weekly during MVP development. Risks with score >= 12 require active mitigation work, not just awareness.
