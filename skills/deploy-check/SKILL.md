---
name: deploy-check
description: Pre-deployment verification pipeline. Runs lint, tests, and build with automatic fix-retry on failures.
argument-hint: ''
---

# Deploy Check

Run a full pre-deployment verification pipeline: lint, test, build. Fix any failures automatically.

## What to do

1. Run the linter. If it fails, fix the lint errors and re-run.
2. Run the test suite. If it fails, fix the failing tests and re-run.
3. Run the build. If it fails, fix the build errors and re-run.
4. Do not stop until all three pass.

## Flow

```
flow:
  run: npm run lint
  if command_failed
    retry max 3
      prompt: Fix the lint errors shown above.
      run: npm run lint
    end
  end
  run: npm test
  if command_failed
    retry max 3
      prompt: Fix the test failures shown above.
      run: npm test
    end
  end
  run: npm run build
  if command_failed
    retry max 3
      prompt: Fix the build errors shown above.
      run: npm run build
    end
  end

done when:
  tests_pass
  lint_pass
  file_exists dist/index.js
```

## Rules

- Fix each stage before moving to the next.
- Do not skip a stage, even if you believe it will pass.
- If a fix in a later stage breaks an earlier stage, go back and re-verify.
- Report the final status of all three stages when done.
