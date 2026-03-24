# Example: Memory and Context

Load persistent context into flow variables at the start of a session. Files, project notes, and previous results survive across sessions — the DSL reads them via `let x = run "cat ..."`.

## Natural language

```
Before starting, read the project conventions from CLAUDE.md and any notes from previous sessions. Use that context when implementing the feature.
```

## DSL equivalent

```
Goal: implement feature with project context

flow:
  let conventions = run "cat CLAUDE.md"
  let notes = run "cat .project-notes 2>/dev/null || echo 'No previous notes'"
  let recent_changes = run "git log --oneline -5"
  prompt: Implement the user authentication feature.
    Follow these project conventions: ${conventions}
    Notes from previous work: ${notes}
    Recent changes for context: ${recent_changes}

done when:
  tests_pass
```

## What happens

1. `let conventions = run "cat CLAUDE.md"` loads the project instructions file into a variable. This gives the agent access to coding standards, naming conventions, and architecture rules.
2. `let notes = run "cat .project-notes 2>/dev/null || echo '...'"` loads session notes from a previous run. The `2>/dev/null || echo` pattern handles the case where the file doesn't exist yet.
3. `let recent_changes = run "git log --oneline -5"` captures recent git history for context.
4. All three variables are interpolated into the prompt, giving the agent rich context before it starts work.

## Why this works

Cross-session memory is a file system concern, not a language concern. Any file that persists on disk is accessible via `let x = run "cat ..."`:

- **CLAUDE.md** — project instructions (automatically loaded by Claude Code, but also available as a variable for explicit reference)
- **`.project-notes`** — a simple text file for session-to-session notes
- **beads issues** — structured task tracking that persists across sessions
- **git history** — previous commits, diffs, and logs

The DSL doesn't need a `memory` keyword because `run "cat file"` already reads any file.

## Variation: save notes for next session

Write results back to persistent storage at the end of a flow:

```
Goal: implement feature and save notes

flow:
  let conventions = run "cat CLAUDE.md"
  prompt: Implement the payment processing module following conventions: ${conventions}
  run: npm test
  let results = run "npm test 2>&1 | tail -5"
  run: echo "Session $(date): Implemented payment module. Test results: ${results}" >> .project-notes
```

The final `run` appends a session summary to `.project-notes`, which the next session can read.

## Variation: load structured context

Pull in multiple context sources for complex tasks:

```
flow:
  let schema = run "cat prisma/schema.prisma"
  let api_spec = run "cat docs/api-spec.yaml"
  let test_patterns = run "cat src/__tests__/README.md 2>/dev/null || echo 'No test guide'"
  prompt: Add a new /users endpoint.
    Database schema: ${schema}
    API specification: ${api_spec}
    Test patterns to follow: ${test_patterns}

done when:
  tests_pass
  gate typecheck: npx tsc --noEmit
```

Loading the schema, API spec, and test patterns into variables ensures the agent has all the context it needs in a single prompt, reducing the chance of convention violations.
