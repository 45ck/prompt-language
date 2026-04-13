# E4 Software-Factory Program

Date: `2026-04-13`

This note is the execution bridge between the E4 research docs and the repo-native Beads backlog.

## Bead Program

- `prompt-language-ksih` — E4 software-factory research track
- `prompt-language-ksih.1` — E4 method reset: claim families and factory-quality rubric
- `prompt-language-ksih.2` — E4 build-verification contract for factory runs
- `prompt-language-ksih.3` — E4 artifact-contract verification for SDLC outputs
- `prompt-language-ksih.4` — E4 trace and provenance artifacts for prompt-language and baseline Codex
- `prompt-language-ksih.5` — E4 closure enforcement v2 and admissibility hardening
- `prompt-language-ksih.6` — E4 SDLC default-gates and software-quality contract in factory flows
- `prompt-language-ksih.7` — E4 paired factory-quality execution batch
- `prompt-language-ksih.8` — E4 governed recovery execution batch

## Current Status

- `in_progress`: `prompt-language-ksih`, `prompt-language-ksih.1`, `prompt-language-ksih.2`, `prompt-language-ksih.3`, `prompt-language-ksih.4`, `prompt-language-ksih.5`, `prompt-language-ksih.6`
- `open`: `prompt-language-ksih.7`, `prompt-language-ksih.8`

The current implementation wave covers the method, evidence, trace, artifact, closure, and
SDLC-default gate layers. The remaining open work is execution: the new `factory-quality` and
`recovery` batches.

## Why This Exists

The archived `S0` throughput result is useful, but it is no longer the main E4 question.

The active E4 program is now:

1. prove `prompt-language` can run as a governed software factory
2. prove the produced software is actually good and reaches green through explicit gates
3. prove the factory recovers better than the direct baseline under interruption and resume

## Quality Contract

For E4, "good software" means all of the following are true:

- the bounded product slice is completed against one shared product contract
- required SDLC artifacts exist for the slice:
  `requirements`, `architecture`, `implementation`, `test strategy`, `handover`, and `verification evidence`
- required verification gates pass for the lane:
  `lint`, `typecheck`, `test`, plus `build` when the bounded slice exposes a build target
- the run keeps machine-readable evidence:
  `run.json`, `lane-summary.json`, `artifact-inventory.json`, `scorecard.json`, `postmortem.json`, `interventions.json`
- the verdict distinguishes:
  `product` failure, `runtime` failure, `config` failure, and `evidence` failure

## Execution Order

1. `prompt-language-ksih.1`
2. `prompt-language-ksih.2`
3. `prompt-language-ksih.3`
4. `prompt-language-ksih.4`
5. `prompt-language-ksih.5`
6. `prompt-language-ksih.6`
7. `prompt-language-ksih.7`
8. `prompt-language-ksih.8`

## Current Wave Coverage

- `prompt-language-ksih.1`: reflected in the claim-family split and the `e4-v2` scorecard schema
- `prompt-language-ksih.2`: reflected in the shared verification contract capture and product-failure framing
- `prompt-language-ksih.3`: reflected in `artifact-inventory.json` and artifact-contract scoring
- `prompt-language-ksih.4`: reflected in stronger lane summaries, trace provenance, and run metadata
- `prompt-language-ksih.5`: reflected in closure checks for provenance, lane summaries, artifact inventory, and structured closure artifacts
- `prompt-language-ksih.6`: reflected in the dedicated `factory-quality` control surface, richer core-proof artifact contract, and stronger SDLC/default gate enforcement in the CRM factory libraries
- `prompt-language-ksih.7` to `.8`: not yet executed in this wave

## Current Read

- `B02` remains the archived answer for bounded `S0` raw throughput: `codex-alone-better`
- the open hypothesis now is not throughput
- the open hypotheses are `factory-quality` and `recovery`

## Next Run

The next admissible E4 run should be a clean paired `factory-quality` attempt that:

- uses the frozen bounded CRM slice
- preserves full traces for both lanes
- judges the result on governed process quality, not raw speed
