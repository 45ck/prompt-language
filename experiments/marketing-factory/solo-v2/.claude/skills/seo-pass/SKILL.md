# Skill: SEO Optimization Pass

## Trigger

After generating or modifying a landing page, or when asked to review SEO.

## Process

### 1. Meta Tags Checklist

Verify the `<head>` contains:

- [ ] `<meta charset="UTF-8">`
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- [ ] `<title>` — under 60 characters, includes product name and primary keyword
- [ ] `<meta name="description">` — 150-160 characters, includes primary value proposition and CTA
- [ ] `<link rel="canonical" href="...">` — full absolute URL

### 2. Open Graph Tags Checklist

Verify these OG tags exist:

- [ ] `<meta property="og:title">` — matches or supplements the title tag
- [ ] `<meta property="og:description">` — matches or supplements meta description
- [ ] `<meta property="og:type" content="website">`
- [ ] `<meta property="og:url">` — canonical URL
- [ ] `<meta property="og:image">` — absolute URL to a share image (at least 1200x630)
- [ ] `<meta property="og:site_name">` — product name

### 3. Twitter Card Tags

Verify:

- [ ] `<meta name="twitter:card" content="summary_large_image">`
- [ ] `<meta name="twitter:title">` — under 70 characters
- [ ] `<meta name="twitter:description">` — under 200 characters

### 4. JSON-LD Structured Data

Verify a `<script type="application/ld+json">` block exists with:

- [ ] `@context`: "https://schema.org"
- [ ] `Organization` schema: name, url, logo, description, contactPoint
- [ ] `WebSite` schema: name, url
- [ ] `Product` schema (if pricing section exists): name, description, offers with price and currency

Validate JSON syntax: no trailing commas, all strings quoted, valid nesting.

### 5. Heading Hierarchy

Scan all headings and verify:

- [ ] Exactly one `<h1>` on the page
- [ ] `<h1>` contains the primary keyword/product name
- [ ] `<h2>` tags used for each major section
- [ ] `<h3>` tags used for subsections within h2 sections
- [ ] No heading levels are skipped (no h1 then h3 without h2)
- [ ] Headings are descriptive and contain relevant keywords

### 6. Link Quality

- [ ] No "click here" or "learn more" link text
- [ ] All `<a>` tags have meaningful, descriptive text
- [ ] Internal navigation links point to valid section IDs
- [ ] Footer links are organized and descriptive

### 7. Semantic Structure

- [ ] `<header>` wraps the site header/nav
- [ ] `<main>` wraps the primary content
- [ ] `<section>` used for each distinct content block
- [ ] `<footer>` wraps the site footer
- [ ] Sections have descriptive `id` attributes for anchor linking

## Output

Report any missing or incorrect items. Fix all issues found before delivering.
