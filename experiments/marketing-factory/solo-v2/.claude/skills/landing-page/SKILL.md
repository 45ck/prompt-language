# Skill: Landing Page Generation

## Trigger

When asked to build a landing page, marketing website, or product homepage.

## Process

Follow these steps in order. Do not skip any step.

### Step 1 — Analyze Requirements

- Read the project CLAUDE.md for brand, design, and SEO rules.
- Identify the target audience and primary conversion goal.
- List the required sections: navigation, hero, features, social proof, pricing, CTA, footer.
- Confirm the product name, tagline, and color palette.

### Step 2 — Set Up Design Tokens

Define all CSS custom properties at the top of the stylesheet:

```css
:root {
  /* Colors from CLAUDE.md */
  --color-primary: #2563EB;
  --color-secondary: #7C3AED;
  --color-accent: #10B981;
  --color-dark: #1E293B;
  --color-light: #F8FAFC;

  /* Typography */
  --font-stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --text-base: 1rem;
  --line-height: 1.6;

  /* Layout */
  --max-width: 1200px;
  --section-pad: 5rem;
  --radius: 0.5rem;
  --radius-lg: 1rem;
}
```

### Step 3 — Build Sections

Build each section as an independent `<section>` with a descriptive `id`. Required sections:

1. **Skip Link**: Hidden link to `#main-content` as the first element in `<body>`.
2. **Navigation** (`<header>`): Logo/product name, nav links, primary CTA button. Sticky on scroll via CSS. Must have `aria-label="Main navigation"` on the `<nav>`.
3. **Hero** (`<section id="hero">`): Gradient background. h1 with product name and value proposition. Subheading with tagline. Primary CTA button. Optional secondary CTA. Stats bar (3-4 metrics with numbers).
4. **Features** (`<section id="features">`): h2 section heading. Grid of 3-6 feature cards. Each card: SVG icon, h3 title, short description. Use CSS Grid (3 cols desktop, 1 col mobile).
5. **Social Proof** (`<section id="testimonials">`): h2 section heading. 3 testimonials with quote, person name, job title, and company. Use `<blockquote>` with `<cite>`.
6. **Pricing** (`<section id="pricing">`): h2 section heading. 2-3 tier cards. Each card: plan name, price, feature list with checkmarks, CTA button. Highlight the recommended plan.
7. **Final CTA** (`<section id="cta">`): Gradient or dark background. Compelling headline. Primary CTA button. Brief supporting text.
8. **Footer** (`<footer>`): Product name and tagline. Navigation links grouped by category. Copyright notice with current year.

### Step 4 — Assemble the Page

Combine all sections into a single `index.html` file:

- DOCTYPE, html with `lang="en"`, head with meta tags, inline styles, body with sections.
- All CSS in a single `<style>` tag in `<head>`.
- No external resources.
- Verify heading hierarchy: one h1 in hero, h2 per section, h3 for subsections.

### Step 5 — Validate

Run through the quality checklist from CLAUDE.md. Additionally:

- Check all SVG icons render correctly.
- Verify responsive layout at 320px, 768px, 1280px.
- Confirm all links have `href` attributes (use `#` for placeholder links).
- Ensure no duplicate `id` attributes.

### Post-Generation

After generating the landing page, run these checks:

- **SEO pass**: Follow the process in `.claude/skills/seo-pass/SKILL.md` to verify all SEO requirements.
- **Brand check**: Follow the process in `.claude/skills/brand-check/SKILL.md` to verify brand voice compliance.
- **Conversion audit**: Follow the process in `.claude/skills/conversion-audit/SKILL.md` to verify conversion optimization.

## Output

A single `index.html` file containing the complete landing page with inlined CSS and no external dependencies.
