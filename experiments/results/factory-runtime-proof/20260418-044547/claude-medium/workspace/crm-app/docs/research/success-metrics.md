# Success Metrics

## Guiding Principle

Metrics measure whether the MVP solves real problems for SME teams. Vanity metrics (total signups, page views) are excluded. Every metric below maps to a user outcome.

---

## Category 1: Adoption

### 1.1 Team Activation Rate

| Field | Value |
|---|---|
| **Definition** | Percentage of registered teams where at least 2 users have completed the activation criteria within 14 days of signup |
| **Activation criteria** | User has created 5+ contacts AND 3+ tasks AND viewed the pipeline at least once |
| **Target** | 40% of registered teams activated within 14 days |
| **Measurement** | Database query on user actions with timestamps, grouped by team |
| **Evaluation** | Monthly, starting 30 days after public launch |

### 1.2 Weekly Active Users (WAU)

| Field | Value |
|---|---|
| **Definition** | Unique users who perform at least one meaningful action (create/edit/delete a record, move a deal, complete a task) per week |
| **Target** | 60% of activated users remain weekly active at day 30; 40% at day 60 |
| **Measurement** | Event tracking on create/update/delete actions per user per week |
| **Evaluation** | Weekly cohort analysis |

### 1.3 Team Size Growth

| Field | Value |
|---|---|
| **Definition** | Average number of users per team over time |
| **Target** | Teams that activate grow from 2 users to 4+ users within 60 days |
| **Measurement** | Count of active users per team, tracked monthly |
| **Evaluation** | Monthly |

### 1.4 Retention at Day 30 and Day 60

| Field | Value |
|---|---|
| **Definition** | Percentage of activated teams with at least one login in the trailing 7 days |
| **Target** | 50% retention at day 30; 35% retention at day 60 |
| **Measurement** | Last-login timestamp per team, cohorted by signup date |
| **Evaluation** | Monthly cohort report |

---

## Category 2: Time-to-Value

### 2.1 Time to First Contact Created

| Field | Value |
|---|---|
| **Definition** | Elapsed time from account creation to the user creating their first contact record |
| **Target** | Median under 5 minutes |
| **Measurement** | Timestamp diff between signup event and first contact creation |
| **Evaluation** | Weekly, first 90 days |

### 2.2 Time to First Pipeline View

| Field | Value |
|---|---|
| **Definition** | Elapsed time from account creation to the user's first view of the pipeline board with at least one opportunity |
| **Target** | Median under 15 minutes |
| **Measurement** | Timestamp diff between signup and first pipeline-page-view where opportunity count > 0 |
| **Evaluation** | Weekly, first 90 days |

### 2.3 Time to First Completed Task

| Field | Value |
|---|---|
| **Definition** | Elapsed time from account creation to the user marking their first task as complete |
| **Target** | Median under 30 minutes |
| **Measurement** | Timestamp diff between signup and first task-completed event |
| **Evaluation** | Weekly, first 90 days |

### 2.4 Setup Completion Rate

| Field | Value |
|---|---|
| **Definition** | Percentage of registered users who complete all onboarding steps: create account, add first contact, create first opportunity, view pipeline |
| **Target** | 60% of registered users complete setup within first session |
| **Measurement** | Onboarding step tracking (event per step) |
| **Evaluation** | Monthly |

### 2.5 Self-Hosted Deploy Time

| Field | Value |
|---|---|
| **Definition** | Time from git clone to running application with seed data |
| **Target** | Under 30 minutes with documented steps |
| **Measurement** | Manual testing on fresh machine |
| **Evaluation** | Before each release |

---

## Category 3: Data Quality and Migration

### 3.1 CSV Import Success Rate

| Field | Value |
|---|---|
| **Definition** | Percentage of rows in a CSV file that are successfully imported without errors |
| **Target** | 90% of rows imported successfully on first attempt (across all imports) |
| **Measurement** | Import log: total rows attempted vs. rows successfully created |
| **Evaluation** | Per-import, aggregated monthly |

### 3.2 CSV Import Completion Rate

| Field | Value |
|---|---|
| **Definition** | Percentage of users who start a CSV import and successfully complete it |
| **Target** | 85% completion rate |
| **Measurement** | Ratio of import-started events to import-completed events |
| **Evaluation** | Monthly |

### 3.3 Duplicate Contact Rate

| Field | Value |
|---|---|
| **Definition** | Percentage of contacts that are duplicates (same email address within a team) |
| **Target** | Under 5% duplicate rate |
| **Measurement** | Scheduled query grouping contacts by email within tenant |
| **Evaluation** | Monthly |

### 3.4 Opportunity Stage Accuracy

| Field | Value |
|---|---|
| **Definition** | Percentage of open opportunities updated (stage change or note added) within the last 14 days |
| **Target** | 70% of open opportunities are current |
| **Measurement** | Query on opportunity updatedAt timestamp |
| **Evaluation** | Weekly |

---

## Category 4: User Satisfaction

### 4.1 Net Promoter Score (NPS)

| Field | Value |
|---|---|
| **Definition** | Standard NPS survey: "How likely are you to recommend this CRM to a colleague?" (0-10 scale) |
| **Target** | NPS of 30+ within 90 days of launch |
| **Measurement** | In-app survey triggered at day 14 and day 60 for activated users |
| **Evaluation** | Monthly |

### 4.2 Task Completion Satisfaction

| Field | Value |
|---|---|
| **Definition** | Self-reported ease of completing core workflows (create contact, move deal, complete task) on a 1-5 scale |
| **Target** | Average score of 4.0+ across all workflows |
| **Measurement** | In-app micro-survey after first 10 actions |
| **Evaluation** | Monthly, first 90 days |

### 4.3 Support Ticket Volume

| Field | Value |
|---|---|
| **Definition** | Number of support tickets per 100 active users per month |
| **Target** | Under 15 tickets per 100 active users per month |
| **Measurement** | Support system ticket count divided by active user count |
| **Evaluation** | Monthly |

### 4.4 Feature Request Concentration

| Field | Value |
|---|---|
| **Definition** | The most-requested feature category from user feedback |
| **Target** | No single missing feature cited by more than 30% of churned users as their reason for leaving |
| **Measurement** | Categorize support tickets and churn survey responses by feature area |
| **Evaluation** | Monthly |

---

## System Performance Metrics

| Metric | Target | Measurement |
|---|---|---|
| Dashboard page load (server-rendered) | < 1.5 seconds (P95) | Server timing headers or Lighthouse |
| Contact list page load (50 items) | < 1.0 second (P95) | Server timing headers |
| API response time (CRUD operations) | < 300ms (P95) | Application timing middleware |
| System uptime | > 99.5% monthly | Health check endpoint monitoring |
| Error rate | < 1% of API requests return 5xx | Error logging |

---

## Dashboard Widgets (Built into MVP)

The MVP dashboard displays these metrics in real-time to users:

| Widget | Source |
|---|---|
| Total pipeline value | SUM of opportunity values grouped by stage |
| Deals by stage | COUNT of opportunities per pipeline stage |
| Overdue tasks | COUNT of tasks where dueDate < today AND status != completed |
| Tasks completed this week | COUNT of tasks completed in current calendar week |
| New contacts this month | COUNT of contacts created in current calendar month |
| Win rate | Closed Won / (Closed Won + Closed Lost) over trailing 90 days |

---

## MVP Launch Checklist (Pass/Fail Gates)

- [ ] A new user can sign up, create a contact, and create an opportunity in under 10 minutes
- [ ] A team of 3 can be invited and all access the same data
- [ ] Pipeline board displays opportunities in correct stages with drag-and-drop
- [ ] Tasks can be created, assigned, and completed with due dates
- [ ] Notes can be attached to contacts, companies, and opportunities
- [ ] Dashboard shows pipeline value summary and open task count
- [ ] Application deploys via Docker Compose with one command
- [ ] All pages pass Lighthouse accessibility audit at 90+
- [ ] No critical or high severity security vulnerabilities in dependency audit

---

## Failure Thresholds

If any of the following occur, the MVP requires a significant pivot:

- Team activation rate below 20% at day 30
- Day-30 retention below 25%
- NPS below 0
- CSV import completion rate below 60%
- More than 50% of churned users cite the same missing feature

## Evaluation Cadence

| Timeline | Actions |
|---|---|
| Week 1-2 | Instrument event tracking for all metrics. Validate data collection. |
| Week 3-4 | First cohort of users. Monitor time-to-value metrics daily. |
| Month 2 | First adoption and retention analysis. First NPS survey results. |
| Month 3 | Full metric review. Decision on post-MVP priorities based on data. |
