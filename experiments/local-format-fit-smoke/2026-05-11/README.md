---
title: Local-model strict-format-fit smoke (2026-05-11)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM / Ollama AMD-Vulkan path
---

# Local-model strict-format-fit smoke (2026-05-11)

Ad-hoc local-model evidence, not a harness-arena route. **Not claim-eligible.**
Captured to give the §2a hybrid-efficiency tracker an independent
single-shot reading on three locally available models against a small
deterministic-oracle task battery, and to surface format-following failure
modes that don't show up in pass-rate alone.

## Methodology

- **Endpoint:** `http://localhost:11434/api/generate` (local Ollama)
- **Decoding:** `temperature: 0`, `num_predict: 512`, `stream: false`
- **Models:** `qwen3-coder:30b`, `devstral-small-2:24b`, `qwen3:8b`
- **Tasks (n=5):** `isPrime`, `reverseString`, `fibonacci`, `gcd`,
  `classifyStderr`. Each prompt asks for **only** a JS line of the form
  `const fn = ... ;` — no fences, no commentary.
- **Oracle:** `Function('${fnSource}; return fn;')()` then run against
  fixed test cases. Pass = all cases match `Object.is(actual, expected)`.
- **Extractor:** tolerant — strips markdown fences, single-backtick
  wrappers, and stray backticks before evaluating.
- **Repeats:** k=1 per (model, task). Single-shot only — not enough to
  separate signal from variance.

## Result

| Model                  | Oracle pass | Gen tok/s | Total wall (5 tasks) | Notes                                                  |
| ---------------------- | ----------- | --------- | -------------------- | ------------------------------------------------------ |
| `qwen3-coder:30b`      | **5/5**     | ~44       | 18.1s                | Strict format, all correct                             |
| `devstral-small-2:24b` | **4/5**     | ~18       | 29.1s                | One real correctness bug on `isPrime`                  |
| `qwen3:8b`             | **1/5**     | ~45       | 57.3s                | Drifts off-format on 4/5; hits `num_predict=512` ceiling |

Per-task results in `results.json`. Aggregate counters in `summary.json`.

## Findings

1. **qwen3-coder:30b** is the only model in this set that reliably
   follows strict format and passes the oracle on every task. Backs the
   harness-arena promotion of this model on H11 / H14 / H15
   PATCH-test-authoring.
2. **devstral-small-2:24b** is genuinely capable on most tasks but has a
   real off-by-one bug on `isPrime`:
   ```
   const fn = (n) => n > 1 && !Array.from({length: n}, (_, i) => i + 1).slice(2).some(i => n % i === 0);
   ```
   The candidate-divisor list `[3, 4, ..., n]` includes `n` itself, so
   `fn(3) === false` (since `3 % 3 === 0`). At k=1 this could be a
   single-shot fluke; harness-arena's k≥3 runs would be needed to call
   it a stable failure mode. Format-following is fine — the earlier
   "parse error" results in the first run were caused by my too-strict
   extractor (markdown / backtick wrappers), not by the model.
3. **qwen3:8b** at this size cannot follow strict-format coding prompts.
   Generation speed is fine (~45 tok/s, equivalent to the 30B), but the
   model produces verbose explanations and hits `num_predict=512` on 4/5
   tasks without ever emitting a `const fn = ...` line. This confirms
   that for instruction-strict bounded coding tasks, 8B-class is below
   the floor on this rig. It does not preclude its use as a classifier
   or summariser with relaxed format requirements.
4. **Generation throughput is GPU-memory-bandwidth bound, not
   parameter-count bound** on this AMD-Vulkan rig. qwen3-coder:30b at
   87%/13% GPU/CPU split runs at ~44 tok/s; qwen3:8b at presumably full
   GPU resident runs at ~45 tok/s. The 24B devstral at ~18 tok/s is the
   outlier — likely a different quantization or layer-mapping. Worth
   investigating before drawing performance conclusions across models.

## What this is not

- Not a harness-arena oracle pass. Not in the §2a tracker.
- Not k≥3 — single-shot at temperature 0; failure modes here may be
  fragile.
- Not a frontier comparison. No frontier baseline call was made.
- Not promotable to thesis evidence. Treat as engineering signal only.

## Reproducing

```bash
cd experiments/local-format-fit-smoke/2026-05-11
node run.mjs                              # default 2 models
node run.mjs qwen3-coder:30b qwen3:8b     # specific list
OLLAMA_ENDPOINT=http://hostname:11434 node run.mjs   # remote
```

Requires Ollama running locally (or reachable) with the named models
already pulled. Output overwrites `results.json` and `summary.json`
in the working directory.
