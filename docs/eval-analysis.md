# Comparative Evaluation Analysis

## Executive Summary

The prompt-language plugin wins **13 out of 33 tested** hypotheses (45 total, 12 pending) against vanilla Claude in controlled A/B testing with `--repeat 3` reliability sweep (190+ `claude -p` calls). **30 of 31 core hypotheses (H1-H31) are 100% reliable** — one (H31) showed flakiness (TIE 2/3, VANILLA 1/3). H33 produced a vanilla win due to a test infrastructure issue (plugin flow engine hung). The plugin's value lies in **structural enforcement** — gate predicates that mechanically verify completion criteria regardless of what the prompt says. When the prompt is honest and explicit, vanilla Claude performs equally well. When the prompt misleads, omits, or narrows focus, the plugin's gates catch what Claude's self-discipline misses. Context management (variable capture + interpolation) shows no measurable correctness advantage at tested distances: both short-range (2-4 steps, H29-H31) and long-range (7 steps, H32) produce ties. The plugin adds ~220% latency overhead (avg 93.3s vs 29.2s vanilla).

## What the Plugin Actually Changes

The hypothesis-by-hypothesis data below tells you which tests won. This section tells you what it means in practice.

### Gates are the only thing that matters

Every plugin win shares one trait: a `done when:` gate that mechanically verifies something the prompt didn't mention or actively lied about. Strip away the DSL syntax and control flow, and the plugin's value reduces to a single sentence: **it runs a command before letting Claude stop.**

The numbers:

- **13/33 plugin wins** — all from gates enforcing criteria the prompt omitted or contradicted
- **19/33 ties** — all cases where the prompt was honest and complete
- **0 plugin-only wins from flow control** — every win involves a gate
- **1 flaky result** (H31: VANILLA 1/3, TIE 2/3)
- **1 infra issue** (H33: plugin flow engine hung on 10-node sequential flow)

Six proven gate patterns, each 100% reliable across 3 iterations:

| Pattern                  | What happens                                       | Examples         |
| ------------------------ | -------------------------------------------------- | ---------------- |
| Gaslighting resistance   | Prompt lies ("tests pass"), gate runs them anyway  | H2, H9, H22, H26 |
| Narrow framing escape    | Prompt focuses on one bug, gate catches all        | H1, H8, H25      |
| Omitted concern          | Prompt says "tests", gate adds "lint"              | H5, H18, H24     |
| Diff enforcement         | Prompt says "review", gate forces changes          | H17              |
| Inverted gate predicate  | Gate requires failure state (tests_fail/lint_fail) | H23, H27         |
| Gaslighting + loop combo | Deceptive prompt + while loop with gate            | H22, H25         |

The common thread: Claude trusts the prompt. Gates don't. When the prompt is wrong, gates catch it. When the prompt is right, gates add nothing.

### Flow control doesn't help

`while`, `retry`, `if`, `try` — all the control-flow nodes replicate behavior Claude already exhibits when given clear instructions. The data is unambiguous:

- H6 (retry): TIE. Vanilla retries when told to.
- H10 (try/catch): TIE. Both recover from errors.
- H14 (nested if/retry): TIE. Both handle multi-step recovery.
- H15 (4-phase drip-feed): TIE with 4x latency overhead.
- H16 (per-module pipeline): TIE with 7.5x latency overhead.
- H19 (while command_failed loop): TIE. Both fix 4/4 bugs.
- H20 (if/else variable branching): TIE. Both route correctly.
- H21 (until tests_pass loop): TIE. Both achieve 9/9 assertions.

Sequential `prompt:` + `run:` pipelines are the worst offender. They force serial execution through the plugin's hook machinery, adding 2-7x latency while achieving identical correctness. Claude follows explicit multi-step instructions reliably without scaffolding.

**Use control flow for organizational clarity if you want, but don't expect it to improve outcomes.**

### Context management: convenience, not correctness

The plugin's variable system (`let x = run "cmd"` + `${x}` interpolation) lets you architect what information reaches each prompt step. The H29-H31 experiments tested three scenarios: conflicting coding style rules (H29), information quarantine between server/client configs (H30), and focused review with distractor resistance (H31).

**Result: all three TIE (H31 flaky — vanilla won 1/3).** At 2-4 step distances, vanilla Claude accurately recalls values from earlier in the conversation. The plugin's variable injection doesn't improve correctness at this range.

H32 (Token Relay at Distance) extends the test to 7 steps: capture a 24-char hex token, perform 5 intervening bug-fix tasks, then recall the exact token. **Result: TIE.** Both vanilla and plugin recalled the exact hex string. H33 (Multi-Source Aggregate, 11 steps) was inconclusive — the plugin side hung for 9.5 hours due to a test infrastructure issue (flow engine timeout with 10-node sequential flow). H34-H35 remain untested.

The data so far: at distances up to 7 steps with significant intervening work, vanilla Claude's in-context memory is sufficient for exact value recall. **This conclusion is limited to tested distances (2-7 steps).** Academic research on attention dilution ("Lost in the Middle") predicts degradation at 15+ steps where middle-context tokens receive 30%+ less attention weight. The re-injection advantage of `renderVariables()` may emerge at longer distances — this remains untested.

**Use variables for readability and composition. Correctness advantage is unproven at short distances but theoretically plausible at longer ones.**

### The cost: latency

Every plugin invocation pays a tax for hook loading, state file I/O, and gate evaluation:

| Scenario                | Vanilla | Plugin   | Overhead |
| ----------------------- | ------- | -------- | -------- |
| Simplest task (H12)     | 10-13s  | 28-34s   | 2.7x     |
| Average across 31 tests | 29.2s   | 93.3s    | +220%    |
| Phased audit (H15)      | 55-71s  | 191-300s | 4.0x     |
| Modular build (H16)     | 34-45s  | 146-270s | 5-7x     |

For gate-loop tests (H1, H2, H5, H8, H9, H17, H18, H22-H27), the extra time is productive — the plugin is running tests and iterating until they pass. For phased prompts and simple tasks, it's pure overhead.

**Rule of thumb**: pay the latency cost when gates enforce correctness you can't get otherwise. Skip it when the prompt honestly describes the task and you can verify the result yourself.

### Decision guide

| Situation                                                                                                  | Use plugin? | Why                                                |
| ---------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------- |
| Task has verifiable completion criteria (tests, lint, file exists) that the prompt might not fully specify | Yes         | Gates catch what prompts miss                      |
| You distrust the prompt (generated, copied, or deliberately adversarial)                                   | Yes         | Gaslighting resistance                             |
| You need to force code changes, not just review                                                            | Yes         | `diff_nonempty` gate                               |
| Multiple independent criteria must all pass                                                                | Yes         | Compound gates                                     |
| You need the agent to produce a specific failure state                                                     | Yes         | Inverted gates (`tests_fail`, `lint_fail`)         |
| You want to control what context reaches each prompt step                                                  | No          | Variable capture adds convenience, not correctness |
| Task is simple and well-specified                                                                          | No          | Vanilla matches correctness, 2-3x faster           |
| You're using phased prompts for organizational structure                                                   | No          | 4-7x slower, no correctness gain                   |
| Speed matters and you'll verify the result manually                                                        | No          | Plugin adds overhead without benefit               |

## Taxonomy of Differentiators

| Category                  | Mechanism                                      | Hypotheses         | Win Rate                              | Pattern                                      |
| ------------------------- | ---------------------------------------------- | ------------------ | ------------------------------------- | -------------------------------------------- |
| Gaslighting resistance    | Gate ignores false claims about state          | H2, H9, H22, H26   | 4/4 (100%)                            | Prompt lies; gate runs tests anyway          |
| Narrow framing resistance | Gate checks broader criteria than prompt       | H1, H8, H25        | 3/3 (100%)                            | Prompt focuses on subset; gate catches rest  |
| Omitted concern           | Multiple gates enforce unstated requirements   | H5, H18, H24       | 3/3 (100%)                            | Prompt mentions tests; gate adds lint/readme |
| Diff enforcement          | `diff_nonempty` gate forces code changes       | H17                | 1/1 (100%)                            | Review-only vs forced modification           |
| Inverted gate predicate   | `tests_fail`/`lint_fail` gate                  | H23, H27           | 2/2 (100%)                            | Write failing test / force lint failure      |
| Mechanical execution      | Auto-exec, variable capture, retry loops       | H3, H4, H6, H7     | 0/4 (all TIE)                         | Vanilla follows explicit instructions fine   |
| Recovery scaffolding      | try/catch control flow                         | H10                | 0/1 (TIE)                             | Both recover reliably                        |
| Long pipeline             | 8 sequential run: nodes                        | H11                | 0/1 (TIE)                             | Both complete 8-step chains                  |
| Latency measurement       | Simplest task, timing comparison               | H12                | 0/1 (TIE)                             | 10-13s vanilla vs 28-34s plugin (2.7x)       |
| File-exists gate          | `file_exists` gate predicate                   | H13                | 0/1 (TIE)                             | Both create the file from instructions       |
| Nested control flow       | if + retry nesting                             | H14                | 0/1 (TIE)                             | Both handle config + bug fix                 |
| Attention focus           | Phased prompts drip-feed categories            | H15                | 0/1 (TIE)                             | Both fix 12/12; plugin 3-6x slower           |
| Progressive construction  | Per-module validation in pipeline              | H16                | 0/1 (TIE)                             | Both achieve 14/14; plugin 5-6x slower       |
| While-loop iteration      | `while command_failed` mechanical re-test      | H19                | 0/1 (TIE)                             | Both fix 4/4 bugs                            |
| Variable-driven branching | `let x = run` + `if command_failed` routing    | H20                | 0/1 (TIE)                             | Both pass 4/4 checks                         |
| Until-loop quality gate   | `until tests_pass max 5` with escalating hints | H21                | 0/1 (TIE)                             | Both achieve 9/9 assertions                  |
| Custom gate command       | Explicit `command:` on gate predicate          | H28                | 0/1 (TIE)                             | Both produce correct output                  |
| Context management        | Selective variable injection per step          | H29, H30, H31      | 0/3 (FLAKY H31)                       | No advantage at 2-4 step distances           |
| Long-horizon context      | Value preservation over 7-11 steps             | H32, H33, H34, H35 | 0/2 tested (TIE H32, infra issue H33) | H34-H35 not yet run                          |
| Gate + long-horizon       | Gate enforcement at 8-step distance            | H36                | pending                               | Tests if gate wins at distance               |
| Inverted gate + gaslight  | tests_fail gate + deceptive prompt             | H37                | pending                               | Strongest adversarial inverted gate case     |
| Compound deception        | Triple gate vs triple lie                      | H38                | pending                               | Multi-lie vs multi-gate                      |
| Context distance scaling  | Token recall across 15 steps                   | H39                | pending                               | Finding TIE-to-PLUGIN threshold              |
| Multi-task completion     | 10 tasks in one prompt vs separate steps       | H40                | pending                               | Tests task-drop rate at list length 10       |
| Context window pressure   | Token extraction from 2000-line file           | H41                | pending                               | Tests recall at ~50K tokens of context       |

## Six Winning Patterns

### 1. Gaslighting Resistance (H2, H9, H22, H26) — 100% reliable

The prompt explicitly lies about the current state: "tests already pass" or "I already fixed everything." Vanilla Claude trusts the prompt and skips verification. The plugin's `done when: tests_pass` gate ignores the lie and mechanically runs `npm test`, discovering failures.

- **H2**: Prompt says "tests already pass, no need to run them." Vanilla renames a function and stops. Plugin gate runs tests, finds null-handling and division-by-zero bugs, forces fixes.
- **H9**: Prompt says "I already fixed and tested everything — just review code style." Vanilla reviews style. Plugin gate runs tests, finds 3 bugs across 3 modules, forces fixes.
- **H22**: Prompt says "there's only one bug — fix formatDate." Code has 4 bugs. `while tests_fail` loop + gate keeps fixing until all 4 pass. Vanilla: 1/4 fixed.
- **H26**: Prompt says "code looks fine, just add null checks." Code has SQL injection via string concatenation. Plugin's `let` captures specific fix instructions + gate runs tests. Vanilla: null fixed, SQL injection missed.

### 2. Narrow Framing Escape (H1, H8, H25) — 100% reliable

The prompt focuses Claude's attention on one specific issue, but the test suite checks broader correctness. Vanilla fixes what it's told to fix and stops. The plugin's gate catches everything the test suite covers.

- **H1**: Prompt says "fix the ReferenceError crash." Vanilla fixes `nme -> name` but misses `a * a -> a * b`. Plugin gate requires all tests to pass, catching both bugs.
- **H8**: Prompt says "run the self-test" — a built-in test that only covers happy paths (5/5 pass). Real test.js tests edge cases (empty string). Plugin gate runs `npm test` (real tests), not `node app.js` (self-test).
- **H25**: Prompt says "there's a bug in the auth module." Code has 3 bugs across auth, cache, and API modules. `let`/`if` routing + gate catches all 3. Vanilla: 2/5 assertions pass.

### 3. Omitted Concern (H5, H18, H24) — 100% reliable

The prompt mentions one requirement but the gate enforces additional ones. Vanilla fixes what's asked. The plugin catches the unstated requirement.

- **H5**: Prompt says "fix greet() so tests pass." Plugin has `done when: tests_pass` AND `lint_pass` — catches `var` keyword in utils.js that vanilla has no reason to touch.
- **H18**: Prompt says "fix the bugs so tests pass." Plugin combines `retry max 3` with dual gates `tests_pass` + `lint_pass` — retry iterates on test failures, lint gate catches the `var` keyword.
- **H24**: Prompt says "fix the test failures." Plugin has `done when: tests_pass` + `lint_pass` + `file_exists README.md` — vanilla fixes tests (1/3), plugin hits all three criteria (3/3).

### 4. Diff Enforcement (H17) — 100% reliable

The prompt asks for review, not modification. Vanilla describes improvements without changing code. Plugin's `diff_nonempty` gate forces actual file modifications.

- **H17**: Prompt says "review calculator.js, write observations." Vanilla creates review.txt but doesn't touch calculator.js. Plugin's `diff_nonempty` gate requires code changes, so the swapped add/subtract implementations get fixed.

### 5. Inverted Gate Predicate (H23, H27) — 100% reliable

Gates that require a failure state — the opposite of what prompts typically aim for.

- **H23**: Prompt says "write tests for divide()." Plugin's `tests_fail` gate requires tests to FAIL — forces a division-by-zero edge case test. Vanilla writes passing tests only.
- **H27**: Prompt says "add a comment to utils.js." Plugin's `lint_fail` gate requires lint to FAIL — forces introduction of a `var` keyword. Vanilla adds a comment that doesn't break lint.

### 6. Gaslighting + Loop Combo (H22, H25) — 100% reliable

Deceptive prompts combined with loop constructs and gates. The loop iterates past the lie, and the gate ensures completeness.

- **H22**: "Only one bug" lie + `while tests_fail` loop. Loop iterates, gate verifies. Vanilla: 1/4, plugin: 4/4.
- **H25**: "One bug in auth" lie + `let`/`if` diagnostic routing. Captures errors from all modules, fixes each. Vanilla: 2/5, plugin: 5/5.

## Why Quick Tests Always TIE

Hypotheses H3, H4, H6, and H7 test mechanical execution: variable capture, pipeline sequencing, retry loops, and multi-step interpolation. These always tie because vanilla Claude follows explicit DSL-like instructions reliably.

The key insight: **the plugin adds no value when the prompt honestly and completely describes what needs to happen.** Claude already executes sequential steps, retries on failure, and passes values between commands when told to. The plugin's auto-execution and variable capture merely replicate what Claude does naturally with good instructions.

This means the plugin's value is exclusively in **enforcement of invariants the prompt doesn't mention or actively contradicts** — i.e., gates.

## Where Plugin HURTS

### H15/H16: Phased prompts add latency without benefit

H15 (Phased Code Audit) and H16 (Progressive Modular Build) both TIE consistently, but the plugin takes 3-6x longer. The phased prompt approach forces sequential execution that doesn't improve correctness — Claude fixes all bugs and builds all modules correctly either way. The overhead is pure waste.

**Takeaway**: Phased prompts (multiple sequential `prompt:` + `run:` nodes) don't add correctness when the task is well-specified. Use them only for organizational clarity, not enforcement.

### H10: Try/catch rigidity (TIE, consistently)

In the reliability sweep, H10 was consistently TIE (3/3). The structural rigidity of `try/catch` doesn't improve on Claude's natural error recovery.

**Takeaway**: Use gates liberally but use control flow (try/catch, if/else) sparingly — only when the recovery path is well-understood and predictable.

### H29-H31: Context management adds no correctness

All three context management experiments TIE (with H31 showing one VANILLA WIN in 3 runs). At short distances (2-4 steps between variable capture and use), vanilla Claude recalls values accurately. The plugin's variable injection is a convenience feature, not a correctness mechanism.

**Takeaway**: Use variables for readability and composition. Don't expect them to improve outcomes at short distances.

## Hypothesis-by-Hypothesis Results

| ID  | Name                          | Category                  | Mechanism                                       | Verdict     | Reliability            | Notes                                    |
| --- | ----------------------------- | ------------------------- | ----------------------------------------------- | ----------- | ---------------------- | ---------------------------------------- |
| H1  | Hidden Second Bug             | Narrow framing            | Gate catches all test failures                  | **PLUGIN**  | 3/3 (100%)             | Vanilla fixes crash, misses logic bug    |
| H2  | Gaslighting "Tests Pass"      | Gaslighting               | Gate ignores "no need to test" lie              | **PLUGIN**  | 3/3 (100%)             | Consistent across all runs               |
| H3  | Hash Fidelity                 | Variable capture          | `let x = run` captures stdout                   | TIE         | 3/3 (100%)             | Both relay hex correctly                 |
| H4  | Pipeline Auto-Exec            | Sequential execution      | 3 chained `run:` nodes                          | TIE         | 3/3 (100%)             | Vanilla follows instructions fine        |
| H5  | Dual Gate                     | Omitted concern           | `tests_pass` + `lint_pass`                      | **PLUGIN**  | 3/3 (100%)             | Vanilla has no reason to lint            |
| H6  | Flaky Retry                   | Retry loop                | `retry max 5`                                   | TIE         | 3/3 (100%)             | Vanilla retries when told to             |
| H7  | Variable Chain                | Multi-step interpolation  | 4 chained `let = run`                           | TIE         | 3/3 (100%)             | Both chain values correctly              |
| H8  | Misleading Console Output     | Narrow framing            | Gate runs real tests, not self-test             | **PLUGIN**  | 3/3 (100%)             | Self-test passes, real tests fail        |
| H9  | Iterative Multi-Bug Fix       | Gaslighting               | Gate discovers unfixed bugs                     | **PLUGIN**  | 3/3 (100%)             | "Already fixed" is a lie                 |
| H10 | Try/Catch Recovery            | Error recovery            | `try/catch` control flow                        | TIE         | 3/3 (100%)             | Both recover reliably                    |
| H11 | Long Pipeline                 | Sequential execution      | 8 chained `run:` nodes                          | TIE         | 3/3 (100%)             | Both complete all 8 steps                |
| H12 | Latency Overhead              | Timing baseline           | Simplest possible task                          | TIE         | 3/3 (100%)             | 10-13s vanilla, 28-34s plugin (2.7x)     |
| H13 | File-Exists Gate              | File gate                 | `file_exists dist/bundle.js`                    | TIE         | 3/3 (100%)             | Both follow build instructions           |
| H14 | Nested Control Flow           | Nested if/retry           | Multi-step recovery + gate                      | TIE         | 3/3 (100%)             | Both handle config + bug fix             |
| H15 | Phased Code Audit             | Attention focus           | 4-phase drip-feed prompts                       | TIE         | 3/3 (100%)             | Both 12/12; plugin 3-6x slower           |
| H16 | Progressive Modular Build     | Per-phase validation      | Module-by-module tests                          | TIE         | 3/3 (100%)             | Both 14/14; plugin 5-7x slower           |
| H17 | diff_nonempty Gate            | Diff enforcement          | `diff_nonempty` gate predicate                  | **PLUGIN**  | 3/3 (100%)             | Vanilla reviews; plugin forces changes   |
| H18 | Gate + Retry Combo            | Gate + control flow       | `retry` + `tests_pass` + `lint_pass`            | **PLUGIN**  | 3/3 (100%)             | Retry + dual gate catches lint           |
| H19 | While-Loop Fix Cycle          | While-loop iteration      | `while command_failed` re-test                  | TIE         | 3/3 (100%)             | Both fix 4/4 bugs                        |
| H20 | Conditional Branch + Var      | Variable branching        | `let x = run` + `if` routing                    | TIE         | 3/3 (100%)             | Both pass 4/4 checks                     |
| H21 | Until-Loop Quality Gate       | Until-loop                | `until tests_pass max 5`                        | TIE         | 3/3 (100%)             | Both achieve 9/9 assertions              |
| H22 | Gaslighting + While Loop      | Gaslighting + loop        | `while` + prompt lies about count               | **PLUGIN**  | 3/3 (100%)             | 4 bugs, prompt mentions only 1           |
| H23 | Inverted Gate — Fail Test     | Inverted gate             | `tests_fail` gate predicate                     | **PLUGIN**  | 3/3 (100%)             | Write failing test, don't fix code       |
| H24 | Triple Gate Enforcement       | Triple gate               | `tests_pass`+`lint_pass`+`file_exists`          | **PLUGIN**  | 3/3 (100%)             | 3 independent completion criteria        |
| H25 | Diagnostic Route + Gaslight   | Narrow framing + gaslight | `let`/`if` + misleading prompt                  | **PLUGIN**  | 3/3 (100%)             | 5/5 vs 2/5 assertions                    |
| H26 | let-prompt Capture + Gaslight | Gaslighting + let-prompt  | `let x = prompt` variable capture               | **PLUGIN**  | 3/3 (100%)             | SQL injection hidden, prompt says "fine" |
| H27 | lint_fail Inverted Gate       | Inverted gate             | `lint_fail` gate predicate                      | **PLUGIN**  | 3/3 (100%)             | Force lint failure via var keyword       |
| H28 | Custom Gate Command           | Custom gate               | Explicit `command:` on gate                     | TIE         | 3/3 (100%)             | Both produce correct output              |
| H29 | Conflicting Style Rules       | Context management        | Selective var injection per step                | TIE         | 3/3 (100%)             | Both handle opposite styles correctly    |
| H30 | Information Quarantine        | Context management        | Selective var injection per step                | TIE         | 3/3 (100%)             | Both produce zero-leakage configs        |
| H31 | Focused Review — Distractor   | Context management        | Selective var injection per step                | TIE (FLAKY) | TIE 2/3, VAN 1/3 (67%) | First flaky result; vanilla won once     |
| H32 | Token Relay at Distance       | Long-horizon context      | Value recall across 7 steps                     | TIE         | 1/1 (100%)             | Both recalled exact 24-char hex          |
| H33 | Multi-Source Aggregate        | Long-horizon context      | 5-value recall across 11 steps                  | VANILLA     | 1/1 (infra)            | Plugin hung 9.5h; test design issue      |
| H34 | Spec Anchoring Under Drift    | Long-horizon context      | Config values across 6 steps                    | pending     | —                      | Unusual values after source deletion     |
| H35 | Error Forensics               | Long-horizon context      | 4 error codes across 9 steps                    | pending     | —                      | Exact error messages in postmortem       |
| H36 | Gate + Long Horizon           | Gate + long-horizon       | Gate at step 8 after 5 distractor tasks         | pending     | —                      | Tests if gate wins at distance           |
| H37 | Inverted Gate + Deception     | Inverted gate + gaslight  | tests_fail + "code is correct" lie              | pending     | —                      | Strongest adversarial inverted gate case |
| H38 | Compound Deception            | Triple gate + triple lie  | 3 lies targeting 3 gate criteria                | pending     | —                      | Multi-lie vs multi-gate                  |
| H39 | Context Scaling (15 Steps)    | Context distance          | Token recall across 15 steps                    | pending     | —                      | Finding the TIE-to-PLUGIN threshold      |
| H40 | Multi-Task Completion (10)    | Multi-task completion     | 10 utility files in one vs separate             | pending     | —                      | Tests task-drop rate at list length 10   |
| H41 | Context Window Pressure       | Context window pressure   | Token in 2000-line file                         | pending     | —                      | Tests recall at ~50K tokens of context   |
| H42 | Skill vs Raw DSL              | Delivery mechanism        | Same fix-test loop: NL instructions vs DSL flow | pending     | —                      | Tests whether delivery format matters    |
| H43 | Multi-Task Degradation (8)    | Multi-task completion     | 8 files with specific tokens                    | pending     | —                      | Tests token accuracy at list length 8    |
| H44 | Context Pressure (Distractor) | Context window pressure   | Distractor-saturated context + token recall     | pending     | —                      | Tests recall with ~30K tokens of noise   |
| H45 | Distractor Resistance         | Distractor resistance     | Misleading files + simple syntax fix            | pending     | —                      | Tests whether flow prevents sidetracking |

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

### Run 6 (Complete 31 hypotheses — H22-H31 added, --repeat 3 reliability sweep)

- **186 total `claude -p` calls** (31 tests x 3 iterations x 2 sides)
- Plugin: 13 wins | Vanilla: 0-1 wins | Ties: 17-18 | Both fail: 0
- **6 new plugin wins**: H22, H23, H24, H25, H26, H27 — all gate-based
- **H19-H21 fixed**: all TIE (scoring bug resolved)
- **H28 TIE**: custom gate command — vanilla followed instructions correctly
- **H29-H31 TIE**: context management shows no advantage at short distances
- **H31 FLAKY**: First flakiness in the eval — VANILLA won 1/3 (Focused Review)
- **Near-zero flakiness**: 30/31 hypotheses identical across all 3 iterations
- Avg latency: Plugin 93.3s, Vanilla 29.2s (+220% overhead)

### Run 7 (H32-H35 long-horizon context — partial, sweep interrupted)

- Only iteration 1 of 3 completed for H32-H33 before sweep was stopped
- **H32 TIE**: Both vanilla and plugin recalled exact 24-char hex token across 5 bug-fix tasks (7 steps)
- **H33 VANILLA WINS (infra issue)**: Vanilla completed 5/5 hashes in 106.8s. Plugin side hung for 34079.7s (~9.5h) — the 10-node sequential flow (5 `let` + 5 `prompt`) caused the plugin flow engine to stall. This is a test infrastructure issue, not a context management finding.
- **H34-H35**: Not reached before sweep was interrupted
- Key finding: at 7-step distance with significant intervening work (H32), vanilla Claude's in-context memory matches plugin variable injection for exact value recall

## Remaining Gaps

| Priority | Capability                      | Status                                                                             |
| -------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| High     | Re-run H6, H20, H24, H28, H34   | Fairness defects fixed (code review); results may change — needs re-run            |
| High     | Gate + long-horizon combination | No hypothesis tests gates at 10+ step distances — strongest untested combination   |
| High     | Context scaling threshold       | "No value" conclusion based on 2-7 steps only; need 15/20/25-step parametric test  |
| Medium   | H34-H35 long-horizon context    | Implemented, not yet run                                                           |
| Medium   | H33 test design fix             | Plugin side hangs on 10-node sequential flow; needs timeout or flow simplification |
| Low      | H31 flakiness investigation     | Vanilla won 1/3 — needs analysis                                                   |
| Low      | H29 scoring fix validation      | Arrow detection, double-eq regex, cross-contamination fixes applied — needs re-run |

## Latency Data

Latency overhead measured across reliability sweep (`--repeat 3`, 31 hypotheses):

| Metric                          | Vanilla | Plugin   | Overhead |
| ------------------------------- | ------- | -------- | -------- |
| H12 (simplest task, 3 runs)     | 10-13s  | 28-34s   | 2.7x     |
| Quick avg (7 tests)             | 24-26s  | 66-100s  | +170%    |
| Full avg (31 tests, --repeat 3) | 29.2s   | 93.3s    | +220%    |
| H15 Phased Audit avg            | 48-71s  | 191-300s | 4.0x     |
| H16 Progressive Build avg       | 34-45s  | 146-270s | 5-7x     |

The overhead comes from plugin hook loading, state file I/O, and gate evaluation. For gate-loop tests, the extra time is productive — the plugin is running tests and iterating. For quick tests and phased prompts, it's pure overhead with no benefit.

## Reliability Data

Full reliability sweep with `--repeat 3` (186 total calls):

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
H19: While-Loop Fix Cycle       — TIE 3/3 (100%)
H20: Conditional Branch + Var   — TIE 3/3 (100%)
H21: Until-Loop Quality Gate    — TIE 3/3 (100%)
H22: Gaslighting + While Loop   — PLUGIN 3/3 (100%)
H23: Inverted Gate — Fail Test  — PLUGIN 3/3 (100%)
H24: Triple Gate Enforcement    — PLUGIN 3/3 (100%)
H25: Diagnostic Route + Gaslight— PLUGIN 3/3 (100%)
H26: let-prompt Capture + Gas.  — PLUGIN 3/3 (100%)
H27: lint_fail Inverted Gate    — PLUGIN 3/3 (100%)
H28: Custom Gate Command        — TIE 3/3 (100%)
H29: Conflicting Style Rules    — TIE 3/3 (100%)
H30: Information Quarantine     — TIE 3/3 (100%)
H31: Focused Review — Distractor— VANILLA 1/3, TIE 2/3 (67% FLAKY)
H32: Token Relay at Distance   — TIE 1/1 (partial — sweep interrupted)
H33: Multi-Source Aggregate    — VANILLA 1/1 (infra issue — plugin hung 9.5h)
H34: Spec Anchoring Under Drift— not yet run
H35: Error Forensics           — not yet run
```

**30/31 hypotheses 100% reliable. 1 flaky (H31). H33 inconclusive (infrastructure). H34-H35 pending.**

## When to Use the Plugin

**Use it when:**

- Completion criteria are objective and verifiable (tests pass, lint passes, file exists, diff nonempty)
- The task involves iterative fix loops where the agent might stop prematurely
- You distrust that the prompt fully specifies all requirements
- Multiple independent gates need to ALL pass before completion
- You need to force actual code changes (not just review)
- You need the agent to produce a failure state (inverted gates)

**Skip it when:**

- The task is a simple, explicit instruction ("create this file with this content")
- There are no verifiable completion criteria
- The prompt is honest and complete about what needs to happen
- Speed is critical and correctness is easily verified manually
- You're using phased prompts for organizational clarity (no correctness benefit, high latency cost)
- You're using variables solely for context management at short distances (no correctness benefit)

## Known Limitations

- **Quick tests always tie**: H3, H4, H6, H7 show no plugin advantage because vanilla Claude follows explicit instructions reliably
- **Phased prompts add latency without benefit**: H15/H16 show 4-7x overhead with no correctness gain
- **Context management doesn't improve correctness at short range**: H29-H31 all TIE (H31 flaky)
- **H31 is flaky**: The only hypothesis that produces different verdicts across iterations (VANILLA 1/3, TIE 2/3)
- **No consistent VANILLA WINS**: Even H31's vanilla win was not reproducible (67% not 100%)
- **H33 test infrastructure issue**: Plugin side hung for 9.5h on a 10-node sequential flow (5 `let` + 5 `prompt`). Needs investigation — likely flow engine timeout or state advancement stall with many sequential auto-advancing nodes
