# E8 Website Factory — Run 1 Results

## Date: 2026-04-15

## Scorecard

| Check                                         | Factory (Astro) | Solo Run 1 (Next.js) | Solo Run 2 (Next.js) |
| --------------------------------------------- | :-------------: | :------------------: | :------------------: |
| Build passes                                  |      PASS       |         PASS         |         PASS         |
| Lint clean                                    |      FAIL       |         PASS         |         PASS         |
| Structure (>=5 src, >=3 components, >=3 dirs) |      PASS       |         PASS         |         PASS         |
| Content (>=6/8 sections)                      |   PASS (8/8)    |      PASS (8/8)      |      PASS (8/8)      |
| **Score**                                     |     **3/4**     |       **4/4**        |       **4/4**        |

## Detailed Metrics

### Factory (Astro)

- **Framework**: Astro (chose via race between Astro and Next.js)
- **Source files**: 30 (.astro components)
- **Component files**: 9 section/UI components + 10 icon components + layout/nav/footer
- **Directories**: 11
- **CSS files**: 1 (global.css with design tokens)
- **Config files**: 2 (astro.config.mjs, tsconfig.json)
- **Documentation**: 12 docs (personas, competitor analysis, content strategy, sitemap, 2 ADRs, architecture decision, code review, a11y audit, security review)
- **Build output**: 68KB index.html (single-page Astro static site)
- **Lint**: Failed (Astro files not covered by default ESLint config)

### Solo Run 1 (Next.js — shorter prompt)

- **Framework**: Next.js 16 + Tailwind v4
- **Source files**: 14
- **Component files**: 4 (matched by regex — Header, Hero, Features, Footer)
- **Directories**: 4
- **All 10 section components**: Header, Hero, Features, HowItWorks, Testimonials, Pricing, Integrations, FAQ, CTA, Footer

### Solo Run 2 (Next.js — information-equivalent prompt)

- **Framework**: Next.js 16 + Tailwind v4
- **Source files**: 14
- **Component files**: 4
- **Directories**: 4
- **All 12 section components**: Header, Hero, Features, HowItWorks, Testimonials, Pricing, Integrations, FAQ, CTA, Footer

## Key Observations

### What the factory produced differently

1. **Research artifacts** — 12 documentation files (personas, competitor analysis, content strategy, sitemap, ADRs, code/security/a11y reviews) that solo didn't produce
2. **Architecture decision process** — Raced two proposals (Astro vs Next.js), wrote ADRs for both, chose Astro based on marketing-site optimization criteria
3. **More components** — 30 source files vs 14, with dedicated icon components, layout primitives, and UI components (Badge, Button, SectionHeading)
4. **Organized directory structure** — `components/sections/`, `components/ui/`, `components/icons/`, `components/layout/` vs solo's flat `components/`
5. **QA artifacts** — Code review, accessibility audit, security review documents

### What solo did better

1. **Lint clean** — Next.js ships with eslint-config-next; Astro's default scaffold doesn't include ESLint, so factory failed lint
2. **Faster** — Solo completed in ~3 minutes vs factory's ~10+ minutes
3. **Simpler** — 14 files vs 30; less to maintain

### Confounding factors

1. **PL runtime was NOT active** — Both lanes used `claude -p`, so the flow was interpreted from text by Claude, not executed by the PL runtime. The factory didn't benefit from auto-advance, state persistence, or gate enforcement.
2. **Token budget** — Factory used significantly more tokens (multi-phase, documentation generation)
3. **Framework choice** — Factory chose Astro (smart for marketing), but Astro's default scaffold doesn't include ESLint, causing the lint failure
4. **Verification scripts** — File-count thresholds are too low; both pass trivially. Real differentiation would need Lighthouse, pa11y, or human evaluation.

## Hypotheses Status

| ID   | Hypothesis                              | Result                                            |
| ---- | --------------------------------------- | ------------------------------------------------- |
| WF-1 | Factory builds pass more reliably       | INCONCLUSIVE — both pass build                    |
| WF-2 | Factory produces lint-clean code        | REFUTED — factory failed lint (framework choice)  |
| WF-3 | Factory produces better accessibility   | UNVERIFIED — no Lighthouse/pa11y measurement      |
| WF-4 | Factory produces all required sections  | TIE — both 8/8                                    |
| WF-5 | Factory produces real project structure | CONFIRMED — 30 files, 11 dirs vs 14 files, 4 dirs |

## Next Steps

- Run with PL runtime active (via interactive Claude or `prompt-language ci` with proper hook registration)
- Add Lighthouse CI scoring to verification
- Fix Astro ESLint config in scaffold.flow
- Run 3+ times per lane for statistical significance
