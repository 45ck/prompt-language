/flow-eval

Evaluate a flow condition against session variables with a step-by-step trace.

1. Read `.prompt-language/session-state.json`.
2. Variable source selection:
   - If `status == "active"`, use `state.variables`.
   - Otherwise, treat the loaded state as the **last session state** and still use `state.variables`.
   - If no primary state exists, try `.prompt-language/session-state.bak.json`, then `.prompt-language/session-state.bak2.json`.
3. Evaluate the provided condition using runtime-compatible condition semantics:
   - comparisons: `==`, `!=`, `>`, `<`, `>=`, `<=`
   - boolean operators: `and`, `or`, `not` with parentheses support
   - variable references: bare identifiers and `${var}` tokens
4. Return:
   - final boolean/null result,
   - intermediate evaluation steps with resolved operand values,
   - explicit undefined-variable errors (do not silently coerce missing vars).
5. If no state file can be loaded, return a clear message: no active/last session state available.

Use this for debugging branch behavior before `if`/`while`/`until` nodes execute.
