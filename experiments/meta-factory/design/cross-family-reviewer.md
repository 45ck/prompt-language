# Cross-Family Reviewer — Design

## Purpose

META-5 operator sign-off #3 requires that the model family producing code (factoryFamily) differs from the model family reviewing it (reviewerFamily). This prevents self-confirming bias where a model judges its own output favorably.

## Family Definitions

| Family        | Models                                         |
| ------------- | ---------------------------------------------- |
| `anthropic`   | Claude Opus 4, Claude Sonnet 4, Claude Haiku 4 |
| `openai`      | GPT-4.1, GPT-4o, o3, o4-mini, Codex            |
| `google`      | Gemini 2.5 Pro, Gemini 2.5 Flash               |
| `open-weight` | Qwen3, DeepSeek V3, Llama 4, Mistral           |

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

1. `run-meta-experiment.mjs` records `factoryFamily` in the run manifest
2. `cross-family-review.mjs` reads the manifest and rejects if `reviewerFamily === factoryFamily`
3. The review result is stored in `bundle/cross-family-review.json`
4. `verify-trace.mjs` can optionally check for the review file's presence via `--require-cross-review`

## Invocation

```bash
node scripts/experiments/meta/cross-family-review.mjs \
  --bundle <bundle-dir> \
  --reviewer-family openai \
  --reviewer-model gpt-4.1 \
  [--reviewer-bin codex]
```

## Integration with Meta-Experiment

New stage in `run-meta-experiment.mjs` between the claude run and verify-trace:

```
runLive() → ... → cross-family-review → verify-trace → report
```

The review is advisory in v1 (does not gate the report) but recorded. V2 makes it mandatory for claim-eligibility.

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
