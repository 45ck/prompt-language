# Design: Artifact Syntax and Review UI Rollout Gate

## Status

Backlog-ready rollout gate for `prompt-language-50m6.9`.

Primary anchors:

- [`docs/design/artifact-package-contract.md`](artifact-package-contract.md)
- [`docs/design/artifact-runtime-lifecycle.md`](artifact-runtime-lifecycle.md)
- [`docs/design/artifact-extension-boundary.md`](artifact-extension-boundary.md)
- [`docs/wip/artifacts/README.md`](../wip/artifacts/README.md)
- [`docs/wip/artifacts/proposed-artifact-syntax.md`](../wip/artifacts/proposed-artifact-syntax.md)
- [`docs/wip/artifacts/current-dsl-workarounds.md`](../wip/artifacts/current-dsl-workarounds.md)
- [`docs/wip/artifacts/open-questions.md`](../wip/artifacts/open-questions.md)

This note does not claim that prompt-language already ships artifact DSL syntax, artifact-aware gates, or a review UI. It defines the rollout gate that must be satisfied before any user-facing syntax or review surface is presented as supported product behavior.

## Decision

User-facing artifact syntax and review UI stay blocked until the earlier artifact protocol work is both accepted and evidenced in implementation.

Specifically:

- prompt-language must not add or document first-class artifact DSL syntax until package, lifecycle, and extension semantics are implemented strongly enough that the syntax lowers to stable runtime behavior
- prompt-language must not claim a review UI until core can show revision-scoped artifact review state and a renderer-independent fallback surface
- the default posture is "no new DSL syntax yet" unless evidence shows that host commands and plugin surfaces cannot deliver the needed reviewable behavior without unacceptable ambiguity or drift

The current release target is therefore a gated progression:

1. artifact protocol semantics first
2. implementation proof for package, lifecycle, and extension boundaries
3. evidence-backed decision on whether first-class syntax is necessary
4. only then, optional rollout of user-facing syntax and review UI

## What this gate is protecting

The accepted artifact notes already fix the underlying protocol shape:

- [`artifact-package-contract.md`](artifact-package-contract.md) makes the package and manifest the durable unit, not a Markdown or HTML file
- [`artifact-runtime-lifecycle.md`](artifact-runtime-lifecycle.md) fixes emit, validate, reference, review, and supersede as runtime semantics
- [`artifact-extension-boundary.md`](artifact-extension-boundary.md) keeps declarations repo-owned, revisions immutable, and rich renderers optional

If syntax or UI lands before those contracts are proven in runtime behavior, prompt-language would risk:

- advertising syntax that cannot preserve the accepted lifecycle semantics
- hard-coding UI assumptions that only work for one renderer or one host
- freezing a DSL shape before the repo has enough evidence that the shape is necessary
- collapsing flow approval, artifact review, and renderer availability into one misleading user story

This bead therefore acts as a release-cut guard, not as a syntax proposal.

## Blocking dependencies

This rollout gate remains blocked until the following earlier protocol work is complete enough to test as a coherent slice:

| Bead                     | Why it blocks syntax and UI rollout                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `prompt-language-50m6.3` | Syntax cannot target artifact objects until the package, manifest, content, view, and attachment contract is stable         |
| `prompt-language-50m6.4` | UI and gates cannot speak about artifact status until lifecycle, validation, review, and supersede semantics are stable     |
| `prompt-language-50m6.8` | Review UI cannot be credible until review records, revision scoping, custom declarations, and renderer boundaries are fixed |

Additional practical dependency:

- built-in artifact families from `prompt-language-50m6.2` should exist or be intentionally deferred, otherwise syntax examples will over-specialize around hypothetical types rather than proving the minimal viable artifact protocol

This means `prompt-language-50m6.9` is a future rollout gate, not the place to invent protocol rules by implication.

## Decision frame: should syntax exist at all?

The WIP material includes plausible syntax in [`proposed-artifact-syntax.md`](../wip/artifacts/proposed-artifact-syntax.md), but those examples are explicitly design proposals and not current shipped syntax.

The correct question for this bead is not "what should the syntax look like?" It is:

**Does prompt-language need first-class artifact syntax at all, or should artifact interaction remain in host surfaces, package declarations, and plugin-provided review tooling?**

The decision must compare three rollout options.

### Option A: no first-class DSL syntax

Artifacts remain driven by:

- existing flow primitives such as `run`, `approve`, `spawn`, `await`, and `done when:`
- checked-in artifact declarations and package conventions
- host or CLI commands that emit and inspect artifact packages
- optional plugin surfaces for richer review and export

Strengths:

- preserves current DSL simplicity
- avoids freezing syntax before implementation evidence exists
- keeps artifact evolution concentrated in package, runtime, and host boundaries

Costs:

- flows may remain verbose
- artifact authoring may depend on conventions or helper commands rather than declarative language support
- ergonomics may vary by host

This is the default outcome unless the evidence for syntax is strong.

### Option B: minimal first-class syntax

prompt-language adds a narrow artifact surface only after the protocol is stable, for example:

- explicit artifact emission
- artifact reference by stable handle
- artifact-aware gate predicates that inspect observable lifecycle state

Strengths:

- gives the flow language direct names for high-value artifact operations
- can reduce file-workaround noise shown in [`current-dsl-workarounds.md`](../wip/artifacts/current-dsl-workarounds.md)
- still keeps renderer choice and rich review outside the DSL

Costs:

- requires careful lowering to accepted lifecycle semantics
- risks expanding quickly if the minimal boundary is not enforced

If syntax is added, this is the highest acceptable ambition for the first release cut.

### Option C: broad first-class artifact DSL plus review UI in core

This would include declaration, emission, validation, approval targeting, render requests, and rich review surfaces as part of the product story.

This option is rejected for the first rollout window because it would:

- overcommit before protocol proof exists
- couple the language to renderer and UI choices that the extension-boundary note keeps optional
- make examples look more shipped than the runtime really is

The repo should not take this path without reopening the earlier artifact decisions.

## Accepted rollout posture

The accepted rollout posture is:

- start from Option A as the baseline
- allow promotion to Option B only if evidence shows that host and plugin surfaces are insufficient
- prohibit Option C for the initial user-facing claim set

In practical terms, prompt-language should prefer:

- protocol-first implementation
- host- and package-level proof
- minimal syntax only where it removes real ambiguity or repeated workaround cost
- UI claims only for renderer-independent review behaviors that core can always satisfy

## Review UI boundary

The review UI question must stay aligned with the extension-boundary decision.

Core review surface requirements before any UI claim:

- open one artifact revision as a package, not as a guessed file
- show manifest identity, type, schema version, provenance, and lifecycle status
- show revision-scoped review state and supersession links
- present a human-legible fallback summary even when no rich renderer is installed

Optional UI capability that may be host- or plugin-provided:

- HTML review views
- threaded comments over sections or attachments
- attachment galleries and previews
- DOCX, PDF, or browser-oriented export and review modes

This means "review UI" must not be interpreted as "core ships a rich browser app." The minimal promotable meaning is that a user can reliably inspect the artifact package and its review status through an official, supported surface. Richer visual review remains additive capability.

## Evidence required before syntax or UI promotion

No user-facing syntax or UI claim should be promoted until the repo has concrete evidence in these categories.

### 1. Protocol implementation evidence

Must exist:

- package emission that matches the accepted package contract
- lifecycle state transitions that match emit, validate, reference, review, and supersede semantics
- revision-scoped review records and supersession behavior that match the extension boundary

Evidence examples:

- implementation merged for package creation and manifest validation
- tests proving immutable revision behavior
- tests proving review records stay tied to the reviewed revision

### 2. Fallback reviewability evidence

Must exist:

- core-readable manifest inspection
- core-generated or core-readable fallback summary surface
- behavior when no plugin renderer is available

Evidence examples:

- acceptance tests that open and inspect artifacts without rich renderers
- smoke flows that emit an artifact, review it, supersede it, and inspect both revisions

### 3. Ergonomics evidence

Must exist before any DSL syntax is added:

- repeated real workflows showing host-only or workaround-based artifact handling is too verbose, too ambiguous, or too fragile
- comparison of those workflows against a minimal syntax candidate

Evidence examples:

- reference flows drawn from actual artifact-producing tasks
- side-by-side examples showing where `run` plus files materially harms clarity or correctness
- evidence that the proposed syntax lowers cleanly to the accepted runtime model

### 4. Non-misleading documentation evidence

Must exist:

- docs can clearly separate shipped behavior from future examples
- examples do not require hypothetical renderers or unimplemented artifact states to appear valid

Evidence examples:

- a release-ready examples pack using only supported artifact behavior
- docs review confirming that proposed syntax examples are either removed or still explicitly labeled as design-only

## Promotion criteria

Before prompt-language may make a public user-facing claim such as "artifacts are supported in the DSL" or "artifact review UI is available," all of the following must be true.

### Promotion to "artifact protocol supported"

Required:

- `prompt-language-50m6.3`, `prompt-language-50m6.4`, and `prompt-language-50m6.8` are implemented enough to validate against their accepted notes
- at least one built-in or declared artifact type can be emitted, validated, reviewed, and superseded end to end
- CI and targeted smoke coverage prove that the protocol works without depending on hypothetical syntax

### Promotion to "minimal artifact syntax supported"

Required:

- artifact protocol support is already true
- the repo has evidence that host/plugin surfaces are insufficient for common workflows
- the syntax surface is minimal and maps directly to accepted runtime semantics
- docs, tests, and smoke coverage cover invalid, missing, not-yet-reviewed, and superseded artifact cases

### Promotion to "artifact review UI supported"

Required:

- artifact protocol support is already true
- the review surface can display revision-scoped review history and fallback summaries without plugin-only assumptions
- renderer absence produces graceful degradation rather than broken inspection
- documentation names the exact supported surface, such as CLI, host panel, or browser view, instead of implying a broader product UX than exists

## Rejected promotion shortcuts

The following are not sufficient evidence for rollout:

- WIP syntax examples alone
- one successful HTML renderer demo
- file-based workarounds that merely resemble artifacts
- approval prompts that mention artifacts without revision-scoped review records
- documentation that says "artifact support" when the implementation is still host-specific experiment code

## User-facing language constraints

Until the promotion criteria above are satisfied, docs and examples should use language like:

- "design proposal"
- "future artifact support"
- "candidate syntax"
- "workaround using current primitives"

Docs should not use language like:

- "prompt-language artifacts support `emit artifact`"
- "artifact review UI is available"
- "artifact-aware gates are shipped"

unless the corresponding implementation and evidence exist.

## Consequences for later work

This gate constrains later slices as follows:

- syntax proposals must justify themselves against the "no syntax" baseline rather than assuming DSL expansion is inevitable
- host integrations may ship earlier artifact inspection helpers, but they must not be documented as general language support unless the promotion criteria are met
- review surfaces must be explicit about which parts are core fallback behavior and which parts depend on optional renderers or plugins

## Current repository status

As of April 11, 2026, the repository has accepted design notes for package, lifecycle, and extension boundaries, plus WIP examples of candidate syntax and current file-based workarounds.

What the repo does not yet have, based on those anchors, is sufficient evidence to claim:

- first-class artifact DSL syntax
- artifact-aware completion or approval syntax as shipped behavior
- a stable user-facing review UI contract

That is the gap this rollout gate preserves.
