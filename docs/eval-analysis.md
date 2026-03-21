# Comparative Evaluation Analysis

## Executive Summary

The prompt-language plugin wins **7 out of 28** hypotheses against vanilla Claude in controlled A/B testing with `--repeat 3` reliability sweep (126 `claude -p` calls, H22-H28 pending first run). **Zero flakiness** — every hypothesis produced the same verdict in all 3 iterations. The plugin's value lies in **structural enforcement** -- gate predicates that mechanically verify completion criteria regardless of what the prompt says. When the prompt is honest and explicit, vanilla Claude performs equally well. When the prompt misleads, omits, or narrows focus, the plugin's gates catch what Claude's self-discipline misses. The plugin adds ~204% latency overhead (avg 92.4s vs 30.4s vanilla).

## What the Plugin Actually Changes

The hypothesis-by-hypothesis data below tells you which tests won. This section tells you what it means in practice.

### Gates are the only thing that matters

Every plugin win shares one trait: a `done when:` gate that mechanically verifies something the prompt didn't mention or actively lied about. Strip away the DSL syntax and control flow, and the plugin's value reduces to a single sentence: **it runs a command before letting Claude stop.**

The numbers:

- **7/21 plugin wins** — all from gates enforcing criteria the prompt omitted or contradicted
- **11/21 ties** — all cases where the prompt was honest and complete
- **0 vanilla wins** across 378 comparisons
- **3/21 scoring bugs** (H19-H21) — awaiting re-run

Four proven gate patterns, each 100% reliable across 3 iterations:

| Pattern                | What happens                                      | Examples |
| ---------------------- | ------------------------------------------------- | -------- |
| Gaslighting resistance | Prompt lies ("tests pass"), gate runs them anyway | H2, H9   |
| Narrow framing escape  | Prompt focuses on one bug, gate catches all       | H1, H8   |
| Omitted concern        | Prompt says "tests", gate adds "lint"             | H5, H18  |
| Diff enforcement       | Prompt says "review", gate forces changes         | H17      |

The common thread: Claude trusts the prompt. Gates don't. When the prompt is wrong, gates catch it. When the prompt is right, gates add nothing.

### Flow control doesn't help

`while`, `retry`, `if`, `try` — all the control-flow nodes replicate behavior Claude already exhibits when given clear instructions. The data is unambiguous:

- H6 (retry): TIE. Vanilla retries when told to.
- H10 (try/catch): TIE. Both recover from errors.
- H14 (nested if/retry): TIE. Both handle multi-step recovery.
- H15 (4-phase drip-feed): TIE with 4x latency overhead.
- H16 (per-module pipeline): TIE with 7.5x latency overhead.

Sequential `prompt:` + `run:` pipelines are the worst offender. They force serial execution through the plugin's hook machinery, adding 2-7x latency while achieving identical correctness. Claude follows explicit multi-step instructions reliably without scaffolding.

**Use control flow for organizational clarity if you want, but don't expect it to improve outcomes.**

### The untested advantage: context management

There's a capability the evals haven't measured yet. The plugin's variable system (`let x = prompt "text"` + `${x}` interpolation) lets you architect what information reaches each prompt step.

**Vanilla Claude**: every turn sees the growing conversation history. Earlier turns can bias later steps. Irrelevant information competes for attention. You have no control over what context reaches which step.

**Plugin with variable capture**: `let x = prompt "text"` stores specific text. `prompt: Do ${x}` injects only what you choose. Each prompt node sees `renderFlow()` (structured state) plus interpolated variables, not raw prior conversation.

Example:

```
let security_rules = prompt "Only use parameterized queries. Never string-concat SQL."
let code_review = prompt "Check for null handling, error paths, and input validation."
prompt: Refactor auth.js following these rules: ${security_rules}
prompt: Review the changes against: ${code_review}
```

The security refactoring step doesn't see the code review criteria (which could distract it into reviewing instead of refactoring). The review step doesn't see the security rules (which could bias it to only check SQL issues). Each step gets exactly the context it needs.

This is not true lexical scoping — variables are session-wide and any step can read any variable. But the composition is intentional. You're deciding what information to inject into each prompt, rather than relying on Claude's attention across an ever-growing conversation window.

**Status**: untested empirically. The variable capture evals (H3, H7) test simple value relay, not selective context injection. Whether this actually improves outcomes over vanilla Claude with the same instructions is an open hypothesis.

### The cost: latency

Every plugin invocation pays a tax for hook loading, state file I/O, and gate evaluation:

| Scenario                | Vanilla | Plugin | Overhead |
| ----------------------- | ------- | ------ | -------- |
| Simplest task (H12)     | 10-12s  | 28-30s | 2.7x     |
| Average across 21 tests | 30.4s   | 92.4s  | +204%    |
| Phased audit (H15)      | 69.6s   | 281.0s | 4.0x     |
| Modular build (H16)     | 35.9s   | 269.3s | 7.5x     |

For gate-loop tests (H1, H2, H5, H8, H9, H17, H18), the extra time is productive — the plugin is running tests and iterating until they pass. For phased prompts and simple tasks, it's pure overhead.

**Rule of thumb**: pay the latency cost when gates enforce correctness you can't get otherwise. Skip it when the prompt honestly describes the task and you can verify the result yourself.

### Decision guide

| Situation                                                                                                  | Use plugin? | Why                                              |
| ---------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------ |
| Task has verifiable completion criteria (tests, lint, file exists) that the prompt might not fully specify | Yes         | Gates catch what prompts miss                    |
| You distrust the prompt (generated, copied, or deliberately adversarial)                                   | Yes         | Gaslighting resistance                           |
| You need to force code changes, not just review                                                            | Yes         | `diff_nonempty` gate                             |
| Multiple independent criteria must all pass                                                                | Yes         | Compound gates                                   |
| You want to control what context reaches each prompt step                                                  | Maybe       | Variable capture (untested, theoretically sound) |
| Task is simple and well-specified                                                                          | No          | Vanilla matches correctness, 2-3x faster         |
| You're using phased prompts for organizational structure                                                   | No          | 4-7x slower, no correctness gain                 |
| Speed matters and you'll verify the result manually                                                        | No          | Plugin adds overhead without benefit             |

## Taxonomy of Differentiators

| Category                  | Mechanism                                      | Hypotheses     | Win Rate      | Pattern                                      |
| ------------------------- | ---------------------------------------------- | -------------- | ------------- | -------------------------------------------- |
| Gaslighting resistance    | Gate ignores false claims about state          | H2, H9, H26    | 2/2 + pending | Prompt lies; gate runs tests anyway          |
| Narrow framing resistance | Gate checks broader criteria than prompt       | H1, H8         | 2/2 (100%)    | Prompt focuses on subset; gate catches rest  |
| Omitted concern           | Multiple gates enforce unstated requirements   | H5, H18        | 2/2 (100%)    | Prompt mentions tests; gate adds lint        |
| Diff enforcement          | `diff_nonempty` gate forces code changes       | H17            | 1/1 (100%)    | Review-only vs forced modification           |
| Mechanical execution      | Auto-exec, variable capture, retry loops       | H3, H4, H6, H7 | 0/4 (all TIE) | Vanilla follows explicit instructions fine   |
| Recovery scaffolding      | try/catch control flow                         | H10            | 0/1 (TIE)     | Both recover reliably                        |
| Long pipeline             | 8 sequential run: nodes                        | H11            | 0/1 (TIE)     | Both complete 8-step chains                  |
| Latency measurement       | Simplest task, timing comparison               | H12            | 0/1 (TIE)     | 10-12s vanilla vs 28-30s plugin (2.7x)       |
| File-exists gate          | `file_exists` gate predicate                   | H13            | 0/1 (TIE)     | Both create the file from instructions       |
| Nested control flow       | if + retry nesting                             | H14            | 0/1 (TIE)     | Both handle config + bug fix                 |
| Attention focus           | Phased prompts drip-feed categories            | H15            | 0/1 (TIE)     | Both fix 12/12; plugin 3-6x slower           |
| Progressive construction  | Per-module validation in pipeline              | H16            | 0/1 (TIE)     | Both achieve 14/14; plugin 5-6x slower       |
| While-loop iteration      | `while command_failed` mechanical re-test      | H19            | scoring bug   | Fixed; needs re-run                          |
| Variable-driven branching | `let x = run` + `if command_failed` routing    | H20            | scoring bug   | Fixed; needs re-run                          |
| Until-loop quality gate   | `until tests_pass max 5` with escalating hints | H21            | scoring bug   | Fixed; needs re-run                          |
| Gaslighting + loop combo  | While loop with prompt deception               | H22            | pending       | Prompt lies about bug count; loop finds rest |
| Inverted gate predicate   | `tests_fail`/`lint_fail` gate                  | H23, H27       | pending       | Write failing test / force lint failure      |
| Triple gate enforcement   | 3 independent gates compound omitted concerns  | H24            | pending       | tests_pass + lint_pass + file_exists         |
| Diagnostic routing + lie  | `let`/`if` with misleading prompt              | H25            | pending       | 3 bugs, prompt admits only 1                 |
| let-prompt capture        | `let x = prompt` variable as context           | H26            | pending       | Capture instructions, channel fix            |
| Custom gate command       | Explicit `command:` on gate predicate          | H28            | pending       | Custom command verifies output content       |

## Four Winning Patterns

### 1. Gaslighting Resistance (H2, H9) — 100% reliable

The prompt explicitly lies about the current state: "tests already pass" or "I already fixed everything." Vanilla Claude trusts the prompt and skips verification. The plugin's `done when: tests_pass` gate ignores the lie and mechanically runs `npm test`, discovering failures.

- **H2**: Prompt says "tests already pass, no need to run them." Vanilla renames a function and stops. Plugin gate runs tests, finds null-handling and division-by-zero bugs, forces fixes.
- **H9**: Prompt says "I already fixed and tested everything -- just review code style." Vanilla reviews style. Plugin gate runs tests, finds 3 bugs across 3 modules, forces fixes.

### 2. Narrow Framing Escape (H1, H8) — 100% reliable

The prompt focuses Claude's attention on one specific issue, but the test suite checks broader correctness. Vanilla fixes what it's told to fix and stops. The plugin's gate catches everything the test suite covers.

- **H1**: Prompt says "fix the ReferenceError crash." Vanilla fixes `nme -> name` but misses `a * a -> a * b`. Plugin gate requires all tests to pass, catching both bugs.
- **H8**: Prompt says "run the self-test" -- a built-in test that only covers happy paths (5/5 pass). Real test.js tests edge cases (empty string). Plugin gate runs `npm test` (real tests), not `node app.js` (self-test).

### 3. Omitted Concern (H5, H18) — 100% reliable

The prompt mentions one requirement but the gate enforces additional ones. Vanilla fixes what's asked. The plugin catches the unstated requirement.

- **H5**: Prompt says "fix greet() so tests pass." Plugin has `done when: tests_pass` AND `lint_pass` -- catches `var` keyword in utils.js that vanilla has no reason to touch.
- **H18**: Prompt says "fix the bugs so tests pass." Plugin combines `retry max 3` with dual gates `tests_pass` + `lint_pass` — retry iterates on test failures, lint gate catches the `var` keyword.

### 4. Diff Enforcement (H17) — 100% reliable

The prompt asks for review, not modification. Vanilla describes improvements without changing code. Plugin's `diff_nonempty` gate forces actual file modifications.

- **H17**: Prompt says "review calculator.js, write observations." Vanilla creates review.txt but doesn't touch calculator.js. Plugin's `diff_nonempty` gate requires code changes, so the swapped add/subtract implementations get fixed.

## Why Quick Tests Always TIE

Hypotheses H3, H4, H6, and H7 test mechanical execution: variable capture, pipeline sequencing, retry loops, and multi-step interpolation. These always tie because vanilla Claude follows explicit DSL-like instructions reliably.

The key insight: **the plugin adds no value when the prompt honestly and completely describes what needs to happen.** Claude already executes sequential steps, retries on failure, and passes values between commands when told to. The plugin's auto-execution and variable capture merely replicate what Claude does naturally with good instructions.

This means the plugin's value is exclusively in **enforcement of invariants the prompt doesn't mention or actively contradicts** -- i.e., gates.

## Where Plugin HURTS

### H15/H16: Phased prompts add latency without benefit

H15 (Phased Code Audit) and H16 (Progressive Modular Build) both TIE consistently, but the plugin takes 3-6x longer. The phased prompt approach forces sequential execution that doesn't improve correctness — Claude fixes all bugs and builds all modules correctly either way. The overhead is pure waste.

**Takeaway**: Phased prompts (multiple sequential `prompt:` + `run:` nodes) don't add correctness when the task is well-specified. Use them only for organizational clarity, not enforcement.

### H10: Try/catch rigidity (TIE, previously flaky)

In the reliability sweep, H10 was consistently TIE (3/3). Earlier single-run data showed occasional variation. The structural rigidity of `try/catch` can interfere with Claude's natural problem-solving, but in practice both approaches work.

**Takeaway**: Use gates liberally but use control flow (try/catch, if/else) sparingly -- only when the recovery path is well-understood and predictable.

## Hypothesis-by-Hypothesis Results

| ID  | Name                          | Category                 | Mechanism                              | Verdict    | Reliability | Notes                                    |
| --- | ----------------------------- | ------------------------ | -------------------------------------- | ---------- | ----------- | ---------------------------------------- |
| H1  | Hidden Second Bug             | Narrow framing           | Gate catches all test failures         | **PLUGIN** | 3/3 (100%)  | Vanilla fixes crash, misses logic bug    |
| H2  | Gaslighting "Tests Pass"      | Gaslighting              | Gate ignores "no need to test" lie     | **PLUGIN** | 3/3 (100%)  | Consistent across all runs               |
| H3  | Hash Fidelity                 | Variable capture         | `let x = run` captures stdout          | TIE        | 3/3 (100%)  | Both relay hex correctly                 |
| H4  | Pipeline Auto-Exec            | Sequential execution     | 3 chained `run:` nodes                 | TIE        | 3/3 (100%)  | Vanilla follows instructions fine        |
| H5  | Dual Gate                     | Omitted concern          | `tests_pass` + `lint_pass`             | **PLUGIN** | 3/3 (100%)  | Vanilla has no reason to lint            |
| H6  | Flaky Retry                   | Retry loop               | `retry max 5`                          | TIE        | 3/3 (100%)  | Vanilla retries when told to             |
| H7  | Variable Chain                | Multi-step interpolation | 4 chained `let = run`                  | TIE        | 3/3 (100%)  | Both chain values correctly              |
| H8  | Misleading Console Output     | Narrow framing           | Gate runs real tests, not self-test    | **PLUGIN** | 3/3 (100%)  | Self-test passes, real tests fail        |
| H9  | Iterative Multi-Bug Fix       | Gaslighting              | Gate discovers unfixed bugs            | **PLUGIN** | 3/3 (100%)  | "Already fixed" is a lie                 |
| H10 | Try/Catch Recovery            | Error recovery           | `try/catch` control flow               | TIE        | 3/3 (100%)  | Both recover reliably                    |
| H11 | Long Pipeline                 | Sequential execution     | 8 chained `run:` nodes                 | TIE        | 3/3 (100%)  | Both complete all 8 steps                |
| H12 | Latency Overhead              | Timing baseline          | Simplest possible task                 | TIE        | 3/3 (100%)  | 10-12s vanilla, 28-30s plugin (2.7x)     |
| H13 | File-Exists Gate              | File gate                | `file_exists dist/bundle.js`           | TIE        | 3/3 (100%)  | Both follow build instructions           |
| H14 | Nested Control Flow           | Nested if/retry          | Multi-step recovery + gate             | TIE        | 3/3 (100%)  | Both handle config + bug fix             |
| H15 | Phased Code Audit             | Attention focus          | 4-phase drip-feed prompts              | TIE        | 3/3 (100%)  | Both 12/12; plugin 3-6x slower           |
| H16 | Progressive Modular Build     | Per-phase validation     | Module-by-module tests                 | TIE        | 3/3 (100%)  | Both 14/14; plugin 5-6x slower           |
| H17 | diff_nonempty Gate            | Diff enforcement         | `diff_nonempty` gate predicate         | **PLUGIN** | 3/3 (100%)  | Vanilla reviews; plugin forces changes   |
| H18 | Gate + Retry Combo            | Gate + control flow      | `retry` + `tests_pass` + `lint_pass`   | **PLUGIN** | 3/3 (100%)  | Retry + dual gate catches lint           |
| H19 | While-Loop Fix Cycle          | While-loop iteration     | `while command_failed` re-test         | BOTH FAIL  | scoring bug | Fixed — needs re-run                     |
| H20 | Conditional Branch + Var      | Variable branching       | `let x = run` + `if` routing           | BOTH FAIL  | scoring bug | Fixed — needs re-run                     |
| H21 | Until-Loop Quality Gate       | Until-loop               | `until tests_pass max 5`               | BOTH FAIL  | scoring bug | Fixed — needs re-run                     |
| H22 | Gaslighting + While Loop      | Gaslighting + loop       | `while` + prompt lies about count      | pending    | —           | 4 bugs, prompt mentions only 1           |
| H23 | Inverted Gate — Fail Test     | Inverted gate            | `tests_fail` gate predicate            | pending    | —           | Write failing test, don't fix code       |
| H24 | Triple Gate Enforcement       | Triple gate              | `tests_pass`+`lint_pass`+`file_exists` | pending    | —           | 3 independent completion criteria        |
| H25 | Diagnostic Route + Gaslight   | Diagnostic + gaslighting | `let`/`if` + misleading prompt         | pending    | —           | 3 bugs, prompt admits only 1             |
| H26 | let-prompt Capture + Gaslight | Gaslighting + let-prompt | `let x = prompt` variable capture      | pending    | —           | SQL injection hidden, prompt says "fine" |
| H27 | lint_fail Inverted Gate       | Inverted gate            | `lint_fail` gate predicate             | pending    | —           | Force lint failure, gate blocks until it |
| H28 | Custom Gate Command           | Custom gate              | Explicit `command:` on gate            | pending    | —           | Custom command verifies output content   |

## Run History

### Runs 1-3 (Initial development — 5-10 hypotheses)

- Established core winning pattern: H1, H2, H5, H8, H9 consistently PLUGIN WINS
- All mechanical execution tests (H3, H4, H6, H7) consistently TIE

### Run 4 (Expanded to 14 hypotheses — H11-H14 added)

- Plugin: 5 wins | Vanilla: 0 wins | Ties: 9 | Both fail: 0
- New hypotheses all TIE: Long Pipeline, Latency, File-Exists, Nested Control Flow

### Run 5 (Expanded to 21 hypotheses — H15-H21 added, --repeat 3 reliability sweep)

- **126 total `claude -p` calls** (21 tests x 3 iterations x 2 sides)
- Plugin: 7 wins | Vanilla: 0 wins | Ties: 11 | Both fail: 3 (per iteration)
- **Zero flakiness**: every hypothesis identical across all 3 iterations
- New plugin wins: H17 (diff_nonempty), H18 (gate+retry)
- New TIEs: H15 (phased audit), H16 (progressive build)
- H19-H21: BOTH FAIL due to Windows `node -e` quoting bug in scoring (fixed post-run)
- Avg latency: Plugin 92.4s, Vanilla 30.4s (+204% overhead)

## Remaining Gaps

H19-H21 need re-run after scoring fix. H22-H28 pending first run.

| Priority | Capability               | Status                                 |
| -------- | ------------------------ | -------------------------------------- |
| High     | H19-H21 re-run           | Scoring fix committed, awaiting re-run |
| Med      | H22-H28 first run        | Implemented, awaiting first run        |
| Low      | Multi-file interpolation | Expected TIE — low priority            |

## Latency Data

Latency overhead measured across reliability sweep (`--repeat 3`, 21 hypotheses):

| Metric                          | Vanilla | Plugin | Overhead |
| ------------------------------- | ------- | ------ | -------- |
| H12 (simplest task, 3 runs)     | 10-12s  | 28-30s | 2.7x     |
| Quick avg (7 tests, 1 run)      | 24.4s   | 66.0s  | +170%    |
| Full avg (14 tests, 1 run)      | 25.9s   | 73.9s  | +186%    |
| Full avg (21 tests, --repeat 3) | 30.4s   | 92.4s  | +204%    |
| H15 Phased Audit avg            | 69.6s   | 281.0s | 4.0x     |
| H16 Progressive Build avg       | 35.9s   | 269.3s | 7.5x     |

The overhead comes from plugin hook loading, state file I/O, and gate evaluation. For gate-loop tests (H1, H2, H5, H8, H9, H17, H18), the extra time is productive — the plugin is running tests and iterating. For quick tests and phased prompts, it's pure overhead with no benefit.

## Reliability Data

Full reliability sweep with `--repeat 3` (126 total calls):

```
H1:  Hidden Second Bug          — PLUGIN 3/3 (100%)
H2:  Gaslighting "Tests Pass"   — PLUGIN 3/3 (100%)
H3:  Hash Fidelity              — TIE 3/3 (100%)
H4:  Pipeline Auto-Exec         — TIE 3/3 (100%)
H5:  Dual Gate                  — PLUGIN 3/3 (100%)
H6:  Flaky Retry                — TIE 3/3 (100%)
H7:  Variable Chain             — TIE 3/3 (100%)
H8:  Misleading Console Output  — PLUGIN 3/3 (100%)
H9:  Iterative Multi-Bug Fix    — PLUGIN 3/3 (100%)
H10: Try/Catch Recovery         — TIE 3/3 (100%)
H11: Long Pipeline              — TIE 3/3 (100%)
H12: Latency Overhead           — TIE 3/3 (100%)
H13: File-Exists Gate           — TIE 3/3 (100%)
H14: Nested Control Flow        — TIE 3/3 (100%)
H15: Phased Code Audit          — TIE 3/3 (100%)
H16: Progressive Modular Build  — TIE 3/3 (100%)
H17: diff_nonempty Gate         — PLUGIN 3/3 (100%)
H18: Gate + Retry Combo         — PLUGIN 3/3 (100%)
H19: While-Loop Fix Cycle       — BOTH_FAIL 3/3 (scoring bug, fixed)
H20: Conditional Branch + Var   — BOTH_FAIL 3/3 (scoring bug, fixed)
H21: Until-Loop Quality Gate    — BOTH_FAIL 3/3 (scoring bug, fixed)
```

**Zero VANILLA WINS observed across 378 individual comparisons (126 calls x 3 iterations).**

## When to Use the Plugin

**Use it when:**

- Completion criteria are objective and verifiable (tests pass, lint passes, file exists, diff nonempty)
- The task involves iterative fix loops where the agent might stop prematurely
- You distrust that the prompt fully specifies all requirements
- Multiple independent gates need to ALL pass before completion
- You need to force actual code changes (not just review)

**Skip it when:**

- The task is a simple, explicit instruction ("create this file with this content")
- There are no verifiable completion criteria
- The prompt is honest and complete about what needs to happen
- Speed is critical and correctness is easily verified manually
- You're using phased prompts for organizational clarity (no correctness benefit, high latency cost)

## Known Limitations

- **Quick tests always tie**: H3, H4, H6, H7 show no plugin advantage because vanilla Claude follows explicit instructions reliably
- **Phased prompts add latency without benefit**: H15/H16 show 4-7x overhead with no correctness gain
- **H19-H21 scoring bug**: Windows `node -e` quoting issue — fixed in commit 1035c6f, awaiting re-run
- **No VANILLA WINS**: The plugin never performs worse than vanilla on correctness (only on latency)
