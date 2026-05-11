---
title: Current plan after May 11 evidence
status: planning; not a shipped product contract
operator: 45ck
date: 2026-05-12
---

# Current plan after May 11 evidence

<!-- cspell:ignore j0je j1xa j64j 5io5 3nrj HR1 rpncalc tinymd qwen devstral overclaimed -->

This page is the operator-facing plan after the 2026-05-11 Concord/VHO
experiments and the multi-agent scrutiny pass on 2026-05-12. It is deliberately
not a README replacement and not a language reference. It answers:

1. what has actually been discovered,
2. what remains unproven,
3. whether the project should be in engineering or research mode,
4. what beads should be created or worked next.

## Current verdict

The product can move into **real engineering mode** for a narrow target:

> Make prompt-language a trustworthy verification-first supervision runtime for
> coding agents, with claim-grade evidence bundles and bounded recovery loops.

The broader thesis remains in **scientific research mode**:

> Prompt-language as the primary engineering surface for bounded software is not
> proven. It should be tested through staged experiments, not presented as
> shipped product behavior.

The strongest practical direction is therefore:

1. define and enforce the claim verifier and runner-safety profile,
2. stabilize claim-eligible runtime evidence under that profile,
3. prove repeated-failure recovery with PL gates,
4. only then test multi-file projects, wisdom, and primary-surface claims.

## What is discovered

| Finding                                                     | Status               | Boundary                                                                                   |
| ----------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| PL is valuable as a verification-first supervision runtime  | Defensible           | Stronger than the primary-engineering-medium thesis.                                       |
| Local models can help inside deterministic PL envelopes     | Defensible           | Best for bounded selection, ranking, rationale, risk response, and small code tasks.       |
| Microtask routing can work when specs and oracles are clear | Directional          | Same-author oracle and curated tasks mean the 100/100 headline was overclaimed.            |
| Hybrid local/frontier is cost-negative for app-build scope  | Directional          | TODO CLI showed frontier scaffolding dominates local savings; baseline cost was estimated. |
| Hybrid is cost-negative for real-software multistage builds | Directional/strong   | tinymd and rpncalc show the scaffolding/reuse economics do not yet break even on dollars.  |
| Operator signer is provisioned                              | Shipped in principle | `operator-45ck-2026-05` exists, but no run has passed all claim-eligibility gates.         |
| Attested bundle path is real but not clean                  | Partial              | Signed bundle exists; verifier still fails on trace, witness, and path blockers.           |
| Ollama runner is an action-protocol tool loop               | Defensible           | It is not a generic single-turn text-generation adapter.                                   |
| Local smoke claim-profile classification exists             | Partial              | `qwen3-coder:30b` quick smoke is recorded-only and currently passes `35/39` cases.         |

## What is not discovered

- Whether PL improves real engineering outcomes over plain prompting across
  locked, independently authored benchmarks.
- Whether multi-file prompt-language projects outperform one large flow.
- Whether reusable `wisdom.flow` or memory reduces repeated babysitting.
- Whether PL worker decomposition improves medium-complexity delivery without
  integration overhead.
- Whether engineers will prefer editing `.flow` files before editing code.
- Whether hybrid/local routing generalizes beyond curated microtasks.
- Whether claim-eligible runs can be produced repeatedly under strict trace,
  preflight, attestation, cross-family review, and trusted-signer rules.
- Whether local Ollama can pass the full quick smoke matrix once deterministic
  runtime-smoke failures are triaged.

## What we are working toward

The next meaningful product shape is:

> Auditable agent supervision: a PL flow that owns the work loop, records every
> gate and routing decision, signs the evidence bundle, and lets downstream CI or
> a reviewer reject unsigned, stale, weak, or unverifiable runs.

That is useful even if the larger thesis fails. If the larger thesis holds, this
runtime becomes the substrate for prompt-language projects as an engineering
medium later.

## Roadmap

### Phase 0: define the claim boundary

Goal: make "claim-eligible" mean one executable runtime-safety and evidence
profile, not a loose combination of trace and signature checks.

Exit criteria:

- one claim-verifier profile is shared by smoke, eval, and meta claim paths;
- the profile requires strict trace, state, expected run id, freshness, minimum
  entries, expected pair count, trusted signer pin, real reviewer family/proof,
  and `--require-attestation --require-role operator`;
- runner capability manifests cover command, file, network, env, write roots,
  process leases, and child/reviewer authority;
- missing capability manifest, unsafe mode, or host CLI permission bypass forces
  `recorded-only`, not `claim-eligible`;
- Ollama bundles without a shim or equivalent transport witness are
  `recorded-only`;
- reviewer and child-process handoffs declare owned paths, allowed commands,
  artifact schema, timeout, import boundaries, and conflict behavior.

Progress: smoke reports now include claim-profile classification and runner
capability manifests, and traced prompt-turn entries can carry runner capability
evidence. The 2026-05-12 local Ollama quick smoke remains recorded-only and
failed four deterministic runtime-smoke cases, so it is diagnostic evidence, not
Phase 1 evidence.

### Phase 1: fix the evidence substrate

Goal: one tiny run that is admissible under the Phase 0 profile, not
impressive.

Exit criteria:

- `verify-trace` exits 0 with the shared claim-verifier profile.
- Preflight is `overall: ready`.
- `attestation.json` is signed by `operator-45ck-2026-05`.
- Cross-family review is real, not a stub.
- The run summary says `claim-eligible`.

Do not add new thesis claims until this exists.

### Phase 2: harden remaining runtime safety boundaries

Goal: close runtime-safety gaps that are not required for the first tiny claim
profile but still matter before broader runs.

Work:

- loopback enforcement for local Ollama unless remote model use is explicit and
  traced,
- env custody and redaction,
- child-process leases and cleanup for spawned sessions,
- aider prompt transport off process argv.

### Phase 3: prove PL recovery value

Goal: test PL's best thesis-relevant claim before more hybrid demos.

Run E1 repeated-failure elimination:

- 10 recurring failure patterns from real agent work,
- locked deterministic oracles,
- plain prompt arm,
- prompt-only checklist arm,
- PL gates/retry/recovery arm,
- PL plus wisdom only after the baseline exists.

Success means repeated known failures decline, not just that one model got lucky.

### Phase 4: replay hybrid claims with better controls

Goal: decide whether bounded local routing is worth productizing as a supported
pattern.

Work:

- replay the 10 microtasks with independent/cross-family oracle authoring,
- add randomly sampled small functions only after replay artifacts are valid,
- run HA-HR1 H14 across local-only, frontier-only, advisor-only, and
  hybrid-router arms,
- require matched baselines before cost claims,
- run at least one actual PL runtime route rather than hand-rolled JS routers.

### Phase 5: test project-medium claims

Goal: only after phases 0-3, test whether PL becomes more than a supervision
runtime.

Work:

- E2 single-file vs multi-file flow projects,
- E3 wisdom accumulation and invalidation,
- E5 manager-owned specialist decomposition,
- E4 primary-engineering-surface factory only after the smaller experiments show
  lift.

## Proposed beads

The checked-in no-db source `.beads/issues.jsonl` now includes the May 11 beads
needed by this plan. The normal Windows-installed `bd` shim is still unreliable
from WSL, and `.beads/backup/issues.jsonl` remains a generated backup snapshot,
not the source of truth for this pass. Treat the table below as the
bead creation/update plan until the Linux `bd` command works against the chosen
backend.

| Priority | Bead                                      | Reuse/create                                     | Acceptance criteria                                                                                                                                                                              |
| -------- | ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | Beads source-of-truth and CLI drift       | Create                                           | `bd list` works from this workspace and current May 11 beads are visible from the primary Beads store.                                                                                           |
| P0       | CI drift from May 11 experiment artifacts | Create                                           | `npm run format:check` and `npm run lint` pass without weakening gates; experiment artifacts are formatted or handled by an approved policy.                                                     |
| P0       | Claim verifier profile                    | Create                                           | Smoke/eval/meta claim paths share one strict verifier profile with state, nonce, freshness, pair count, reviewer proof, attestation, signer pin, capability manifest, and unsafe-mode rejection. |
| P0       | Runner capabilities manifest              | Create                                           | Raw shell/env/network/file effects are denied unless a capability profile allows them; missing profiles force `recorded-only`.                                                                   |
| P0       | Unsafe runner gate                        | Create                                           | Dangerous host CLI flags require explicit opt-in and are recorded as non-claim-eligible by default.                                                                                              |
| P0       | Manager-owned worker contract             | Create                                           | Spawn examples/tests require owned paths, allowed commands, artifact schema, timeout, import boundaries, and conflict behavior.                                                                  |
| P0       | Claim-eligible attestation smoke          | Reuse `prompt-language-j0je`                     | One tiny PL run passes the shared claim-verifier profile and is marked `claim-eligible`.                                                                                                         |
| P0       | Trace entry 0 `prevEventHash: null`       | Reuse `prompt-language-3nrj`                     | Entry 0 serializes explicit `null`; verifier strict mode accepts the chain.                                                                                                                      |
| P0       | Final state hash on prompt completion     | Reuse `prompt-language-j1xa`                     | Single-prompt flows emit a final post-effect state hash that matches `session-state.json`.                                                                                                       |
| P0       | `verify-trace --state` path resolution    | Create                                           | Absolute and relative state paths resolve correctly on Windows, WSL, and Linux.                                                                                                                  |
| P0       | Ollama witness-chain decision             | Create                                           | Either build an Ollama shim/equivalent transport witness or explicitly mark Ollama bundles non-claim-eligible without shim evidence.                                                             |
| P1       | Ollama text-generation boundary           | Reuse `prompt-language-5io5` or split child bead | Single-turn text routing is either a separate adapter/mode or documented as unsupported by the action loop.                                                                                      |
| P1       | E1 repeated-failure claim-grade benchmark | Reuse `prompt-language-j64j`                     | 10 failure patterns, locked oracles, baselines, PL recovery arm, signed evidence bundle.                                                                                                         |
| P1       | Microtask cross-family oracle replay      | Create                                           | Re-score the 10-task result with independent adversarial oracles and matched frontier baseline.                                                                                                  |
| P1       | HA-HR1 claim-grade H14                    | Create under `prompt-language-sfd3`              | H14 runs across local-only, frontier-only, advisor-only, hybrid-router arms with schema-valid manifests.                                                                                         |
| P1       | Actual PL runtime code-substitution path  | Create                                           | A microtask or rpncalc-style task completes through PL runtime, not a hand-rolled HTTP router.                                                                                                   |
| P2       | Multi-file flow project fixture pack      | Create                                           | Paired single-file and multi-file PL fixtures exist for the same bounded tasks.                                                                                                                  |
| P2       | Wisdom promotion workflow                 | Create                                           | Lessons cite failure evidence, scope, and invalidation rules; with/without wisdom eval is captured.                                                                                              |
| P2       | Documentation claim-boundary refresh      | This doc + roadmap/status updates                | Roadmap and status distinguish shipped runtime, evidence direction, and unproven thesis.                                                                                                         |

## README decision

Do not change the main README for this pass. It already presents the shipped
product as a verification-first supervision runtime. The right public update is
the roadmap/status layer, because the new work is evidence planning and claim
boundary correction, not a new shipped feature.
