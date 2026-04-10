# Proposed Artifact Syntax

These examples are design proposals, not current shipped syntax.

## 1. Define a custom artifact type

```text
artifact type "browser_qa_packet"
  fields:
    page: string
    summary: markdown
    issues: string[]
    recommendation: string
    screenshots: file[]
    recording: file
    console_errors: string[]
  views:
    api -> json
    notepad -> md
    browser -> html
    word -> docx
end
```

## 2. Emit a release-readiness artifact

```text
Goal: prepare auth-service for release

flow:
  run: npm test
  run: npm run lint
  let diff = run "git diff --name-only"
  let risks = prompt "List the top release risks for these changes: ${diff}"

  emit artifact "release_readiness" as release_packet
    title = "Auth service release readiness"
    summary = prompt "Write a short release-readiness summary."
    payload.service = "auth-service"
    payload.changed_files = ${diff}
    payload.risks = ${risks}
    attach "coverage/summary.json"
    attach "playwright-report/index.html"
    render browser
    render word
    render notepad
  end

done when:
  tests_pass
  lint_pass
  artifact_exists release_packet
  artifact_valid release_packet
```

## 3. Approval targeted at an artifact

```text
Goal: deploy only after human review

flow:
  prompt: Build the deployment plan.
  emit artifact "deployment_plan" as deploy_plan
    title = "Production deployment plan"
    summary = prompt "Write the deploy plan, rollback plan, and risk notes."
    payload.environment = "production"
    payload.requires_downtime = "false"
    render browser
    render word
  end

  approve artifact deploy_plan message "Review deployment plan before release"

done when:
  artifact_status deploy_plan == approved
```

## 4. Browser QA packet

```text
Goal: test checkout flow and prepare review packet

flow:
  run: npx playwright test tests/checkout.spec.ts
  let qa_summary = prompt "Summarize what happened in checkout testing."
  let recommendation = prompt "Should this ship? Answer with reasoning."

  emit artifact "browser_qa_packet" as checkout_packet
    title = "Checkout QA review"
    payload.page = "/checkout"
    payload.summary = ${qa_summary}
    payload.recommendation = ${recommendation}
    attach "playwright-report/index.html"
    attach "artifacts/screenshots/checkout-step-1.png"
    attach "artifacts/screenshots/checkout-step-2.png"
    attach "artifacts/recordings/checkout.webm"
    render browser
    render word
    render notepad
  end

done when:
  artifact_exists checkout_packet
  artifact_valid checkout_packet
```

## 5. Client handoff artifact

```text
artifact type "client_handoff"
  fields:
    client_name: string
    executive_summary: markdown
    before_after_notes: string[]
    recommended_next_steps: string[]
    preview_images: file[]
  views:
    api -> json
    notepad -> md
    browser -> html
    word -> docx
    share -> pdf
end
```

## 6. Child-agent handoff artifact

```text
Goal: split frontend and backend work, then merge review packets

flow:
  spawn "frontend"
    prompt: Fix frontend regressions and emit a frontend review packet.
  end

  spawn "backend"
    prompt: Fix backend regressions and emit a backend review packet.
  end

  await all

  emit artifact "merge_review_packet" as final_packet
    title = "Merged regression review"
    payload.frontend = ${frontend.review_packet}
    payload.backend = ${backend.review_packet}
    summary = prompt "Write the merged summary for a human reviewer."
    render browser
    render notepad
  end

done when:
  artifact_exists final_packet
  artifact_valid final_packet
```
