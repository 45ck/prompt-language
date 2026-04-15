# E8 Website Factory — Run 1 Results

**Date**: 2026-04-15
**Brief**: NightOwl sleep tracking platform for knowledge workers

## Scorecard

| Check     |             Factory (Astro)             |             Solo (Next.js)             |
| --------- | :-------------------------------------: | :------------------------------------: |
| Build     |                  PASS                   |                  PASS                  |
| Lint      |    FAIL (no eslint config in Astro)     |      PASS (0 errors, 0 warnings)       |
| Structure | PASS (30 source, 9 components, 15 dirs) | PASS (14 source, 4 components, 4 dirs) |
| Content   |           PASS (8/8 sections)           |          PASS (8/8 sections)           |
| **Score** |                 **3/4**                 |                **4/4**                 |

## Architecture Decisions

| Dimension      | Factory                                     | Solo                    |
| -------------- | ------------------------------------------- | ----------------------- |
| Framework      | Astro (AI chose via race)                   | Next.js 16 (AI default) |
| CSS            | Tailwind CSS                                | Tailwind CSS v4         |
| TypeScript     | Yes                                         | Yes                     |
| Component arch | Astro components (icons/layout/sections/ui) | React TSX components    |
| Build output   | 110KB dist/ (static HTML)                   | Next.js SSR/prerendered |

## File Metrics

| Metric              | Factory        | Solo                 |
| ------------------- | -------------- | -------------------- |
| Source files        | 30             | 14                   |
| Component files     | 9 (named)      | 4 (named)            |
| Directories         | 15             | 4                    |
| Config files        | 2              | 5                    |
| CSS files           | 1 (global.css) | 1 (globals.css)      |
| HTML output size    | 69KB           | 81KB                 |
| CSS output size     | 30KB           | (bundled in JS)      |
| Total dist size     | 110KB          | N/A (Next.js .next/) |
| Documentation files | 12             | 0                    |

## Component Inventory

### Factory (26 Astro components)

**Icons (13)**: CheckIcon, ClockIcon, GitHubIcon, GoogleCalendarIcon, LinearIcon, LockIcon, MoonIcon, NightOwlLogo, NotionIcon, PhoneIcon, PulseIcon, SlackIcon, SunIcon, TeamIcon
**Layout (2)**: Nav, Footer
**Sections (8)**: Hero, Features, HowItWorks, SocialProof, Pricing, Integrations, Faq, CtaFooter
**UI (4)**: Badge, Button, Container, SectionHeading
**Layout template (1)**: Layout.astro

### Solo (10 React components)

Header, Hero, Features, HowItWorks, Testimonials, Pricing, Integrations, FAQ, CTA, Footer

## Documentation Artifacts (Factory only)

1. `docs/personas.md` — User persona research
2. `docs/competitor-analysis.md` — Competitor website analysis
3. `docs/content-strategy.md` — Messaging hierarchy and CTA strategy
4. `docs/sitemap.md` — Information architecture
5. `docs/arch-nextjs.md` — Next.js architecture proposal
6. `docs/arch-astro.md` — Astro architecture proposal
7. `docs/adr-nextjs.md` — Next.js ADR
8. `docs/adr-astro.md` — Astro ADR
9. `docs/architecture-decision.md` — Final architecture decision
10. `docs/code-review.md` — Code quality review
11. `docs/a11y-audit.md` — Accessibility audit
12. `docs/security-review.md` — Security review

## Hypothesis Results

| ID   | Hypothesis                              | Result         | Notes                                                        |
| ---- | --------------------------------------- | -------------- | ------------------------------------------------------------ |
| WF-1 | Factory builds pass more reliably       | TIE            | Both pass on first verification                              |
| WF-2 | Factory produces lint-clean code        | SOLO WINS      | Astro has no eslint by default; Next.js ships with it        |
| WF-3 | Factory produces better accessibility   | FACTORY LIKELY | Factory has a11y-audit.md; not measurable without Lighthouse |
| WF-4 | Factory produces all content sections   | TIE            | Both 8/8 sections                                            |
| WF-5 | Factory produces real project structure | FACTORY WINS   | 30 vs 14 files, 15 vs 4 dirs, proper component hierarchy     |

## Qualitative Observations

### Factory Strengths

- **Architecture exploration**: Actually raced two proposals (Astro vs Next.js) and chose based on reasoning
- **Component hierarchy**: Clean separation into icons/layout/sections/ui directories
- **Documentation trail**: 12 docs including personas, competitor analysis, ADRs, security review
- **Deliberate design system**: Separate Badge, Button, Container, SectionHeading components
- **Integration icons**: Created 13 custom SVG icon components for each integration partner

### Solo Strengths

- **Speed**: Completed much faster (estimated 3-5 min vs 10+ min for factory)
- **Lint compliance**: Shipped lint-clean because Next.js includes eslint out of the box
- **Simpler output**: Fewer moving parts, easier to understand
- **Default scaffolding**: Used create-next-app which provides proven defaults

### Neither Lane

- No Lighthouse scores (would need headless Chrome)
- No real a11y tool verification (pa11y/axe not installed)
- Content quality not objectively measured (no lorem ipsum detection run)

## Scientific Limitations

1. **N=1**: Single run per lane. No statistical significance.
2. **PL runtime not active**: Flow was interpreted by Claude from text, not executed by PL hook-driven runtime. Tests "structured prompt" not "PL orchestration."
3. **Uncontrolled token budget**: Factory likely consumed 5-10x more tokens.
4. **Lint gate unfair**: Factory's Astro choice lacked eslint; a Next.js factory would have passed.
5. **No blind evaluation**: Evaluator knows which is which.
