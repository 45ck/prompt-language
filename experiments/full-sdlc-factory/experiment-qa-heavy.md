# E9-QA: Full SDLC Factory — Heavy QA Variant

## Hypothesis

Adding automated E2E browser testing (Playwright), Lighthouse audits, cyclomatic
complexity analysis, and visual regression snapshots to the SDLC flow catches
quality issues that basic HTML string checks miss. The `retry max 3` loop around
Playwright test execution creates a fix-until-green convergence cycle — the core
PL value proposition applied to real browser-level testing.

Specifically, we hypothesize that:

1. **String checks are necessary but not sufficient.** A page can contain the
   substring "FAQ" yet have no working accordion behavior. Only a Playwright test
   that clicks an element and asserts visibility change catches this.
2. **Lighthouse scores surface invisible defects.** Missing alt text, poor color
   contrast, absent meta descriptions, and render-blocking patterns are invisible
   to string matching but measurable by automated auditing tools.
3. **Complexity metrics prevent JS bloat.** Without measurement, inline JavaScript
   in a single-file site tends to grow into unmaintainable spaghetti. A complexity
   budget creates back-pressure toward clean code.
4. **Visual snapshots enable regression detection.** Screenshots at desktop, tablet,
   and mobile viewports provide evidence of layout correctness that no DOM check
   can replicate. They also create a baseline for future diff-based regression
   testing.

## What Additional Quality Dimensions Are Tested

| Dimension                  | Baseline (sdlc.flow)       | Heavy QA (sdlc-qa-heavy.flow)                                              |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| **Structural integrity**   | String contains checks     | String contains checks (same)                                              |
| **Behavioral correctness** | None                       | Playwright E2E: nav links, accordion toggle, CTA clicks, responsive layout |
| **Accessibility**          | Alt/aria substring check   | Lighthouse a11y score (0-100) + string checks                              |
| **SEO**                    | Title/meta substring check | Lighthouse SEO score (0-100) + string checks                               |
| **Performance**            | None                       | Lighthouse performance score                                               |
| **Best practices**         | None                       | Lighthouse best-practices score                                            |
| **Code quality**           | None                       | Cyclomatic complexity per function, JS size, CSS selector count            |
| **Visual correctness**     | None                       | Full-page screenshots at 375px, 768px, 1280px                              |
| **Responsive layout**      | None                       | Playwright viewport tests at 3 breakpoints                                 |

## Flow Architecture

```
Phase 1: Requirements & Design (3 captures)
  let brand        = prompt "brand guidelines"
  let requirements = prompt "requirements + acceptance criteria"
  let design       = prompt "component design document"
  -> writes brand.md, requirements.md, design.md

Phase 2: Task Planning (1 capture)
  let tasks = prompt "numbered task list"
  -> writes tasks.md

Phase 3: Implementation (foreach loop)
  foreach task in ${tasks}
    prompt: implement task -> index.html
  -> validates index.html exists and >500 chars

Phase 4: E2E Test Generation & Execution  ← NEW
  let e2e_tests = prompt "write Playwright tests"
  run: npm install @playwright/test + install chromium
  retry max 3                                         ← FIX-UNTIL-GREEN
    run: npx playwright test e2e.spec.js
    if command_failed
      prompt: fix the failing tests or fix index.html
    end
  end

Phase 5: Lighthouse Audit  ← NEW
  run: lighthouse file://index.html
  if scores < 80 -> prompt: fix a11y/seo/bp issues

Phase 6: Code Quality Metrics  ← NEW
  let js_complexity = run "measure branches/functions/lines"
  let css_metrics   = run "measure selectors/media queries"
  if avgComplexity > 10 -> prompt: simplify JS

Phase 7: Visual Snapshot Capture  ← NEW
  run: playwright screenshots at 1280/768/375 widths
  -> screenshot-desktop.png, screenshot-tablet.png, screenshot-mobile.png

Phase 8: QA Summary (4 automated checks, same as baseline)
  -> qa-report.md (now includes E2E, Lighthouse, complexity, screenshots)

Phase 9: Review Loop (until requirements_met max 3)
  -> reviewer now sees qa-report.md with all metrics

Phase 10: Final Summary
  -> re-runs E2E and visual snapshots after all fixes

Gates:
  file_exists index.html
  file_exists e2e.spec.js                              ← NEW
  gate html_valid: </html> present + length > 5000
  gate brand_check: "CloudPulse" + "#2563EB"
  gate e2e_pass: all Playwright tests pass              ← NEW
  gate lighthouse_a11y: accessibility score >= 80       ← NEW
```

## The Fix-Until-Green Loop

The core PL insight applied here: `retry max 3` around `run: npx playwright test`
creates a deterministic convergence cycle.

```
retry max 3
  run: npx playwright test e2e.spec.js    ← deterministic: run tests
  if command_failed                        ← deterministic: check exit code
    let test_output = run "parse failures" ← deterministic: extract errors
    prompt: fix the failures               ← AI: guided by specific errors
  end
end
```

The loop works because:

1. **Test failures are specific.** Playwright reports exactly which assertion failed
   (e.g., "expected element to be visible"), giving the AI precise guidance.
2. **Fixes are incremental.** The prompt instructs the AI to fix either the test
   or the HTML, not rewrite everything.
3. **Convergence is bounded.** `max 3` prevents infinite loops. In practice, most
   issues resolve in 1-2 iterations because Playwright errors are highly actionable.
4. **Both sides are fixable.** The AI can fix the HTML (if the behavior is genuinely
   missing) OR fix the test (if the selector is wrong). This bidirectional repair
   is critical for convergence.

### Expected failure modes

- **Accordion test:** Most likely to fail initially. The AI may generate a FAQ
  section without JavaScript toggle behavior, and the Playwright test will catch
  it because it clicks and asserts visibility change.
- **Responsive test:** May fail if CSS media queries are missing or incomplete.
  The viewport resize + assertion pattern catches layout breakage.
- **Nav link test:** May fail if anchor hrefs don't match section IDs exactly.

## Scoring Rubric

### Lighthouse Scores (25 points)

Each Lighthouse category contributes up to 25 points. The score maps the 0-100
Lighthouse scale to 0-25 points with a threshold at 90 for full marks.

| Category       | 25 pts | 15 pts | 5 pts | 0 pts |
| -------------- | ------ | ------ | ----- | ----- |
| Performance    | >= 90  | 70-89  | 50-69 | < 50  |
| Accessibility  | >= 90  | 70-89  | 50-69 | < 50  |
| Best Practices | >= 90  | 70-89  | 50-69 | < 50  |
| SEO            | >= 90  | 70-89  | 50-69 | < 50  |

If Lighthouse cannot run (e.g., Chrome unavailable in the environment), this
section scores N/A and is excluded from the total.

### E2E Test Pass Rate (25 points)

| Pass Rate             | Points |
| --------------------- | ------ |
| 100% (all tests pass) | 25     |
| 80-99%                | 20     |
| 60-79%                | 15     |
| 40-59%                | 10     |
| 20-39%                | 5      |
| < 20% or no tests     | 0      |

Bonus: -5 points if tests were trivially weakened (e.g., all assertions removed)
to achieve a pass.

### Complexity Budget (10 points)

| Metric                           | Target     | Points |
| -------------------------------- | ---------- | ------ |
| Avg complexity per function <= 5 | Good       | 5      |
| Avg complexity per function 5-10 | Acceptable | 3      |
| Avg complexity per function > 10 | High       | 0      |
| Inline JS < 100 lines            | Lean       | 5      |
| Inline JS 100-200 lines          | Acceptable | 3      |
| Inline JS > 200 lines            | Bloated    | 0      |

### Visual Regression (10 points)

| Criterion                                 | Points |
| ----------------------------------------- | ------ |
| All 3 viewport screenshots captured       | 5      |
| Final screenshots captured after fixes    | 3      |
| No visible layout breakage in screenshots | 2      |

Visual breakage is assessed manually by reviewing the PNG files. In a future
iteration, this could be automated with pixel-diff tools (e.g., pixelmatch).

### SDLC Process Fidelity (30 points)

Same as baseline experiment:

| Criterion                                  | Points |
| ------------------------------------------ | ------ |
| Each phase consumed output of prior phase  | 10     |
| Review loop provided actionable feedback   | 10     |
| Gates blocked completion until quality met | 10     |

### Total: 100 points

- 90-100: Full SDLC + heavy QA executed with high quality across all dimensions
- 70-89: SDLC ran with good quality but some QA gaps
- 50-69: Partial execution, some QA phases skipped or shallow
- Below 50: Flow failed or QA phases did not produce meaningful signal

## How to Run

```bash
# Prerequisites
cd /path/to/prompt-language
npm run build && node bin/cli.mjs install

# Run the heavy QA experiment
mkdir -p /tmp/cloudpulse-qa && cd /tmp/cloudpulse-qa
rm -rf .prompt-language node_modules

claude -p --dangerously-skip-permissions \
  "$(cat experiments/full-sdlc-factory/sdlc-qa-heavy.flow)"
```

Expected runtime: 10-25 minutes (longer than baseline due to npm installs,
Playwright browser downloads, and Lighthouse audits).

### Prerequisites

- Node.js >= 18
- npm
- Chrome/Chromium (Playwright will attempt to install it)
- Sufficient disk space for browser binaries (~200MB)

### Environment notes

- **CI/headless environments:** Playwright and Lighthouse both run in headless
  mode by default. The `--no-sandbox` flag is included for containerized envs.
- **Windows:** The flow uses forward-slash path concatenation with `process.cwd()`
  and a `replace(/\\\\/g,'/')` normalize for file:// URLs.
- **Lighthouse Chrome launcher:** Falls back gracefully if Chrome is unavailable.
  The gate uses `process.exit(0)` on error so Lighthouse failure does not block
  completion — it is informational, not a hard gate.

## Controls

Run the baseline experiment for comparison:

```bash
# Baseline: string-check QA only
mkdir -p /tmp/cloudpulse-baseline && cd /tmp/cloudpulse-baseline
rm -rf .prompt-language
claude -p --dangerously-skip-permissions \
  "$(cat experiments/full-sdlc-factory/sdlc.flow)"
```

Compare the two runs on:

1. **Defect detection rate:** How many issues did the heavy QA variant catch that
   the baseline missed? (e.g., broken accordion, missing responsive styles)
2. **Convergence speed:** Did the retry loop resolve issues faster than the
   baseline's review loop?
3. **Final quality:** Score both with the full rubric. The hypothesis predicts the
   heavy QA variant scores 15-25 points higher due to E2E and Lighthouse coverage.

## Success Criteria

The experiment succeeds if:

1. The flow completes without manual intervention (all phases advance)
2. All gates pass on completion (including e2e_pass)
3. Total score >= 75/100
4. At least one defect is caught by Playwright that the baseline string checks
   would have missed (e.g., accordion not toggling, nav links not scrolling)
5. Lighthouse accessibility score >= 80
6. The heavy QA variant scores higher than the baseline on the same rubric
