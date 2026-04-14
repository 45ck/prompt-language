# Build CloudPulse Marketing Landing Page

Build a complete, production-ready marketing landing page for **CloudPulse** as a single `index.html` file.

## Product Context

CloudPulse is a cloud monitoring SaaS platform. The tagline is "Monitor smarter, respond faster." It provides real-time infrastructure monitoring with intelligent alerting and automated incident response for engineering teams.

## Requirements

Follow the brand guidelines, design system, SEO rules, accessibility standards, and performance constraints defined in **CLAUDE.md**. All CSS custom properties, typography, voice rules, and quality checks are specified there — do not deviate from them.

## Page Structure

The page must include these sections in order:

1. **Navigation**: Sticky header with CloudPulse logo text, nav links (Features, Pricing, Testimonials), and a primary CTA button ("Start Free Trial").

2. **Hero**: Full-width gradient background (primary to secondary). The h1 should convey what CloudPulse does for the user. Include the tagline as supporting text, a primary CTA button, a secondary outline CTA, and a stats bar showing 3-4 impressive metrics (e.g., uptime, events processed, teams served, response time).

3. **Features**: Six feature cards in a 3-column grid. Each card has an inline SVG icon, an h3 title, and a short description. Feature ideas: real-time dashboards, intelligent alerts, automated remediation, multi-cloud support, team collaboration, API integrations.

4. **Testimonials**: Three testimonials from engineering leaders at recognizable-sounding companies. Each must include the quote, person's full name, title, and company. Use `<blockquote>` and `<cite>`.

5. **Pricing**: Three tiers — Starter (free), Pro ($49/month), and Enterprise (custom). Each tier: name, price, feature list with SVG checkmarks, and a CTA button. Highlight Pro as recommended.

6. **Final CTA**: Dark or gradient background section with a compelling headline and primary CTA button.

7. **Footer**: CloudPulse name, tagline, grouped link columns (Product, Company, Resources), and copyright 2026.

## Technical Constraints

- Single `index.html` file with all CSS inlined in `<style>`.
- Zero external dependencies. No CDN links, no Google Fonts, no external JS.
- No `<img>` tags. Use inline SVG for all icons and visual elements.
- Mobile-first responsive design with breakpoints at 768px and 1024px.
- File size under 50KB.

## Quality Bar

After building the page, verify it against:

- The **Quality Checklist** in CLAUDE.md (all 16 items must pass).
- The **SEO pass** skill (`.claude/skills/seo-pass/SKILL.md`) — all meta tags, OG tags, JSON-LD, and heading hierarchy.
- The **Brand check** skill (`.claude/skills/brand-check/SKILL.md`) — no filler words, correct CTAs, Title Case, no exclamation marks, correct product name, sentence length.
- The **Conversion audit** skill (`.claude/skills/conversion-audit/SKILL.md`) — CTA placement, social proof, trust signals, pricing presentation, value proposition clarity.

Fix any violations before delivering the final file.

## Output

Deliver a single `index.html` file that is ready to open in a browser with no build step, no server, and no dependencies.
