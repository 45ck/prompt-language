# prompt-language Showcase

> 137+ examples demonstrating context management, hard gates, error recovery, and real-world workflows.

## Table of Contents

- [1. Context Threading](#1-context-threading)
- [2. Hard Gate Enforcement](#2-hard-gate-enforcement)
- [3. Error Recovery](#3-error-recovery)
- [4. Loop Patterns](#4-loop-patterns)
- [5. Variable Pipelines](#5-variable-pipelines)
- [6. Multi-Phase Workflows](#6-multi-phase-workflows)
- [7. Data Processing](#7-data-processing)
- [8. Conditional Branching](#8-conditional-branching)
- [9. Composition and Nesting](#9-composition-and-nesting)
- [10. Real-World CI/CD](#10-real-world-ci-cd)
- [11. Code Quality Enforcement](#11-code-quality-enforcement)
- [12. Creative and Unexpected Uses](#12-creative-and-unexpected-uses)

---

## 1. Context Threading

Context threading is the art of carrying information across workflow steps. Variables (`let`/`var`) capture command output, literal values, and Claude's own reasoning, then inject those values into later prompts via `${varName}` interpolation. This turns a linear sequence of prompts into a pipeline where each step builds on concrete, exact values from previous steps.

---

### 1.1 Baseline-and-Compare Performance Audit

Captures a performance baseline before optimization, then compares it to the result after changes. The exact numbers survive context compression because they live in variables, not conversation history.

```prompt-language
Goal: optimize the API response time for /api/users

flow:
  let baseline = run "curl -s -o /dev/null -w '%{time_total}' http://localhost:3000/api/users"
  let profile = run "node --prof-process isolate-*.log 2>/dev/null | head -40"
  prompt: Analyze the profiling data: ${profile}. Identify the top 3 bottlenecks and optimize them.
  let after = run "curl -s -o /dev/null -w '%{time_total}' http://localhost:3000/api/users"
  prompt: Baseline was ${baseline}s, now ${after}s. Write a summary to PERF.md with the exact numbers and what changed.
```

**Why this works:** The `let baseline` and `let after` captures are immune to conversation compaction. Even in a long session, the exact timing values are re-injected on every turn via `renderFlow()`.

---

### 1.2 Multi-Service Health Aggregation

Gathers health status from multiple services, then produces a single report that references all of them. Each `let` captures one service's output independently.

```prompt-language
Goal: generate a system health report

flow:
  let db_status = run "pg_isready -h localhost -p 5432 2>&1"
  let redis_status = run "redis-cli ping 2>&1"
  let api_status = run "curl -s http://localhost:3000/health"
  let disk_usage = run "df -h / | tail -1"
  prompt: Write health-report.md combining these results. DB: ${db_status}. Redis: ${redis_status}. API: ${api_status}. Disk: ${disk_usage}. Flag any service that is not healthy.
```

---

### 1.3 Dependency Version Chain

Captures the current version of a dependency, upgrades it, then verifies the new version matches expectations. The variable chain ensures the exact version strings are compared, not paraphrased memories.

```prompt-language
Goal: upgrade React to v19

flow:
  let old_ver = run "node -e \"console.log(require('react/package.json').version)\""
  prompt: Upgrade react to v19. Update any breaking API usages in src/.
  let new_ver = run "node -e \"console.log(require('react/package.json').version)\""
  prompt: Old version was ${old_ver}, new version is ${new_ver}. Write UPGRADE.md documenting every breaking change you fixed.

done when:
  tests_pass
```

---

### 1.4 Error Forensics Pipeline

Captures exact error messages as they occur during diagnosis, then uses them verbatim in a postmortem. The captured errors are not approximations -- they are the real stderr output.

```prompt-language
Goal: diagnose and fix production errors

flow:
  let auth_err = run "node scripts/diagnose-auth.js 2>&1 | tail -20"
  prompt: Fix the auth service error shown here: ${auth_err}
  let cache_err = run "node scripts/diagnose-cache.js 2>&1 | tail -20"
  prompt: Fix the cache service error shown here: ${cache_err}
  let queue_err = run "node scripts/diagnose-queue.js 2>&1 | tail -20"
  prompt: Fix the queue service error shown here: ${queue_err}
  prompt: Write postmortem.md citing the exact errors. Auth: ${auth_err}. Cache: ${cache_err}. Queue: ${queue_err}. Include root cause and remediation for each.

done when:
  tests_pass
```

**Why this works:** By step 5, the original error messages would be far back in conversation history. Variables bring them forward to the exact prompt that needs them.

---

### 1.5 Selective Context Injection for Security Review

Different steps receive different context to prevent cross-contamination. The security rules prompt does not see review criteria, and vice versa, so each step focuses on its own concern.

```prompt-language
Goal: security audit and refactor of the auth module

flow:
  let security_rules = prompt "List the OWASP top 5 vulnerabilities relevant to authentication modules. Be specific about Node.js/Express."
  prompt: Refactor src/auth/ following these security rules: ${security_rules}. Do not change the public API.
  let review_criteria = prompt "Define code review criteria: null handling, error paths, input validation, SQL injection, XSS."
  prompt: Review the refactored auth module against: ${review_criteria}. File issues as TODO comments for any violations.
  prompt: Run a final check. Security rules were: ${security_rules}. Review criteria were: ${review_criteria}. Confirm all issues are resolved.

done when:
  tests_pass
  lint_pass
```

---

### 1.6 Prompt Capture for Architecture Decisions

Uses `let x = prompt` to capture Claude's reasoning as a variable, then feeds that analysis into subsequent implementation steps. The captured analysis becomes a stable reference that does not drift.

```prompt-language
Goal: migrate the monolith user service to a microservice

flow:
  let analysis = prompt "Analyze src/services/user.js. Identify all external dependencies, database queries, and API endpoints. List them in a structured format."
  let plan = prompt "Given this analysis: ${analysis} — propose a migration plan. Which functions move to the new service? What stays? What needs a shared library?"
  prompt: Execute the migration plan: ${plan}. Create the new service directory structure and move the identified functions.
  prompt: Update all import paths and API routes that referenced the moved functions. The original analysis was: ${analysis}
  run: npm test

done when:
  tests_pass
```

---

### 1.7 List Variable Accumulation

Builds a list incrementally across steps using `let x += ...`, then iterates over it. Useful for accumulating findings during an audit.

```prompt-language
Goal: audit all config files for hardcoded secrets

flow:
  let findings = []
  let grep_result = run "grep -rl 'password\|secret\|api_key' src/ --include='*.ts' 2>/dev/null | head -20"
  let findings += run "echo ${grep_result}"
  let env_check = run "grep -rl 'process.env' src/ --include='*.ts' 2>/dev/null | wc -l"
  prompt: Files with potential secrets: ${findings}. Files using process.env: ${env_check}. Refactor any hardcoded secrets to use environment variables.
  foreach file in ${findings}
    prompt: Review ${file} specifically. Replace any remaining hardcoded credentials with process.env references.
  end

done when:
  gate no_secrets: grep -rl 'password.*=.*"' src/ --include='*.ts'; test $? -ne 0
```

---

### 1.8 Git Diff Context for Targeted Review

Captures the exact diff output and uses it as context for a focused code review. The reviewer prompt sees the real changes, not a summary.

```prompt-language
Goal: review and improve the changes in this branch

flow:
  let changed_files = run "git diff main --name-only"
  let diff_stats = run "git diff main --stat"
  let full_diff = run "git diff main -- src/ | head -200"
  prompt: Review these changes. Files: ${changed_files}. Stats: ${diff_stats}. Diff excerpt: ${full_diff}. Focus on correctness, not style.
  prompt: For each issue you found, fix it. The changed files were: ${changed_files}
  run: npm test

done when:
  tests_pass
  lint_pass
```

---

### 1.9 Environment-Aware Deployment Pipeline

Captures the current environment and branch, then threads those values through every deployment step so commands target the right destination.

```prompt-language
Goal: deploy the current branch to the correct environment

flow:
  let branch = run "git rev-parse --abbrev-ref HEAD"
  let commit = run "git rev-parse --short HEAD"
  let env = run "if [ '${branch}' = 'main' ]; then echo production; elif [ '${branch}' = 'staging' ]; then echo staging; else echo development; fi"
  prompt: Deploying commit ${commit} from branch ${branch} to ${env}. Verify the deployment config in deploy.yml matches environment ${env}.
  run: npm run build
  prompt: Build succeeded. Run the ${env} deploy. Commit: ${commit}, Branch: ${branch}.

done when:
  gate deployed: curl -sf http://localhost:3000/health
```

---

### 1.10 Chained Let-Run for Data Pipeline Validation

Each step's output feeds into the next step's command. The chain ensures that exact row counts and schema details propagate forward without approximation.

```prompt-language
Goal: validate the ETL pipeline after schema migration

flow:
  let pre_count = run "psql -t -c 'SELECT count(*) FROM users' mydb"
  run: node scripts/migrate.js
  let post_count = run "psql -t -c 'SELECT count(*) FROM users' mydb"
  let schema = run "psql -c '\\d users' mydb | head -30"
  prompt: Migration complete. Before: ${pre_count} rows. After: ${post_count} rows. Schema: ${schema}. Verify no data was lost and the new columns are correct. If row counts differ, investigate and fix.

done when:
  gate migration_ok: node scripts/validate-migration.js
```

---

### 1.11 Captured Reasoning as Test Oracle

Captures Claude's analysis of expected behavior, then uses it to verify the implementation matches the spec. The captured expectation serves as a stable oracle.

```prompt-language
Goal: implement the discount calculation from the spec

flow:
  let spec = run "cat docs/discount-spec.md"
  let expectations = prompt "Read this spec: ${spec}. List every edge case with exact expected input/output pairs as a JSON array."
  prompt: Implement calculateDiscount() in src/pricing.ts matching the spec. Edge cases to handle: ${expectations}
  prompt: Write tests in src/pricing.test.ts covering every case from: ${expectations}. Each test should use the exact input/output pairs.
  run: npm test

done when:
  tests_pass
```

---

### Debate: Context Threading

**When to use it.** Context threading shines at distance -- when 10+ steps separate the capture from the consumption, or when exact values matter (version strings, exit codes, row counts, timing numbers). At 2-5 steps, vanilla Claude remembers values from conversation history equally well, and variables add ceremony without meaningful benefit. The sweet spot is flows where a value captured in step 2 is needed verbatim in step 8 or later, or where context compression might discard the detail.

**When to avoid it.** Short flows where every step is adjacent do not need variables. If the next prompt immediately follows the capture, Claude's working memory is sufficient. Also avoid over-threading: capturing 15 variables and interpolating all of them into a single prompt creates a wall of text that can actually degrade Claude's performance. Be selective -- thread what matters, let conversation context handle the rest.

**Common mistakes.** The most frequent error is forgetting that auto-variables (`last_stdout`, `command_failed`) are overwritten after every `run:` node. If you capture `let x = run "cmd1"` and then run another command, `last_stdout` now holds `cmd1`'s output, but a subsequent `run: cmd2` overwrites it. If you need the previous stdout later, save it explicitly. Another mistake is using `${varName}` in a `run:` command without realizing that `shellInterpolate()` wraps it in single quotes -- this is a safety feature, not a bug, but it means you cannot use variables to inject shell operators or pipes.

**The surprising insight.** In evaluation, variable threading tied with vanilla Claude on correctness for flows under 10 steps. Its real value is not recall accuracy but _readability_ -- a flow with named variables is self-documenting. When you return to a flow six months later, `${baseline}` and `${after}` tell you what the flow does; raw prompt text does not. Context threading is as much a maintenance feature as it is a reliability feature.

---

## 2. Hard Gate Enforcement

Gates are the defining feature of prompt-language. A `done when:` predicate runs a real shell command and checks the exit code. The agent cannot stop, claim success, or finesse its way past a gate. If `npm test` returns exit code 1, the gate fails. No amount of conversational confidence changes an exit code.

---

### 2.1 The Simplest Gate

No flow, no variables, no control structures. Just a prompt and a gate. This is the minimum viable usage of the plugin and often the most valuable.

```prompt-language
Goal: fix the failing tests in the auth module

done when:
  tests_pass
```

**Why this works:** Claude works however it wants -- reading files, making changes, running tests on its own. But it cannot stop until `npm test` exits 0. If it claims "done" prematurely, the TaskCompleted hook blocks it and sends it back.

---

### 2.2 Multi-Gate Quality Contract

Requires both tests and lint to pass. The agent must satisfy all gates, not just one. This prevents the common failure mode where fixing tests introduces lint violations (or vice versa).

```prompt-language
Goal: refactor the payment module for clarity

done when:
  tests_pass
  lint_pass
```

---

### 2.3 Custom Gate for Type Checking

When your project uses a type checker not covered by built-in predicates, define a custom gate with `gate name: command`.

```prompt-language
Goal: add TypeScript strict mode to the codebase

flow:
  prompt: Enable strict mode in tsconfig.json and fix all resulting type errors across src/.
  run: npx tsc --noEmit

done when:
  tests_pass
  gate typecheck: npx tsc --noEmit
```

---

### 2.4 File Existence Gate for Artifact Generation

Ensures a specific artifact actually exists on disk before the flow can complete. Useful for code generation, migration scripts, and documentation tasks.

```prompt-language
Goal: generate the OpenAPI spec from the Express routes

flow:
  prompt: Analyze all route handlers in src/routes/ and generate a complete OpenAPI 3.0 spec.
  prompt: Write the spec to docs/openapi.yaml. Include all request/response schemas.

done when:
  file_exists docs/openapi.yaml
  gate valid_spec: npx swagger-cli validate docs/openapi.yaml
```

---

### 2.5 Boolean Variable as Gate

A variable set during the flow can serve as a gate predicate. The variable must be a boolean string ("true"/"false"). This is useful when the verification logic is embedded in the flow itself.

```prompt-language
Goal: verify data migration integrity

flow:
  run: node scripts/migrate.js
  let row_check = run "node -e \"const a = require('./pre-count.json').total; const b = require('./post-count.json').total; console.log(a === b)\""
  prompt: Migration complete. Row count match: ${row_check}. If false, investigate and fix the migration script.

done when:
  gate rows_match: node -e "const a = require('./pre-count.json').total; const b = require('./post-count.json').total; process.exit(a === b ? 0 : 1)"
```

---

### 2.6 Gate + Retry for Flaky Integration Tests

Combines a retry loop (which structures the fix attempts) with a gate (which independently verifies the final result). The retry gives Claude chances to fix issues; the gate ensures the fix actually holds.

```prompt-language
Goal: fix the flaky integration tests

flow:
  retry max 5
    run: npm run test:integration
    if command_failed
      prompt: Integration tests failed. Read the error output, identify the root cause (race condition, timing, missing setup), and fix it. Do not add retries or sleeps as bandaids.
    end
  end

done when:
  gate integration: npm run test:integration
```

**Why this works:** Even if the retry loop exits after max attempts (because the test is deeply broken), the gate catches it. The agent cannot stop until the integration tests genuinely pass.

---

### 2.7 Language-Specific Gates: Python

Uses the built-in `pytest_pass` predicate for Python projects. Combines with a custom mypy gate for type safety.

```prompt-language
Goal: add type hints to the data processing module

flow:
  prompt: Add comprehensive type hints to src/pipeline/*.py. Use typing module for complex types.
  run: mypy src/pipeline/ --strict
  if command_failed
    prompt: Fix the mypy errors shown above.
  end

done when:
  pytest_pass
  gate mypy: mypy src/pipeline/ --strict
```

---

### 2.8 Language-Specific Gates: Go

Uses `go_test_pass` for a Go project with an additional custom gate for the linter.

```prompt-language
Goal: fix the race condition in the connection pool

flow:
  prompt: Analyze cmd/server/pool.go for race conditions. Use sync primitives correctly.
  run: go test -race ./cmd/server/...

done when:
  go_test_pass
  gate race_check: go test -race ./cmd/server/...
  gate vet: go vet ./...
```

---

### 2.9 Language-Specific Gates: Rust

Uses `cargo_test_pass` combined with a clippy gate for idiomatic Rust.

```prompt-language
Goal: refactor the parser for better error messages

flow:
  prompt: Improve error messages in src/parser.rs. Each parse error should include line number, column, and a helpful suggestion.
  run: cargo test

done when:
  cargo_test_pass
  gate clippy: cargo clippy -- -D warnings
```

---

### 2.10 Gate Prevents Premature Completion on Build

A multi-stage pipeline where the agent must pass three independent gates. Even if the code compiles and tests pass, the build artifact must also be produced.

```prompt-language
Goal: fix the production build pipeline

flow:
  prompt: Fix the build errors in the project. Start with TypeScript compilation, then webpack bundling.
  run: npm run build
  if command_failed
    prompt: Build failed. Fix the errors and try again.
  end
  run: npm test

done when:
  tests_pass
  lint_pass
  gate build: npm run build
  file_exists dist/index.js
```

---

### 2.11 Custom Gate for End-to-End Tests

Uses Playwright for browser-based verification. The gate runs actual browser tests, not just unit tests.

```prompt-language
Goal: fix the login flow

flow:
  prompt: Fix the login form in src/pages/Login.tsx. The form should validate email format, show error messages, and redirect on success.
  run: npm test
  prompt: Now verify the E2E tests pass as well.

done when:
  tests_pass
  gate e2e: npx playwright test tests/login.spec.ts
```

---

### 2.12 Diff Gate Ensures Changes Were Made

The `diff_nonempty` predicate ensures the agent actually modified files. Prevents the failure mode where the agent reads the code, says "looks fine," and tries to stop without making any changes.

```prompt-language
Goal: add error handling to all database calls in src/db/

flow:
  prompt: Wrap every database query in src/db/*.ts with proper try/catch error handling. Log errors with context (query name, parameters). Re-throw as typed DatabaseError.

done when:
  tests_pass
  diff_nonempty
```

---

### Debate: Hard Gate Enforcement

**When to use it.** Always. This is not an exaggeration. If you have any verifiable exit condition -- tests pass, lint passes, a file exists, a build succeeds -- adding a gate costs one line and eliminates the most common failure mode of AI-assisted coding: premature claims of completion. Even for simple tasks, `done when: tests_pass` catches the gap between "I think I fixed it" and "the tests actually pass." Gates are the single highest-value feature of the plugin.

**When to avoid it.** When there is genuinely no verifiable command. If the task is "write a design document" or "brainstorm API names," there is no exit code to check. Forcing a gate on a subjective task either requires a contrived check (like `file_exists design.md`, which only verifies the file was created, not that it is good) or adds overhead without enforcement value. In those cases, use a flow without gates, or do not use the plugin at all.

**Common mistakes.** The biggest mistake is assuming gates use variable values. They do not. A gate always runs the real command, even if a variable with the same name exists. This is by design -- it prevents the agent from setting `tests_pass = "true"` as a variable and bypassing verification. But it surprises users who expect `if tests_pass` and `done when: tests_pass` to behave identically. The second mistake is omitting gates on retry loops. A `retry max 5` structures execution, but if all 5 attempts fail, the flow simply continues to the next step. Without a gate, the agent can stop with broken code. Pair retries with gates.

**Tradeoffs.** Gates add latency. Each gate runs a real command (often `npm test` or `npm run lint`), which can take 10-60 seconds. Multiple gates run in parallel, but the slowest gate determines the minimum wait. For fast iteration during development, use `eval:smoke:quick` to skip gate-heavy tests. For production workflows, the latency is worth the guarantee.

**Surprising insight.** In evaluation, gate-only mode (no flow block, just `done when:`) won more often than flows without gates. The enforcement loop is the key mechanism: the agent works freely, but the gate catches failures. Flows add structure, but gates add correctness. When in doubt, start with gates alone and add flow structure only when you need specific sequencing.

---

## 3. Error Recovery

Error recovery patterns use `try`/`catch`/`finally` to handle command failures gracefully. Instead of aborting on the first error, the flow detects failures and routes Claude to diagnostic or repair steps. Combined with `retry`, these patterns build resilient workflows that can survive flaky commands, transient errors, and unexpected states.

---

### 3.1 Basic Try/Catch for Deploy Failure

The simplest error recovery: try a deploy, catch the failure, and ask Claude to investigate.

```prompt-language
Goal: deploy the application

flow:
  try
    run: npm run deploy
  catch command_failed
    prompt: Deploy failed. Read the error output, diagnose the issue, and fix it.
    run: npm run deploy
  end

done when:
  gate deployed: curl -sf http://localhost:3000/health
```

---

### 3.2 Try with Finally for Guaranteed Cleanup

The `finally` block runs regardless of whether the try body succeeded or the catch triggered. Use it for cleanup that must happen no matter what.

```prompt-language
Goal: run database migration with safety net

flow:
  run: pg_dump mydb > backup.sql
  try
    run: node scripts/migrate.js
  catch command_failed
    prompt: Migration failed. Restore from backup.sql and investigate the error.
    run: psql mydb < backup.sql
  finally
    run: rm -f backup.sql
  end

done when:
  gate migration: node scripts/validate-schema.js
```

**Why this works:** Whether the migration succeeds, fails and gets caught, or fails in the catch block itself, the backup file is always cleaned up by the finally block.

---

### 3.3 Nested Try Blocks for Multi-Stage Pipeline

Each stage has its own error handler. A failure in stage 2 does not trigger stage 1's catch block -- each try/catch is independent.

```prompt-language
Goal: build, test, and deploy with stage-specific error handling

flow:
  try
    run: npm run build
  catch command_failed
    prompt: Build failed. Fix the compilation errors and rebuild.
    run: npm run build
  end
  try
    run: npm test
  catch command_failed
    prompt: Tests failed after successful build. Fix the test failures without breaking the build.
    run: npm test
  end
  try
    run: npm run deploy
  catch command_failed
    prompt: Deploy failed despite passing build and tests. Check deploy config and network connectivity.
  end

done when:
  tests_pass
  gate build: npm run build
```

---

### 3.4 Try + Retry Combination

The retry block handles transient failures (flaky network, race conditions). The try/catch wraps the entire retry for catastrophic failures that exhaust all retries.

```prompt-language
Goal: publish the npm package

flow:
  try
    retry max 3
      run: npm publish --access public
    end
  catch command_failed
    prompt: npm publish failed after 3 attempts. Check: 1) Are you logged in? (npm whoami) 2) Is the version already published? 3) Is the registry reachable? Fix the root cause.
    run: npm publish --access public
  end

done when:
  gate published: npm view @myorg/mypackage version
```

---

### 3.5 Catch with Diagnostic Prompt

Instead of blindly retrying, the catch block asks Claude to diagnose the specific failure before attempting a fix. This avoids the pattern of retrying the same broken approach.

```prompt-language
Goal: fix the CI pipeline

flow:
  try
    run: npm run ci
  catch command_failed
    let error_output = run "npm run ci 2>&1 | tail -30"
    prompt: CI failed. Error output: ${error_output}. Diagnose the root cause. Is it a type error, test failure, lint issue, or dependency problem? Fix the specific issue, do not make broad changes.
    run: npm run ci
  end

done when:
  gate ci: npm run ci
```

---

### 3.6 Recovery Strategy: Rollback on Failure

If a risky operation fails, the catch block rolls back to a known-good state before retrying with a different approach.

```prompt-language
Goal: upgrade the ORM from v2 to v3

flow:
  run: git stash
  try
    prompt: Upgrade sequelize from v2 to v3. Follow the official migration guide. Update all model definitions and query syntax.
    run: npm test
  catch command_failed
    prompt: Upgrade broke tests. Rolling back to retry with a different approach.
    run: git checkout -- .
    run: git stash pop
    prompt: Try an incremental upgrade: first update the config layer only, test, then update models one at a time.
    run: npm test
  end

done when:
  tests_pass
```

---

### 3.7 Try/Catch for Docker Build Recovery

Handles Docker-specific failures where the build context, Dockerfile syntax, or layer caching can cause non-obvious errors.

```prompt-language
Goal: fix the Docker build

flow:
  try
    run: docker build -t myapp:latest . timeout 120
  catch command_failed
    let docker_err = run "docker build -t myapp:latest . 2>&1 | tail -20"
    prompt: Docker build failed: ${docker_err}. Common causes: missing files in .dockerignore, incorrect COPY paths, failed RUN commands. Diagnose and fix the Dockerfile.
    run: docker build -t myapp:latest . timeout 120
  end

done when:
  gate docker: docker build -t myapp:latest .
```

---

### 3.8 Catch with Escalating Fix Strategy

First catch attempt tries a simple fix. If that fails too, a second try block attempts a more aggressive repair. This models the real-world pattern of "try the easy fix first."

```prompt-language
Goal: fix the broken database connection

flow:
  try
    run: node scripts/test-db-connection.js
  catch command_failed
    # First attempt: fix config
    prompt: Connection failed. Check database.yml for correct host, port, and credentials. Fix any misconfigurations.
    try
      run: node scripts/test-db-connection.js
    catch command_failed
      # Second attempt: deeper investigation
      prompt: Config fix did not work. Check if the database service is running, if the schema exists, and if migrations are current. Run migrations if needed.
      run: node scripts/run-migrations.js
      run: node scripts/test-db-connection.js
    end
  end

done when:
  gate db: node scripts/test-db-connection.js
```

---

### 3.9 Finally for Test Environment Teardown

Ensures test infrastructure is torn down even if the tests fail or the catch block errors. Prevents orphaned Docker containers and leaked resources.

```prompt-language
Goal: run integration tests against a containerized database

flow:
  run: docker-compose up -d test-db
  run: sleep 5
  try
    run: npm run test:integration
  catch command_failed
    let test_err = run "npm run test:integration 2>&1 | tail -30"
    prompt: Integration tests failed: ${test_err}. Fix the test setup or the code under test.
    run: npm run test:integration
  finally
    run: docker-compose down test-db
  end

done when:
  gate integration: npm run test:integration
```

---

### 3.10 Try/Catch for Package Install Recovery

Handles the common scenario where `npm install` fails due to peer dependency conflicts, registry issues, or lockfile corruption.

```prompt-language
Goal: resolve dependency installation failures

flow:
  try
    run: npm ci
  catch command_failed
    let install_err = run "npm ci 2>&1 | tail -20"
    prompt: npm ci failed: ${install_err}. If it is a lockfile issue, regenerate package-lock.json. If it is a peer dependency conflict, resolve it. If it is a registry issue, check .npmrc.
    try
      run: npm install
    catch command_failed
      prompt: npm install also failed. Delete node_modules and package-lock.json, then run npm install fresh.
      run: rm -rf node_modules package-lock.json
      run: npm install
    end
  end
  run: npm test

done when:
  tests_pass
```

---

### 3.11 Retry Inside Try for Transient Network Failures

The try block wraps a retry loop that handles transient failures (API timeouts, network blips). The catch handles persistent failures that survive all retries.

```prompt-language
Goal: fetch and process external API data

flow:
  try
    retry max 3
      run: node scripts/fetch-external-data.js timeout 30
    end
  catch command_failed
    prompt: External API is unreachable after 3 attempts. Check scripts/fetch-external-data.js for correct URL, auth headers, and timeout settings. Consider if the API endpoint has changed.
    run: node scripts/fetch-external-data.js timeout 60
  end
  prompt: Data fetched. Process it and write results to output/report.json.

done when:
  file_exists output/report.json
```

---

### 3.12 Try/Catch with Variable-Captured Diagnostics

Captures the state before and after the failure to provide maximum diagnostic context in the catch block.

```prompt-language
Goal: fix the memory leak in the worker process

flow:
  let baseline_mem = run "node -e \"process.memoryUsage().heapUsed\" 2>/dev/null || echo unknown"
  try
    run: node --max-old-space-size=256 scripts/stress-test.js timeout 60
  catch command_failed
    let crash_log = run "cat scripts/stress-test.log 2>/dev/null | tail -30"
    let heap_snapshot = run "ls -la *.heapsnapshot 2>/dev/null | head -5"
    prompt: Worker crashed. Baseline memory: ${baseline_mem}. Crash log: ${crash_log}. Heap snapshots: ${heap_snapshot}. Identify the leak source -- look for unbounded caches, event listener accumulation, or closure captures. Fix the root cause.
    run: node --max-old-space-size=256 scripts/stress-test.js timeout 60
  end

done when:
  gate stress: node --max-old-space-size=256 scripts/stress-test.js
```

---

### Debate: Error Recovery

**When to use it.** Try/catch patterns are essential for any flow that runs external commands with a meaningful failure rate: deploys, Docker builds, database migrations, package installations, API calls. If the command can fail for reasons other than "the code is wrong" (network issues, transient errors, infrastructure state), wrapping it in try/catch lets the flow diagnose and recover instead of just stopping. The finally block is specifically valuable when the flow manages external resources (containers, temp files, database connections) that must be cleaned up regardless of outcome.

**When to avoid it.** Do not use try/catch for expected failures that are part of the normal flow. If you are running `npm test` and expecting it to fail (because the point of the flow is to fix failing tests), use `if command_failed` or a retry loop, not try/catch. Try/catch implies an exceptional condition with a recovery path. Using it for routine test failures is semantically misleading and adds nesting depth without benefit. Also avoid deeply nested try blocks (more than 2 levels). If your error recovery requires that much branching, the flow is probably trying to do too much -- break it into smaller, focused flows.

**Common mistakes.** The most dangerous mistake is forgetting that the catch condition defaults to `command_failed`. If you write `try ... catch ... end` without specifying a condition, it catches on `command_failed`, which means any run failure in the try body triggers the catch. This is usually what you want, but it can surprise you if the try body contains multiple run commands and you only want to catch failure on the last one. Another mistake is putting critical cleanup in the catch block instead of finally. If the catch block itself fails, cleanup code in catch does not run. Cleanup belongs in finally.

**The tradeoff.** Try/catch adds structural complexity. A simple retry loop is easier to read and debug than a try/catch/finally with nested retries. The question to ask is: "Does the recovery path differ from a simple retry?" If the answer is just "run it again," use retry. If the answer is "roll back, diagnose, try a different approach," use try/catch. The complexity is justified when the recovery strategy is genuinely different from the initial attempt.

**Surprising insight.** In practice, the most valuable try/catch pattern is not the complex multi-stage recovery -- it is the simple "catch and diagnose" pattern (example 3.5). Capturing the error output in a variable and feeding it to a diagnostic prompt produces far better fixes than blindly retrying. Claude is good at diagnosis when given exact error messages; it is bad at diagnosis when asked to guess what went wrong. The combination of `let err = run "..."` inside a catch block with `prompt: ... ${err}` is one of the most effective patterns in the entire DSL.

---

## 4. Loop Patterns

Loops are the workhorse of prompt-language. They turn one-shot attempts into iterative convergence -- the agent keeps working until a verifiable condition is met or the safety rail kicks in. Four loop types serve distinct purposes: `while` continues while something is true, `until` continues until something becomes true, `retry` re-runs on failure, and `foreach` iterates over collections.

---

### 4.1 While: Drain a Work Queue

Demonstrates `while` to keep processing as long as a condition remains true. The agent processes TODO comments until none remain.

```prompt-language
Goal: Resolve all TODO comments in the codebase

flow:
  run: grep -rn "TODO" src/ | wc -l
  while command_succeeded max 10
    let todos = run "grep -rn 'TODO' src/ | head -5"
    if ${todos} != ""
      prompt: Resolve these TODO comments. Implement what each one describes, then remove the comment: ${todos}
      run: grep -rn "TODO" src/ | wc -l
    else
      break
    end
  end

done when:
  gate no_todos: test $(grep -rn "TODO" src/ | wc -l) -eq 0
```

**Why this works:** `while command_succeeded` keeps looping as long as the grep finds TODOs. The `max 10` safety rail prevents runaway loops. The gate independently verifies no TODOs remain, so the agent cannot claim success prematurely.

---

### 4.2 Until: Convergence on Performance Target

Demonstrates `until` to loop until a desired condition is met. The agent optimizes until a benchmark hits the target.

```prompt-language
Goal: Optimize API response time to under 200ms

flow:
  let baseline = run "node bench.js --endpoint /api/users"
  prompt: Profile the /api/users endpoint. Identify the top 3 bottlenecks based on: ${baseline}
  until command_succeeded max 6
    prompt: Optimize the next bottleneck. Focus on the slowest remaining path.
    run: node bench.js --endpoint /api/users --threshold 200
  end

done when:
  gate perf_target: node bench.js --endpoint /api/users --threshold 200
```

**Why this works:** `until command_succeeded` keeps iterating until the benchmark command exits 0 (meaning the threshold was met). Each iteration lets the agent tackle one more optimization. The gate re-runs the benchmark independently to verify the target was actually hit.

---

### 4.3 Retry: Flaky Integration Test

Demonstrates `retry` for operations that may fail transiently. The agent fixes real failures but tolerates flakiness.

```prompt-language
Goal: Fix the flaky Playwright e2e test suite

flow:
  retry max 4
    run: npx playwright test --reporter=list timeout 120
    if command_failed
      let errors = run "npx playwright test --reporter=json 2>&1 | node -e \"const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));j.suites.forEach(s=>s.specs.filter(t=>t.ok===false).forEach(t=>console.log(t.title,t.tests[0].results[0].error?.message||'')))\""
      prompt: These e2e tests failed: ${errors}. Fix the flaky selectors or timing issues. Use data-testid attributes and explicit waits instead of arbitrary timeouts.
    end
  end

done when:
  gate e2e_pass: npx playwright test --reporter=list
```

**Why this works:** `retry max 4` gives the agent up to 4 attempts. On each failure, it captures the specific error messages and feeds them back as context. If the failure is genuine flakiness that the fix resolves, a subsequent retry succeeds. The gate runs the full suite one final time.

---

### 4.4 Foreach: Multi-Service Health Check

Demonstrates `foreach` iterating over a literal list to perform the same action across multiple targets.

```prompt-language
Goal: Audit and fix health check endpoints across all microservices

flow:
  foreach svc in "auth-service billing-service notification-service search-service"
    run: curl -sf http://localhost:8080/${svc}/health
    if command_failed
      prompt: The ${svc} health endpoint is failing. Inspect src/${svc}/health.ts and fix the handler. Common issues: missing database connection checks, incorrect status codes, timeout handling.
      run: curl -sf http://localhost:8080/${svc}/health
    end
  end

done when:
  gate all_healthy: curl -sf http://localhost:8080/auth-service/health && curl -sf http://localhost:8080/billing-service/health && curl -sf http://localhost:8080/notification-service/health && curl -sf http://localhost:8080/search-service/health
```

**Why this works:** `foreach` splits the quoted string on whitespace and iterates. Each service gets checked and fixed individually. The `${svc}` variable is set to the current item on each iteration. The compound gate verifies all services are healthy at once.

---

### 4.5 Foreach over Command Output

Demonstrates `foreach` iterating over dynamic command output. The agent processes each changed file individually.

```prompt-language
Goal: Add JSDoc comments to all modified TypeScript files

flow:
  let changed = run "git diff --name-only HEAD~1 -- '*.ts'"
  foreach file in ${changed} max 20
    prompt: Add comprehensive JSDoc comments to all exported functions and classes in ${file}. Include @param, @returns, and @example tags. Do not modify any logic.
    run: npx tsc --noEmit ${file}
  end

done when:
  gate typecheck: npx tsc --noEmit
```

**Why this works:** The `let` captures filenames from git, and `foreach` iterates over each one. The `max 20` cap prevents the loop from running away on large diffs. After documenting each file, `tsc` verifies no type errors were introduced.

---

### 4.6 Nested Loops: Matrix Testing

Demonstrates nested `foreach` loops to test combinations. The agent validates across multiple Node versions and OS configurations.

```prompt-language
Goal: Validate the build across Node versions

flow:
  foreach version in "18 20 22"
    run: nvm use ${version}
    run: npm ci
    retry max 2
      run: npm test
      if command_failed
        prompt: Tests fail on Node ${version}. Fix the compatibility issue -- check for version-specific API differences (e.g., fetch availability in 18 vs 22, structuredClone support).
      end
    end
  end

done when:
  tests_pass
```

**Why this works:** The outer `foreach` iterates Node versions. The inner `retry` gives each version two chances to pass. The agent gets version-specific context when fixing failures. This is a common CI matrix pattern expressed declaratively.

---

### 4.7 While with Variable Accumulation

Demonstrates using a list variable to accumulate results across loop iterations.

```prompt-language
Goal: Collect and fix all security vulnerabilities

flow:
  let findings = []
  run: npm audit --json > /tmp/audit.json 2>&1
  let count = run "node -e \"const a=require('/tmp/audit.json');console.log(Object.keys(a.vulnerabilities||{}).length)\""
  while ${count} != "0" max 5
    let vuln = run "node -e \"const a=require('/tmp/audit.json');const k=Object.keys(a.vulnerabilities)[0];const v=a.vulnerabilities[k];console.log(k+': '+v.severity+' - '+v.via.map(x=>x.title||x).join(', '))\""
    let findings += "${vuln}"
    prompt: Fix this vulnerability: ${vuln}. Upgrade the package or find an alternative. Do not use --force.
    run: npm audit --json > /tmp/audit.json 2>&1
    let count = run "node -e \"const a=require('/tmp/audit.json');console.log(Object.keys(a.vulnerabilities||{}).length)\""
  end
  prompt: Security audit complete. Findings addressed: ${findings}. Write a summary to SECURITY-AUDIT.md.

done when:
  gate no_vulns: npm audit --audit-level=high
```

**Why this works:** The `let findings = []` initializes an empty list, and `let findings += ...` appends each vulnerability as it is resolved. After the loop, the full list is available for the summary step. The `while` condition rechecks the count each iteration.

---

### 4.8 Break for Early Exit

Demonstrates `break` to exit a loop early when a condition is met before max iterations.

```prompt-language
Goal: Find and fix the root cause of intermittent 500 errors

flow:
  let logs = run "tail -100 /var/log/app/error.log"
  while command_succeeded max 8
    prompt: Analyze the error pattern in these logs: ${logs}. Identify the most likely root cause and apply a fix.
    run: npm test
    if command_succeeded
      run: curl -sf http://localhost:3000/api/stress-test
      if command_succeeded
        break
      end
    end
    let logs = run "tail -100 /var/log/app/error.log"
  end

done when:
  tests_pass
  gate stress_test: curl -sf http://localhost:3000/api/stress-test
```

**Why this works:** The loop keeps running until both tests and stress test pass, at which point `break` exits immediately rather than burning remaining iterations. Without `break`, the loop would continue to `max 8` even after the problem is solved.

---

### 4.9 Until with Compound Condition

Demonstrates `until` with a compound condition using `and` to require multiple criteria.

```prompt-language
Goal: Get the API server passing both unit tests and integration tests

flow:
  run: npm test
  run: npm run test:integration
  until command_succeeded and ${unit_ok} == "true" max 6
    run: npm test
    if command_succeeded
      let unit_ok = "true"
    else
      let unit_ok = "false"
      prompt: Fix the failing unit tests.
    end
    run: npm run test:integration
    if command_failed
      prompt: Fix the failing integration tests. Unit tests are passing -- do not break them.
    end
  end

done when:
  tests_pass
  gate integration: npm run test:integration
```

**Why this works:** The `and` operator in the `until` condition ensures both unit and integration suites must pass before the loop exits. The `let unit_ok` variable tracks the unit test state across iterations since `command_succeeded` gets overwritten by the integration test run.

---

### 4.10 Retry with Progressive Backoff Context

Demonstrates `retry` where each attempt gives the agent more diagnostic context.

```prompt-language
Goal: Fix the database migration that keeps failing

flow:
  retry max 4
    run: npx prisma migrate deploy timeout 30
    if command_failed
      let attempt_err = run "npx prisma migrate status 2>&1 | tail -20"
      let db_state = run "npx prisma db pull --print 2>&1 | head -30"
      prompt: Migration failed. Error: ${attempt_err}. Current DB schema state: ${db_state}. Analyze the mismatch and fix the migration file. Consider: column type conflicts, missing foreign keys, data that violates new constraints.
    end
  end

done when:
  gate migration_clean: npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"
```

**Why this works:** Each retry captures progressively richer diagnostics -- both the error output and the actual DB schema state. The agent sees exactly what went wrong and what the database looks like, giving it the best chance to fix the migration on the next attempt.

---

### 4.11 Foreach with Index Variable

Demonstrates using the auto-set `${var_index}` and `${var_length}` variables for progress tracking.

```prompt-language
Goal: Migrate all API route handlers from Express to Fastify

flow:
  let routes = run "find src/routes -name '*.ts' -not -name '*.test.ts' | sort"
  foreach route in ${routes} max 30
    prompt: Migrate ${route} from Express to Fastify (file ${route_index} of ${route_length}). Convert req/res patterns to Fastify request/reply. Convert middleware to Fastify hooks. Preserve all existing behavior.
    run: npx tsc --noEmit
    if command_failed
      prompt: Type errors after migrating ${route}. Fix them without reverting the migration.
    end
  end

done when:
  gate typecheck: npx tsc --noEmit
  tests_pass
```

**Why this works:** `${route_index}` (zero-based) and `${route_length}` are automatically set by the `foreach` loop, giving the agent awareness of progress through the migration. This helps it make consistent decisions across files (e.g., shared utility patterns established in earlier files).

---

### 4.12 While with External State Check

Demonstrates `while` driven by an external system state rather than command exit codes.

```prompt-language
Goal: Process all messages in the dead letter queue

flow:
  let dlq_count = run "aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names ApproximateNumberOfMessages --query 'Attributes.ApproximateNumberOfMessages' --output text"
  while ${dlq_count} != "0" max 10
    let msg = run "aws sqs receive-message --queue-url $DLQ_URL --max-number-of-messages 1 --query 'Messages[0]' --output json"
    prompt: Analyze this dead letter message: ${msg}. Determine why it failed, fix the handler code if needed, then replay it to the main queue.
    run: aws sqs send-message --queue-url $MAIN_URL --message-body '${msg}'
    let dlq_count = run "aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names ApproximateNumberOfMessages --query 'Attributes.ApproximateNumberOfMessages' --output text"
  end

done when:
  gate dlq_empty: test $(aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names ApproximateNumberOfMessages --query 'Attributes.ApproximateNumberOfMessages' --output text) -eq 0
```

**Why this works:** The `while` condition compares the DLQ count variable against the string `"0"`. Each iteration processes one message, then rechecks the count. The `max 10` prevents runaway processing. The gate independently verifies the queue is truly empty.

---

### Debate: Loop Patterns

**When to use loops vs. simple sequences.** Loops earn their keep when the number of iterations is unpredictable. If you know you need exactly three steps, just write three `prompt:` nodes -- a `foreach` over a three-item list adds indirection without value. Loops shine when convergence is the goal: "keep fixing until tests pass" is fundamentally iterative. You do not know in advance how many fix cycles it will take.

**The `while` vs `until` choice is semantic, not mechanical.** They are logical inverses, so `while not X` and `until X` are equivalent. But readability matters. "Until tests pass" reads as intent; "while tests fail" reads as implementation. Prefer whichever matches how you think about the problem. In practice, `until` dominates for convergence goals and `while` dominates for drain-a-queue patterns.

**The most common mistake is forgetting that `retry` always enters its body.** New users write `retry max 3` expecting it to check a condition before entering. It does not. It runs the body once unconditionally, then re-enters on failure. If you need a pre-check, use `while` or `until`. Conversely, `while` and `until` evaluate their condition before the first iteration -- if the condition is already met, the body never executes. This trips people up when they expect at least one run.

**Max iteration values are safety rails, not targets.** Setting `max 50` does not mean you expect 50 iterations -- it means you want a hard ceiling to prevent runaway cost. In practice, most fix-test loops converge in 2-4 iterations. Set `max` to 2-3x your expected iterations. If you consistently hit the max, the problem is likely too hard for iterative fixing and needs human intervention. The surprising insight from real usage: `max 3` catches 80% of solvable problems; `max 10` catches 95%. Beyond that, you are in diminishing returns territory where each additional iteration costs agent time without proportional benefit.

---

## 5. Variable Pipelines

Variables transform prompt-language from a simple step sequencer into a data pipeline. The `let x = run "cmd"` pattern captures command output as a first-class value that flows through subsequent steps -- feeding into conditions, interpolating into prompts, and driving control flow decisions.

---

### 5.1 Capture and Compare: Before/After Benchmarking

Demonstrates the fundamental capture-then-use pattern: store a baseline, do work, capture the result, compare.

```prompt-language
Goal: Optimize React bundle size

flow:
  let before_size = run "npx vite build 2>&1 | grep 'dist/' | tail -1"
  let before_kb = run "du -sk dist/ | cut -f1"
  prompt: Analyze the bundle with "npx vite-bundle-visualizer". Identify the three largest dependencies and find ways to reduce them: tree-shaking, dynamic imports, or smaller alternatives.
  let after_size = run "npx vite build 2>&1 | grep 'dist/' | tail -1"
  let after_kb = run "du -sk dist/ | cut -f1"
  prompt: Bundle optimization results. Before: ${before_size} (${before_kb}KB). After: ${after_size} (${after_kb}KB). Write a summary of what changed and why to OPTIMIZATION.md.

done when:
  gate smaller_bundle: test $(du -sk dist/ | cut -f1) -lt ${before_kb}
```

**Why this works:** The `let before_kb` and `let after_kb` variables capture exact numeric values at different points in time. Without variables, the agent would need to remember the baseline from earlier in the conversation, which becomes unreliable over many steps. The gate uses the captured baseline to verify the bundle actually shrank.

---

### 5.2 Chained Extraction: Multi-Layer Diagnostics

Demonstrates chaining multiple `let` captures to build a complete diagnostic picture.

```prompt-language
Goal: Diagnose and fix the production memory leak

flow:
  let heap_profile = run "node --inspect-brk=0 -e 'setTimeout(()=>{},30000)' & sleep 2 && curl -s http://localhost:9229/json/list | node -e \"process.stdin.on('data',d=>console.log(JSON.parse(d)[0].devtoolsFrontendUrl))\" && kill %1"
  let top_retainers = run "node scripts/analyze-heap.js --top 5"
  let gc_stats = run "node --expose-gc -e 'global.gc();console.log(process.memoryUsage())' 2>&1"
  let event_listeners = run "node -e \"const h=require('./src/server');console.log(h.listenerCount('request'),h.listenerCount('connection'))\""
  prompt: Memory leak analysis. Heap: ${heap_profile}. Top retainers: ${top_retainers}. GC stats: ${gc_stats}. Listener counts: ${event_listeners}. Identify the leak source and fix it. Common causes: unremoved event listeners, growing caches without eviction, closures capturing large objects.
  run: node scripts/stress-test.js --duration 30 --rss-limit 200

done when:
  gate no_leak: node scripts/stress-test.js --duration 60 --rss-limit 200
```

**Why this works:** Four separate diagnostic commands each capture one dimension of the problem. When all four are interpolated into a single prompt, the agent gets a complete picture without needing to run the diagnostics itself (which could alter the state it is diagnosing).

---

### 5.3 List Building: Accumulate Test Failures

Demonstrates `let x = []` and `let x += run "cmd"` to build a list across iterations.

```prompt-language
Goal: Fix all failing test files one at a time

flow:
  let fixed_files = []
  let failing = run "npx jest --listFailingTests 2>/dev/null | grep '.test.'"
  foreach testfile in ${failing} max 15
    prompt: Fix the tests in ${testfile}. Run only this file to verify your fix.
    run: npx jest ${testfile} --no-coverage
    if command_succeeded
      let fixed_files += "${testfile}"
    end
  end
  prompt: Fixed ${fixed_files_length} files: ${fixed_files}. Run the full suite to check for cross-test interactions.
  run: npx jest

done when:
  tests_pass
```

**Why this works:** `let fixed_files = []` initializes an empty list. Each successful fix appends the filename via `let fixed_files += ...`. After the loop, `${fixed_files}` contains the full list and `${fixed_files_length}` has the count. The final prompt uses both to summarize progress.

---

### 5.4 Default Values: Environment-Aware Deployment

Demonstrates `${var:-fallback}` syntax for safe defaults when variables may not be set.

```prompt-language
Goal: Deploy the application to the target environment

flow:
  let branch = run "git rev-parse --abbrev-ref HEAD"
  let commit = run "git rev-parse --short HEAD"
  let image_tag = "${branch}-${commit}"
  prompt: Build the Docker image tagged ${image_tag}. Push to ${registry:-ghcr.io/myorg/myapp}.
  run: docker build -t ${registry:-ghcr.io/myorg/myapp}:${image_tag} .
  run: docker push ${registry:-ghcr.io/myorg/myapp}:${image_tag}
  run: kubectl set image deployment/${app_name:-myapp} app=${registry:-ghcr.io/myorg/myapp}:${image_tag} --namespace=${namespace:-production}
  run: kubectl rollout status deployment/${app_name:-myapp} --namespace=${namespace:-production} timeout 120

done when:
  gate healthy: kubectl get pods -l app=${app_name:-myapp} -n ${namespace:-production} -o jsonpath='{.items[*].status.phase}' | grep -v Running | wc -l | grep -q '^0$'
```

**Why this works:** The `${var:-fallback}` syntax provides sensible defaults for `registry`, `app_name`, and `namespace`. If the user sets these variables (e.g., with a preceding `let`), the defaults are ignored. This makes the flow reusable across environments without modification.

---

### 5.5 Variable-Driven Branching

Demonstrates variables feeding directly into `if` conditions to drive control flow.

```prompt-language
Goal: Set up the project with the correct package manager

flow:
  let has_yarn = run "test -f yarn.lock && echo true || echo false"
  let has_pnpm = run "test -f pnpm-lock.yaml && echo true || echo false"
  let node_ver = run "node -v"
  if ${has_pnpm} == "true"
    let pm = "pnpm"
    run: pnpm install
  else
    if ${has_yarn} == "true"
      let pm = "yarn"
      run: yarn install
    else
      let pm = "npm"
      run: npm install
    end
  end
  prompt: Dependencies installed with ${pm} on Node ${node_ver}. Run the test suite and fix any failures.
  run: ${pm} test

done when:
  tests_pass
```

**Why this works:** The `let has_yarn` and `let has_pnpm` variables capture detection results as explicit strings. The nested `if` conditions then compare these string values to choose the right package manager. The chosen `pm` variable flows into subsequent `run:` and `prompt:` steps, keeping the rest of the flow manager-agnostic.

---

### 5.6 Multi-Source Aggregation for Code Review

Demonstrates capturing data from multiple independent commands and combining them into a single review context.

```prompt-language
Goal: Perform a thorough code review of the current PR

flow:
  let diff_stat = run "git diff --stat main...HEAD"
  let changed_files = run "git diff --name-only main...HEAD"
  let commit_log = run "git log --oneline main...HEAD"
  let test_coverage = run "npx jest --coverage --coverageReporters=text-summary 2>&1 | tail -5"
  let type_errors = run "npx tsc --noEmit 2>&1 | tail -20"
  let lint_issues = run "npx eslint . --format compact 2>&1 | tail -20"
  prompt: Review this PR. Changes: ${diff_stat}. Files: ${changed_files}. Commits: ${commit_log}. Coverage: ${test_coverage}. Type errors: ${type_errors}. Lint: ${lint_issues}. Write a review covering: correctness, test coverage gaps, type safety issues, and style problems. Write the review to PR-REVIEW.md.

done when:
  file_exists PR-REVIEW.md
```

**Why this works:** Six `let` captures run sequentially, each capturing one facet of the PR. The prompt step receives all six simultaneously, enabling a holistic review that cross-references different data sources. Without variables, the agent would need to run each command itself, consuming turns and losing earlier output to context compression.

---

### 5.7 Capture Prompt: Store Agent Reasoning

Demonstrates `let x = prompt "..."` to capture the agent's own analysis as a reusable variable.

```prompt-language
Goal: Refactor the authentication module with a documented plan

flow:
  let analysis = prompt "Analyze src/auth/ for code smells: duplicated logic, god objects, missing abstractions, tight coupling. List each issue with its file and line range."
  let plan = prompt "Based on this analysis: ${analysis} -- create a numbered refactoring plan. Order steps to minimize breakage: extract interfaces first, then split classes, then rewire dependencies."
  prompt: Execute step 1 of the plan: ${plan}
  run: npm test
  prompt: Execute step 2 of the plan: ${plan}
  run: npm test
  prompt: Execute step 3 of the plan: ${plan}
  run: npm test
  prompt: All steps executed. Verify the refactoring preserved behavior. Analysis was: ${analysis}. Plan was: ${plan}.

done when:
  tests_pass
  lint_pass
```

**Why this works:** `let analysis = prompt` captures the agent's analytical output as a variable. `let plan = prompt` then builds on that analysis. Both are available as `${analysis}` and `${plan}` throughout subsequent steps. This is particularly valuable for long workflows where the original reasoning would otherwise be lost to context window limits.

---

### 5.8 Error Forensics Pipeline

Demonstrates capturing errors as they occur, then citing them precisely in a postmortem.

```prompt-language
Goal: Fix all microservice integration failures and write a postmortem

flow:
  let auth_err = run "curl -s http://localhost:3001/health | head -20"
  if command_failed
    prompt: Fix the auth service. Error: ${auth_err}
  end
  let billing_err = run "curl -s http://localhost:3002/health | head -20"
  if command_failed
    prompt: Fix the billing service. Error: ${billing_err}
  end
  let gateway_err = run "curl -s http://localhost:3000/health | head -20"
  if command_failed
    prompt: Fix the API gateway. Error: ${gateway_err}
  end
  prompt: Write postmortem.md documenting the incident. Cite exact errors -- Auth: ${auth_err}, Billing: ${billing_err}, Gateway: ${gateway_err}. Include root cause, timeline, and preventive measures.

done when:
  file_exists postmortem.md
  gate all_services: curl -sf http://localhost:3000/health && curl -sf http://localhost:3001/health && curl -sf http://localhost:3002/health
```

**Why this works:** Each `let` captures the exact error output at the moment of failure. Even after the agent fixes each service (which changes the output), the original errors remain preserved in variables. The postmortem step gets exact error messages, not the agent's paraphrase of what it remembers.

---

### 5.9 Variables Feeding Loop Conditions

Demonstrates using captured variables as dynamic loop bounds and conditions.

```prompt-language
Goal: Process all pending database migrations

flow:
  let pending = run "npx prisma migrate status 2>&1 | grep 'Not yet applied' | wc -l"
  let db_version = run "npx prisma migrate status 2>&1 | grep 'Last applied' | head -1"
  prompt: Database is at ${db_version} with ${pending} pending migrations. Review each migration file for safety issues before applying.
  until ${pending} == "0" max 8
    run: npx prisma migrate deploy --preview-feature 2>&1 | head -20
    if command_failed
      let migration_err = run "npx prisma migrate status 2>&1 | tail -10"
      prompt: Migration failed: ${migration_err}. Fix the migration file and retry. Check for: incompatible column types, missing default values for NOT NULL columns, foreign key constraint violations.
    end
    let pending = run "npx prisma migrate status 2>&1 | grep 'Not yet applied' | wc -l"
  end

done when:
  gate migrations_current: npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"
```

**Why this works:** The `until ${pending} == "0"` condition uses the captured variable, which gets refreshed at the end of each iteration. The loop naturally terminates when all migrations are applied. The `let db_version` gives the agent awareness of the starting state.

---

### 5.10 Building Context from Multiple Commands

Demonstrates assembling a rich context object from heterogeneous data sources for an informed decision.

```prompt-language
Goal: Right-size the Kubernetes deployment based on actual usage

flow:
  let cpu_usage = run "kubectl top pods -l app=myapp --no-headers | awk '{print $2}'"
  let mem_usage = run "kubectl top pods -l app=myapp --no-headers | awk '{print $3}'"
  let current_replicas = run "kubectl get deployment myapp -o jsonpath='{.spec.replicas}'"
  let cpu_requests = run "kubectl get deployment myapp -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}'"
  let mem_requests = run "kubectl get deployment myapp -o jsonpath='{.spec.template.spec.containers[0].resources.requests.memory}'"
  let hpa_status = run "kubectl get hpa myapp -o jsonpath='{.status.currentMetrics}' 2>/dev/null || echo 'no HPA'"
  prompt: Current state -- Replicas: ${current_replicas}, CPU usage: ${cpu_usage} (requested: ${cpu_requests}), Memory usage: ${mem_usage} (requested: ${mem_requests}), HPA: ${hpa_status}. Adjust resource requests and limits to match actual usage with 30% headroom. Update the deployment YAML.
  run: kubectl apply -f k8s/deployment.yaml
  run: kubectl rollout status deployment/myapp timeout 120

done when:
  gate rollout_healthy: kubectl rollout status deployment/myapp
```

**Why this works:** Six captures build a complete picture of the deployment's resource state. The agent receives all metrics simultaneously and can make an informed right-sizing decision. Without variables, the agent would need to run each `kubectl` command itself, potentially seeing inconsistent data if the cluster state changes between commands.

---

### 5.11 Transform Pipeline: Extract, Clean, Use

Demonstrates a multi-step transform chain where each variable builds on the previous one.

```prompt-language
Goal: Generate API client from OpenAPI spec

flow:
  let spec_url = run "grep 'openapi' package.json | head -1 | sed 's/.*: \"//;s/\".*//' || echo 'http://localhost:3000/api-docs/swagger.json'"
  let spec_version = run "curl -s ${spec_url} | node -e \"process.stdin.on('data',d=>console.log(JSON.parse(d).info.version))\""
  let endpoints = run "curl -s ${spec_url} | node -e \"process.stdin.on('data',d=>{const p=JSON.parse(d).paths;console.log(Object.keys(p).length+' endpoints: '+Object.keys(p).slice(0,10).join(', '))})\""
  prompt: Generate a TypeScript API client for spec v${spec_version}. Endpoints: ${endpoints}. Use fetch, add proper types for request/response bodies, include error handling. Write to src/api-client.ts.
  run: npx tsc --noEmit src/api-client.ts

done when:
  file_exists src/api-client.ts
  gate typecheck: npx tsc --noEmit
```

**Why this works:** Each variable builds on context from the preceding step. The spec URL is extracted from config, then used to fetch the version and endpoint list. The final prompt receives all three derived values. This is a pipeline pattern: raw data flows through successive transformations into actionable context.

---

### Debate: Variable Pipelines

**Variables are not just convenience -- they are precision tools.** The most important thing variables provide is exactness. When the agent runs `node -v` and gets `v22.1.0`, that string is stored byte-for-byte. Ten steps later, `${node_ver}` still produces `v22.1.0`. Without the variable, the agent reconstructs the version from memory, which usually works but occasionally produces `v22.0.0` or `v22.x`. For human-readable text, this does not matter. For values interpolated into shell commands, it is the difference between a working deploy and a failed one.

**The biggest mistake is over-capturing.** Not every command output needs a variable. If you run `npm test` and only care whether it passed, the built-in `command_failed`/`command_succeeded` variables already capture that. Reserve `let x = run` for outputs you will actually reference later. Every unnecessary variable adds noise to the rendered flow state that Claude sees on each turn, making it harder for the agent to focus on what matters.

**Default values (`${var:-fallback}`) are underused.** Most flows hard-code environment-specific values. Adding defaults makes flows portable across environments without modification. The pattern `${registry:-ghcr.io/default}` costs nothing when the variable is set but saves a flow rewrite when it is not.

**The `let x = prompt` capture mode is powerful but fragile.** It relies on the agent writing a file to disk, which has a retry mechanism but can still fail silently (setting the variable to empty string). Always use `${x:-fallback}` when a captured prompt variable feeds into a `run:` command. The surprising insight: `let x = prompt` is most valuable not for capturing answers but for capturing plans. Storing a multi-step plan as a variable and referencing it in later steps keeps the agent aligned with its own strategy even after context compression removes the original reasoning.

---

## 6. Multi-Phase Workflows

Real engineering tasks rarely fit into a single loop. They have distinct phases -- setup, execution, validation, cleanup -- each with different failure modes and recovery strategies. Multi-phase flows compose the primitives from earlier categories into complete operational workflows where each phase depends on the success of the previous one.

---

### 6.1 Build-Test-Deploy Pipeline

Demonstrates a classic CI/CD pipeline with explicit phases, quality gates, and rollback on failure.

```prompt-language
Goal: Build, test, and deploy the application to staging

flow:
  # Phase 1: Build
  run: npm ci
  run: npm run build timeout 120
  if command_failed
    prompt: Build failed. Fix the compilation errors.
    retry max 3
      run: npm run build timeout 120
    end
  end

  # Phase 2: Test
  run: npm test
  if command_failed
    prompt: Tests failing after build. Fix the test failures without modifying the build output.
    retry max 3
      run: npm test
    end
  end

  # Phase 3: Deploy
  let git_sha = run "git rev-parse --short HEAD"
  try
    run: docker build -t myapp:${git_sha} .
    run: docker push registry.example.com/myapp:${git_sha}
    run: kubectl set image deployment/myapp app=registry.example.com/myapp:${git_sha}
    run: kubectl rollout status deployment/myapp timeout 180
  catch command_failed
    prompt: Deployment failed. Roll back and investigate. Run: kubectl rollout undo deployment/myapp
    run: kubectl rollout undo deployment/myapp
  end

done when:
  gate deployed: kubectl rollout status deployment/myapp
```

**Why this works:** Three distinct phases each have their own error handling. The build phase retries on failure. The test phase retries independently. The deploy phase uses `try/catch` to roll back on failure rather than retrying (since a partial deploy needs cleanup, not repetition). The captured `git_sha` ensures all deploy steps reference the same commit.

---

### 6.2 Database Schema Migration

Demonstrates a multi-phase migration with safety checks, backups, and validation at each stage.

```prompt-language
Goal: Safely migrate the database schema to support multi-tenancy

flow:
  # Phase 1: Pre-flight
  let db_size = run "psql -t -c 'SELECT pg_size_pretty(pg_database_size(current_database()))'"
  let table_count = run "psql -t -c 'SELECT count(*) FROM information_schema.tables WHERE table_schema = '\\''public'\\'''"
  prompt: Database has ${table_count} tables, size ${db_size}. Review the migration plan for multi-tenancy. We need to add tenant_id to all tables, create RLS policies, and update all queries.

  # Phase 2: Backup
  run: pg_dump -Fc -f /tmp/pre-migration-backup.dump
  if command_failed
    prompt: Backup failed. Fix the pg_dump command and retry.
    run: pg_dump -Fc -f /tmp/pre-migration-backup.dump
  end

  # Phase 3: Schema changes
  try
    prompt: Add tenant_id column (UUID, NOT NULL with default) to all tables that don't have it. Create the migration file.
    run: npx prisma migrate dev --name add-tenant-id
    prompt: Create Row Level Security policies for all tables using tenant_id. Write the migration.
    run: npx prisma migrate dev --name add-rls-policies
  catch command_failed
    prompt: Migration failed. Restore from backup at /tmp/pre-migration-backup.dump if needed. Fix the migration and try again.
    run: npx prisma migrate status
  end

  # Phase 4: Validation
  run: npm test
  if command_failed
    prompt: Tests fail after migration. Update queries and tests to include tenant_id.
    retry max 3
      run: npm test
    end
  end

done when:
  tests_pass
  gate migration_current: npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"
```

---

### 6.3 Release Process

Demonstrates a complete release workflow: version bump, changelog, build, tag, and publish.

```prompt-language
Goal: Prepare and publish a new release

flow:
  # Phase 1: Pre-release checks
  let current = run "node -e \"console.log(require('./package.json').version)\""
  let branch = run "git rev-parse --abbrev-ref HEAD"
  run: git diff --quiet
  if command_failed
    prompt: There are uncommitted changes. Stash or commit them before releasing.
    run: git diff --quiet
  end

  # Phase 2: Version and changelog
  let commits = run "git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~20)..HEAD"
  prompt: Current version is ${current} on branch ${branch}. Recent commits: ${commits}. Determine the next semantic version based on conventional commits. Update package.json version. Generate CHANGELOG.md entries for this release.

  # Phase 3: Build and validate
  run: npm ci
  run: npm run build timeout 120
  run: npm test
  if command_failed
    prompt: Tests fail on release build. Fix immediately -- do not release broken code.
    retry max 3
      run: npm test
    end
  end

  # Phase 4: Tag and publish
  let new_version = run "node -e \"console.log(require('./package.json').version)\""
  run: git add package.json CHANGELOG.md
  run: git commit -m "chore: release v${new_version}"
  run: git tag v${new_version}

done when:
  gate version_bumped: test "$(node -e "console.log(require('./package.json').version)")" != "${current}"
  gate changelog_updated: test -f CHANGELOG.md
  tests_pass
```

**Why this works:** The `${current}` variable captures the version before any changes. The gate compares the final version against it to verify an actual bump occurred. Each phase is isolated: pre-checks, versioning, building, and publishing. The agent cannot skip to publishing without passing through the test gate.

---

### 6.4 Feature Flag Rollout

Demonstrates a progressive rollout workflow with validation at each percentage.

```prompt-language
Goal: Roll out the new checkout flow behind a feature flag

flow:
  # Phase 1: Setup flag
  prompt: Create a feature flag named "new-checkout-v2" in src/flags.ts. Default to 0% rollout. Use the LaunchDarkly SDK pattern with a percentage-based rule.
  run: npm run build
  run: npm test

  # Phase 2: Progressive rollout
  foreach pct in "10 25 50 75 100"
    prompt: Update the new-checkout-v2 flag to ${pct}% rollout. Adjust the percentage rule in the flag configuration.
    run: npm test
    if command_failed
      prompt: Tests fail at ${pct}% rollout. Fix the issue -- likely a race condition or missing fallback for users not in the flag cohort.
      retry max 2
        run: npm test
      end
    end
    run: node scripts/validate-flag-state.js --flag new-checkout-v2 --expected-pct ${pct}
  end

done when:
  tests_pass
  gate flag_at_100: node scripts/validate-flag-state.js --flag new-checkout-v2 --expected-pct 100
```

**Why this works:** The `foreach` iterates through rollout percentages. At each stage, tests must pass before advancing to the next percentage. If tests fail at 25%, the retry block attempts a fix before moving to 50%. The gate ensures the flag reaches 100% rollout with all tests passing.

---

### 6.5 Monorepo Multi-Package Release

Demonstrates coordinating changes across multiple packages in a monorepo with dependency ordering.

```prompt-language
Goal: Update the shared types package and cascade to all dependent packages

flow:
  # Phase 1: Update the core types
  prompt: Update the type definitions in packages/types/src/index.ts according to the new API schema. Add the new fields, deprecate removed ones with JSDoc tags.
  run: npx tsc --noEmit -p packages/types/tsconfig.json

  # Phase 2: Cascade to dependents
  let dependents = run "node -e \"const p=require('./package.json');const ws=p.workspaces||[];console.log(ws.join(' '))\""
  foreach pkg in ${dependents} max 10
    let has_dep = run "node -e \"const p=require('./${pkg}/package.json');console.log(p.dependencies?.['@myorg/types']?'yes':'no')\""
    if ${has_dep} == "yes"
      prompt: Update ${pkg} to use the new type definitions from @myorg/types. Fix all type errors. Do not change runtime behavior.
      run: npx tsc --noEmit -p ${pkg}/tsconfig.json
      if command_failed
        prompt: Type errors in ${pkg} after type update. Fix them.
        retry max 2
          run: npx tsc --noEmit -p ${pkg}/tsconfig.json
        end
      end
    end
  end

  # Phase 3: Full build
  run: npm run build --workspaces
  run: npm test --workspaces

done when:
  gate typecheck_all: npx tsc --noEmit --build
  tests_pass
```

**Why this works:** Phase 1 updates the source package. Phase 2 uses `foreach` to discover and update dependents, with a `let`/`if` pattern to skip packages that do not depend on the types package. Phase 3 validates the entire monorepo. The agent handles packages individually but the gate validates everything together.

---

### 6.6 Blue-Green Deployment

Demonstrates a blue-green deployment with traffic switching and validation.

```prompt-language
Goal: Deploy the new version using blue-green strategy

flow:
  # Phase 1: Determine current active
  let active_color = run "kubectl get svc myapp -o jsonpath='{.spec.selector.color}'"
  if ${active_color} == "blue"
    let target_color = "green"
  else
    let target_color = "blue"
  end

  # Phase 2: Deploy to inactive
  let image_tag = run "git rev-parse --short HEAD"
  run: kubectl set image deployment/myapp-${target_color} app=registry.example.com/myapp:${image_tag}
  run: kubectl rollout status deployment/myapp-${target_color} timeout 180

  # Phase 3: Validate inactive
  try
    run: kubectl run smoke-test --image=curlimages/curl --rm -i --restart=Never -- curl -sf http://myapp-${target_color}:3000/health timeout 30
    run: kubectl run integration-test --image=myapp-test:latest --rm -i --restart=Never --env="TARGET=http://myapp-${target_color}:3000" timeout 120
  catch command_failed
    prompt: Smoke test against ${target_color} deployment failed. Investigate and fix. The ${active_color} deployment is still serving traffic.
    run: kubectl rollout status deployment/myapp-${target_color} timeout 60
  end

  # Phase 4: Switch traffic
  run: kubectl patch svc myapp -p '{"spec":{"selector":{"color":"${target_color}"}}}'
  run: kubectl run post-switch-test --image=curlimages/curl --rm -i --restart=Never -- curl -sf http://myapp:3000/health timeout 30

done when:
  gate new_active: test "$(kubectl get svc myapp -o jsonpath='{.spec.selector.color}')" = "${target_color}"
  gate healthy: kubectl run health-check --image=curlimages/curl --rm -i --restart=Never -- curl -sf http://myapp:3000/health
```

**Why this works:** The `if/else` on `active_color` automatically determines which environment to deploy to. The `try/catch` in Phase 3 validates the new deployment before switching traffic, with the safety that the active deployment is untouched if tests fail. The gate verifies both that traffic switched and the new deployment is healthy.

---

### 6.7 Canary Release with Metrics Validation

Demonstrates a canary release that checks error rates at each stage before proceeding.

```prompt-language
Goal: Canary-release the new recommendation engine

flow:
  # Phase 1: Deploy canary
  let stable_version = run "kubectl get deployment reco-stable -o jsonpath='{.spec.template.spec.containers[0].image}'"
  let canary_tag = run "git rev-parse --short HEAD"
  run: kubectl set image deployment/reco-canary app=registry.example.com/reco:${canary_tag}
  run: kubectl rollout status deployment/reco-canary timeout 120

  # Phase 2: Progressive traffic shift
  foreach weight in "5 15 30 50 100"
    run: kubectl patch virtualservice reco-vs -p '{"spec":{"http":[{"route":[{"destination":{"host":"reco-stable"},"weight":$((100 - ${weight}))},{"destination":{"host":"reco-canary"},"weight":${weight}}]}]}}'
    # Wait for metrics to accumulate
    prompt: Wait 2 minutes for metrics, then check error rates. Run: kubectl exec -it $(kubectl get pod -l app=prometheus -o name) -- curl -s 'http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[2m])' to verify the error rate is below 1%.
    run: sleep 120
    let error_rate = run "kubectl exec $(kubectl get pod -l app=prometheus -o jsonpath='{.items[0].metadata.name}') -- curl -s 'http://localhost:9090/api/v1/query?query=rate(http_requests_total{service=\"reco-canary\",status=~\"5..\"}[2m])/rate(http_requests_total{service=\"reco-canary\"}[2m])' | node -e \"process.stdin.on('data',d=>{const r=JSON.parse(d);console.log(r.data.result[0]?.value[1]||'0')})\""
    prompt: Canary at ${weight}% traffic. Error rate: ${error_rate}. If error rate exceeds 0.01 (1%), roll back the canary. Otherwise confirm it is safe to proceed.
  end

done when:
  gate canary_healthy: kubectl exec $(kubectl get pod -l app=prometheus -o jsonpath='{.items[0].metadata.name}') -- curl -s 'http://localhost:9090/api/v1/query?query=rate(http_requests_total{service="reco-canary",status=~"5.."}[5m])/rate(http_requests_total{service="reco-canary"}[5m])' | node -e "process.stdin.on('data',d=>{const r=JSON.parse(d);process.exit(parseFloat(r.data.result[0]?.value[1]||'0')>0.01?1:0)})"
```

**Why this works:** The `foreach` steps through traffic percentages. At each stage, `let error_rate` captures the actual error metric from Prometheus. The agent sees the quantitative error rate and can decide whether to proceed. The gate independently verifies the canary error rate is acceptable at full traffic.

---

### 6.8 Infrastructure-as-Code Change Workflow

Demonstrates a Terraform/IaC workflow with plan review, apply, and validation.

```prompt-language
Goal: Apply infrastructure changes with review and validation

flow:
  # Phase 1: Plan
  run: terraform init
  run: terraform plan -out=tfplan -no-color 2>&1 | tee /tmp/tfplan.txt
  let plan_summary = run "terraform show -no-color tfplan | grep -E '^(Plan:|  #)' | head -20"
  prompt: Review this Terraform plan: ${plan_summary}. Check for: accidental resource destruction, security group changes that open ports to 0.0.0.0/0, IAM policy changes, and cost implications. If any issues found, modify the .tf files and re-plan.

  # Phase 2: Validate plan is safe
  run: terraform validate
  let destroys = run "terraform show -json tfplan | node -e \"process.stdin.on('data',d=>{const p=JSON.parse(d);console.log((p.resource_changes||[]).filter(c=>c.change.actions.includes('delete')).length)})\""
  if ${destroys} != "0"
    prompt: Plan includes ${destroys} resource destructions. Review each one. If any are unintentional, fix the configuration. Intentional deletions should be documented in a comment.
    run: terraform plan -out=tfplan -no-color
  end

  # Phase 3: Apply
  try
    run: terraform apply tfplan -no-color timeout 300
  catch command_failed
    let apply_err = run "terraform output -json 2>&1 | tail -20"
    prompt: Terraform apply failed: ${apply_err}. Diagnose the issue. Common causes: resource already exists, permission denied, quota exceeded, dependency ordering.
  end

  # Phase 4: Post-apply validation
  let outputs = run "terraform output -json"
  prompt: Apply complete. Outputs: ${outputs}. Verify all resources are healthy and accessible.

done when:
  gate tf_clean: terraform plan -detailed-exitcode -no-color 2>&1; test $? -eq 0
```

**Why this works:** Phase 1 plans and captures a summary for review. Phase 2 checks for destructive changes and forces human-readable review. Phase 3 applies with `try/catch` to handle failures gracefully. Phase 4 captures outputs for verification. The gate uses `terraform plan -detailed-exitcode` which returns 0 only when no changes are needed (meaning the apply fully converged).

---

### 6.9 Security Audit and Remediation

Demonstrates a multi-tool security audit with finding collection and progressive remediation.

```prompt-language
Goal: Complete security audit and fix all high-severity findings

flow:
  let findings = []

  # Phase 1: Dependency audit
  run: npm audit --json > /tmp/npm-audit.json 2>&1
  let dep_vulns = run "node -e \"const a=require('/tmp/npm-audit.json');const h=Object.values(a.vulnerabilities||{}).filter(v=>v.severity==='high'||v.severity==='critical');console.log(h.length+' high/critical: '+h.map(v=>v.name).join(', '))\""
  if ${dep_vulns} != "0 high/critical: "
    let findings += "Dependencies: ${dep_vulns}"
    prompt: Fix these dependency vulnerabilities: ${dep_vulns}. Prefer upgrading. Only use overrides as a last resort.
    run: npm audit --audit-level=high
  end

  # Phase 2: Static analysis
  let sast_results = run "npx eslint-plugin-security . 2>&1 | grep 'error' | head -10 || echo 'clean'"
  if ${sast_results} != "clean"
    let findings += "SAST: ${sast_results}"
    prompt: Fix these security lint findings: ${sast_results}
  end

  # Phase 3: Secret scanning
  let secrets = run "npx secretlint '**/*' 2>&1 | grep -c 'ERROR' || echo '0'"
  if ${secrets} != "0"
    let findings += "Secrets: ${secrets} exposed"
    prompt: Found ${secrets} exposed secrets. Remove them from source code, add to .env, and ensure .env is in .gitignore.
  end

  # Phase 4: Report
  prompt: Security audit complete. All findings: ${findings}. Total issues found: ${findings_length}. Write SECURITY-REPORT.md with findings, remediations applied, and remaining risks.

done when:
  file_exists SECURITY-REPORT.md
  gate no_high_vulns: npm audit --audit-level=high
```

**Why this works:** Each phase uses a different security tool. The `let findings = []` list accumulates issues across all phases. Each finding gets its own `if` block so clean phases are skipped. The final prompt receives the complete findings list with count via `${findings_length}`. The gate ensures the most critical category (dependency vulnerabilities) is actually resolved.

---

### 6.10 Data Pipeline: ETL with Validation

Demonstrates an extract-transform-load workflow with data quality checks at each stage.

```prompt-language
Goal: Build and validate the daily ETL pipeline for analytics

flow:
  # Phase 1: Extract
  let extract_count = run "node scripts/extract.js --source=production --date=today 2>&1 | tail -1"
  if command_failed
    prompt: Extraction failed. Check database connectivity and credentials. Error: ${extract_count}
    retry max 2
      run: node scripts/extract.js --source=production --date=today timeout 300
    end
  end

  # Phase 2: Validate raw data
  let raw_rows = run "wc -l < data/raw/today.csv"
  let null_count = run "awk -F',' '{for(i=1;i<=NF;i++) if($i==\"\" || $i==\"null\") c++} END {print c+0}' data/raw/today.csv"
  if ${null_count} != "0"
    prompt: Raw data has ${null_count} null values across ${raw_rows} rows. Write a data cleaning script to handle nulls: use defaults for non-critical fields, flag records with null critical fields for manual review.
    run: node scripts/clean-nulls.js data/raw/today.csv
  end

  # Phase 3: Transform
  try
    run: node scripts/transform.js --input=data/raw/today.csv --output=data/processed/today.parquet timeout 180
    let transformed_rows = run "node -e \"const p=require('parquetjs');(async()=>{const r=await p.ParquetReader.openFile('data/processed/today.parquet');console.log(r.getRowCount())})()\""
    prompt: Transformed ${transformed_rows} rows (from ${raw_rows} raw). Verify the counts are reasonable -- transformed should be >= 95% of raw.
  catch command_failed
    prompt: Transform failed. Check the transform script for schema mismatches with today's raw data format.
    run: node scripts/transform.js --input=data/raw/today.csv --output=data/processed/today.parquet --verbose timeout 180
  end

  # Phase 4: Load
  run: node scripts/load.js --input=data/processed/today.parquet --target=analytics_db timeout 120

done when:
  gate data_loaded: node scripts/verify-load.js --date=today
  gate row_count_ok: test $(node scripts/verify-load.js --date=today --count-only) -gt 0
```

**Why this works:** Four phases mirror the ETL pattern. Variables carry data quality metrics forward -- the transform phase knows the raw row count to sanity-check the output. The `try/catch` in the transform phase provides a graceful fallback with verbose logging. Gates independently verify the load completed and produced non-zero rows.

---

### 6.11 Compliance Validation Pipeline

Demonstrates a multi-standard compliance check with progressive remediation.

```prompt-language
Goal: Ensure the application meets SOC2 compliance requirements

flow:
  let compliance_report = []

  # Phase 1: Authentication checks
  let auth_check = run "node scripts/compliance/check-auth.js"
  if command_failed
    prompt: Authentication compliance failures: ${auth_check}. Fix: enforce MFA, session timeouts under 30 min, password complexity rules, account lockout after 5 attempts.
    let compliance_report += "Auth: remediated"
  else
    let compliance_report += "Auth: passed"
  end

  # Phase 2: Encryption checks
  let crypto_check = run "node scripts/compliance/check-encryption.js"
  if command_failed
    prompt: Encryption compliance failures: ${crypto_check}. Fix: TLS 1.2+ only, AES-256 at rest, no plaintext secrets in config, certificate rotation under 90 days.
    let compliance_report += "Encryption: remediated"
  else
    let compliance_report += "Encryption: passed"
  end

  # Phase 3: Logging and audit trail
  let log_check = run "node scripts/compliance/check-logging.js"
  if command_failed
    prompt: Logging compliance failures: ${log_check}. Fix: add audit logging for all data access, ensure logs are immutable, add PII redaction to log output.
    let compliance_report += "Logging: remediated"
  else
    let compliance_report += "Logging: passed"
  end

  # Phase 4: Access control
  let acl_check = run "node scripts/compliance/check-access-control.js"
  if command_failed
    prompt: Access control failures: ${acl_check}. Fix: implement least-privilege, add RBAC where missing, ensure no default admin credentials.
    let compliance_report += "Access Control: remediated"
  else
    let compliance_report += "Access Control: passed"
  end

  # Phase 5: Summary
  prompt: Compliance review complete. Results: ${compliance_report}. Categories checked: ${compliance_report_length}. Write a compliance summary to docs/compliance-status.md.

done when:
  gate auth_compliant: node scripts/compliance/check-auth.js
  gate crypto_compliant: node scripts/compliance/check-encryption.js
  gate logging_compliant: node scripts/compliance/check-logging.js
  gate acl_compliant: node scripts/compliance/check-access-control.js
```

**Why this works:** Each compliance domain is a separate phase with its own check script. The list variable accumulates pass/remediate status across all domains. The agent sees what was already checked and remediated. Four independent gates ensure every domain passes -- the agent cannot skip one and claim compliance. Custom `gate` predicates map each domain to its verification command.

---

### 6.12 Mobile App Release Pipeline

Demonstrates a multi-platform mobile release with per-platform builds and submission.

```prompt-language
Goal: Prepare and validate the mobile app release for both platforms

flow:
  # Phase 1: Version alignment
  let ios_version = run "plutil -p ios/Info.plist | grep CFBundleShortVersionString | awk '{print $3}' | tr -d '\"'"
  let android_version = run "grep 'versionName' android/app/build.gradle | head -1 | sed 's/.*\"//;s/\".*//' "
  if ${ios_version} != ${android_version}
    prompt: Version mismatch -- iOS is ${ios_version}, Android is ${android_version}. Align both to the same version.
  end

  # Phase 2: Test both platforms
  foreach platform in "ios android"
    run: npx react-native test --platform ${platform}
    if command_failed
      prompt: Tests fail on ${platform}. Fix platform-specific issues.
      retry max 2
        run: npx react-native test --platform ${platform}
      end
    end
  end

  # Phase 3: Build artifacts
  try
    run: cd ios && xcodebuild -workspace App.xcworkspace -scheme Release -configuration Release archive timeout 600
  catch command_failed
    prompt: iOS build failed. Check provisioning profiles, code signing, and build settings.
  end

  try
    run: cd android && ./gradlew assembleRelease timeout 600
  catch command_failed
    prompt: Android build failed. Check Gradle configuration, SDK versions, and signing config.
  end

  # Phase 4: Validation
  let ios_size = run "du -sh ios/build/Release-iphoneos/App.app | cut -f1"
  let android_size = run "du -sh android/app/build/outputs/apk/release/app-release.apk | cut -f1"
  prompt: Build complete. iOS: ${ios_size}, Android: ${android_size}. Verify sizes are reasonable (iOS < 100MB, Android < 80MB). Check for any included debug symbols or test assets that should be stripped.

done when:
  gate ios_built: test -d ios/build/Release-iphoneos/App.app
  gate android_built: test -f android/app/build/outputs/apk/release/app-release.apk
  tests_pass
```

**Why this works:** The flow handles two platforms in a structured way. Phase 1 catches version drift early. Phase 2 uses `foreach` to test both platforms. Phase 3 uses separate `try/catch` blocks because build failures on one platform should not block the other from building. Phase 4 captures artifact sizes for sanity checking. Gates verify both artifacts exist.

---

### Debate: Multi-Phase Workflows

**Multi-phase workflows are where prompt-language delivers its clearest value over vanilla prompting.** A 20-step deployment workflow described in prose is ambiguous -- which steps can be skipped on failure? Which must be retried? What constitutes rollback? The DSL makes these decisions explicit with `try/catch`, `retry`, and `if/else`. The agent does not guess at error handling; the flow prescribes it.

**The most dangerous mistake is coupling phases too tightly.** When Phase 3 depends on a variable from Phase 1 but Phase 2 can fail in a way that corrupts that variable, the pipeline breaks silently. The defensive pattern is to capture critical values in `let` variables immediately when they are produced, then reference the variable (not re-run the command) in later phases. Variables are frozen at capture time, immune to state changes in intervening phases.

**Resist the temptation to express everything as a single flow.** If your deployment has 30+ nodes across 6 phases, consider whether it should be multiple flows invoked sequentially rather than one monolithic flow. Each phase doubling the node count quadruples the cognitive load on the agent. In practice, flows beyond 15-20 nodes become harder for the agent to reason about, not because of token limits but because the rendered flow state is so large that the current step gets lost in the noise.

**Gates compound multiplicatively in multi-phase flows, and that is the point.** A flow with `tests_pass`, `lint_pass`, and `gate deploy_healthy: ...` creates a three-way conjunction. The agent must satisfy all three independently. This is where real engineering value emerges: the agent cannot optimize for one gate at the expense of another. It is surprising how often an agent "fixes" tests by deleting them -- the lint gate catches the missing coverage, the deploy gate catches the runtime failure. Multiple gates create a web of constraints that converges on genuine correctness rather than superficial compliance. The tradeoff is runtime cost: each gate runs its command independently, so three gates mean three command executions at every completion check. For fast commands this is negligible; for slow test suites, consider using `gate` predicates that run targeted subsets rather than the full suite.

---

## 7. Data Processing

Data processing workflows benefit enormously from `foreach` loops paired with variable capture. These patterns let you iterate over dynamic lists, collect results, and feed them into downstream steps -- turning Claude into a batch processing engine with built-in error awareness.

### 7.1 Lint Each Changed File Individually

Runs the linter on each file that `git diff` reports as changed, rather than linting the entire codebase. Useful for large monorepos where full lint takes minutes.

```prompt-language
Goal: lint only changed files

flow:
  let changed = run "git diff --name-only --diff-filter=d HEAD~1 -- '*.ts' '*.tsx'"
  foreach file in ${changed} max 50
    run: npx eslint ${file} --max-warnings=0
    if command_failed
      prompt: Fix the lint errors in ${file}. Do not modify other files.
    end
  end

done when:
  lint_pass
```

**Why this works:** The `let` captures the exact file list from git. The `foreach` splits on newlines (git diff outputs one file per line). Each iteration scopes the agent's attention to a single file, preventing it from making unrelated changes elsewhere.

### 7.2 Process API Endpoints from a Config File

Iterates over API endpoints defined in a JSON config and generates integration tests for each one.

```prompt-language
Goal: generate integration tests for all API endpoints

flow:
  let endpoints = run "node -e \"const c=require('./api-config.json'); console.log(JSON.stringify(c.endpoints.map(e=>e.path)))\""
  foreach endpoint in ${endpoints} max 30
    prompt: Write an integration test for the ${endpoint} endpoint. Cover success, 400, and 401 cases. Save it to tests/integration${endpoint}.test.ts.
    run: npx jest tests/integration${endpoint}.test.ts --passWithNoTests
    if command_failed
      prompt: The integration test for ${endpoint} is failing. Fix it.
    end
  end

done when:
  tests_pass
```

**Why this works:** The JSON array output from Node is parsed natively by `splitIterable()` -- JSON arrays are the highest-priority parse format. Each endpoint gets its own test file and immediate validation.

### 7.3 Batch Resize Images in a Directory

Processes every PNG in an assets directory, creating optimized thumbnails. Demonstrates using shell commands inside foreach for non-code workflows.

```prompt-language
Goal: create thumbnails for all PNG assets

flow:
  run: mkdir -p assets/thumbnails
  let images = run "ls assets/*.png"
  foreach img in ${images} max 100
    run: convert ${img} -resize 200x200 assets/thumbnails/$(basename ${img})
    if command_failed
      prompt: The convert command failed for ${img}. Check if ImageMagick is installed and fix the issue.
      break
    end
  end

done when:
  gate thumbnails_exist: test -d assets/thumbnails && test $(ls assets/thumbnails/*.png 2>/dev/null | wc -l) -gt 0
```

### 7.4 Collect Test Coverage per Module

Runs coverage for each module and appends the result to a list variable, then generates a summary report from all collected results.

```prompt-language
Goal: per-module coverage report

flow:
  let modules = run "ls -d src/*/  | xargs -I{} basename {}"
  let results = []
  foreach mod in ${modules} max 20
    let cov = run "npx jest --coverage --collectCoverageFrom='src/${mod}/**/*.ts' --silent 2>&1 | tail -3"
    let results += run "echo \"${mod}: $(echo ${cov} | grep -oP '\\d+\\.\\d+%' | head -1)\""
  end
  prompt: Create a coverage-report.md with a table from these results: ${results}. Highlight any module below 80%.

done when:
  file_exists coverage-report.md
```

**Why this works:** List variables (`let results = []` and `let results += run "..."`) accumulate data across iterations. The final prompt receives the entire collected list via `${results}` interpolation.

### 7.5 Analyze Git Log for Large Commits

Scans recent git history for commits that changed more than a threshold number of files, then asks the agent to suggest how each could have been split.

```prompt-language
Goal: identify and analyze oversized commits

flow:
  let big_commits = run "git log --oneline --shortstat -50 | awk '/files? changed/{if($1>10) print prev} {prev=$0}'"
  foreach commit in ${big_commits} max 20
    let details = run "git show --stat ${commit}"
    prompt: This commit touched many files. Analyze the diff summary below and suggest how it could be split into smaller, focused commits: ${details}
  end
  prompt: Write a summary document at docs/commit-hygiene.md with all the refactoring suggestions above.

done when:
  file_exists docs/commit-hygiene.md
```

### 7.6 CSV Data Transformation Pipeline

Reads a CSV, processes each row through validation, and collects errors into a report. Demonstrates data pipeline patterns.

```prompt-language
Goal: validate and clean customer CSV data

flow:
  let row_count = run "wc -l < data/customers.csv"
  prompt: Read data/customers.csv. For each row, check: email format is valid, phone has 10+ digits, country code is ISO 3166. Write cleaned data to data/customers-clean.csv and a list of row numbers with errors to data/validation-errors.txt.
  run: wc -l < data/customers-clean.csv
  let errors = run "cat data/validation-errors.txt 2>/dev/null || echo 'none'"
  if ${errors} != "none"
    prompt: Review the validation errors in data/validation-errors.txt. For each invalid row, suggest a correction or flag it for manual review. Write the final report to data/validation-report.md.
  end

done when:
  file_exists data/customers-clean.csv
  file_exists data/validation-report.md
```

### 7.7 Log Analysis with Pattern Extraction

Scans application logs for error patterns, groups them, and generates a troubleshooting runbook.

```prompt-language
Goal: build troubleshooting runbook from production logs

flow:
  let error_types = run "grep -oP 'ERROR \\[\\K[^\\]]+' logs/app.log | sort -u"
  let runbook_items = []
  foreach err_type in ${error_types} max 30
    let samples = run "grep 'ERROR \\[${err_type}\\]' logs/app.log | head -5"
    let count = run "grep -c 'ERROR \\[${err_type}\\]' logs/app.log"
    let runbook_items += "${err_type}"
    prompt: For error type "${err_type}" (${count} occurrences), analyze these samples: ${samples}. Add a section to docs/runbook.md with: root cause hypothesis, immediate mitigation, and permanent fix.
  end

done when:
  file_exists docs/runbook.md
```

### 7.8 Batch Database Migration Verification

Iterates over migration files and verifies each one applies and rolls back cleanly.

```prompt-language
Goal: verify all pending database migrations

flow:
  let migrations = run "ls db/migrations/*.sql | sort"
  foreach migration in ${migrations} max 30
    run: psql -d testdb -f ${migration}
    if command_failed
      prompt: Migration ${migration} failed to apply. Examine the error and fix the SQL.
      run: psql -d testdb -f ${migration}
    end
    # Verify rollback
    let rollback_file = run "echo ${migration} | sed 's/\\.sql/.rollback.sql/'"
    run: psql -d testdb -f ${rollback_file}
    if command_failed
      prompt: Rollback for ${migration} failed. Create or fix the rollback file at ${rollback_file}.
    end
  end

done when:
  gate migrations_clean: psql -d testdb -c "SELECT 1" && echo "DB accessible"
```

### 7.9 Filter and Process with Conditional Logic

Demonstrates using `if` inside `foreach` to skip items that do not meet criteria -- a filter-map pattern.

```prompt-language
Goal: upgrade only outdated dependencies

flow:
  let deps = run "npm outdated --json 2>/dev/null | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify(Object.keys(d)))\""
  foreach dep in ${deps} max 30
    let info = run "npm outdated ${dep} --json 2>/dev/null"
    # Skip devDependencies -- only upgrade production deps
    run: node -e "const d=JSON.parse(process.argv[1]); process.exit(d['${dep}']?.type==='devDependencies' ? 1 : 0)" "${info}"
    if command_succeeded
      prompt: Upgrade ${dep} to its latest version. Update any breaking API changes in src/. Run the relevant tests afterward.
      run: npm test
      if command_failed
        prompt: The upgrade of ${dep} broke tests. Fix the compatibility issues.
      end
    end
  end

done when:
  tests_pass
```

### 7.10 Multi-Directory Batch Operations

Processes multiple service directories in a monorepo, running type checks on each independently.

```prompt-language
Goal: typecheck all services in the monorepo

flow:
  let services = run "ls -d services/*/package.json | xargs -I{} dirname {}"
  let failures = []
  foreach svc in ${services} max 20
    run: cd ${svc} && npx tsc --noEmit
    if command_failed
      let failures += "${svc}"
      prompt: Fix the TypeScript errors in ${svc}. Only modify files within that directory.
      run: cd ${svc} && npx tsc --noEmit
    end
  end
  prompt: Write a summary of typecheck results. Services that needed fixes: ${failures}. Total services: ${services_length}.

done when:
  gate all_typecheck: for d in services/*/; do (cd "$d" && npx tsc --noEmit) || exit 1; done
```

**Why this works:** The `${failures}` list collects only the services that had problems. The `${services_length}` auto-variable (set by foreach) gives the total count. The custom gate independently verifies every service passes.

### 7.11 Process Items with Index Tracking

Uses the auto-generated `${item_index}` variable to number output files and track progress.

```prompt-language
Goal: generate chapter summaries for documentation

flow:
  let chapters = run "ls docs/chapters/*.md | sort"
  foreach chapter in ${chapters} max 20
    let content = run "head -50 ${chapter}"
    prompt: Read ${chapter} and write a 2-3 sentence summary. Save it to docs/summaries/chapter-${chapter_index}.md. This is chapter ${chapter_index} of ${chapter_length}.
  end
  prompt: Combine all files in docs/summaries/ into a single docs/table-of-contents.md with numbered entries.

done when:
  file_exists docs/table-of-contents.md
```

### Debate: Data Processing Patterns

The `foreach` primitive turns Claude into a batch processor, but that power comes with sharp edges. The most common mistake is trying to process too many items. Each iteration is a full agent turn -- Claude reads context, reasons, and acts. A `foreach` over 100 files is not like a shell loop over 100 files; it is 100 separate AI interactions, each consuming tokens and time. Set `max` conservatively and pre-filter your lists with shell commands before feeding them to `foreach`.

Another frequent pitfall is assuming iteration order matters for correctness. The DSL guarantees sequential execution, but Claude's actions within each iteration are non-deterministic. If iteration 3 depends on a side effect from iteration 2 (like a file it wrote), capture the dependency explicitly with a `let` variable rather than relying on filesystem state.

The list variable pattern (`let results = []` with `let results += ...`) is powerful for aggregation but has a subtle limit: values are stored as JSON array strings in session state. Very large accumulated values (thousands of characters per item across dozens of iterations) can bloat the state file and the rendered flow that gets injected into Claude's context each turn. For large-scale data processing, prefer writing intermediate results to files and reading them back, rather than accumulating everything in memory.

The sweet spot for `foreach` is 5-20 items where each item genuinely needs AI judgment -- refactoring modules, analyzing error categories, generating tests per endpoint. For purely mechanical transformations (rename files, run a command), a single `run:` with a shell loop is faster and cheaper. Use `foreach` when you need the agent to think, not just execute.

---

## 8. Conditional Branching

Conditional branching with `if`/`else` lets flows adapt to runtime state. Combined with variable comparisons, boolean built-ins, and `and`/`or` operators, you can route the agent through different strategies based on what it discovers. These patterns are essential for writing flows that work across environments and handle the unexpected.

### 8.1 Platform Detection

Detects the operating system and runs platform-appropriate commands. Demonstrates `if`/`else` with variable comparison.

```prompt-language
Goal: install project dependencies on any platform

flow:
  let platform = run "uname -s"
  if ${platform} == "Darwin"
    run: brew install libpq imagemagick
    prompt: Configure the macOS-specific settings in config/platform.json.
  else
    run: sudo apt-get update && sudo apt-get install -y libpq-dev imagemagick
    prompt: Configure the Linux-specific settings in config/platform.json.
  end
  run: npm install
  run: npm test

done when:
  tests_pass
```

### 8.2 Feature Detection with Tool Availability

Checks whether a tool is installed before using it, falling back to an alternative.

```prompt-language
Goal: format all source files

flow:
  run: which prettier
  if command_succeeded
    run: npx prettier --write "src/**/*.{ts,tsx}"
  else
    run: which biome
    if command_succeeded
      run: npx biome format --write src/
    else
      prompt: Neither Prettier nor Biome is available. Install Prettier as a dev dependency and configure it with sensible defaults for a TypeScript project. Then format all files in src/.
    end
  end
  run: npm test

done when:
  tests_pass
```

**Why this works:** The nested `if` creates a priority chain: try Prettier first, fall back to Biome, and if neither exists, install one. Each `run: which ...` sets `command_succeeded`/`command_failed` for the immediately following `if`.

### 8.3 Environment-Based Branching

Routes deployment through different pipelines based on the target environment.

```prompt-language
Goal: deploy to the target environment

flow:
  let env = run "echo ${DEPLOY_ENV:-staging}"
  if ${env} == "production"
    prompt: This is a production deploy. Review all changes in the diff carefully. Ensure no debug code, console.log statements, or TODO comments remain.
    run: npm run build -- --mode production
    run: npm run test:e2e
    if command_failed
      prompt: E2E tests failed. This blocks production deploy. Fix the failures.
      run: npm run test:e2e
    end
  else
    run: npm run build -- --mode ${env}
    run: npm test
  end

done when:
  gate deploy_ready: npm run build -- --mode ${DEPLOY_ENV:-staging} --dry-run
```

### 8.4 Error-Type Routing

Inspects the nature of a failure and routes to different fix strategies depending on the error category.

```prompt-language
Goal: diagnose and fix build failure

flow:
  run: npm run build 2>&1
  if command_failed
    let error_output = "${last_stderr}"
    run: echo "${last_stderr}" | grep -qi "type"
    if command_succeeded
      prompt: The build has TypeScript type errors. Focus on fixing type annotations, missing imports, and interface mismatches. Do not refactor logic.
    else
      run: echo "${error_output}" | grep -qi "module not found\|cannot find"
      if command_succeeded
        prompt: The build has missing module errors. Check package.json dependencies, install missing packages, and fix import paths.
        run: npm install
      else
        prompt: The build failed with an unexpected error. Read the full error output and diagnose the root cause. Error: ${error_output}
      end
    end
    run: npm run build
  end

done when:
  gate build_passes: npm run build
```

**Why this works:** Each `run: echo ... | grep` tests for a specific error pattern and sets `command_succeeded` for the next `if`. This creates a decision tree: type errors get type-focused fixes, missing modules get dependency fixes, and everything else gets general diagnosis.

### 8.5 Boolean Variables as Conditions

Uses boolean variables set by earlier steps to control later branching. Demonstrates the variable-first resolution for flow conditions.

```prompt-language
Goal: conditional feature implementation

flow:
  run: test -f tsconfig.json
  let has_typescript = "${command_succeeded}"
  run: test -f .eslintrc.json || test -f .eslintrc.js || test -f eslint.config.mjs
  let has_eslint = "${command_succeeded}"
  run: test -f jest.config.ts || test -f jest.config.js || test -f vitest.config.ts
  let has_tests = "${command_succeeded}"

  prompt: Add input validation to all API route handlers in src/routes/.

  if ${has_typescript} == "true"
    prompt: Add Zod schemas for request validation. Use TypeScript generics to infer types from schemas.
  else
    prompt: Add joi schemas for request validation with JSDoc type annotations.
  end

  if ${has_tests} == "true"
    prompt: Write tests for the new validation logic. Cover valid input, missing fields, and wrong types.
    run: npm test
  end

  if ${has_eslint} == "true"
    run: npx eslint src/routes/ --fix
  end

done when:
  tests_pass
```

### 8.6 Short-Circuit with `and`/`or` Operators

Combines conditions with logical operators to make nuanced branching decisions.

```prompt-language
Goal: safe database schema migration

flow:
  run: pg_isready -h localhost
  let db_up = "${command_succeeded}"
  let pending = run "npx knex migrate:status | grep -c 'Pending'"

  if ${db_up} == "true" and ${pending} != "0"
    run: npx knex migrate:latest
    if command_failed
      prompt: Migration failed. Check the error, fix the migration file, and ensure it is idempotent.
      run: npx knex migrate:latest
    end
  else
    if ${db_up} != "true"
      prompt: The database is not reachable. Check connection settings in knexfile.js and ensure PostgreSQL is running.
    else
      prompt: No pending migrations. Verify the schema matches expectations by inspecting the latest migration file.
    end
  end

done when:
  gate db_migrated: npx knex migrate:status | grep -v Pending | grep -q "Ran"
```

### 8.7 Negated Conditions with `not`

Uses `not` to express negative conditions cleanly.

```prompt-language
Goal: ensure security headers are configured

flow:
  run: grep -r "helmet" src/ package.json
  if not command_succeeded
    prompt: The project does not use Helmet for security headers. Install helmet and add it as middleware in the Express app. Configure CSP, HSTS, and X-Frame-Options.
    run: npm install helmet
  end
  run: grep -r "cors" src/ package.json
  if not command_succeeded
    prompt: CORS is not configured. Install and configure the cors middleware with an allowlist for known origins.
    run: npm install cors
  end
  run: npm test

done when:
  tests_pass
  gate security_headers: node -e "const pkg=require('./package.json'); if(!pkg.dependencies?.helmet) process.exit(1)"
```

### 8.8 Comparison Operators for Threshold Checks

Uses numeric comparisons to make decisions based on measured values.

```prompt-language
Goal: improve test coverage to meet threshold

flow:
  let coverage = run "npx jest --coverage --silent 2>&1 | grep 'All files' | grep -oP '\\d+\\.?\\d*' | head -1"
  if ${coverage} < "80"
    prompt: Test coverage is at ${coverage}%, which is below the 80% threshold. Identify the modules with lowest coverage and write tests for the most critical uncovered paths.
    run: npx jest --coverage
    let new_coverage = run "npx jest --coverage --silent 2>&1 | grep 'All files' | grep -oP '\\d+\\.?\\d*' | head -1"
    if ${new_coverage} < "80"
      prompt: Coverage is now ${new_coverage}%, still below 80%. Focus on the remaining uncovered branches and edge cases.
    end
  else
    prompt: Coverage is at ${coverage}%, meeting the threshold. Review the existing tests for quality and remove any that are redundant or test implementation details.
  end

done when:
  gate coverage_met: npx jest --coverage --silent 2>&1 | grep 'All files' | grep -oP '\d+\.?\d*' | head -1 | awk '{exit ($1 < 80)}'
```

### 8.9 Multi-Factor Decision with Nested Conditions

Combines multiple signals to choose from several strategies. Demonstrates deep nesting for complex logic.

```prompt-language
Goal: choose optimal CI configuration

flow:
  let lang = run "if test -f tsconfig.json; then echo typescript; elif test -f setup.py; then echo python; elif test -f go.mod; then echo go; else echo unknown; fi"
  let has_docker = run "test -f Dockerfile && echo true || echo false"
  let has_ci = run "test -d .github/workflows && echo true || echo false"

  if ${has_ci} == "false"
    if ${lang} == "typescript"
      if ${has_docker} == "true"
        prompt: Create .github/workflows/ci.yml for a TypeScript project with Docker. Include: build image, run tests in container, push to registry on main.
      else
        prompt: Create .github/workflows/ci.yml for a TypeScript project. Include: install deps, typecheck, lint, test with coverage, build.
      end
    end
    if ${lang} == "python"
      prompt: Create .github/workflows/ci.yml for a Python project. Include: install deps, mypy, ruff, pytest with coverage.
    end
    if ${lang} == "go"
      prompt: Create .github/workflows/ci.yml for a Go project. Include: go vet, staticcheck, go test -race -coverprofile.
    end
  else
    prompt: CI already exists. Review .github/workflows/ for best practices: caching, matrix testing, security scanning.
  end

done when:
  file_exists .github/workflows/ci.yml
```

### 8.10 Condition-Driven Cleanup

Uses conditions after a main workflow to handle different cleanup scenarios.

```prompt-language
Goal: safe dependency upgrade with rollback plan

flow:
  # Save state before upgrade
  run: cp package-lock.json package-lock.json.bak
  let before_audit = run "npm audit --json 2>/dev/null | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.metadata?.vulnerabilities?.total||0)\""

  prompt: Upgrade all dependencies to their latest compatible versions. Use npm update, not manual edits.
  run: npm update
  run: npm test

  if command_failed
    prompt: Tests fail after npm update. Identify which upgraded package broke the tests by checking the diff in package-lock.json. Downgrade only the offending package.
    run: npm test
    if command_failed
      # Full rollback
      run: cp package-lock.json.bak package-lock.json && npm install
      prompt: Full rollback performed. The upgrade is too risky without more investigation. Document which packages caused failures in UPGRADE-NOTES.md.
    end
  else
    let after_audit = run "npm audit --json 2>/dev/null | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.metadata?.vulnerabilities?.total||0)\""
    prompt: Upgrade succeeded. Vulnerabilities before: ${before_audit}, after: ${after_audit}. Document the changes in CHANGELOG.md.
  end

done when:
  tests_pass
```

### 8.11 Default Values for Resilient Branching

Uses `${var:-default}` to handle missing configuration gracefully.

```prompt-language
Goal: configure logging based on environment

flow:
  let log_level = run "echo ${LOG_LEVEL:-info}"
  let log_format = run "echo ${LOG_FORMAT:-json}"

  if ${log_level} == "debug"
    prompt: Configure verbose debug logging in src/logger.ts. Include request bodies, SQL queries, and cache hit/miss details. Use ${log_format} format.
  else
    if ${log_level} == "error"
      prompt: Configure error-only logging in src/logger.ts. Suppress info and warn. Include stack traces and request context on errors. Use ${log_format} format.
    else
      prompt: Configure standard info-level logging in src/logger.ts. Log request method, path, status, and duration. Use ${log_format} format.
    end
  end
  run: npm test

done when:
  tests_pass
```

### Debate: Conditional Branching Patterns

Conditional branching is where prompt-language flows start to feel like real programs -- and that is both their strength and their danger. The key insight from real usage is that `if`/`else` in a DSL flow is fundamentally different from `if`/`else` in code. In code, conditions evaluate in microseconds and branches execute deterministically. In a flow, each branch is an AI interaction that may take 30 seconds and produce unpredictable results. This changes the calculus of when nesting is worthwhile.

The most common mistake is over-nesting. Three levels of `if` inside each other creates a combinatorial explosion of paths that is hard to reason about and hard to debug when something goes wrong. If you find yourself nesting more than two levels deep, consider whether you can flatten the logic with early `break` or by splitting into separate flows.

Variable comparison conditions (`${var} == "value"`) are reliable because they resolve from session state deterministically. But conditions that rely on command-based predicates (like `tests_fail`) can be surprising: in a flow condition, they check the variable first, so `if tests_fail` after a `run: npm test` uses the variable set by that run, not a fresh test execution. This is fast and correct for flow control, but understand the resolution order to avoid confusion.

The `and`/`or` operators enable expressive conditions but do not support parentheses for grouping. `a and b or c` evaluates left-to-right, which may not match mathematical intuition. When in doubt, split compound conditions into separate nested `if` blocks for clarity. Readable flows are maintainable flows, and no one will thank you for a clever one-liner condition that takes five minutes to parse.

---

## 9. Composition and Nesting

The real power of prompt-language emerges when primitives combine. A `retry` inside a `foreach` makes batch processing resilient. A `try/catch` around a `while` loop contains cascading failures. These compositions are not just theoretical -- they map directly to patterns that engineers encounter in CI/CD, deployment, data migration, and infrastructure work.

### 9.1 Retry Inside Foreach: Resilient Batch Processing

Wraps each iteration in a retry block so that a transient failure on one item does not skip it or abort the entire batch.

```prompt-language
Goal: deploy all microservices with retry

flow:
  let services = run "ls services/*/Dockerfile | xargs -I{} dirname {} | xargs -I{} basename {}"
  foreach svc in ${services} max 15
    retry max 3
      run: docker build -t registry.example.com/${svc}:latest services/${svc}/
      run: docker push registry.example.com/${svc}:latest
    end
    if command_failed
      prompt: Service ${svc} failed to build or push after 3 attempts. Check the Dockerfile and fix the issue.
    end
  end

done when:
  gate all_pushed: for s in services/*/; do docker manifest inspect registry.example.com/$(basename $s):latest > /dev/null 2>&1 || exit 1; done
```

**Why this works:** The `retry max 3` inside the `foreach` gives each service 3 build attempts (handling network flakes on push, transient registry errors). If all retries fail, the `if command_failed` outside the retry engages the agent for manual diagnosis. The gate independently verifies all images are pushed.

### 9.2 Try/Catch Wrapping a While Loop

Contains a potentially unstable fix-test cycle inside a try/catch so that an unexpected crash does not leave the codebase in a broken state.

```prompt-language
Goal: fix database integration tests safely

flow:
  run: git stash push -m "pre-fix-backup"
  try
    until tests_pass max 5
      run: npm run test:integration
      if command_failed
        prompt: Fix the integration test failures. Only modify test files and database helpers, not production code.
      end
    end
  catch command_failed
    prompt: The fix cycle encountered an unrecoverable error. Review what went wrong and write a brief diagnosis to INTEGRATION-FIX-NOTES.md.
    run: git stash pop
  end

done when:
  tests_pass
```

**Why this works:** If something goes catastrophically wrong during the fix loop (syntax error crashes the test runner, file gets corrupted), the `catch` block pops the git stash to restore the original state and documents what happened. The outer `done when: tests_pass` still enforces the final outcome.

### 9.3 If Inside Retry: Conditional Retry Logic

Uses `if` inside a `retry` to apply different fix strategies depending on the type of failure.

```prompt-language
Goal: fix flaky E2E tests

flow:
  retry max 4
    run: npx playwright test --reporter=json 2> test-output.json
    if command_failed
      let failures = run "cat test-output.json | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.suites?.[0]?.specs?.filter(s=>s.ok===false).map(s=>s.title).join(', '))\""
      run: cat test-output.json | grep -qi "timeout"
      if command_succeeded
        prompt: Tests failed due to timeouts: ${failures}. Increase wait times, add explicit waits for network requests, or optimize slow selectors.
      else
        run: cat test-output.json | grep -qi "selector"
        if command_succeeded
          prompt: Tests failed due to selector mismatches: ${failures}. Update the selectors to match the current DOM structure.
        else
          prompt: Tests failed for unknown reasons: ${failures}. Read the error output and fix the root cause.
        end
      end
    end
  end

done when:
  gate e2e_pass: npx playwright test --reporter=list
```

### 9.4 Foreach Inside Try: Batch with Error Boundary

Wraps a batch operation inside try/catch so that a failure in any iteration triggers a coordinated recovery rather than leaving partial results.

```prompt-language
Goal: migrate all config files to new format

flow:
  let configs = run "find config/ -name '*.yaml' -type f"
  try
    foreach cfg in ${configs} max 30
      prompt: Convert ${cfg} from YAML to TOML format. Write the result to ${cfg}.toml. Preserve all comments as TOML comments.
      run: node validate-toml.js ${cfg}.toml
      if command_failed
        prompt: The TOML conversion of ${cfg} is invalid. Fix the generated .toml file.
      end
    end
    # Only remove originals after all conversions succeed
    foreach cfg in ${configs} max 30
      run: rm ${cfg}
    end
  catch command_failed
    prompt: Config migration failed partway through. List which files were converted and which were not. Do NOT delete any original YAML files. Write a status report to migration-status.md.
  end

done when:
  gate all_toml: test $(find config/ -name '*.yaml' | wc -l) -eq 0 && test $(find config/ -name '*.toml' | wc -l) -gt 0
```

**Why this works:** The two-phase approach (convert all, then delete originals) inside a `try` ensures atomicity. If any conversion fails, the `catch` preserves all original YAML files and documents the partial state. No data is lost.

### 9.5 While with Nested If and Break

Implements a polling loop that checks multiple conditions and breaks early when the target state is reached.

```prompt-language
Goal: wait for deployment to become healthy

flow:
  run: kubectl apply -f k8s/deployment.yaml
  let attempts = "0"
  while command_succeeded max 30
    run: sleep 10
    let status = run "kubectl rollout status deployment/myapp --timeout=5s 2>&1"
    if ${status} == "successfully rolled out"
      break
    end
    let health = run "kubectl get pods -l app=myapp -o jsonpath='{.items[*].status.containerStatuses[*].state.waiting.reason}'"
    if ${health} == "CrashLoopBackOff"
      prompt: Pod is in CrashLoopBackOff. Check logs with kubectl logs and fix the issue.
      run: kubectl apply -f k8s/deployment.yaml
    end
    if ${health} == "ImagePullBackOff"
      prompt: Image pull is failing. Verify the image tag in k8s/deployment.yaml and check registry credentials.
      run: kubectl apply -f k8s/deployment.yaml
    end
  end

done when:
  gate healthy: kubectl rollout status deployment/myapp --timeout=30s
```

### 9.6 Triple Nesting: Foreach + Retry + If

Processes multiple packages, retrying publication for each, with conditional logic for version conflicts.

```prompt-language
Goal: publish all workspace packages

flow:
  let packages = run "npx lerna list --json 2>/dev/null | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify(d.map(p=>p.name)))\""
  foreach pkg in ${packages} max 20
    retry max 3
      run: npx lerna publish from-package --scope=${pkg} --yes 2>&1
      if command_failed
        run: echo "${last_stderr}" | grep -qi "already exists"
        if command_succeeded
          prompt: Version conflict for ${pkg}. Bump the patch version in its package.json and retry.
        else
          prompt: Publishing ${pkg} failed with an unexpected error. Diagnose from: ${last_stderr}
        end
      end
    end
  end

done when:
  gate all_published: npx lerna list --json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); Promise.all(d.map(p=>fetch('https://registry.npmjs.org/'+p.name+'/'+p.version).then(r=>{if(!r.ok)throw 1}))).then(()=>process.exit(0)).catch(()=>process.exit(1))"
```

### 9.7 Try/Catch with Finally for Guaranteed Cleanup

Uses `finally` to ensure cleanup runs regardless of success or failure. Demonstrates the three-part try/catch/finally pattern.

```prompt-language
Goal: run load test with guaranteed resource cleanup

flow:
  try
    run: docker compose -f docker-compose.loadtest.yml up -d
    run: sleep 15
    run: k6 run loadtest.js --out json=results.json
    if command_failed
      prompt: Load test script has errors. Fix loadtest.js and ensure it runs cleanly.
      run: k6 run loadtest.js --out json=results.json
    end
    prompt: Analyze results.json. Create a performance report at docs/load-test-report.md with: p50/p95/p99 latencies, error rate, throughput, and recommendations.
  catch command_failed
    prompt: Load test infrastructure failed to start. Check docker-compose.loadtest.yml for issues and document what went wrong.
  finally
    run: docker compose -f docker-compose.loadtest.yml down --volumes --remove-orphans
  end

done when:
  file_exists docs/load-test-report.md
```

**Why this works:** The `finally` block guarantees that Docker containers are torn down even if the load test crashes, the analysis fails, or the catch block triggers. Without `finally`, a failed flow could leave containers running indefinitely.

### 9.8 Nested Loops: While Inside Foreach

Processes each item with its own convergence loop. Useful when each item may need multiple fix iterations.

```prompt-language
Goal: fix all deprecated API usages across modules

flow:
  let modules = run "grep -rl 'DEPRECATED_API' src/ | xargs -I{} dirname {} | sort -u"
  foreach mod in ${modules} max 15
    let deprecated_count = run "grep -c 'DEPRECATED_API' ${mod}/*.ts 2>/dev/null || echo 0"
    while ${deprecated_count} > "0" max 5
      prompt: In the ${mod} directory, replace one usage of DEPRECATED_API with the new API. Follow the migration guide in docs/api-migration.md. Only change files in ${mod}/.
      run: npm test
      if command_failed
        prompt: The migration in ${mod} broke tests. Fix the issue before continuing.
      end
      let deprecated_count = run "grep -c 'DEPRECATED_API' ${mod}/*.ts 2>/dev/null || echo 0"
    end
  end

done when:
  gate no_deprecated: test $(grep -rl 'DEPRECATED_API' src/ | wc -l) -eq 0
  tests_pass
```

### 9.9 Retry Wrapping Try/Catch: Defense in Depth

A retry around a try/catch creates two layers of error handling: the catch handles expected failures gracefully, while the retry handles unexpected failures by starting over.

```prompt-language
Goal: set up monitoring stack

flow:
  retry max 3
    try
      run: terraform init
      run: terraform plan -out=tfplan
      run: terraform apply tfplan
    catch command_failed
      prompt: Terraform apply failed. Check the error, fix the .tf files, and ensure the state is consistent. Run terraform refresh if needed.
      run: terraform refresh
    end
  end
  run: terraform output -json > infra-output.json
  prompt: Verify the monitoring stack is operational. Check that Prometheus, Grafana, and Alertmanager endpoints in infra-output.json are reachable.

done when:
  gate infra_up: terraform output -json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); if(!d.prometheus_url?.value) process.exit(1)"
```

### 9.10 Full Composition: CI Pipeline as a Flow

Combines five primitives into a complete CI pipeline that adapts to failures at each stage.

```prompt-language
Goal: full CI pipeline with adaptive recovery

flow:
  # Stage 1: Dependencies
  retry max 2
    run: npm ci
  end

  # Stage 2: Static analysis (parallel-safe, independent checks)
  try
    run: npx tsc --noEmit
  catch command_failed
    prompt: Type errors found. Fix all TypeScript errors.
    run: npx tsc --noEmit
  end

  try
    run: npx eslint . --max-warnings=0
  catch command_failed
    run: npx eslint . --fix
    run: npx eslint . --max-warnings=0
    if command_failed
      prompt: Auto-fix could not resolve all lint issues. Fix the remaining errors manually.
    end
  end

  # Stage 3: Tests with coverage threshold
  retry max 3
    run: npx jest --coverage --silent
    if command_failed
      prompt: Tests are failing. Fix the test failures.
    end
  end

  # Stage 4: Build
  try
    run: npm run build
  catch command_failed
    prompt: Build failed after tests passed. This is likely a build config issue, not a code issue. Check webpack/vite config.
    run: npm run build
  end

  # Stage 5: Security audit
  run: npm audit --audit-level=high
  if command_failed
    prompt: High-severity vulnerabilities found. Run npm audit fix and resolve any that require manual intervention.
    run: npm audit fix
  end

done when:
  tests_pass
  lint_pass
  gate build_ok: npm run build
```

**Why this works:** Each CI stage uses the primitive best suited to its failure mode: `retry` for flaky installs and tests, `try/catch` for auto-fixable lint and type errors, `if` for advisory checks like security audit. The gates enforce the final state independently of the flow's execution path.

### 9.11 Foreach + Try/Catch + If: Resilient Multi-Service Health Check

Combines iteration, error containment, and conditional logic to check and fix multiple services independently.

```prompt-language
Goal: verify and fix all service health endpoints

flow:
  let services = run "cat infrastructure/services.json | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify(d.map(s=>s.name)))\""
  let failures = []
  foreach svc in ${services} max 20
    try
      let url = run "cat infrastructure/services.json | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const s=d.find(x=>x.name==='${svc}'); console.log(s.healthUrl)\""
      run: curl -sf --max-time 10 ${url}
      if command_failed
        prompt: Health check for ${svc} at ${url} is failing. Inspect the service's health endpoint implementation and fix it.
        run: curl -sf --max-time 10 ${url}
        if command_failed
          let failures += "${svc}"
        end
      end
    catch command_failed
      let failures += "${svc}"
      prompt: Unexpected error checking ${svc}. Log the issue but continue with remaining services.
    end
  end
  if ${failures_length} > "0"
    prompt: These services still have failing health checks: ${failures}. Write a summary of the issues and recommended next steps to health-check-report.md.
  end

done when:
  file_exists health-check-report.md
```

### Debate: Composition and Nesting Patterns

Composition is where prompt-language transcends simple scripting and becomes genuine workflow orchestration. But the gap between "can nest" and "should nest" is wide, and getting it wrong produces flows that are harder to debug than the problems they solve.

The most important principle is that each level of nesting multiplies the number of possible execution paths. A `foreach` with 10 items containing a `retry max 3` containing an `if/else` has up to 10 x 3 x 2 = 60 distinct paths through the flow. When something fails on path 47, reconstructing what happened requires reading the session state file carefully. Keep nesting to two levels when possible; three levels should be reserved for cases where the problem genuinely demands it (like the CI pipeline example, where each stage has fundamentally different failure modes).

A surprising insight from real usage: `try/catch` is more valuable as a composition wrapper than as a standalone primitive. A bare `try` around a single `run` adds little over just checking `command_failed`. But a `try` around a `foreach` or `while` loop creates a genuine error boundary -- if anything in the loop goes catastrophically wrong, the catch block can perform coordinated recovery (rolling back state, cleaning up partial results) rather than leaving the flow stuck mid-iteration.

The `finally` block is underused but critical for infrastructure workflows. Any flow that provisions resources (Docker containers, cloud instances, temp databases) should wrap the provisioning and usage in `try` with cleanup in `finally`. Without it, a failed flow leaves resources running, and the next invocation may fail because ports are occupied or names conflict.

One common anti-pattern is nesting retries inside retries. A `retry max 3` containing a `retry max 3` gives 9 total attempts, but the semantics are confusing: which retry triggered? The inner or outer? Prefer a single retry at the appropriate level, and use `if` to vary the fix strategy between attempts rather than adding another retry layer.

---

## 10. Real-World CI/CD

Production CI/CD pipelines are where prompt-language shines hardest. The combination of `run:` auto-execution, `try/catch` error handling, variable capture, and hard gates maps directly to what DevOps engineers already think about: build it, test it, deploy it, verify it, roll back if broken. These examples show flows that would be dangerous to run without enforcement -- deployments where "I think it worked" is not acceptable.

### 10.1 Full Build-Test-Deploy Pipeline

A three-stage pipeline that builds, runs the full test suite, and deploys only if both stages succeed. The gate prevents any deployment from a broken build.

```prompt-language
Goal: Build, test, and deploy the application

flow:
  # Stage 1: Build
  run: npm run build
  if command_failed
    prompt: The build failed. Fix the build errors before proceeding.
    retry max 3
      run: npm run build
    end
  end

  # Stage 2: Test
  run: npm test
  if command_failed
    prompt: Tests failed after a successful build. Fix the test failures.
    retry max 3
      run: npm test
    end
  end

  # Stage 3: Deploy
  let version = run "node -e \"console.log(require('./package.json').version)\""
  run: npm run deploy -- --tag ${version}
  if command_failed
    prompt: Deployment failed for version ${version}. Investigate the deploy logs and fix the issue.
  end

done when:
  tests_pass
  gate deploy_ok: curl -sf https://api.example.com/health
```

**Why this works:** Each stage gates the next. The final custom gate hits the real health endpoint -- the agent cannot claim success unless the deployed service actually responds.

### 10.2 Rollback on Failure

Deploys to production and automatically rolls back if the health check fails. Captures the previous version before deploying so rollback targets the exact prior state.

```prompt-language
Goal: Deploy with automatic rollback on failure

flow:
  # Capture current state for rollback
  let previous_version = run "kubectl get deployment myapp -o jsonpath='{.spec.template.spec.containers[0].image}'"
  let new_image = run "echo myapp:$(git rev-parse --short HEAD)"

  # Deploy
  run: kubectl set image deployment/myapp myapp=${new_image}
  run: kubectl rollout status deployment/myapp timeout 120

  # Verify
  try
    run: curl -sf https://api.example.com/health
  catch command_failed
    prompt: Health check failed after deploy. Rolling back to ${previous_version}.
    run: kubectl set image deployment/myapp myapp=${previous_version}
    run: kubectl rollout status deployment/myapp timeout 120
  end

done when:
  gate healthy: curl -sf https://api.example.com/health
```

**Why this works:** The `let previous_version` capture happens before deployment, so the exact rollback target is preserved in a variable regardless of conversation length or context compression.

### 10.3 Canary Deployment Validation

Deploys to a canary target first, runs validation, and only promotes to full rollout if metrics look good.

```prompt-language
Goal: Canary deploy with validation before full rollout

flow:
  # Deploy canary (10% traffic)
  run: kubectl apply -f k8s/canary.yaml
  run: kubectl rollout status deployment/myapp-canary timeout 90

  # Wait for metrics to stabilize
  run: sleep 30

  # Check canary error rate
  let error_rate = run "curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_errors_total{deployment=\"canary\"}[5m])' | jq -r '.data.result[0].value[1]'"
  prompt: Canary error rate is ${error_rate}. If this is above 0.01, fix the issue. If acceptable, confirm canary is healthy.

  # Promote to full rollout
  try
    run: kubectl apply -f k8s/production.yaml
    run: kubectl rollout status deployment/myapp timeout 120
  catch command_failed
    prompt: Full rollout failed. Roll back to the previous version by reverting the deployment.
    run: kubectl rollout undo deployment/myapp
  end

done when:
  gate prod_healthy: curl -sf https://api.example.com/health
  gate canary_cleaned: kubectl get deployment myapp-canary -o jsonpath='{.status.replicas}' | grep -q '^0$'
```

### 10.4 Database Migration Safety

Runs database migrations with a dry-run check first, then applies. Captures the migration state before and after for audit.

```prompt-language
Goal: Run database migrations safely

flow:
  # Pre-flight checks
  let db_status = run "npx prisma migrate status"
  prompt: Review the migration status: ${db_status}. Ensure there are no drift issues before proceeding.

  # Dry run
  run: npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations-directory prisma/migrations --exit-code
  if command_failed
    prompt: Migration drift detected. Resolve the schema drift before applying migrations.
  end

  # Apply migrations
  try
    run: npx prisma migrate deploy
  catch command_failed
    prompt: Migration failed. Check the error output and fix the migration file.
    run: npx prisma migrate status
  end

  # Verify
  let post_status = run "npx prisma migrate status"
  prompt: Verify migration result. Before: ${db_status}. After: ${post_status}. Confirm all migrations applied successfully.

done when:
  gate migrations_clean: npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"
```

### 10.5 Docker Build and Push

Builds a Docker image, runs security scanning, and pushes only if the scan passes. The gate verifies the image exists in the registry.

```prompt-language
Goal: Build, scan, and push Docker image

flow:
  let tag = run "git rev-parse --short HEAD"
  let image = "registry.example.com/myapp:${tag}"

  # Build
  run: docker build -t ${image} .
  if command_failed
    prompt: Docker build failed. Fix the Dockerfile or build context errors.
    retry max 2
      run: docker build -t ${image} .
    end
  end

  # Security scan
  run: docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --exit-code 1 --severity HIGH,CRITICAL ${image}
  if command_failed
    prompt: Security scan found HIGH or CRITICAL vulnerabilities. Update the affected dependencies in the Dockerfile to fix them.
    run: docker build -t ${image} --no-cache .
    run: docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --exit-code 1 --severity HIGH,CRITICAL ${image}
  end

  # Push
  run: docker push ${image}

done when:
  gate image_pushed: docker manifest inspect ${image}
```

### 10.6 Kubernetes Deployment with Readiness Checks

Applies Kubernetes manifests and waits for all pods to be ready, with retry logic for flaky rollouts.

```prompt-language
Goal: Deploy to Kubernetes and verify readiness

flow:
  let namespace = "production"

  # Apply manifests
  run: kubectl apply -f k8s/ -n ${namespace}

  # Wait for rollout
  retry max 3
    run: kubectl rollout status deployment/api -n ${namespace} timeout 120
    if command_failed
      prompt: Rollout is not completing. Check pod events and logs for the failing pods in the ${namespace} namespace. Fix the issue.
      run: kubectl describe pods -n ${namespace} -l app=api | tail -30
    end
  end

  # Verify all pods healthy
  run: kubectl wait --for=condition=ready pods -l app=api -n ${namespace} timeout 60

done when:
  gate pods_ready: kubectl wait --for=condition=ready pods -l app=api -n production --timeout=10s
```

### 10.7 Terraform Apply with Plan Review

Runs `terraform plan`, captures the output for review, then applies only after the plan is confirmed safe.

```prompt-language
Goal: Review and apply Terraform changes safely

flow:
  run: terraform init
  run: terraform validate
  if command_failed
    prompt: Terraform validation failed. Fix the configuration errors.
    retry max 3
      run: terraform validate
    end
  end

  # Plan and capture
  let plan_output = run "terraform plan -no-color -out=tfplan 2>&1"
  prompt: Review this Terraform plan carefully. Identify any destructive changes (resource deletions or replacements). If there are dangerous changes, modify the Terraform config to avoid them. Plan output: ${plan_output}

  # Apply
  try
    run: terraform apply -auto-approve tfplan
  catch command_failed
    prompt: Terraform apply failed. Check the error and fix the configuration.
    run: terraform plan -no-color -out=tfplan
    run: terraform apply -auto-approve tfplan
  end

done when:
  gate tf_clean: terraform plan -detailed-exitcode -no-color 2>&1 | grep -q "No changes"
```

**Why this works:** Capturing the plan output into a variable means the agent reviews the exact plan that will be applied, not a stale or approximate recollection. The final gate confirms no drift remains.

### 10.8 GitHub Release Automation

Creates a release with changelog, builds artifacts, and publishes to GitHub. Gates verify the release is visible.

```prompt-language
Goal: Create a GitHub release with artifacts

flow:
  let version = run "node -e \"console.log(require('./package.json').version)\""
  let prev_tag = run "git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo 'v0.0.0'"

  # Generate changelog
  let changelog = run "git log ${prev_tag}..HEAD --oneline --no-merges"
  prompt: Write CHANGELOG.md entry for v${version} based on these commits: ${changelog}

  # Build artifacts
  run: npm run build
  run: npm pack

  # Tag and push
  run: git tag -a v${version} -m "Release v${version}"
  run: git push origin v${version}

  # Create GitHub release
  try
    run: gh release create v${version} *.tgz --title "v${version}" --notes-file CHANGELOG.md
  catch command_failed
    prompt: GitHub release creation failed. Fix the issue and try again.
    run: gh release create v${version} *.tgz --title "v${version}" --notes-file CHANGELOG.md
  end

done when:
  gate release_exists: gh release view v$(node -e "console.log(require('./package.json').version)")
```

### 10.9 Dependency Update Workflow

Updates dependencies, runs the full test suite, and only commits if nothing breaks. Uses foreach to handle multiple updates.

```prompt-language
Goal: Update outdated dependencies safely

flow:
  let outdated = run "npm outdated --json 2>/dev/null | jq -r 'keys[]' | head -10"

  foreach pkg in ${outdated} max 10
    # Update one package at a time
    run: npm install ${pkg}@latest

    # Verify nothing broke
    run: npm test
    if command_failed
      prompt: Updating ${pkg} broke tests. Fix the compatibility issue or revert to the previous version.
      run: npm test
      if command_failed
        # Revert this package
        run: git checkout -- package.json package-lock.json
        run: npm install
      end
    end
  end

  # Final verification
  run: npm audit --audit-level=high

done when:
  tests_pass
  gate no_high_vulns: npm audit --audit-level=high
```

### 10.10 Security Scanning in CI

Runs multiple security tools in sequence, captures findings, and enforces that all critical issues are resolved.

```prompt-language
Goal: Run security scans and fix critical issues

flow:
  # Dependency audit
  run: npm audit --json > /tmp/audit.json 2>&1; true
  let audit_result = run "cat /tmp/audit.json | jq '.metadata.vulnerabilities.critical // 0'"

  # Secret scanning
  run: npx secretlint "**/*"
  if command_failed
    prompt: Secret scanning found exposed credentials. Remove or rotate any secrets found in the codebase. Use environment variables instead.
    retry max 3
      run: npx secretlint "**/*"
    end
  end

  # SAST scan
  run: npx eslint-plugin-security . --ext .js,.ts 2>&1; true
  let security_issues = run "npx eslint . --ext .js,.ts --rule '{\"security/detect-eval-with-expression\": \"error\"}' 2>&1 | grep -c 'error' || echo 0"

  if ${audit_result} > 0
    prompt: Found ${audit_result} critical vulnerabilities. Fix them by updating dependencies or finding alternatives.
    retry max 3
      run: npm audit --audit-level=critical
    end
  end

done when:
  gate no_critical_vulns: npm audit --audit-level=critical
  gate no_secrets: npx secretlint "**/*"
```

### 10.11 Multi-Environment Deploy Chain

Deploys through dev, staging, and production in sequence, with verification gates between each environment.

```prompt-language
Goal: Deploy through dev, staging, and production

flow:
  let commit = run "git rev-parse --short HEAD"

  foreach env in "dev staging production" max 3
    # Deploy to environment
    try
      run: npm run deploy -- --env ${env} --version ${commit}
    catch command_failed
      prompt: Deployment to ${env} failed. Investigate the error and fix it before retrying.
      run: npm run deploy -- --env ${env} --version ${commit}
    end

    # Verify environment health
    run: curl -sf https://${env}.example.com/health timeout 30
    if command_failed
      prompt: Health check failed for ${env} environment. Check the deployment logs and fix the issue. Do not proceed to the next environment.
      break
    end
  end

done when:
  gate prod_up: curl -sf https://production.example.com/health
```

### Debate: Real-World CI/CD

**When to use these patterns.** CI/CD flows are the strongest use case for prompt-language. The fundamental problem in autonomous deployment is verification: an agent that deploys without checking health endpoints, rollout status, or test results is dangerous. Gates make verification non-optional. The `try/catch` pattern maps naturally to deploy-with-rollback, and variable capture preserves exact version strings and rollback targets across long sessions.

**When to avoid them.** If your CI/CD is already fully automated (GitHub Actions, CircleCI, etc.), wrapping it in prompt-language adds latency without much benefit. These flows are most valuable when the deployment requires human-like judgment -- reading error logs, deciding whether a canary error rate is acceptable, choosing which dependency to revert. If the pipeline is purely mechanical, a shell script is faster and more predictable.

**Common mistakes.** The biggest error is forgetting that `run:` built-in variables overwrite each other. If you run `kubectl rollout status` and then `curl` the health endpoint, `command_failed` reflects the curl result, not the rollout. Capture intermediate results with `let` if you need them later. Another trap: `timeout` on `run:` kills the command, which sets `command_failed = true` -- ensure your retry logic distinguishes between timeouts and genuine failures if that matters.

**Tradeoffs.** Complexity versus safety is the core tension. A 30-line canary flow (example 10.3) is harder to read than "deploy and check," but it catches a class of failures that natural language prompts miss entirely. The surprising insight from real usage: engineers who start with simple `done when:` gates (no flow at all) get 80% of the value. The full flow machinery pays off most when the deployment has conditional logic -- rollback decisions, environment-specific config, sequential multi-stage promotion.

---

## 11. Code Quality Enforcement

Code quality is a verification problem, which makes it a natural fit for gates. The insight behind these examples is that most quality checks have a clear boolean signal -- a command that exits 0 or non-zero. prompt-language turns those signals into hard constraints the agent cannot bypass. Instead of hoping the agent remembers to run the linter, you guarantee it.

### 11.1 Multi-Language Test Enforcement

Runs test suites for a polyglot monorepo, ensuring all languages pass before completion.

```prompt-language
Goal: Fix all failing tests in the monorepo

flow:
  # JavaScript
  run: npm test
  if command_failed
    prompt: JavaScript tests failed. Fix the failing tests in the JS packages.
    retry max 3
      run: npm test
    end
  end

  # Python
  run: python -m pytest tests/ -x
  if command_failed
    prompt: Python tests failed. Fix the failing pytest tests.
    retry max 3
      run: python -m pytest tests/ -x
    end
  end

  # Go
  run: go test ./...
  if command_failed
    prompt: Go tests failed. Fix the failing Go tests.
    retry max 3
      run: go test ./...
    end
  end

done when:
  tests_pass
  pytest_pass
  go_test_pass
```

**Why this works:** Each language has its own built-in gate predicate. All three must pass independently -- fixing JavaScript tests does not let the agent skip broken Python tests.

### 11.2 Coverage Threshold Gate

Runs tests with coverage and enforces a minimum threshold. The gate checks the actual coverage number, not the agent's claim.

```prompt-language
Goal: Increase test coverage above 80%

flow:
  let baseline = run "npx vitest run --coverage --reporter=json 2>/dev/null | jq '.total.lines.pct' || echo 0"
  prompt: Current line coverage is ${baseline}%. Identify untested modules and write tests to increase coverage above 80%.

  retry max 5
    run: npx vitest run --coverage
    let current = run "npx vitest run --coverage --reporter=json 2>/dev/null | jq '.total.lines.pct' || echo 0"
    if command_failed
      prompt: Tests failed. Fix the test errors before checking coverage again.
    end
  end

done when:
  tests_pass
  gate coverage_80: npx vitest run --coverage --reporter=json 2>/dev/null | jq -e '.total.lines.pct >= 80'
```

**Why this works:** The custom gate runs the actual coverage tool and uses `jq -e` to check the threshold. The `-e` flag makes jq exit non-zero when the expression evaluates to false, which the gate interprets as a failure.

### 11.3 Linting and Formatting

Enforces both lint and format rules, auto-fixing where possible and asking the agent to fix the rest.

```prompt-language
Goal: Fix all lint and formatting issues

flow:
  # Auto-fix what we can
  run: npx prettier --write "src/**/*.ts"
  run: npx eslint . --fix --ext .ts

  # Check what remains
  run: npx eslint . --ext .ts --max-warnings=0
  if command_failed
    prompt: ESLint found errors that auto-fix could not resolve. Fix these manually.
    retry max 3
      run: npx eslint . --ext .ts --max-warnings=0
    end
  end

  run: npx prettier --check "src/**/*.ts"
  if command_failed
    prompt: Prettier found formatting issues that --write missed. Fix the formatting in the affected files.
  end

done when:
  lint_pass
  gate formatted: npx prettier --check "src/**/*.ts"
```

### 11.4 TypeScript Strict Mode Gate

Enforces zero TypeScript errors under strict mode. Useful when migrating a codebase to stricter type checking.

```prompt-language
Goal: Achieve zero TypeScript errors under strict mode

flow:
  let error_count = run "npx tsc --noEmit --strict 2>&1 | grep -c 'error TS' || echo 0"
  prompt: There are ${error_count} TypeScript strict mode errors. Fix them all. Start with the files that have the most errors.

  retry max 5
    run: npx tsc --noEmit --strict
    if command_failed
      let remaining = run "npx tsc --noEmit --strict 2>&1 | grep -c 'error TS' || echo 0"
      prompt: ${remaining} TypeScript errors remain. Fix the next batch.
    end
  end

done when:
  gate tsc_strict: npx tsc --noEmit --strict
```

### 11.5 Dependency Audit Enforcement

Scans for vulnerable dependencies and ensures no high-severity issues remain.

```prompt-language
Goal: Resolve all high-severity dependency vulnerabilities

flow:
  let audit_before = run "npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities | {high, critical}'"
  prompt: Current vulnerability counts: ${audit_before}. Resolve all high and critical vulnerabilities by updating, replacing, or patching affected packages.

  retry max 5
    run: npm audit --audit-level=high
    if command_failed
      let details = run "npm audit --json 2>/dev/null | jq '[.vulnerabilities | to_entries[] | select(.value.severity == \"high\" or .value.severity == \"critical\") | {name: .key, severity: .value.severity, fix: .value.fixAvailable}]'"
      prompt: These vulnerabilities remain: ${details}. Fix or mitigate each one.
    end
  end

done when:
  gate no_high_vulns: npm audit --audit-level=high
```

### 11.6 Dead Code Detection

Uses knip to find and remove unused exports, files, and dependencies.

```prompt-language
Goal: Remove all dead code detected by knip

flow:
  let dead_code = run "npx knip --reporter=compact 2>&1 | head -50"
  prompt: Knip found this dead code: ${dead_code}. Remove all unused exports, files, and dependencies. Be careful not to break anything.

  retry max 5
    run: npx knip
    if command_failed
      let remaining = run "npx knip --reporter=compact 2>&1 | head -30"
      prompt: Knip still reports issues: ${remaining}. Remove the remaining dead code.
    end
  end

done when:
  tests_pass
  gate no_dead_code: npx knip
```

**Why this works:** The `tests_pass` gate ensures that removing dead code did not break anything. The knip gate ensures all dead code is actually gone. Both conditions must hold simultaneously.

### 11.7 API Contract Validation

Validates that the API implementation matches the OpenAPI specification.

```prompt-language
Goal: Fix API contract violations

flow:
  # Generate current spec from code
  run: npx swagger-jsdoc -d swaggerDef.js -o /tmp/generated-spec.yaml

  # Compare against committed spec
  run: diff openapi.yaml /tmp/generated-spec.yaml
  if command_failed
    prompt: The API implementation has diverged from the OpenAPI spec. Either update the code to match the spec or update the spec to match the code. The diff shows the differences.
  end

  # Validate spec itself
  run: npx swagger-cli validate openapi.yaml
  if command_failed
    prompt: The OpenAPI spec has validation errors. Fix the spec file.
    retry max 3
      run: npx swagger-cli validate openapi.yaml
    end
  end

done when:
  gate spec_valid: npx swagger-cli validate openapi.yaml
  gate contract_match: diff -q openapi.yaml /tmp/generated-spec.yaml
```

### 11.8 Performance Regression Detection

Captures a baseline benchmark, makes changes, and verifies performance does not regress.

```prompt-language
Goal: Optimize without performance regression

flow:
  # Capture baseline
  let baseline = run "node benchmark.js --json 2>&1"
  prompt: Baseline benchmark results: ${baseline}. Identify the slowest operations and optimize them.

  # Optimize
  prompt: Implement the optimizations. Focus on the hot path identified in the benchmark.

  # Verify no regression
  let result = run "node benchmark.js --json 2>&1"
  prompt: Compare results. Baseline: ${baseline}. After optimization: ${result}. If any operation regressed by more than 10%, revert that specific change and try a different approach.

  # Run tests to ensure correctness
  run: npm test
  if command_failed
    prompt: Optimizations broke tests. Fix them while preserving the performance gains.
    retry max 3
      run: npm test
    end
  end

done when:
  tests_pass
  gate no_regression: node benchmark.js --json 2>&1 | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.exit(d.opsPerSec < 1000 ? 1 : 0)"
```

### 11.9 Documentation Coverage Check

Ensures all public API functions have JSDoc comments.

```prompt-language
Goal: Add JSDoc documentation to all public exports

flow:
  let missing = run "npx typedoc --validation.notDocumented 2>&1 | grep -c 'not documented' || echo 0"
  prompt: There are ${missing} undocumented public exports. Add JSDoc comments to every public function, class, and type. Include @param, @returns, and @example tags.

  retry max 5
    run: npx typedoc --validation.notDocumented 2>&1
    if command_failed
      let still_missing = run "npx typedoc --validation.notDocumented 2>&1 | grep 'not documented' | head -10"
      prompt: These exports still need documentation: ${still_missing}
    end
  end

done when:
  gate all_documented: npx typedoc --validation.notDocumented
```

### 11.10 Bundle Size Check

Monitors production bundle size and prevents bloat from exceeding a threshold.

```prompt-language
Goal: Reduce bundle size below 250KB

flow:
  run: npm run build
  let size_before = run "du -sb dist/ | cut -f1"
  prompt: Current bundle size is ${size_before} bytes. Analyze the bundle and reduce it below 250KB (256000 bytes). Use tree-shaking, code splitting, or remove unused dependencies.

  retry max 5
    run: npm run build
    let size_after = run "du -sb dist/ | cut -f1"
    if ${size_after} > 256000
      prompt: Bundle is still ${size_after} bytes. Target is 256000. Find more to trim.
    end
  end

done when:
  gate bundle_small: test $(du -sb dist/ | cut -f1) -lt 256000
```

### 11.11 Spell Check and Style Enforcement

Runs cspell and a prose linter to catch typos and style issues in code comments and documentation.

```prompt-language
Goal: Fix all spelling and prose style issues

flow:
  run: npx cspell "src/**/*.ts" --no-progress
  if command_failed
    let typos = run "npx cspell 'src/**/*.ts' --no-progress 2>&1 | tail -20"
    prompt: Fix these spelling issues: ${typos}. Either correct the spelling or add legitimate terms to cspell.json.
    retry max 3
      run: npx cspell "src/**/*.ts" --no-progress
    end
  end

  run: npx alex src/
  if command_failed
    prompt: The prose linter found insensitive or inconsistent language. Fix the flagged comments and documentation.
  end

done when:
  gate spelling_clean: npx cspell "src/**/*.ts" --no-progress
```

### Debate: Code Quality Enforcement

**When to use these patterns.** Code quality gates are the lowest-effort, highest-value application of prompt-language. Adding `done when: tests_pass` and `done when: lint_pass` to any prompt takes five seconds and eliminates the most common failure mode: the agent declares victory without running the checks. For more complex quality dimensions -- coverage thresholds, bundle size limits, documentation completeness -- custom gates (`gate name: command`) extend this to any tool with a CLI.

**When to avoid them.** If the quality check has no command-line interface (e.g., "code readability" or "good variable names"), there is no gate to write. prompt-language enforces objective, automatable checks. Subjective quality dimensions are better handled by code review or by writing more specific prompts. Also, stacking too many gates creates a situation where the agent spends most of its time re-running verification commands rather than writing code. Three to four gates is a practical ceiling for most tasks.

**Common mistakes.** The most frequent error is writing a gate command that always passes. For example, `npm audit` exits 0 even when there are low-severity vulnerabilities -- you need `npm audit --audit-level=high` to get a non-zero exit code on real problems. Similarly, `npx tsc` exits 0 if there is no tsconfig.json, which is a false pass. Always verify your gate command actually fails in the broken state before trusting it.

**Surprising insights.** In practice, the coverage gate (11.2) is more effective than expected -- not because the coverage number matters intrinsically, but because it forces the agent to write tests for code paths it would normally skip (error handling, edge cases, cleanup logic). The tests themselves often catch real bugs. The gate is a forcing function for thoroughness, not just a number.

---

## 12. Creative and Unexpected Uses

prompt-language was designed for code workflows, but its primitives -- sequential steps, conditional branching, variable capture, hard gates, iteration -- are general enough to handle any structured process that needs enforcement. These examples push the DSL into domains where you might not expect it: onboarding, incident response, technical writing, and more. The common thread is that each workflow has a verifiable completion condition and benefits from preventing premature "I'm done."

### 12.1 New Team Member Onboarding Checklist

Walks a new developer through environment setup, access verification, and first contribution. Each step is verified by a gate.

```prompt-language
Goal: Complete developer onboarding for a new team member

flow:
  # Environment setup
  prompt: Check that the development environment is configured. Verify Node.js >= 22, git, and Docker are installed. Install any missing tools.
  run: node -v
  run: git --version
  run: docker --version

  # Repository setup
  run: git clone https://github.com/company/main-repo.git /tmp/onboarding-repo 2>/dev/null; true
  run: cd /tmp/onboarding-repo && npm install

  # Verify access
  try
    run: gh api user
  catch command_failed
    prompt: GitHub CLI is not authenticated. Set up authentication with gh auth login.
  end

  # Run tests to verify environment works
  run: cd /tmp/onboarding-repo && npm test
  if command_failed
    prompt: Tests fail in a fresh clone. This is an environment issue, not a code issue. Debug and fix the local environment setup.
  end

  # First contribution
  prompt: Create a branch, add yourself to CONTRIBUTORS.md, and open a draft PR.

done when:
  gate env_works: cd /tmp/onboarding-repo && npm test
  file_exists /tmp/onboarding-repo/CONTRIBUTORS.md
```

### 12.2 Incident Response Runbook

A structured incident response flow: diagnose, mitigate, document, and verify resolution. The gate ensures the service is actually back up.

```prompt-language
Goal: Respond to production incident

flow:
  # Triage
  let health = run "curl -s -o /dev/null -w '%{http_code}' https://api.example.com/health || echo 000"
  let recent_deploys = run "gh api repos/company/api/deployments --jq '.[0:3] | .[].sha' 2>/dev/null || echo 'unknown'"
  prompt: Service health returned ${health}. Recent deploys: ${recent_deploys}. Investigate the root cause. Check application logs, error rates, and recent changes.

  # Mitigate
  let error_logs = run "kubectl logs deployment/api --tail=50 2>/dev/null || echo 'Could not fetch logs'"
  prompt: Error logs: ${error_logs}. Apply a mitigation. This could be a rollback, a config change, or a hotfix. Prioritize restoring service over root cause analysis.

  # Verify mitigation
  retry max 3
    run: curl -sf https://api.example.com/health timeout 30
    if command_failed
      prompt: Service is still down after mitigation. Try a different approach.
    end
  end

  # Document
  prompt: Write an incident report in incident-report.md. Include: timeline, root cause, mitigation applied, follow-up actions. Reference the exact error logs: ${error_logs}.

done when:
  gate service_up: curl -sf https://api.example.com/health
  file_exists incident-report.md
```

### 12.3 Technical Writing Workflow

Guides the agent through writing a technical document with research, drafting, review, and final polish.

````prompt-language
Goal: Write a technical architecture document

flow:
  # Research phase
  let structure = run "find src -type f -name '*.ts' | head -30"
  let deps = run "cat package.json | jq '.dependencies | keys'"
  let test_count = run "find src -name '*.test.ts' | wc -l"

  prompt: Analyze the codebase structure. Files: ${structure}. Dependencies: ${deps}. Test count: ${test_count}. Write a draft architecture.md covering: system overview, component diagram (in mermaid), data flow, and key design decisions.

  # Review phase
  prompt: Review architecture.md for technical accuracy. Cross-reference claims against the actual codebase. Fix any inaccuracies.

  # Completeness check
  prompt: Verify architecture.md covers all four required sections: system overview, component diagram, data flow, and design decisions. Add any missing sections.

done when:
  file_exists architecture.md
  gate has_mermaid: grep -q "```mermaid" architecture.md
  gate has_sections: grep -c "^##" architecture.md | xargs test 4 -le
````

**Why this works:** The gates enforce structure: the document must exist, must contain a mermaid diagram, and must have at least four second-level headings. The agent cannot skip sections.

### 12.4 Interactive Tutorial Generator

Creates a step-by-step tutorial with runnable code examples, verifying each example actually works.

```prompt-language
Goal: Generate a working tutorial for building a REST API

flow:
  # Setup
  run: mkdir -p /tmp/tutorial-project && cd /tmp/tutorial-project && npm init -y
  run: cd /tmp/tutorial-project && npm install express

  # Step 1: Basic server
  prompt: Write /tmp/tutorial-project/step1-server.js that creates an Express server with a GET /health endpoint. Then write tutorial/step1.md explaining the code line by line.
  run: cd /tmp/tutorial-project && node -e "const app = require('./step1-server.js'); setTimeout(() => process.exit(0), 1000)"

  # Step 2: CRUD routes
  prompt: Write /tmp/tutorial-project/step2-crud.js that adds GET/POST/PUT/DELETE routes for a "todos" resource with in-memory storage. Write tutorial/step2.md explaining REST conventions.
  run: cd /tmp/tutorial-project && node -e "require('./step2-crud.js'); setTimeout(() => process.exit(0), 1000)"

  # Step 3: Error handling
  prompt: Write /tmp/tutorial-project/step3-errors.js that adds error handling middleware and input validation. Write tutorial/step3.md explaining error handling patterns.
  run: cd /tmp/tutorial-project && node -e "require('./step3-errors.js'); setTimeout(() => process.exit(0), 1000)"

  # Verify all steps compile and run
  foreach step in "step1-server step2-crud step3-errors" max 3
    run: cd /tmp/tutorial-project && node -c ${step}.js
  end

done when:
  file_exists /tmp/tutorial-project/step1-server.js
  file_exists /tmp/tutorial-project/step2-crud.js
  file_exists /tmp/tutorial-project/step3-errors.js
```

### 12.5 Environment Setup Automation

Sets up a development environment from scratch, verifying each tool is correctly installed and configured.

```prompt-language
Goal: Set up a complete development environment

flow:
  let os = run "uname -s"

  # Core tools
  foreach tool in "node git docker python3" max 4
    run: which ${tool} 2>/dev/null
    if command_failed
      prompt: ${tool} is not installed. Install it for ${os}. Use the system package manager or official installer.
      run: which ${tool}
    end
  end

  # Node version check
  let node_version = run "node -v | sed 's/v//' | cut -d. -f1"
  if ${node_version} < 22
    prompt: Node.js version is ${node_version}, but 22+ is required. Upgrade Node.js.
  end

  # Project setup
  run: npm install
  run: npm run build
  if command_failed
    prompt: Build failed in the fresh environment. Fix any missing system dependencies.
    retry max 3
      run: npm run build
    end
  end

  run: npm test

done when:
  tests_pass
  gate node_ok: node -e "process.exit(parseInt(process.version.slice(1)) >= 22 ? 0 : 1)"
```

### 12.6 Compliance Verification

Checks a codebase against security and compliance requirements, generating an audit report.

```prompt-language
Goal: Verify compliance with security requirements

flow:
  let issues = []

  # Check: No hardcoded secrets
  run: grep -rn "password\s*=\s*['\"]" src/ --include="*.ts" || true
  if command_succeeded
    let issues += "Found hardcoded passwords in source files"
  end

  # Check: All API routes have auth middleware
  let unprotected = run "grep -rn 'router\.\(get\|post\|put\|delete\)' src/routes/ --include='*.ts' | grep -v 'authenticate' | wc -l || echo 0"
  if ${unprotected} > 0
    let issues += "Found ${unprotected} unprotected API routes"
    prompt: There are ${unprotected} API routes without authentication middleware. Add the authenticate middleware to each one.
  end

  # Check: Dependencies are licensed appropriately
  run: npx license-checker --failOn "GPL-3.0;AGPL-3.0"
  if command_failed
    let issues += "Found GPL/AGPL licensed dependencies"
    prompt: Some dependencies use copyleft licenses that are incompatible with our project. Replace them with MIT/Apache-2.0 licensed alternatives.
  end

  # Check: No eval() usage
  run: grep -rn "eval(" src/ --include="*.ts" || true
  let eval_count = run "grep -c 'eval(' src/**/*.ts 2>/dev/null || echo 0"
  if ${eval_count} > 0
    let issues += "Found eval() usage in source code"
    prompt: Remove all uses of eval() and replace with safe alternatives.
  end

  # Generate report
  prompt: Write compliance-report.md summarizing all findings. Issues found: ${issues}

done when:
  file_exists compliance-report.md
  gate no_secrets: sh -c '! grep -rqn "password\s*=\s*[\x27\"]" src/ --include="*.ts"'
  gate no_eval: sh -c '! grep -rqn "eval(" src/ --include="*.ts"'
```

### 12.7 Competitive Analysis Automation

Gathers data about competing tools, structures the analysis, and produces a comparison document.

```prompt-language
Goal: Produce a competitive analysis document

flow:
  # Gather data about our tool
  let our_size = run "du -sh dist/ 2>/dev/null | cut -f1 || echo unknown"
  let our_deps = run "jq '.dependencies | length' package.json 2>/dev/null || echo unknown"
  let our_tests = run "npm test 2>&1 | tail -3"

  # Capture analysis as structured data
  let our_metrics = prompt "Based on this codebase, summarize our tool's strengths and weaknesses in 3 bullet points each. Size: ${our_size}, deps: ${our_deps}, test output: ${our_tests}"

  # Research competitors (agent uses web search, file analysis, etc.)
  prompt: Research the top 3 competitors in this space. For each, note: feature set, bundle size, dependency count, and community activity. Write your findings to competitor-data.md.

  # Synthesize
  prompt: Write competitive-analysis.md. Use our metrics: ${our_metrics}. Reference competitor-data.md. Include a feature comparison table and a recommendation section.

done when:
  file_exists competitive-analysis.md
  file_exists competitor-data.md
```

### 12.8 Content Migration Workflow

Migrates content from one format to another (e.g., Jekyll to Astro) with verification that all pages convert.

```prompt-language
Goal: Migrate blog posts from Jekyll to Astro format

flow:
  let posts = run "find _posts/ -name '*.md' -type f 2>/dev/null | sort"
  let post_count = run "find _posts/ -name '*.md' -type f 2>/dev/null | wc -l"

  # Create output directory
  run: mkdir -p src/content/blog

  foreach post in ${posts} max 50
    prompt: Convert ${post} from Jekyll format to Astro content collection format. Preserve all frontmatter fields. Convert Jekyll-specific liquid tags to Astro equivalents. Save to src/content/blog/ with the same filename.
  end

  # Verify counts match
  let migrated_count = run "find src/content/blog/ -name '*.md' -type f | wc -l"
  if ${migrated_count} != ${post_count}
    prompt: Only ${migrated_count} of ${post_count} posts were migrated. Find and migrate the missing ones.
  end

  # Validate frontmatter
  run: npx astro check 2>&1; true

done when:
  gate all_migrated: test $(find src/content/blog/ -name '*.md' -type f | wc -l) -ge $(find _posts/ -name '*.md' -type f | wc -l)
```

### 12.9 API Exploration and Documentation

Explores an API by making test requests, capturing responses, and generating documentation from the actual behavior.

````prompt-language
Goal: Document an API by exploring its endpoints

flow:
  let endpoints = []

  # Discover routes from source code
  let routes = run "grep -rn 'router\.\(get\|post\|put\|delete\)' src/routes/ --include='*.ts' -h | sed 's/.*router\.//' | head -20"

  # Start the server
  run: npm start & sleep 3

  # Test each discovered endpoint
  let health = run "curl -s -w '\n%{http_code}' http://localhost:3000/health"
  let endpoints += "GET /health -> ${health}"

  let get_root = run "curl -s -w '\n%{http_code}' http://localhost:3000/api"
  let endpoints += "GET /api -> ${get_root}"

  let post_test = run "curl -s -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' -d '{\"test\":true}' http://localhost:3000/api"
  let endpoints += "POST /api -> ${post_test}"

  # Stop the server
  run: kill $(lsof -t -i:3000) 2>/dev/null; true

  # Generate docs
  prompt: Write api-docs.md documenting this API. Routes from source: ${routes}. Live test results: ${endpoints}. Include request/response examples from the actual responses.

done when:
  file_exists api-docs.md
  gate has_examples: grep -c "```" api-docs.md | xargs test 3 -le
````

### 12.10 Chaos Engineering Experiment

Introduces controlled failures and verifies the system recovers, documenting resilience gaps.

```prompt-language
Goal: Run chaos engineering experiments and document findings

flow:
  let results = []

  # Experiment 1: Kill a dependency
  prompt: Write a test in chaos/test-db-down.js that simulates database connection failure and verifies the API returns proper error responses (503, not 500 or crash).
  run: node chaos/test-db-down.js
  let results += "DB down test: exit ${last_exit_code}"

  # Experiment 2: Slow network
  prompt: Write chaos/test-slow-network.js that adds 2-second latency to outbound HTTP calls and verifies timeouts trigger correctly.
  run: node chaos/test-slow-network.js timeout 30
  let results += "Slow network test: exit ${last_exit_code}"

  # Experiment 3: Disk full simulation
  prompt: Write chaos/test-disk-full.js that mocks fs.writeFile to throw ENOSPC and verifies the app handles it gracefully.
  run: node chaos/test-disk-full.js
  let results += "Disk full test: exit ${last_exit_code}"

  # Generate resilience report
  prompt: Write chaos-report.md summarizing all experiments. Results: ${results}. For each failure, recommend a fix.

  # Fix any issues found
  if command_failed
    prompt: Some chaos tests failed. Implement the resilience improvements recommended in the report.
  end

done when:
  file_exists chaos-report.md
  gate chaos_pass: node chaos/test-db-down.js && node chaos/test-slow-network.js && node chaos/test-disk-full.js
```

**Why this works:** The gate runs all three chaos tests together. The system must handle database failure, network latency, and disk exhaustion simultaneously, not just whichever one the agent happened to fix last.

### 12.11 Learning Path Generator

Creates a structured learning path by building progressively harder exercises and verifying each one compiles and runs.

```prompt-language
Goal: Generate a TypeScript learning path with working exercises

flow:
  run: mkdir -p exercises

  foreach level in "beginner intermediate advanced" max 3
    # Generate exercise
    prompt: Create exercises/${level}.ts with 3 TypeScript exercises at the ${level} level. Each exercise should be a function stub with a comment explaining the task, followed by a test that validates the solution. Include the solutions in exercises/${level}-solution.ts.

    # Verify exercise compiles
    run: npx tsc --noEmit exercises/${level}.ts 2>&1
    if command_failed
      prompt: The ${level} exercise file has TypeScript errors. Fix them.
      retry max 2
        run: npx tsc --noEmit exercises/${level}.ts
      end
    end

    # Verify solution passes
    run: npx tsx exercises/${level}-solution.ts
    if command_failed
      prompt: The ${level} solution does not run correctly. Fix it.
    end
  end

  prompt: Write exercises/README.md with an overview of the learning path and instructions for each level.

done when:
  file_exists exercises/beginner.ts
  file_exists exercises/intermediate.ts
  file_exists exercises/advanced.ts
  file_exists exercises/README.md
  gate solutions_run: npx tsx exercises/beginner-solution.ts && npx tsx exercises/intermediate-solution.ts && npx tsx exercises/advanced-solution.ts
```

### 12.12 Automated Changelog from Git History

Parses git history, categorizes changes, and generates a structured changelog with verification.

```prompt-language
Goal: Generate a categorized changelog from git history

flow:
  let last_tag = run "git describe --tags --abbrev=0 2>/dev/null || echo 'HEAD~50'"
  let commits = run "git log ${last_tag}..HEAD --oneline --no-merges"
  let authors = run "git log ${last_tag}..HEAD --format='%aN' | sort -u"
  let file_changes = run "git diff --stat ${last_tag}..HEAD | tail -1"

  prompt: Parse these commits and categorize them: ${commits}. Categories are: Features, Bug Fixes, Performance, Documentation, Chores. Write CHANGELOG-draft.md with the categorized entries. Include the contributor list: ${authors}. Stats: ${file_changes}.

  # Verify completeness
  let commit_count = run "git log ${last_tag}..HEAD --oneline --no-merges | wc -l"
  let changelog_entries = run "grep -c '^- ' CHANGELOG-draft.md 2>/dev/null || echo 0"

  if ${changelog_entries} < ${commit_count}
    prompt: The changelog has ${changelog_entries} entries but there are ${commit_count} commits. Account for every commit -- group related commits into single entries if needed, but do not drop any.
  end

done when:
  file_exists CHANGELOG-draft.md
  gate all_commits_covered: test $(grep -c '^- ' CHANGELOG-draft.md) -ge $(git log $(git describe --tags --abbrev=0 2>/dev/null || echo 'HEAD~50')..HEAD --oneline --no-merges | wc -l)
```

### Debate: Creative and Unexpected Uses

**When to use these patterns.** The creative applications work best when two conditions hold: (1) there is a natural sequence of steps that benefit from enforcement, and (2) there exists at least one verifiable completion condition. Incident response (12.2) is a standout because the gate (`curl` the health endpoint) is trivially verifiable and the consequence of premature "I fixed it" is severe. Content migration (12.8) works because you can count files. Tutorial generation (12.4) works because you can run the code examples.

**When to avoid them.** These patterns break down when the verification is inherently subjective. "Write a good blog post" has no gate. "Make the architecture document clear" requires human judgment. You can approximate with structural checks (12.3 checks for sections and mermaid diagrams), but the gate only verifies structure, not quality. If the main value of the task is subjective quality, prompt-language adds overhead without enforcement value.

**Common mistakes.** The biggest trap in creative uses is over-specifying the flow. An onboarding checklist (12.1) with 30 steps is brittle -- if any step fails for an environment-specific reason, the entire flow stalls. Keep creative flows short (5-10 steps) and use gates for the critical checkpoints rather than trying to micro-manage every action. Another mistake: using `foreach` to iterate over items that require different handling. If each blog post needs unique migration logic, `foreach` with a generic prompt produces generic results. Use explicit steps for items that need distinct treatment.

**Surprising insights.** The chaos engineering example (12.10) reveals something non-obvious: prompt-language is good at generating and then verifying adversarial test code. The agent writes a test designed to break the system, runs it, and then fixes the system to survive it. The flow enforces that "fix" means "the chaos test actually passes now," not "I added a TODO comment." This adversarial pattern -- generate the attack, then survive it -- is uniquely well-suited to the DSL's verify-or-keep-going loop. It turns prompt-language into a tool for improving system resilience, which is far from its original design intent of enforcing code quality.
