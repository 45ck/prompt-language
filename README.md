# @45ck/prompt-language

A verification-first supervision runtime for coding agents. It wraps supported harnesses such as Claude Code and Codex in a persistent state machine with deterministic control flow, verification gates, and state management.

[![npm](https://img.shields.io/npm/v/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language) [![CI](https://github.com/45ck/prompt-language/actions/workflows/quality.yml/badge.svg)](https://github.com/45ck/prompt-language/actions/workflows/quality.yml) [![license](https://img.shields.io/npm/l/@45ck/prompt-language)](LICENSE) [![node](https://img.shields.io/node/v/@45ck/prompt-language)](package.json) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md) [![npm downloads](https://img.shields.io/npm/dm/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)

<p align="center">
  <img src="assets/hero-flow.svg" alt="prompt-language flow example" width="720">
</p>

> **In one line.** A thin orchestrator that turns flaky agents into deterministic pipelines by imposing loops, retries, and verification gates the AI cannot self-report past.

## Why it matters — the evidence so far

| Claim                                                                      | Measurement                                                                                                                                                                  | Source                                                                                                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PL lifts `qwen3-opencode:30b` above solo aider on 10 independent fixtures. | **6 wins, 0 losses, 3 ties** (H1–H10). Gate-enforced retry turned 7/10 → 10/10 (H2), 0/3 → 3/3 (H5), 0/4 → 4/4 (H8).                                                         | [experiments/aider-vs-pl/SCORECARD.md](experiments/aider-vs-pl/SCORECARD.md)                                           |
| PL rescues at least one sub-30B model on a coding task.                    | **qwen3:8b on E-SMALL CSV: 5/11 pre-retry → 9/11 after one PL retry edit** (+4 assertions). N=1, replications queued.                                                        | [experiments/aider-vs-pl/rescue-viability/LIVE-NOTES.md](experiments/aider-vs-pl/rescue-viability/LIVE-NOTES.md)       |
| PL can be used to develop PL itself.                                       | Opencode progress-detector bug diagnosed, patched, and shipped as commit `04367d2` with new Vitest coverage (14/14). The MVP case study for the Level B self-hosting ladder. | [experiments/aider-vs-pl/SELF-HOSTING-THEORY.md](experiments/aider-vs-pl/SELF-HOSTING-THEORY.md)                       |
| PL does **not** rescue models below the literal-code-emission threshold.   | `gemma4-opencode:{e2b,e4b}` refuted: degenerate decoding (repetition traps, 1/11 on E-SMALL CSV solo and under PL).                                                          | [experiments/aider-vs-pl/LOCAL-MODEL-VIABILITY-FINDINGS.md](experiments/aider-vs-pl/LOCAL-MODEL-VIABILITY-FINDINGS.md) |

Full journey: **[experiments/JOURNEY.md](experiments/JOURNEY.md)** · Capability showcase: **[experiments/POWER-OF-PL.md](experiments/POWER-OF-PL.md)** · Open work: **[experiments/STATUS.md](experiments/STATUS.md)**

## How it works in three bullets

- **Deterministic execution** -- loops, branches, variables, and retries run without AI involvement. The AI only activates at `prompt` nodes. ~85% of execution is deterministic; ~15% is AI.
- **Verification gates** -- `done when: tests_pass` runs real commands and blocks completion until they pass. The AI cannot self-report "done."
- **Parallel agents** -- `spawn` launches child processes, `await` collects results, `race` picks the fastest. Variables flow between parent and children automatically.

## Install

```bash
npx @45ck/prompt-language
```

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) and Node.js >= 22. Also works with [Codex CLI](https://github.com/openai/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and other harnesses via `npx @45ck/prompt-language run --runner <name>`.

For the full Claude Code and Codex walkthrough, including install verification, meta-prompt toggles, skill-aware wrapping, and terminal screenshots, see [docs/guides/claude-code-and-codex.md](docs/guides/claude-code-and-codex.md).

## Example

```
agents:
  reviewer:
    model: "opus"
    skills: "code-review", "security-review"

flow:
  let spec = prompt "Write a detailed technical spec for: ${goal}"
  let tasks = prompt "Break this spec into numbered implementation tasks: ${spec}"

  while ask "Are there remaining tasks or unresolved review findings?" grounded-by "npm test" max 10
    foreach task in ${tasks}
      retry max 3
        prompt: Implement ${task}. Follow the spec: ${spec}
        run: npm test
        if command_failed
          prompt: Fix the failing tests for ${task}.
        end
      end
    end

    spawn "review" as reviewer
      prompt: Review all changes against the spec. List any gaps, bugs, or missing edge cases as numbered tasks.
    end
    await "review" timeout 120

    if ${review.findings} != "none"
      let tasks = prompt "Convert these review findings into implementation tasks: ${review.findings}"
    end
  end

done when:
  all(tests_pass, lint_pass)
```

The outer `while ask` loop keeps iterating as long as there are unresolved tasks or review findings. Each iteration implements tasks with retry, then spawns a reviewer -- if the reviewer finds problems, those become the new task list and the loop continues. The flow only exits when the AI judges there's nothing left _and_ real `tests_pass` + `lint_pass` gates confirm it.

Invoke this as a skill from your preferred harness -- Claude Code, Codex CLI, Gemini CLI -- or run it headless in CI with `npx @45ck/prompt-language ci`.

More examples: [docs/examples](docs/examples/index.md) | [Proof examples](examples/public/) | DSL cheatsheet: [docs/reference/dsl-cheatsheet.md](docs/reference/dsl-cheatsheet.md)

## Features

| Category          | Highlights                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| **Control flow**  | `if`/`else if`/`else`, `while`, `until`, `retry`, `foreach`, `try`/`catch`/`finally`, `break`, `continue` |
| **Variables**     | `let x = "literal"` / `run "cmd"` / `prompt "..."`, `${x}` interpolation, lists, arithmetic               |
| **Verification**  | `tests_pass`, `lint_pass`, `file_exists`, custom gates, `all()`/`any()` composition                       |
| **Agents**        | Named `agents:` with model/skills/profile, `spawn`/`await`, `race`, `send`/`receive`                      |
| **AI conditions** | `ask "question" grounded-by "command"` for subjective evaluation with real data                           |
| **Resilience**    | Persistent state, compaction survival, `snapshot`/`rollback`, `import`/`include`                          |

## Research program

prompt-language is developed in public alongside a live research program. The product code and the research artifacts share this repository on purpose: every claim on this README traces to a specific measurement in `experiments/`.

### Overall goal

Find out **whether a thin, declarative supervisor layer above an existing coding-agent harness can reliably turn imperfect agents (especially cheap/local ones) into dependable pipelines** — without retraining models, without re-implementing harnesses, and without trusting the model's own self-assessment.

### Core hypotheses

| #               | Hypothesis                                                                                                                                    | How we prove or refute it                                                                                                                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H-LIFT**      | PL's deterministic control flow + verification gates lift a given model above its solo-harness pass rate on coding fixtures.                  | Paired solo-vs-PL arms at fixed model. **Status: Validated** at `qwen3-opencode:30b` on H1-H10 (6-0-3, [SCORECARD](experiments/aider-vs-pl/SCORECARD.md)).                                                                                                                                      |
| **H-RESCUE**    | PL rescues lower-capability models — i.e. the lift is largest, not smallest, as model capability drops.                                       | Rescue-delta sweep R1-R10 across models (qwen3:8b, qwen3-opencode:30b) and PL intensities (lite / medium / full). **Status: First signal at 8B**, [LIVE-NOTES](experiments/aider-vs-pl/rescue-viability/LIVE-NOTES.md). Replications + ablation queued.                                         |
| **H-CEILING**   | PL's lift shrinks with task difficulty; at some point the orchestration cannot compensate for missing capability.                             | Difficulty ladder from E-SMALL → H1-H10 → H11 multi-file refactor. **Status: partially confirmed** — qwen3-opencode:30b at 30B drops to 2-3/12 on H11.                                                                                                                                          |
| **H-FLOOR**     | PL cannot rescue models below the literal-code-emission threshold.                                                                            | Tested on `gemma4-opencode:{e2b,e4b}`. **Status: confirmed** (1/11 solo = 1/11 PL; decoding traps are not fixable by orchestration). [Findings](experiments/aider-vs-pl/LOCAL-MODEL-VIABILITY-FINDINGS.md).                                                                                     |
| **H-SELF-HOST** | PL can be used to author non-trivial changes to PL itself under authoritative gates.                                                          | Meta-factory program (A-E ladder). **Status: Level 1 evidence** — today's opencode patch was diagnosed, authored, tested, and shipped. Level B (PL authors a PL-src patch end-to-end) designed but not yet run. [Theory](experiments/aider-vs-pl/SELF-HOSTING-THEORY.md).                       |
| **H-ARENA**     | A PL + local-model + task-tuned flow can rival a vanilla cloud-harness + frontier-model stack on real coding tasks at a fraction of the cost. | Head-to-head pilot HA-E1 plus HA-HR1 hybrid local/frontier routing. **Status: planned, blocked on oracle-isolation runner.** [Plan](experiments/harness-arena-HA-E1-PLAN.md), [team guide](docs/guides/team-of-agents.md), [hybrid routing](experiments/harness-arena/hybrid-model-routing.md). |

### How we prove things (not just "run and hope")

1. **Every claim must cite a fixture and a pass count.** No "it seems to work." If it isn't in an oracle's exit code, it doesn't count.
2. **Gates are executable shell, not AI self-assessment.** `done when: gate x: <cmd>` — the shell's exit code decides, not the model's text. PL hard-stops after 50 consecutive gate failures (`PLO-004`) rather than trust the model's "done."
3. **Infrastructure defects disqualify measurements.** Today's session surfaced four PL runtime bugs (two aider-runner P1s, one gate-evaluator P1, one concurrent-state risk). Each is filed as an open bead with a reproducer; rescue-viability claims are held weak until they close.
4. **Replications over single runs.** The first rescue delta on 8B was +4 assertions but `N=1` with observed pre-retry variance of 5-8/11 on the same prompt. The claim is held at "thin signal" until three runs are logged and a solo control is measured.
5. **Falsification stop conditions.** The rescue program has an explicit abandon point at Run 9 (R2-D, qwen3:8b solo on H8): after nine runs, either median rescue ≥ +3/11 AND one PL feature carries ≥ +2/11 (confirmed), or pl-lite ≥ pl-full (refuted: it's just decomposition, not universal wisdom), or ambiguous (publish honestly as "boilerplate-smoother, not universal wisdom"). No later experiment can resurrect a refuted thesis.
6. **The research tree is the evidence tree.** `experiments/` is dated, scorecard-first, and commits to raw artifacts: fixtures, flows, run dirs, audit JSONL, verify outputs. [experiments/POWER-OF-PL.md §9](experiments/POWER-OF-PL.md) states what PL is **not** claiming, explicitly.

### Experiment areas

| Codename          | Dir                                                                                       | Charter                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **ladder**        | [`experiments/aider-vs-pl/`](experiments/aider-vs-pl/)                                    | Rung-by-rung solo-vs-PL at one fixed local model (H1-H20).                    |
| **rescue**        | [`experiments/aider-vs-pl/rescue-viability/`](experiments/aider-vs-pl/rescue-viability/)  | Does PL lift lower-capability models (R1-R10).                                |
| **atlas**         | [`experiments/ecosystem-analysis/`](experiments/ecosystem-analysis/)                      | Position PL in the OSS coding-agent landscape.                                |
| **forge**         | [`experiments/meta-factory/`](experiments/meta-factory/)                                  | Can PL develop PL (self-hosting).                                             |
| **foundry**       | [`experiments/full-saas-factory/`](experiments/full-saas-factory/) et al.                 | End-to-end product-build factories.                                           |
| **harness-arena** | [`experiments/harness-arena/`](experiments/harness-arena/)                                | Vanilla cloud harness + frontier model vs PL + local model + task-tuned flow. |
| **crucible**      | [`experiments/bounded-feature-benchmark/`](experiments/bounded-feature-benchmark/) et al. | Narrow stress tests isolating one DSL primitive.                              |

Full codename charter and evidence tiers: [experiments/EXPERIMENT-AREAS.md](experiments/EXPERIMENT-AREAS.md).

### Current work-in-progress

Live beads snapshot: [`experiments/STATUS.md`](experiments/STATUS.md). Two P1 bugs gate trust in further measurements:

- [`prompt-7zyi`](experiments/aider-vs-pl/AIDER-P1-TRIAGE.md) — aider runner walks to parent git dir for path resolution.
- [`prompt-0zn1`](experiments/STATUS.md#p1--blocking-measurement-integrity) — gate evaluator reports `file_exists` false when file exists on disk.

### Honest limitations (read before citing)

- All local measurements come from one Windows 11 / RX 7600 XT 16 GB host, one model family (qwen3 variants + one gemma probe), and mostly one runner (aider).
- H11 phase-2 shows the PL lift _shrinks_ as task difficulty rises (solo 2/12 → PL 3/12).
- The rescue-at-8B signal is N=1 with pending replications and no solo control arm yet.
- PL does **not** make a small model smarter in a single turn. It adds retries, gates, decomposition, and structure. Capability below the "literal correct syntax" bar cannot be rescued ([H-FLOOR confirmed](experiments/aider-vs-pl/LOCAL-MODEL-VIABILITY-FINDINGS.md)).

## CLI commands

| Command                               | What it does                                 |
| ------------------------------------- | -------------------------------------------- |
| `npx @45ck/prompt-language`           | Install the runtime                          |
| `npx @45ck/prompt-language status`    | Check installation                           |
| `npx @45ck/prompt-language validate`  | Parse, lint, score, and preview a flow       |
| `npx @45ck/prompt-language run`       | Execute a flow via Claude or headless runner |
| `npx @45ck/prompt-language ci`        | Run a flow in headless CI mode               |
| `npx @45ck/prompt-language watch`     | Live TUI flow monitor                        |
| `npx @45ck/prompt-language init`      | Scaffold a starter flow                      |
| `npx @45ck/prompt-language demo`      | Print an annotated example                   |
| `npx @45ck/prompt-language uninstall` | Remove the runtime                           |

Full CLI documentation: [docs/reference/cli-reference.md](docs/reference/cli-reference.md)

## Documentation

### Research and evidence (start here if evaluating PL)

| Topic                    | Link                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Research journey         | [experiments/JOURNEY.md](experiments/JOURNEY.md)                                                           |
| Capability showcase      | [experiments/POWER-OF-PL.md](experiments/POWER-OF-PL.md)                                                   |
| Current work-in-progress | [experiments/STATUS.md](experiments/STATUS.md)                                                             |
| Experiment areas index   | [experiments/README.md](experiments/README.md)                                                             |
| Scorecard (H1-H10)       | [experiments/aider-vs-pl/SCORECARD.md](experiments/aider-vs-pl/SCORECARD.md)                               |
| Rescue-viability roadmap | [experiments/aider-vs-pl/rescue-viability/ROADMAP.md](experiments/aider-vs-pl/rescue-viability/ROADMAP.md) |
| Self-hosting theory      | [experiments/aider-vs-pl/SELF-HOSTING-THEORY.md](experiments/aider-vs-pl/SELF-HOSTING-THEORY.md)           |

### Using PL as a runtime

| Topic                   | Link                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| Getting started         | [docs/guides/getting-started.md](docs/guides/getting-started.md)             |
| Claude Code and Codex   | [docs/guides/claude-code-and-codex.md](docs/guides/claude-code-and-codex.md) |
| Language reference      | [docs/reference/index.md](docs/reference/index.md)                           |
| DSL cheatsheet          | [docs/reference/dsl-cheatsheet.md](docs/reference/dsl-cheatsheet.md)         |
| How the runtime works   | [docs/guides/guide.md](docs/guides/guide.md)                                 |
| Architecture and design | [docs/architecture.md](docs/architecture.md)                                 |
| Security model          | [docs/security.md](docs/security.md)                                         |
| Examples                | [docs/examples/index.md](docs/examples/index.md)                             |
| Proof examples          | [examples/public/](examples/public/)                                         |
| Experiments (catalog)   | [docs/experiments.md](docs/experiments.md)                                   |
| Troubleshooting         | [docs/operations/troubleshooting.md](docs/operations/troubleshooting.md)     |
| Roadmap                 | [docs/roadmap.md](docs/roadmap.md)                                           |
| Full doc index          | [docs/index.md](docs/index.md)                                               |

## Tooling

- **VS Code extension** -- syntax highlighting for `.flow`, `.prompt`, and inline flow blocks. Source in `vscode-extension/`.
- **GitHub Actions** -- run flows in CI with [`45ck/prompt-language-action`](https://github.com/45ck/prompt-language-action).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
