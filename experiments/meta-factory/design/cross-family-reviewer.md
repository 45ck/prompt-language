# Cross-Family Reviewer — Design

## Purpose

META-5 operator sign-off #3 requires that the model family producing code (factoryFamily) differs from the model family reviewing it (reviewerFamily). This prevents self-confirming bias where a model judges its own output favorably.

## Family Definitions

| Family       | Models                                         |
| ------------ | ---------------------------------------------- |
| `anthropic`  | Claude Opus 4, Claude Sonnet 4, Claude Haiku 4 |
| `openai`     | GPT-4.1, GPT-4o, o3, o4-mini, Codex            |
| `google`     | Gemini 2.5 Pro, Gemini 2.5 Flash               |
| `meta-llama` | Llama-family models                            |
| `qwen`       | Qwen-family models                             |
| `deepseek`   | DeepSeek-family models                         |
| `mistral`    | Mistral-family models                          |
| `gemma`      | Gemma-family models                            |
| `xai`        | Grok-family models                             |
| `unknown`    | Unclassified / unsupported family              |

Family is determined by the model's training organization, not the API provider. A model served through a proxy (e.g., Qwen3 via OpenRouter) retains its original family.

## Review Protocol

The cross-family reviewer checks:

1. **Code quality**: Does the output compile, pass linter, pass tests?
2. **Spec conformance**: Does it implement what the flow specified?
3. **Security**: No obvious vulnerabilities introduced?
4. **Completeness**: All files mentioned in the flow are present?

The reviewer receives:

- The workspace directory (read-only)
- The flow file that was executed
- The trace/provenance files
- A structured review prompt

The reviewer does NOT receive:

- Knowledge of which family produced the code
- The factory's conversation history
- Any hint about the expected outcome

## Enforcement

The harness enforces family separation:

1. `bootstrap-envelope.mjs` checks the declared factory/reviewer families before a
   live run starts.
2. A `blocked` preflight refuses the live run. The distinct-family rule is therefore
   enforced before execution, not only after artifacts exist.
3. A `degraded` preflight may still run, but the result is recorded-only and not
   claim-eligible.
4. `cross-family-review.mjs` rejects missing, unknown, same-family, or internally
   inconsistent family declarations and writes the review result to
   `bundle/cross-family-review.json`.
5. `verify-trace.mjs` can require reviewer-family evidence with
   `--expected-reviewer-family`.

## Invocation

```bash
node scripts/experiments/meta/cross-family-review.mjs \
  --bundle <bundle-dir> \
  --reviewer-family openai \
  --reviewer-model gpt-4.1 \
  [--reviewer-bin codex]
```

## Integration with Meta-Experiment

Cross-family review evidence sits between the authoring run and trace verification:

```
runLive() → ... → cross-family-review → verify-trace → report
```

The enforced operator-facing rule is:

- `blocked` bootstrap-envelope preflight: refuse the live run.
- `degraded` bootstrap-envelope preflight: allow the run, but mark it non-claim-eligible.
- claim-eligible runs require a `ready` preflight plus successful downstream review
  and verification artifacts.

## Verdict Format

```json
{
  "reviewerFamily": "openai",
  "reviewerModel": "gpt-4.1",
  "factoryFamily": "anthropic",
  "verdict": "approve" | "veto",
  "reasons": ["..."],
  "timestamp": "...",
  "reviewDurationSec": 42
}
```
