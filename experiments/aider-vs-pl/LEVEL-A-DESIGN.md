# Level A self-hosting harness — design rationale

Date: 2026-04-20
Artefact: `experiments/aider-vs-pl/rescue-viability/flows/level-a-harness.flow`
Theory reference: `SELF-HOSTING-THEORY.md` §4 Level A — "PL automates the existing research loop (no code mutation)."

## 1. Summary

The harness is a PL flow whose *subject* is results artefacts. Given `(experiment, model, fixture_dir, subject_flow, arms)` it fires one sweep that, per arm, provisions a fresh run dir, copies the fixture in, invokes either the solo aider runner or the supplied subject flow, grades via the fixture oracle, and appends one markdown row to `results/<experiment>/<arm>.md`. No mutation of `src/`, `dist/`, fixtures, or the subject flow.

This replaces ~6 manual shell steps per arm, previously performed by hand per the `RESCUE-VIABILITY-PLAN` §4 protocol and the existing `solo-arm.sh`.

## 2. What the harness replaces (manual → automated)

Previous procedure for a single R1 arm (from `LIVE-NOTES.md` + `solo-arm.sh`):

1. `mkdir` run dir, `rm -rf` if re-running.
2. `cp` fixture files into run dir.
3. `cd` in, optionally `git init` (new — triggered by LIVE-NOTES aider-P1 Layer 2).
4. Invoke subject: either raw `aider --model ... --message ... csv2json.js`, or `prompt-language ci r1-pl-full.flow --runner aider`.
5. Run `verify.cjs`, eyeball pass count.
6. Open the audit log, grep `retry_invoke` to count retries.
7. Write a markdown file with the tuple.
8. Decide the arm passed / failed / was invalidated (LIVE-NOTES Run A).

Arms currently in scope for R1: `qwen3-8b-solo`, `qwen3-8b-pl-full`. R2 adds `qwen3-8b-pl-lite`, `qwen3-8b-pl-medium`. The harness parametrises on arm label and kind (`solo`/`pl`) so every R1–R5 arm in the plan is a single token in `arms`.

## 3. Parametrisation surface — decision

Three candidates were considered:

| surface | pro | con |
|---|---|---|
| CLI flags (`--experiment r1 --model ...`) | explicit, tracked in shell history | requires CLI-side argument wiring, awkward for list-typed params like `arms` |
| env vars (`$ARMS`, `$MODEL`) | cheap, no flow edits | invisible in audit log, easy to forget, leaks between sweeps |
| flow-level `let` with `${var:-default}` interpolation | visible in the flow text, dumped into audit as-is, overridable via `--var` | user needs to know the var names |

**Chosen: flow-level `let` with default values.** Every parameter appears as `let x = "${x:-default}"` at the top of the flow. The effect is:

- Zero-config invocation uses defaults (runs R1 against E-SMALL).
- `node bin/cli.mjs run level-a-harness.flow --var experiment=r2 --var arms="..."` overrides any subset.
- The audit log captures the resolved values, so the sweep is self-describing.

Env vars are deliberately NOT consulted by the flow. Ambient env is harder to reproduce than an explicit `--var`.

## 4. Arm encoding — `<label>:<kind>`

Each arm is a single whitespace-delimited token containing label and kind glued with `:`:

```
qwen3-8b-solo:solo qwen3-8b-pl-full:pl
```

Why single token:
- `foreach` splits on whitespace by default. A list-of-pairs structure would require nested foreach or a separate arms-list file.
- `:` is chosen over `|` because `|` is the let-expression pipe-transform sigil.

Kinds are deliberately only two: `solo` (raw aider call, no retry, no gate — matches `solo-arm.sh`) and `pl` (delegate to the supplied subject flow). Adding a third kind like `pl-lite` is a matter of supplying a different `subject_flow`, not a new kind.

## 5. Edge cases

### 5.1 Silent ollama TCP drop (LIVE-NOTES aider P1 Layer 1)

Symptom: `APIConnectionError … wsarecv: An existing connection was forcibly closed by the remote host.` The subject's own retry loop may paper over this and eventually hit its retry cap, producing a row that *looks* like a model-capability failure but is actually an infra drop.

Mitigation: after oracle grading, the harness greps every `.log` and the subject `audit.jsonl` for the fingerprint set `{APIConnectionError, forcibly closed, ECONNRESET, wsarecv}`. If any hit, `run_status` is marked `suspect-ollama-drop` instead of `clean`. The row still writes; downstream analysis can filter.

Limitation: the harness does not *prevent* double-booking ollama — R5 (spawn/race) arms may still collide with in-flight opencode runs. The fix for that is operational (kill opencode before the sweep), not flow-level.

### 5.2 Double-counting retries

The harness itself is a PL flow and therefore writes its own `audit.jsonl` to `.prompt-language/audit.jsonl` relative to its cwd. Every `run:` inside the foreach generates harness-level audit events.

If the harness grepped `retry_invoke` from its own audit log, it would double-count: the subject flow's retries *plus* any retries the harness itself did. (The harness has no retry blocks today, but future edits could add one.)

Discipline: the harness greps **only** `${run_dir}/.prompt-language/audit.jsonl` — i.e. the subject flow's audit log, inside the per-arm run dir. For `solo` arms, retries are 0 by construction (aider runs once, no PL retry loop).

### 5.3 Fixture ESM/CJS trap (LIVE-NOTES Run A invalidation)

Solved at the fixture level: `verify.cjs` has `.cjs` extension so Node picks CommonJS regardless of the parent package type. The harness does not need to intervene. If a future fixture reintroduces the trap, it will manifest as `fail_count=0, pass_count=0, total=0` rather than a cryptic crash — the `suspect-ollama-drop` check does not cover this, but a `total == 0` post-condition could be added.

### 5.4 Aider parent-git-repo quirk (LIVE-NOTES aider P1 Layer 2)

Aider resolves edits relative to the nearest parent `.git` even with `--no-git`. The harness mitigates by running `git init` + commit inside the run dir before invocation. This creates a repo boundary aider respects.

### 5.5 Per-run clock skew / identical timestamps

Two arms in the same sweep start within ~seconds. The run dir is stamped `<ts-of-arm>`, not `<ts-of-sweep>`, so two arms with different labels cannot collide. Two sweeps of the same arm within one second would collide; mitigation is to rely on clock monotonicity at second resolution (matches `solo-arm.sh` convention) and accept the tradeoff.

### 5.6 Oracle runs twice on PL arms

The subject flow's `done when: gate verify_passes: node verify.cjs` already runs the oracle. The harness re-runs it independently. This is deliberate: the harness does not want to trust the subject's self-report. Cost is one extra oracle invocation per arm (~seconds for `verify.cjs`).

## 6. Quality-attribute scoring

| attribute | score | note |
|---|---|---|
| determinism | medium-high | Same inputs → same run-dir layout and markdown schema. Model stochasticity still dominates row content; that's a property of the subject, not the harness. |
| observability | high | Every shell action is a `run:` → audit event. `aider.log`, `pl.log`, `oracle.log` persisted per run dir. |
| reproducibility | medium | `subject.flow` is copied into the run dir so later replay does not depend on HEAD. Fixture is snapshotted. Model weights are not snapshotted (out of scope). |
| blast radius | minimal | Only writes under `runs/<exp>/` and `results/<exp>/`. Never edits src/dist/fixtures/subject flow. |
| composability | medium | A different experiment is `--var experiment=r2 --var subject_flow=...`. R4 (runner-sensitivity) needs a new kind `opencode` — small change. |

## 7. What Level A deliberately does not do

- Does not update `SCORECARD.md`. That is a cross-experiment summary; aggregating across per-arm rows is a separate step and a different subject class.
- Does not enforce N≥3 repeats-per-arm (`RESCUE-VIABILITY-PLAN` §4 variance note). The caller can loop the harness externally. Baking it in would conflate "one sweep" with "one measurement campaign."
- Does not auto-detect which runner the subject flow was authored against. Caller must pass the right `subject_flow`.

## 8. Open questions

1. Should `total == 0` trigger an `oracle-malformed` status alongside `suspect-ollama-drop`? Likely yes; trivial to add.
2. Should the harness copy the *current* `SCORECARD.md` into the run dir for provenance? Cheap; not done yet.
3. Level B's flow will want to `git init` a per-run worktree (meta-factory MD-2). Level A's `git init` is a degenerate form. Worth extracting a shared helper flow at that point.

## 9. Validation

```
$ node bin/cli.mjs validate experiments/aider-vs-pl/rescue-viability/flows/level-a-harness.flow --runner aider
[prompt-language validate] Flow parsed successfully.
Complexity: 4/5
Lint warnings: 2
```

Two remaining lint warnings are benign shadowing of `retry_count` and `run_status` inside `if` branches (outer `let` sets the default, inner branch overrides). The parser accepts the construct; the warning flags a readability concern. Leaving as-is because the alternative (separate variables per branch) is noisier.

## 10. Handoff

Next skill: `adr-writer` for the explicit decision record "Level A harness parametrises via flow-level `let` with `--var` overrides rather than CLI flags or env vars." After that, implementation-oriented work is limited to running the flow — there is no code to write.
