# Design: Fresh-Step Bootstrap Context

## Status

Accepted design target for bead `prompt-language-r8vp.6`.

Upstream context:

- [Import Backlog](../wip/tooling/ecosystem/import-backlog.md)
- [Agent Loom](../wip/tooling/ecosystem/references/agent-loom.md)
- [Run-State V2 and Recovery Artifacts](run-state-v2-recovery-artifacts.md)
- [Host Extension Boundary](host-extension-boundary.md)

This note defines the **bootstrap context package** for fresh-step execution. It is intentionally scoped to packet contents and packaging rules. It does not decide when fresh-step execution should be chosen over threaded continuation.

## Decision

Fresh-step execution may start a new agent session only when prompt-language can hand that session a **deterministic bootstrap packet** with:

- a clear task boundary
- the minimum runtime facts needed to act safely
- explicit references to supporting artifacts
- runner-neutral metadata that works on today's headless path and future supported-host runners

The packet must be **small, explicit, and inspectable**.

It must carry enough context for the fresh step to start correctly, but it must not try to smuggle the entire prior session transcript into every handoff.

## Why this needs a first-class contract

Without a packet contract, fresh-step execution will drift in one of two bad directions:

- under-carrying context, where the fresh step lacks the task boundary, constraints, or artifact pointers needed to behave correctly
- over-carrying context, where the fresh step inherits too much stale or low-signal material and recreates the same context-rot problem fresh-step execution is supposed to reduce

The bootstrap packet is therefore the safety boundary between:

- the prior run state and artifacts prompt-language already owns
- the new step-local session that should begin with only the context it actually needs

## Core model

A **bootstrap packet** is a structured, runner-neutral handoff bundle for one fresh step.

The packet is not:

- a full replay log
- a hidden memory substrate
- a replacement for run-state artifacts
- a generic host-extension envelope

The packet is:

- the minimum startup context for one fresh step
- a visible artifact prompt-language can inspect, persist, and debug
- a pointer layer over existing artifacts rather than a second source of truth

Practical rule:

If a field can be derived reliably from existing run-state or referenced artifacts, prefer carrying a pointer or summary rather than copying the full raw content.

## Packet contents

The bootstrap packet has four content classes:

- task boundary
- artifact references
- constraints and operating rules
- flow and runtime metadata

These classes are intentionally stable across runner adapters.

## Mandatory contents

Every fresh-step bootstrap packet must include the following fields or their runner-neutral equivalent.

### 1. Packet identity

Required:

- `packetVersion`
- `runId`
- `stepId` or equivalent stable step identity
- `createdAt`
- `runnerIntent` such as `claude`, `codex`, `opencode`, or other selected target

Why:

The runtime needs to know which run and which fresh step the packet belongs to, and later recovery needs a stable identity to point back to the exact handoff.

### 2. Task boundary

Required:

- step objective in one concrete paragraph
- explicit success condition for this step
- explicit stop condition or hand-back condition
- task-local scope boundaries

The task boundary must answer:

- what this fresh step is supposed to do
- what counts as done for this step
- what it must not widen into on its own

This is the most important mandatory content. A fresh step without a sharp task boundary is just an amnesiac continuation.

### 3. Required artifact references

Required:

- primary flow or rendered workflow reference
- state reference for the parent run
- any artifact the step must inspect before acting

Artifact references should be file paths or stable artifact IDs, not vague prose like "see the latest design note".

At minimum, the packet must make it obvious:

- which flow or rendered step the agent is executing from
- which state or recovery artifact represents the current run
- which inputs are mandatory before the fresh step can claim completion

### 4. Constraints

Required:

- repo or task rules that materially constrain the step
- architectural boundary relevant to the step
- verification requirement for claiming completion
- disallowed actions when those are step-critical

Constraint content must be operational. Good examples:

- run `npm run test` before claiming complete
- do not edit Beads state
- create exactly one new file
- preserve architecture boundary `presentation -> infrastructure -> application -> domain`

Bad examples:

- broad motivational guidance
- generic agent philosophy
- long policy dumps with no step-specific effect

### 5. Runtime handoff metadata

Required:

- parent run identifier
- fresh-step execution reason or trigger
- expected output shape for this step
- return path describing where outputs or completion evidence should land

This metadata lets the runtime reconnect the fresh step to the parent flow without needing hidden transcript context.

## Optional contents

Optional fields are allowed only when they lower execution risk for the specific step.

### 1. Secondary artifact references

Examples:

- design notes for nearby constraints
- prior evaluation output
- snapshots, diagnostics, or logs
- child-run topology references

These are valid only when the step realistically needs them to act.

### 2. Compact prior-state summary

Allowed:

- a short summary of what already happened
- last blocking issue
- last known failing gate
- current owner or role framing when the flow depends on it

This summary should stay compact and should point back to the authoritative artifact when more detail exists elsewhere.

### 3. Runner-specific hints

Examples:

- model selection hint
- supported-host attachment hint
- headless-safe output expectation

These may improve ergonomics, but they must never become mandatory for semantic correctness.

### 4. Tooling or workspace hints

Examples:

- working directory
- expected branch or worktree path
- relevant environment file path

These are optional because not every fresh step needs them, and some runners may source them from the host environment instead.

## Explicit exclusions

The bootstrap packet must not include the following by default:

- full prior transcript dumps
- unbounded logs
- entire source trees or broad file inventories
- every project rule regardless of relevance
- host-specific extension manifests
- speculative memory or inferred intent with no artifact backing

These are the main sources of packet bloat and ambiguity.

## Task boundary contract

The task boundary section deserves stricter wording than the rest of the packet.

It must be written so a fresh session can start work without asking:

- what am I supposed to produce?
- what files am I allowed to touch?
- when should I stop?

Minimum boundary fields:

- `objective`
- `allowedChanges`
- `forbiddenChanges`
- `doneWhen`

If any of those are missing, the packet is incomplete.

This does not require policy-level debate about fresh versus threaded execution. It is simply the minimum shape needed for safe startup.

## Artifact contract

Artifact handling should follow the same visible-artifact discipline used elsewhere in the repo.

Rules:

1. Prefer file paths or stable artifact IDs over pasted content.
2. Carry inline content only when the step cannot proceed without exact text at startup.
3. If inline content is carried, keep it bounded and identify its source artifact.
4. When an artifact can change during execution, the packet should identify whether the fresh step should treat the artifact as a startup snapshot or re-read the live file.

Practical examples:

- a design-writing step may need one target file path, one nearby design note, and an explicit "do not edit other files" constraint
- a verification step may need the latest diagnostics file, last gate outcome, and exact commands required before completion

## Constraints contract

Constraint packaging must distinguish between:

- mandatory rules the fresh step must obey
- optional operator hints that improve speed but do not change correctness

Mandatory constraints should be few and explicit.

If the packet includes a long mixed list of hard rules and soft suggestions, the fresh step has to guess what matters. That weakens reliability.

Good packet behavior:

- include the exact architecture, verification, and file-scope limits that matter
- omit repo guidance that has no effect on the current step

## Flow and runtime metadata contract

Fresh-step execution still belongs to a larger flow, so the packet needs enough runtime metadata to preserve continuity.

Required metadata semantics:

- identify the parent run and current step
- identify the source flow or rendered workflow version
- describe whether this step is a fresh child, a retry, a recovery resume, or a delegated subtask
- identify where completion evidence should be written or reported

Useful optional metadata:

- parent node label
- retry count
- prior attempt artifact
- gate ownership hint

This metadata should support recovery and inspection, not become a hidden orchestration protocol.

## Runner compatibility

The packet contract must work across two execution families:

- existing headless runners
- future supported-host runners with richer native lifecycle surfaces

### Existing headless runners

On the current headless path, the packet must be sufficient without assuming:

- interactive thread history
- live host-side memory
- privileged attachment surfaces

That means headless correctness depends on the packet being self-sufficient in task boundary, constraints, and artifact references.

### Future supported-host runners

Future supported-host runners may expose richer session lifecycle features, but the bootstrap packet should still remain canonical for fresh-step startup.

Supported-host adapters may enrich execution with:

- better attachment or resume UX
- host-native thread or session metadata
- richer diagnostics around startup and completion

They may not treat hidden host state as a replacement for the packet's mandatory contents.

Practical boundary:

If a fresh step cannot start correctly from the packet alone, the contract is too host-dependent.

## Risks

### Over-carrying context

Main risks:

- stale assumptions survive longer than they should
- packet size grows until startup becomes noisy and brittle
- fresh-step execution stops being meaningfully fresh
- duplicate copies of artifacts drift from the real source files

Mitigation:

- keep mandatory fields narrow
- prefer references over copies
- force optional content to justify itself by step need

### Under-carrying context

Main risks:

- the fresh step re-derives facts inconsistently
- constraints are violated because they were not carried forward
- completion claims are weak because success conditions were absent
- runner behavior diverges because adapters fill the gaps differently

Mitigation:

- require task boundary, artifact references, constraints, and runtime metadata in every packet
- block packet creation when one of those classes is incomplete

### Host-specific drift

Main risk:

- a richer future runner starts depending on hidden host state and silently weakens portability

Mitigation:

- keep packet semantics runner-neutral
- treat host enrichments as optional, never as the sole source of mandatory context

## Consequences

What this unblocks:

- a concrete bootstrap packet schema for fresh-step execution
- packet inspection and debugging grounded in visible artifacts
- one handoff model that works for today's headless runtime and future supported-host runners

What this constrains:

- fresh-step startup must not depend on implicit thread carryover
- packet builders must justify optional content rather than dumping prior session state wholesale
- runner adapters must preserve the same mandatory packet semantics

## Practical rule

When deciding whether a field belongs in the bootstrap packet, ask:

> Does this field define the fresh step's task boundary, point to required evidence, enforce a real constraint, or preserve runtime continuity?

If yes, it likely belongs.

If it is just convenient historical spillover or host-specific hidden state, it should stay out.
