# Design: Hybrid Agent Routing System

## Status

Accepted experiment architecture for the harness-arena hybrid routing track.
This is not a claim that dynamic per-turn provider routing is shipped.

## Decision

Use a parent prompt-language flow as the supervisor for local-first/frontier-on
escalation work. The system stays subagent-first: the parent launches bounded
child sessions, imports only their outputs, and owns verification gates.

The hybrid router does not introduce peer-agent semantics, hidden task claiming,
or autonomous delegation. It routes work between runner/model lanes and records
the decision trail.

## Context

The local-model experiments show that deterministic scaffolds, gates, and repair
loops can improve artifact coverage, but local models still fail on exact domain
behavior for harder full-stack tasks. The next useful system shape is not an
"advisor" that only writes suggestions. It is a supervisor flow that changes the
runner/model lane for the next bounded unit of work when evidence says local
inference is the wrong tool.

R29 sharpened this boundary. Local Ollama is appropriate for controlled
diagnostics, bulk artifacts, public contracts, checkpoint scripts, and low-risk
repairs. It is not yet evidence that local-only inference can finish every hard
domain behavior slice. When Codex or another frontier model supplies advice,
review, or patches, the run is no longer a local-only claim; it is a hybrid arm.

Drivers:

- keep local models doing bulk and repetitive work
- spend frontier calls only where higher reasoning matters
- preserve oracle isolation and executable gates
- make routing decisions auditable after the run
- avoid turning prompt-language into a multi-agent platform

## Lanes

| Lane                | Responsibility                                             | Default provider class |
| ------------------- | ---------------------------------------------------------- | ---------------------- |
| `local-bulk`        | inventory, mechanical edits, boilerplate, low-risk drafts  | local                  |
| `local-repair`      | verifier-guided fixes after a named local failure          | local                  |
| `frontier-advisor`  | risk, ambiguity, route, and escalation classification      | frontier               |
| `frontier-repair`   | root-cause repair after repeated local failure             | frontier               |
| `frontier-reviewer` | read-only final diff review and hidden-risk identification | frontier               |
| `deterministic`     | shell commands, scaffolds, oracle checks, manifests        | deterministic          |

## Routing Policy V0

Default route is local. Escalate to frontier when:

- risk is high for architecture, security, data loss, auth, permissions, or
  migrations
- ambiguity is high and multiple valid designs exist
- the step is high-leverage domain reasoning rather than bulk artifact work
- local repair fails the same gate twice
- the local runner times out or produces no edit
- evidence conflicts across logs, tests, or user intent
- final review is required for a high-risk diff

Do not escalate formatting, spelling, import cleanup, or deterministic
test-repair work with a narrow file owner.

## Spawn And Handoff Policy

Spawn only bounded children with explicit ownership and stop conditions. Good
spawn seams are independent files, repetitive artifact generation,
verifier-named repair, route classification, and read-only frontier review.

Do not spawn for one continuous design decision, competing edits to the same
files, access to hidden oracle internals, or attempts to outrun a failing gate.
If frontier participation would change the evidence class of the run, stop and
relabel the follow-up as hybrid/escalated work.

Parent-to-child handoff should be narrow: goal, lane, owned artifacts, public
contracts, public failing output, allowed commands, timeout, and next gate.
Child-to-parent handoff should return files touched, commands run, results,
remaining risks, and recommended next gate. The parent decides what becomes
state, tasks, or stop conditions.

## Timeout Policy

Timeouts are routing evidence. A local timeout or no-edit result should either
produce one narrower local repair attempt or trigger frontier classification. A
second same-gate local failure should route to frontier repair or stop the run.
Timeouts must not be hidden by broadening prompts, disabling gates, or spawning
replacement children outside the manifest.

## Runtime Boundary Policy

The hybrid router records and constrains side effects; it is not itself an OS
sandbox. Runtime safety remains a runner and operator responsibility.

Minimum controls for live experiments:

- every local worker has an owned workspace and approved output root
- command execution is allowlisted by fixture rather than open-ended
- local Ollama work is serialized unless measured host capacity supports more
- detached or long-running child processes have parent-owned timeout cleanup
- frontier escalation requires a data-classification note in the manifest
- hidden oracle material is stored and referenced as private evidence, not copied
  into model-visible prompts or traces

## Options Considered

| Option         | Summary                                   | Decision                                               |
| -------------- | ----------------------------------------- | ------------------------------------------------------ |
| Advisor-only   | Frontier writes advice, local still edits | Keep only as a baseline; advice can be ignored         |
| Static split   | Pre-assign stages to local or frontier    | Use for the first pilot because it is reproducible     |
| Dynamic router | Route each step from evidence and budgets | Target system after the manifest and runner stabilize  |
| Frontier-first | Use frontier for most reasoning and edits | Useful control arm, but does not test local-first lift |

## Evidence Contract

Every routed step must record:

- `policyVersion`
- `riskLevel` and `ambiguityLevel`
- route decision, trigger, and escalation reason
- runner, model, provider class, cwd, timestamps, timeout status, and exit code
- input and output artifact references
- diff summary and review defects when present
- oracle result outside model-visible context

Evidence boundaries after R29:

- hidden verifier internals and raw oracle results stay outside child prompts
- public contracts and checkpoint scripts may be model-visible
- frontier advice, reviews, or patches must be labeled as frontier/hybrid input
- local-only claims must keep one runner/model/timeout policy for the whole arm

The schema lives at
[`experiments/harness-arena/hybrid-routing-manifest.schema.json`](../../experiments/harness-arena/hybrid-routing-manifest.schema.json).

## Consequences

Positive consequences:

- local models remain useful for the work they are good at
- frontier calls become bounded decision/review gates instead of default work
- the parent flow keeps verification authoritative
- failures can be classified as routing-policy, model, or harness failures

Tradeoffs:

- more manifest and runbook overhead
- slower wall-clock time when local inference is slow
- harder orchestration than a single frontier run
- not claim-grade until the same fixture runs across local-only, frontier-only,
  advisor-only, and hybrid-router arms

## Follow-Up

Implement HA-HR1 as a static-split pilot first:

- `experiments/harness-arena/flows/hybrid-router-v0.flow`
- `experiments/harness-arena/flows/local-bulk-worker.flow`
- `experiments/harness-arena/flows/frontier-reviewer.flow`
- `experiments/harness-arena/TEAM-OF-AGENTS-RUNBOOK.md`

Then add a runner that writes one manifest per lane and enforces oracle
isolation before comparing pass rate or cost.
