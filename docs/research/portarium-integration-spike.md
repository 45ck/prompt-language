---
title: Portarium Integration Spike
status: research-only — no spec, no code, no commitment
last-updated: 2026-05-11
sister-repo: ../../../Portarium/  (45ck/Portarium)
---

# Portarium Integration Spike

Portarium is the operator-facing control plane this runtime is being
designed to plug into eventually. This doc captures the current state of
that relationship from the prompt-language side. It is research, not
contract.

## Position today

- Portarium ships an HTTP control plane
  (`Portarium/docs/spec/openapi/portarium-control-plane.v1.yaml`) for
  workflow runs, agent actions, approvals, and evidence retrieval.
- Portarium has **no inbound contract** for a flow runtime like
  prompt-language to register itself, receive flow dispatch, or push gate
  evidence. The current evidence pipeline is internal to Portarium's own
  workflow events.
- prompt-language exposes a CLI, SDK (`parseFlow`, `createSession`,
  `evaluateCompletion`, `advanceFlow`), and an MCP server. None of these
  are remote-callable as an HTTP/gRPC service that Portarium could
  invoke.

## Gaps

Five concrete contract gaps are documented in detail on the Portarium
side: runtime registration, flow dispatch, evidence/gate-result bridge,
workspace binding, capability declaration. See
[`Portarium/docs/integration/prompt-language-runtime.md`](../../../Portarium/docs/integration/prompt-language-runtime.md)
for the surface mapping and natural placement in Portarium's
domain/application/presentation layers.

## Trigger to start integration

This spike does not trigger work. The trigger is the first portfolio-level
positive verdict on the [Kill rule](../strategy/thesis.md#kill-rule) and
[Hybrid-efficiency tracker](../strategy/program-status.md#2a-hybrid-efficiency-tracker):
≥3 distinct task classes outside hybrid-failure-mode, ideally with at
least one route producing a claim-eligible bundle per
[program-status §3a](../strategy/program-status.md#3a-claim-eligibility-rule).

Until then the prompt-language runtime should keep its surface stable but
should not invest in HTTP/gRPC service exposure or Portarium-specific
adapters. The current CLI / SDK / MCP shape is sufficient for the
HA-HR1 evidence work; adding Portarium-specific scaffolding now would
harden assumptions that may not survive the experimental phase.

## Cross-references

- Portarium-side integration finding: [`../../../Portarium/docs/integration/prompt-language-runtime.md`](../../../Portarium/docs/integration/prompt-language-runtime.md)
- Hybrid-efficiency tracker (current portfolio): [`../strategy/program-status.md`](../strategy/program-status.md#2a-hybrid-efficiency-tracker)
- Kill rule (program-level stop condition): [`../strategy/thesis.md`](../strategy/thesis.md#kill-rule)
