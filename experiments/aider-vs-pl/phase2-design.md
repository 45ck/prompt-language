# Aider vs Prompt Language — Phase 2 Experiment Design

Date: 2026-04-14
Status: Draft — ready for operator review before execution

## Overview

Phase 1 (10 hypotheses, Qwen3 30B) established PL's advantage: 6 wins, 0 losses, 3 ties. Gate loops and decomposition were the killer features. Phase 2 raises the bar: harder tasks that mirror E5 change-request families, more models, and explicit thesis connection.

## Model Matrix

| Model              | Access                                   | Notes                                                         |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------- |
| Qwen3 30B (Q4_K_M) | Local (Vulkan, RX 7600 XT)               | Phase 1 baseline — retest harder tasks for ceiling comparison |
| Claude Sonnet 4    | `aider --model claude-sonnet-4-20250514` | Tests whether PL advantage persists with a frontier model     |
| GPT-4.1            | `aider --model gpt-4.1`                  | Cross-family comparison for E5 thesis alignment               |
| DeepSeek V3        | Local if available, API fallback         | Open-weight frontier comparison                               |

Each hypothesis runs against **all available models** in both solo and PL modes. This gives us a model × orchestration matrix rather than single-model evidence.

## Harder Task Hypotheses (H11–H20)

### H11: Multi-file refactor (rename across 5+ files)

**E5 connection**: CR-02 (rename entity + update all references)
**Task**: Rename `Contact` → `Client` across model, controller, routes, tests, and docs. Minimum 5 files must change. Verify no stale references remain.
**PL advantage hypothesis**: `foreach` over file list + `run: grep -r "Contact"` gate catches stragglers.
**Solo failure mode**: Misses a reference in a non-obvious file (e.g., seed data, migration, README).

### H12: Security vulnerability fix (SQL injection)

**E5 connection**: CR-04 (security patch)
**Task**: Given a deliberately vulnerable Express route with string concatenation in a SQL query, fix it with parameterized queries. Verify via automated injection test.
**PL advantage hypothesis**: `retry max 3` with injection test gate forces the fix to actually work.
**Solo failure mode**: Fixes obvious path but misses edge cases; no automated re-check.

### H13: Performance optimization (database query)

**E5 connection**: CR-03 (performance improvement)
**Task**: Optimize an N+1 query in a contacts-with-companies endpoint. Add an index. Verify with a benchmark script that response time drops below threshold.
**PL advantage hypothesis**: `until` loop with benchmark gate ensures measurable improvement, not just code change.
**Solo failure mode**: Adds index but doesn't verify it actually improves the slow query.

### H14: Test-first development (TDD red-green-refactor)

**E5 connection**: CR-01 (add new feature with tests)
**Task**: Implement a "merge duplicate contacts" feature TDD-style: write failing test first, implement minimal code, verify green, refactor.
**PL advantage hypothesis**: Flow enforces TDD discipline — `run: npm test` must fail first, then pass after implementation.
**Solo failure mode**: Writes tests and implementation together; tests may be tautological.

### H15: API endpoint addition with validation + tests

**E5 connection**: CR-01 (feature addition)
**Task**: Add a `PATCH /api/contacts/:id` endpoint with field-level validation (email format, name length, phone pattern). Include 8+ test cases covering valid, invalid, and edge inputs.
**PL advantage hypothesis**: Decomposition into validation → handler → tests → integration test, each with its own gate.
**Solo failure mode**: Missing validation edge cases; test count below spec.

### H16: Bug reproduction from issue description

**E5 connection**: CR-05 (bug fix from user report)
**Task**: Given an issue description ("when I create a contact with a very long name, the page crashes"), reproduce the bug, write a failing test, fix it, verify the fix.
**PL advantage hypothesis**: Flow forces reproduction before fix; gate ensures the test actually fails before the fix.
**Solo failure mode**: Fixes the assumed bug without reproducing; fix may not address the actual symptom.

### H17: Dependency upgrade with breaking changes

**E5 connection**: Maintenance viability core
**Task**: Upgrade Express from v4 to v5 (or equivalent breaking change). Fix all breaking API changes. All existing tests must pass.
**PL advantage hypothesis**: `retry` loop with full test suite gate; `foreach` over deprecation warnings.
**Solo failure mode**: Fixes obvious breakages but misses subtle API changes (e.g., path matching).

### H18: Configuration system redesign

**E5 connection**: CR-03 (structural improvement)
**Task**: Replace scattered `process.env.X` reads with a centralized config module. Validate all env vars at startup. Add defaults and type coercion.
**PL advantage hypothesis**: `foreach` over discovered env vars; gate verifies the app starts without any env vars set (using defaults).
**Solo failure mode**: Misses env var references in non-obvious locations; no startup validation test.

### H19: Error handling overhaul

**E5 connection**: CR-04 (reliability improvement)
**Task**: Replace all unhandled promise rejections and bare `catch(e)` blocks with a structured error handler. Add error response middleware. Verify with fault injection tests.
**PL advantage hypothesis**: `foreach` over files containing `catch`; `retry` with fault injection gate.
**Solo failure mode**: Wraps some handlers but misses async middleware; no systematic verification.

### H20: Documentation generation from code

**E5 connection**: CR-05 (documentation)
**Task**: Generate an API reference (markdown) from the actual route definitions. Must include method, path, request body schema, response schema, and example. Verify completeness against actual routes.
**PL advantage hypothesis**: `let routes = run "node extract-routes.js"` captures actual endpoints; `if` checks completeness.
**Solo failure mode**: Documentation doesn't match actual code; missing endpoints.

## Execution Protocol

### Per-hypothesis procedure

1. **Setup**: Create a fresh fixture workspace with the necessary codebase state
2. **Solo run**: `aider --model <model> --message "<task prompt>"` with timeout
3. **PL run**: `prompt-language ci --runner aider --model <model> -- hypothesis-<N>.flow` with same timeout multiplied by 2x (PL budget allowance from Phase 1)
4. **Evaluation**: Automated gate check + human rubric scoring

### Scoring rubric

| Criterion    | Weight | Measurement                                         |
| ------------ | ------ | --------------------------------------------------- |
| Correctness  | 40%    | All tests pass; no regressions introduced           |
| Completeness | 25%    | All spec requirements met (checklist)               |
| Quality      | 20%    | No type errors, no linter warnings, clean structure |
| Speed        | 15%    | Wall-clock time (PL gets 2x budget before penalty)  |

### Statistical validity

- **Sample size**: Each hypothesis runs 3 times per model × mode combination (solo vs PL)
- **Randomization**: Run order randomized within each model block
- **Blinding**: Scoring script evaluates workspace artifacts without knowing which mode produced them
- **Minimum for significance**: PL must win ≥ 2/3 runs to claim a hypothesis win (matches Phase 1 convention)

## Thesis Connection

The maintenance-viability thesis claims PL-orchestrated code is more maintainable than code produced without orchestration. Phase 2 connects directly:

| Hypothesis               | E5 CR family     | Thesis dimension                                             |
| ------------------------ | ---------------- | ------------------------------------------------------------ |
| H11 (rename refactor)    | CR-02            | Maintainability — can the codebase absorb a rename?          |
| H12 (security fix)       | CR-04            | Reliability — does the fix actually close the vulnerability? |
| H13 (perf optimization)  | CR-03            | Measurability — is improvement verified, not assumed?        |
| H14 (TDD)                | CR-01            | Quality — does TDD discipline survive without orchestration? |
| H15 (API endpoint)       | CR-01            | Completeness — are all validation cases covered?             |
| H16 (bug repro)          | CR-05            | Reproducibility — is the fix grounded in evidence?           |
| H17 (dependency upgrade) | Maintenance core | Viability — can the codebase survive ecosystem changes?      |
| H18 (config redesign)    | CR-03            | Structure — is the improvement systematic or ad-hoc?         |
| H19 (error handling)     | CR-04            | Robustness — does the overhaul cover all paths?              |
| H20 (doc generation)     | CR-05            | Discoverability — does documentation match reality?          |

### What would disprove the thesis

- If frontier models (Claude Sonnet 4, GPT-4.1) produce equivalent quality in solo mode, PL's value proposition shifts from "necessary" to "nice-to-have for weak models"
- If PL's speed penalty exceeds 3x on harder tasks, the cost-benefit shifts
- If PL wins only on gate-loop tasks but loses on creative/architectural tasks, the thesis narrows

## Fixture Requirements

Each hypothesis needs a fixture workspace under `experiments/aider-vs-pl/fixtures/`. Fixtures should be:

- Self-contained (no external database required — use SQLite or in-memory)
- Pre-populated with enough code to make the task non-trivial
- Include a `verify.sh` script that exits 0 on success, 1 on failure
- Include a `TASK.md` describing the task for both solo and PL modes

## Next Steps

1. Create fixture workspaces for H11–H20
2. Write .flow files for each hypothesis
3. Run Phase 2 batch with Qwen3 30B first (cheapest)
4. Expand to Claude Sonnet 4 and GPT-4.1
5. Compile scorecard and update thesis evidence
