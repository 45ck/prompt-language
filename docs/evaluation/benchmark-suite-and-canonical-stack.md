# Benchmark Suite and Canonical Stack

## Status

Proposed benchmark definition for `prompt-language-zaq6`.

## Purpose

Define one fixed starter template and one fixed 20-task benchmark suite for
repo experiments so the evaluation program compares agent behavior, gating, and
orchestration choices rather than drifting stack choices.

This note is meant to give the dataset bank a stable factory-starter target,
especially for the planned `E4` line, and to keep future locked baselines
comparable across `vanilla`, `gated`, threaded, and later specialist-assisted
runs.

## Anchors

- [Evaluation Dataset Bank](./dataset-bank.md)
- [Evaluation Stack Test Matrix](./eval-test-matrix.md)
- [Live Validation Evidence](./eval-live-validation-evidence.md)
- [Self-Hosted Meta-Layer Pilot](./self-hosted-meta-layer-pilot.md)

## Canonical benchmark template

The benchmark template should be intentionally boring. The goal is not to pick
the trendiest stack. The goal is to pick one stack that is easy to reset, easy
to inspect, and broad enough to expose real agent strengths and failure modes.

### Fixed stack

| Surface         | Canonical choice                                       | Why this is fixed                                                                       |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Framework       | TypeScript + Express 5                                 | Small control surface, low framework magic, easy diff inspection                        |
| Database        | SQLite file database                                   | Cheap fixture reset, deterministic local boot, no external service dependency           |
| Auth model      | Email/password with cookie-backed server sessions      | Covers login, session state, authorization, and security regressions                    |
| Test runner     | Vitest                                                 | Already repo-native, fast, easy to automate, and suitable for unit plus HTTP-level runs |
| Deployment path | Single Docker image deployed to Fly.io with one volume | One documented path from local fixture to hosted smoke without branching the stack      |

### Canonical application shape

Every benchmark case should start from the same app shape:

- one Express server
- one SQLite database file under fixture control
- one auth/session layer
- one domain with enough business shape to require multi-file edits
- one Dockerfile and one Fly.io config
- one `vitest.config.ts`
- one `package.json` with stable scripts for install, build, test, and local run

The canonical domain should be a small work-tracker app with:

- `users`
- `projects`
- `tasks`
- `comments`

That domain is large enough for CRUD, auth, filtering, validation, and deploy
tasks, but still small enough to understand from a cold start.

## Benchmark boundaries

This suite is not meant to benchmark every possible app shape. It is meant to
create one repeatable proving ground for prompt-language experiments.

In scope:

- bug fixes
- small feature additions
- schema and query changes
- auth and authorization work
- test repair and regression hardening
- deployment and operations tasks

Out of scope:

- framework migrations
- frontend-heavy animation or design work
- multi-service architectures
- non-SQL databases
- alternate auth models such as OAuth-first or flows without passwords
- alternate deploy targets in the same suite

## Reproducible starting-state guidance

Each benchmark task should start from a locked fixture snapshot rather than from
an evolving branch tip.

Required starting-state rules:

1. Each task gets its own fixture directory and locked commit snapshot.
2. The template dependency graph is pinned and reused across the full suite.
3. The SQLite file is reset from a checked-in seed before every run.
4. Environment variables come from one checked-in `.env.example`; runtime
   secrets are replaced with fixed dummy values for eval use.
5. Every task defines one explicit user-visible objective and one bounded change
   surface.
6. Every task declares the exact validation commands to run.
7. Hosted deployment tasks use the same Fly.io layout and the same fixture-side
   health endpoint contract.
8. Reports are stored as locked artifacts under `experiments/results/`, not as
   ad hoc local notes.

Recommended fixture scripts:

- `npm run test`
- `npm run build`
- `npm run db:reset`
- `npm run dev`
- `npm run smoke:http`

Recommended prompt-language gate pattern:

- `tests_pass`
- one HTTP smoke command
- one task-specific command when the task needs extra proof, such as migration
  success or deployment health

## Task categories

The 20 tasks should be split across five categories so the experiment program
can compare where candidates improve and where they fail.

| Category                    | Purpose                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- |
| A. Starter bring-up         | Verify that a candidate can orient itself and make safe low-complexity edits |
| B. Data and CRUD            | Exercise schema, query, validation, and route changes                        |
| C. Auth and access control  | Measure correctness around session and authorization boundaries              |
| D. Regression and hardening | Test debugging, test repair, and failure containment                         |
| E. Deployment and ops       | Measure end-to-end production readiness work                                 |

## Canonical 20-task suite

| ID  | Category                 | Task                                                                    | Primary evidence                                             |
| --- | ------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| A1  | Starter bring-up         | Fix a broken `/health` route so local smoke returns `200`.              | `npm run test`, `npm run smoke:http`                         |
| A2  | Starter bring-up         | Add a missing project list page route with seeded data rendering.       | route tests plus smoke output                                |
| A3  | Starter bring-up         | Repair a broken environment config read without weakening defaults.     | config tests and local boot                                  |
| A4  | Starter bring-up         | Add request logging middleware without breaking existing responses.     | tests plus unchanged response snapshots                      |
| B1  | Data and CRUD            | Add `project.description` support across schema, model, and display.    | migration success plus read/write tests                      |
| B2  | Data and CRUD            | Fix task creation validation so blank titles are rejected cleanly.      | validation tests and HTTP status assertions                  |
| B3  | Data and CRUD            | Implement task status filtering on list views and API output.           | query tests, route tests, seeded filter fixture              |
| B4  | Data and CRUD            | Add comment deletion with ownership checks and cascade safety.          | CRUD tests and seeded multi-user scenario                    |
| C1  | Auth and access control  | Repair login so valid credentials create a persistent session.          | auth tests, cookie assertions, smoke login flow              |
| C2  | Auth and access control  | Fix logout so the session is actually invalidated server-side.          | session invalidation tests                                   |
| C3  | Auth and access control  | Add admin-only project archive action guarded by role checks.           | authorization tests for user vs admin                        |
| C4  | Auth and access control  | Close a session fixation bug by rotating session identifiers on login.  | security regression tests and login flow assertions          |
| D1  | Regression and hardening | Repair a failing Vitest suite caused by stale mock expectations.        | `npm run test` with no weakened assertions                   |
| D2  | Regression and hardening | Fix an N+1 style task list query that became too slow on seeded data.   | perf-oriented fixture assertion plus correctness tests       |
| D3  | Regression and hardening | Add coverage for a reproduced bug where archived projects leak tasks.   | new failing-first test plus passing fix                      |
| D4  | Regression and hardening | Tighten input normalization for email login without breaking valid use. | regression tests over valid and invalid login inputs         |
| E1  | Deployment and ops       | Repair the Dockerfile so the app builds and starts in container smoke.  | image build plus local container health                      |
| E2  | Deployment and ops       | Fix the Fly.io health check path and port wiring.                       | deploy config review plus hosted or simulated health probe   |
| E3  | Deployment and ops       | Add a safe startup migration step that does not destroy seeded data.    | migration smoke plus post-start data checks                  |
| E4  | Deployment and ops       | Write or repair a rollback note tied to the current deploy path.        | checked-in runbook text plus deployment contract consistency |

## Task construction rules

To keep the suite useful, every task should follow the same construction rules:

- one dominant objective per task
- a bounded edit surface that fits ordinary benchmark time budgets
- enough surrounding context to require reading, not blind patching
- no task that can be solved only by deleting tests or weakening config
- at least some tasks that cross route, model, and auth boundaries
- at least some tasks that are intentionally multi-file rather than single-file
- at least some tasks that fail only in smoke or deploy validation, not just in
  unit tests

The suite should avoid fake difficulty based on obscure framework quirks. The
difficulty should come from diagnosis, sequencing, and safe completion.

## Suggested dataset shape

This benchmark note does not define the final JSONL schema, but each case should
be representable in the dataset bank with stable fields for:

- `id`
- `category`
- `fixture`
- `objective`
- `starting_state`
- `validation_commands`
- `expected_artifacts`
- `baseline_group`

That is enough for repeated runs, baseline comparison, and later bank growth
without inventing a new evaluation surface.

## Why this enables the experiment program

The experiment program needs one canonical proving ground before it can make
credible claims about new flow patterns.

This fixed stack and suite enable that by:

- reducing variance from framework and deployment choice
- making locked baselines comparable across `vanilla` and `gated` candidates
- giving the dataset bank a reusable factory-starter family instead of one-off
  app prompts
- creating a stable place to compare fresh-threaded, resumed, and later
  specialist-assisted runs
- exposing real auth, CRUD, regression, and deployment work instead of only toy
  edit tasks
- keeping failure artifacts inspectable enough for replay and promotion

Without a canonical template, the repo risks comparing prompt wording against
stack churn. With a canonical template, the repo can compare the things it
actually cares about: task completion, regression control, smoke credibility,
and whether prompt-language workflows improve the outcome.

## Recommended next step

Use this note as the benchmark contract for the planned factory-starter suite in
the dataset bank, then create locked fixture snapshots and case rows that map
directly to the 20 tasks above.
