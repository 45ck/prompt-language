# E8 Website Factory — Results

## Date: 2026-04-15

## Scorecard

| Check                                         | Factory R1 (Astro) | Solo R1 (Next.js) | Solo R2 (Next.js) |
| --------------------------------------------- | :----------------: | :---------------: | :---------------: |
| Build passes                                  |        PASS        |       PASS        |       PASS        |
| Lint clean                                    |        FAIL        |       PASS        |       PASS        |
| Structure (>=5 src, >=3 components, >=3 dirs) |        PASS        |       PASS        |       PASS        |
| Content (>=6/8 sections)                      |     PASS (8/8)     |    PASS (8/8)     |    PASS (8/8)     |
| **Score**                                     |      **3/4**       |      **4/4**      |      **4/4**      |

## Run Log

| Run | Lane    | Runner                          | Duration | Result | Notes                            |
| --- | ------- | ------------------------------- | -------- | ------ | -------------------------------- |
| R1  | Factory | `claude -p` (raw)               | ~12 min  | 3/4    | Full completion, Astro, 30 files |
| R1  | Solo    | `claude -p` (short prompt)      | ~3 min   | 4/4    | Next.js, 14 files                |
| R2  | Solo    | `claude -p` (info-equiv prompt) | ~3 min   | 4/4    | Next.js, 14 files                |
| R2  | Factory | `prompt-language ci`            | TIMEOUT  | N/A    | 10-min limit hit at Phase 3      |

## Detailed Metrics

### Factory R1 (Astro) — Best Factory Run

- **Framework**: Astro (chose via race between Astro and Next.js)
- **Source files**: 30 (.astro components)
- **Component files**: 9 section/UI components + 10 icon components + layout/nav/footer
- **Directories**: 11 (sections/, ui/, icons/, layout/ subdirs)
- **CSS files**: 1 (global.css with design tokens)
- **Config files**: 2 (astro.config.mjs, tsconfig.json)
- **Documentation**: 12 files
  - Discovery: personas.md, competitor-analysis.md, content-strategy.md, sitemap.md
  - Architecture: arch-nextjs.md, arch-astro.md, adr-nextjs.md, adr-astro.md, architecture-decision.md
  - QA: code-review.md, a11y-audit.md, security-review.md
- **Build output**: 68KB index.html (single-page Astro static site)
- **Lint**: Failed (Astro's default scaffold doesn't include ESLint)
- **All 8 sections**: Hero, Features, HowItWorks, SocialProof, Pricing, Integrations, Faq, CtaFooter

### Solo R1 + R2 (Next.js)

- **Framework**: Next.js 16 + Tailwind v4 (both runs)
- **Source files**: 14 (both runs)
- **Component files**: 10 (Header, Hero, Features, HowItWorks, Testimonials, Pricing, Integrations, FAQ, CTA, Footer)
- **Directories**: 4
- **Documentation**: 0
- **Build + Lint**: Both pass clean

## Key Observations

### What the factory produced that solo didn't

1. **12 research/design documents** — personas, competitor analysis, content strategy, sitemap, architecture decision records, code review, a11y audit, security review
2. **Architecture decision process** — Raced two tech stack proposals (Astro vs Next.js), evaluated against criteria, chose Astro for marketing site optimization, wrote ADRs for both options
3. **2x more components** — 30 source files vs 14, including dedicated icon components, layout primitives (Layout.astro), and UI components (Badge, Button, SectionHeading)
4. **Organized component hierarchy** — `components/sections/`, `components/ui/`, `components/icons/`, `components/layout/` vs solo's flat `components/`
5. **Design system with explicit tokens** — global.css with CSS custom properties, not just Tailwind defaults
6. **QA trail** — Code review, accessibility audit, and security review documents

### What solo did better

1. **Lint clean** — Next.js ships with eslint-config-next; Astro doesn't include ESLint by default
2. **4x faster** — ~3 minutes vs ~12 minutes
3. **Simpler** — 14 files vs 30; less surface area

### PL Runtime Status

**The PL runtime hooks did NOT activate in any factory run.** No `.prompt-language/session-state.json` was created. Claude interpreted the flow text as structured instructions and followed it faithfully (creating docs in order, racing architecture proposals, building components by section), but without the runtime's auto-advance, state persistence, or gate enforcement.

This means:

- The factory's structured prompt alone (without PL runtime) was enough to produce a qualitatively different output (research docs, architecture decisions, organized components)
- The runtime's value-add (gate enforcement, retry loops, state persistence across compaction) was NOT tested
- A true PL runtime test would require hooks firing in `claude -p` mode, which needs investigation

### Confounding Factors

1. **No PL runtime** — Flow text was interpreted as prompt instructions, not executed by PL state machine
2. **Token budget** — Factory used ~4x more tokens (multi-phase, documentation generation)
3. **Framework choice** — Astro is objectively better for marketing sites but lacks ESLint by default
4. **Verification bar too low** — File-count thresholds are trivially passed by both lanes

## Hypotheses Status

| ID   | Hypothesis                              | Result                                                            |
| ---- | --------------------------------------- | ----------------------------------------------------------------- |
| WF-1 | Factory builds pass more reliably       | INCONCLUSIVE — both pass build                                    |
| WF-2 | Factory produces lint-clean code        | REFUTED — factory's framework choice (Astro) lacks default ESLint |
| WF-3 | Factory produces better accessibility   | UNVERIFIED — no Lighthouse/pa11y measurement                      |
| WF-4 | Factory produces all required sections  | TIE — both 8/8                                                    |
| WF-5 | Factory produces real project structure | CONFIRMED — 30 files, 11 dirs vs 14 files, 4 dirs                 |

## What This Demonstrates

Despite the PL runtime not being active, this experiment still shows:

1. **Structured prompts produce qualitatively different output** — The factory flow's phased structure (discovery → architecture → design → implementation → QA) caused Claude to produce research artifacts, architecture decisions, and QA reviews that an unstructured prompt doesn't elicit
2. **Process structure != PL runtime** — A well-structured prompt alone gets you most of the organizational benefits; the PL runtime adds enforcement (gates), persistence (state), and automation (auto-advance)
3. **Framework-agnostic decision-making works** — The race pattern successfully caused Claude to evaluate two options and choose based on requirements (Astro won for marketing site optimization)
4. **More structure = more tokens = more time** — The factory costs ~4x more in time and tokens

## Next Steps

- Investigate why PL plugin hooks don't fire in `claude -p` subprocesses
- Increase CI runner timeout (>10 min for complex flows)
- Add ESLint to Astro scaffold in scaffold.flow
- Add Lighthouse CI scoring to verification scripts
- Run 3+ times per lane for statistical significance
- Test with PL runtime active (interactive mode or hook fix)
