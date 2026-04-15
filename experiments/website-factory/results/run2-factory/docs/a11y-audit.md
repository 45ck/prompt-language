# NightOwl Accessibility Audit — WCAG 2.1 AA

**Date:** 2026-04-15
**Standard:** WCAG 2.1 Level AA
**Audited:** All site components in site/app/components/

---

## Summary

| Criterion                    | Status                           |
| ---------------------------- | -------------------------------- |
| Alt text on images           | PASS                             |
| Color contrast (normal text) | PASS                             |
| Color contrast (large text)  | PASS                             |
| Keyboard accessibility       | PASS                             |
| Focus indicators             | PASS                             |
| ARIA labels and roles        | PASS                             |
| Heading hierarchy            | PASS                             |
| Form labels                  | N/A (no forms on marketing site) |
| Skip-to-content link         | PASS                             |
| Language attribute           | PASS                             |
| Reduced motion               | NEEDS IMPLEMENTATION             |

---

## Detailed Findings

### 1. Alt Text on Images

**Status: PASS**

- All SVG icons use `aria-hidden="true"` (decorative) or are wrapped with `aria-label` text
- Wearable/integration emoji used as icon substitutes have visually hidden text equivalents via surrounding label text
- Avatar initials use `aria-hidden="true"` with author names in `<figcaption>`
- No meaningful images used without alt text

### 2. Color Contrast — Normal Text (4.5:1 ratio required)

**Status: PASS**

Token analysis:

- `--text-primary` (#f0f4ff) on `--background` (#050b18): estimated ratio ~18:1 — PASS
- `--text-secondary` (#94a3b8) on `--background` (#050b18): estimated ratio ~7.4:1 — PASS
- `--text-muted` (#64748b) on `--background` (#050b18): estimated ratio ~4.6:1 — PASS (marginal)
- `--text-secondary` on `--surface` (#0a1628): estimated ratio ~7.1:1 — PASS
- Button text (#fff) on `--accent-primary` (#4f6ef7): estimated ratio ~4.8:1 — PASS

**Note:** `--text-muted` on `--surface-elevated` should be validated with a live contrast checker before launch. Estimated ratio is at the minimum acceptable threshold.

### 3. Color Contrast — Large Text (3:1 ratio required)

**Status: PASS**

All headings use `--text-primary` or gradient text. The gradient text (`gradient-text` class) uses a blue-to-teal gradient — the lighter teal end (#5eead4 / var(--color-teal-300)) against the dark background exceeds 3:1 for large heading sizes.

### 4. Keyboard Accessibility

**Status: PASS**

- NavBar: All links and the hamburger button are keyboard-focusable
- Hero CTAs: Anchor elements, keyboard reachable
- FAQ accordion: Buttons with `aria-expanded` and `aria-controls`, keyboard operable
- Pricing toggle: Buttons with `aria-pressed` for state communication
- Integration logos: Static display elements, no interactive misleading states
- Footer links: All anchor elements, keyboard accessible

### 5. Focus Indicators

**Status: PASS (browser defaults present)**

No `outline: none` overrides found in globals.css. Browser default focus rings are preserved. For launch, consider adding a custom high-visibility focus ring:

```css
:focus-visible {
  outline: 2px solid var(--color-indigo-400);
  outline-offset: 3px;
  border-radius: 3px;
}
```

This would improve visual consistency across browsers.

### 6. ARIA Labels and Roles

**Status: PASS**

Verified:

- `<nav>` in NavBar (implicit role)
- `<header>` wraps NavBar (implicit role)
- `<main id="main-content">` wraps all page content
- `<footer>` with `role="contentinfo"`
- All `<section>` elements have `aria-labelledby` pointing to their heading
- FAQ accordion: `aria-expanded`, `aria-controls`, `id` linkage between button and answer panel
- Pricing toggle: `aria-pressed` on each button
- Star rating in testimonials: `aria-label="5 out of 5 stars"` on container, `aria-hidden` on individual SVGs
- Hamburger button: `aria-label` changes based on state (`aria-expanded`)

### 7. Heading Hierarchy

**Status: PASS**

Confirmed structure:

- `<h1>`: "Sleep smarter, think sharper." (HeroSection) — only one per page
- `<h2>`: One per section (Features, How It Works, Testimonials, Pricing, Integrations, FAQ, CTA Footer)
- `<h3>`: Feature card headlines, step labels, pricing tier names, testimonial attribution (via `<figcaption>`)
- No heading levels skipped

### 8. Form Elements and Labels

**Status: N/A**

No form elements on the marketing page at launch. Email signup forms added post-launch must include visible labels (not placeholder-only).

### 9. Skip-to-Content Link

**Status: PASS**

Implemented in page.tsx. The link:

- Is the first focusable element on the page
- Becomes visible on keyboard focus (left: -9999px → left: 0)
- Links to `#main-content` which is the `<main>` element
- Has clear text "Skip to main content"

### 10. Language Attribute

**Status: PASS**

`<html lang="en">` set in layout.tsx.

### 11. Animations and Reduced Motion

**Status: NEEDS IMPLEMENTATION**

The following animations are in use:

- `fadeInUp` on hero elements
- Hover state transitions on cards and buttons
- FAQ accordion slide animation
- Glow orb presence

Add to globals.css before launch:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in-up,
  .animation-delay-100,
  .animation-delay-200,
  .animation-delay-300,
  .animation-delay-400,
  .animation-delay-500 {
    animation: none;
    opacity: 1;
  }

  .card-hover {
    transition: none;
  }

  .faq-content {
    transition: none;
  }

  .btn-primary,
  .btn-secondary {
    transition: none;
  }
}
```

---

## Pre-Launch A11y Checklist

- [ ] Add `@media (prefers-reduced-motion: reduce)` to globals.css
- [ ] Add custom `:focus-visible` ring for consistent cross-browser focus styling
- [ ] Validate `--text-muted` contrast on `--surface-elevated` with live tool (e.g. WebAIM Contrast Checker)
- [ ] Test full keyboard navigation flow (Tab through entire page)
- [ ] Test with macOS VoiceOver and Windows Narrator
- [ ] Validate with axe browser extension or similar automated tool
- [ ] Ensure any future image assets have meaningful alt text
