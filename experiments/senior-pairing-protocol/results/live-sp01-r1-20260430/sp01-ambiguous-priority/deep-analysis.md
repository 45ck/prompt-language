# SP01 Deep Analysis

Run ID: `live-sp01-r1-20260430`

Date: 2026-04-30

Review method: six-agent review using quality, experimental-design, security,
architecture, requirements, and research lenses. Evidence was classified as
observed fact, supported inference, or unsupported claim.

## Bottom Line

This run is useful as an operational pilot. It is not claim-grade evidence that
prompt language beats a direct local-model coding prompt.

What it supports:

- The Aider-backed harness can run the three primary local arms on a fresh
  fixture copy and preserve enough machine-readable evidence for pass/fail.
- `solo-local` and `pl-senior-pairing-local` both produced patches that passed
  local tests and the hidden verifier.
- `persona-only-control` failed without a useful workspace edit in this repeat.
- No arm showed an observed oracle-access violation under the current detector.
- The PL arm produced a broader visible test surface than solo on this fixture.

What it does not support:

- It does not prove PL beats solo. Both solo and PL passed the oracle.
- It does not prove persona prompting is generally weak. This is one repeat,
  one task, one model, one runner, and one arm order.
- It does not prove explicit senior metacognition occurred. The committed
  `senior-frame`, `risk-report`, `test-plan`, `final-self-review`, and
  `scorecard` artifacts are placeholders rather than scored behavior evidence.
- It does not prove strong oracle isolation. The detector checks file mutation
  and Aider history, not all read access.
- It does not prove reproducibility. The run manifests record a dirty repo and
  `model_digest` is `null`.

## Evidence Strength

| Claim                                           | Rating | Why                                                                                            |
| ----------------------------------------------- | -----: | ---------------------------------------------------------------------------------------------- |
| Harness feasibility for primary Aider arms      |   6/10 | The run completed, produced manifests, logs, diffs, tests, verifier outputs, and summary data. |
| Compact PL can solve SP01 with this local model |   5/10 | PL passed once, but only on one fixture and one repeat.                                        |
| Persona-only is insufficient for this setup     |   3/10 | It failed once, but the failure is confounded by timeout/no-edit behavior.                     |
| PL beats solo on SP01                           |   1/10 | Unsupported because both arms passed.                                                          |
| Senior metacognition was demonstrated           |   1/10 | Required structured behavior artifacts are placeholders.                                       |
| Oracle isolation is solved                      |   1/10 | Current logging only proves no observed mutation/history hit.                                  |

## Experimental Validity

The design is directionally sound, but the current run is underpowered. The
minimum interpretable next matrix is three tasks by three primary arms by three
repeats: `27` runs. `k>=3` should mean three independent repeats per task per
arm, not three total executions.

Use counterbalanced arm order:

| Repeat | Order                                                               |
| ------ | ------------------------------------------------------------------- |
| `r01`  | `solo-local` -> `persona-only-control` -> `pl-senior-pairing-local` |
| `r02`  | `persona-only-control` -> `pl-senior-pairing-local` -> `solo-local` |
| `r03`  | `pl-senior-pairing-local` -> `solo-local` -> `persona-only-control` |

The current comparison is best described as structured senior scaffolding versus
simpler PL-gated baselines. It is not a pure PL-versus-no-PL comparison because
the solo and persona controls still run through PL retry/gate machinery.

## Artifact Gaps

Several committed artifacts are not yet sufficient for audit-grade analysis:

- The run was executed before the experiment harness and flow changes were
  committed, so `repo_commit` alone does not reconstruct the executed system.
- `model_digest` is `null`, so the exact local model state is not pinned.
- Raw flow state and workspaces were not committed, while placeholder JSON files
  claim state-derived evidence.
- The persona failure cannot be root-caused from the committed bundle because
  the runner diagnostic points at saved session state that is not present.
- The original human-readable notes had stale `npm test` exits; this memo
  corrects those notes to match `test.json` and `summary.json`.
- Scorecards are placeholders, so no blinded rubric conclusion exists yet.

## Security And Isolation

The primary Aider path is safer than the other runner paths, but the right claim
is "no observed leakage," not "oracle isolation solved."

Current limits:

- The fixture copies `verify.js` into each workspace, so the oracle is inside
  the editable tree.
- Aider filtering is prompt-text dependent and only covers this adapter.
- Non-Aider runners have broad workspace access and are not safe for hidden
  oracle tasks yet.
- The oracle detector scans `.aider.chat.history.md` and compares file hashes;
  it does not prove read access never happened.
- Result artifacts include arm labels, local paths, runner metadata, and dirty
  repo status, so they are not scorer-blind exports.

Next mitigation:

- Keep oracle-isolated experiments on `runner=aider` only until protected files
  are enforced by runtime policy across adapters.
- Move `verify.js` outside the editable workspace or expose it only through a
  sealed verifier command.
- Make Aider scoped-message mode mandatory for protected tasks.
- Add a blinded export path that strips arm labels, local paths, and runner
  metadata before human scoring.

## Full And Hybrid Arms

The full and hybrid arms should remain excluded from evidence runs for now.

Blocking issues:

- `PL_SPAWN_RUNNER` does not affect the headless `run` path used by the
  experiment harness, so the hybrid arm does not yet prove local parent plus
  external child routing.
- Required child-flow timeouts can let the parent advance while a child may
  still be running in-process, which makes full/hybrid scoring unsafe.
- Full/hybrid prompts do not consistently restate protected-file rules or
  explicit source-file scope on every spawned worker.
- The harness does not yet extract real child outputs into the result bundle.

Claim boundary: full and hybrid flows are architecture prototypes, not
claim-grade experiment arms.

## What We Have Learned

Prompt language is useful here as a control system around a local model, not as
"better wording" alone. The mechanisms worth testing are:

- Sequencing: force observe, frame, test, implement, verify, repair.
- Grounding: require file-scoped work and deterministic command evidence.
- Decomposition: split ambiguous senior judgment into explicit artifacts.
- Budgeting: tolerate slower local inference while bounding each turn with
  timeouts.
- Escalation: reserve frontier models for named high-risk decisions later,
  after local artifact capture works.

The strongest current hypothesis is not "PL is smarter." It is: a structured
flow reduces local-model coordination burden and makes senior judgment
observable enough to score.

## Next Run Gate

Before the next evidence run:

- Commit all fixture, flow, harness, and docs changes before running.
- Require clean repo status in manifests, except ignored generated backup files.
- Capture non-placeholder `senior_frame`, `risk_report`, `test_plan`, and
  `final_self_review`.
- Capture a non-null model digest or record why it is unavailable.
- Fix scorer exports so scorecards can be blinded.
- Keep the next evidence run to the three primary Aider arms.
- Run `sp01`, `sp02`, and `sp03` with three repeats each.

Only after those gates pass should we test full local multi-agent or hybrid
local/frontier arms as evidence.
