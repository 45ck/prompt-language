---
name: deploy-check
description: "This skill should be used when the user asks to 'check if ready to deploy', 'pre-deploy check', 'verify before deploying', 'deployment readiness', 'is it ready to ship', or wants pre-deployment verification."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
argument-hint: ''
---

# Deploy Check

Run a full pre-deployment verification pipeline: lint, test, build. Fix any failures automatically.

## What to do

1. Run the full pipeline (lint + test + build).
2. If anything fails, read the error output, fix the issue, and re-run.
3. Repeat until all three pass.

## Flow

```
flow:
  retry max 5
    run: npm run lint && npm test && npm run build
    if command_failed
      prompt: The pipeline failed. Read the error output, fix the issue, and try again.
    end
  end

done when:
  tests_pass
  lint_pass
```

## Rules

- Fix the first error you encounter — later stages may depend on earlier ones.
- If a fix in a later stage breaks an earlier stage, the next retry will catch it.
- Report the final status of all three stages when done.
