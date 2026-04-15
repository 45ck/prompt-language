# CloudPulse Brand Guidelines

## Brand Overview

**Product Name:** CloudPulse
**Tagline:** Monitor smarter, respond faster.
**Category:** Cloud Monitoring SaaS Platform

CloudPulse provides real-time infrastructure monitoring, intelligent alerting, and actionable insights for engineering teams managing cloud-native applications.

---

## Voice and Tone

### Core Principles

1. **Confident, not arrogant** — Speak with authority about monitoring and observability without overpromising. Use data-backed claims.
2. **Clear, not simplistic** — Technical audience expects precision. Avoid jargon when plain language works, but do not dumb down concepts.
3. **Direct, not pushy** — State value propositions plainly. Let the product speak for itself.
4. **Human, not casual** — Professional warmth. Address the reader as a peer, not a subordinate.

### Writing Rules

- Use active voice: "CloudPulse detects anomalies" not "Anomalies are detected by CloudPulse."
- Avoid filler words: never use "very," "really," "just," "basically," "actually," "simply," "literally," "quite," or "rather."
- No exclamation marks in marketing copy.
- Use second person ("you/your") when addressing the reader.
- Use present tense for product capabilities.
- Keep sentences under 25 words when possible.
- All headings must use Title Case (capitalize all words except minor words: a, an, the, and, but, or, for, nor, in, on, at, to, by, of, with, is, it, as).

### Product Name Usage

- Always write as **CloudPulse** (one word, capital C, capital P).
- Never write as "Cloud Pulse," "cloud pulse," "CLOUDPULSE," or "Cloudpulse."
- Use the full name at least 3 times on any page.
- On subsequent mentions within a paragraph, "CloudPulse" or "the platform" are acceptable.

---

## Color Palette

### Primary Colors

| Role      | Hex     | Usage                                          |
| --------- | ------- | ---------------------------------------------- |
| Primary   | #2563EB | CTAs, primary buttons, links, key headings     |
| Secondary | #7C3AED | Accent sections, gradients, feature highlights |
| Accent    | #10B981 | Success states, positive metrics, badges       |
| Dark      | #1E293B | Body text, dark backgrounds, navigation        |
| Light     | #F8FAFC | Page background, card backgrounds, whitespace  |

### Color Usage Rules

- Use only the five brand colors plus neutral grays (equal or near-equal RGB channels).
- Primary blue (#2563EB) is the dominant action color. All primary CTAs use this color.
- Secondary purple (#7C3AED) is used sparingly for visual interest — gradients, section accents, or secondary badges.
- Accent green (#10B981) indicates success, uptime, or positive states.
- Dark (#1E293B) is the default text color and dark-mode background base.
- Light (#F8FAFC) is the default page background.
- Never introduce off-palette colors. All decorative elements derive from brand colors with opacity adjustments.
- Gradients may blend Primary and Secondary only.
- For lighter tints, use opacity or mix with Light (#F8FAFC) conceptually — do not create new hex values outside the palette.

---

## Typography

### Font Stack

Use system fonts for zero-dependency loading:

```
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

### Type Scale

| Element       | Size     | Weight | Line Height |
| ------------- | -------- | ------ | ----------- |
| H1 (Hero)     | 3rem     | 800    | 1.1         |
| H2 (Section)  | 2.25rem  | 700    | 1.2         |
| H3 (Card)     | 1.5rem   | 600    | 1.3         |
| H4 (Sub)      | 1.25rem  | 600    | 1.4         |
| Body          | 1.125rem | 400    | 1.7         |
| Small/Caption | 0.875rem | 400    | 1.5         |

### Typography Rules

- Body text uses Dark (#1E293B) on Light (#F8FAFC) backgrounds.
- Headings may use Dark (#1E293B) or Primary (#2563EB) for emphasis.
- Links use Primary (#2563EB) with underline on hover.
- Monospace code snippets use `"SF Mono", "Fira Code", "Fira Mono", Menlo, monospace`.

---

## Spacing and Layout

- Base spacing unit: 0.5rem (8px).
- Section padding: 5rem top/bottom on desktop, 3rem on mobile.
- Max content width: 1200px, centered.
- Card border-radius: 0.75rem.
- Button border-radius: 0.5rem.
- Use CSS custom properties (variables) for all colors, spacing, and radii.

---

## Component Patterns

### Buttons

- **Primary:** Background #2563EB, white text, 0.5rem radius, subtle shadow.
- **Secondary:** Transparent with #2563EB border and text.
- **Ghost:** Text-only in Dark, hover reveals underline.

### Cards

- White background, subtle shadow, 0.75rem radius.
- Consistent internal padding (1.5rem to 2rem).
- Optional top-border accent in Primary or Secondary color.

### Navigation

- Fixed/sticky top navigation with Dark (#1E293B) background.
- Logo on the left, nav links centered or right-aligned.
- White text links, Primary (#2563EB) on hover/active.
- Mobile: hamburger menu or collapsible nav.

### Footer

- Dark (#1E293B) background with muted text.
- Include social links: Twitter/X, LinkedIn, GitHub.
- Copyright and legal links.

---

## Imagery and Icons

- No `<img>` tags. Use CSS shapes, SVG inline, or Unicode/emoji for visual elements.
- Dashboard mockups may be represented with CSS grid layouts and colored blocks.
- Use SVG icons inline for social links and feature icons.
- Feature icons should be abstract and geometric, built with SVG paths.

---

## SEO and Accessibility

- Every page must include: `<!DOCTYPE html>`, `<html lang="en">`, viewport meta, meta description, Open Graph tags, canonical URL, JSON-LD structured data, and a favicon link.
- Exactly one `<h1>` per page.
- Heading hierarchy must be sequential (no skipping levels).
- All interactive elements must be keyboard-accessible.
- Color contrast must meet WCAG AA (4.5:1 for body text).
- Use semantic HTML elements: `<nav>`, `<main>`, `<footer>`, `<section>`, `<article>`.
- ARIA labels on icon-only links and buttons.
