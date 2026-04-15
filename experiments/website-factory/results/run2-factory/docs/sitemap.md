# NightOwl Website Sitemap and Information Architecture

## Structure Decision: Single-Page Marketing Site

Based on personas and content strategy, NightOwl's website is a single-page landing site. The audience is technical and goal-oriented — they do not want to navigate multiple pages to understand a product. A well-structured scroll flow converts better for this audience.

One supplementary page: `/privacy` (standalone, linked in footer). Privacy is a top concern for Persona 3 (data scientist) and Persona 2 (manager).

---

## Page Structure and Section Order

### Route: `/` (Main Landing Page)

| #   | Section ID     | Component Name      | Primary Goal                  | User Flow Notes                                           |
| --- | -------------- | ------------------- | ----------------------------- | --------------------------------------------------------- |
| 1   | `nav`          | NavBar              | Wayfinding + CTA access       | Sticky. Logo left, nav links center, CTA button right.    |
| 2   | `hero`         | HeroSection         | Hook + primary CTA            | Above the fold. Value prop, subheadline, dual CTAs.       |
| 3   | `features`     | FeaturesSection     | Show core capabilities        | 4-feature grid. Each feature as transformation, not spec. |
| 4   | `how-it-works` | HowItWorksSection   | Remove setup friction         | 3-step numbered flow. Simple, visual, reassuring.         |
| 5   | `testimonials` | TestimonialsSection | Build social proof            | 4 persona-matched quotes. Real names, real roles.         |
| 6   | `pricing`      | PricingSection      | Drive conversion decision     | 3-tier pricing (Free, Pro, Team). Free tier prominent.    |
| 7   | `integrations` | IntegrationsSection | Show ecosystem fit            | Logo grid. GitHub, Linear, Notion, Calendar, Slack.       |
| 8   | `faq`          | FAQSection          | Remove final objections       | Accordion. 6-8 questions prioritized by persona concerns. |
| 9   | `cta-footer`   | CTAFooter           | Final conversion + navigation | Bold headline CTA + footer links.                         |

### Route: `/privacy`

- Full privacy policy
- Data handling explanation
- Contact information
- Linked from footer

---

## User Flow

### Primary conversion path (new visitor)

```
Landing → Hero (hook) → Features (understand value) → Pricing (evaluate cost) → Sign Up CTA
```

### Secondary paths by persona

**Maya (Engineer):**
Hero → Integrations (sees GitHub) → Features (cognitive correlation) → Pricing (Pro) → Sign Up

**James (Manager):**
Hero → Features (Team Insights) → Pricing (Team tier) → Book Demo

**Priya (Data Scientist):**
Hero → Features → Pricing (checks data export in Pro) → FAQ (privacy question) → Sign Up

**Alex (Writer):**
Hero → How It Works (checks effort level) → Testimonials (writer quote) → Pricing (Free tier) → Sign Up

---

## Navigation Structure

### Top Navigation

- Logo (links to `#hero`)
- Features (links to `#features`)
- How It Works (links to `#how-it-works`)
- Pricing (links to `#pricing`)
- For Teams (links to `#pricing` team tier)
- Sign In (links to app)
- **"Start Free" CTA button** (primary, links to signup)

### Footer Navigation

**Product**

- Features
- Integrations
- Pricing
- Changelog

**Company**

- About
- Blog
- Careers
- Press

**Legal**

- Privacy Policy
- Terms of Service
- Security

**Social**

- Twitter/X
- LinkedIn
- GitHub (for the developer audience — links to public repo or org)

---

## Section Specifications

### Hero (`#hero`)

- Layout: Centered text, dark background, atmospheric visual (stars, data visualization)
- Elements: Eyebrow tag ("Sleep tracking for knowledge workers"), H1 headline, subheadline (2 sentences max), primary CTA, secondary CTA, trust signals (no credit card, works with phone)
- Dark overlay: Deep navy/charcoal gradient

### Features (`#features`)

- Layout: 2x2 grid on desktop, single column on mobile
- Each feature: Icon, headline (transformation-focused), 2-sentence description
- Background: Slightly lighter than hero for visual rhythm

### How It Works (`#how-it-works`)

- Layout: 3-column horizontal on desktop, vertical stack on mobile
- Each step: Large number, icon, step name, 1-sentence description
- Visual: Arrow or connecting line between steps on desktop

### Testimonials (`#testimonials`)

- Layout: 2x2 card grid on desktop, carousel or stack on mobile
- Each card: Quote text, avatar placeholder, name, role/title
- Background: Dark with subtle card elevation

### Pricing (`#pricing`)

- Layout: 3-column horizontal on desktop, stacked on mobile
- Featured tier (Pro): Visually elevated (border, badge, slightly larger)
- Each tier: Tier name, price, feature list with checkmarks, CTA button
- Below grid: "Compare all features" text link and FAQ reference

### Integrations (`#integrations`)

- Layout: Horizontal logo row with labels, centered
- Each logo: Tool icon + tool name + 1-line value description
- Background: Same as Features for visual grouping

### FAQ (`#faq`)

- Layout: Single column accordion, max-width constrained for readability
- 6-8 questions from content strategy
- Smooth expand/collapse animation

### CTA Footer (`#cta-footer`)

- Layout: Centered, full-bleed dark background
- Elements: Bold headline, subheadline (social proof number), primary CTA, secondary CTA
- Transitions into standard footer below

---

## Responsive Breakpoints

| Breakpoint | Width        | Layout changes                                                    |
| ---------- | ------------ | ----------------------------------------------------------------- |
| Mobile     | < 768px      | Single column, stacked sections, hamburger nav, condensed pricing |
| Tablet     | 768px–1024px | 2-column grids, side-by-side how-it-works                         |
| Desktop    | > 1024px     | Full layouts as described above                                   |
| Wide       | > 1280px     | Max-width container (1200px) centers content                      |

---

## Visual Flow Notes

The page should feel like a single coherent experience, not disconnected sections. Achieve this with:

- Alternating background tones (deep navy → slightly lighter → deep navy) to create rhythm
- Consistent vertical spacing between sections (80px–120px)
- Smooth scroll behavior enabled site-wide
- Section entry animations (subtle fade-in-up on scroll) for premium feel
- Color temperature consistent throughout: cool blues, deep purples, soft warm accent (amber or teal)
