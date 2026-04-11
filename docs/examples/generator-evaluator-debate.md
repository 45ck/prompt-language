# Example: Generator / Evaluator Debate

Use this pattern when you want an explicit parent-controlled revision loop instead of the shipped `review` block. The parent spawns a generator child and an evaluator child, waits for both, then decides whether to stop or launch another round.

This is useful when you want the debate structure to stay visible in the flow:

- the generator should receive a snapshot of the current brief and any prior critique
- the evaluator should critique the generator's latest output, not free-form speculate
- the parent should cap the number of rounds and own the stop condition

## Natural language

```
Draft a migration announcement. Have one child write the draft and another child critique it for unsupported claims, missing rollout details, and unclear operator steps. Feed the critique back into the next drafting round. Stop when the evaluator says the draft is acceptable or after a small number of rounds.
```

## DSL equivalent

```yaml
Goal: write a migration announcement through explicit generator-evaluator debate

flow:
  let brief = "Announce the v2 migration, explain operator impact, and include rollback guidance."
  let critique = ""
  let approved = "false"
  let draft = ""

  foreach round in [1, 2, 3]
    if approved == "true"
      break
    end

    spawn "generator" with vars brief critique round
      prompt: Draft the migration announcement for round ${round}. Use the brief exactly as written. If critique is present, revise to address it without inventing facts: ${brief}
      let draft = prompt "Return only the revised announcement text. Prior critique: ${critique}"
    end

    await "generator"

    spawn "evaluator" with vars brief generator.draft round
      prompt: Review this migration announcement against the brief. Call out unsupported claims, missing operator steps, rollout ambiguity, and rollback gaps: ${generator.draft}
      let critique = prompt "Return concise revision notes. If the announcement is acceptable, start with APPROVED. Brief: ${brief}"
    end

    await "evaluator"

    let draft = "${generator.draft}"
    let critique = "${evaluator.critique}"

    if evaluator.critique contains "APPROVED"
      let approved = "true"
    end
  end

  prompt: Publish the final migration announcement using ${draft}. Preserve all factual constraints from ${brief}.
```

## What happens

1. The parent initializes shared state: the brief, the current critique, the approved flag, and the latest draft.
2. Each loop round spawns a `generator` child with a variable snapshot from the parent. That child sees the current brief, the prior critique, and the round number.
3. `await "generator"` blocks until the draft is available. After the child exits, the parent can read `generator.draft`.
4. The parent then spawns an `evaluator` child with the brief and the generator's latest draft.
5. `await "evaluator"` imports the evaluator output back into parent scope as `evaluator.critique`.
6. The parent copies child outputs into its own rolling `draft` and `critique` variables so the next round uses the latest state.
7. If the evaluator marks the draft as approved, the parent flips `approved` and breaks out on the next loop check.
8. The final parent prompt decides what to emit. The children never decide completion on their own.
9. This example intentionally omits `done when:` gates because it demonstrates orchestration for content generation, not a code-change workflow with external verification commands.

## Why use explicit spawn/await here

The shipped [`review`](review-loop.md) example is the better fit when you just need a bounded revision loop. Use explicit `spawn`/`await` when you need to show or control the orchestration itself:

- different child instructions for drafting vs critique
- explicit variable handoff between rounds
- separate child summaries you may want to inspect later
- room to swap models, constraints, or tooling per role

The tradeoff is more ceremony. You are taking responsibility for parent-owned state and joins instead of using the simpler review surface.

## Variation: generator and evaluator in parallel after shared setup

You can also front-load evidence collection before the debate starts:

```yaml
flow:
  spawn "diff"
    let diff = run "git diff -- docs src"
  end
  spawn "tests"
    let failing_tests = run "npm test -- --runInBand"
  end

  await all

  let brief = "Update the repair plan using current diff and failing tests."
  let evidence = "${diff.diff}\n\n${tests.failing_tests}"

  spawn "generator" with vars brief evidence
    let draft = prompt "Write a repair plan grounded in this evidence: ${evidence}"
  end

  await "generator"

  spawn "evaluator" with vars brief evidence generator.draft
    let critique = prompt "Critique this repair plan against the evidence: ${generator.draft}\n\n${evidence}"
  end

  await "evaluator"
```

This keeps the same generator/evaluator structure but shows how `spawn`/`await` can also gather evidence in parallel before the debate loop begins.
