# Example: Self-Reflection on Failure

Force the agent to analyze what went wrong before retrying. This is the Reflexion pattern — verbal self-reflection improves retry success rates by preventing repeated mistakes.

## Natural language

```
Run the tests. If they fail, stop and think about what went wrong before fixing anything. What was the root cause? What have you already tried? What should you try differently? Then fix the issue and retry. Try up to 3 times.
```

## DSL equivalent

```
Goal: fix tests with structured reflection

flow:
  retry max 3
    run: npm test
    if command_failed
      prompt: STOP. Before making any changes, analyze the failure:
        1. What is the root cause of the test failure?
        2. What approaches have been tried so far?
        3. What is a fundamentally different approach to try next?
        Write your analysis, then fix the code based on that analysis.
    end
  end

done when:
  tests_pass
```

## What happens

1. `retry max 3` enters the body and runs `npm test`.
2. If tests fail, `command_failed` is true, so the `if` block activates.
3. The prompt forces the agent to articulate its reasoning before acting. This prevents the "try the same thing again" death spiral.
4. After the agent analyzes and fixes, the retry loop re-enters and runs tests again.
5. The reflection prompt has access to `${last_stderr}` if needed — the error output from the failed test run.
6. The `done when: tests_pass` gate ensures the agent cannot stop until tests actually pass.

## Why this works

Research (Reflexion, Report 06) shows that agents who articulate why they failed before retrying achieve significantly higher success rates. The key insight: **reflection is just a prompt**. No special `reflect` keyword is needed — an explicit instruction to analyze before acting achieves the same result.

The pattern works because:

- The prompt delays action, forcing analysis first
- The agent's analysis becomes part of the conversation context for the fix
- Each retry builds on the previous reflection, creating an improving feedback loop

## Variation: reflection with variable capture

Capture the reflection for use in later prompts:

```
flow:
  retry max 3
    run: npm test
    if command_failed
      let analysis = prompt "What is the root cause of this test failure? List the top 3 possible causes. Respond with ONLY your analysis."
      prompt: Based on your analysis (${analysis}), fix the failing tests. Try the most likely cause first.
    end
  end

done when:
  tests_pass
```

Storing the analysis in a variable ensures it survives context compaction and can be referenced in subsequent prompts.
