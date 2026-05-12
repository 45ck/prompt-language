# GSLR-5 Local Repair Runbook

Status: live local diagnostic after GSLR-5 safe-ref failure  
Tracking bead: `prompt-language-gslr17`

## Question

Can the local GSLR-5 lane be repaired enough to preserve safe relative artifact
refs while still rejecting raw-payload and secret traps?

## Why This Exists

The first GSLR-5 local diagnostic failed before reaching the adversarial raw
payload traps. It rejected the safe card because it treated valid relative refs
such as `private/oracle/stdout.txt` as unsafe.

That was a lane-design failure, not a proof that the local model cannot ever
solve the sanitizer. The repair test keeps the same fixture and oracle but makes
artifact-ref semantics explicit in the local prompt.

## Repair

The repaired local prompt says:

- artifact refs are repository-relative evidence paths, not URLs;
- safe refs include `hybrid-routing-manifest.json`,
  `private/oracle/stdout.txt`, and `artifacts/steps/01-local-bulk/stdout.txt`;
- unsafe refs contain query/fragment text, absolute paths, URL schemes, parent
  traversal, or raw dump names.

## Verdict Rule

This run is diagnostic only. A local pass would show that the lane prompt can be
repaired; it would not by itself promote privacy-sensitive sanitization to
local-screen.

Promotion still requires repeated hidden-oracle passes and a route-policy update
that explains the safety boundary.

## Product Boundary

Portarium runtime ingestion, live Cockpit cards, and MacquarieCollege raw data
movement remain blocked regardless of this diagnostic result.
