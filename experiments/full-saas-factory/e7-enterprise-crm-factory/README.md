# E7 Enterprise CRM Factory

The most comprehensive prompt-language software factory to date. Where E6 proved PL could drive a simple CRM build, E7 proves it can orchestrate a **full SDLC with parallelism, quality gates, security audits, review loops, and deployment** — the way a real engineering team works.

## Thesis

If prompt-language is a credible engineering medium, an enterprise CRM factory should be expressible as:

- One top-level `project.flow` orchestrating 6 SDLC phases
- Phase flows with parallel spawn, race, review, and approve primitives
- Reusable library flows for CRUD generation, testing, security, and deployment
- Hard gates between every phase — no skipping, no manual overrides
- Agent assignments from skill-harness loadouts — not generic prompts

## Architecture

```
project.flow
  │
  ├── Phase 0: Scaffold ──────────── scaffold.flow + dependencies.flow
  │
  ├── Phase 1: Discovery ─────────── 3 parallel spawns (research, requirements, personas)
  │   │                               review loop → approve checkpoint
  │   │
  ├── Phase 2: Architecture ──────── race (modular vs services) → 4 parallel spawns
  │   │                               review loop → approve checkpoint
  │   │
  ├── Phase 3: Implementation ────── 3 foundation spawns → await all
  │   │                               2 parallel builds (backend API + frontend shell)
  │   │                               foreach-spawn 5 entity clusters (18 entities total)
  │   │                               retry loops on build/test failures
  │   │                               approve checkpoint
  │   │
  ├── Phase 4: QA ────────────────── 4 parallel test suites (unit, integration, e2e, contract)
  │   │                               retry loops per suite → review loop
  │   │
  ├── Phase 5: Security ──────────── 4 parallel tracks (threat model, code audit, deps, pentest)
  │   │                               review loop → approve checkpoint
  │   │
  └── Phase 6: Release ───────────── 3 parallel spawns (docs, summary, deployment prep)
      │                               review loop → approve → try/catch deployment
      │
      done when: 37 ship gates (3 build + 34 file_exists)
```

## Agent Team (from skill-harness loadouts)

| Agent                | Phase(s)     | Skills                                                         |
| -------------------- | ------------ | -------------------------------------------------------------- |
| research-writer      | Discovery    | search-string-designer, evidence-strength-scorer               |
| requirements-analyst | Discovery    | problem-statement-refiner, requirements-elicitation            |
| ux-researcher        | Discovery    | persona-synthesizer, task-analysis-writer                      |
| software-architect   | Architecture | adr-writer, architecture-option-generator, tradeoff-analysis   |
| system-modeler       | Architecture | domain-class-modeler, sequence-diagram-builder                 |
| backend-engineer     | Impl + CRUD  | entity-model-designer, repository-layer-designer, api-contract |
| web-engineer         | Impl + CRUD  | route-and-controller-planner, form-validation-designer         |
| qa-automation-eng    | QA           | unit-test-writer, integration-test-writer, api-test-suite      |
| test-designer        | QA           | coverage-goal-planner, equivalence-partitioning                |
| security-reviewer    | Security     | threat-surface-mapper, trust-boundary-identifier, OWASP        |
| pentest-reviewer     | Security     | owasp-wstg-checklist-runner, api-attack-surface-mapper         |
| quality-reviewer     | All reviews  | maintainability-reviewer, technical-debt-auditor               |
| delivery-manager     | All phases   | backlog-groomer, go-live-readiness-reviewer, rollback-checker  |
| workflow-engineer    | Release      | issue-driven-delivery, review-ready-check                      |

## DSL Features Used

| Feature             | Where                                     | Purpose                        |
| ------------------- | ----------------------------------------- | ------------------------------ |
| `spawn/await`       | Every phase                               | Parallel worker execution      |
| `foreach-spawn`     | Implementation (entity clusters)          | Parallel CRUD generation       |
| `race`              | Architecture (two design approaches)      | Competitive design exploration |
| `review`            | Discovery, Architecture, QA, Security     | Iterative quality improvement  |
| `approve`           | Post-discovery, post-arch, pre-release    | Human checkpoint gates         |
| `retry`             | Implementation, QA, Database              | Flaky test and build recovery  |
| `try/catch/finally` | Deployment, Dependencies, Migrations      | Error recovery with cleanup    |
| `if/else`           | Phase checks, Acceptance, Entity clusters | Conditional logic              |
| `while/until`       | (Available in review grounded-by)         | Iterative loops                |
| `send/receive`      | (Available for inter-agent comms)         | Message passing                |
| `remember`          | Project config, Phase decisions           | Persistent state               |
| `let = run`         | QA coverage, Security scan                | Command output capture         |
| `import/use`        | All files                                 | Library composition            |
| `done when`         | Ship gates (37 checks)                    | Hard completion enforcement    |

## CRM Entities (18)

**Core:** contact, company, opportunity, pipeline_stage
**Activities:** activity, task, note
**Commerce:** deal, quote, invoice, product
**Communications:** email_template, campaign
**Admin:** dashboard, report, role, permission, audit_log

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, Radix UI, React Query, Zustand
- **Backend:** Node.js, Express/Hono, Prisma ORM, Zod validation
- **Database:** PostgreSQL
- **Auth:** NextAuth.js (email + OAuth)
- **Testing:** Vitest (unit/integration), Playwright (e2e)
- **Deployment:** Docker Compose, multi-stage builds

## How to Invoke

```sh
npm run build && node bin/cli.mjs install
cd experiments/full-saas-factory/e7-enterprise-crm-factory
claude -p --dangerously-skip-permissions "$(cat project.flow)"
```

## Layout

```
e7-enterprise-crm-factory/
  README.md
  project.flow
  phases/
    01-discovery.flow
    02-architecture.flow
    03-implementation.flow
    04-quality-assurance.flow
    05-security.flow
    06-release.flow
  libraries/
    scaffold.flow
    dependencies.flow
    crud-entity.flow
    database.flow
    api-validation.flow
    security-scan.flow
    acceptance.flow
    deployment.flow
    git-workflow.flow
  workspace/
    crm-app/
      README.md
```

## Differences from E6

| Dimension         | E6 (Simple CRM)                   | E7 (Enterprise CRM)                            |
| ----------------- | --------------------------------- | ---------------------------------------------- |
| Entities          | 3 (contact, company, opportunity) | 18 (full CRM suite)                            |
| Phases            | 3 (discover, build, release)      | 6 + scaffold (full SDLC)                       |
| Parallelism       | Simple spawn/await                | spawn, foreach-spawn, race                     |
| Quality gates     | Basic file_exists                 | 37 gates (build + file + security)             |
| Security          | None                              | Full phase (threat model, audit, pentest)      |
| Review loops      | 1 (discovery)                     | 5 (per phase + QA + security)                  |
| Approval points   | 1 (release)                       | 4 (post-discovery, arch, impl, pre-release)    |
| Error recovery    | None                              | try/catch on deploy, retry on builds           |
| Agent assignments | Generic prompts                   | skill-harness agent loadouts                   |
| CRUD generation   | Sequential foreach                | foreach-spawn parallel clusters                |
| Deployment        | None                              | Docker + health check + rollback plan          |
| Testing           | Basic lint/typecheck/test         | Unit + integration + e2e + contract + security |
