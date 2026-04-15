---
name: qa-audit
description: "This skill should be used when the user asks to 'run QA', 'quality audit', 'test the website', 'run E2E tests', 'lighthouse audit', 'check accessibility', 'visual regression test', 'run Playwright tests', 'quality gate check', or wants comprehensive quality verification of a web project. Use case-by-case when generated sites need validation beyond basic checks."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
argument-hint: '[path to index.html or project directory]'
---

# QA Audit

Run a comprehensive quality audit on a web project: E2E tests, Lighthouse scores, code complexity, and visual snapshots. Fix failures automatically with retry loops.

Use this after building or generating a website to verify it meets production quality standards. The agent should decide case-by-case whether to invoke this skill based on the project context.

## What to do

1. Detect the target file (argument or `index.html` in current directory).
2. Install testing dependencies if not present.
3. Generate and run Playwright E2E tests.
4. Run Lighthouse audit for performance, accessibility, best practices, SEO.
5. Measure code complexity of inline JS/CSS.
6. Capture visual snapshots at desktop, tablet, and mobile viewports.
7. Fix any failures and re-run until green.
8. Report a consolidated QA scorecard.

## Flow

```
flow:
  # Phase 1: E2E Test Generation & Execution
  run: npm init -y 2>/dev/null; npm install --save-dev @playwright/test 2>/dev/null; npx playwright install chromium 2>/dev/null
  let e2e_tests = prompt "Write a Playwright E2E test file (e2e.spec.js) for the website at index.html. Test: (1) page loads with correct title, (2) navigation links exist and are clickable, (3) all major sections are visible (hero, features, pricing, testimonials, FAQ, footer), (4) responsive layout at 375px, 768px, and 1024px viewports, (5) interactive elements work (accordion toggle, button clicks), (6) accessibility basics (lang attribute, alt text, ARIA labels). Save to e2e.spec.js."
  retry max 3
    run: npx playwright test e2e.spec.js --reporter=list 2>&1
    if command_failed
      let test_errors = run "npx playwright test e2e.spec.js --reporter=json 2>/dev/null | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const fails=d.suites?.[0]?.specs?.filter(s=>s.ok===false).map(s=>s.title+': '+s.tests?.[0]?.results?.[0]?.error?.message?.slice(0,200))||[]; console.log(fails.join('\\n'))\""
      prompt: Playwright tests failed. Errors: ${test_errors}. Fix the issues in index.html or e2e.spec.js. Do not remove passing tests. Make minimal targeted fixes.
    end
  end

  # Phase 2: Lighthouse Audit
  run: npm install --save-dev lighthouse 2>/dev/null
  let lighthouse_scores = run "node -e \"const lh=require('lighthouse'); const chromeLauncher=require('chrome-launcher'); (async()=>{let c; try{c=await chromeLauncher.launch({chromeFlags:['--headless','--no-sandbox']}); const r=await lh('file://'+process.cwd()+'/index.html',{port:c.port,output:'json',onlyCategories:['performance','accessibility','best-practices','seo']}); const s=r.lhr.categories; console.log(JSON.stringify({perf:Math.round(s.performance.score*100),a11y:Math.round(s.accessibility.score*100),bp:Math.round(s['best-practices'].score*100),seo:Math.round(s.seo.score*100)}))}catch(e){console.log(JSON.stringify({error:e.message}))}finally{if(c)await c.kill()}})()\""
  if ${lighthouse_scores} contains "error"
    prompt: Lighthouse audit could not run (Chrome may not be available). Skip this phase and note in the report.
  else
    if ${lighthouse_scores} contains "\"a11y\":10" or ${lighthouse_scores} contains "\"a11y\":2" or ${lighthouse_scores} contains "\"a11y\":3" or ${lighthouse_scores} contains "\"a11y\":4"
      prompt: Lighthouse accessibility score is below 50. Read index.html and fix critical accessibility issues: add lang attribute, alt text on images, ARIA labels on interactive elements, proper heading hierarchy, sufficient color contrast. Do not remove existing content.
    end
  end

  # Phase 3: Code Complexity Metrics
  let complexity = run "node -e \"const h=require('fs').readFileSync('index.html','utf8'); const scripts=(h.match(/<script[^>]*>([\\s\\S]*?)<\\/script>/gi)||[]).map(s=>s.replace(/<\\/?script[^>]*>/gi,'')).join(''); const css=(h.match(/<style[^>]*>([\\s\\S]*?)<\\/style>/gi)||[]).map(s=>s.replace(/<\\/?style[^>]*>/gi,'')).join(''); const branches=(scripts.match(/\\bif\\b|\\belse\\b|\\bfor\\b|\\bwhile\\b|\\bswitch\\b|\\bcase\\b|\\bcatch\\b|\\?/g)||[]).length; const funcs=(scripts.match(/function\\b|=>/g)||[]).length; const selectors=(css.match(/[^{}]+(?=\\{)/g)||[]).length; const mediaQueries=(css.match(/@media/g)||[]).length; console.log(JSON.stringify({jsLines:scripts.split('\\n').length,jsBranches:branches,jsFunctions:funcs,avgComplexity:funcs>0?Math.round(branches/funcs*10)/10:0,cssSelectors:selectors,mediaQueries:mediaQueries,totalSize:h.length}))\""

  # Phase 4: Visual Snapshots
  run: node -e "const{chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+process.cwd()+'/index.html');await p.screenshot({path:'screenshot-desktop.png',fullPage:true});await p.setViewportSize({width:768,height:1024});await p.screenshot({path:'screenshot-tablet.png',fullPage:true});await p.setViewportSize({width:375,height:812});await p.screenshot({path:'screenshot-mobile.png',fullPage:true});await b.close()})()" 2>/dev/null

  # Phase 5: Consolidated Report
  run: node -e "const r=['# QA Audit Report','','## E2E Tests','Status: see test output above','','## Lighthouse Scores','${lighthouse_scores}','','## Code Complexity','${complexity}','','## Visual Snapshots','- screenshot-desktop.png','- screenshot-tablet.png','- screenshot-mobile.png'].join('\n'); require('fs').writeFileSync('qa-audit-report.md',r); console.log(r)"

done when:
  file_exists index.html
  gate e2e_pass: npx playwright test e2e.spec.js --reporter=list 2>&1 | tail -1 | grep -q "passed"
```

## Decision Criteria for Agents

An agent should invoke `/qa-audit` when:

- A website or web application has been generated or significantly modified
- The user asks about quality, testing, accessibility, or performance
- The project has an `index.html` or build output that can be served
- Pre-deployment verification is needed beyond lint/test/build

An agent should NOT invoke `/qa-audit` when:

- The project is a CLI tool, library, or non-web artifact
- Only unit tests are needed (use `/fix-and-test` instead)
- The code hasn't been built yet (build first, then audit)
- The user explicitly asks for a subset (e.g., "just run lighthouse")

## Quality Thresholds

| Metric                    | Green  | Yellow    | Red    |
| ------------------------- | ------ | --------- | ------ |
| E2E pass rate             | 100%   | 80-99%    | <80%   |
| Lighthouse Performance    | 90+    | 70-89     | <70    |
| Lighthouse Accessibility  | 90+    | 80-89     | <80    |
| Lighthouse Best Practices | 90+    | 70-89     | <70    |
| Lighthouse SEO            | 90+    | 80-89     | <80    |
| Avg JS complexity         | <5     | 5-10      | >10    |
| Total file size           | <100KB | 100-500KB | >500KB |

## Done Response Template

```
## QA Audit Results

**E2E Tests:** X/Y passed (Z%)
**Lighthouse:** Perf: XX | A11y: XX | BP: XX | SEO: XX
**Complexity:** X branches / Y functions (avg: Z)
**File Size:** XX KB
**Visual Snapshots:** desktop, tablet, mobile captured
**Overall:** PASS / FAIL
```
