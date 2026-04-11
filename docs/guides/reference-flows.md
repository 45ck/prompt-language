# Reference Flows

This page collects a few reusable flow shapes you can build from the shipped runtime. These are **reference patterns**, not new DSL keywords or product promises.

For exact syntax and semantics, use the [Language Reference](../reference/index.md). For worked runnable snippets, use [Examples](../examples/index.md). If a capability appears only in the [Roadmap](../roadmap.md) or [WIP Features](../wip/index.md), treat it as tracked or exploratory, not available as a dedicated surface today.

## Surface boundary

| Surface                 | What it means here                                                                                                                                                   | Where to look                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Shipped                 | You can express the pattern today with documented primitives such as `prompt`, `run`, `review`, `spawn`, `await`, `send` / `receive`, and gates.                     | [Language Reference](../reference/index.md), [Use Cases](use-cases.md) |
| Experimental or tracked | The repo may be exploring better ergonomics, broader eval flows, or richer orchestration surfaces, but they are not the contract unless they land in reference docs. | [Roadmap](../roadmap.md), [WIP Features](../wip/index.md)              |
| Research                | Positioning, evidence, and design rationale that inform direction without creating a delivery guarantee.                                                             | [Strategy](../strategy/index.md), [Research](../research/README.md)    |

The shipped orchestration model is still parent-authored and bounded. Think "explicit child sessions and explicit joins," not autonomous agent teams with hidden task claiming or peer negotiation.

## How to read these patterns

- Treat role names such as "builder", "critic", "reviewer", and "judge" as documentation labels.
- Keep the parent flow in control of decomposition, joins, and completion gates.
- Prefer the simplest shape that solves the problem. As [Use Cases](use-cases.md) notes, prompt-language tends to win on verification, not on adding orchestration for its own sake.

## Builder / critic

Use this when one pass should create a draft and a second pass should apply bounded critique before the parent decides what to keep.

```yaml
flow:
  spawn "builder"
    let draft = prompt "Draft the migration plan."
  end

  await "builder"

  spawn "critic" with vars builder_draft
    let notes = prompt "Critique this draft. Focus on risks, missing checks, and weak assumptions: ${builder_draft}"
  end

  await "critic"

  prompt: Revise the plan using ${builder_draft} and ${critic_notes}.

done when:
  diff_nonempty
```

Why this is a reference flow:

- `builder` and `critic` are just spawn names.
- The behavior comes from shipped `spawn`, `await`, variable import, and gates.
- There is no separate `builder`, `critic`, or "dual-agent" syntax.

## Implementor / reviewer

Use this when one pass should make the change and a second pass should inspect it for bugs, missing tests, or scope drift.

```yaml
flow:
  spawn "implementor"
    prompt: Implement the parser fix and run the focused tests.
    let summary = prompt "Summarize the code changes and any remaining uncertainty."
  end

  await "implementor"

  spawn "reviewer" model "haiku" with vars implementor_summary
    let findings = prompt "Review this implementation summary for likely bugs, missing tests, or risky assumptions: ${implementor_summary}"
  end

  await "reviewer"

  prompt: Address the highest-value reviewer findings before finishing.

done when:
  tests_pass
  lint_pass
```

Notes:

- This is still a parent-controlled flow. The reviewer does not autonomously claim follow-up work.
- In many cases, a shipped [`review`](../reference/review.md) block is a cheaper fit than a separate reviewer child.
- Keep the verification gate in the parent so the flow ends on observable checks, not on role self-report.

## Generator / evaluator debate

Use this when you want an explicit iterative debate between two child roles and the parent must stay in charge of rounds, joins, and the stop condition.

```yaml
flow:
  let brief = "Draft the migration announcement."
  let critique = ""
  let approved = "false"

  foreach round in [1, 2, 3]
    if approved == "true"
      break
    end

    spawn "generator" with vars brief critique round
      let draft = prompt "Write round ${round}. Revise against this critique if present: ${critique}"
    end

    await "generator"

    spawn "evaluator" with vars brief generator.draft
      let critique = prompt "Critique this draft against the brief. Start with APPROVED if it passes: ${generator.draft}"
    end

    await "evaluator"

    let critique = "${evaluator.critique}"
    if evaluator.critique contains "APPROVED"
      let approved = "true"
    end
  end
```

Why this is a reference flow:

- The debate is assembled from shipped `spawn`, `await`, variable import, `foreach`, and `if`.
- Parent variables are snapshotted into each child via `with vars ...`.
- Child outputs come back through the normal `{child}.{var}` import path after `await`.
- The parent, not the children, decides whether to continue, stop, or publish the final result.

Use this pattern when the orchestration itself matters. If you only need a bounded revision loop, the worked [Generator / Evaluator Debate](../examples/generator-evaluator-debate.md) example and the simpler [Review Loop](../examples/review-loop.md) example show when explicit child orchestration is worth the extra ceremony.

## Judge / worker

Use this when the worker should iterate until a shipped judge-backed review surface returns a passing verdict.

```yaml
rubric "impl_quality"
  criterion correctness type boolean
  criterion test_coverage type boolean
end

judge "impl_judge"
  kind: model
  rubric: "impl_quality"
  inputs: [diff, test_output, output]
end

flow:
  review strict using judge "impl_judge" max 3
    prompt: Implement the export command.
    run: npm test -- export
  end

done when:
  tests_pass
```

Boundary note:

- This is a shipped v1 pattern because named judges are documented in [Evals and Judges V1](../reference/evals-and-judges-v1.md).
- It does **not** imply a broader future `judge` control-flow family such as `if judge ...`, `while judge ...`, or free-standing judge routing.
- The judge is currently a review-time evaluation surface, not a general multi-agent coordinator.

## Choosing the right level of structure

Start with the smallest thing that gives you a real check:

- If you only need enforcement, use a direct prompt plus gates.
- If you need one bounded second opinion, add a reviewer or critic shape.
- If you need repeated critique with a fail-closed stop condition, use shipped `review strict` and, where appropriate, the shipped v1 judge surface.

If you find yourself wanting hidden delegation, open-ended peer chat, task claiming, or always-on team semantics, you have moved out of the shipped guide surface and into tracked or research territory.
