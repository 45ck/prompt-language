# Hypotheses v4: Agentic Engineering Research

240 new hypotheses (H256-H495) across 6 domains, designed to explore
the boundaries of gate enforcement, parallelism, reliability, DX,
language design, performance, and safety in prompt-language workflows.

## Quick Reference

| Domain                           | Range     | Count | Focus                                    |
| -------------------------------- | --------- | ----- | ---------------------------------------- |
| A: Parallelism & Concurrency     | H256-H295 | 40    | spawn/await, race conditions, barriers   |
| B: Reliability & Fault Tolerance | H296-H335 | 40    | retry strategies, checkpointing, capture |
| C: Developer Experience          | H336-H375 | 40    | observability, diagnostics, ergonomics   |
| D: Language Design               | H376-H415 | 40    | composability, type safety, constraints  |
| E: Performance & Cost            | H416-H455 | 40    | context reduction, caching, efficiency   |
| F: Safety & Real-World           | H456-H495 | 40    | security, code quality, production use   |

---

## Domain A: Parallelism & Concurrency (H256-H295)

### H256: Gate enforcement with spawn/await

- **Hypothesis**: Plugin with spawn+await+gate outperforms vanilla on multi-module tasks
- **Test**: Create 2 interdependent JS modules (utils.js, app.js) with bugs in each. Gate: `node test.js` passes for both.
- **Expected**: PLUGIN_WINS — gate catches cross-module regressions
- **Complexity**: MED

### H257: Parallel file generation via spawn

- **Hypothesis**: spawn produces all required files faster than sequential vanilla prompts
- **Test**: Goal: generate 4 independent config files (nginx.conf, docker-compose.yml, Makefile, .env.example). Spawn 4 workers, await all.
- **Expected**: PLUGIN_WINS — parallel generation completes in wall-clock time of longest single task
- **Complexity**: MED

### H258: Fan-out/fan-in test suite

- **Hypothesis**: Spawning separate workers per test file then awaiting all catches more regressions than a single pass
- **Test**: 3 test files covering 3 modules. Spawn a fixer per module, await all, gate on full test suite.
- **Expected**: PLUGIN_WINS — focused workers fix each module independently
- **Complexity**: HIGH

### H259: Race condition detection via spawn

- **Hypothesis**: Two spawned workers editing the same file produce a detectable conflict that the gate catches
- **Test**: Spawn two workers both told to edit shared.js. Gate: `node test.js`. Expect gate to force resolution.
- **Expected**: PLUGIN_WINS — gate ensures final merged state is correct
- **Complexity**: HIGH

### H260: Spawn with variable inheritance

- **Hypothesis**: Parent variables passed to child via spawn improve child task completion
- **Test**: Parent sets `let api_version = "v2"`, spawns child to generate code using `${api_version}`. Gate: output uses v2 API.
- **Expected**: PLUGIN_WINS — variable inheritance provides context vanilla lacks
- **Complexity**: MED

### H261: Await with variable import

- **Hypothesis**: await imports child variables back to parent for downstream use
- **Test**: Spawn child that runs `let result = run "node compute.js"`. Parent awaits, then uses `${child.result}` in a subsequent prompt.
- **Expected**: PLUGIN_WINS — cross-process data flow enables multi-stage pipelines
- **Complexity**: HIGH

### H262: Concurrent module scaffolding

- **Hypothesis**: Spawning workers for frontend and backend simultaneously is faster than sequential
- **Test**: Spawn "frontend" (create React component) and "backend" (create Express route). Await all. Gate: both files exist and pass lint.
- **Expected**: PLUGIN_WINS — parallelism reduces total time
- **Complexity**: MED

### H263: Spawn failure isolation

- **Hypothesis**: One failed spawn does not block sibling spawns from completing
- **Test**: Spawn 3 workers: 2 will succeed (create valid files), 1 will fail (impossible task). Await all. Gate: at least 2 output files exist.
- **Expected**: PLUGIN_WINS — failure isolation preserves partial results
- **Complexity**: MED

### H264: Barrier synchronization pattern

- **Hypothesis**: await all acts as a barrier, ensuring no downstream work begins until all spawns finish
- **Test**: Spawn 2 workers generating modules, then prompt uses both. Gate: integration test passes.
- **Expected**: PLUGIN_WINS — barrier prevents premature integration
- **Complexity**: HIGH

### H265: Spawn with foreach fan-out

- **Hypothesis**: foreach + spawn creates parallel workers per item more effectively than vanilla loop instructions
- **Test**: `foreach lang in "js py sh"` with spawn per language generating a hello-world. Gate: all 3 files exist and run.
- **Expected**: PLUGIN_WINS — structured fan-out outperforms ad-hoc instructions
- **Complexity**: HIGH

### H266: Sequential spawn dependency chain

- **Hypothesis**: Spawn A, await A, then spawn B (using A's output) creates reliable multi-stage pipelines
- **Test**: Spawn "schema-gen" to produce schema.json, await it, then spawn "code-gen" to produce code from schema. Gate: code compiles.
- **Expected**: PLUGIN_WINS — explicit dependency ordering prevents race conditions
- **Complexity**: HIGH

### H267: Parallel test execution via spawn

- **Hypothesis**: Spawning separate test runners per module reduces total verification time
- **Test**: 3 modules with independent test files. Spawn 3 `run: node test-{module}.js` workers. Await all.
- **Expected**: PLUGIN_WINS — parallel test runs surface failures faster
- **Complexity**: MED

### H268: Spawn with retry in child

- **Hypothesis**: Child processes using retry loops recover from transient failures independently
- **Test**: Spawn child with `retry max 3` around a flaky operation. Parent awaits. Gate: child output file exists.
- **Expected**: PLUGIN_WINS — child-level retry handles transient failures without parent intervention
- **Complexity**: MED

### H269: Competing spawn strategies

- **Hypothesis**: Two spawns attempting the same task with different strategies, first-success-wins
- **Test**: Spawn "approach-a" (regex-based fix) and "approach-b" (rewrite-based fix) for a bug. Await all. Gate: test passes.
- **Expected**: PLUGIN_WINS — redundant approaches increase success probability
- **Complexity**: HIGH

### H270: Spawn resource contention on package.json

- **Hypothesis**: Multiple spawns modifying package.json create conflicts that gate catches
- **Test**: Spawn "add-lodash" and "add-express" both editing package.json. Gate: `npm install && node test.js`.
- **Expected**: PLUGIN_WINS — gate ensures final package.json is valid
- **Complexity**: HIGH

### H271: Await timeout behavior

- **Hypothesis**: Plugin handles long-running spawned children gracefully with await
- **Test**: Spawn a child that does complex work (generate + test a module). Await with generous timeout. Gate: output file exists.
- **Expected**: PLUGIN_WINS — structured await is more reliable than vanilla time management
- **Complexity**: MED

### H272: Parallel documentation generation

- **Hypothesis**: Spawning doc writers per module produces consistent docs faster
- **Test**: 3 JS modules. Spawn a doc writer per module. Await all. Gate: all 3 README-{module}.md files exist.
- **Expected**: PLUGIN_WINS — parallel doc generation with existence gate
- **Complexity**: LOW

### H273: Spawn with conditional child logic

- **Hypothesis**: Children using if/else based on inherited variables take correct branches
- **Test**: Parent sets `let env = "production"`. Spawn child with `if` checking `${env}`. Gate: child output matches production config.
- **Expected**: PLUGIN_WINS — variable-driven conditional logic in children
- **Complexity**: MED

### H274: Multi-file atomic update via spawn+gate

- **Hypothesis**: Spawning workers for related files with a unified gate ensures consistency
- **Test**: Spawn workers to update API handler and its test. Gate: `node test.js`. Both must agree.
- **Expected**: PLUGIN_WINS — unified gate prevents partial updates
- **Complexity**: MED

### H275: Spawn count scaling (2 vs 4 workers)

- **Hypothesis**: 4 parallel spawns complete a 4-module project faster than 2 sequential pairs
- **Test**: 4 independent modules. Compare spawn-2+await+spawn-2 vs spawn-4+await-all.
- **Expected**: PLUGIN_WINS — higher parallelism reduces wall clock time
- **Complexity**: HIGH

### H276: Spawn with shared test infrastructure

- **Hypothesis**: Spawned workers sharing a test harness (common test-utils.js) produce compatible code
- **Test**: Create test-utils.js with helpers. Spawn 2 workers writing modules that use test-utils. Gate: all tests pass.
- **Expected**: PLUGIN_WINS — shared infra + gate ensures compatibility
- **Complexity**: MED

### H277: Concurrent refactor of coupled files

- **Hypothesis**: Spawning refactors for coupled files with integration gate catches breakage
- **Test**: Two files that import each other. Spawn rename-refactor workers for each. Gate: `node integration-test.js`.
- **Expected**: PLUGIN_WINS — gate catches interface mismatches from parallel refactors
- **Complexity**: HIGH

### H278: Spawn for database migration + app update

- **Hypothesis**: Parallel migration script generation and app code update with gate ensures compatibility
- **Test**: Spawn "migration" (SQL schema update) and "app" (JS model update). Gate: both files are syntactically valid.
- **Expected**: PLUGIN_WINS — parallel generation with validation gate
- **Complexity**: MED

### H279: Await selective (named child only)

- **Hypothesis**: Awaiting a specific named child allows other children to continue independently
- **Test**: Spawn "critical" and "optional". Await "critical" only. Gate: critical output exists. Optional may still be running.
- **Expected**: PLUGIN_WINS — selective await enables prioritized workflows
- **Complexity**: MED

### H280: Spawn with error forwarding

- **Hypothesis**: Child errors (command_failed) are visible to parent after await for diagnostic use
- **Test**: Spawn child with intentional run failure. Parent awaits and checks `${child.command_failed}`. Gate: parent handles error.
- **Expected**: PLUGIN_WINS — error visibility across process boundary
- **Complexity**: HIGH

### H281: Parallel API endpoint generation

- **Hypothesis**: Spawning workers per REST endpoint produces consistent API faster than serial prompts
- **Test**: 3 endpoints (GET /users, POST /users, DELETE /users/:id). Spawn per endpoint. Gate: all route files exist + test passes.
- **Expected**: PLUGIN_WINS — parallel endpoint generation with integration gate
- **Complexity**: MED

### H282: Spawn with parent-level retry

- **Hypothesis**: Parent retrying the entire spawn/await cycle recovers from child failures
- **Test**: `retry max 2` around spawn+await block. First attempt child fails, retry succeeds. Gate: output exists.
- **Expected**: PLUGIN_WINS — compositional retry at parent level
- **Complexity**: HIGH

### H283: Concurrent test and lint via spawn

- **Hypothesis**: Running tests and linting in parallel catches both categories of issues simultaneously
- **Test**: Spawn "tester" (run tests) and "linter" (run lint). Await all. Gate: `tests_pass` and `lint_pass`.
- **Expected**: PLUGIN_WINS — parallel quality checks vs sequential vanilla approach
- **Complexity**: MED

### H284: Spawn ordering independence

- **Hypothesis**: Spawn execution order does not affect final outcome when tasks are independent
- **Test**: Spawn A, B, C in that order. Swap to C, A, B. Both produce same results. Gate: all outputs match spec.
- **Expected**: TIE — order independence is a correctness property
- **Complexity**: LOW

### H285: Nested spawn (child spawns grandchild)

- **Hypothesis**: A spawned child can itself spawn a grandchild for hierarchical decomposition
- **Test**: Parent spawns "builder" which spawns "compiler". Gate: compiled output exists at top level.
- **Expected**: PLUGIN_WINS — hierarchical task decomposition
- **Complexity**: HIGH

### H286: Spawn with file_exists gate per child

- **Hypothesis**: Per-child file existence gates ensure each spawn produced its required output
- **Test**: Spawn 3 workers, each must produce a specific file. Gate: `file_exists output-a.js` AND `file_exists output-b.js` AND `file_exists output-c.js`.
- **Expected**: PLUGIN_WINS — granular file existence verification
- **Complexity**: MED

### H287: Parallel bug fix across test files

- **Hypothesis**: Spawning a fixer per failing test file resolves all failures faster than sequential fixing
- **Test**: 3 test files, each testing a different buggy module. Spawn fixer per module. Gate: all tests pass.
- **Expected**: PLUGIN_WINS — parallel fix attempts reduce total resolution time
- **Complexity**: MED

### H288: Spawn with foreach and await all

- **Hypothesis**: foreach-driven spawn + await all is a reliable fan-out pattern
- **Test**: `foreach module in "auth db api"` spawns a worker per module. Await all. Gate: all module files exist.
- **Expected**: PLUGIN_WINS — declarative fan-out with barrier
- **Complexity**: MED

### H289: Concurrent config file generation

- **Hypothesis**: Spawning generators for tsconfig, eslint, prettier configs in parallel produces consistent configs
- **Test**: Spawn 3 workers for each config file. Gate: all files are valid JSON/YAML and `npx tsc --noEmit` passes.
- **Expected**: PLUGIN_WINS — parallel config generation with type-check gate
- **Complexity**: MED

### H290: Spawn with try/catch in child

- **Hypothesis**: Child using try/catch handles its own errors without failing the parent
- **Test**: Child has `try` block with risky operation and `catch` block with fallback. Parent awaits. Gate: child output is valid.
- **Expected**: PLUGIN_WINS — error containment within child process
- **Complexity**: MED

### H291: Parallel unit and integration test runners

- **Hypothesis**: Spawning separate unit and integration test runners catches more issues than a single test run
- **Test**: Unit tests in test/unit.js, integration tests in test/integration.js. Spawn runner per suite. Gate: both pass.
- **Expected**: PLUGIN_WINS — parallel test taxonomy enforcement
- **Complexity**: MED

### H292: Spawn for cross-platform script generation

- **Hypothesis**: Spawning workers for bash and PowerShell versions of a script ensures both are correct
- **Test**: Spawn "bash-writer" and "ps-writer". Gate: `bash deploy.sh --dry-run` and `pwsh deploy.ps1 -DryRun` both exit 0.
- **Expected**: PLUGIN_WINS — parallel cross-platform generation with per-platform gates
- **Complexity**: HIGH

### H293: Await with variable chain to next stage

- **Hypothesis**: await imports child variables that drive subsequent flow logic
- **Test**: Spawn child that sets `let status = run "node check.js"`. Parent awaits, then `if ${child.status} == "ready"` proceeds. Gate: final output exists.
- **Expected**: PLUGIN_WINS — cross-process variable-driven control flow
- **Complexity**: HIGH

### H294: Parallel CSS and JS generation

- **Hypothesis**: Spawning CSS and JS generation in parallel with a unified gate produces a working page
- **Test**: Spawn "css-worker" (generate styles.css) and "js-worker" (generate app.js). Gate: index.html references both and page renders.
- **Expected**: PLUGIN_WINS — parallel asset generation with integration check
- **Complexity**: MED

### H295: Spawn determinism across runs

- **Hypothesis**: The same spawn+await flow produces consistent results across multiple runs
- **Test**: Run the same spawn-2-workers+gate flow 5 times. Measure pass rate consistency.
- **Expected**: TIE — determinism is a reliability baseline, not an advantage
- **Complexity**: LOW

---

## Domain B: Reliability & Fault Tolerance (H296-H335)

### H296: Retry with increasing context

- **Hypothesis**: retry loop where each iteration adds more diagnostic info to the prompt improves fix rate
- **Test**: Buggy app.js. `retry max 3` with `run: node test.js`, `if command_failed` prompt includes `${last_stderr}`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — structured error feedback loop outperforms one-shot vanilla
- **Complexity**: MED

### H297: Retry max 1 as single-attempt guard

- **Hypothesis**: `retry max 1` acts as a run-once-then-check pattern, catching immediate failures
- **Test**: Buggy script. `retry max 1` with `run: node app.js`. Gate: exit code 0.
- **Expected**: PLUGIN_WINS — structured check is more reliable than vanilla hope
- **Complexity**: LOW

### H298: Retry max 5 for flaky tests

- **Hypothesis**: `retry max 5` handles flaky tests better than vanilla's single attempt
- **Test**: Test file with a 50% random pass rate (Math.random). `retry max 5` with `run: node test.js`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — multiple attempts overcome flakiness
- **Complexity**: LOW

### H299: Retry with progressive fix strategy

- **Hypothesis**: Each retry iteration prompt escalates fix strategy (typo fix, logic fix, rewrite)
- **Test**: Complex buggy function. retry max 3: iteration 1 "fix typos", iteration 2 "fix logic", iteration 3 "rewrite function". Gate: tests pass.
- **Expected**: PLUGIN_WINS — escalating fix strategy covers more failure modes
- **Complexity**: MED

### H300: Try/catch for graceful degradation

- **Hypothesis**: try/catch produces a fallback when the primary approach fails
- **Test**: `try` block attempts complex optimization. `catch` block writes simple working version. Gate: tests pass.
- **Expected**: PLUGIN_WINS — fallback guarantees a working output
- **Complexity**: MED

### H301: Try/catch/finally for cleanup

- **Hypothesis**: finally block ensures cleanup runs regardless of try/catch outcome
- **Test**: `try` creates temp files + runs risky operation. `finally` cleans up temps. Gate: no temp files remain and output is correct.
- **Expected**: PLUGIN_WINS — guaranteed cleanup via finally
- **Complexity**: MED

### H302: Nested retry inside try/catch

- **Hypothesis**: retry inside try with catch fallback provides maximum resilience
- **Test**: `try` block contains `retry max 3` around bugfix. `catch` block provides known-good fallback. Gate: tests pass.
- **Expected**: PLUGIN_WINS — layered fault tolerance
- **Complexity**: HIGH

### H303: Checkpoint via let after each stage

- **Hypothesis**: Capturing intermediate results in variables enables recovery from later-stage failures
- **Test**: `let stage1 = run "node step1.js"`, `let stage2 = run "node step2.js"`. If stage2 fails, prompt uses `${stage1}` for context. Gate: all stages pass.
- **Expected**: PLUGIN_WINS — variable checkpoints preserve progress
- **Complexity**: MED

### H304: Capture prompt for error diagnosis

- **Hypothesis**: `let diagnosis = prompt "What went wrong?"` after a failure gives the agent structured error context
- **Test**: Run fails. `let error = "${last_stderr}"`. `let diagnosis = prompt "Analyze this error: ${error}"`. Next prompt uses `${diagnosis}` to fix. Gate: tests pass.
- **Expected**: PLUGIN_WINS — structured diagnosis loop improves fix quality
- **Complexity**: MED

### H305: Idempotent run verification

- **Hypothesis**: Running a fix operation twice (via retry) produces the same correct result
- **Test**: `retry max 2` where the fix is applied, then `run: node test.js` verifies. Second run should still pass. Gate: tests pass.
- **Expected**: PLUGIN_WINS — idempotency verification through retry
- **Complexity**: LOW

### H306: Error chain tracking via variables

- **Hypothesis**: Accumulating errors in a list variable across retries provides better diagnostic context
- **Test**: `let errors = []`. `retry max 3`: `run: node test.js`, `if command_failed` then `let errors += "${last_stderr}"`. Final prompt sees all prior errors. Gate: tests pass.
- **Expected**: PLUGIN_WINS — error history enables root-cause analysis
- **Complexity**: MED

### H307: While loop with convergence condition

- **Hypothesis**: `while max 5` with condition checking a convergence metric iterates until quality threshold is met
- **Test**: Code quality score. `while max 5` condition `${quality} < 80`. Each iteration improves code, runs scorer. Gate: quality >= 80.
- **Expected**: PLUGIN_WINS — convergence loop outperforms single-shot vanilla
- **Complexity**: MED

### H308: Until loop for test-pass convergence

- **Hypothesis**: `until max 10` with `command_succeeded` condition loops until tests pass
- **Test**: Buggy app. `until max 10` condition `command_succeeded`. Body: `prompt: fix the bug`, `run: node test.js`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — structured convergence loop
- **Complexity**: MED

### H309: Retry with stderr-driven prompts

- **Hypothesis**: Feeding `${last_stderr}` into the fix prompt on each retry iteration improves convergence
- **Test**: `retry max 3`: `run: node test.js`, `if command_failed`: `prompt: Fix based on error: ${last_stderr}`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — error-directed fixing outperforms blind retries
- **Complexity**: MED

### H310: Try/catch with different strategies

- **Hypothesis**: try block uses approach A, catch block uses approach B, covering more solution space
- **Test**: `try`: `prompt: Fix using regex replacement`, `run: node test.js`. `catch`: `prompt: Rewrite the function from scratch`, `run: node test.js`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — strategy diversification via try/catch
- **Complexity**: MED

### H311: Retry with exit code routing

- **Hypothesis**: Different exit codes trigger different fix strategies within a retry loop
- **Test**: `retry max 3`: `run: node test.js`, `if ${last_exit_code} == 1` (test fail) prompt: fix logic. `if ${last_exit_code} == 2` (syntax) prompt: fix syntax. Gate: tests pass.
- **Expected**: PLUGIN_WINS — exit-code-driven routing improves fix precision
- **Complexity**: HIGH

### H312: Capture variable for multi-stage pipeline

- **Hypothesis**: `let x = run "cmd"` captures output for use in subsequent stages, reducing context loss
- **Test**: `let schema = run "node extract-schema.js"`. `prompt: Generate validators for this schema: ${schema}`. Gate: `node validate-schema.js` passes.
- **Expected**: PLUGIN_WINS — captured output bridges pipeline stages
- **Complexity**: MED

### H313: While loop for iterative refinement

- **Hypothesis**: `while max 5` with quality check iteratively improves code until it meets a threshold
- **Test**: Function with poor performance. `while max 5` condition `command_failed`: run benchmark, if slow prompt to optimize. Gate: benchmark passes threshold.
- **Expected**: PLUGIN_WINS — iterative refinement loop
- **Complexity**: MED

### H314: Retry with rollback on failure

- **Hypothesis**: Saving a backup before each retry attempt enables rollback to last-known-good state
- **Test**: `let backup = run "cat app.js"`. `retry max 3`: attempt fix, test. On failure, restore from `${backup}` equivalent. Gate: tests pass.
- **Expected**: PLUGIN_WINS — rollback prevents cascading damage from bad fix attempts
- **Complexity**: HIGH

### H315: Foreach with per-item error handling

- **Hypothesis**: `foreach` with `try/catch` per item processes all items even when some fail
- **Test**: `foreach file in "a.js b.js c.js"`: `try`: fix file, run test. `catch`: log error, continue. Gate: at least 2 of 3 tests pass.
- **Expected**: PLUGIN_WINS — per-item fault tolerance
- **Complexity**: MED

### H316: Recovery from corrupted output

- **Hypothesis**: If a run produces corrupted output, retry with explicit cleanup recovers
- **Test**: First attempt generates malformed JSON. `retry max 2`: `run: node validate.js`, `if command_failed`: `prompt: The JSON is malformed, regenerate it`. Gate: valid JSON.
- **Expected**: PLUGIN_WINS — structured recovery from corruption
- **Complexity**: MED

### H317: Multi-file consistency gate after recovery

- **Hypothesis**: After error recovery, a consistency gate ensures all files agree
- **Test**: Fix module A (recovers from error). Fix module B (succeeds first try). Gate: integration test checking both modules passes.
- **Expected**: PLUGIN_WINS — post-recovery consistency verification
- **Complexity**: MED

### H318: Exponential backoff via while loop counter

- **Hypothesis**: While loop with sleep-like delays between retries handles rate-limited operations better
- **Test**: `while max 4` with `run: node call-api.js`, `if command_failed` prompt: wait and retry. Gate: API call succeeds.
- **Expected**: PLUGIN_WINS — structured retry with backoff
- **Complexity**: MED

### H319: Let variable as progress marker

- **Hypothesis**: Setting `let stage = "step-N"` at each pipeline stage enables progress tracking and recovery
- **Test**: Multi-step pipeline. Each step sets `let stage = "step-X"`. On failure, prompt references `${stage}` for context. Gate: final step completes.
- **Expected**: PLUGIN_WINS — progress-aware error recovery
- **Complexity**: MED

### H320: Try with finally for state reset

- **Hypothesis**: finally block resets global state (env vars, temp files) regardless of try/catch outcome
- **Test**: `try`: modify config, run tests. `finally`: restore original config. Gate: tests pass AND original config is restored.
- **Expected**: PLUGIN_WINS — guaranteed state reset prevents side effects
- **Complexity**: MED

### H321: Catch block with different language model

- **Hypothesis**: catch block prompt phrasing a different approach after try block failure improves success rate
- **Test**: `try`: `prompt: Fix with minimal changes`. `catch`: `prompt: Rewrite the entire function from scratch`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — diversified approach on failure
- **Complexity**: MED

### H322: Nested foreach with retry per item

- **Hypothesis**: foreach items with retry inside handles per-item failures robustly
- **Test**: `foreach module in "auth db api"`: `retry max 2`: fix module, run its tests. Gate: all module tests pass.
- **Expected**: PLUGIN_WINS — per-item retry within iteration
- **Complexity**: HIGH

### H323: While loop exit on success

- **Hypothesis**: `while max 5` with `command_failed` condition exits early when fix succeeds
- **Test**: Bug that's fixable in 1-2 attempts. `while max 5` condition `command_failed`: fix, test. Gate: tests pass. Measure iterations used.
- **Expected**: PLUGIN_WINS — early exit saves time vs vanilla's potential over-engineering
- **Complexity**: LOW

### H324: Retry with last_stdout inspection

- **Hypothesis**: Using `${last_stdout}` from a failed test run to guide the next fix attempt improves accuracy
- **Test**: Test outputs specific assertion failure. `retry max 3`: `run: node test.js`, `prompt: The test said: ${last_stdout}. Fix the code.` Gate: tests pass.
- **Expected**: PLUGIN_WINS — output-directed fixing
- **Complexity**: MED

### H325: Try/catch for dependency installation fallback

- **Hypothesis**: try block attempts npm install, catch block uses alternative dependency resolution
- **Test**: `try`: `run: npm install`. `catch`: `prompt: Install failed, fix package.json and retry`. Gate: `npm test` passes.
- **Expected**: PLUGIN_WINS — dependency failure recovery
- **Complexity**: MED

### H326: Foreach with break on first success

- **Hypothesis**: foreach + break exits early when first working solution is found
- **Test**: `foreach approach in "regex rewrite refactor"`: `run: node test.js`, `if command_succeeded`: `break`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — early termination on success
- **Complexity**: MED

### H327: Variable-driven retry budget

- **Hypothesis**: Tracking retry count in a variable enables dynamic strategy adjustment
- **Test**: `let attempts = "0"`. `retry max 5`: increment attempts, adjust prompt aggressiveness based on `${attempts}`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — adaptive retry strategy
- **Complexity**: MED

### H328: Catch block produces diagnostic report

- **Hypothesis**: catch block capturing error details into a variable produces actionable diagnostics
- **Test**: `try`: complex fix. `catch`: `let error_report = "${last_stderr}"`, `prompt: Analyze error report: ${error_report} and apply targeted fix`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — structured error analysis in catch
- **Complexity**: MED

### H329: Multi-gate convergence (tests AND lint)

- **Hypothesis**: Converging on both test and lint passing simultaneously requires more iterations but produces higher quality
- **Test**: Buggy + poorly formatted code. `retry max 5`: fix, run tests, run lint. Gate: `tests_pass` AND `lint_pass`.
- **Expected**: PLUGIN_WINS — dual-gate convergence produces correct and clean code
- **Complexity**: MED

### H330: While loop with diff_nonempty guard

- **Hypothesis**: `while max 3` with `diff_nonempty` condition ensures the agent keeps making changes until done
- **Test**: Multi-bug file. `while max 3` condition `diff_nonempty`: fix next bug, commit. Gate: all tests pass.
- **Expected**: PLUGIN_WINS — diff-driven iteration ensures progress
- **Complexity**: MED

### H331: Retry with file_exists precondition

- **Hypothesis**: Checking `file_exists` before running tests prevents "file not found" errors in retry loop
- **Test**: Agent must create file then test it. `retry max 3`: `if` not `file_exists output.js`: `prompt: create output.js`. `run: node test.js`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — precondition checking prevents wasted retries
- **Complexity**: MED

### H332: Checkpoint and restore via variable snapshot

- **Hypothesis**: Saving file contents to variables before risky operations enables precise rollback
- **Test**: `let original = run "cat app.js"`. Attempt risky refactor. If tests fail, restore from captured content. Gate: tests pass.
- **Expected**: PLUGIN_WINS — variable-based checkpoint/restore
- **Complexity**: MED

### H333: Resilience to misleading error messages

- **Hypothesis**: Structured retry with error capture prevents the agent from being misled by red-herring error messages
- **Test**: App with misleading error message ("TypeError" when the real bug is a logic error). `retry max 3` with `${last_stderr}` context. Gate: tests pass.
- **Expected**: PLUGIN_WINS — structured iteration with error context overcomes misleading errors
- **Complexity**: HIGH

### H334: Try/catch with partial success preservation

- **Hypothesis**: If try block partially succeeds (2 of 3 tests), catch block fixes remaining test while preserving progress
- **Test**: 3-test file. `try`: fix all. `catch`: `prompt: 2 tests pass but 1 fails, fix only the failing test without breaking others`. Gate: all 3 pass.
- **Expected**: PLUGIN_WINS — partial success preservation in catch
- **Complexity**: HIGH

### H335: Cascade retry across dependent files

- **Hypothesis**: retry loop that re-tests after each file fix catches cascading failures
- **Test**: 3 files with cascading dependencies. `retry max 5`: fix file, run tests, if still failing fix next file. Gate: all tests pass.
- **Expected**: PLUGIN_WINS — cascade-aware retry handles dependency chains
- **Complexity**: HIGH

---

## Domain C: Developer Experience (H336-H375)

### H336: Flow visualization aids debugging

- **Hypothesis**: Rendered flow with `[*]` markers helps developers identify where execution is stuck
- **Test**: Multi-step flow. Verify renderFlow output includes execution position markers at correct steps.
- **Expected**: PLUGIN_WINS — visual progress indicator not available in vanilla
- **Complexity**: LOW

### H337: Variable state visibility

- **Hypothesis**: Variables displayed with `[= value]` annotations help developers understand state
- **Test**: Flow with `let x = "hello"`. Verify renderFlow shows `let x [= hello]` in output.
- **Expected**: PLUGIN_WINS — state visibility not available in vanilla
- **Complexity**: LOW

### H338: Error message clarity on parse failure

- **Hypothesis**: Plugin provides clearer error messages for malformed flow definitions than generic Claude errors
- **Test**: Malformed flow block (unclosed while). Verify error message identifies the parsing issue.
- **Expected**: PLUGIN_WINS — structured parsing provides better errors
- **Complexity**: LOW

### H339: Gate failure explanation

- **Hypothesis**: When a gate fails, the plugin provides context about why, aiding developer understanding
- **Test**: `done when: tests_pass`. Tests fail. Verify output includes gate evaluation result and stderr.
- **Expected**: PLUGIN_WINS — gate failure context aids debugging
- **Complexity**: LOW

### H340: Progress tracking through flow steps

- **Hypothesis**: Developers can see which flow step is currently executing via flow rendering
- **Test**: 5-step flow. At step 3, verify renderFlow shows steps 1-2 as completed and step 3 as active.
- **Expected**: PLUGIN_WINS — step-by-step progress tracking
- **Complexity**: LOW

### H341: Completed step annotation

- **Hypothesis**: Completed steps show their results in the flow rendering, providing execution history
- **Test**: `run: node --version`. After execution, verify renderFlow shows the run node with completion annotation.
- **Expected**: PLUGIN_WINS — execution history in flow visualization
- **Complexity**: LOW

### H342: Lint-flow catches common mistakes

- **Hypothesis**: `lintFlow()` detecting anti-patterns (empty bodies, break outside loop) prevents runtime errors
- **Test**: Flow with empty while body. Verify lint warning is produced before execution.
- **Expected**: PLUGIN_WINS — static analysis catches issues early
- **Complexity**: LOW

### H343: Flow complexity score guides simplification

- **Hypothesis**: `flowComplexityScore()` helping developers gauge flow complexity leads to better-structured flows
- **Test**: Complex flow (nested retry + foreach + if). Verify complexity score > 3 signals need for simplification.
- **Expected**: PLUGIN_WINS — complexity feedback not available in vanilla
- **Complexity**: LOW

### H344: Variable interpolation feedback

- **Hypothesis**: Seeing `${varName}` resolved in rendered prompts confirms correct variable wiring
- **Test**: `let name = "world"`, `prompt: Hello ${name}`. Verify rendered prompt shows "Hello world".
- **Expected**: PLUGIN_WINS — interpolation confirmation
- **Complexity**: LOW

### H345: Unknown variable preservation

- **Hypothesis**: Unknown variables left as-is (`${unknown}`) rather than silently dropping helps identify wiring bugs
- **Test**: `prompt: Hello ${nonexistent}`. Verify output contains literal `${nonexistent}`.
- **Expected**: PLUGIN_WINS — explicit unknown variable handling
- **Complexity**: LOW

### H346: Run node auto-execution visibility

- **Hypothesis**: Developers see run nodes auto-execute without manual intervention, understanding the flow progression
- **Test**: `run: echo "hello"`. Verify output shows auto-execution and result without requiring user interaction.
- **Expected**: PLUGIN_WINS — auto-execution visibility
- **Complexity**: LOW

### H347: If/else branch taken indicator

- **Hypothesis**: Flow rendering shows which branch (then vs else) was taken in an if/else node
- **Test**: `if command_succeeded` after a passing run. Verify renderFlow indicates then-branch was taken.
- **Expected**: PLUGIN_WINS — branch decision visibility
- **Complexity**: LOW

### H348: Foreach iteration counter

- **Hypothesis**: Seeing which iteration of a foreach loop is currently executing aids debugging
- **Test**: `foreach item in "a b c"`. During iteration 2, verify render shows current item context.
- **Expected**: PLUGIN_WINS — iteration progress visibility
- **Complexity**: LOW

### H349: Gate predicate list as checklist

- **Hypothesis**: `done when:` section acts as a visible checklist of completion criteria
- **Test**: Multi-gate: `tests_pass`, `file_exists output.js`. Verify both are displayed as criteria.
- **Expected**: PLUGIN_WINS — explicit completion criteria visibility
- **Complexity**: LOW

### H350: Spawn status tags in rendering

- **Hypothesis**: `[running]`, `[completed]`, `[failed]` tags on spawn nodes give clear child process status
- **Test**: Spawn a child, verify renderFlow shows appropriate status tag during and after execution.
- **Expected**: PLUGIN_WINS — process status visibility
- **Complexity**: MED

### H351: Prompt node focusing agent attention

- **Hypothesis**: Explicit `prompt:` nodes focus the agent on one task at a time, reducing scope creep
- **Test**: Multi-step task. Plugin flow: separate prompts per step. Vanilla: single large prompt. Score: per-step completion rate.
- **Expected**: PLUGIN_WINS — focused prompts reduce scope creep
- **Complexity**: MED

### H352: Let node as documentation

- **Hypothesis**: `let purpose = "validate API responses"` at flow start serves as self-documenting context
- **Test**: Flow with descriptive let variables. Assess whether the agent's actions align with the documented purpose.
- **Expected**: PLUGIN_WINS — self-documenting flows
- **Complexity**: LOW

### H353: Error recovery guidance via structured prompts

- **Hypothesis**: Plugin flows with error-specific prompts guide the agent better than vanilla's generic approach
- **Test**: After `command_failed`, `prompt: The error was: ${last_stderr}. Fix only the relevant function.` vs vanilla: "fix the error".
- **Expected**: PLUGIN_WINS — structured error context improves fix accuracy
- **Complexity**: MED

### H354: Multi-file project navigation via flow steps

- **Hypothesis**: Explicit flow steps per file help the agent navigate multi-file projects systematically
- **Test**: 4-file project. Plugin: `prompt: Fix auth.js`, `prompt: Fix db.js`, etc. Vanilla: "Fix all files". Gate: all tests pass.
- **Expected**: PLUGIN_WINS — systematic file-by-file navigation
- **Complexity**: MED

### H355: While loop iteration count as progress metric

- **Hypothesis**: Knowing "iteration 3 of 5" helps developers estimate completion time
- **Test**: `while max 5` loop. Verify each iteration is distinguishable in output.
- **Expected**: PLUGIN_WINS — progress estimation not available in vanilla
- **Complexity**: LOW

### H356: Retry count as quality signal

- **Hypothesis**: A fix that required 3 retries is a signal for higher review priority than one requiring 1
- **Test**: Two bugs: easy (1 retry) and hard (3 retries). Compare retry count as complexity indicator.
- **Expected**: PLUGIN_WINS — retry count as quality metadata
- **Complexity**: LOW

### H357: Flow as communication tool between developers

- **Hypothesis**: A flow definition serves as a readable specification that other developers can understand
- **Test**: Complex flow with clear prompt and run nodes. Assess readability vs equivalent vanilla prompt.
- **Expected**: PLUGIN_WINS — structured flows are more readable than long prompts
- **Complexity**: LOW

### H358: Gate as acceptance criteria

- **Hypothesis**: `done when:` section explicitly encodes acceptance criteria, removing ambiguity
- **Test**: Task with vague vanilla prompt vs plugin with explicit `done when: tests_pass AND file_exists report.json`.
- **Expected**: PLUGIN_WINS — explicit criteria reduce ambiguity
- **Complexity**: LOW

### H359: Let-run for environment discovery

- **Hypothesis**: `let node_ver = run "node --version"` at flow start captures environment info for context
- **Test**: Flow starts with environment capture, uses version info in subsequent prompts. Gate: version-appropriate code generated.
- **Expected**: PLUGIN_WINS — environment-aware code generation
- **Complexity**: MED

### H360: Error stderr in prompt context

- **Hypothesis**: Including `${last_stderr}` in fix prompts gives the agent precise error context
- **Test**: Test with specific assertion failure. `prompt: Fix based on: ${last_stderr}`. Compare fix accuracy vs vanilla.
- **Expected**: PLUGIN_WINS — precise error context improves fix accuracy
- **Complexity**: MED

### H361: Flow step skip on success

- **Hypothesis**: `if command_succeeded` skipping unnecessary fix steps saves agent turns
- **Test**: If tests already pass, `if command_succeeded` skips fix prompt. Measure total turns vs vanilla.
- **Expected**: PLUGIN_WINS — conditional skip reduces unnecessary work
- **Complexity**: MED

### H362: Foreach progress visibility

- **Hypothesis**: Seeing "processing item 2 of 5" in foreach gives clear progress indication
- **Test**: `foreach file in "a b c d e"`. Verify each iteration is distinguishable in rendering.
- **Expected**: PLUGIN_WINS — iteration progress tracking
- **Complexity**: LOW

### H363: Variable chain debugging

- **Hypothesis**: Seeing all variable values in flow rendering helps debug complex variable chains
- **Test**: `let a = run "echo hello"`, `let b = "${a}_world"`. Verify both values visible in rendering.
- **Expected**: PLUGIN_WINS — variable chain visibility
- **Complexity**: LOW

### H364: Explicit run node vs inline command

- **Hypothesis**: `run: node test.js` as a distinct flow node makes command execution more predictable than inline
- **Test**: Plugin with `run:` node vs vanilla with "please run node test.js". Measure execution reliability.
- **Expected**: PLUGIN_WINS — explicit run node ensures command execution
- **Complexity**: MED

### H365: Try/catch visual nesting

- **Hypothesis**: Visually nested try/catch in flow rendering clarifies error handling structure
- **Test**: `try`: 3 steps. `catch`: 1 step. Verify rendering shows clear nesting structure.
- **Expected**: PLUGIN_WINS — structural clarity
- **Complexity**: LOW

### H366: Gate evaluation feedback loop

- **Hypothesis**: Seeing "gate: tests_pass -> FAIL" after each loop iteration gives clear convergence feedback
- **Test**: Multi-iteration fix loop with gate. Verify gate pass/fail status is visible per iteration.
- **Expected**: PLUGIN_WINS — convergence feedback
- **Complexity**: LOW

### H367: DSL learning curve for simple tasks

- **Hypothesis**: Simple flow definitions (prompt + run + gate) are learnable in under 5 minutes
- **Test**: New user writes a 3-line flow (prompt, run, done when). Measure time to first successful execution.
- **Expected**: TIE — simple flows are easy but vanilla needs no learning
- **Complexity**: LOW

### H368: Flow as reproducible recipe

- **Hypothesis**: The same flow definition produces consistent results across runs, unlike ad-hoc vanilla prompts
- **Test**: Run identical flow 5 times. Run identical vanilla prompt 5 times. Compare output variance.
- **Expected**: PLUGIN_WINS — structured flows reduce variance
- **Complexity**: MED

### H369: Break node clarity

- **Hypothesis**: `break` in a loop clearly communicates early exit intent vs vanilla's ambiguous "stop if done"
- **Test**: `foreach` with `if command_succeeded` + `break`. Verify early exit is deterministic and visible.
- **Expected**: PLUGIN_WINS — explicit early exit semantics
- **Complexity**: LOW

### H370: While loop condition as documentation

- **Hypothesis**: `while max 5 command_failed` self-documents the loop's purpose: "keep trying until success"
- **Test**: Compare readability of `while max 5 command_failed` vs vanilla "try up to 5 times to fix it".
- **Expected**: PLUGIN_WINS — condition-as-documentation pattern
- **Complexity**: LOW

### H371: Flow portability across projects

- **Hypothesis**: A flow definition for "fix bugs" works across different project types without modification
- **Test**: Same flow (prompt: fix bugs, run: npm test, gate: tests_pass) on 3 different Node.js projects.
- **Expected**: PLUGIN_WINS — portable flow templates
- **Complexity**: MED

### H372: Explicit ordering vs implicit

- **Hypothesis**: Flow steps execute in declared order, unlike vanilla where execution order is unpredictable
- **Test**: Flow: step A, step B, step C in specific order. Verify execution matches declaration order.
- **Expected**: PLUGIN_WINS — deterministic ordering
- **Complexity**: LOW

### H373: Let as configuration parameter

- **Hypothesis**: `let max_retries = "3"` at flow start centralizes configuration for easy tuning
- **Test**: Flow with `let threshold = "80"`. All subsequent prompts reference `${threshold}`. Change once to affect all.
- **Expected**: PLUGIN_WINS — centralized configuration via variables
- **Complexity**: LOW

### H374: Multi-gate as checklist completion

- **Hypothesis**: Multiple gates act as a checklist, ensuring all criteria are met before completion
- **Test**: 3 gates: `tests_pass`, `lint_pass`, `file_exists output.js`. All must pass. Compare vs vanilla's single "make it work".
- **Expected**: PLUGIN_WINS — multi-criteria completion verification
- **Complexity**: MED

### H375: Flow as onboarding tool

- **Hypothesis**: New team members can read flow definitions to understand project workflows
- **Test**: Complex project workflow encoded as flow. Assess clarity vs equivalent prose documentation.
- **Expected**: PLUGIN_WINS — executable documentation
- **Complexity**: LOW

---

## Domain D: Language Design (H376-H415)

### H376: Gate composition (tests_pass AND lint_pass)

- **Hypothesis**: Combining multiple gate predicates ensures broader quality coverage
- **Test**: Buggy + poorly formatted code. Gate: `tests_pass` and `lint_pass` (separate gate lines). Both must pass.
- **Expected**: PLUGIN_WINS — composed gates catch more issue categories
- **Complexity**: MED

### H377: Negated gate (not tests_fail)

- **Hypothesis**: `not tests_fail` as a gate predicate works equivalently to `tests_pass`
- **Test**: Buggy code. Gate: `not tests_fail`. Verify it triggers the same convergence as `tests_pass`.
- **Expected**: TIE — logical equivalence, but negation syntax adds expressiveness
- **Complexity**: LOW

### H378: Custom gate with complex command

- **Hypothesis**: `gate coverage_ok: npx c8 check-coverage --lines 80` enforces coverage thresholds
- **Test**: Code with low coverage. Custom gate requiring 80% line coverage. Fix until coverage meets threshold.
- **Expected**: PLUGIN_WINS — custom gate enforces specific quality metric
- **Complexity**: MED

### H379: Custom gate for build validation

- **Hypothesis**: `gate build_passes: npm run build` catches compilation errors that tests alone miss
- **Test**: TypeScript project with type error that doesn't affect test runtime. Gate: `gate build_passes: npx tsc --noEmit`.
- **Expected**: PLUGIN_WINS — build gate catches type errors
- **Complexity**: MED

### H380: Foreach with dynamic list from run output

- **Hypothesis**: `let files = run "ls *.js"` then `foreach file in "${files}"` processes files dynamically
- **Test**: Directory with 3 JS files. `let files = run "ls *.js"`. `foreach file in "${files}"`: process each file. Gate: all processed.
- **Expected**: PLUGIN_WINS — dynamic list generation from command output
- **Complexity**: MED

### H381: Nested if/else for multi-branch logic

- **Hypothesis**: Nested if/else handles complex decision trees better than flat prompts
- **Test**: `if command_succeeded`: check lint. `if` lint passes: done. `else`: fix lint. `else`: fix tests first. Gate: both pass.
- **Expected**: PLUGIN_WINS — structured decision tree
- **Complexity**: MED

### H382: While loop with comparison operator

- **Hypothesis**: `while max 10 ${count} < 5` iterates based on numeric comparison
- **Test**: `let count = "0"`. `while max 10 ${count} < 5`: increment count, do work. Gate: count >= 5.
- **Expected**: PLUGIN_WINS — numeric comparison in loop condition
- **Complexity**: MED

### H383: Variable-driven gate (boolean variable as predicate)

- **Hypothesis**: Boolean variable `${all_fixed}` as gate predicate enables dynamic completion criteria
- **Test**: Flow sets `let all_fixed = "true"` after fixing all bugs. Gate uses the variable value. Verify gate evaluates correctly.
- **Expected**: PLUGIN_WINS — dynamic gate based on runtime state
- **Complexity**: MED

### H384: Foreach with JSON array input

- **Hypothesis**: `let items = '["a","b","c"]'` with `foreach item in "${items}"` correctly parses JSON arrays
- **Test**: JSON array variable. Foreach iterates over parsed array elements. Gate: all items processed.
- **Expected**: PLUGIN_WINS — JSON array support in foreach
- **Complexity**: LOW

### H385: Let with run capturing structured output

- **Hypothesis**: `let data = run "node export-json.js"` captures JSON output for use in prompts
- **Test**: Script outputs JSON. `let data = run "node export-json.js"`. `prompt: Process this data: ${data}`. Gate: processed output is correct.
- **Expected**: PLUGIN_WINS — structured data capture from commands
- **Complexity**: MED

### H386: If with string comparison

- **Hypothesis**: `if ${status} == "ready"` enables string-based conditional branching
- **Test**: `let status = run "node check-status.js"`. `if ${status} == "ready"`: proceed. `else`: wait. Gate: correct branch taken.
- **Expected**: PLUGIN_WINS — string comparison in conditions
- **Complexity**: MED

### H387: If with numeric comparison

- **Hypothesis**: `if ${count} > 3` enables numeric conditional branching
- **Test**: `let count = run "node count-errors.js"`. `if ${count} > 0`: fix errors. `else`: skip. Gate: errors resolved.
- **Expected**: PLUGIN_WINS — numeric comparison in conditions
- **Complexity**: MED

### H388: And/or compound conditions

- **Hypothesis**: `if command_succeeded and ${coverage} > 80` enables multi-criteria branching
- **Test**: Check both test pass and coverage threshold in a single condition. Gate: both criteria met.
- **Expected**: PLUGIN_WINS — compound conditions reduce nesting
- **Complexity**: MED

### H389: Not operator in conditions

- **Hypothesis**: `if not command_failed` is equivalent to `if command_succeeded` and adds expressiveness
- **Test**: `run: node test.js`. `if not command_failed`: proceed to next step. Verify correct branch taken.
- **Expected**: TIE — logical equivalence, expressiveness gain
- **Complexity**: LOW

### H390: Foreach with whitespace-separated items

- **Hypothesis**: `foreach item in "alpha beta gamma"` correctly splits on whitespace
- **Test**: 3 whitespace-separated items. Foreach creates a file per item. Gate: 3 files exist.
- **Expected**: PLUGIN_WINS — whitespace splitting works as expected
- **Complexity**: LOW

### H391: Foreach with newline-separated items

- **Hypothesis**: `let items = run "find . -name '*.js'"` with foreach handles newline-separated output
- **Test**: Directory with 3 JS files. `let items = run "ls *.js"`. `foreach item in "${items}"`: process each. Gate: all processed.
- **Expected**: PLUGIN_WINS — newline splitting from command output
- **Complexity**: MED

### H392: List variable accumulation

- **Hypothesis**: `let results = []` + `let results += run "node test-{item}.js"` accumulates test results
- **Test**: 3 test scripts. Accumulate results in list. After foreach, `${results_length}` should be 3.
- **Expected**: PLUGIN_WINS — list accumulation for aggregation
- **Complexity**: MED

### H393: Variable interpolation in run commands

- **Hypothesis**: `run: node ${script_name}` correctly interpolates the variable into the command
- **Test**: `let script_name = "test.js"`. `run: node ${script_name}`. Verify correct script was executed.
- **Expected**: PLUGIN_WINS — dynamic command construction via interpolation
- **Complexity**: LOW

### H394: Shell-safe interpolation in run

- **Hypothesis**: `shellInterpolate()` wrapping in single quotes prevents injection in `run:` commands
- **Test**: `let filename = "file; rm -rf /"`. `run: cat ${filename}`. Verify no injection; command safely fails.
- **Expected**: PLUGIN_WINS — safe interpolation prevents shell injection
- **Complexity**: LOW

### H395: Foreach with break on condition

- **Hypothesis**: `foreach` + `if condition` + `break` exits foreach early when target item is found
- **Test**: `foreach file in "a.js b.js target.js c.js"`: if file is target.js, break. Verify c.js was not processed.
- **Expected**: PLUGIN_WINS — early exit from iteration
- **Complexity**: MED

### H396: Retry with condition check

- **Hypothesis**: `retry max 3` with `if command_succeeded` + `break` exits retry early on success
- **Test**: Bug fixable in 1 attempt. `retry max 3`: fix, test, if succeeds break. Verify only 1 iteration used.
- **Expected**: PLUGIN_WINS — early retry exit saves agent turns
- **Complexity**: LOW

### H397: Let-prompt for interactive data gathering

- **Hypothesis**: `let user_input = prompt "What is the target framework?"` captures agent response for later use
- **Test**: `let framework = prompt "What framework?"`. `prompt: Generate a ${framework} component`. Gate: component file exists.
- **Expected**: PLUGIN_WINS — interactive data capture for parameterized generation
- **Complexity**: MED

### H398: Nested while inside foreach

- **Hypothesis**: `foreach module in "a b c"`: `while max 3 command_failed`: fix module. Handles per-item convergence.
- **Test**: 3 buggy modules. Foreach iterates modules, while loop fixes each until tests pass. Gate: all module tests pass.
- **Expected**: PLUGIN_WINS — per-item convergence loop
- **Complexity**: HIGH

### H399: If/else with variable assignment

- **Hypothesis**: `if command_succeeded`: `let status = "pass"`. `else`: `let status = "fail"`. Routes subsequent logic.
- **Test**: Run test. Set status variable based on result. Use `${status}` in subsequent prompt. Gate: correct path taken.
- **Expected**: PLUGIN_WINS — conditional variable assignment
- **Complexity**: MED

### H400: Custom gate for format validation

- **Hypothesis**: `gate valid_json: node -e "JSON.parse(require('fs').readFileSync('output.json'))"` validates output format
- **Test**: Generate JSON file. Custom gate validates it's parseable. Fix until valid. Gate: JSON is valid.
- **Expected**: PLUGIN_WINS — format validation gate
- **Complexity**: MED

### H401: Multiple custom gates for multi-criteria validation

- **Hypothesis**: Multiple custom gates (`gate build: ...`, `gate lint: ...`, `gate test: ...`) enforce comprehensive quality
- **Test**: Project needing build + lint + test passes. Three custom gates. All must pass.
- **Expected**: PLUGIN_WINS — multi-criteria enforcement via custom gates
- **Complexity**: MED

### H402: Foreach over computed list length

- **Hypothesis**: `${items_length}` auto-variable correctly tracks list size after modifications
- **Test**: `let items = []`. 5x `let items += "val"`. Verify `${items_length}` equals 5.
- **Expected**: PLUGIN_WINS — automatic length tracking
- **Complexity**: LOW

### H403: Variable as template parameter

- **Hypothesis**: `let template = "function ${name}() { return ${value}; }"` creates reusable code templates
- **Test**: Set name and value variables, generate code using template interpolation. Gate: generated code is valid JS.
- **Expected**: PLUGIN_WINS — template-driven code generation
- **Complexity**: MED

### H404: Condition with last_exit_code comparison

- **Hypothesis**: `if ${last_exit_code} == 0` is equivalent to `if command_succeeded` with more precision
- **Test**: Run command. `if ${last_exit_code} == 0`: success path. `else`: failure path. Verify correct routing.
- **Expected**: TIE — equivalent logic, more explicit
- **Complexity**: LOW

### H405: Gate with file_exists for output verification

- **Hypothesis**: `file_exists output.js` gate ensures the agent actually creates the required output file
- **Test**: Task: generate output.js. Gate: `file_exists output.js`. Vanilla: hope the agent creates it.
- **Expected**: PLUGIN_WINS — explicit file creation verification
- **Complexity**: LOW

### H406: Foreach with mixed source types

- **Hypothesis**: foreach handles both static lists and dynamic run output interchangeably
- **Test**: Static: `foreach x in "a b c"`. Dynamic: `let items = run "echo d e f"`, `foreach x in "${items}"`. Both produce 3 iterations.
- **Expected**: PLUGIN_WINS — flexible list source handling
- **Complexity**: MED

### H407: While with and condition

- **Hypothesis**: `while max 5 command_failed and ${attempts} < 3` combines multiple termination criteria
- **Test**: Loop exits when either tests pass OR attempts exceed 3. Verify correct termination.
- **Expected**: PLUGIN_WINS — multi-criteria loop control
- **Complexity**: MED

### H408: Try with multiple run nodes in body

- **Hypothesis**: try body with multiple run nodes catches failure at any step and jumps to catch
- **Test**: `try`: `run: step1.js`, `run: step2.js`, `run: step3.js`. step2 fails. `catch`: handle error. Gate: recovery succeeds.
- **Expected**: PLUGIN_WINS — multi-step try with precise failure detection
- **Complexity**: MED

### H409: Variable-length foreach iteration

- **Hypothesis**: foreach correctly handles lists of varying lengths (1 item to 20 items)
- **Test**: `let items = run "seq 1 15"`. `foreach item in "${items}"`: create file-{item}.txt. Gate: 15 files exist.
- **Expected**: PLUGIN_WINS — scales to arbitrary list length
- **Complexity**: MED

### H410: If/else chain for multi-way branching

- **Hypothesis**: Sequential if/else blocks simulate multi-way switch statements
- **Test**: `if ${lang} == "js"`: Node setup. `if ${lang} == "py"`: Python setup. `if ${lang} == "go"`: Go setup. Gate: correct setup.
- **Expected**: PLUGIN_WINS — multi-way branching via sequential if nodes
- **Complexity**: MED

### H411: Custom gate with timeout

- **Hypothesis**: `gate perf_ok: timeout 10 node benchmark.js` enforces performance requirements
- **Test**: Slow function. Custom gate with timeout wrapper. Optimize until benchmark passes within timeout.
- **Expected**: PLUGIN_WINS — performance enforcement via timed gate
- **Complexity**: MED

### H412: Foreach producing aggregate output

- **Hypothesis**: foreach + list accumulation produces a collected result available after loop completion
- **Test**: `let summaries = []`. `foreach file in "a b c"`: `let summaries += run "node summarize.js ${file}"`. After loop, use `${summaries}`.
- **Expected**: PLUGIN_WINS — aggregation across iterations
- **Complexity**: MED

### H413: Let-prompt with validation retry

- **Hypothesis**: `let response = prompt "..."` followed by validation and retry if invalid ensures capture quality
- **Test**: `let answer = prompt "What is 2+2?"`. `run: node validate.js`. `if command_failed`: `let answer = prompt "Try again"`. Gate: valid answer.
- **Expected**: PLUGIN_WINS — capture with validation loop
- **Complexity**: MED

### H414: Nested try/catch inside foreach

- **Hypothesis**: per-item try/catch in foreach allows partial failure without aborting the entire loop
- **Test**: `foreach item in "a b c"`: `try`: process item. `catch`: log error. Gate: at least 2 of 3 items processed.
- **Expected**: PLUGIN_WINS — partial failure tolerance in iteration
- **Complexity**: HIGH

### H415: Gate predicate ordering matters

- **Hypothesis**: Cheap gates (file_exists) evaluated before expensive gates (tests_pass) save time on early failures
- **Test**: Gate 1: `file_exists output.js`. Gate 2: `tests_pass`. If file doesn't exist, tests won't even run. Measure evaluation time.
- **Expected**: PLUGIN_WINS — ordered gate evaluation saves time
- **Complexity**: LOW

---

## Domain E: Performance & Cost (H416-H455)

### H416: Minimal flow outperforms maximal flow

- **Hypothesis**: A 3-line flow (prompt, run, gate) is more token-efficient than a 15-line flow for simple tasks
- **Test**: Simple bug fix. Compare 3-line flow vs 15-line flow (with unnecessary variables and loops). Measure tokens consumed.
- **Expected**: TIE — both fix the bug, minimal flow uses fewer tokens
- **Complexity**: LOW

### H417: Gate prevents unnecessary agent turns

- **Hypothesis**: Gate evaluation short-circuits the conversation when tests pass, saving unused turns
- **Test**: Easy bug (1-turn fix). Plugin with gate exits after 1 turn. Vanilla may use 2-3 turns "verifying". Measure total turns.
- **Expected**: PLUGIN_WINS — gate-based early termination
- **Complexity**: LOW

### H418: Variable capture reduces context repetition

- **Hypothesis**: `let error = "${last_stderr}"` avoids re-running commands to see error output, saving tokens
- **Test**: Flow with error capture vs vanilla that re-runs test to see errors. Measure total command executions.
- **Expected**: PLUGIN_WINS — captured variables eliminate redundant runs
- **Complexity**: MED

### H419: Foreach vs repeated prompts token cost

- **Hypothesis**: `foreach file in "a b c"` uses fewer tokens than three separate "fix file X" prompts
- **Test**: 3 files to fix. Plugin: foreach with template prompt. Vanilla: 3 separate prompts. Measure total tokens.
- **Expected**: PLUGIN_WINS — foreach amortizes prompt overhead
- **Complexity**: MED

### H420: Run node auto-advance saves a turn

- **Hypothesis**: Auto-advancing run nodes avoid the turn overhead of the agent deciding to run a command
- **Test**: `run: node test.js`. Auto-executes without agent deliberation. Measure turns vs vanilla's "let me run the tests".
- **Expected**: PLUGIN_WINS — auto-advance eliminates deliberation overhead
- **Complexity**: LOW

### H421: Let-run capture eliminates re-execution

- **Hypothesis**: `let ver = run "node --version"` captures output once, avoiding repeated `node --version` calls
- **Test**: Flow references node version 3 times. With capture: 1 execution. Without: agent may run it 3 times.
- **Expected**: PLUGIN_WINS — single execution with variable reuse
- **Complexity**: LOW

### H422: Flow-directed context reduces exploration

- **Hypothesis**: Explicit flow steps prevent the agent from exploring irrelevant files, saving context window
- **Test**: 10-file project, only 2 files matter. Plugin flow directs to specific files. Vanilla may explore all 10. Measure files read.
- **Expected**: PLUGIN_WINS — directed exploration saves context
- **Complexity**: MED

### H423: Gate evaluation cost vs benefit

- **Hypothesis**: Gate evaluation overhead (running test command) is justified by preventing premature completion
- **Test**: Measure gate command execution time vs time saved by preventing false completion claims.
- **Expected**: PLUGIN_WINS — gate overhead is small relative to saved rework time
- **Complexity**: LOW

### H424: Short prompt templates save tokens

- **Hypothesis**: `prompt: Fix ${file}` is more token-efficient than "Please find and fix the bugs in the file called ${file}"
- **Test**: Compare token count of terse flow prompts vs verbose vanilla prompts for equivalent tasks.
- **Expected**: PLUGIN_WINS — terse prompts reduce token usage
- **Complexity**: LOW

### H425: Retry max 3 vs retry max 10 efficiency

- **Hypothesis**: Lower retry limits force more focused fix attempts, resulting in fewer total tokens
- **Test**: Same bug. `retry max 3` vs `retry max 10`. Measure total tokens consumed and fix rate.
- **Expected**: PLUGIN_WINS — lower retry limits encourage more focused attempts
- **Complexity**: MED

### H426: If/else avoids unnecessary work

- **Hypothesis**: `if command_succeeded` skipping the fix prompt saves tokens when tests already pass
- **Test**: Pre-fixed code. Plugin: `if command_succeeded` skips fix. Vanilla: agent still reads and "fixes" code. Measure tokens.
- **Expected**: PLUGIN_WINS — conditional skip avoids wasted work
- **Complexity**: LOW

### H427: Single-gate vs multi-gate evaluation cost

- **Hypothesis**: A single `tests_pass` gate is cheaper than 3 separate gates but catches fewer issues
- **Test**: Compare evaluation cost of 1 gate vs 3 gates. Measure time and token overhead.
- **Expected**: TIE — tradeoff between cost and coverage
- **Complexity**: LOW

### H428: Variable interpolation vs context window stuffing

- **Hypothesis**: `${last_stderr}` interpolation is more efficient than pasting full stderr into the conversation
- **Test**: Long stderr output (500 chars). Compare interpolation token cost vs full paste token cost.
- **Expected**: PLUGIN_WINS — interpolation avoids context bloat
- **Complexity**: LOW

### H429: Foreach batch processing efficiency

- **Hypothesis**: Processing 5 files in a foreach loop is more efficient than 5 separate agent sessions
- **Test**: 5 files to process. Plugin: single session with foreach. Vanilla: 5 separate `claude -p` invocations.
- **Expected**: PLUGIN_WINS — single session amortizes setup cost
- **Complexity**: MED

### H430: Break-on-success token savings

- **Hypothesis**: `break` after first successful fix in foreach saves tokens from processing remaining items
- **Test**: `foreach approach in "a b c"`: try approach, if works break. Only 1 approach needed. Measure tokens.
- **Expected**: PLUGIN_WINS — early exit saves tokens for remaining iterations
- **Complexity**: LOW

### H431: Flow state serialization overhead

- **Hypothesis**: State file I/O overhead (session-state.json) is negligible compared to LLM inference time
- **Test**: Measure state read/write time per flow step. Compare to average LLM response time.
- **Expected**: TIE — serialization overhead is < 1% of total time
- **Complexity**: LOW

### H432: Context window usage: plugin vs vanilla

- **Hypothesis**: Plugin's system prompt overhead is offset by more efficient agent behavior
- **Test**: Same task. Measure total context window usage for plugin (with system prompt) vs vanilla. Compare.
- **Expected**: TIE — plugin system prompt adds overhead but reduces exploration waste
- **Complexity**: MED

### H433: Gate caching across iterations

- **Hypothesis**: Gate results could be cached between iterations if source files haven't changed
- **Test**: Run gate twice on unchanged code. Second evaluation should be skippable. Measure potential savings.
- **Expected**: PLUGIN_WINS — cache avoids redundant test execution
- **Complexity**: HIGH

### H434: Minimal viable flow for maximum value

- **Hypothesis**: A 2-line flow (`prompt: Fix the bug`, gate: `tests_pass`) provides 80% of the plugin's value
- **Test**: Compare 2-line flow vs 10-line flow vs vanilla on a standard bug fix. Measure fix rate and tokens.
- **Expected**: PLUGIN_WINS — minimal flow is sufficient for most tasks
- **Complexity**: LOW

### H435: Spawn parallelism reduces wall clock time

- **Hypothesis**: Spawning 3 workers in parallel reduces wall clock time by ~50% vs sequential
- **Test**: 3 independent tasks. Measure wall clock time for spawn-3 vs sequential prompt-prompt-prompt.
- **Expected**: PLUGIN_WINS — parallelism reduces elapsed time
- **Complexity**: MED

### H436: Variable reuse across flow steps

- **Hypothesis**: Variables set early in the flow reduce token cost in later steps by avoiding rediscovery
- **Test**: `let config = run "cat config.json"` used in 3 subsequent prompts. Vanilla: agent reads config.json 3 times.
- **Expected**: PLUGIN_WINS — variable reuse prevents redundant file reads
- **Complexity**: MED

### H437: Auto-advance chain efficiency

- **Hypothesis**: A chain of `let` + `run` nodes that auto-advance completes faster than agent-driven commands
- **Test**: `let a = run "cmd1"`, `let b = run "cmd2"`, `let c = run "cmd3"`. All auto-advance without agent turns. Measure time.
- **Expected**: PLUGIN_WINS — auto-advance eliminates per-step agent deliberation
- **Complexity**: LOW

### H438: Gate parallel evaluation

- **Hypothesis**: Multiple gates evaluated in parallel (Promise.all) is faster than sequential evaluation
- **Test**: 3 gates with ~2s each. Parallel: ~2s total. Sequential: ~6s total. Measure gate evaluation time.
- **Expected**: PLUGIN_WINS — parallel gate evaluation saves time
- **Complexity**: LOW

### H439: Flow complexity vs performance tradeoff

- **Hypothesis**: Flows with complexity score > 4 perform worse per-token than simpler flows
- **Test**: Compare fix rate per token for complexity-1 flow vs complexity-5 flow on equivalent tasks.
- **Expected**: PLUGIN_WINS — simpler flows are more token-efficient
- **Complexity**: MED

### H440: Foreach vs spawn for independent tasks

- **Hypothesis**: spawn is faster than foreach for independent tasks due to parallelism, but uses more tokens
- **Test**: 3 independent tasks. Compare foreach (sequential) vs spawn (parallel) on time and token cost.
- **Expected**: TIE — spawn trades tokens for time
- **Complexity**: MED

### H441: Retry overhead for easy bugs

- **Hypothesis**: Retry loop adds unnecessary overhead for bugs fixable in 1 attempt
- **Test**: Easy bug. `retry max 3` vs single prompt+gate. Measure overhead of retry infrastructure.
- **Expected**: TIE — retry overhead is minimal for 1-iteration case
- **Complexity**: LOW

### H442: State file size growth over flow execution

- **Hypothesis**: session-state.json grows linearly with flow steps, not exponentially
- **Test**: 20-step flow. Measure state file size at step 1, 5, 10, 15, 20. Verify linear growth.
- **Expected**: TIE — linear growth is expected and manageable
- **Complexity**: LOW

### H443: Token cost: gate command vs full test suite

- **Hypothesis**: `gate: node test.js` with fast unit tests is cheaper than `gate: npm test` with full suite
- **Test**: Compare gate evaluation time for targeted test file vs full npm test with lint+typecheck.
- **Expected**: PLUGIN_WINS — targeted gates are faster and cheaper
- **Complexity**: LOW

### H444: Batch file operations via foreach

- **Hypothesis**: foreach batch-processing files is more efficient than the agent processing files ad-hoc
- **Test**: 10 files needing the same transformation. foreach applies transformation systematically. Measure consistency.
- **Expected**: PLUGIN_WINS — systematic batch processing
- **Complexity**: MED

### H445: Variable chain depth cost

- **Hypothesis**: Deep variable chains (`a -> b -> c -> d`) add minimal overhead vs single-variable flows
- **Test**: Chain 5 variables. Measure interpolation overhead vs direct value usage.
- **Expected**: TIE — interpolation cost is negligible
- **Complexity**: LOW

### H446: Gate evaluation frequency optimization

- **Hypothesis**: Evaluating gates every N steps instead of every step reduces overhead without losing quality
- **Test**: Gate every step (10 evaluations) vs gate every 3 steps (4 evaluations). Compare fix rate and time.
- **Expected**: TIE — tradeoff between responsiveness and overhead
- **Complexity**: MED

### H447: Flow rendering token cost

- **Hypothesis**: renderFlow output adds context overhead per turn but is justified by agent orientation benefit
- **Test**: Measure renderFlow token cost per step. Compare to agent disorientation cost without it.
- **Expected**: PLUGIN_WINS — rendering overhead is justified by improved agent behavior
- **Complexity**: LOW

### H448: Auto-advance bypass for let nodes

- **Hypothesis**: let nodes auto-advancing without agent involvement saves 1 turn per variable assignment
- **Test**: 3 let nodes. Without auto-advance: 3 extra turns. With auto-advance: 0 extra turns. Measure savings.
- **Expected**: PLUGIN_WINS — auto-advance saves 1 turn per let node
- **Complexity**: LOW

### H449: Spawn cost vs benefit threshold

- **Hypothesis**: spawn is cost-effective only when tasks take > 30 seconds each (parallelism offsets overhead)
- **Test**: Compare spawn cost for tasks of varying duration (5s, 15s, 30s, 60s). Find breakeven point.
- **Expected**: TIE — spawn overhead is only justified for longer tasks
- **Complexity**: MED

### H450: Foreach with large item count

- **Hypothesis**: foreach scales linearly in time with item count, not quadratically
- **Test**: foreach over 5, 10, 20 items. Measure total time. Verify linear relationship.
- **Expected**: TIE — linear scaling is expected
- **Complexity**: MED

### H451: Context compaction and flow state

- **Hypothesis**: Flow state survives context compaction because it's stored in session-state.json, not context window
- **Test**: Long session that triggers compaction. Verify flow state is preserved via state file.
- **Expected**: PLUGIN_WINS — externalized state survives compaction
- **Complexity**: MED

### H452: Single large prompt vs multi-step flow

- **Hypothesis**: Multi-step flow produces same quality as single large prompt but with better controllability
- **Test**: Complex 5-step task. Compare single "do everything" prompt vs 5-step flow. Measure quality and token usage.
- **Expected**: PLUGIN_WINS — multi-step flow is more controllable for same quality
- **Complexity**: MED

### H453: Gate-free flow vs gated flow efficiency

- **Hypothesis**: Flows without gates complete faster but with lower quality assurance
- **Test**: Same task. Flow without gate vs flow with gate. Measure time and quality.
- **Expected**: TIE — tradeoff between speed and assurance
- **Complexity**: LOW

### H454: Token overhead of flow system prompt

- **Hypothesis**: Plugin system prompt (flow rendering + hook output) adds ~500-1000 tokens per turn
- **Test**: Measure system prompt size for flows of varying complexity. Quantify overhead.
- **Expected**: TIE — overhead is measurable but acceptable
- **Complexity**: LOW

### H455: End-to-end latency: plugin vs vanilla

- **Hypothesis**: Plugin adds < 5% latency overhead to total task completion time
- **Test**: Same task, measure wall clock time for plugin vs vanilla across 10 runs. Compare averages.
- **Expected**: TIE — plugin overhead is minimal relative to LLM inference time
- **Complexity**: MED

---

## Domain F: Safety & Real-World (H456-H495)

### H456: No-TODO enforcement gate

- **Hypothesis**: `gate no_todos: ! grep -r "TODO" src/` prevents shipping code with TODO comments
- **Test**: Agent implements feature, leaves TODOs. Gate catches them. Agent must resolve all TODOs to pass.
- **Expected**: PLUGIN_WINS — gate enforces code cleanliness standard
- **Complexity**: MED

### H457: No-console.log enforcement gate

- **Hypothesis**: `gate no_console: ! grep -r "console.log" src/` prevents debug logging in production code
- **Test**: Agent fixes bug using console.log for debugging. Gate forces cleanup. Final code has no console.log.
- **Expected**: PLUGIN_WINS — gate removes debug artifacts
- **Complexity**: MED

### H458: No-hardcoded-secrets gate

- **Hypothesis**: `gate no_secrets: ! grep -rE "(password|secret|api_key)\s*=" src/` catches hardcoded credentials
- **Test**: Agent writes code with hardcoded API key. Gate catches it. Agent must use env variable instead.
- **Expected**: PLUGIN_WINS — security gate prevents credential exposure
- **Complexity**: MED

### H459: SQL injection prevention gate

- **Hypothesis**: Gate checking for raw SQL string concatenation catches injection vulnerabilities
- **Test**: `gate no_sql_injection: ! grep -rE "query.*\\+" src/`. Agent writes SQL with concatenation. Gate forces parameterization.
- **Expected**: PLUGIN_WINS — gate enforces parameterized queries
- **Complexity**: MED

### H460: XSS prevention gate

- **Hypothesis**: Gate checking for innerHTML usage catches XSS vulnerabilities
- **Test**: `gate no_xss: ! grep -r "innerHTML" src/`. Agent uses innerHTML. Gate forces safe DOM manipulation.
- **Expected**: PLUGIN_WINS — gate enforces safe DOM APIs
- **Complexity**: MED

### H461: Dependency audit gate

- **Hypothesis**: `gate audit_pass: npm audit --audit-level=high` catches high-severity vulnerabilities
- **Test**: Project with vulnerable dependency. Gate: npm audit. Agent must fix dependency before passing.
- **Expected**: PLUGIN_WINS — dependency audit gate
- **Complexity**: MED

### H462: TypeScript strict mode gate

- **Hypothesis**: `gate typecheck: npx tsc --noEmit --strict` catches type errors vanilla would miss
- **Test**: JS-to-TS conversion with type errors. Gate: strict typecheck. Agent must fix all type errors.
- **Expected**: PLUGIN_WINS — strict type enforcement
- **Complexity**: MED

### H463: ESLint gate for code quality

- **Hypothesis**: `lint_pass` gate ensures generated code follows project style rules
- **Test**: Buggy code with lint violations. Gate: `lint_pass`. Agent must fix bugs AND lint issues.
- **Expected**: PLUGIN_WINS — combined quality enforcement
- **Complexity**: MED

### H464: No-any TypeScript gate

- **Hypothesis**: `gate no_any: ! grep -r ": any" src/` prevents TypeScript `any` type usage
- **Test**: Agent writes TypeScript with `any` types. Gate catches them. Agent must use proper types.
- **Expected**: PLUGIN_WINS — type safety enforcement
- **Complexity**: MED

### H465: Test coverage gate

- **Hypothesis**: `gate coverage: npx c8 check-coverage --lines 70` enforces minimum test coverage
- **Test**: Agent implements feature with no tests. Gate: coverage threshold. Agent must write tests.
- **Expected**: PLUGIN_WINS — coverage gate ensures test writing
- **Complexity**: MED

### H466: No eval() gate

- **Hypothesis**: `gate no_eval: ! grep -r "eval(" src/` prevents unsafe eval usage
- **Test**: Agent uses eval() for dynamic code execution. Gate catches it. Agent must use safe alternative.
- **Expected**: PLUGIN_WINS — eval prevention gate
- **Complexity**: LOW

### H467: License compliance gate

- **Hypothesis**: `gate license_ok: npx license-checker --failOn "GPL"` prevents incompatible licenses
- **Test**: Project depends on GPL library. Gate catches it. Agent must find MIT-licensed alternative.
- **Expected**: PLUGIN_WINS — license compliance enforcement
- **Complexity**: HIGH

### H468: Git diff non-empty gate for verification

- **Hypothesis**: `diff_nonempty` gate ensures the agent actually made changes (didn't just claim to)
- **Test**: Agent asked to fix bug. Gate: `diff_nonempty`. If agent claims "already fixed" without changing code, gate fails.
- **Expected**: PLUGIN_WINS — diff gate verifies actual changes
- **Complexity**: LOW

### H469: No-debugger-statement gate

- **Hypothesis**: `gate no_debugger: ! grep -r "debugger;" src/` catches leftover debugger statements
- **Test**: Agent debugging with `debugger;` statements. Gate forces removal before completion.
- **Expected**: PLUGIN_WINS — debug artifact cleanup gate
- **Complexity**: LOW

### H470: Correct error handling gate

- **Hypothesis**: Gate checking for empty catch blocks enforces proper error handling
- **Test**: `gate no_empty_catch: ! grep -A1 "catch" src/ | grep -q "{}"`. Agent writes empty catch. Gate forces handling.
- **Expected**: PLUGIN_WINS — error handling enforcement
- **Complexity**: MED

### H471: File size limit gate

- **Hypothesis**: Custom gate checking file size prevents generating monolithic files
- **Test**: `gate size_ok: test $(wc -l < output.js) -lt 200`. Agent generates large file. Gate forces decomposition.
- **Expected**: PLUGIN_WINS — file size enforcement encourages modular code
- **Complexity**: MED

### H472: No-var gate (use const/let)

- **Hypothesis**: `gate no_var: ! grep -rE "\\bvar\\b" src/` enforces modern JS variable declarations
- **Test**: Agent writes code with `var`. Gate catches it. Agent must use `const`/`let`.
- **Expected**: PLUGIN_WINS — modern JS enforcement
- **Complexity**: LOW

### H473: Environment variable validation gate

- **Hypothesis**: Gate checking .env.example exists and documents all used env vars ensures configuration safety
- **Test**: Agent adds new env var to code but not to .env.example. Gate catches the mismatch.
- **Expected**: PLUGIN_WINS — configuration documentation enforcement
- **Complexity**: MED

### H474: No-magic-numbers gate

- **Hypothesis**: `gate no_magic: ! grep -rE "[^0-9a-z_]\\b[2-9][0-9]+\\b" src/` catches unexplained numeric literals
- **Test**: Agent writes `if (count > 42)`. Gate forces extraction to named constant.
- **Expected**: PLUGIN_WINS — magic number elimination
- **Complexity**: MED

### H475: REST API response format gate

- **Hypothesis**: Gate validating API response structure ensures consistent API design
- **Test**: `gate api_format: node validate-api-responses.js`. Agent builds API. Gate verifies response format.
- **Expected**: PLUGIN_WINS — API format consistency enforcement
- **Complexity**: MED

### H476: Database migration safety gate

- **Hypothesis**: Gate checking migration for destructive operations prevents data loss
- **Test**: `gate safe_migration: ! grep -iE "DROP TABLE|TRUNCATE" migration.sql`. Agent writes destructive migration. Gate catches it.
- **Expected**: PLUGIN_WINS — destructive operation prevention
- **Complexity**: MED

### H477: Accessibility validation gate

- **Hypothesis**: Gate checking for alt attributes and ARIA labels enforces accessibility
- **Test**: `gate a11y: ! grep -E "<img(?!.*alt=)" src/`. Agent generates HTML without alt attributes. Gate catches it.
- **Expected**: PLUGIN_WINS — accessibility enforcement
- **Complexity**: MED

### H478: Rate limiting implementation gate

- **Hypothesis**: Gate verifying rate limiting is present in API endpoints ensures security
- **Test**: `gate rate_limited: grep -r "rateLimit" src/routes/`. Agent builds API. Gate requires rate limiting.
- **Expected**: PLUGIN_WINS — security feature enforcement
- **Complexity**: MED

### H479: Input validation gate

- **Hypothesis**: Gate checking for input validation in request handlers prevents injection attacks
- **Test**: `gate validated: grep -r "validate\|sanitize" src/handlers/`. Agent writes handler. Gate requires validation.
- **Expected**: PLUGIN_WINS — input validation enforcement
- **Complexity**: MED

### H480: Error boundary gate for React components

- **Hypothesis**: Gate checking React components have error boundaries ensures resilient UI
- **Test**: `gate error_boundary: grep -r "ErrorBoundary\|componentDidCatch" src/`. Agent writes React app. Gate requires error handling.
- **Expected**: PLUGIN_WINS — UI resilience enforcement
- **Complexity**: MED

### H481: No-synchronous-file-ops gate

- **Hypothesis**: `gate no_sync: ! grep -rE "readFileSync|writeFileSync" src/` enforces async file operations
- **Test**: Agent uses readFileSync. Gate catches it. Agent must convert to async readFile.
- **Expected**: PLUGIN_WINS — async operation enforcement
- **Complexity**: MED

### H482: Multi-file refactor with regression gate

- **Hypothesis**: Gate ensures multi-file refactor doesn't introduce regressions
- **Test**: Rename function across 4 files. Gate: `tests_pass`. Vanilla may miss one reference. Gate catches incomplete rename.
- **Expected**: PLUGIN_WINS — regression gate catches incomplete refactors
- **Complexity**: MED

### H483: Package.json validation gate

- **Hypothesis**: `gate pkg_valid: node -e "require('./package.json')"` ensures package.json remains valid after changes
- **Test**: Agent modifies package.json. Gate: JSON parse check. Prevents malformed package.json.
- **Expected**: PLUGIN_WINS — configuration validation
- **Complexity**: LOW

### H484: No-process-exit gate for libraries

- **Hypothesis**: `gate no_exit: ! grep -r "process.exit" src/` prevents library code from calling process.exit
- **Test**: Agent writes library module. Uses process.exit. Gate catches it. Must throw error instead.
- **Expected**: PLUGIN_WINS — library design enforcement
- **Complexity**: LOW

### H485: Dockerfile best practices gate

- **Hypothesis**: Gate checking for Dockerfile anti-patterns (running as root, no healthcheck) improves container security
- **Test**: `gate docker_ok: node validate-dockerfile.js`. Agent writes Dockerfile with anti-patterns. Gate forces fixes.
- **Expected**: PLUGIN_WINS — container security enforcement
- **Complexity**: HIGH

### H486: Test naming convention gate

- **Hypothesis**: Gate enforcing descriptive test names improves test documentation
- **Test**: `gate test_names: ! grep -rE "test\\(\"test[0-9]" test/`. Agent writes tests with numeric names. Gate forces descriptive names.
- **Expected**: PLUGIN_WINS — test quality enforcement
- **Complexity**: LOW

### H487: No-commented-out-code gate

- **Hypothesis**: Gate detecting large blocks of commented-out code enforces clean codebases
- **Test**: `gate no_dead_code: ! grep -c "^//" src/app.js | awk '$1 > 5'`. Agent leaves commented-out code. Gate forces removal.
- **Expected**: PLUGIN_WINS — dead code cleanup enforcement
- **Complexity**: MED

### H488: API documentation gate

- **Hypothesis**: Gate checking for JSDoc comments on exported functions enforces documentation
- **Test**: Agent exports functions without JSDoc. Gate: `node check-jsdoc.js`. Must add documentation.
- **Expected**: PLUGIN_WINS — documentation enforcement
- **Complexity**: MED

### H489: Retry for flaky end-to-end tests

- **Hypothesis**: `retry max 3` around e2e test execution handles environment flakiness better than single run
- **Test**: E2e test that fails occasionally due to timing. `retry max 3`: `run: node e2e-test.js`. Gate: tests pass.
- **Expected**: PLUGIN_WINS — retry handles e2e flakiness
- **Complexity**: MED

### H490: No-wildcard-import gate

- **Hypothesis**: `gate no_star_import: ! grep -r "import \\*" src/` prevents wildcard imports that hurt tree-shaking
- **Test**: Agent uses `import * as utils from './utils'`. Gate catches it. Must use named imports.
- **Expected**: PLUGIN_WINS — bundle size optimization via import control
- **Complexity**: LOW

### H491: HTTPS enforcement gate

- **Hypothesis**: `gate no_http: ! grep -rE "http://" src/ | grep -v "localhost"` prevents insecure HTTP URLs
- **Test**: Agent hardcodes HTTP URLs. Gate catches non-localhost HTTP. Must use HTTPS.
- **Expected**: PLUGIN_WINS — transport security enforcement
- **Complexity**: LOW

### H492: Concurrent safety fix with test gate

- **Hypothesis**: Fixing security issues while maintaining test pass rate via dual gate
- **Test**: Vulnerable code with passing tests. Fix vulnerability. Gate: `tests_pass` AND `gate secure: node security-check.js`.
- **Expected**: PLUGIN_WINS — dual-gate ensures fix doesn't break functionality
- **Complexity**: MED

### H493: Retry loop for compliance fixes

- **Hypothesis**: `retry max 5` for iterative compliance fixes (security + lint + tests) converges to full compliance
- **Test**: Code with security, lint, and test issues. `retry max 5` fixing iteratively. Gate: all 3 checks pass.
- **Expected**: PLUGIN_WINS — iterative convergence to full compliance
- **Complexity**: HIGH

### H494: Production readiness composite gate

- **Hypothesis**: Composite gate (tests + lint + typecheck + audit + no-TODOs) enforces production readiness
- **Test**: 5 custom gates all must pass. Agent iterates until fully compliant. Vanilla: single "make it production-ready" prompt.
- **Expected**: PLUGIN_WINS — comprehensive quality enforcement
- **Complexity**: HIGH

### H495: Real-world full-stack feature with safety gates

- **Hypothesis**: Building a complete feature (API + frontend + tests) with safety gates produces production-ready code
- **Test**: Full feature: Express route + React component + tests. Gates: `tests_pass`, `lint_pass`, `gate no_secrets: ...`, `gate typecheck: ...`.
- **Expected**: PLUGIN_WINS — multi-dimensional quality enforcement for full-stack features
- **Complexity**: HIGH

---

## Priority Matrix

### Tier 1: Quick Wins (testable now, no code changes)

These hypotheses can be tested with current gate predicates and DSL features:

- **H256**: Gate with spawn/await (spawn + tests_pass gate)
- **H272**: Parallel doc generation (spawn + file_exists gate)
- **H284**: Spawn ordering independence
- **H295**: Spawn determinism
- **H297**: Retry max 1 guard (retry + tests_pass)
- **H298**: Retry max 5 for flaky tests
- **H305**: Idempotent run verification
- **H323**: While loop early exit
- **H336-H349**: All DX visibility hypotheses (renderFlow, variables, gates)
- **H358**: Gate as acceptance criteria
- **H367**: DSL learning curve
- **H370**: While condition as documentation
- **H372**: Explicit ordering
- **H377**: Negated gate
- **H384**: JSON array foreach
- **H389**: Not operator in conditions
- **H390**: Whitespace-separated foreach
- **H393**: Variable interpolation in run
- **H394**: Shell-safe interpolation
- **H396**: Retry with break on success
- **H404**: last_exit_code comparison
- **H405**: file_exists gate
- **H415**: Gate predicate ordering
- **H416-H417**: Minimal flow efficiency
- **H420-H421**: Auto-advance savings
- **H423-H424**: Gate and prompt token costs
- **H426**: If/else skip savings
- **H430**: Break-on-success token savings
- **H431**: State serialization overhead
- **H434**: Minimal viable flow
- **H437-H438**: Auto-advance and parallel gate evaluation
- **H441-H442**: Retry overhead and state growth
- **H448**: Let auto-advance savings
- **H453-H454**: Gate-free flow and system prompt overhead
- **H456-H460**: No-TODO, no-console.log, no-secrets, no-SQL-injection, no-XSS gates
- **H466**: No-eval gate
- **H468-H469**: Diff non-empty and no-debugger gates
- **H472**: No-var gate
- **H483-H484**: Package.json validation and no-process-exit gates
- **H486**: Test naming gate
- **H490-H491**: No-wildcard-import and HTTPS gates

### Tier 2: Medium Effort (requires small DSL additions or test infrastructure)

These hypotheses need custom gate commands, specific test setups, or minor feature extensions:

- **H257-H263**: Spawn patterns (parallel gen, fan-out, failure isolation)
- **H267-H268**: Parallel test execution, spawn with retry
- **H274**: Multi-file atomic update
- **H276**: Shared test infrastructure
- **H281**: Parallel API endpoint generation
- **H286-H291**: Spawn with file gates, parallel fixes, foreach+spawn
- **H296**: Retry with increasing context
- **H299-H304**: Retry strategies, try/catch patterns, checkpoints
- **H306-H313**: Error chains, while loops, until loops
- **H315-H320**: Foreach error handling, recovery, cleanup
- **H324-H332**: Stdout inspection, dependency fallback, break patterns
- **H350-H357**: Spawn status, focused prompts, error guidance
- **H359-H366**: Environment discovery, stderr context, flow rendering
- **H368**: Flow as reproducible recipe
- **H371**: Flow portability
- **H374**: Multi-gate checklist
- **H376**: Gate composition
- **H378-H388**: Custom gates, foreach with run output, comparisons
- **H391-H392**: Newline splitting, list accumulation
- **H395-H403**: Break conditions, let-prompt, nested control flow
- **H406-H413**: Mixed sources, compound conditions, try bodies, format validation
- **H418-H419**: Variable capture, foreach vs repeated prompts
- **H422**: Flow-directed context
- **H425**: Retry limit comparison
- **H429**: Foreach batch efficiency
- **H432**: Context usage comparison
- **H435-H436**: Spawn time savings, variable reuse
- **H439-H440**: Complexity vs performance, foreach vs spawn
- **H444-H447**: Batch operations, variable chains, gate frequency, rendering cost
- **H449-H452**: Spawn cost threshold, foreach scaling, compaction, multi-step flow
- **H455**: End-to-end latency
- **H461-H465**: Dependency audit, typecheck, lint, no-any, coverage gates
- **H470-H471**: Error handling and file size gates
- **H473-H479**: Env validation, magic numbers, API format, migration safety, a11y, rate limiting
- **H480-H482**: Error boundary, sync ops, multi-file refactor
- **H487-H489**: Dead code, JSDoc, flaky e2e retry
- **H492**: Concurrent safety fix

### Tier 3: Research (requires significant architecture work or novel infrastructure)

These hypotheses need major features, complex test infrastructure, or multi-process coordination:

- **H258**: Fan-out/fan-in test suite
- **H259**: Race condition detection
- **H264-H266**: Barrier synchronization, foreach+spawn, dependency chains
- **H269-H270**: Competing strategies, resource contention
- **H275**: Spawn count scaling
- **H277**: Concurrent refactor of coupled files
- **H280**: Spawn error forwarding
- **H282**: Parent-level retry of spawn/await
- **H285**: Nested spawn (grandchild)
- **H292-H293**: Cross-platform generation, variable chain to next stage
- **H302**: Nested retry inside try/catch
- **H311**: Exit code routing
- **H314**: Retry with rollback
- **H322**: Nested foreach with retry
- **H333-H335**: Misleading errors, partial success, cascade retry
- **H398**: Nested while inside foreach
- **H407**: While with and condition
- **H414**: Nested try/catch inside foreach
- **H433**: Gate caching
- **H467**: License compliance gate
- **H485**: Dockerfile best practices
- **H493-H495**: Compliance convergence, production readiness, full-stack feature

## Complexity Distribution

- **LOW**: 78 hypotheses
- **MED**: 132 hypotheses
- **HIGH**: 30 hypotheses
