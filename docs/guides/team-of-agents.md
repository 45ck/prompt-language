# Team Of Agents Guide

This guide describes the current practical way to run a "team of agents" with
prompt-language. The important boundary is that the team is still
subagent-first: a parent flow launches bounded child sessions, waits for them,
imports their outputs, and keeps the final gates authoritative.

Use this when local inference should carry bulk work and a stronger external
model should handle risk classification, escalation, or final review.

## What Team Means Here

A team is a parent-authored flow plus child sessions launched with `spawn` and
joined with `await`. It is not a peer mesh, shared task board, or autonomous
agent society.

The parent owns:

- decomposition
- which runner/model lane gets each step
- when to escalate from local to frontier
- which outputs become follow-up tasks
- verification gates and stop conditions

Child sessions own only the bounded work they were spawned to do.

## Lanes

| Lane                | Default runner/model fit                 | Use for                                                                 |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `local-bulk`        | Ollama, OpenCode, or aider with Ollama   | inventory, repetitive edits, boilerplate, docs from settled decisions   |
| `local-repair`      | Ollama, OpenCode, or aider with Ollama   | verifier-named repairs with narrow files and explicit failing evidence  |
| `frontier-advisor`  | Codex/GPT-5.5-class reasoning            | risk and ambiguity classification before expensive or unsafe work       |
| `frontier-repair`   | Codex/GPT-5.5-class reasoning            | root-cause analysis after repeated local failure or conflicting signals |
| `frontier-reviewer` | Codex/GPT-5.5-class reasoning, read-only | final diff review, hidden-risk checks, architecture/security concerns   |

Frontier output should usually become explicit parent tasks, gates, or stop
conditions. Do not leave it as free-form advice for a local worker to ignore.

## Routing Policy

Default to local when the work is clear, mechanical, or verifier-guided.

Escalate to frontier when any of these are true:

- architecture, security, data-loss, auth, or migration risk is non-trivial
- the local lane fails the same gate twice
- the local lane times out or returns no edit
- test output and user intent conflict
- the next step requires choosing between multiple defensible designs
- the final diff touches high-risk code

Do not escalate for formatting, spelling, import cleanup, or a narrow failing
test with an obvious file owner.

## Minimal Operator Setup

For local child sessions, choose the child-runner lane:

```powershell
$env:PL_SPAWN_RUNNER = 'ollama'
$env:PROMPT_LANGUAGE_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
$env:PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS = '600000'
$env:PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS = '16'
```

For Codex child sessions:

```powershell
$env:PL_SPAWN_RUNNER = 'codex'
```

For experiment runs that compare lanes, record each step in a hybrid-routing
manifest and keep the oracle outside model-visible context.

## Pilot Flow Shape

The planned HA-HR1 pilot lives under `experiments/harness-arena/`:

- `flows/hybrid-router-v0.flow` is the parent supervisor shape.
- `flows/local-bulk-worker.flow` is a bounded local worker child.
- `flows/frontier-reviewer.flow` is a review-only frontier child.
- `hybrid-routing-manifest.schema.json` is the evidence contract.

The pilot is not a claim that hybrid routing works yet. It is the next
measurement harness for deciding whether local bulk work plus frontier review
can match frontier-only quality with fewer frontier calls.

## Rules Of Thumb

- Keep child count low unless the seams are genuinely independent.
- Give each child a narrow file or artifact ownership boundary.
- Make frontier review read-only unless the parent explicitly routes a repair.
- Preserve gates in the parent, not inside only one child.
- Record `riskLevel`, `ambiguityLevel`, route decision, artifacts, and review
  defects for every lane decision.

Related design notes:

- [Multi-Agent Orchestration Boundary](../design/multi-agent-orchestration.md)
- [Team Supervisor Surfaces](../design/team-supervisor-surfaces.md)
- [Hybrid Agent Routing System](../design/hybrid-agent-routing-system.md)
