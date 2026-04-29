# SP01 Live Pilot R1 Analysis

Run ID: `live-sp01-r1-20260430`

Runner: `aider`

Model: `ollama_chat/qwen3-opencode-big:30b`

## Result

| Arm                       | Runner exit | `npm test` | `node verify.js` | Oracle access violation | Outcome |
| ------------------------- | ----------: | ---------: | ---------------: | ----------------------- | ------- |
| `solo-local`              |           0 |          0 |                0 | No                      | Pass    |
| `persona-only-control`    |           3 |          0 |                1 | No                      | Fail    |
| `pl-senior-pairing-local` |           0 |          0 |                0 | No                      | Pass    |

## Interpretation

This is a pilot run, not claim-grade evidence. It is `k=1` on one JavaScript
maintenance fixture. It proves the harness can execute the primary local-model
arms, preserve fresh workspaces, capture deterministic artifacts, and avoid
observed `verify.js` contamination on the Aider path.

The useful signal is that compact PL senior pairing passed the oracle without
oracle access violation, while persona-only timed out/fell through without
editing the workspace. Solo also passed, so this run does not prove PL beats a
direct local prompt on SP01. It does show persona theater was not sufficient in
this sample.

## Operational Notes

- `nvidia-smi` was unavailable, so GPU use is recorded from `ollama ps` rather
  than NVIDIA telemetry. After the run, Ollama reported
  `qwen3-opencode-big:30b` loaded with `15%/85% CPU/GPU`.
- Hybrid and full-feature arms were not run as evidence because review agents
  identified unresolved child-runner routing and spawned-child timeout risks.
- The harness initially recorded `npm test` incorrectly on Windows; test
  artifacts and manifests in this bundle were corrected after fixing the
  harness command invocation.
