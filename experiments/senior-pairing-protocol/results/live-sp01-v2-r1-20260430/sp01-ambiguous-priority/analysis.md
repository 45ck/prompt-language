# SP01 V2 Live R1 Analysis

Run ID: `live-sp01-v2-r1-20260430`

Runner: `aider`

Model: `ollama_chat/qwen3-opencode-big:30b`

## Result

| Arm                          | Runner exit | `npm test` | `node verify.js` | Oracle access violation | Outcome |
| ---------------------------- | ----------: | ---------: | ---------------: | ----------------------- | ------- |
| `pl-senior-pairing-v2-local` |           0 |          0 |                0 | No                      | Pass    |

## Comparison To Earlier SP01 Pilot

The earlier `live-sp01-r1-20260430` pilot had:

- `solo-local`: pass, `5/5` local tests.
- `persona-only-control`: fail, no useful workspace edit.
- `pl-senior-pairing-local`: pass, `6/6` local tests.

This v2 run passed with `7/7` local tests and `7/7` verifier assertions. It
added a broader visible test surface than compact PL by covering:

- input order over `createdAt`;
- empty strings not overriding useful values;
- multiple duplicate email groups.

This is a stronger artifact than the persona arm and a richer test artifact than
the compact PL pilot, but it is still `k=1`. It does not prove v2 is better than
compact PL or solo.

## What V2 Tested

V2 expanded the compact senior-pairing flow with:

- a risk register;
- a ranked decision policy;
- a pre-implementation test assessment;
- final self-review after deterministic verifier evidence;
- harness-level checks instead of in-flow completion gates, so final artifacts
  can be captured after verifier execution.

The useful mechanism signal is that v2 produced explicit decision evidence and
a passing implementation, while preserving a clean repo-status manifest.

## Artifact Integrity

Improvements over the first SP01 pilot:

- `repo_status_short` is clean.
- `.prompt-language/session-state.json` is preserved under `flow-state/` as the
  audit trail for captured variables and warnings.
- Most structured artifacts are extracted from flow state rather than written as
  placeholders.

Remaining gaps:

- `model_digest` is still `null`.
- `senior_frame` capture failed after three attempts and fell back to an empty
  string.
- `change_review` capture failed after three attempts and fell back to an empty
  string.
- `pre_impl_test_assessment` correctly said the red-test evidence was not ready,
  but the flow still proceeded to implementation. That is a v2 flow-design gap.

## Interpretation

V2 is promising but too heavy in its current form. It improved observable
decision artifacts and produced a broader passing test suite, but it also
increased runtime to about 29 minutes and introduced JSON-capture fragility.

The next v2 hypothesis should be narrower:

> The decision-policy and risk-register steps are valuable; the senior-frame and
> change-review prompts need stricter retry or simpler schemas before v2 can be
> treated as a stable evidence arm.

## Next Actions

1. Simplify `senior_frame` and `change_review` schemas or split them into
   smaller captures.
2. Add a hard gate that blocks implementation when
   `pre_impl_test_assessment.implementation_ready` is false.
3. Keep v2 exploratory until it can capture all required artifacts reliably.
4. Build SP02 and SP03 fixtures before running any broader v2 comparison.
