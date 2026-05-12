# Design: Governed Symphony Local Routing

## Status

Accepted R&D companion to the Portarium governed engineering layer.
Tracking bead: `prompt-language-gslr`
Companion Portarium bead: `bead-1225`
Latest synthesis: `docs/evaluation/2026-05-12-governed-symphony-routing-synthesis.md`

This is not a claim that prompt-language has shipped a Symphony scheduler or
runtime-native per-turn provider routing. It defines how prompt-language should
participate in the first governed-Symphony experiment.

## Thesis

prompt-language should be the executable contract inside a governed engineering
bead.

Portarium owns the board, policy, approvals, evidence, and sandbox lifecycle.
prompt-language owns the execution shape:

- bounded steps
- local/frontier lane choices
- deterministic gates
- retries
- escalation triggers
- required artifacts
- final review handoff

The runtime objective is cost-aware reliability:

```text
Use frontier models to author, classify, repair, and review.
Use local models for bounded bulk work under gates.
Let deterministic checks, not model self-reporting, advance the run.
```

## Why this belongs in prompt-language

OpenAI Symphony shows that a task board can keep coding agents attached to work
items. That solves scheduling and attention. It does not make the work contract
strong enough by itself.

prompt-language adds the missing execution contract:

- `done when` gates for objective completion
- `retry` and `if command_failed` repair loops
- `spawn` / `await` child lanes
- persistent run state
- artifact and manifest requirements
- explicit stop conditions when local work fails

The important boundary is that prompt-language should not become the full
product board. The board belongs to Portarium. PL is the contract that a board
card runs.

## Prior art implications

| Prior art               | Lesson for PL                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAI Symphony         | Keep scheduling outside the flow. A board can own task eligibility, workspace lifecycle, and handoff states.                                           |
| Codex App Server        | Prefer structured events, command approvals, file approvals, and rate-limit telemetry over terminal scraping when a long-lived Codex runner is needed. |
| SWE-agent               | Agent-computer interface design materially affects software-agent performance, so PL handoffs and local-worker action schemas matter.                  |
| AutoCodeRover           | Structured code search, localization, tests, and repair can beat more free-form agents on cost-sensitive issue repair.                                 |
| Agentless               | Simple localization/repair/validation is a serious baseline; PL must prove that orchestration adds value beyond a simple three-phase flow.             |
| ChatDev / MetaGPT       | Role-based multi-agent workflows are useful, but role chat is not enough. PL needs gates, artifacts, and parent-owned state.                           |
| Vibe Kanban-style tools | Visual agent boards are useful, but PL should focus on executable contracts rather than becoming a kanban product.                                     |

## Experiment shape

The first prompt-language experiment should mirror the Portarium R&D arms:

| Arm                 | Runner shape                                                     | Purpose                                              |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| A - frontier-only   | `--runner codex` or equivalent frontier lane for all steps       | Quality and cost baseline                            |
| B - local-only      | `--runner ollama` or local-compatible runner for all model steps | Local capability baseline                            |
| C - advisor-only    | frontier plan/review, local edits                                | Tests whether advice without route control is enough |
| D - governed hybrid | frontier PL author/advisor/reviewer plus local bulk/repair lanes | Tests the actual routing thesis                      |

The first real task should be low risk and small enough that failure is
diagnostic rather than expensive. Good candidates are:

- docs plus a tiny testable code change
- fixture generation plus validator update
- a narrow parser or schema extension with explicit tests
- Cockpit mock/read-model projection with snapshot tests

Avoid first-run tasks involving auth, migrations, money, destructive actions,
or broad UI rewrites.

## Parent supervisor contract

The parent flow must own:

- route decision
- risk and ambiguity classification
- child lane ownership
- timeouts
- command gates
- manifest writing
- escalation thresholds
- oracle isolation
- final completion gate

Children may own only bounded work:

- `local-bulk`: low-risk artifacts and narrow implementation
- `local-repair`: public verifier-named failures
- `frontier-repair`: root-cause analysis after local failure
- `frontier-reviewer`: read-only final diff review

Frontier advice must be converted by the parent into explicit tasks, gates, or
stop conditions before any local worker acts on it.

## Minimal flow sketch

```yaml
agents:
  local-bulk:
    model: "ollama/gpt-oss:20b"
  local-repair:
    model: "ollama/gpt-oss:20b"
  frontier-reviewer:
    model: "gpt-5.5"

flow:
  let route = prompt "Classify this bead by risk, ambiguity, local fit, and gates."

  if ${route.local_fit} == "yes"
    spawn "local-bulk" as local-bulk
      prompt: Implement only the owned low-risk slice. Return files touched, commands run, and risks.
    end
    await "local-bulk" timeout 900
  else
    prompt: Produce the minimal frontier implementation or stop with a reason.
  end

  retry max 2
    run: npm test
    if command_failed
      spawn "local-repair" as local-repair
        prompt: Fix only the public failing test cause. Do not broaden scope.
      end
      await "local-repair" timeout 600
    end
  end

  if command_failed
    prompt: Frontier repair required. Diagnose root cause and produce a minimal patch or stop.
  end

  spawn "frontier-review" as frontier-reviewer
    prompt: Review the final diff for hidden risk. Return blocking findings or "none".
  end
  await "frontier-review" timeout 900

done when:
  all(tests_pass, lint_pass)
```

This is illustrative. The first implementation can use an external harness that
invokes separate local and frontier lanes rather than requiring runtime-native
provider switching.

## Evidence contract

Every lane decision must record:

- `workItemId` or external bead ref
- `runId`
- lane name
- runner
- model
- provider class: `local`, `frontier`, `deterministic`, or `human`
- route trigger
- risk level
- ambiguity level
- timeout policy
- commands run
- gate result
- artifact refs
- diff summary
- review defects
- estimated frontier cost
- local runtime/GPU minutes when available

The existing harness-arena routing manifest is the starting point:

```text
experiments/harness-arena/hybrid-routing-manifest.schema.json
```

The concrete first slice is GSLR-1:

```text
experiments/harness-arena/GSLR-1-MC-PROJECTION-RUNBOOK.md
```

It uses a no-mutation MacquarieCollege projection fixture to verify the manifest,
route, and gate shape before live model runs or Portarium product integration.
The first live result is recorded in:

```text
experiments/harness-arena/results/gslr1-live-2026-05-12/report.md
```

The result is intentionally conservative: it proves the live harness path and
bounded local docs-task capability, but it does not prove hybrid cost reduction.

## What success proves

A successful first experiment proves only the control loop:

- PL can express the local/frontier execution contract.
- Local work can be bounded by gates and escalated cleanly.
- Frontier calls can be counted and reserved for higher-value decisions.
- Portarium can consume the evidence and show a coherent bead lifecycle.

It does not prove:

- local-only autonomy
- universal cost reduction
- safe execution without sandboxing
- quality on large feature work
- that multi-agent chat is superior to simpler localization/repair flows

## Implementation sequence

1. Keep the first pilot manifest-first and harness-driven.
2. Turn `experiments/harness-arena/runner.mjs --live` into a real lane runner.
3. Run the same small task across frontier-only, local-only, advisor-only, and
   governed-hybrid arms.
4. Export a Portarium-compatible evidence artifact.
5. Only after the manifest is stable, consider first-class DSL syntax for
   per-turn provider routing.

## Open questions

- Should provider routing become DSL syntax or stay harness policy?
- Should `spawn` accept explicit runner/provider, not just model/profile?
- Should budget enforcement live in PL runtime, Portarium, or both?
- Can Codex App Server replace `codex exec` for long-running supervised runs?
- What is the smallest evidence package Portarium needs to render a trustworthy
  Cockpit bead card?

## Execution record

2026-05-12:

- Added bead record `prompt-language-gslr`.
- Added this companion design note for the Portarium governed engineering layer.
- Linked this note from `docs/design/index.md`.
- Cross-referenced Portarium bead `bead-1225`.
- Recorded the first experiment arms and proof boundaries before implementation.
- Added GSLR-1 as the first concrete HA-HR1 slice: a safe MC projection fixture
  plus runbook for all four arms.
- Added the 2026-05-12 research synthesis and kept the next step as a live
  four-arm experiment before any product integration.
- Ran GSLR-1 live. `local-only`, `frontier-only`, and advisor rerun passed; the
  hybrid arm had an unresolved blocking review defect and used more frontier
  work than the frontier-only control.
