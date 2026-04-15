# E9: Full SDLC Factory

## Hypothesis

A single PL flow can orchestrate the **complete Software Development Lifecycle** --
requirements elicitation, design, task planning, implementation, QA, and iterative
review -- producing a production-quality marketing website in one unattended session.
The structured SDLC phases will yield higher quality than an ad-hoc "just build it"
prompt because each phase constrains the next: brand guidelines constrain design,
design constrains implementation, and QA gates enforce measurable quality bars.

## What We Are Testing

1. **Phase sequencing**: Can PL enforce a strict SDLC phase order (requirements ->
   design -> plan -> build -> QA -> review) where each phase's output feeds the next?
2. **AI-driven design capture**: Do `let x = prompt` captures reliably produce
   structured documents (brand guidelines, requirements, component designs) that
   downstream phases can consume?
3. **Task decomposition loop**: Can an AI-generated task list drive a `foreach`
   implementation loop where each iteration makes incremental progress on a single
   HTML file?
4. **Automated QA**: Do Node.js-based validation scripts (structure, a11y, SEO,
   brand compliance) provide meaningful signal that the AI can act on?
5. **Review-fix cycle**: Does the `until` review loop with `break` on APPROVED
   converge within 3 iterations, or does it oscillate?
6. **Gate enforcement**: Do composite `done when` gates (file existence + HTML
   validity + brand compliance) reliably block completion until quality bars are met?

## Product Under Test

**CloudPulse** -- a cloud monitoring SaaS marketing website. Single `index.html`
file with inline CSS and content. Sections: hero, features, pricing, testimonials,
integrations, FAQ, CTA footer.

## Flow Architecture

```
Phase 1: Requirements & Design (3 captures)
  let brand       = prompt "brand guidelines"
  let requirements = prompt "requirements + acceptance criteria"
  let design      = prompt "component design document"
  -> writes brand.md, requirements.md, design.md

Phase 2: Task Planning (1 capture)
  let tasks = prompt "numbered task list from requirements + design"
  -> writes tasks.md

Phase 3: Implementation (foreach loop)
  foreach task in ${tasks}
    prompt: implement task against brand.md + design.md -> index.html
  -> validates index.html exists and has content

Phase 4: QA & V&V (4 automated checks)
  run: structure check (sections, headings, nav)
  run: accessibility check (alt, aria, contrast, skip-link)
  run: SEO check (title, meta, h1, canonical)
  run: brand compliance (CloudPulse, #2563EB, sections)
  -> writes qa-report.md

Phase 5: Review Loop (until requirements_met max 3)
  let review = prompt "compare index.html against requirements.md"
  if APPROVED -> break
  else -> generate fix tasks -> foreach fix -> prompt: fix it
  -> converges or exhausts 3 iterations

Gates:
  file_exists index.html
  gate html_valid: </html> present + length > 5000
  gate brand_check: "CloudPulse" + "#2563EB" present
```

## How to Run

```bash
# Prerequisites
cd /path/to/prompt-language
npm run build && node bin/cli.mjs install

# Run the experiment
mkdir -p /tmp/cloudpulse && cd /tmp/cloudpulse
rm -rf .prompt-language

claude -p --dangerously-skip-permissions "$(cat experiments/full-sdlc-factory/sdlc.flow)"
```

Alternatively, copy `sdlc.flow` into a working directory and run:

```bash
claude -p --dangerously-skip-permissions "$(cat sdlc.flow)"
```

Expected runtime: 5-15 minutes depending on model latency.

## Scoring Rubric

### Phase Completion (0-5 points each, 25 total)

| Phase                 | 5 pts                                       | 3 pts                           | 0 pts            |
| --------------------- | ------------------------------------------- | ------------------------------- | ---------------- |
| Requirements & Design | All 3 docs written with structured content  | Docs written but shallow        | Missing docs     |
| Task Planning         | Numbered task list with 5+ items            | Task list present but vague     | No task list     |
| Implementation        | index.html with all sections, >5KB          | Partial HTML with some sections | No HTML or empty |
| QA                    | All 4 checks run, qa-report.md written      | Some checks run                 | No QA executed   |
| Review Loop           | Review converges (APPROVED or 3 iterations) | Loop entered but stalls         | Loop skipped     |

### Quality Gates (0-5 points each, 15 total)

| Gate                   | 5 pts                               | 0 pts                  |
| ---------------------- | ----------------------------------- | ---------------------- |
| file_exists index.html | File exists with content            | Missing                |
| html_valid             | Valid HTML structure, >5000 chars   | Malformed or too small |
| brand_check            | Contains "CloudPulse" and "#2563EB" | Missing brand elements |

### Artifact Quality (0-10 points each, 30 total)

| Artifact    | 10 pts                                             | 5 pts                          | 0 pts          |
| ----------- | -------------------------------------------------- | ------------------------------ | -------------- |
| index.html  | Responsive, accessible, all sections, professional | Basic structure, some sections | Broken or stub |
| Design docs | Detailed, internally consistent, actionable        | Present but generic            | Missing        |
| QA report   | Specific findings with pass/fail per check         | Generic summary                | Missing        |

### SDLC Process Fidelity (30 points)

| Criterion                                         | Points |
| ------------------------------------------------- | ------ |
| Each phase clearly consumed output of prior phase | 10     |
| Review loop provided actionable feedback          | 10     |
| Gates blocked completion until quality met        | 10     |

**Total: 100 points**

- 90-100: Full SDLC executed with high quality
- 70-89: SDLC phases ran but some quality gaps
- 50-69: Partial execution, skipped phases or shallow output
- Below 50: Flow failed or produced minimal output

## Controls

Run alongside a **solo prompt** baseline for comparison:

```bash
claude -p --dangerously-skip-permissions "Build a production-quality marketing website for CloudPulse, a cloud monitoring SaaS. Create index.html with hero, features, pricing, testimonials, integrations, FAQ, and CTA sections. Use brand color #2563EB. Make it responsive and accessible."
```

Score both outputs with the same rubric (excluding SDLC Process Fidelity for solo).

## Success Criteria

The experiment succeeds if:

1. The flow completes without manual intervention (all phases advance)
2. All 3 gates pass on completion
3. Total score >= 70/100
4. The SDLC flow scores higher than the solo baseline on Artifact Quality
