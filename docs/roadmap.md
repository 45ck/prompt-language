# Roadmap

<!-- cspell:ignore jkfn lmep dekn folr idbc jstc syg2 yd9w ik3n g6pl g58 n6gr q72l ln6k rg6v uqe s6zz u0k 8u0k 2j9v 0ovo overclaimed -->

This page is the public status boundary for notable `.beads` work. It records what has shipped, what is active WIP, and what is still exploratory.

It should answer three simple questions for a new reader:

1. What is prompt-language for?
2. What can I rely on today?
3. What is next, and why?

Use it to keep three things separate:

- **Shipped now**: documented in the [Language Reference](reference/index.md) and [README](../README.md)
- **Tracked next**: open backlog items with clear product value, but not implemented
- **Exploratory**: credible ideas that may change substantially or never ship

For feature-by-feature proposed syntax and behavior, see [WIP Features](wip/index.md). Future-facing detail belongs there, not in the shipped reference.

If a keyword or command is **not** documented in the [Language Reference](reference/index.md), treat it as **not available today**.

Codex note: in this repo, "Codex support" currently means the supervised headless runner used by `run`, `ci`, `eval`, and validation/preflight. The local Codex hook scaffold exists, but it remains experimental and is not public evidence of full Claude-parity lifecycle support.

## Product goal

prompt-language is a **verification-first supervision runtime for coding agents**.

The goal is not to replace source code with abstract theory, and it is not to become a generic workflow shell for everything. The product goal is narrower and more useful:

- let an engineer express execution structure, checks, review loops, and recovery logic once
- make supported agents keep working until explicit completion criteria pass or a bounded failure state is reached
- preserve enough state, evidence, and operator visibility that runs are inspectable instead of magical
- make recurrent failure-handling live in the runtime layer rather than being re-explained in prose every time

In short: **prompt-language exists to supervise agent work, not just to phrase prompts more elegantly**.

## Current shape of the product

The repo already has a real core product:

- a runtime that owns flow state and advancement
- deterministic control-flow primitives around `prompt` nodes
- verification gates that run real commands
- review and approval structure
- bounded multi-agent orchestration through `spawn` / `await`
- headless execution paths for supported runners such as Claude and Codex

The strongest current value is still **verification and supervision**, not broad automation theatre. That is why the roadmap below prioritizes proof, reliability, and supported-host evidence over inventing lots of new surface area.

## Evidence checkpoint: 2026-05-06

The FSCRUD R30-R45 local-model sequence tightened the research boundary:

- local-only prompt wording and senior prose did not prove autonomous full-stack
  implementation for `qwen3-opencode-big:30b`;
- deterministic kernels, protected artifacts, and gates were effective at isolating
  the failure modes;
- R40-R45 passed when local-model responsibility was bounded to selector/ranker,
  short rationale, and risk-response choices while PL owned validation, normalization,
  rendering, and verification.

Roadmap implication: keep product work focused on trustworthy supervision,
evidence capture, replay, and boundaries. Treat hybrid routing and bounded local
semantic-choice modules as research tracks, not shipped product guarantees. The
current evidence summary is
[Evidence Snapshot: 2026-05-06](evaluation/2026-05-06-evidence-snapshot.md).

## Evidence checkpoint: 2026-05-11

The Concord/VHO pilots and follow-up adversarial reviews tightened the boundary
again:

- micro-task local routing works as a narrow engineering pattern when specs are
  clear and oracles are deterministic, but the "100/100 at k=10" headline was
  overclaimed because the tasks were curated and the oracle was same-author;
- cross-family review found a real missed `parseQuery` bug in the micro-task
  result, so the evidence supports "directional pattern worth replaying" rather
  than a claim-grade substitution result;
- app-build and real-software multistage hybrid routes are not dollar-cost
  justified on the current evidence because frontier scaffolding dominates local
  savings;
- the operator signer `operator-45ck-2026-05` is now provisioned, and a signed
  multi-node Ollama bundle exists, but no run is claim-eligible yet because
  verifier, witness, path, and real cross-family-review blockers remain;
- the Ollama runner is an action-protocol tool loop, not a generic text
  generation adapter.

Roadmap implication: stop adding broad demos until the evidence substrate is
clean. The current operating plan is
[Current Plan After May 11 Evidence](strategy/current-plan-2026-05-12.md).

## Evidence checkpoint: 2026-05-12

The local-model path is now more honestly classified:

- smoke result JSON includes a `claimProfile` block and writes a sibling runner
  capability manifest;
- traced prompt-turn entries can carry runner capability evidence;
- a `qwen3-coder:30b` Ollama quick smoke passed `35/39` cases but failed four
  deterministic runtime-smoke checks;
- the run is recorded-only, with shell, process, and transport-witness blockers.

Roadmap implication: local models are available and useful for diagnostics, but
the next engineering work is still runner/witness safety and deterministic smoke
closure before any local claim-profile promotion. See
[Local Ollama Smoke With Claim-Profile Classification](evaluation/2026-05-12-local-ollama-smoke-claim-profile.md).

## Shipped vs tracked

The runtime already ships:

- persistent state and context re-injection
- `prompt`, `run`, `let` / `var`
- `if`, `while`, `until`, `retry`, `foreach`, `break`, `continue`
- `spawn` / `await`
- `done when:` gates and built-in predicates
- `approve "message"` and `approve "message" timeout N` — hard human approval checkpoint
- `let x = prompt "..." as json { schema }` — structured JSON capture
- `import "file.flow"` and `import "file.flow" as ns` — flow composition
- export/use prompt library system — namespaced reusable flows, prompts, and gates
- `spawn "name" if condition` — conditional spawn
- `spawn "name" model "model-id"` — per-spawn model selection
- `grounded-by "cmd"` on `while`, `until`, `if` — deterministic exit-code condition
- `review max N` block with optional `criteria:` and `grounded-by` — critique loop
- `race` block — competitive parallel execution, first success wins
- `foreach-spawn item in list max N` — parallel fan-out
- `remember "text"` and `remember key="k" value="v"` — persistent memory
- `memory:` section — prefetch keys from memory store
- `send "target" "msg"` / `receive varName` — inter-agent messaging
- public SDK from the root package and `./sdk` subpath — stable programmatic API for integrations
- VS Code extension (basic syntax highlighting in `vscode-extension/`)
- GitHub Actions integration (`action/action.yml` — `45ck/prompt-language-action`)

What that means in practice:

- you can use prompt-language today to supervise bounded coding work with explicit stop conditions
- you can run the same core runtime concepts across Claude-oriented and Codex-oriented paths
- you should not treat every host-specific scaffold or design doc as equivalent to shipped host parity

## Near-term milestones

These are the next milestones that matter most to the product, in order:

| Milestone                                           | Why it matters                                                                                   | Current status |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| Claim-eligible runtime truth bundle                 | Proves strict trace, ready preflight, attestation, cross-family review, and trusted signer work  | In progress    |
| Runner safety and verifier profile hardening        | Makes claim-grade evidence runtime-enforced rather than prompt-instructed                        | In progress    |
| Supported-host live smoke and parity evidence       | Turns local/dev confidence into public operational confidence                                    | In progress    |
| E1 repeated-failure recovery proof                  | Tests the clearest thesis-relevant value: PL reduces recurring failures through gates and repair | Tracked next   |
| Actual PL-runtime local routing path                | Replaces hand-rolled router evidence with a real PL flow runtime route                           | Tracked next   |
| Micro-task cross-family replay and HA-HR1 baselines | Tests local routing with independent oracles and matched frontier baselines                      | Tracked next   |
| Multi-file and wisdom experiments                   | Tests whether PL projects and reusable lessons improve maintainability                           | Exploratory    |
| Broader authoring ergonomics                        | LSP, playground, registry, and similar tooling become worth it after the core is proven          | Tracked next   |

The immediate next slice is no longer another broad demo. It is the
verifier/runtime safety profile plus a minimal claim-eligible run under that
profile, so future evidence can count.

## WIP: tracked next

These are tracked or planned Beads references that fit the current product
direction and are easy for users to understand. May 11 IDs are now present in
the primary no-db Beads store; the backup export remains a generated snapshot.

| Feature                                            | Status            | Current workaround                                             | Beads issue            |
| -------------------------------------------------- | ----------------- | -------------------------------------------------------------- | ---------------------- |
| Claim-eligible PL runtime bundle                   | WIP, active       | Treat signed/verified bundles as recorded-only                 | `prompt-language-j0je` |
| Ollama runner action/text boundary                 | WIP, active       | Use action-protocol flows or hand-rolled experiment router     | `prompt-language-5io5` |
| E1 repeated-failure benchmark                      | WIP, tracked next | Use existing smoke/eval fixtures                               | `prompt-language-j64j` |
| Flow registry and `.flow` run/validate conventions | Shipped baseline  | Use `run`, `list`, and `validate`; remaining work is UX polish | `prompt-language-yd9w` |
| MCP server exposing flow state to other AI clients | WIP, tracked next | Inspect `.prompt-language/session-state.json` directly         | `prompt-language-folr` |

Interpret the MCP row narrowly: the tracked surface is flow state inspection/control, not generic host-extension management.

## WIP: platform and DX roadmap

These are substantial product improvements that are not yet fully shipped.

| Feature                                                                | Status       | Notes                                                                                                                                                       | Beads issue               |
| ---------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Context-adaptive rendering program                                     | WIP, planned | Planning and design notes exist, but nothing new is shipped yet; canonical renderer, compact mode, fallback, and eval evidence remain staged follow-up work | `prompt-language-0ovo`    |
| Headless OpenCode flow runner                                          | WIP, partial | `run/ci --runner opencode` exists for headless prompt turns; default Claude hook loop stays intact                                                          | `prompt-language-9uqe.15` |
| Full harness abstraction for spawned sessions and runner resolution    | WIP, planned | Claude `spawn`/`await`, named-agent defaults, and broader runner config are still open                                                                      | `prompt-language-9uqe.4`  |
| Language server (LSP) for editor-agnostic autocomplete and diagnostics | WIP, planned | Depends on extension groundwork                                                                                                                             | `prompt-language-idbc`    |
| Web playground for browser-based flow authoring and dry-run simulation | WIP, planned | Good onboarding and docs surface                                                                                                                            | `prompt-language-528q`    |
| Workspace-aware monorepo orchestration                                 | WIP, planned | Would build on `spawn` plus package discovery                                                                                                               | `prompt-language-ik3n`    |

These should be read as **after-core** work. None of them matter if the runtime cannot first prove a repeatable, evidence-backed supervision story on supported hosts.

## WIP: exploratory orchestration ideas

These are interesting, but they are a step beyond the current core runtime and should not be described like committed syntax.

- Deferred spawn/session-aware compact rendering work — exploratory only, not shipped, and intentionally deferred until the core context-adaptive rendering program and recovery-safe fallback track are validated.
- Bigger orchestration-shell ambitions — intentionally deferred until the repo proves that supervision, verification, and replayable evidence are robust enough to justify a wider shell.

## Long-term research direction

For the broader thesis — prompt language as a primary engineering surface — and a concrete research plan with falsifiable experiments, see [Thesis](strategy/thesis.md) and [Thesis Roadmap](strategy/thesis-roadmap.md).

The important boundary is:

- the **product roadmap** is about making the supervision runtime useful and trustworthy now
- the **thesis roadmap** is about testing whether that runtime can grow into a broader engineering medium later

## Documentation rule

To keep the docs honest:

- The [README](../README.md) and [Language Reference](reference/index.md) document **only shipped features**
- This roadmap summarizes **tracked WIP, partial delivery, and exploratory items**
- Detailed future-facing behavior belongs in [WIP Features](wip/index.md), not the shipped reference
- Research docs may discuss ideas, but they are **not product guarantees**

That keeps "what exists" separate from "what might exist next."
