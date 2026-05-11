---
title: Local-model strict-format-fit smoke (2026-05-11, k=3)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM / Ollama AMD-Vulkan path
---

# Local-model strict-format-fit smoke (2026-05-11, k=3)

Ad-hoc local-model evidence, **not a harness-arena route**.
Single-task-battery comparison across three locally available models with
k=3 repeats per (model, task) under deterministic-oracle scoring.

The smoke was originally run at k=1 and produced misleading results.
Re-running at k=3 surfaced two methodologically important findings (see
"Findings" below) that justify the harness-arena's k≥3 promotion
requirement.

## Methodology

- **Endpoint:** `http://localhost:11434/api/generate` (local Ollama)
- **Decoding:** `temperature: 0`, `num_predict: 512`, `stream: false`
  (note: `temperature: 0` does **not** guarantee deterministic output
  on Ollama — see Finding 1)
- **Models:** `qwen3-coder:30b`, `devstral-small-2:24b`,
  `qwen3-opencode:30b`
- **Tasks (n=5):** `isPrime`, `reverseString`, `fibonacci`, `gcd`,
  `classifyStderr`. Each prompt asks for **only** a JS line of the form
  `const fn = ... ;` — no fences, no commentary.
- **Oracle:** `Function('${fnSource}; return fn;')()` then run against
  fixed test cases. Pass = all cases match `Object.is(actual, expected)`.
- **Extractor:** tolerant — strips markdown fences, single-backtick
  wrappers, and stray backticks before evaluating.
- **Repeats:** k=3 per (model, task), 45 generations total.

## Result

### Per-task pass rate (passes / k)

| Model                  | isPrime | reverseString | fibonacci | gcd | classifyStderr | Aggregate |
| ---------------------- | ------- | ------------- | --------- | --- | -------------- | --------- |
| `qwen3-coder:30b`      | **1/3** | 3/3           | 3/3       | 3/3 | 3/3            | **13/15** |
| `devstral-small-2:24b` | **0/3** | 3/3           | 3/3       | 3/3 | 3/3            | **12/15** |
| `qwen3-opencode:30b`   | 0/3     | 3/3           | 0/3       | 0/3 | 0/3            | **3/15**  |

### Generation throughput (median across 15 runs per model)

| Model                  | tok/s | Notes                                                 |
| ---------------------- | ----- | ----------------------------------------------------- |
| `qwen3-coder:30b`      | ~45   | Concise responses (~30-100 tok per task)              |
| `devstral-small-2:24b` | ~18   | Concise (~20-100 tok); slowest per-token              |
| `qwen3-opencode:30b`   | ~42   | Verbose (~400-512 tok); hits ceiling on 4/5 tasks     |

Per-run details in `results.json`. Aggregate counters in `summary.json`.

## Findings

### 1. `temperature: 0` is NOT reproducible on this Ollama setup

`qwen3-coder:30b` produced **three different outputs** for the same
`isPrime` prompt at temperature 0:

- **k=1** (107 tokens — the lucky one):
  ```js
  const fn = (n) => n > 1 && ![2,3,5,7,11,13,17,19,23,29,31].some(p => n % p === 0) || [2,3,5,7,11,13,17,19,23,29,31].includes(n);
  ```
- **k=2** and **k=3** (75 tokens):
  ```js
  const fn = (n) => n > 1 && ![2,3,5,7,11,13,17,19,23,29,31].some(p => n % p === 0) || n < 31 && n > 1;
  ```

Same prompt, same decoding params, same model, same Ollama instance, no
restart — three runs, two distinct outputs. This means single-shot
benchmarks of this model on this rig **systematically overstate
reliability**. The harness-arena promotion gate of k≥3 is the right
defence.

### 2. The k=1 "pass" was test-case-fit, not algorithmic correctness

Even the k=1 winning solution is **not a real isPrime**. It checks `n`
against a hardcoded list of primes up to 31. It only happened to pass
because the test cases (2, 3, 4, 5, 9, 11, 1, 0, -7, 97, 100) all fit
either the hardcoded list or the divisibility shortcut by coincidence.
A test case like `n = 121` (= 11², not in the primes list, not divisible
by any in the list) would falsely return true.

The k=2/k=3 output is similarly a hack — `n < 31 && n > 1` as a fallback
makes `fn(4) === true` (wrong; 4 is not prime), which is exactly what
the oracle catches.

This means: **a passing-oracle k=1 result for a coding task is not the
same as algorithmic correctness on the underlying problem.** The
harness-arena private oracles must be designed with adversarial cases
that defeat hardcoded-fit answers, or the promotion signal will be
inflated.

### 3. `devstral-small-2:24b`'s isPrime bug is stable, not single-shot variance

```js
const fn = (n) => n > 1 && !Array.from({length: n}, (_, i) => i + 1).slice(2).some(i => n % i === 0);
```

The candidate-divisor list `[3, 4, ..., n]` includes `n` itself, so
`fn(3)` checks `3 % 3 === 0` → some=true → `!true` → false. Same
output across all three k repeats — this is a real capability gap on
this task class for this model, not noise.

### 4. `qwen3-opencode:30b` is format-incompatible despite being a coder model

3/15 aggregate, almost entirely format-compliance failure — the model
generates verbose multi-line explanations that exceed `num_predict=512`
without ever emitting the requested `const fn = ...` line. Generation
speed (~42 tok/s) is comparable to qwen3-coder's, so this is purely an
instruction-following / response-shape issue, not a capacity issue.
**Should not be used in any route that requires bounded short-form
responses.** Its current harness-arena usage as a "fallback bounded
implementation worker" for H14 should be reviewed against this
evidence.

### 5. AMD-Vulkan throughput is GPU-memory-bandwidth bound on this rig

Three models of substantially different parameter counts (8B, 24B, 30B)
generate at similar tokens/sec ranges (18-45). The 30B coder runs at
44 t/s with 87%/13% GPU/CPU split (model exceeds 16GB VRAM by a few GB);
8B fits entirely in VRAM and runs at ~45 t/s. Generation latency on
this rig is **not** a meaningful axis for distinguishing 8B vs 30B
candidates — quality and format-following dominate.

## What this is NOT

- Not a harness-arena oracle pass; **not** in the §2a tracker.
- Not k≥10 — k=3 is enough to refute single-shot variance, but not
  enough to publish stable pass-rate numbers.
- Not a frontier comparison. No frontier baseline call was made.
- Not promotable to thesis evidence per program-status.md §3a.
- Not adversarial — the test cases are textbook and a model can pass
  them with a hardcoded hack (Finding 2).

## Implications for the §2a tracker

This smoke does **not** change any §2a tracker entries. It does
strengthen the methodological caveats that already apply:

- **k≥3 is mandatory.** k=1 results overstate winners on this rig
  (Finding 1).
- **Oracles must be adversarial.** Textbook test cases let hardcoded-fit
  hacks pass (Finding 2).
- **Format compliance is a separate axis from capability.**
  qwen3-opencode:30b is rejected by format alone despite generating
  fluent code (Finding 4).

## Reproducing

```bash
cd experiments/local-format-fit-smoke/2026-05-11
REPEATS=3 OUT_DIR=./out node run.mjs qwen3-coder:30b devstral-small-2:24b qwen3-opencode:30b
```

Requires Ollama running locally (or reachable) with the named models
already pulled. Output overwrites `results.json` and `summary.json`
in `OUT_DIR` (default `./results-2026-05-11`).
