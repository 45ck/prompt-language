# DSL Ergonomics Review

Bead: `prompt-language-4or9`
Date: 2026-04-11
Scope: cold-read `dsl-cheatsheet.md`, `dsl-reference.md`, and `language-guide.md`; write sample flows from docs; inspect validate/lint UX and documented pitfalls on current `origin/main`.

## Findings

### 1. Top-level docs over-claim the current language surface

Severity: medium

The two cold-start entry points imply a more complete and stable surface map
than they actually provide.

- `docs/reference/dsl-cheatsheet.md` said "Quick reference for all prompt-language primitives, variables, and gates" while omitting advanced but shipped surface such as `review strict`, named judges, rubric/judge declarations, swarm-only `start` / `return`, and profile-aware validation caveats.
- `docs/reference/dsl-reference.md` opened by asserting the language has "thirteen primitives", which is no longer true for the shipped syntax the rest of the repo documents.

Impact:

- A new user can read the cheatsheet and still fail to discover real syntax they will encounter in examples, validation output, or review docs.
- The missing surface map makes the DSL feel more ad hoc than it is.

Recommendation:

- Keep the cheatsheet intentionally partial, but say so explicitly and point to the reference index for advanced constructs.
- Keep the reference intro aligned with the actual shipped surface instead of a stale primitive count.

### 2. Validate output is actionable only for tiny flows because warnings point to node ids, not source locations

Severity: medium

`validate` currently reports warnings like:

```text
Warnings:
  [!] n3: Break outside of loop
  [!] n4: Reference to undefined variable "${module_typo}"
```

That is enough for a four-line sample, but it does not scale. A cold reader has
to visually diff the rendered flow against the original source to find `n3` or
`n4`. There is no line number, column, or echoed source snippet in the warning.

Impact:

- Debugging onboarding mistakes in longer flows is slower than it needs to be.
- The output looks implementation-centric rather than author-centric.

Recommendation:

- Attach source line numbers to parsed nodes and emit `line:column` in lint and parse diagnostics.
- If line/column is not yet available, include the offending source excerpt in the warning text.

### 3. Ungrounded `if ask` is a silent pitfall

Severity: medium

The docs present `if ask "..."` as ordinary control flow, but the lint pressure
is inconsistent.

- `lintFlow()` warns on `while ask ...` and `until ask ...` without
  `grounded-by`.
- There is no equivalent warning for `if ask ...` without `grounded-by`.
- `docs/guides/language-guide.md` encourages `if ask` usage, but the absence of a
  warning makes an ungrounded branch look safer than it is.

Impact:

- Authors can branch on a subjective model verdict with no evidence and no static reminder to add grounding.
- This is especially risky for "safe to deploy?" or "is this complete?" style branches where the DSL otherwise tries to force verification.

Recommendation:

- Emit the same ungrounded-`ask` warning for `if ask` that loops already get.
- In the docs, phrase ungrounded `ask` as a fallback rather than the default.

### 4. The flat-scope variable model is documented too late for a core pitfall

Severity: low

The most important scoping constraint is buried in a guide callout rather than
made prominent in the reference surface.

- Variables are global and mutable across the whole flow.
- Loop variables and inner `let` declarations can shadow outer state.
- Auto-variables such as `last_stdout` and `command_failed` are overwritten after every `run`.

The guide mentions this under a late "Scope gotcha" note, but the cheatsheet
does not surface it and the reference largely reads as if `let` behaves like a
local binding.

Impact:

- New authors can accidentally rely on stale or overwritten values.
- The language feels deceptively structured until lint catches shadowing after the fact.

Recommendation:

- Add a short "Scope model" note near the first `let/var` description in the cheatsheet/reference.
- Treat "auto-variables are overwritten after every run" as a first-class warning, not a buried aside.

## Sample Flows Used

### Sample 1: basic onboarding flow

```text
Goal: sample onboarding

flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach file in ${files}
    run: npx eslint ${file} --fix
  end

done when:
  lint_pass
```

This validated cleanly and confirmed that the core happy path is readable.

### Sample 2: lint/error UX probe

```text
Goal: sample ergonomics

flow:
  if ask "is auth done?"
    prompt: ship it
  end
  break
  prompt: use ${module_typo}

done when:
  tests_pass
```

This produced the node-id-only warnings cited above and showed that `if ask`
without `grounded-by` receives no lint warning.

## Closure Recommendation

This bead is closure-ready after this review note lands.

- Acceptance asks for at least 3 findings: satisfied.
- Acceptance asks for cheatsheet update if inaccuracies were found: satisfied.
- No runtime changes are required to record this review outcome.
