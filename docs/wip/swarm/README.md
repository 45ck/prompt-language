# Prompt Language Swarm Design Pack

This pack captures the current swarm design direction discussed so far and turns it into an implementation-oriented plan for `prompt-language`.

Repo alignment note: this pack is only compatible with the current roadmap if `swarm` stays inside the accepted subagent-first boundary in [docs/design/multi-agent-orchestration.md](../../design/multi-agent-orchestration.md) and lowers to existing runtime primitives.

WIP note: this is an imported planning pack, not shipped syntax or committed runtime behavior.

## Included docs

- `01-context-and-thesis.md` — what swarms are, why they fit prompt-language, and the guiding mental model
- `02-v1-design.md` — the proposed v1 feature set
- `03-grammar-and-lowering.md` — syntax, desugaring, and runtime semantics
- `04-examples.md` — concrete flow examples
- `05-why-not-all-the-cool-stuff-yet.md` — staged roadmap for the higher-ambition features
- `06-implementation-plan.md` — parser/runtime/docs/test milestones
- `07-open-questions.md` — design questions to settle before coding
- `08-evaluation-rollout.md` — success criteria and rollout gates
- `references.md` — source list used in this pack

## Core decision

`swarm` should be introduced as a **declarative orchestration layer that lowers to existing prompt-language primitives**, not as a brand new autonomous runtime.

This is the explicit boundary tracked by `prompt-language-1wr7.1`. The swarm pack is only in scope if it stays inside the accepted subagent-first decision in [docs/design/multi-agent-orchestration.md](../../design/multi-agent-orchestration.md).

This keeps the feature aligned with the current product identity:

- control-flow runtime
- deterministic supervision
- explicit gates
- bounded engineering workflows

## One-line framing

**prompt language = control plane**  
**swarm = a role-structured execution topology inside that control plane**

## V1 boundary

`swarm` v1 is a parent-authored macro over existing runtime behavior:

- role definitions are child templates, not independent team members
- `start` lowers to `spawn`
- `await` lowers to parent-controlled `await` plus explicit result import
- `return` lowers to explicit child-to-parent transport over the existing messaging model
- final truth still lives in outer `done when:`, `review`, and `approve` gates

V1 coordination patterns that fit this boundary:

- manager-worker splits
- bounded fan-out and fan-in
- reviewer-after-workers or judge-after-workers sequences
- observer or watchdog roles when the parent still owns ordering and completion

V1 exclusions:

- nested swarms
- agent-team or peer-mesh semantics
- shared mutable swarm scope across roles
- autonomous delegation, work stealing, or role negotiation
- shared task boards or team memory buses
- any hidden scheduler or runtime that can continue coordinating outside the parent flow graph

## Recommended rollout

- **v1**: manager-owned swarm macros
- **v1.5**: better ergonomics for competition and coordination
- **v2**: permissions, richer result schemas, optional cancellation
- **v3+**: handoffs / nested swarms / shared memory only if evals prove the need

Tracked in Beads as `prompt-language-1wr7`.

## Artifact generation note

This design pack was assembled from the design discussion and current public docs for:

- `45ck/prompt-language`
- OpenAI agent orchestration guidance
- Anthropic agent design guidance

See `references.md` for the source list.
