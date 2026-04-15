# NightOwl — Code Review

**Reviewer:** Quality reviewer agent (independent pass)
**Date:** 2026-04-15
**Scope:** `site/app/` — all component and page files read directly from source
**Files reviewed:**

- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `app/components/layout/NavBar.tsx`
- `app/components/layout/Footer.tsx`
- `app/components/sections/HeroSection.tsx`
- `app/components/sections/ProofBar.tsx`
- `app/components/sections/FeaturesSection.tsx`
- `app/components/sections/HowItWorksSection.tsx`
- `app/components/sections/TestimonialsSection.tsx`
- `app/components/sections/PricingSection.tsx`
- `app/components/sections/IntegrationsSection.tsx`
- `app/components/sections/FAQSection.tsx`
- `app/components/sections/CTABanner.tsx`
- `app/components/sections/CTAFooterSection.tsx`
- `app/components/SleepGraph.tsx`

---

## Executive Summary

The codebase is well-structured and production-appropriate for a marketing landing page. The design system is consistently applied. Accessibility and semantic HTML are above average for a generated site. The main issues are: two dead components never imported by `page.tsx`, duplicate copy between two CTA sections, a pattern of inline event handlers for hover states that should be CSS, and a handful of ARIA misapplications. There are no security issues. No critical issues block shipping.

---

## Issues Found

### Critical

None.

---

### Major

**MAJOR-01: Two components are dead code — never imported or rendered**

- `app/components/sections/CTABanner.tsx` — defined but not imported in `page.tsx`. The page imports `CTAFooterSection` instead. `CTABanner.tsx` is a full duplicate CTA section that ships in the bundle but is unreachable.
- `app/components/SleepGraph.tsx` — a fully implemented SVG sleep architecture visualization component that is never imported anywhere. It is more detailed than the inline mock dashboard in `HeroSection.tsx` and was presumably meant to replace it.

**Impact:** Dead code inflates the bundle (minor at static export time), creates confusion about which CTA section is canonical, and wastes the more polished `SleepGraph` visualization that nobody will ever see.

**Fix:** Either import and use these components, or delete them.

---

**MAJOR-02: Duplicate headline and copy between CTABanner and CTAFooterSection**

Both `CTABanner.tsx` (dead) and `CTAFooterSection.tsx` (live) render the identical headline and body copy:

> "Your data is already there. Start reading it."
> "14 days free. No card. Cancel any time. Your sleep data, finally connected to the work that matters."

The button labels also duplicate: "Start tracking free" and "Talk to our team".

`CTABanner.tsx` additionally renders a stats row (12,000+ / 20+ / 14 days) that `CTAFooterSection.tsx` omits. If `CTABanner` were ever re-introduced, the copy duplication would need to be resolved. As-is, the duplication is inert but signals the two files diverged from a shared copy-paste rather than a shared data source.

**Fix:** Delete `CTABanner.tsx`. If both sections are ever needed, extract the shared copy to a constants file.

---

**MAJOR-03: Inline `onMouseEnter`/`onMouseLeave` handlers for hover color changes in Footer**

`Footer.tsx` uses JavaScript event handlers to manually toggle `style.color` on hover for social links and footer nav links:

```tsx
onMouseEnter={(e) =>
  ((e.target as HTMLAnchorElement).style.color = "var(--text-primary)")
}
onMouseLeave={(e) =>
  ((e.target as HTMLAnchorElement).style.color = "var(--text-muted)")
}
```

This pattern has multiple problems:

1. It requires `"use client"` on the entire `Footer` component, which is otherwise pure static markup. This forces the footer to be client-rendered unnecessarily.
2. It does not work when keyboard focus triggers hover-intent. A user tabbing through footer links gets no visual feedback.
3. `e.target` is brittle — if the anchor contains a child element (e.g. an icon), `e.target` will be the child, not the anchor, and the cast to `HTMLAnchorElement` silently fails.
4. The `.nav-link` CSS class in `globals.css` already defines `:hover` styling correctly using pure CSS for the navbar links. The same pattern should be used in the footer.

**Fix:** Add a footer-specific CSS class (e.g. `.footer-link`) with `:hover` and `:focus-visible` states. Remove `"use client"` from `Footer.tsx`.

---

**MAJOR-04: `"use client"` on Footer is unnecessary**

Directly caused by MAJOR-03. `Footer.tsx` has no state, no effects, no browser APIs, and no event handlers that require client-side React. The only reason it is marked `"use client"` is the inline `onMouseEnter`/`onMouseLeave` handlers. In Next.js App Router, server components are the default and should be preferred for static markup. Making `Footer` a server component eliminates JavaScript hydration overhead for the entire footer subtree.

**Fix:** Remove the inline hover handlers (see MAJOR-03) and remove the `"use client"` directive.

---

### Minor

**MINOR-01: Array index used as React `key` throughout**

Multiple components use the array index as the `key` prop: `HeroSection` (sleep bar chart), `FeaturesSection`, `HowItWorksSection`, `TestimonialsSection`, `FAQSection`, `SleepGraph` (stage labels). For static, never-reordered data this does not cause runtime bugs, but it is a lint warning in strict mode and is a bad habit that can cause subtle bugs if data ever becomes dynamic.

**Fix:** Use a stable identifier as the key (e.g. `feature.headline`, `faq.question`, `step.number`). The data arrays already contain suitable unique string fields.

---

**MINOR-02: Hardcoded hex colors in SleepGraph and HeroSection**

`SleepGraph.tsx` uses hardcoded hex values in SVG gradient stops (`#4f6ef7`, `#2dd4bf`, `#fbbf24`) instead of CSS custom properties. The same colors are defined as `--color-indigo-500`, `--color-teal-400`, and `--color-amber-400` in `globals.css`.

`HeroSection.tsx` also uses hardcoded hex/rgba values for bar chart elements (e.g. `rgba(79,110,247,0.45)`, `rgba(79,110,247,0.2)`) rather than the design token.

SVG `fill`/`stroke` attributes cannot directly reference CSS custom properties in some older browsers, but `currentColor` and CSS variables in inline styles work in all modern browsers. This inconsistency means a future brand color change must be made in two places.

**Fix:** Use inline style referencing the CSS variable where possible. For SVG gradient stops, document the duplication with a comment cross-referencing `globals.css`.

---

**MINOR-03: `role="listitem"` without a matching `role="list"` parent in IntegrationsSection**

`IntegrationsSection.tsx` applies `role="listitem"` to each integration card `<div>`, but the parent container `<div>` does not have `role="list"`. Per ARIA specification, `listitem` elements must be owned by a `list` or `group` role. Assistive technologies may ignore or mis-announce these elements.

```tsx
// Current — incorrect
<div style={{ display: "grid", ... }}>
  <div key={integration.name} className="integration-logo" role="listitem">
```

**Fix:** Either add `role="list"` to the grid container, or replace the pattern with a semantic `<ul>/<li>` structure (preferred), removing the explicit `role` attributes entirely.

---

**MINOR-04: `aria-label` on a non-interactive `<div>` in PricingSection**

The "Most popular" badge in `PricingSection.tsx` uses `aria-label` on a plain `<div>`:

```tsx
<div aria-label="Most popular plan" ...>
  Most popular
</div>
```

`aria-label` on a `<div>` with no role is not well-supported and may be ignored by screen readers. The visible text "Most popular" is already readable, making the `aria-label` redundant. If additional context is needed, use `aria-describedby` on the card container pointing to this element, or simply rely on the visible text.

**Fix:** Remove the `aria-label` attribute. The visible label is sufficient. Alternatively, add `role="status"` or `role="note"` to give the element an implicit ARIA role that allows `aria-label` to be meaningful.

---

**MINOR-05: `<dd>` uses `aria-labelledby` incorrectly in FAQSection**

In the FAQ accordion, the `<dd>` (answer) element uses `aria-labelledby` pointing to the `<dt>` button's `id`:

```tsx
<dd
  id={`faq-answer-${i}`}
  aria-labelledby={`faq-question-${i}`}
  ...
>
```

`aria-labelledby` gives the element an accessible name. A `<dd>` element in a `<dl>` already has an implicit structural association with its `<dt>`. The `aria-controls` on the button already links trigger to panel. Using `aria-labelledby` here is redundant at best and may confuse some screen readers into double-announcing the question text when the user navigates to the answer. The `aria-controls`/`aria-expanded` pattern on the button is correct and sufficient.

**Fix:** Remove `aria-labelledby` from the `<dd>` elements.

---

**MINOR-06: Missing `focus-visible` styles on buttons and links**

`globals.css` defines `:hover` styles for `.btn-primary`, `.btn-secondary`, `.nav-link`, and `.faq-trigger`, but defines no `:focus-visible` styles for any of them. Keyboard-only users navigating with Tab will see no focus indicator on these interactive elements, which fails WCAG 2.1 SC 2.4.7 (Focus Visible).

The browser's default focus outline is typically suppressed by CSS resets and by the `outline: none` commonly set on buttons. Whether the default is overridden here depends on the Tailwind base reset, but no explicit `:focus-visible` ring is defined anywhere in `globals.css`.

**Fix:** Add `:focus-visible` ring styles to all interactive components. Example:

```css
.btn-primary:focus-visible,
.btn-secondary:focus-visible {
  outline: 2px solid var(--color-indigo-400);
  outline-offset: 3px;
}
```

---

**MINOR-07: `<section aria-label="Hero">` is redundant given the heading structure**

`HeroSection.tsx` applies `aria-label="Hero"` to the section. This label will be announced by screen readers as "Hero region" when navigating landmarks. A more meaningful label that describes the section's purpose would be preferred (e.g. "Introduction" or "Product overview"). Alternatively, since the section contains an `<h1>`, `aria-labelledby` pointing to the `<h1>` id would produce a more descriptive landmark name automatically derived from the page's primary heading.

**Fix:** Either remove `aria-label` (the `<h1>` implicitly anchors the hero region in the document outline), or use `aria-labelledby="hero-heading"` and add `id="hero-heading"` to the `<h1>`.

---

**MINOR-08: `<header>` element lacks `role="banner"` equivalent skip-link target**

`page.tsx` correctly provides `<main id="main-content">` which is a good skip-link target anchor. However, there is no skip-to-main-content link in the DOM. Screen reader and keyboard-only users must tab through the entire NavBar (logo + 4 nav links + 2 CTA links) on every page load before reaching any main content. For a single-page app this is less critical, but it is a WCAG 2.4.1 requirement.

**Fix:** Add a visually hidden skip link as the first focusable element in `layout.tsx`:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

Add the corresponding Tailwind `sr-only` / `focus:not-sr-only` utilities, or define equivalent CSS.

---

**MINOR-09: `CTAFooterSection` has no section `id` attribute**

`CTAFooterSection.tsx` does not define an `id` on the `<section>` element. All other sections (`#hero`, `#features`, `#how-it-works`, `#testimonials`, `#pricing`, `#integrations`, `#faq`) have IDs that allow anchor navigation. The footer CTA section is not linkable, which is inconsistent. It is not in the NavBar links so this has no functional impact, but it is an inconsistency.

**Fix:** Add `id="cta"` to the section element.

---

**MINOR-10: ProofBar `aria-hidden` divider removes semantic content from the accessibility tree**

The vertical divider `<div aria-hidden="true" ...>` in `ProofBar.tsx` is a pure decorative separator, so `aria-hidden` is correct. This is not a bug — it is noted here as a confirmation that the usage is appropriate.

---

**MINOR-11: `<figure>/<figcaption>` used without a meaningful caption relationship in TestimonialsSection**

Testimonial cards use `<figure>/<figcaption>`. This is semantically valid but unconventional — `<figure>` is typically used for images, diagrams, or code listings. The more conventional pattern for testimonial quotes is `<blockquote>` with a `<cite>` element for attribution. The current markup wraps the `<blockquote>` inside a `<figure>`, which is acceptable per HTML spec but some screen readers may announce "Figure" unnecessarily before reading the quote content.

**Fix:** Low priority. The markup is not wrong. If reducing screen reader verbosity is desired, restructure as `<article>` with `<blockquote>` and `<footer>/<cite>` for attribution (standard testimonial pattern).

---

**MINOR-12: Team plan pricing does not change between monthly and annual toggle**

`PricingSection.tsx` sets both `monthly` and `annual` values to `"$8/seat/mo"` for the Team tier. This means the annual toggle has no effect on the Team tier price display, which may confuse users expecting a discount. The Pro tier correctly shows `"$12/mo"` monthly vs `"$96/yr"` annually.

```tsx
price: { monthly: "$8/seat/mo", annual: "$8/seat/mo" },
```

**Fix:** Either define a distinct annual price for the Team tier, or display a note like "Contact for annual pricing" when the annual toggle is active.

---

**MINOR-13: Unused CSS classes in `globals.css`**

The following CSS classes are defined but never referenced in any component:

- `.gradient-text-warm` — defined but not applied to any JSX
- `.section-divider` — defined but not used
- `.noise-overlay` — defined but not used (HeroSection has a comment mentioning it but does not apply the class)
- `@keyframes twinkle` — defined but not referenced by any animation
- `.reveal` / `.reveal.visible` — defined for a scroll-reveal pattern but no component applies this class; the scroll observer is also not wired up anywhere

These increase the CSS bundle size marginally and create confusion about whether planned features are half-implemented.

**Fix:** Remove unused CSS rules, or add a comment marking them as reserved for a future feature.

---

**MINOR-14: `preserveAspectRatio="none"` on SVGs in SleepGraph distorts on narrow viewports**

`SleepGraph.tsx` sets `preserveAspectRatio="none"` on both SVG charts. On very narrow screens (< 300px), this causes the waveform lines to appear flattened horizontally and excessively tall, distorting the data visualization. This is intentional for responsive stretching, but it can produce visually broken output at extreme breakpoints.

**Fix:** Either set a `min-width` on the SleepGraph container, or use `preserveAspectRatio="xMidYMid meet"` with a scrollable overflow container at small widths.

---

## What Is Done Well

**Design system cohesion.** All colors are defined as CSS custom properties in `globals.css` and consistently referenced via `var(--token-name)` throughout the components. There is no scattered hardcoded hex in the JSX layer (outside of the SVG gradient stops noted in MINOR-02). The token naming is clear and semantic: `--text-primary`, `--text-secondary`, `--text-muted`, `--surface`, `--surface-elevated`.

**Correct `"use client"` discipline.** `"use client"` is applied only to components that genuinely require browser APIs or React state: `NavBar` (scroll event + menu toggle), `PricingSection` (billing toggle state), `FAQSection` (accordion open state). All other components are implicit server components. `Footer.tsx` is the only misapplication (see MAJOR-04).

**Semantic HTML structure.** The page uses `<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`, `<article>`, `<figure>`, `<blockquote>`, `<figcaption>`, `<dl>`, `<dt>`, `<dd>` all correctly. Sections that warrant landmark labels use `aria-labelledby` pointing to a heading `id` — this is the correct pattern. The heading hierarchy (`h1` in hero, `h2` in all sections, `h3` in feature/step cards) is correct and linear.

**Mobile navigation accessibility.** The hamburger button in `NavBar` correctly uses `aria-expanded` and a dynamic `aria-label` that changes between "Open menu" and "Close menu". Decorative hamburger bars are rendered with `aria-hidden="true"` spans. The mobile menu closes on link click (`onClick={() => setMenuOpen(false)}`), which is the expected behavior.

**Scroll event efficiency.** `NavBar` attaches the scroll listener with `{ passive: true }`, which is the correct flag for scroll handlers that do not call `preventDefault`. The event listener is properly cleaned up in the `useEffect` return.

**SEO metadata.** `layout.tsx` includes a well-formed `<Metadata>` export with title, description, keyword array, Open Graph properties (including `type: "website"` and a canonical URL), and Twitter card. This is complete for a marketing landing page.

**Decorative content properly hidden.** Glow orbs, emoji icons, hamburger bar spans, star SVGs, and inline data visualizations that are purely decorative all carry `aria-hidden="true"`. This is correctly applied throughout.

**FAQ accordion pattern.** The accordion in `FAQSection` uses `<dl>/<dt>/<dd>` (correct semantic structure for Q&A pairs), `aria-expanded` on the trigger button, `aria-controls` linking the button to the answer panel, and a matching `id` on the panel. This is the recommended ARIA accordion pattern.

**Privacy copy is prominent and specific.** The footer disclaimer ("Individual sleep data is never shared with employers or insurers"), the FAQ answers, and the pricing section privacy note all address the product's highest user concern proactively. This is well-executed content strategy.

**No external scripts or tracking.** No analytics, ad tags, chat widgets, or third-party JavaScript is loaded. No external font CDN requests (Inter is loaded via `next/font/google` which self-hosts). This is both a security and performance positive.

---

## Issue Summary Table

| ID       | Severity | Location                                | Title                                                         |
| -------- | -------- | --------------------------------------- | ------------------------------------------------------------- |
| MAJOR-01 | Major    | `CTABanner.tsx`, `SleepGraph.tsx`       | Dead components never imported                                |
| MAJOR-02 | Major    | `CTABanner.tsx`, `CTAFooterSection.tsx` | Duplicate CTA headline and body copy                          |
| MAJOR-03 | Major    | `Footer.tsx`                            | Inline hover handlers should be CSS                           |
| MAJOR-04 | Major    | `Footer.tsx`                            | Unnecessary `"use client"` directive                          |
| MINOR-01 | Minor    | Multiple components                     | Array index used as React `key`                               |
| MINOR-02 | Minor    | `SleepGraph.tsx`, `HeroSection.tsx`     | Hardcoded hex colors bypass design tokens                     |
| MINOR-03 | Minor    | `IntegrationsSection.tsx`               | `role="listitem"` without `role="list"` parent                |
| MINOR-04 | Minor    | `PricingSection.tsx`                    | `aria-label` on non-interactive div                           |
| MINOR-05 | Minor    | `FAQSection.tsx`                        | `aria-labelledby` misused on `<dd>`                           |
| MINOR-06 | Minor    | `globals.css`                           | No `:focus-visible` styles on interactive elements            |
| MINOR-07 | Minor    | `HeroSection.tsx`                       | `aria-label="Hero"` is a poor landmark name                   |
| MINOR-08 | Minor    | `layout.tsx`                            | No skip-to-main-content link                                  |
| MINOR-09 | Minor    | `CTAFooterSection.tsx`                  | Missing section `id` attribute                                |
| MINOR-10 | Info     | `ProofBar.tsx`                          | Decorative divider correctly `aria-hidden` (no action needed) |
| MINOR-11 | Minor    | `TestimonialsSection.tsx`               | `<figure>` used for testimonials (unconventional)             |
| MINOR-12 | Minor    | `PricingSection.tsx`                    | Team tier price identical for monthly and annual              |
| MINOR-13 | Minor    | `globals.css`                           | Unused CSS classes (.noise-overlay, .reveal, etc.)            |
| MINOR-14 | Minor    | `SleepGraph.tsx`                        | `preserveAspectRatio="none"` distorts on narrow viewports     |

---

## Recommendation

**SHIP with minor fixes.** No critical issues. The four Major issues should be resolved before launch because they involve dead code (MAJOR-01/02) and an accessibility regression caused by an unnecessary `"use client"` directive (MAJOR-03/04). The Minor issues are all straightforward to address and can be batched into a single cleanup pass. Priority order: MINOR-06 (focus visibility) and MINOR-08 (skip link) have the highest accessibility impact and should be addressed alongside the Major items.
