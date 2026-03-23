# Example: Baseline Comparison

Capture a performance baseline, optimize, then compare before and after to confirm improvement.

## Natural language

```
Run the benchmark and save the result. Then identify and fix the top bottlenecks. Run the benchmark again and compare both numbers. Make sure tests still pass.
```

## DSL equivalent

```
Goal: improve benchmark performance

flow:
  let baseline = run "node bench.js"
  prompt: Identify the top 3 performance bottlenecks in the codebase.
  prompt: Refactor to fix the first bottleneck.
  prompt: Refactor to fix the second bottleneck.
  prompt: Refactor to fix the third bottleneck.
  let result = run "node bench.js"
  prompt: Compare baseline (${baseline}) vs result (${result}). Write a summary of the improvement.

done when:
  tests_pass
```

## What happens

1. `let baseline = run` executes `node bench.js` immediately and stores the stdout — the agent never sees or interprets this step.
2. Three successive `prompt:` steps guide the agent through targeted optimizations one at a time.
3. `let result = run` re-runs the same benchmark after all changes are applied.
4. The final `prompt:` receives both values interpolated into its text, so the agent can compare them directly without having to recall or search for earlier output.
5. The `done when: tests_pass` gate ensures the optimizations did not break correctness.

## Why variables matter here

Without `let baseline`, the agent would need to recall the original benchmark number from memory across multiple turns. With it, the exact stdout is pinned as a string and re-injected at the comparison step — no recall required, no risk of drift.

## Variation: multiple metrics

Capture multiple metrics and compare them all at once:

```
Goal: optimize API response times

flow:
  let p50_before = run "node bench.js --percentile 50"
  let p99_before = run "node bench.js --percentile 99"
  prompt: Optimize the request handler to reduce latency.
  let p50_after = run "node bench.js --percentile 50"
  let p99_after = run "node bench.js --percentile 99"
  prompt: Write a performance report. Before: p50=${p50_before}, p99=${p99_before}. After: p50=${p50_after}, p99=${p99_after}.

done when:
  tests_pass
```

See [DSL reference — let/var](../dsl-reference.md#letvar) for variable interpolation syntax.
