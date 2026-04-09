# Example: Race Between Repair Strategies

Use `race` when you want two code-generation strategies to compete and keep the first successful result.

## Natural language

```
Try two ways to repair a failing implementation at the same time. One path should make the smallest possible patch. The other should do a cleaner, more structural rewrite. Keep the first approach that gets the tests passing, then verify the winner.
```

## DSL equivalent

```
Goal: repair a failing implementation with competing strategies

flow:
  race
    spawn "minimal-patch"
      prompt: Fix the failure with the smallest safe code change. Preserve the current structure if possible.
      run: npm test -- --runInBand
    end
    spawn "structural-rewrite"
      prompt: Fix the failure by simplifying or restructuring the implementation if that produces a more reliable repair.
      run: npm test -- --runInBand
    end
  end

  prompt: Review the winning approach in ${race_winner}. Confirm the fix is correct, note any tradeoffs, and clean up if needed.
  run: npm test

done when:
  tests_pass
```

## What happens

1. The `race` block starts both children immediately, so the minimal patch and structural rewrite are attempted in parallel.
2. Each child runs with its own prompt, workspace state, and test command.
3. The first child to finish successfully becomes the winner, and its name is stored in `race_winner`.
4. After the race, the parent continues with the winning result available for follow-up work and verification.
5. The losing child is not cancelled; it may still finish later, but it does not control the main flow.
6. The final `run: npm test` and `done when: tests_pass` check that the selected repair really leaves the project green.

## Why it helps

- It turns strategy selection into execution instead of debate: patch-first and rewrite-first can both be tried.
- It reduces time spent waiting on the wrong repair path when one approach is clearly faster.
- It works well when you know multiple valid fixes exist but do not know which one will converge first.

For full syntax and semantics, see [race](../reference/race.md).
