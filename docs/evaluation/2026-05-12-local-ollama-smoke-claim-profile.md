---
title: Local Ollama smoke with claim-profile classification
status: recorded-only evidence; not claim-eligible
operator: 45ck
date: 2026-05-12
---

# Local Ollama smoke with claim-profile classification

<!-- cspell:ignore qwen Ollama -->

This note records the first local-model smoke run after runner capability
classification was wired into smoke artifacts. It is a measurement receipt, not a
claim-grade bundle.

## Command

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 \
PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=8 \
PROMPT_LANGUAGE_OLLAMA_NUM_CTX=4096 \
EVAL_MODEL=ollama/qwen3-coder:30b \
npm run eval:smoke:ollama:quick
```

## Result

- Harness: `prompt-language ci --runner ollama`
- Model: `ollama/qwen3-coder:30b`
- Ollama version: `0.20.5`
- Quick smoke: `35/39` passed
- Provider telemetry: `25` Ollama records, `7,266` input tokens, `1,452`
  output tokens, zero API cost basis
- Generated local artifacts:
  `scripts/eval/results/smoke-2026-05-11T21-37-23-790Z.json` and
  `scripts/eval/results/smoke-2026-05-11T21-37-23-790Z-runner-capabilities.json`

Failing quick-smoke cases:

| ID  | Case                          | Observed failure                  |
| --- | ----------------------------- | --------------------------------- |
| AK  | Grounded-by while loop        | counter stayed at `count=0`       |
| Z2  | Nonce propagation across runs | nonce and output files were empty |
| Z4  | Interleaved state probe       | probe and counter were empty      |
| AV  | `foreach item in run "cmd"`   | expected files were not written   |

## Claim Profile

The smoke run is explicitly **recorded-only**.

Reported blockers:

- `runner-recorded-only-posture`
- `runner-shell-unbounded`
- `runner-external-process-missing`
- `runner-transport-witness-missing`

This is the correct classification for the current local Ollama path. The
runner is an in-process action loop with model-directed command execution and no
independent transport witness. The result supports local runtime diagnostics,
not a claim that local Ollama satisfies the strict verifier profile.

## Interpretation

The run shows that `qwen3-coder:30b` can execute most quick action-protocol smoke
cases under PL supervision on this machine. It does not show full smoke
readiness, claim-eligible provenance, cost superiority, or local-model
substitution.

The next engineering work is therefore:

1. triage the deterministic smoke failures above;
2. keep local Ollama smoke artifacts marked recorded-only until transport
   witness, command allowlist, and process-lease evidence exist;
3. produce a tiny attested blocker bundle before attempting a claim-eligible
   bundle.
