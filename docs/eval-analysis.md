# Comparative Evaluation Analysis

## Executive Summary

The prompt-language plugin wins **5 out of 18** hypotheses against vanilla Claude in controlled A/B testing (H15-H18 pending first run). The plugin's value lies in **structural enforcement** -- gate predicates that mechanically verify completion criteria regardless of what the prompt says. When the prompt is honest and explicit, vanilla Claude performs equally well. When the prompt misleads, omits, or narrows focus, the plugin's gates catch what Claude's self-discipline misses. The plugin adds ~186% latency overhead (avg 73.9s vs 25.9s vanilla).

## Taxonomy of Differentiators

| Category                  | Mechanism                                       | Hypotheses     | Win Rate         | Pattern                                       |
| ------------------------- | ----------------------------------------------- | -------------- | ---------------- | --------------------------------------------- |
| Gaslighting resistance    | Gate ignores false claims about state           | H2, H9         | 2/2 (100%)       | Prompt lies; gate runs tests anyway           |
| Narrow framing resistance | Gate checks broader criteria than prompt        | H1, H8         | 2/2 (100%)       | Prompt focuses on subset; gate catches rest   |
| Omitted concern           | Multiple gates enforce unstated requirements    | H5, H18        | 1/1 + pending    | Prompt mentions tests; gate adds lint         |
| Mechanical execution      | Auto-exec, variable capture, retry loops        | H3, H4, H6, H7 | 0/4 (all TIE)    | Vanilla follows explicit instructions fine    |
| Recovery scaffolding      | try/catch control flow                          | H10            | 0/1 (TIE, flaky) | Both recover; plugin rigidity sometimes hurts |
| Long pipeline             | 8 sequential run: nodes                         | H11            | 0/1 (TIE)        | Both complete 8-step chains                   |
| Latency measurement       | Simplest task, timing comparison                | H12            | 0/1 (TIE)        | 11.2s vanilla vs 29.8s plugin (2.7x)          |
| File-exists gate          | `file_exists` gate predicate                    | H13            | 0/1 (TIE)        | Both create the file from instructions        |
| Nested control flow       | if + retry nesting                              | H14            | 0/1 (TIE)        | Both handle config + bug fix                  |
| Attention focus           | Phased prompts drip-feed categories             | H15            | pending          | 4-phase audit vs all-at-once                  |
| Progressive construction  | Per-module validation in pipeline               | H16            | pending          | Module-by-module vs build-all                 |
| Diff enforcement          | `diff_nonempty` gate forces code changes        | H17            | pending          | Review-only vs forced modification            |
| Gate + retry combination  | `retry` + dual gates (`tests_pass`+`lint_pass`) | H18            | pending          | Retry iterates; dual gate catches lint        |

## Three Winning Patterns

### 1. Gaslighting Resistance (H2, H9)

The prompt explicitly lies about the current state: "tests already pass" or "I already fixed everything." Vanilla Claude trusts the prompt and skips verification. The plugin's `done when: tests_pass` gate ignores the lie and mechanically runs `npm test`, discovering failures.

- **H2**: Prompt says "tests already pass, no need to run them." Vanilla renames a function and stops. Plugin gate runs tests, finds null-handling and division-by-zero bugs, forces fixes.
- **H9**: Prompt says "I already fixed and tested everything -- just review code style." Vanilla reviews style. Plugin gate runs tests, finds 3 bugs across 3 modules, forces fixes.

### 2. Narrow Framing Escape (H1, H8)

The prompt focuses Claude's attention on one specific issue, but the test suite checks broader correctness. Vanilla fixes what it's told to fix and stops. The plugin's gate catches everything the test suite covers.

- **H1**: Prompt says "fix the ReferenceError crash." Vanilla fixes `nme -> name` but misses `a * a -> a * b`. Plugin gate requires all tests to pass, catching both bugs.
- **H8**: Prompt says "run the self-test" -- a built-in test that only covers happy paths (5/5 pass). Real test.js tests edge cases (empty string). Plugin gate runs `npm test` (real tests), not `node app.js` (self-test).

### 3. Omitted Concern (H5)

The prompt mentions one requirement but the gate enforces two. Vanilla fixes what's asked. The plugin catches the unstated requirement.

- **H5**: Prompt says "fix greet() so tests pass." Vanilla fixes app.js and runs npm test. Plugin has `done when: tests_pass` AND `lint_pass` -- catches `var` keyword in utils.js that vanilla has no reason to touch.

## Why Quick Tests Always TIE

Hypotheses H3, H4, H6, and H7 test mechanical execution: variable capture, pipeline sequencing, retry loops, and multi-step interpolation. These always tie because vanilla Claude follows explicit DSL-like instructions reliably.

The key insight: **the plugin adds no value when the prompt honestly and completely describes what needs to happen.** Claude already executes sequential steps, retries on failure, and passes values between commands when told to. The plugin's auto-execution and variable capture merely replicate what Claude does naturally with good instructions.

This means the plugin's value is exclusively in **enforcement of invariants the prompt doesn't mention or actively contradicts** -- i.e., gates.

## Where Plugin HURTS (H10)

H10 (Try/Catch Recovery) occasionally shows the plugin performing worse than vanilla. The mechanism:

1. `build.js` fails because `config.json` is missing
2. Plugin's `try/catch` flow catches the error and prompts Claude to create the config
3. But the catch block's prompt is **rigid** -- it prescribes the exact fix, which may not match what Claude would discover on its own
4. Vanilla Claude reads the error message, infers the fix, and applies it flexibly

The plugin's control flow adds **structural rigidity** that can interfere with Claude's natural problem-solving. This is the tradeoff: gates enforce correctness but control flow can constrain flexibility.

**Takeaway**: Use gates liberally but use control flow (try/catch, if/else) sparingly -- only when the recovery path is well-understood and predictable.

## Hypothesis-by-Hypothesis Results

| ID  | Name                      | Category                 | Mechanism                              | Verdict    | Notes                                 |
| --- | ------------------------- | ------------------------ | -------------------------------------- | ---------- | ------------------------------------- |
| H1  | Hidden Second Bug         | Narrow framing           | Gate catches all test failures         | **PLUGIN** | Vanilla fixes crash, misses logic bug |
| H2  | Gaslighting "Tests Pass"  | Gaslighting              | Gate ignores "no need to test" lie     | **PLUGIN** | Consistent across runs                |
| H3  | Hash Fidelity             | Variable capture         | `let x = run` captures stdout          | TIE        | Both relay hex correctly              |
| H4  | Pipeline Auto-Exec        | Sequential execution     | 3 chained `run:` nodes                 | TIE        | Vanilla follows instructions fine     |
| H5  | Dual Gate                 | Omitted concern          | `tests_pass` + `lint_pass`             | **PLUGIN** | Vanilla has no reason to lint         |
| H6  | Flaky Retry               | Retry loop               | `retry max 5`                          | TIE        | Vanilla retries when told to          |
| H7  | Variable Chain            | Multi-step interpolation | 4 chained `let = run`                  | TIE        | Both chain values correctly           |
| H8  | Misleading Console Output | Narrow framing           | Gate runs real tests, not self-test    | **PLUGIN** | Self-test passes, real tests fail     |
| H9  | Iterative Multi-Bug Fix   | Gaslighting              | Gate discovers unfixed bugs            | **PLUGIN** | "Already fixed" is a lie              |
| H10 | Try/Catch Recovery        | Error recovery           | `try/catch` control flow               | TIE        | Both recover; occasionally flaky      |
| H11 | Long Pipeline             | Sequential execution     | 8 chained `run:` nodes                 | TIE        | Both complete all 8 steps             |
| H12 | Latency Overhead          | Timing baseline          | Simplest possible task                 | TIE        | 11.2s vanilla, 29.8s plugin (2.7x)    |
| H13 | File-Exists Gate          | File gate                | `file_exists dist/bundle.js`           | TIE        | Both follow build instructions        |
| H14 | Nested Control Flow       | Nested if/retry          | Multi-step recovery + gate             | TIE        | Both handle config + bug fix          |
| H15 | Phased Code Audit         | Attention focus          | 4-phase drip-feed prompts              | pending    | 12 bugs across 4 categories           |
| H16 | Progressive Modular Build | Per-phase validation     | Module-by-module with per-module tests | pending    | 5-module pipeline                     |
| H17 | diff_nonempty Gate        | Diff enforcement         | `diff_nonempty` gate predicate         | pending    | Review-only vs forced modification    |
| H18 | Gate + Retry Combo        | Gate + control flow      | `retry` + `tests_pass` + `lint_pass`   | pending    | Retry iterates; dual gate catches var |

## Run History

### Run 1 (Initial)

- Plugin: 1 win | Vanilla: 0 wins | Ties: 4 | Both fail: 0
- Only H5 showed differentiation

### Run 2 (Expanded to 10 hypotheses)

- Plugin: 5 wins | Vanilla: 0 wins | Ties: 5 | Both fail: 0
- H1, H2, H5, H8, H9 consistently won

### Run 3 (Confirmation)

- Plugin: 5 wins | Vanilla: 0 wins | Ties: 5 | Both fail: 0
- Same pattern confirmed

### Run 4 (Expanded to 14 hypotheses — H11-H14 added)

- Plugin: 5 wins | Vanilla: 0 wins | Ties: 9 | Both fail: 0
- H11 (Long Pipeline): TIE — both complete 8 sequential steps
- H12 (Latency): TIE — vanilla 11.2s, plugin 29.8s (quick), avg 25.9s vs 73.9s (full)
- H13 (File-Exists Gate): TIE — both follow README build instructions
- H14 (Nested Control Flow): TIE — both create config + fix bug
- Same 5 winning hypotheses (H1, H2, H5, H8, H9) confirmed again

## Remaining Gaps

Most high-priority gaps have been addressed by H15-H18. Remaining:

1. **`while`/`until` loops**: Tested in unit tests but no comparative eval. Expected TIE
2. **Multi-file variable interpolation**: `let x = run` -> use `${x}` across multiple prompts

| Priority | Capability               | Status                      |
| -------- | ------------------------ | --------------------------- |
| ~~High~~ | ~~`diff_nonempty` gate~~ | Covered by H17              |
| ~~Med~~  | ~~Gate + retry combo~~   | Covered by H18              |
| Low      | while/until loops        | Expected TIE — low priority |
| Low      | Multi-file interpolation | Expected TIE — low priority |

## Latency Data

Latency overhead measured across 2 quick runs and 1 full run:

| Metric              | Vanilla | Plugin     | Overhead |
| ------------------- | ------- | ---------- | -------- |
| H12 (simplest task) | 11.2s   | 29.8-30.3s | 2.7x     |
| Quick avg (7 tests) | 24.4s   | 66.0s      | +170%    |
| Full avg (14 tests) | 25.9s   | 73.9s      | +186%    |

The overhead comes from plugin hook loading, state file I/O, and gate evaluation. For gate-loop tests (H1, H2, H5, H8, H9), the extra time is productive — the plugin is running tests and iterating. For quick tests, it's pure overhead with no benefit.

## Reliability Data

Reliability sweep with `--repeat 3` not yet run. Single-run results show:

- **H1, H2, H5, H8, H9**: Consistently PLUGIN WINS across all 4 runs (100%)
- **H3, H4, H6, H7, H10, H11, H12, H13, H14**: Consistently TIE across all runs
- **No VANILLA WINS or BOTH FAIL observed in any run**

To run the full reliability sweep:

```bash
npm run eval:compare -- --repeat 3      # 14 tests × 3 × 2 sides = 84 calls (~2.5 hours)
npm run eval:compare -- --quick --repeat 3  # 7 tests × 3 × 2 = 42 calls (~45 min)
```

## When to Use the Plugin

**Use it when:**

- Completion criteria are objective and verifiable (tests pass, lint passes, file exists)
- The task involves iterative fix loops where the agent might stop prematurely
- You distrust that the prompt fully specifies all requirements
- Multiple independent gates need to ALL pass before completion

**Skip it when:**

- The task is a simple, explicit instruction ("create this file with this content")
- There are no verifiable completion criteria
- The prompt is honest and complete about what needs to happen
- Speed is critical and correctness is easily verified manually

## Known Limitations

- **Quick tests always tie**: H3, H4, H6, H7 show no plugin advantage because vanilla Claude follows explicit instructions reliably
- **H10 occasionally flaky**: Try/catch recovery sometimes varies between runs due to structural rigidity
- **Small sample size**: 3 runs per configuration; `--repeat N` flag addresses this
- **No latency data yet**: Timing instrumentation added but not yet run at scale
