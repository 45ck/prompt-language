# CloudPulse Marketing Website — Project Rules

## Product

- **Name**: CloudPulse (always written as one word, capital C and P)
- **Tagline**: "Monitor smarter, respond faster."
- **Category**: Cloud monitoring SaaS platform
- **Value prop**: Real-time infrastructure monitoring with intelligent alerting and automated incident response

## Brand Colors

Use CSS custom properties exclusively. Never hard-code hex values in component styles.

```
--color-primary: #2563EB;      /* Blue — buttons, links, primary actions */
--color-secondary: #7C3AED;    /* Purple — accents, gradients, highlights */
--color-accent: #10B981;       /* Green — success states, checkmarks, positive signals */
--color-dark: #1E293B;         /* Slate — text, backgrounds, dark sections */
--color-light: #F8FAFC;        /* Off-white — page background, light sections */
```

## Brand Voice

- Professional and confident. Never casual, never salesy.
- No filler words: "just", "really", "very", "actually", "basically", "simply", "obviously", "clearly", "literally".
- No exclamation marks. Period.
- Sentences must be under 20 words each.
- CTAs use action verbs: "Start", "Deploy", "Monitor", "Get", "Try", "Explore", "See". Never "Click here" or "Learn more".
- Headings use Title Case (capitalize first letter of each major word).
- Use "you/your" to address the reader. Avoid "we/our" except in testimonials.
- Numbers over 999 use commas: 1,000 not 1000.
- Use active voice. Never passive.

## Design System

### Typography

- Headings: system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Body: same stack, 16px base, 1.6 line-height
- h1: 3rem, font-weight 800
- h2: 2.25rem, font-weight 700
- h3: 1.5rem, font-weight 600

### Layout

- Max content width: 1200px, centered with auto margins
- Section padding: 5rem top/bottom, 1.5rem left/right
- Grid: CSS Grid for feature cards (3 columns desktop, 1 column mobile)
- Spacing scale: 0.25rem, 0.5rem, 1rem, 1.5rem, 2rem, 3rem, 4rem, 5rem

### Responsive Breakpoints

```
--bp-mobile: 480px;
--bp-tablet: 768px;
--bp-desktop: 1024px;
--bp-wide: 1280px;
```

Use mobile-first: base styles for mobile, `min-width` media queries for larger.

### Component Patterns

- **Buttons**: `padding: 0.75rem 2rem`, `border-radius: 0.5rem`, `font-weight: 600`, `transition: all 0.2s`
  - Primary: `background: var(--color-primary)`, white text
  - Secondary: `border: 2px solid var(--color-primary)`, transparent background
- **Cards**: `border-radius: 1rem`, `padding: 2rem`, subtle `box-shadow: 0 1px 3px rgba(0,0,0,0.1)`
- **Sections**: alternate between `var(--color-light)` and white backgrounds
- **Gradients**: hero background uses `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`

### Visual Elements

- No `<img>` tags. Use inline SVG or CSS shapes for all visual elements.
- Icons: inline SVG, 24x24 default size, `currentColor` for fill.
- Decorative elements: CSS pseudo-elements, gradients, or SVG patterns.

## SEO Requirements

Every page must include:

- `<title>` tag: product name + page purpose + tagline (under 60 chars)
- `<meta name="description">`: 150-160 chars summarizing the page
- Open Graph tags: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`
- Twitter card: `twitter:card`, `twitter:title`, `twitter:description`
- Canonical URL: `<link rel="canonical">`
- JSON-LD `Organization` schema with name, url, logo
- JSON-LD `WebSite` schema with search action
- JSON-LD `Product` schema with offers if pricing is shown
- Heading hierarchy: exactly one `<h1>`, `<h2>` for sections, `<h3>` for subsections. Never skip levels.
- All links have descriptive text. No "click here".

## Accessibility Requirements

- `lang="en"` on `<html>`
- All interactive elements have visible focus styles (outline, not just color change)
- ARIA labels on navigation (`aria-label="Main navigation"`), buttons without visible text, and icon-only elements
- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
- Heading order: h1 > h2 > h3, never skip
- Color contrast: all text meets WCAG AA (4.5:1 for normal, 3:1 for large)
- Skip-to-content link as first focusable element
- `role="list"` on feature/pricing card containers if using divs
- Form inputs have associated `<label>` elements

## Performance Constraints

- Zero external dependencies. No CDN links, no Google Fonts, no external scripts.
- All CSS must be inlined in a `<style>` tag in `<head>`.
- No JavaScript unless strictly required for interaction. Prefer CSS-only solutions.
- No `<img>` tags. All visuals via SVG or CSS.
- Total HTML file size should be under 50KB.

## Quality Checklist

Before delivering, verify:

1. HTML validates (no unclosed tags, no duplicate IDs)
2. Exactly one `<h1>` tag
3. Heading hierarchy is sequential (no skipped levels)
4. All brand colors use CSS custom properties
5. "CloudPulse" is spelled correctly everywhere (one word, capital C and P)
6. No filler words from the banned list
7. No exclamation marks in any copy
8. All sentences under 20 words
9. All CTAs use approved action verbs
10. Meta description is 150-160 characters
11. JSON-LD schema is valid
12. Skip-to-content link is present
13. Navigation has `aria-label`
14. All sections use semantic HTML
15. Responsive: readable at 320px, 768px, and 1280px
16. No external resource requests
