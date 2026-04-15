# NightOwl Marketing Website — Release Notes v1.0

**Date:** 2026-04-15
**Build status:** PASS
**Lint status:** PASS (no warnings at build time)
**A11y status:** PASS with 2 non-blocking items for pre-launch

---

## Tech Stack

| Layer          | Choice                                                | Rationale                                                                       |
| -------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| Framework      | Next.js 16.2.3 (App Router)                           | Static export support, TypeScript first-class, zero-config Tailwind integration |
| CSS            | Tailwind CSS v4 + Custom Design Tokens                | Custom token system via CSS custom properties, utility classes for layout       |
| Language       | TypeScript (strict mode)                              | Type safety for component props, reduced runtime errors                         |
| Build output   | Static export (`output: 'export'`, `distDir: 'dist'`) | CDN-deployable HTML/CSS/JS, no server dependency                                |
| Font           | Inter (via next/font/google)                          | Self-hosted optimization, zero layout shift                                     |
| Hosting target | Vercel (primary), GitHub Pages / Netlify (compatible) | Zero-config deployment for Next.js static export                                |
| Linting        | ESLint with Next.js config                            | Enforces React and Next.js best practices                                       |

---

## Sections Implemented

| Section          | Component                 | Status                                                                   |
| ---------------- | ------------------------- | ------------------------------------------------------------------------ |
| Navigation       | `NavBar.tsx`              | Done — responsive, sticky, transparent-on-top                            |
| Hero             | `HeroSection.tsx`         | Done — headline, subheadline, dual CTAs, abstract dashboard visual       |
| Social proof bar | `ProofBar.tsx`            | Done — user count + publication names                                    |
| Features         | `FeaturesSection.tsx`     | Done — 5 feature cards with icon, headline, body, proof point            |
| How It Works     | `HowItWorksSection.tsx`   | Done — 3-step numbered flow with CTA                                     |
| Testimonials     | `TestimonialsSection.tsx` | Done — 4 persona-mapped quotes with star ratings                         |
| Pricing          | `PricingSection.tsx`      | Done — 3 tiers, annual/monthly toggle, privacy callout                   |
| Integrations     | `IntegrationsSection.tsx` | Done — 16 integrations in logo grid across 5 categories                  |
| FAQ              | `FAQSection.tsx`          | Done — 7 questions, accessible accordion (aria-expanded + aria-controls) |
| Footer CTA       | `CTAFooterSection.tsx`    | Done — final conversion section with dual CTAs                           |
| Footer           | `Footer.tsx`              | Done — 4-column nav, legal copy, social links, medical disclaimer        |

---

## Design System

**Color palette:** Deep navy backgrounds (#050b18 → #0a1628 → #0f2044), indigo accent (#4f6ef7), teal secondary (#2dd4bf), amber warm (#fbbf24)

**Typography:** Inter variable font, type scale from `--font-size-sm` (0.8125rem) to `--heading-display` (clamp 2.5rem → 4rem)

**Component patterns:**

- `.btn-primary` — indigo filled, pill shape, glow shadow on hover
- `.btn-secondary` — transparent with border, hover fills with indigo tint
- `.card` + `.card-hover` — surface-elevated background, border, lift on hover
- `.eyebrow` — uppercase label tag with indigo background
- `.gradient-text` — indigo → teal linear gradient on heading text

**Animations:**

- `fadeInUp` on hero elements (staggered with `animation-delay-*` classes)
- `card-hover` transform on feature/testimonial cards
- FAQ accordion slide via `max-height` transition
- `glow-orb` background decoration (blurred circles)

---

## Build Output

```
Route (app)
├ ○ /                  (static, pre-rendered)
└ ○ /_not-found        (static, pre-rendered)

Output: site/dist/index.html
```

---

## File Tree

```
site/
├── app/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── NavBar.tsx
│   │   │   └── Footer.tsx
│   │   └── sections/
│   │       ├── HeroSection.tsx
│   │       ├── ProofBar.tsx
│   │       ├── FeaturesSection.tsx
│   │       ├── HowItWorksSection.tsx
│   │       ├── TestimonialsSection.tsx
│   │       ├── PricingSection.tsx
│   │       ├── IntegrationsSection.tsx
│   │       ├── FAQSection.tsx
│   │       └── CTAFooterSection.tsx
│   ├── favicon.ico
│   ├── globals.css         (design tokens + utility classes)
│   ├── layout.tsx          (metadata, font loading, html structure)
│   └── page.tsx            (page assembly, skip nav link)
├── dist/                   (build output — static HTML/CSS/JS)
│   ├── index.html
│   ├── _next/              (JS chunks, CSS bundles)
│   └── ...
├── next.config.ts          (output: 'export', distDir: 'dist')
├── package.json
├── tsconfig.json
└── postcss.config.mjs

docs/
├── personas.md             (4 user personas)
├── competitor-analysis.md  (5 competitor profiles)
├── content-strategy.md     (messaging, tone, copy framework, SEO)
├── sitemap.md              (section order, IA, user flows)
├── arch-nextjs.md          (Next.js architecture proposal)
├── arch-astro.md           (Astro architecture proposal)
├── architecture-decision.md (ADR — Next.js chosen)
├── code-review.md          (code quality findings, 4 major / 13 minor)
├── security-review.md      (security audit — no vulnerabilities)
├── seo-audit.md            (SEO findings, pre-launch checklist)
├── a11y-audit.md           (WCAG 2.1 AA findings, pre-launch checklist)
├── acceptance-report.md    (acceptance criteria results)
└── release-notes.md        (this file)
```

---

## QA Findings Summary

### Build

- Status: PASS
- All TypeScript types resolved, no compilation errors
- Static export generates valid HTML at `dist/index.html`

### Accessibility (from a11y-audit.md)

- 9 of 11 WCAG 2.1 AA criteria: PASS
- `prefers-reduced-motion` media query: NEEDS IMPLEMENTATION (non-blocking)
- Custom `:focus-visible` styling: NEEDS IMPLEMENTATION (non-blocking, browser defaults present)

### SEO (from seo-audit.md)

- Title, meta description, OG tags: PASS
- Heading hierarchy, semantic HTML: PASS
- Schema.org JSON-LD: NEEDS IMPLEMENTATION (post-launch)
- og:image / twitter:image: NEEDS IMPLEMENTATION (requires brand asset)

### Code Review (from code-review.md)

- 4 major issues found, all resolved:
  - Dead components (CTABanner.tsx, SleepGraph.tsx) — **deleted**
  - Footer.tsx unnecessary "use client" — **refactored to server component**
- 13 minor issues documented (a11y gaps, hardcoded colors, array-index keys)

### Security

- No external JavaScript dependencies (custom design system, no CDN scripts)
- No exposed API keys, secrets, or environment variables
- `npm audit` clean (no known vulnerabilities in devDependencies)
- No dynamic user-generated content on marketing page (no XSS surface)

### Known Issues / Open Items

1. **og:image missing** — social share cards will use default browser rendering. Needs branded 1200x630 image before launch.
2. **`prefers-reduced-motion` not implemented** — animation is present for all users regardless of OS accessibility settings. Low severity, straightforward fix.
3. **No CMS / content management** — copy is hardcoded in TSX. For content team editing, consider extracting copy to JSON/MDX files or integrating a headless CMS (Sanity, Contentlayer) post-launch.
4. **Testimonials are representative** — four testimonials use persona-based names. Before launch, replace with consent-verified real user quotes.
5. **Pricing is placeholder** — prices and feature lists are representative. Actual pricing must be validated with business stakeholders before launch.

---

## Overall Readiness: SHIP_WITH_ISSUES

The site is production-quality for structure, accessibility, performance, and code quality. The five open items above are non-blocking for a soft launch but should be resolved before broad public launch.
