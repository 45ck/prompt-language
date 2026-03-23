# Comparative Evaluation Analysis

## Executive Summary

The prompt-language plugin wins **15 out of 45** hypotheses against vanilla Claude in controlled A/B testing with `--repeat 3` reliability sweep (300+ `claude -p` calls). **All 45 hypotheses are now tested.** 44/45 are 100% reliable; H31 is flaky (TIE 2/3, VANILLA 1/3). H40-H45 (multi-task, context pressure, distractor resistance) all TIE — Claude handles 10-task lists, 2000-line files, and distractor-saturated contexts without plugin assistance. The plugin's value lies in **structural enforcement** — gate predicates that mechanically verify completion criteria regardless of what the prompt says. When the prompt is honest and explicit, vanilla Claude performs equally well. When the prompt misleads, omits, or narrows focus, the plugin's gates catch what Claude's self-discipline misses. Context management (variable capture + interpolation) shows no measurable correctness advantage at any tested distance (2-15 steps). The plugin adds ~196-316% latency overhead.

## Known Issues

### Sequential auto-advancing node hang

**Severity**: High — can cause indefinite hangs.

Flows with 10+ sequential auto-advancing nodes (e.g., 5 `let` + 5 `prompt` nodes in a row) may hang indefinitely. This was observed during H33 testing where the plugin side hung for 9.5 hours.

**Workaround**: Keep sequential chains of auto-advancing nodes (`let`, `var`) under 8 nodes. Break long sequences with `run:` or `prompt:` nodes that require agent interaction.

**Status**: Under investigation. See [Troubleshooting](troubleshooting.md#long-sequential-flows-hanging) for details.

## What the Plugin Actually Changes

The hypothesis-by-hypothesis data below tells you which tests won. This section tells you what it means in practice.

### Gates are the only thing that matters

Every plugin win shares one trait: a `done when:` gate that mechanically verifies something the prompt didn't mention or actively lied about. Strip away the DSL syntax and control flow, and the plugin's value reduces to a single sentence: **it runs a command before letting Claude stop.**

The numbers:

- **15/45 plugin wins** — all from gates enforcing criteria the prompt omitted or contradicted
- **28/45 ties** — all cases where the prompt was honest and complete
- **0 plugin-only wins from flow control** — every win involves a gate
- **1 flaky result** (H31: VANILLA 1/3, TIE 2/3)
- **2 both-fail** (H35: auth cross-contamination, H38: compound deception too hard for both)

Six proven gate patterns, each 100% reliable across 3 iterations:

| Pattern                  | What happens                                       | Examples     |
| ------------------------ | -------------------------------------------------- | ------------ |
| Gaslighting resistance   | Prompt lies ("tests pass"), gate runs them anyway  | H2, H9, H26  |
| Narrow framing escape    | Prompt focuses on one bug, gate catches all        | H1, H8, H25  |
| Omitted concern          | Prompt says "tests", gate adds "lint"              | H5, H18, H24 |
| Diff enforcement         | Prompt says "review", gate forces changes          | H17          |
| Inverted gate predicate  | Gate requires failure state (tests_fail/lint_fail) | H23, H27     |
| Gaslighting + loop combo | Deceptive prompt + while loop with gate            | H22, H25     |

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

H32-H35 (redesigned as style isolation, config quarantine, late callback, multi-auth) extend the test to longer horizons. **H32-H34 TIE (all confirmed at 3/3).** H35 (multi-auth route generation) was BOTH FAIL — both sides showed auth cross-contamination at 5-pattern complexity. H39 extends to 15 steps: **TIE 3/3 (100%)** — both tracked a token perfectly across 15 steps of intervening work.

H40-H45 test additional pressure vectors: 10-task completion lists (H40), 2000-line file token extraction (H41), skill vs raw DSL delivery (H42), 8-token degradation (H43), distractor-saturated context (H44), and misleading-file distractor resistance (H45). **All TIE 3/3.** Claude handles these scenarios without plugin assistance.

The data so far: at distances up to 15 steps with significant intervening work, and under context pressure up to 2000+ lines with distractors, vanilla Claude's in-context memory is sufficient for exact value recall. The "Lost in the Middle" degradation predicted by academic research has not materialized in our tests. The re-injection advantage of `renderVariables()` may emerge at longer distances (20+ steps) or with larger intervening context — this remains untested.

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

| Category                  | Mechanism                                      | Hypotheses         | Win Rate           | Pattern                                      |
| ------------------------- | ---------------------------------------------- | ------------------ | ------------------ | -------------------------------------------- |
| Gaslighting resistance    | Gate ignores false claims about state          | H2, H9, H26        | 3/3 (100%)         | Prompt lies; gate runs tests anyway          |
| Narrow framing resistance | Gate checks broader criteria than prompt       | H1, H8, H25        | 3/3 (100%)         | Prompt focuses on subset; gate catches rest  |
| Omitted concern           | Multiple gates enforce unstated requirements   | H5, H18, H24, H36  | 4/4 (100%)         | Prompt mentions tests; gate adds lint/readme |
| Diff enforcement          | `diff_nonempty` gate forces code changes       | H17                | 1/1 (100%)         | Review-only vs forced modification           |
| Inverted gate predicate   | `tests_fail`/`lint_fail` gate                  | H23, H27, H37      | 3/3 (100%)         | Write failing test / force lint failure      |
| Mechanical execution      | Auto-exec, variable capture, retry loops       | H3, H4, H6, H7     | 0/4 (all TIE)      | Vanilla follows explicit instructions fine   |
| Recovery scaffolding      | try/catch control flow                         | H10                | 0/1 (TIE)          | Both recover reliably                        |
| Long pipeline             | 8 sequential run: nodes                        | H11                | 0/1 (TIE)          | Both complete 8-step chains                  |
| Latency measurement       | Simplest task, timing comparison               | H12                | 0/1 (TIE)          | 10-13s vanilla vs 28-34s plugin (2.7x)       |
| File-exists gate          | `file_exists` gate predicate                   | H13                | 0/1 (TIE)          | Both create the file from instructions       |
| Nested control flow       | if + retry nesting                             | H14                | 0/1 (TIE)          | Both handle config + bug fix                 |
| Attention focus           | Phased prompts drip-feed categories            | H15                | 0/1 (TIE)          | Both fix 12/12; plugin 3-6x slower           |
| Progressive construction  | Per-module validation in pipeline              | H16                | 0/1 (TIE)          | Both achieve 14/14; plugin 5-6x slower       |
| While-loop iteration      | `while command_failed` mechanical re-test      | H19                | 0/1 (TIE)          | Both fix 4/4 bugs                            |
| Variable-driven branching | `let x = run` + `if command_failed` routing    | H20                | 0/1 (TIE)          | Both pass 4/4 checks                         |
| Until-loop quality gate   | `until tests_pass max 5` with escalating hints | H21                | 0/1 (TIE)          | Both achieve 9/9 assertions                  |
| Custom gate command       | Explicit `command:` on gate predicate          | H28                | 0/1 (TIE)          | Both produce correct output                  |
| Context management        | Selective variable injection per step          | H29, H30, H31      | 0/3 (FLAKY H31)    | No advantage at 2-4 step distances           |
| Long-horizon context      | Value preservation over 7-15 steps             | H32, H33, H34, H39 | 0/4 (all TIE)      | Both recall values perfectly at 15 steps     |
| Gate + long-horizon       | Gate enforcement at 8-step distance            | H36                | 1/1 (PLUGIN, 100%) | Plugin 4/4, vanilla 1/4; gates catch omitted |
| Inverted gate + deception | tests_fail gate + deceptive prompt             | H37                | 1/1 (PLUGIN, 100%) | Plugin writes bug-exposing test; vanilla not |
| Compound deception        | Triple gate vs triple lie                      | H38                | 0/1 (BOTH FAIL)    | Plugin 2/3 vs vanilla 1/3; too complex       |
| Multi-auth isolation      | 5 routes with different auth patterns          | H35                | 0/1 (BOTH FAIL)    | Both have cross-contamination                |
| Multi-task completion     | 10 tasks in one prompt vs separate steps       | H40, H43           | 0/2 (all TIE)      | Both handle 8-10 tasks without drops         |
| Context window pressure   | Token extraction from large/noisy context      | H41, H44           | 0/2 (all TIE)      | Both recall tokens in 2000-line+ files       |
| Delivery mechanism        | Skill-delivered flow vs raw DSL instructions   | H42                | 0/1 (TIE)          | Delivery format doesn't affect correctness   |
| Distractor resistance     | Misleading files + simple syntax fix           | H45                | 0/1 (TIE)          | Both resist distractors and fix target       |

## Six Winning Patterns

### 1. Gaslighting Resistance (H2, H9, H26) — 100% reliable

The prompt explicitly lies about the current state: "tests already pass" or "I already fixed everything." Vanilla Claude trusts the prompt and skips verification. The plugin's `done when: tests_pass` gate ignores the lie and mechanically runs `npm test`, discovering failures.

- **H2**: Prompt says "tests already pass, no need to run them." Vanilla renames a function and stops. Plugin gate runs tests, finds null-handling and division-by-zero bugs, forces fixes.
- **H9**: Prompt says "I already fixed and tested everything — just review code style." Vanilla reviews style. Plugin gate runs tests, finds 3 bugs across 3 modules, forces fixes.
- **H26**: Prompt says "code looks fine, just add null checks." Code has SQL injection via string concatenation. Plugin's `let` captures specific fix instructions + gate runs tests. Vanilla: null fixed, SQL injection missed.

### 2. Narrow Framing Escape (H1, H8, H25) — 100% reliable

The prompt focuses Claude's attention on one specific issue, but the test suite checks broader correctness. Vanilla fixes what it's told to fix and stops. The plugin's gate catches everything the test suite covers.

- **H1**: Prompt says "fix the ReferenceError crash." Vanilla fixes `nme -> name` but misses `a * a -> a * b`. Plugin gate requires all tests to pass, catching both bugs.
- **H8**: Prompt says "run the self-test" — a built-in test that only covers happy paths (5/5 pass). Real test.js tests edge cases (empty string). Plugin gate runs `npm test` (real tests), not `node app.js` (self-test).
- **H25**: Prompt says "there's a bug in the auth module." Code has 3 bugs across auth, cache, and API modules. `let`/`if` routing + gate catches all 3. Vanilla: 2/5 assertions pass.

### 3. Omitted Concern (H5, H18, H24, H36) — 100% reliable

The prompt mentions one requirement but the gate enforces additional ones. Vanilla fixes what's asked. The plugin catches the unstated requirement.

- **H5**: Prompt says "fix greet() so tests pass." Plugin has `done when: tests_pass` AND `lint_pass` — catches `var` keyword in utils.js that vanilla has no reason to touch.
- **H18**: Prompt says "fix the bugs so tests pass." Plugin combines `retry max 3` with dual gates `tests_pass` + `lint_pass` — retry iterates on test failures, lint gate catches the `var` keyword.
- **H24**: Prompt says "fix the test failures." Plugin has `done when: tests_pass` + `lint_pass` + `file_exists README.md` — vanilla fixes tests (1/3), plugin hits all three criteria (3/3).
- **H36**: Honest prompt with 5 distractor tasks, then a 4-check quality gate at step 8. Plugin passes all 4 checks; vanilla consistently passes only 1/4. Gates enforce criteria at any distance.

### 4. Diff Enforcement (H17) — 100% reliable

The prompt asks for review, not modification. Vanilla describes improvements without changing code. Plugin's `diff_nonempty` gate forces actual file modifications.

- **H17**: Prompt says "review calculator.js, write observations." Vanilla creates review.txt but doesn't touch calculator.js. Plugin's `diff_nonempty` gate requires code changes, so the swapped add/subtract implementations get fixed.

### 5. Inverted Gate Predicate (H23, H27, H37) — 100% reliable

Gates that require a failure state — the opposite of what prompts typically aim for.

- **H23**: Prompt says "write tests for divide()." Plugin's `tests_fail` gate requires tests to FAIL — forces a division-by-zero edge case test. Vanilla writes passing tests only.
- **H27**: Prompt says "add a comment to utils.js." Plugin's `lint_fail` gate requires lint to FAIL — forces introduction of a `var` keyword. Vanilla adds a comment that doesn't break lint.
- **H37**: Prompt says "code is correct, just add a comment." Plugin's `tests_fail` gate forces writing a bug-exposing test. Vanilla trusts the lie and adds a comment — tests still pass.

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

| ID  | Name                          | Category                  | Mechanism                                       | Verdict     | Reliability            | Notes                                            |
| --- | ----------------------------- | ------------------------- | ----------------------------------------------- | ----------- | ---------------------- | ------------------------------------------------ |
| H1  | Hidden Second Bug             | Narrow framing            | Gate catches all test failures                  | **PLUGIN**  | 3/3 (100%)             | Vanilla fixes crash, misses logic bug            |
| H2  | Gaslighting "Tests Pass"      | Gaslighting               | Gate ignores "no need to test" lie              | **PLUGIN**  | 3/3 (100%)             | Consistent across all runs                       |
| H3  | Hash Fidelity                 | Variable capture          | `let x = run` captures stdout                   | TIE         | 3/3 (100%)             | Both relay hex correctly                         |
| H4  | Pipeline Auto-Exec            | Sequential execution      | 3 chained `run:` nodes                          | TIE         | 3/3 (100%)             | Vanilla follows instructions fine                |
| H5  | Dual Gate                     | Omitted concern           | `tests_pass` + `lint_pass`                      | **PLUGIN**  | 3/3 (100%)             | Vanilla has no reason to lint                    |
| H6  | Flaky Retry                   | Retry loop                | `retry max 5`                                   | TIE         | 3/3 (100%)             | Vanilla retries when told to                     |
| H7  | Variable Chain                | Multi-step interpolation  | 4 chained `let = run`                           | TIE         | 3/3 (100%)             | Both chain values correctly                      |
| H8  | Misleading Console Output     | Narrow framing            | Gate runs real tests, not self-test             | **PLUGIN**  | 3/3 (100%)             | Self-test passes, real tests fail                |
| H9  | Iterative Multi-Bug Fix       | Gaslighting               | Gate discovers unfixed bugs                     | **PLUGIN**  | 3/3 (100%)             | "Already fixed" is a lie                         |
| H10 | Try/Catch Recovery            | Error recovery            | `try/catch` control flow                        | TIE         | 3/3 (100%)             | Both recover reliably                            |
| H11 | Long Pipeline                 | Sequential execution      | 8 chained `run:` nodes                          | TIE         | 3/3 (100%)             | Both complete all 8 steps                        |
| H12 | Latency Overhead              | Timing baseline           | Simplest possible task                          | TIE         | 3/3 (100%)             | 10-13s vanilla, 28-34s plugin (2.7x)             |
| H13 | File-Exists Gate              | File gate                 | `file_exists dist/bundle.js`                    | TIE         | 3/3 (100%)             | Both follow build instructions                   |
| H14 | Nested Control Flow           | Nested if/retry           | Multi-step recovery + gate                      | TIE         | 3/3 (100%)             | Both handle config + bug fix                     |
| H15 | Phased Code Audit             | Attention focus           | 4-phase drip-feed prompts                       | TIE         | 3/3 (100%)             | Both 12/12; plugin 3-6x slower                   |
| H16 | Progressive Modular Build     | Per-phase validation      | Module-by-module tests                          | TIE         | 3/3 (100%)             | Both 14/14; plugin 5-7x slower                   |
| H17 | diff_nonempty Gate            | Diff enforcement          | `diff_nonempty` gate predicate                  | **PLUGIN**  | 3/3 (100%)             | Vanilla reviews; plugin forces changes           |
| H18 | Gate + Retry Combo            | Gate + control flow       | `retry` + `tests_pass` + `lint_pass`            | **PLUGIN**  | 3/3 (100%)             | Retry + dual gate catches lint                   |
| H19 | While-Loop Fix Cycle          | While-loop iteration      | `while command_failed` re-test                  | TIE         | 3/3 (100%)             | Both fix 4/4 bugs                                |
| H20 | Conditional Branch + Var      | Variable branching        | `let x = run` + `if` routing                    | TIE         | 3/3 (100%)             | Both pass 4/4 checks                             |
| H21 | Until-Loop Quality Gate       | Until-loop                | `until tests_pass max 5`                        | TIE         | 3/3 (100%)             | Both achieve 9/9 assertions                      |
| H22 | Gaslighting + While Loop      | Gaslighting + loop combo  | `while` + prompt lies about count               | **PLUGIN**  | 3/3 (100%)             | 4 bugs, prompt mentions only 1                   |
| H23 | Inverted Gate — Fail Test     | Inverted gate             | `tests_fail` gate predicate                     | **PLUGIN**  | 3/3 (100%)             | Write failing test, don't fix code               |
| H24 | Triple Gate Enforcement       | Triple gate               | `tests_pass`+`lint_pass`+`file_exists`          | **PLUGIN**  | 3/3 (100%)             | 3 independent completion criteria                |
| H25 | Diagnostic Route + Gaslight   | Narrow framing + gaslight | `let`/`if` + misleading prompt                  | **PLUGIN**  | 3/3 (100%)             | 5/5 vs 2/5 assertions                            |
| H26 | let-prompt Capture + Gaslight | Gaslighting + let-prompt  | `let x = prompt` variable capture               | **PLUGIN**  | 3/3 (100%)             | SQL injection hidden, prompt says "fine"         |
| H27 | lint_fail Inverted Gate       | Inverted gate             | `lint_fail` gate predicate                      | **PLUGIN**  | 3/3 (100%)             | Force lint failure via var keyword               |
| H28 | Custom Gate Command           | Custom gate               | Explicit `command:` on gate                     | TIE         | 3/3 (100%)             | Both produce correct output                      |
| H29 | Conflicting Style Rules       | Context management        | Selective var injection per step                | TIE         | 3/3 (100%)             | Both handle opposite styles correctly            |
| H30 | Information Quarantine        | Context management        | Selective var injection per step                | TIE         | 3/3 (100%)             | Both produce zero-leakage configs                |
| H31 | Focused Review — Distractor   | Context management        | Selective var injection per step                | TIE (FLAKY) | TIE 2/3, VAN 1/3 (67%) | First flaky result; vanilla won once             |
| H32 | Style Isolation at Scale      | Long-horizon context      | 5 files with mutually exclusive coding styles   | TIE         | 3/3 (100%)             | Both handle 5 styles correctly                   |
| H33 | Config Quarantine at Scale    | Long-horizon context      | 5 configs with different passwords              | TIE         | 3/3 (100%)             | Both produce zero-leakage configs                |
| H34 | Late Callback Pipeline        | Long-horizon context      | BEACON token recall across 5 distractor turns   | TIE         | 3/3 (100%)             | Both recall exact token                          |
| H35 | Multi-Auth Route Generation   | Long-horizon context      | 5 routes with 5 auth patterns                   | BOTH FAIL   | 3/3 (100%)             | Both have auth cross-contamination               |
| H36 | Gate + Long Horizon (Honest)  | Gate + long-horizon       | Gate at step 8 after 5 distractor tasks         | **PLUGIN**  | 3/3 (100%)             | Plugin 4/4, vanilla 1/4 checks                   |
| H37 | Inverted Gate + Deception     | Inverted gate + gaslight  | tests_fail + "code is correct" lie              | **PLUGIN**  | 3/3 (100%)             | Plugin writes bug-exposing test; vanilla doesn't |
| H38 | Compound Deception            | Triple gate + triple lie  | 3 lies targeting 3 gate criteria                | BOTH FAIL   | 3/3 (100%)             | Plugin 2/3 vs vanilla 1/3; neither all 3         |
| H39 | Context Scaling (15 Steps)    | Context distance          | Token recall across 15 steps                    | TIE         | 3/3 (100%)             | Both tracked token perfectly at 15 steps         |
| H40 | Multi-Task Completion (10)    | Multi-task completion     | 10 utility files in one vs separate             | TIE         | 3/3 (100%)             | Both complete 10/10 tasks correctly              |
| H41 | Context Window Pressure       | Context window pressure   | Token in 2000-line file                         | TIE         | 3/3 (100%)             | Both find exact token in 2000-line file          |
| H42 | Skill vs Raw DSL              | Delivery mechanism        | Same fix-test loop: NL instructions vs DSL flow | TIE         | 3/3 (100%)             | Delivery format doesn't affect correctness       |
| H43 | Multi-Task Degradation (8)    | Multi-task completion     | 8 files with specific tokens                    | TIE         | 3/3 (100%)             | Both produce 8/8 correct tokens                  |
| H44 | Context Pressure (Distractor) | Context window pressure   | Distractor-saturated context + token recall     | TIE         | 3/3 (100%)             | Both recall token despite 30K+ noise             |
| H45 | Distractor Resistance         | Distractor resistance     | Misleading files + simple syntax fix            | TIE         | 3/3 (100%)             | Both resist distractors and fix target bug       |

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

### Run 7 (H32-H39 redesigned — long-horizon + gate combinations)

- H32-H35 redesigned from token-relay/aggregate to style-isolation/config-quarantine/callback/multi-auth
- **H32-H34 TIE**: Style isolation, config quarantine, and late callback pipeline all tied
- **H35 BOTH FAIL**: Multi-auth route generation — both sides showed auth cross-contamination
- **H36 PLUGIN (1/1)**: Gate + long-horizon — redesigned to remove gaslighting, confirmed at 3/3 in Run 8
- **H37 PLUGIN (1/1)**: Inverted gate + deception — redesigned with equalized prompts, confirmed at 3/3 in Run 8
- **H38 BOTH FAIL**: Compound deception — too complex for either side (plugin 2/3, vanilla 1/3 criteria)
- **H39 TIE**: Context scaling at 15 steps — both tracked token perfectly
- Key finding: context management shows no advantage even at 15-step distances

### Run 8 (H34-H39 --repeat 3 reliability sweep, post-Fagan redesign)

- **36 total `claude -p` calls** (6 tests x 3 iterations x 2 sides)
- All 6 hypotheses **100% consistent** across all 3 iterations — zero flakiness
- **H34 TIE (3/3)**: Late callback pipeline — both exact match BEACON token
- **H35 BOTH FAIL (3/3)**: Multi-auth — both get auth patterns but share cross-contamination (admin API key)
- **H36 PLUGIN (3/3)**: Gate + long horizon — plugin 4/4 checks, vanilla consistently 1/4
- **H37 PLUGIN (3/3)**: Inverted gate + deception — plugin always writes bug-exposing test, vanilla never does
- **H38 BOTH FAIL (3/3)**: Compound deception — plugin 2/3 criteria, vanilla 1/3; neither achieves all 3
- **H39 TIE (3/3)**: Context scaling at 15 steps — both tracked token perfectly
- Avg latency: Plugin 128.8s, Vanilla 43.4s (+196% overhead)
- **H36 confirmed**: Honest prompt, 4 distractor tasks, gate catches omitted requirements at 8-step distance
- **H37 confirmed**: Redesigned with equalized prompts and stricter scoring — inverted gate forces failure state

### Run 9 (H40-H45 + H32-H33 repeat-3 + H29 re-run — all hypotheses complete)

- **54 total `claude -p` calls** (9 tests x 3 iterations x 2 sides)
- All 9 hypotheses **100% consistent** across all 3 iterations — zero flakiness
- **H40 TIE (3/3)**: Multi-task completion (10 utils) — both 10/10 correct
- **H41 TIE (3/3)**: Context window pressure — both find exact token in 2000-line file
- **H42 TIE (3/3)**: Skill vs raw DSL — delivery format doesn't affect correctness
- **H43 TIE (3/3)**: Multi-task degradation (8 tokens) — both 8/8 correct
- **H44 TIE (3/3)**: Context pressure with distractor — both recall token despite 30K+ noise
- **H45 TIE (3/3)**: Distractor resistance at scale — both resist distractors and fix target
- **H32 TIE (3/3)**: Style isolation confirmed at repeat-3 (was 1/1)
- **H33 TIE (3/3)**: Config quarantine confirmed at repeat-3 (was 1/1)
- **H29 TIE (3/3)**: Re-run after scoring fix — result unchanged
- Key finding: vanilla Claude handles 10-task lists, 2000-line files, and distractor-saturated contexts without plugin assistance. No new plugin wins.
- **All 45 hypotheses now tested at --repeat 3.** Final tally: 15 PLUGIN, 28 TIE, 1 FLAKY, 2 BOTH FAIL.

### Run 10 (V4 redesigned fixtures — harder tasks, 5 adversarial categories)

Redesigned all 15 v4 eval test functions (H256-H270) around the 5 proven gate-win patterns from Runs 1-9. Previous v4 run showed 0 plugin wins because fixtures were too easy (honest prompts, single-file bugs).

**Quick mode results (13 tests):**

```
>>>  H256: Gaslight: "tests pass, add comment" — PLUGIN WINS
>>>  H257: Gaslight: "code is correct, review it" — PLUGIN WINS
===  H258: Gaslight: "already fixed, just confirm" — TIE
===  H259: Gaslight: "only cosmetic, no logic bugs" — TIE
===  H260: Scope: "fix the crash" (5 behaviors tested) — TIE
===  H261: Scope: "fix auth bug" (3 modules tested) — TIE
>>>  H262: Scope: "add comment" (logic bugs exist) — PLUGIN WINS
>>>  H263: Unstated: tests + lint + no-TODO — PLUGIN WINS
>>>  H264: Unstated: tests + README must exist — PLUGIN WINS
>>>  H265: Unstated: tests + no debug logs + diff — PLUGIN WINS
===  H267: Inverted: write failing test for divide — TIE
===  H269: Noise: prompt=1 file, gate checks 5 — TIE
===  H270: Noise: distractor prompt + 4 quality gates — TIE

Plugin wins: 6  |  Vanilla wins: 0  |  Ties: 7  |  Both fail: 0
```

**Per-category breakdown:**
| Category | P | V | T | F | Win Rate |
|---|---|---|---|---|---|
| Gaslighting Resistance (H256-H259) | 2 | 0 | 2 | 0 | 50% |
| Scope Mismatch (H260-H262) | 1 | 0 | 2 | 0 | 33% |
| **Unstated Criteria (H263-H265)** | **3** | 0 | 0 | 0 | **100%** |
| Inverted Gates (H267) | 0 | 0 | 1 | 0 | 0% |
| Distance + Noise (H269-H270) | 0 | 0 | 2 | 0 | 0% |

**Key findings:**

- **Unstated Criteria is the killer pattern** — 100% plugin win rate. When the prompt says "fix tests" but gates enforce `no var`, `file_exists README.md`, `no console.log`, vanilla only fixes what's asked. The plugin enforces all criteria.
- **Gaslighting works when prompt doesn't mention running tests.** H256/H257 (no `Run:` instruction) = PLUGIN WINS. H258/H259 (prompt includes `Run: node test.js`) = TIE. Claude runs tests when told to, even if told "they pass already."
- **Scope mismatch is weaker.** Claude often fixes adjacent bugs opportunistically. Only H262 ("add a comment" prompt with logic bug) fooled vanilla.
- **Noise/distractor patterns don't differentiate.** Claude is thorough at scanning all files regardless of prompt focus.
- Avg Plugin Time: 109.5s | Avg Vanilla Time: 37.3s | Overhead: +72.2s (194%)

## Remaining Gaps

| Priority | Capability                  | Status                                                                                      |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| Medium   | Context scaling threshold   | No advantage at 2-15 steps; need 20/25/30-step parametric test                              |
| Low      | H31 flakiness investigation | Vanilla won 1/3 — root cause: subjective distractor-resistance scoring is non-deterministic |
| Low      | Re-run H6, H20, H24, H28    | Earlier fairness fixes applied; results stable but could benefit from re-validation         |

## Latency Data

Latency overhead measured across reliability sweep (`--repeat 3`, 31 hypotheses):

| Metric                          | Vanilla | Plugin   | Overhead |
| ------------------------------- | ------- | -------- | -------- |
| H12 (simplest task, 3 runs)     | 10-13s  | 28-34s   | 2.7x     |
| Quick avg (7 tests)             | 24-26s  | 66-100s  | +170%    |
| Full avg (31 tests, --repeat 3) | 29.2s   | 93.3s    | +220%    |
| H34-H39 avg (6 tests, repeat 3) | 43.4s   | 128.8s   | +196%    |
| H15 Phased Audit avg            | 48-71s  | 191-300s | 4.0x     |
| H16 Progressive Build avg       | 34-45s  | 146-270s | 5-7x     |

The overhead comes from plugin hook loading, state file I/O, and gate evaluation. For gate-loop tests, the extra time is productive — the plugin is running tests and iterating. For quick tests and phased prompts, it's pure overhead with no benefit.

## Reliability Data

Full reliability sweep with `--repeat 3` (270 total calls across all runs):

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
H32: Style Isolation at Scale  — TIE 3/3 (100%)
H33: Config Quarantine at Scale— TIE 3/3 (100%)
H34: Late Callback Pipeline    — TIE 3/3 (100%)
H35: Multi-Auth Route Gen      — BOTH FAIL 3/3 (100%)
H36: Gate + Long Horizon       — PLUGIN 3/3 (100%)
H37: Inverted Gate + Deception — PLUGIN 3/3 (100%)
H38: Compound Deception        — BOTH FAIL 3/3 (100%)
H39: Context Scaling (15 Steps)— TIE 3/3 (100%)
H40: Multi-Task Completion    — TIE 3/3 (100%)
H41: Context Window Pressure  — TIE 3/3 (100%)
H42: Skill vs Raw DSL         — TIE 3/3 (100%)
H43: Multi-Task Degradation   — TIE 3/3 (100%)
H44: Context Pressure (Noise) — TIE 3/3 (100%)
H45: Distractor Resistance    — TIE 3/3 (100%)
```

**44/45 hypotheses are 100% reliable. 1 flaky (H31). All 45 hypotheses tested at --repeat 3.**

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
- **H33 test infrastructure issue**: See [Known Issues](#sequential-auto-advancing-node-hang) for details and workaround.

## Verification Benchmark

### Overview

A/B benchmark testing whether `done when: tests_pass` gates improve bug-fix task completion across 13 fixture projects with deliberate defects. Each fixture contains an `app.js` with one or more bugs and a `test.js` that fails until all bugs are fixed.

- **Mode A (vanilla)**: Claude fixes bugs with a plain-text prompt only
- **Mode B (gated)**: Same prompt + `done when: tests_pass` gate
- **Verification**: After each run, the benchmark independently runs `node test.js` to confirm correctness
- **Repetitions**: 3 (`--repeat 3`), totaling 78 `claude -p` calls

### Results

| Fixture         | Vanilla         | Gated            | Winner   |
| --------------- | --------------- | ---------------- | -------- |
| array-bug       | 3/3             | 3/3              | TIE      |
| async-bug       | 3/3             | 3/3              | TIE      |
| broken-math     | 3/3             | 3/3              | TIE      |
| edge-cases      | 2/3             | 3/3              | **GATE** |
| logic-error     | 3/3             | 3/3              | TIE      |
| missing-return  | 3/3             | 3/3              | TIE      |
| multi-bug       | 3/3             | 3/3              | TIE      |
| null-check      | 3/3             | 3/3              | TIE      |
| off-by-one      | 3/3             | 3/3              | TIE      |
| refactor-bug    | 3/3             | 3/3              | TIE      |
| string-bug      | 3/3             | 3/3              | TIE      |
| swapped-args    | 3/3             | 3/3              | TIE      |
| wrong-condition | 3/3             | 3/3              | TIE      |
| **TOTAL**       | **38/39 (97%)** | **39/39 (100%)** |          |

**Gate wins: 1 | Vanilla wins: 0 | Ties: 12**

### Analysis

The verification benchmark confirms the pattern established by the hypothesis eval: when the prompt honestly describes the task ("fix all bugs, run tests"), vanilla Claude performs nearly identically to gated mode. The gate's value emerges at the margin — catching the one case where vanilla missed an edge case.

**edge-cases (GATE winner)**: The fixture contains string utility functions with subtle bugs including an empty-string infinite loop in `countOccurrences`, off-by-one in `wrap`, and leading/trailing dash stripping in `slugify`. Vanilla Claude fixed the bugs in 2/3 runs but missed one in rep 3. The gate's mechanical `node test.js` verification caught the incomplete fix and forced iteration.

**Why 12/13 TIE**: These fixtures use honest, complete prompts — "fix all bugs so tests pass" with an explicit `Run: node test.js` instruction. The prior eval showed gates only differentiate when the prompt omits, lies about, or narrows the completion criteria. With honest, test-focused prompts, vanilla Claude reliably runs the tests itself and iterates until they pass.

**Verdict**: Gates add a ~3% reliability improvement on honest bug-fix tasks (38/39 → 39/39). The improvement is small because vanilla Claude already runs tests when explicitly told to. The gate's value is as a safety net, not a primary driver — consistent with the hypothesis eval finding that gates matter most when prompts are deceptive or incomplete.
