# NightOwl SEO Audit Report

**Date:** 2026-04-15
**Audited:** site/app/layout.tsx, site/app/page.tsx, all section components

---

## Page Title and Meta Description

**Status: PASS**

- Title: "NightOwl — Sleep Smarter, Think Sharper"
  - Length: 42 characters (under 60 limit)
  - Contains primary keyword and brand tagline
- Meta description set in layout.tsx:
  "NightOwl connects your sleep quality to your cognitive performance. The sleep platform built for knowledge workers — engineers, researchers, writers, and managers who need their brain at its best."
  - Length: 191 characters (within 160-200 optimal range)
  - Contains primary keyword "knowledge workers" and secondary keywords "cognitive performance"

## Keyword Coverage

**Status: PASS**

Primary keywords confirmed present in page content:

- "sleep tracking for knowledge workers" — in eyebrow tag and hero subheadline
- "sleep and cognitive performance" — in Features section headline
- "sleep tracker for engineers" — named in hero subheadline
- "work performance sleep data" — in Features section body copy
- "sleep productivity correlation" — in Cognitive Performance Correlation feature description

## Open Graph Tags

**Status: PASS**

Defined in layout.tsx metadata:

- `og:title`: "NightOwl — Sleep Smarter, Think Sharper"
- `og:description`: Distinct from meta description, optimized for social sharing
- `og:type`: "website"
- `og:url`: "https://nightowl.app"
- Note: og:image not yet set (placeholder required before launch)

## Twitter Card Tags

**Status: PASS**

- `twitter:card`: "summary_large_image"
- `twitter:title`: Set
- `twitter:description`: Set (integration-focused variant)
- Note: twitter:image not yet set (required before launch)

## Heading Hierarchy

**Status: PASS**

- Single `<h1>` on page: "Sleep smarter, think sharper." (HeroSection)
- `<h2>` elements on each section: Features, How It Works, Testimonials, Pricing, Integrations, FAQ, CTA Footer
- `<h3>` elements for individual feature cards, testimonials, pricing tier names
- No heading levels skipped

## Semantic HTML Structure

**Status: PASS**

- `<main id="main-content">` wraps all page content
- `<header>` wraps NavBar
- `<footer>` wraps Footer
- `<section>` with `aria-labelledby` on all major sections
- `<article>` used for feature cards
- `<figure>` / `<figcaption>` used for testimonials
- `<nav>` used for navigation

## Schema.org Structured Data

**Status: NEEDS IMPLEMENTATION**

Recommended: Add JSON-LD SoftwareApplication schema to layout.tsx.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "NightOwl",
  "applicationCategory": "HealthApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "description": "Sleep tracking platform for knowledge workers that connects sleep quality to cognitive performance.",
  "url": "https://nightowl.app"
}
```

## Canonical URL

**Status: NEEDS IMPLEMENTATION**

Add `<link rel="canonical" href="https://nightowl.app" />` in layout.tsx metadata.

## Robots Meta Tag

**Status: PASS (implicit)**

Next.js static export defaults to indexable. No robots meta tag exclusion is needed.

## Skip Navigation Link

**Status: PASS**

Skip-to-content link implemented in page.tsx. Visible on keyboard focus, links to `#main-content`.

## Performance / Core Web Vitals Estimate

- Static export with Next.js generates pre-rendered HTML — no server-side latency
- No external JavaScript libraries (custom design system)
- Google Fonts loaded via Next.js `next/font` (optimized, self-hosted)
- Images: SVG assets only at launch, all with explicit dimensions
- Estimated LCP: < 2.5s (hero text renders with first HTML, no image dependency)
- Estimated CLS: Near 0 (no dynamic layout shifts, fixed nav height)

## Pre-Launch SEO Checklist

- [ ] Add og:image (1200x630px) with NightOwl branded dark-mode graphic
- [ ] Add twitter:image
- [ ] Add JSON-LD SoftwareApplication schema
- [ ] Add canonical URL tag
- [ ] Verify sitemap.xml generation (add next-sitemap package post-launch)
- [ ] Register with Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
