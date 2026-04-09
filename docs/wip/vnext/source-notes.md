# Source notes

This spec pack is grounded in the following repo docs and current official agentic-coding guidance.

## prompt-language repo docs used

- `README.md`
- `docs/guides/guide.md`
- `docs/evaluation/eval-analysis.md`
- `docs/strategy/thesis.md`
- `docs/strategy/thesis-roadmap.md`
- `docs/roadmap.md`
- `docs/reference/let-var.md`
- `docs/reference/review.md`
- `docs/reference/approve.md`
- `docs/evaluation/eval-parity-matrix.md`
- `docs/wip/tooling/evals-and-judges.md`
- `docs/wip/runtime/workspace.md`
- `docs/design/hooks-architecture.md`

## Main repo-derived conclusions used

1. Current shipped value is real, especially around gates, state, orchestration, and project composition.
2. The repo’s own evals say the strongest proven value is structural gate enforcement.
3. Broader claims such as prompt-language as the primary engineering surface remain hypotheses.
4. Several current runtime behaviors are permissive/fail-open enough that stricter trust semantics are warranted.
5. The roadmap underweights trust/contracts/effects/replay relative to their likely autonomy impact.

## Current official guidance used

- Anthropic Claude Code docs and product pages for subagents, auto mode / permission fatigue reduction, and the broader framing of agentic coding.
- OpenAI developer docs for current Codex positioning and current model/runtime surfaces.

## Interpretation rule

Where the repo already has explicit evidence, this pack follows the repo’s evidence over speculative claims.
Where the repo has WIP or roadmap items, this pack treats them as proposals rather than shipped truth.
