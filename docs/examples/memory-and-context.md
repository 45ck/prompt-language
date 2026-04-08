# Example: Memory and Context

Load persistent context into flow variables at the start of a session. The DSL can prefetch remembered values with `memory:` and can write new facts with `remember`.

## Natural language

```
Before starting, read the project conventions from CLAUDE.md and any notes from previous sessions. Use that context when implementing the feature.
```

## DSL equivalent

```yaml
Goal: implement feature with remembered context

memory:
  preferred_language
  last_approach

flow:
  prompt: Implement the user authentication feature using ${preferred_language}.
    Last approach we tried: ${last_approach}
  let current_approach = prompt "What approach are you taking?"
  remember key="last_approach" value="${current_approach}"
  run: npm test

done when:
  tests_pass
```

## What happens

1. The `memory:` section preloads `preferred_language` and `last_approach` from `.prompt-language/memory.json` before the first flow node runs.
2. The prompt receives both values immediately, so the agent starts with project memory instead of reconstructing it from scratch.
3. `let current_approach = prompt "What approach are you taking?"` captures the agent's current plan.
4. `remember key="last_approach" value="${current_approach}"` stores that plan for the next session.

## Why this works

Cross-session memory is a first-class runtime concern, not just a shell trick. The DSL owns the persistent memory store:

- **`memory:`** — prefetches keys into variables before flow execution starts
- **`remember`** — stores free-form notes or keyed values for later runs
- **`.prompt-language/memory.json`** — the persistent backing store
- **`let x = run "cat ..."`** — still useful for ad hoc file reads, but no longer the only mechanism

## Variation: save notes for next session

Write results back to persistent storage at the end of a flow:

```yaml
Goal: implement feature and save notes

flow:
  prompt: Implement the payment processing module.
  run: npm test
  let results = run "npm test 2>&1 | tail -5"
  remember "Session note: implemented payment module. Test results: ${results}"
```

The final `remember` call appends a session summary to the persistent memory store, which the next session can read through `memory:`.

## Variation: load structured context

Pull in multiple context sources for complex tasks:

```yaml
flow:
  memory:
    api_style
    test_strategy

  prompt: Add a new /users endpoint.
    API style: ${api_style}
    Test strategy: ${test_strategy}

done when:
  tests_pass
```

Loading the shared context into memory ensures the agent has all the context it needs in a single prompt, reducing the chance of convention violations.
