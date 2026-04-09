# Examples

## 1. Manager-worker swarm

```yaml
Goal: fix a full-stack checkout regression safely

flow:
  let branch = run "git branch --show-current" | trim
  let sha = run "git rev-parse HEAD" | trim

  swarm checkout_fix
    role frontend model "sonnet" with vars branch, sha
      prompt: On branch ${branch} at ${sha}, fix the checkout UI regression and focused tests.
      run: npm test -- src/checkout
      let summary = prompt "Return JSON with summary, changed_files, and confidence" as json {
        summary: string
        changed_files: string[]
        confidence: number
      }
      return ${summary}
    end

    role backend model "sonnet" in "packages/api" with vars branch, sha
      prompt: On branch ${branch} at ${sha}, fix the checkout API regression and focused tests.
      run: npm test -- checkout
      let summary = prompt "Return JSON with summary, changed_files, and confidence" as json {
        summary: string
        changed_files: string[]
        confidence: number
      }
      return ${summary}
    end

    role reviewer model "haiku" with vars branch, sha
      prompt: Review the combined diff for correctness, regression risk, and missing tests.
      let verdict = prompt "Return JSON with status and issues" as json {
        status: string
        issues: string[]
      }
      return ${verdict}
    end

    flow:
      start frontend, backend
      await all
      start reviewer
      await reviewer
    end
  end

  if ${checkout_fix.reviewer.result.status} == "FAIL"
    prompt: Fix these issues: ${checkout_fix.reviewer.result.issues}
  end

done when:
  tests_pass
  lint_pass
```

## 2. Repo-wide audit swarm

```yaml
Goal: audit changed TypeScript files for security issues and fix high-confidence findings

flow:
  let files = run "git diff --name-only -- '*.ts' '*.tsx'"

  foreach-spawn file in ${files} max 20
    prompt: Review ${file} for auth flaws, secret leakage, unsafe parsing, and missing validation. Fix only high-confidence issues.
  end

  await all

done when:
  tests_pass
  lint_pass
```

Note: this example remains best expressed with existing `foreach-spawn`; it does not need the new `swarm` surface.

## 3. Multi-strategy swarm with explicit judge

```yaml
Goal: fix flaky auth tests with the safest winning approach

flow:
  swarm auth_fix
    role minimal_patch
      prompt: Fix the flake with the smallest safe patch.
      run: npm test -- auth
      return "minimal_patch finished"
    end

    role test_isolation
      prompt: Fix the flake by improving test setup, teardown, and isolation.
      run: npm test -- auth
      return "test_isolation finished"
    end

    role judge model "haiku"
      prompt: Compare the current state of both approaches and recommend the safer one.
      let verdict = prompt "Return JSON with winner and rationale" as json {
        winner: string
        rationale: string
      }
      return ${verdict}
    end

    flow:
      start minimal_patch, test_isolation
      await all
      start judge
      await judge
    end
  end

done when:
  tests_pass
  lint_pass
```

## 4. Reviewer-first watchdog swarm

```yaml
Goal: refactor the parser without breaking behavior

flow:
  swarm parser_refactor
    role implementer
      prompt: Refactor the parser for clarity without changing behavior.
      run: npm test -- parser
      let summary = prompt "Return JSON with a short summary and changed files" as json {
        summary: string
        changed_files: string[]
      }
      return ${summary}
    end

    role reviewer model "haiku"
      prompt: Review the current diff for subtle behavior changes and missing tests.
      let verdict = prompt "Return JSON with status and issues" as json {
        status: string
        issues: string[]
      }
      return ${verdict}
    end

    flow:
      start implementer
      await implementer
      start reviewer
      await reviewer
    end
  end

  if ${parser_refactor.reviewer.result.status} == "FAIL"
    prompt: Address these reviewer issues: ${parser_refactor.reviewer.result.issues}
  end

done when:
  tests_pass
  lint_pass
```
