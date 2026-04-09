# Example: Memory and Context

Use persistent memory when a later flow run needs to pick up facts from an earlier run. The DSL can write to `.prompt-language/memory.json` with `remember`, then read those values back in a separate session with `memory:` or `memory "key"`.

## Natural language

```
Session 1: record the current implementation choice and test note.
Session 2: open a new flow in the same project directory, read those notes back, and continue from them instead of relearning the context.
```

## DSL equivalent

### Session 1: write memory

```yaml
Goal: record implementation notes for the next session

flow:
  prompt: Implement the user authentication feature.
  let current_approach = prompt "What approach are you taking?"
  remember key="preferred_language" value="TypeScript"
  remember key="last_approach" value="${current_approach}"
  remember "Session 1 note: auth feature implemented with ${current_approach}"
  run: npm test

done when:
  tests_pass
```

### Session 2: read memory back

```yaml
Goal: continue from the previous session's notes

memory:
  preferred_language
  last_approach

flow:
  let preferred_language = memory "preferred_language"
  let last_approach = memory "last_approach"
  prompt: Resume the feature in ${preferred_language}. The previous approach was ${last_approach}. Continue from there.
  run: npm test

done when:
  tests_pass
```

## What happens

1. Session 1 writes keyed entries into `.prompt-language/memory.json`.
2. Session 1 also stores a free-form note that survives after the flow ends.
3. Session 2 starts in a fresh flow session, but the same working directory still has the memory file.
4. The `memory:` section preloads `preferred_language` and `last_approach` before the first flow node runs.
5. `let preferred_language = memory "preferred_language"` and `let last_approach = memory "last_approach"` read the persisted values back into session variables.
6. The second prompt uses the exact remembered values instead of reconstructing them from conversation history.

## Why this works

Cross-session memory is a first-class runtime concern, not just a shell trick. The DSL owns the persistent memory store:

- **`remember`** stores free-form text or keyed values for later runs
- **`memory:`** prefetches keys into variables before flow execution starts
- **`memory "key"`** reads a keyed memory value directly into a variable
- **`.prompt-language/memory.json`** is the persistent backing store shared across sessions
- **`let x = run "cat ..."`** is still useful for ad hoc file reads, but it is not the memory mechanism

## Variation: load structured context

Pull in multiple remembered values for a complex follow-up session:

```yaml
Goal: continue the feature with remembered context

memory: preferred_language
  last_approach

flow:
  prompt: Continue the implementation using ${preferred_language}. Last time we tried ${last_approach}.

done when: tests_pass
```

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

The final `remember` call appends a session summary to the persistent memory store, which the next session can read through `memory:` or `memory "key"`.
