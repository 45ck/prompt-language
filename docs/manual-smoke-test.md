# Manual Smoke Test Guide

Manual verification of the NL→DSL meta-prompt pipeline in Claude Code.

## Prerequisites

1. **Build the plugin**:

   ```sh
   npm run build
   ```

2. **Install the plugin in Claude Code**:

   ```sh
   claude plugin add /path/to/prompt-language
   ```

3. **Verify hooks are registered**:

   ```sh
   claude hooks list
   ```

   Confirm `UserPromptSubmit` hook points to `user-prompt-submit.ts`.

4. **Clean state** (remove any leftover session):

   ```sh
   rm -rf .prompt-language/
   ```

## Test Cases

### Case 1: Basic until loop

- **Input**: `Run tests, keep fixing until they pass, max 5 tries`
- **Expected**: Claude responds with a valid `flow:` block containing an `until` node
- **Verify**: The response contains `Goal:`, `flow:`, `until`, and `end`
- [ ] PASS / FAIL

### Case 2: Retry pattern

- **Input**: `Retry the build up to 3 times`
- **Expected**: Claude responds with a `flow:` block containing a `retry max 3` node
- **Verify**: Response contains `retry` and `max 3`
- [ ] PASS / FAIL

### Case 3: If/else conditional

- **Input**: `If tests fail fix them, otherwise move on`
- **Expected**: Claude responds with a `flow:` block containing `if`/`else` branches
- **Verify**: Response contains `if`, `else`, and `end`
- [ ] PASS / FAIL

### Case 4: Try/catch with fallback

- **Input**: `Try running deploy. If it fails, roll back.`
- **Expected**: Claude responds with a `flow:` block containing `try`/`catch`
- **Verify**: Response contains `try`, `catch`, and `end`
- [ ] PASS / FAIL

### Case 5: While loop

- **Input**: `While tests fail, fix them and rerun. Max 3.`
- **Expected**: Claude responds with a `flow:` block containing a `while` node
- **Verify**: Response contains `while`, `max 3`, and `end`
- [ ] PASS / FAIL

### Case 6: Complex multi-step flow

- **Input**: `Run tests. If fail, fix. Then lint. Keep going until both pass.`
- **Expected**: Claude responds with a multi-node `flow:` block (possibly `until` wrapping multiple steps)
- **Verify**: Response contains `Goal:`, `flow:`, and multiple node types
- [ ] PASS / FAIL

### Case 7: Plain prompt (negative test)

- **Input**: `What is the capital of France?`
- **Expected**: Prompt passes through unchanged — no meta-prompt injection, no DSL
- **Verify**: Claude answers the question normally without any `[prompt-language]` prefix
- [ ] PASS / FAIL

### Case 8: Already-valid DSL

- **Input**:

  ```
  Goal: Run tests

  flow:
    run: npm test

  done when:
    tests_pass
  ```

- **Expected**: DSL is parsed directly. Session state is created. Context block is injected.
- **Verify**: Response shows `[prompt-language] Active flow: Run tests` context, not a meta-prompt
- [ ] PASS / FAIL

### Case 9: Active flow + new NL input

- **Setup**: First run Case 8 to create an active flow
- **Input**: `Now fix the linting errors`
- **Expected**: Flow context is injected (showing active flow info), not a meta-prompt
- **Verify**: Response includes `[prompt-language] Active flow:` and `Status: active`
- [ ] PASS / FAIL

### Case 10: Gate enforcement

- **Setup**: Start a flow with `done when:` gates (e.g., Case 8)
- **Input**: Try to end the conversation or start a new unrelated task
- **Expected**: The agent should respect completion gates — it should not claim the flow is complete until gates are satisfied
- **Verify**: Agent continues working toward gate satisfaction rather than stopping early
- [ ] PASS / FAIL

## Troubleshooting

### State file location

Session state is stored in `.prompt-language/session-state.json` relative to the working directory.

### Reset state

To clear the current flow and start fresh:

```sh
rm -rf .prompt-language/
```

### Debug: inspect hook output

Pipe input directly to the hook to see what it produces:

```sh
echo '{"prompt":"Run tests until they pass, max 5"}' | npx tsx src/presentation/hooks/user-prompt-submit.ts
```

### Debug: check if NL detection triggers

The hook detects NL intent using keyword matching. If a prompt is not being detected as NL:

1. Check the `NL_INTENT_WORDS` list in `src/application/inject-context.ts`
2. Run the hook manually (see above) and inspect the output

### Common issues

- **No meta-prompt injected for NL input**: The input may not match any NL intent keywords. Check `NL_INTENT_RE` in `inject-context.ts`.
- **Meta-prompt injected for plain text**: A keyword like "passes", "fails", or "until" may be triggering false positives.
- **State file not created after DSL input**: Ensure the working directory is writable and not inside a read-only mount.
- **Hook errors silently**: The hook catches errors and exits 0 to avoid blocking the user. Check stderr for `[prompt-language] hook error:` messages.
