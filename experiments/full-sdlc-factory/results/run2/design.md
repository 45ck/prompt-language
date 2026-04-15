# CloudPulse Marketing Website — Component Design Document

**Project:** CloudPulse Marketing Website
**Document Version:** 2.0
**Date:** 2026-04-15
**Follows:** requirements.md v1.0

---

## Table of Contents

1. [Design System Foundations](#1-design-system-foundations)
2. [Overall Page Structure](#2-overall-page-structure)
3. [CSS Custom Properties](#3-css-custom-properties)
4. [Navigation](#4-navigation)
5. [Hero Section](#5-hero-section)
6. [Features Section](#6-features-section)
7. [Pricing Section](#7-pricing-section)
8. [Testimonials Section](#8-testimonials-section)
9. [Integrations Section](#9-integrations-section)
10. [FAQ Section](#10-faq-section)
11. [Footer](#11-footer)
12. [Responsive Strategy](#12-responsive-strategy)
13. [Mobile Menu](#13-mobile-menu)

---

## 1. Design System Foundations

### 1.1 Brand Colors

| Token                   | Hex Value | Role                                           |
| ----------------------- | --------- | ---------------------------------------------- |
| `--color-primary`       | `#2563EB` | CTAs, active states, links, icon fills         |
| `--color-primary-hover` | `#1D4ED8` | Hover state for primary interactive elements   |
| `--color-secondary`     | `#1E40AF` | Section accents, headings, featured card bg    |
| `--color-accent`        | `#10B981` | Success badges, pricing checkmarks, highlights |
| `--color-accent-hover`  | `#059669` | Hover state for accent elements                |
| `--color-neutral-900`   | `#0F172A` | Primary body text, headings                    |
| `--color-neutral-700`   | `#334155` | Secondary text, nav links                      |
| `--color-neutral-500`   | `#64748B` | Muted text, placeholders, captions             |
| `--color-neutral-300`   | `#CBD5E1` | Borders, dividers                              |
| `--color-neutral-100`   | `#F1F5F9` | Section backgrounds, card fills                |
| `--color-neutral-050`   | `#F8FAFC` | Page background, alternate section fill        |
| `--color-white`         | `#FFFFFF` | Nav background, card surfaces, button text     |

### 1.2 Typography

Font stack: `Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

Load Inter from Google Fonts or self-host the variable font (`Inter-Variable.woff2`) covering weights 400–800.

| Token         | rem Value  | px equiv | Weight | Line Height | Usage                         |
| ------------- | ---------- | -------- | ------ | ----------- | ----------------------------- |
| `--text-xs`   | `0.75rem`  | 12px     | 400    | 1.5         | Legal text, footnotes, badges |
| `--text-sm`   | `0.875rem` | 14px     | 400    | 1.6         | Labels, nav links, captions   |
| `--text-base` | `1rem`     | 16px     | 400    | 1.7         | Body copy, card body text     |
| `--text-lg`   | `1.125rem` | 18px     | 500    | 1.6         | Card titles, sub-headings     |
| `--text-xl`   | `1.25rem`  | 20px     | 600    | 1.5         | Section sub-headings          |
| `--text-2xl`  | `1.5rem`   | 24px     | 700    | 1.4         | Section headings (mobile)     |
| `--text-3xl`  | `1.875rem` | 30px     | 700    | 1.3         | Section headings (desktop)    |
| `--text-4xl`  | `2.25rem`  | 36px     | 800    | 1.2         | Hero headline (mobile)        |
| `--text-5xl`  | `3rem`     | 48px     | 800    | 1.1         | Hero headline (desktop)       |

### 1.3 Spacing (8px Grid)

All spacing values are strict multiples of 8px.

| Token        | Value   | Usage context                              |
| ------------ | ------- | ------------------------------------------ |
| `--space-1`  | `8px`   | Inline icon gaps, tight list gaps          |
| `--space-2`  | `16px`  | Card internal small gaps, button padding   |
| `--space-3`  | `24px`  | Card padding (sm), component internal gaps |
| `--space-4`  | `32px`  | Card padding (lg), section grid gap        |
| `--space-5`  | `40px`  | Card padding (featured), container padding |
| `--space-6`  | `48px`  | Section header bottom margin               |
| `--space-8`  | `64px`  | Section header bottom margin (lg)          |
| `--space-10` | `80px`  | Section vertical padding (mobile)          |
| `--space-12` | `96px`  | Section vertical padding (desktop)         |
| `--space-16` | `128px` | Hero vertical padding (desktop)            |

### 1.4 Border Radius

| Token           | Value    | Usage                            |
| --------------- | -------- | -------------------------------- |
| `--radius-sm`   | `4px`    | Input fields, small tags         |
| `--radius-md`   | `8px`    | Buttons, nav links, small cards  |
| `--radius-lg`   | `12px`   | Feature cards, integration chips |
| `--radius-xl`   | `16px`   | Pricing cards, testimonial cards |
| `--radius-2xl`  | `24px`   | Hero visual card                 |
| `--radius-full` | `9999px` | Pills, badge chips, avatars      |

### 1.5 Shadows

| Token            | Value                              | Usage                 |
| ---------------- | ---------------------------------- | --------------------- |
| `--shadow-sm`    | `0 1px 3px rgba(0,0,0,0.08)`       | Default card lift     |
| `--shadow-md`    | `0 4px 12px rgba(0,0,0,0.10)`      | Hover state cards     |
| `--shadow-lg`    | `0 8px 24px rgba(37,99,235,0.18)`  | Primary button hover  |
| `--shadow-xl`    | `0 20px 40px rgba(37,99,235,0.15)` | Featured pricing card |
| `--shadow-focus` | `0 0 0 3px rgba(37,99,235,0.30)`   | Keyboard focus ring   |

### 1.6 Transitions

| Token               | Value        | Usage                          |
| ------------------- | ------------ | ------------------------------ |
| `--transition-base` | `150ms ease` | Color, border, opacity changes |
| `--transition-slow` | `250ms ease` | Transform, shadow changes      |
| `--transition-menu` | `300ms ease` | Mobile menu open/close         |

---

## 2. Overall Page Structure

### 2.1 Document Skeleton

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CloudPulse — Real-time cloud visibility</title>
    <link rel="stylesheet" href="/css/main.css" />
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>

    <header class="nav" role="banner">
      <!-- Sticky navigation -->
    </header>

    <main id="main-content">
      <section id="hero">          <!-- Hero -->
      <section id="features">      <!-- Features -->
      <section id="pricing">       <!-- Pricing -->
      <section id="testimonials">  <!-- Testimonials -->
      <section id="integrations">  <!-- Integrations -->
      <section id="faq">           <!-- FAQ -->
    </main>

    <footer role="contentinfo">
      <!-- Footer -->
    </footer>

    <script src="/js/main.js" defer></script>
  </body>
</html>
```

### 2.2 Container

The `.container` class is applied inside every section to constrain and center content.

```css
.container {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: var(--space-2); /* 16px on mobile */
}

@media (min-width: 768px) {
  .container {
    padding-inline: var(--space-4); /* 32px on tablet */
  }
}

@media (min-width: 1024px) {
  .container {
    padding-inline: var(--space-5); /* 40px on desktop */
  }
}
```

### 2.3 Section Spacing and Rhythm

- Vertical padding per section: `var(--space-10)` (80px) on mobile, `var(--space-12)` (96px) on desktop.
- Sections alternate backgrounds — white and `--color-neutral-050` — to create visual separation without hard borders.
- Alternation order: hero (gradient), features (neutral-050), pricing (white), testimonials (neutral-050), integrations (white), faq (neutral-050), footer (neutral-900).

### 2.4 Skip Link

A visually hidden skip link (`<a class="skip-link" href="#main-content">`) becomes visible on focus for keyboard users:

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--color-primary);
  color: var(--color-white);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  z-index: 9999;
  transition: top var(--transition-base);
}
.skip-link:focus {
  top: var(--space-2);
}
```

### 2.5 Reusable Section Header

Every section uses a `.section-header` block for consistent eyebrow + heading + sub-copy alignment:

```css
.section-header {
  text-align: center;
  max-width: 640px;
  margin-inline: auto;
  margin-bottom: var(--space-8);
}
.section-eyebrow {
  display: inline-block;
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-primary);
  margin-bottom: var(--space-2);
}
.section-heading {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-neutral-900);
  line-height: 1.3;
  margin-bottom: var(--space-2);
}
.section-sub {
  font-size: var(--text-lg);
  font-weight: 400;
  color: var(--color-neutral-700);
  line-height: 1.7;
}

@media (min-width: 1024px) {
  .section-heading {
    font-size: var(--text-3xl);
  }
}
```

---

## 3. CSS Custom Properties

Declare all design tokens in `:root` for a single source of truth.

```css
:root {
  /* ── Colors ─────────────────────────────────────── */
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-secondary: #1e40af;
  --color-accent: #10b981;
  --color-accent-hover: #059669;

  --color-neutral-900: #0f172a;
  --color-neutral-700: #334155;
  --color-neutral-500: #64748b;
  --color-neutral-300: #cbd5e1;
  --color-neutral-100: #f1f5f9;
  --color-neutral-050: #f8fafc;
  --color-white: #ffffff;

  /* ── Typography ─────────────────────────────────── */
  --font-sans: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  --text-5xl: 3rem;

  /* ── Spacing ─────────────────────────────────────── */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  --space-8: 64px;
  --space-10: 80px;
  --space-12: 96px;
  --space-16: 128px;

  /* ── Border radius ───────────────────────────────── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* ── Shadows ─────────────────────────────────────── */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8px 24px rgba(37, 99, 235, 0.18);
  --shadow-xl: 0 20px 40px rgba(37, 99, 235, 0.15);
  --shadow-focus: 0 0 0 3px rgba(37, 99, 235, 0.3);

  /* ── Transitions ─────────────────────────────────── */
  --transition-base: 150ms ease;
  --transition-slow: 250ms ease;
  --transition-menu: 300ms ease;
}
```

---

## 4. Navigation

### 4.1 Visual Hierarchy

The nav bar is the highest-priority persistent element. Hierarchy reads left to right:

1. CloudPulse logo (brand anchor, leftmost)
2. Primary nav links (center on desktop, hidden on mobile)
3. "Log in" ghost action + "Get started" primary CTA (rightmost)
4. Hamburger toggle (mobile only, rightmost)

### 4.2 HTML Structure

```html
<header class="nav" role="banner">
  <div class="container nav__inner">
    <a class="nav__logo" href="/" aria-label="CloudPulse home">
      <img src="/images/logo.svg" alt="CloudPulse" width="140" height="32" />
    </a>

    <button
      class="nav__toggle"
      aria-label="Toggle navigation menu"
      aria-expanded="false"
      aria-controls="nav-menu"
    >
      <span class="nav__toggle-bar"></span>
      <span class="nav__toggle-bar"></span>
      <span class="nav__toggle-bar"></span>
    </button>

    <nav id="nav-menu" class="nav__menu" role="navigation" aria-label="Main navigation">
      <ul class="nav__list" role="list">
        <li><a class="nav__link" href="#features">Features</a></li>
        <li><a class="nav__link" href="#pricing">Pricing</a></li>
        <li><a class="nav__link" href="#testimonials">Customers</a></li>
        <li><a class="nav__link" href="#integrations">Integrations</a></li>
        <li><a class="nav__link" href="#faq">FAQ</a></li>
      </ul>
      <div class="nav__actions">
        <a class="btn btn--ghost" href="/login">Log in</a>
        <a class="btn btn--primary" href="/signup">Get started</a>
      </div>
    </nav>
  </div>
</header>
```

### 4.3 CSS Approach

- **Position:** `sticky`, `top: 0`, `z-index: 100`
- **Layout:** `.nav__inner` uses `display: flex; align-items: center; justify-content: space-between; height: 64px`
- **`.nav__list`:** `display: flex; align-items: center; gap: var(--space-1)` on desktop
- **`.nav__actions`:** `display: flex; align-items: center; gap: var(--space-1)`
- **Scroll state:** JavaScript adds `.nav--scrolled` to `<header>` once `scrollY > 10`. This activates a bottom border and a `backdrop-filter: blur(8px)` with semi-transparent background.

```css
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-white);
  transition:
    box-shadow var(--transition-base),
    background var(--transition-base);
}
.nav--scrolled {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: var(--shadow-sm);
  border-bottom: 1px solid var(--color-neutral-300);
}
.nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}
```

### 4.4 Color Application

| Element                 | Color                                                 |
| ----------------------- | ----------------------------------------------------- |
| Header background       | `--color-white` (transparent backdrop on scroll)      |
| Logo image              | Full-color SVG (primary blue wordmark)                |
| Nav links               | `--color-neutral-700`                                 |
| Nav link hover          | `--color-primary`                                     |
| Nav link active/current | `--color-primary`, weight `600`                       |
| Ghost "Log in" button   | Transparent bg, `--color-neutral-700` text, no border |
| Ghost "Log in" hover    | `--color-neutral-100` bg                              |
| Primary "Get started"   | `--color-primary` bg, `--color-white` text            |
| Primary button hover    | `--color-primary-hover` bg                            |

### 4.5 Spacing

| Element                  | Value                              |
| ------------------------ | ---------------------------------- |
| Nav inner height         | `64px`                             |
| Container padding        | As defined in container spec above |
| Gap between nav links    | `var(--space-1)` (8px)             |
| Nav link padding         | `10px 12px`                        |
| Gap between action items | `var(--space-1)` (8px)             |
| Ghost button padding     | `10px var(--space-2)`              |
| Primary button padding   | `10px var(--space-3)`              |

### 4.6 Typography

| Element     | Size        | Weight | Notes                    |
| ----------- | ----------- | ------ | ------------------------ |
| Nav links   | `--text-sm` | `500`  | `letter-spacing: 0.01em` |
| Button text | `--text-sm` | `600`  |                          |

### 4.7 Interactive States

```css
.nav__link {
  color: var(--color-neutral-700);
  text-decoration: none;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  transition:
    color var(--transition-base),
    background var(--transition-base);
}
.nav__link:hover {
  color: var(--color-primary);
  background: rgba(37, 99, 235, 0.06);
}
.nav__link:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
.nav__link[aria-current='page'] {
  color: var(--color-primary);
  font-weight: 600;
}

/* Primary CTA */
.btn--primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: var(--color-white);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 10px var(--space-3);
  text-decoration: none;
  transition:
    background var(--transition-base),
    border-color var(--transition-base),
    box-shadow var(--transition-slow),
    transform var(--transition-slow);
}
.btn--primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}
.btn--primary:active {
  transform: translateY(0);
  box-shadow: none;
}
.btn--primary:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

### 4.8 Responsive Breakpoints

| Viewport       | Nav behavior                                           |
| -------------- | ------------------------------------------------------ |
| `< 768px`      | Logo + hamburger visible; nav links and actions hidden |
| `768px–1023px` | Nav links and actions visible in row; hamburger hidden |
| `>= 1024px`    | Full layout with all elements in a single row          |

---

## 5. Hero Section

### 5.1 Visual Hierarchy

Reading order from most to least prominent:

1. Eyebrow badge (accent color — draws first attention before headline)
2. H1 headline (largest type on page, primary message)
3. Sub-headline paragraph (supporting context)
4. Two-button CTA group (primary action + secondary action)
5. Social proof micro-copy (trust signal)
6. Product screenshot / illustration (visual evidence)

### 5.2 HTML Structure

```html
<section id="hero" class="hero" aria-labelledby="hero-heading">
  <div class="container hero__inner">
    <div class="hero__content">
      <span class="hero__badge">Now in public beta</span>

      <h1 id="hero-heading" class="hero__heading">
        Monitor your cloud.<br />
        Move with confidence.
      </h1>

      <p class="hero__sub">
        CloudPulse gives engineering teams real-time visibility into infrastructure health, cost
        trends, and deployment risk — all in one unified dashboard.
      </p>

      <div class="hero__actions">
        <a class="btn btn--primary btn--lg" href="/signup"> Start free trial </a>
        <a class="btn btn--outline-white btn--lg" href="#features"> See how it works </a>
      </div>

      <p class="hero__social-proof">
        Trusted by <strong>2,400+</strong> engineering teams worldwide
      </p>
    </div>

    <div class="hero__visual" aria-hidden="true">
      <img
        class="hero__screenshot"
        src="/images/dashboard-preview.webp"
        alt="CloudPulse dashboard showing infrastructure health metrics,
             cost trends, and active alerts"
        width="640"
        height="480"
        loading="eager"
        fetchpriority="high"
      />
    </div>
  </div>
</section>
```

### 5.3 CSS Approach

- **Background:** `linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 60%, #3B82F6 100%)`
- **Layout (mobile):** Single column, `hero__content` stacked above `hero__visual`, both centered
- **Layout (desktop, 1024px+):** `display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: var(--space-8)`
- **Screenshot card:** Rendered inside a rounded card with `border-radius: var(--radius-2xl)`, white border `2px solid rgba(255,255,255,0.15)`, and `box-shadow: var(--shadow-xl)` to appear to float above the gradient background

```css
.hero {
  background: linear-gradient(
    135deg,
    var(--color-secondary) 0%,
    var(--color-primary) 60%,
    #3b82f6 100%
  );
  padding-block: var(--space-10);
  overflow: hidden;
}

.hero__inner {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-8);
  align-items: center;
}

@media (min-width: 1024px) {
  .hero {
    padding-block: var(--space-16);
  }
  .hero__inner {
    grid-template-columns: 1fr 1fr;
  }
  .hero__content {
    text-align: left;
  }
}

.hero__content {
  text-align: center;
}

.hero__screenshot {
  width: 100%;
  height: auto;
  border-radius: var(--radius-2xl);
  border: 2px solid rgba(255, 255, 255, 0.15);
  box-shadow: var(--shadow-xl);
}
```

### 5.4 Color Application

| Element                 | Color                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Section background      | Gradient: `--color-secondary` → `--color-primary` → `#3B82F6`                                                                         |
| Badge background        | `rgba(16, 185, 129, 0.20)` (accent tint)                                                                                              |
| Badge text              | `--color-accent` (`#10B981`)                                                                                                          |
| Badge border            | `1px solid rgba(16, 185, 129, 0.40)`                                                                                                  |
| H1 text                 | `--color-white`                                                                                                                       |
| H1 accent phrase        | No separate color — white on blue is sufficient; optionally `rgba(255,255,255,0.85)` for second line to create subtle two-tone effect |
| Sub-headline            | `rgba(255, 255, 255, 0.82)`                                                                                                           |
| Primary CTA bg          | `--color-white`                                                                                                                       |
| Primary CTA text        | `--color-primary`                                                                                                                     |
| Outline CTA border      | `rgba(255, 255, 255, 0.60)`                                                                                                           |
| Outline CTA text        | `--color-white`                                                                                                                       |
| Outline CTA hover bg    | `rgba(255, 255, 255, 0.12)`                                                                                                           |
| Social proof text       | `rgba(255, 255, 255, 0.65)`                                                                                                           |
| Social proof `<strong>` | `--color-white`                                                                                                                       |

### 5.5 Spacing

| Element                    | Value                                               |
| -------------------------- | --------------------------------------------------- |
| Section vertical padding   | `var(--space-10)` mobile, `var(--space-16)` desktop |
| Badge bottom margin        | `var(--space-3)` (24px)                             |
| Heading bottom margin      | `var(--space-3)` (24px)                             |
| Sub-headline bottom margin | `var(--space-4)` (32px)                             |
| CTA group bottom margin    | `var(--space-3)` (24px)                             |
| Gap between CTA buttons    | `var(--space-2)` (16px)                             |
| Badge padding              | `6px 14px`                                          |
| Large button padding       | `14px 28px`                                         |

### 5.6 Typography

| Element      | Size                                      | Weight | Line Height | Notes                               |
| ------------ | ----------------------------------------- | ------ | ----------- | ----------------------------------- |
| Badge        | `--text-sm`                               | `600`  | `1`         | Uppercase, `letter-spacing: 0.05em` |
| H1           | `--text-4xl` mobile, `--text-5xl` desktop | `800`  | `1.1`       |                                     |
| Sub-headline | `--text-base` mobile, `--text-lg` desktop | `400`  | `1.7`       | max-width `520px`                   |
| Social proof | `--text-sm`                               | `400`  | `1.5`       |                                     |

### 5.7 Interactive States

- **Primary CTA (white on blue section):** Background stays `--color-white`; on hover text shifts to `--color-primary-hover`; `box-shadow: 0 6px 20px rgba(0,0,0,0.20)`; `transform: translateY(-2px)`.
- **Outline CTA:** On hover, `background: rgba(255,255,255,0.12)` with `border-color: rgba(255,255,255,0.90)`.

---

## 6. Features Section

### 6.1 Visual Hierarchy

1. Eyebrow label
2. Section H2 heading
3. Section sub-copy
4. Feature card grid (each card: icon → title → body → link)

### 6.2 HTML Structure

```html
<section id="features" class="features" aria-labelledby="features-heading">
  <div class="container">
    <header class="section-header">
      <span class="section-eyebrow">What you get</span>
      <h2 id="features-heading" class="section-heading">
        Everything your team needs to ship safely
      </h2>
      <p class="section-sub">
        From alerting to cost forecasting, CloudPulse covers the full operational loop without
        additional tooling.
      </p>
    </header>

    <ul class="features__grid" role="list">
      <li class="feature-card">
        <div class="feature-card__icon" aria-hidden="true">
          <!-- 24x24 SVG icon -->
        </div>
        <h3 class="feature-card__title">Real-time Alerting</h3>
        <p class="feature-card__body">
          Get paged in seconds, not minutes. CloudPulse ingests metrics at sub-second resolution and
          fires alerts through Slack, PagerDuty, or email.
        </p>
        <a class="feature-card__link" href="/features/alerting">
          Learn more <span aria-hidden="true">&#8594;</span>
        </a>
      </li>
      <!-- Repeat pattern for 5 additional feature cards:
           Cost Forecasting, Deployment Risk Scoring,
           Multi-cloud Support, Custom Dashboards,
           Audit & Compliance Logs -->
    </ul>
  </div>
</section>
```

### 6.3 CSS Approach

- **Background:** `--color-neutral-050`
- **Grid:** Mobile 1 column → 768px 2 columns → 1024px 3 columns

```css
.features {
  background: var(--color-neutral-050);
  padding-block: var(--space-10);
}

@media (min-width: 1024px) {
  .features {
    padding-block: var(--space-12);
  }
}

.features__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: 0;
}

@media (min-width: 768px) {
  .features__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .features__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

- **Card:** `display: flex; flex-direction: column` so the learn-more link is pushed to the card bottom via `margin-top: auto` on `.feature-card__link`.

### 6.4 Color Application

| Element               | Color                                |
| --------------------- | ------------------------------------ |
| Section background    | `--color-neutral-050`                |
| Card background       | `--color-white`                      |
| Card border (default) | `1px solid var(--color-neutral-300)` |
| Card border (hover)   | `--color-primary`                    |
| Icon container bg     | `rgba(37, 99, 235, 0.08)`            |
| Icon fill             | `--color-primary`                    |
| Card title            | `--color-neutral-900`                |
| Card body text        | `--color-neutral-700`                |
| Learn more link       | `--color-primary`                    |

### 6.5 Spacing

| Element                      | Value                                                    |
| ---------------------------- | -------------------------------------------------------- |
| Section vertical padding     | `var(--space-10)` / `var(--space-12)`                    |
| Section header bottom margin | `var(--space-8)` (64px)                                  |
| Card padding                 | `var(--space-4)` (32px)                                  |
| Icon container size          | `48px × 48px`                                            |
| Icon container border-radius | `var(--radius-md)` (8px)                                 |
| Icon size inside container   | `24px × 24px`                                            |
| Gap: icon → title            | `var(--space-2)` (16px)                                  |
| Gap: title → body            | `var(--space-1)` (8px)                                   |
| Gap: body → link             | `var(--space-3)` (24px) via `margin-top: auto` + padding |

### 6.6 Typography

| Element    | Size          | Weight | Notes              |
| ---------- | ------------- | ------ | ------------------ |
| Card title | `--text-xl`   | `600`  |                    |
| Card body  | `--text-base` | `400`  | `line-height: 1.7` |
| Learn more | `--text-sm`   | `600`  |                    |

### 6.7 Interactive States

```css
.feature-card {
  background: var(--color-white);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  transition:
    box-shadow var(--transition-slow),
    border-color var(--transition-slow),
    transform var(--transition-slow);
}
.feature-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary);
  transform: translateY(-4px);
}
.feature-card__link {
  color: var(--color-primary);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
  margin-top: auto;
  padding-top: var(--space-3);
}
.feature-card__link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.feature-card__link:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  border-radius: var(--radius-sm);
}
```

---

## 7. Pricing Section

### 7.1 Visual Hierarchy

1. Eyebrow + H2 + sub-copy
2. Billing frequency toggle (monthly / annual)
3. Three pricing cards: Starter | Pro (featured/center) | Enterprise
4. Annual savings callout on toggle label

### 7.2 HTML Structure

```html
<section id="pricing" class="pricing" aria-labelledby="pricing-heading">
  <div class="container">
    <header class="section-header">
      <span class="section-eyebrow">Pricing</span>
      <h2 id="pricing-heading" class="section-heading">Simple, transparent pricing</h2>
      <p class="section-sub">No hidden fees. Cancel anytime. Upgrade as your team grows.</p>
    </header>

    <div class="pricing__toggle-wrap">
      <div class="pricing__toggle" role="group" aria-label="Billing frequency">
        <span class="pricing__toggle-label" id="billing-monthly">Monthly</span>
        <button
          class="pricing__toggle-btn"
          role="switch"
          aria-checked="false"
          aria-labelledby="billing-monthly billing-annual"
          id="billing-toggle"
        >
          <span class="pricing__toggle-thumb"></span>
        </button>
        <span class="pricing__toggle-label" id="billing-annual">
          Annual
          <span class="pricing__save-badge">Save 20%</span>
        </span>
      </div>
    </div>

    <ul class="pricing__grid" role="list">
      <!-- Starter -->
      <li class="pricing-card">
        <div class="pricing-card__header">
          <h3 class="pricing-card__tier">Starter</h3>
          <div class="pricing-card__price">
            <span class="pricing-card__currency">$</span>
            <span class="pricing-card__amount" data-monthly="29" data-annual="23">29</span>
            <span class="pricing-card__period">/mo</span>
          </div>
          <p class="pricing-card__billed-note" data-annual-note="Billed $276/year">&nbsp;</p>
          <p class="pricing-card__desc">For small teams getting started with cloud monitoring.</p>
        </div>
        <ul class="pricing-card__features" role="list" aria-label="Starter plan features">
          <li class="pricing-card__feature">Up to 5 users</li>
          <li class="pricing-card__feature">10 monitored services</li>
          <li class="pricing-card__feature">30-day metric retention</li>
          <li class="pricing-card__feature">Email alerts</li>
          <li class="pricing-card__feature pricing-card__feature--na">Slack &amp; PagerDuty</li>
          <li class="pricing-card__feature pricing-card__feature--na">Cost forecasting</li>
        </ul>
        <a class="btn btn--outline btn--full" href="/signup?plan=starter">Get started free</a>
      </li>

      <!-- Pro (featured) -->
      <li class="pricing-card pricing-card--featured" aria-label="Pro plan, most popular">
        <span class="pricing-card__badge" aria-hidden="true">Most popular</span>
        <div class="pricing-card__header">
          <h3 class="pricing-card__tier">Pro</h3>
          <div class="pricing-card__price">
            <span class="pricing-card__currency">$</span>
            <span class="pricing-card__amount" data-monthly="89" data-annual="71">89</span>
            <span class="pricing-card__period">/mo</span>
          </div>
          <p class="pricing-card__billed-note" data-annual-note="Billed $852/year">&nbsp;</p>
          <p class="pricing-card__desc">Full visibility for growing engineering teams.</p>
        </div>
        <ul class="pricing-card__features" role="list" aria-label="Pro plan features">
          <li class="pricing-card__feature">Up to 25 users</li>
          <li class="pricing-card__feature">Unlimited services</li>
          <li class="pricing-card__feature">1-year metric retention</li>
          <li class="pricing-card__feature">Slack &amp; PagerDuty alerts</li>
          <li class="pricing-card__feature">Cost forecasting</li>
          <li class="pricing-card__feature">Deployment risk scoring</li>
        </ul>
        <a class="btn btn--white btn--full" href="/signup?plan=pro">Start free trial</a>
      </li>

      <!-- Enterprise -->
      <li class="pricing-card">
        <div class="pricing-card__header">
          <h3 class="pricing-card__tier">Enterprise</h3>
          <div class="pricing-card__price">
            <span class="pricing-card__amount">Custom</span>
          </div>
          <p class="pricing-card__billed-note">&nbsp;</p>
          <p class="pricing-card__desc">
            Advanced compliance and security for large organizations.
          </p>
        </div>
        <ul class="pricing-card__features" role="list" aria-label="Enterprise plan features">
          <li class="pricing-card__feature">Unlimited users</li>
          <li class="pricing-card__feature">Unlimited services</li>
          <li class="pricing-card__feature">Custom retention policies</li>
          <li class="pricing-card__feature">SSO / SAML</li>
          <li class="pricing-card__feature">Audit logs &amp; compliance</li>
          <li class="pricing-card__feature">Dedicated SLA &amp; support</li>
        </ul>
        <a class="btn btn--outline btn--full" href="/contact">Contact sales</a>
      </li>
    </ul>
  </div>
</section>
```

### 7.3 CSS Approach

- **Grid:** Single column on mobile; 3 equal columns at 1024px (`repeat(3, 1fr)`).
- **Featured card:** On desktop, `transform: scale(1.03)` and extra `box-shadow: var(--shadow-xl)`. Scale disabled on mobile to prevent overflow.
- **Billing toggle:** Custom `<button role="switch">` styled as a pill slider. JavaScript toggles `aria-checked` and updates prices via `data-monthly` / `data-annual` attributes.

```css
.pricing {
  background: var(--color-white);
  padding-block: var(--space-10);
}

@media (min-width: 1024px) {
  .pricing {
    padding-block: var(--space-12);
  }
}

.pricing__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: 0;
  align-items: start; /* so featured card can scale independently */
}

@media (min-width: 768px) {
  .pricing__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.pricing-card--featured {
  position: relative;
}

@media (min-width: 768px) {
  .pricing-card--featured {
    transform: scale(1.03);
    box-shadow: var(--shadow-xl);
  }
}
```

### 7.4 Color Application

| Element                     | Color                                |
| --------------------------- | ------------------------------------ |
| Section background          | `--color-white`                      |
| Standard card background    | `--color-white`                      |
| Standard card border        | `1px solid var(--color-neutral-300)` |
| Featured card background    | `--color-secondary` (`#1E40AF`)      |
| Featured card border        | `2px solid var(--color-primary)`     |
| Featured card text          | `--color-white`                      |
| Featured card desc/muted    | `rgba(255,255,255,0.72)`             |
| "Most popular" badge bg     | `--color-accent`                     |
| "Most popular" badge text   | `--color-white`                      |
| Feature checkmark icon      | `--color-accent`                     |
| N/A feature icon            | `--color-neutral-300`                |
| N/A feature text            | `--color-neutral-500`                |
| Save badge bg               | `rgba(16,185,129,0.15)`              |
| Save badge text             | `--color-accent`                     |
| Toggle track (off)          | `--color-neutral-300`                |
| Toggle track (on)           | `--color-primary`                    |
| Toggle thumb                | `--color-white`                      |
| Standard outline CTA border | `--color-primary`                    |
| Standard outline CTA text   | `--color-primary`                    |
| Featured white CTA bg       | `--color-white`                      |
| Featured white CTA text     | `--color-secondary`                  |

### 7.5 Spacing

| Element                        | Value                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| Section vertical padding       | `var(--space-10)` / `var(--space-12)`                                    |
| Toggle area bottom margin      | `var(--space-8)` (64px)                                                  |
| Card padding                   | `var(--space-5)` (40px)                                                  |
| Card padding (featured)        | `var(--space-5)` with extra `padding-top: var(--space-6)` to clear badge |
| Gap: tier name → price         | `var(--space-2)` (16px)                                                  |
| Gap: price → desc              | `var(--space-2)` (16px)                                                  |
| Gap: desc → feature list       | `var(--space-4)` (32px)                                                  |
| Feature list item gap          | `var(--space-1)` (8px)                                                   |
| Gap: feature list → CTA button | `var(--space-5)` (40px)                                                  |
| Badge position (featured)      | `position: absolute; top: var(--space-3); right: var(--space-3)`         |

### 7.6 Typography

| Element        | Size          | Weight | Notes                               |
| -------------- | ------------- | ------ | ----------------------------------- |
| Tier name      | `--text-xl`   | `700`  |                                     |
| Price amount   | `--text-4xl`  | `800`  |                                     |
| Price currency | `--text-xl`   | `600`  | Vertically aligned top              |
| Price period   | `--text-base` | `400`  | `--color-neutral-500`               |
| Description    | `--text-sm`   | `400`  | `line-height: 1.6`                  |
| Feature item   | `--text-sm`   | `400`  |                                     |
| Badge text     | `--text-xs`   | `700`  | Uppercase, `letter-spacing: 0.05em` |

### 7.7 Interactive States

```css
.pricing-card {
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-neutral-300);
  padding: var(--space-5);
  transition:
    box-shadow var(--transition-slow),
    transform var(--transition-slow);
}
.pricing-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-4px);
}
.pricing-card--featured:hover {
  box-shadow: var(--shadow-xl);
}
@media (min-width: 768px) {
  .pricing-card--featured:hover {
    transform: scale(1.03) translateY(-4px);
  }
}

/* Billing toggle */
.pricing__toggle-btn {
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--color-neutral-300);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background var(--transition-base);
}
.pricing__toggle-btn[aria-checked='true'] {
  background: var(--color-primary);
}
.pricing__toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--color-white);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-base);
}
.pricing__toggle-btn[aria-checked='true'] .pricing__toggle-thumb {
  transform: translateX(20px);
}
```

---

## 8. Testimonials Section

### 8.1 Visual Hierarchy

1. Eyebrow + H2
2. 3-column quote card grid
3. Company logo strip (logos rendered in grayscale by default)

### 8.2 HTML Structure

```html
<section id="testimonials" class="testimonials" aria-labelledby="testimonials-heading">
  <div class="container">
    <header class="section-header">
      <span class="section-eyebrow">Customer stories</span>
      <h2 id="testimonials-heading" class="section-heading">Loved by engineers at scale</h2>
    </header>

    <ul class="testimonials__grid" role="list">
      <li class="testimonial-card">
        <blockquote class="testimonial-card__quote">
          <p>
            "CloudPulse cut our mean time to detection by 60%. Our on-call rotation finally sleeps
            through the night."
          </p>
        </blockquote>
        <footer class="testimonial-card__footer">
          <img
            class="testimonial-card__avatar"
            src="/images/avatars/sarah-kim.webp"
            alt="Sarah Kim"
            width="48"
            height="48"
          />
          <div class="testimonial-card__meta">
            <cite class="testimonial-card__name">Sarah Kim</cite>
            <span class="testimonial-card__role">VP Engineering, Axiom Labs</span>
          </div>
        </footer>
      </li>
      <!-- Repeat for 2–5 additional testimonials -->
    </ul>

    <div class="testimonials__logos" aria-label="Companies using CloudPulse">
      <!-- Provide each logo as an <img> with descriptive alt text -->
      <!-- Example: <img src="/logos/stripe.svg" alt="Stripe" width="80" height="28" /> -->
    </div>
  </div>
</section>
```

### 8.3 CSS Approach

- **Background:** `--color-neutral-050`
- **Grid:** Single column mobile → 2 columns at 768px → 3 columns at 1024px
- **Logo strip:** `display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--space-5)` — logos rendered in `filter: grayscale(1); opacity: 0.5`, animated back to full color on hover

```css
.testimonials {
  background: var(--color-neutral-050);
  padding-block: var(--space-10);
}

@media (min-width: 1024px) {
  .testimonials {
    padding-block: var(--space-12);
  }
}

.testimonials__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: 0;
}

@media (min-width: 768px) {
  .testimonials__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .testimonials__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.testimonials__logos {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-5);
  margin-top: var(--space-10);
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-neutral-300);
}
```

### 8.4 Color Application

| Element                   | Color                                          |
| ------------------------- | ---------------------------------------------- |
| Section background        | `--color-neutral-050`                          |
| Card background           | `--color-white`                                |
| Card left accent bar      | `4px solid var(--color-primary)` (border-left) |
| Card border               | `1px solid var(--color-neutral-300)`           |
| Decorative open-quote     | `--color-primary` at `opacity: 0.12`           |
| Quote text                | `--color-neutral-900`                          |
| Author name               | `--color-neutral-900`                          |
| Author role               | `--color-neutral-500`                          |
| Avatar border             | `2px solid var(--color-neutral-300)`           |
| Logo strip images         | `filter: grayscale(1); opacity: 0.5`           |
| Logo strip images (hover) | `filter: grayscale(0); opacity: 1`             |

### 8.5 Spacing

| Element                      | Value                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Section vertical padding     | `var(--space-10)` / `var(--space-12)`                                         |
| Section header bottom margin | `var(--space-8)` (64px)                                                       |
| Card padding                 | `var(--space-4)` (32px)                                                       |
| Gap: quote → footer          | `var(--space-4)` (32px) via `margin-top: auto` on `.testimonial-card__footer` |
| Avatar size                  | `48px × 48px`                                                                 |
| Avatar border-radius         | `var(--radius-full)`                                                          |
| Gap: avatar → meta           | `var(--space-2)` (16px)                                                       |
| Logo strip top margin        | `var(--space-10)` (80px)                                                      |
| Logo max-height              | `32px`                                                                        |

### 8.6 Typography

| Element     | Size          | Weight | Notes                                  |
| ----------- | ------------- | ------ | -------------------------------------- |
| Quote text  | `--text-base` | `400`  | `font-style: italic; line-height: 1.8` |
| Author name | `--text-sm`   | `700`  |                                        |
| Author role | `--text-sm`   | `400`  |                                        |

### 8.7 Interactive States

```css
.testimonial-card {
  background: var(--color-white);
  border: 1px solid var(--color-neutral-300);
  border-left: 4px solid var(--color-primary);
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow var(--transition-slow),
    transform var(--transition-slow);
}
.testimonial-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-3px);
}
.testimonials__logos img {
  filter: grayscale(1);
  opacity: 0.5;
  transition:
    filter var(--transition-slow),
    opacity var(--transition-slow);
}
.testimonials__logos img:hover {
  filter: grayscale(0);
  opacity: 1;
}
```

---

## 9. Integrations Section

### 9.1 Visual Hierarchy

1. Eyebrow + H2 + sub-copy
2. Dense grid of integration chips (icon + name)
3. Centered CTA link to full integrations catalog

### 9.2 HTML Structure

```html
<section id="integrations" class="integrations" aria-labelledby="integrations-heading">
  <div class="container">
    <header class="section-header">
      <span class="section-eyebrow">Integrations</span>
      <h2 id="integrations-heading" class="section-heading">Works with your existing stack</h2>
      <p class="section-sub">
        Connect CloudPulse to over 80 tools in minutes with native integrations and an open REST
        API.
      </p>
    </header>

    <ul class="integrations__grid" role="list" aria-label="Supported integrations">
      <li class="integration-chip">
        <img src="/icons/integrations/aws.svg" alt="" aria-hidden="true" width="32" height="32" />
        <span class="integration-chip__name">AWS</span>
      </li>
      <li class="integration-chip">
        <img src="/icons/integrations/gcp.svg" alt="" aria-hidden="true" width="32" height="32" />
        <span class="integration-chip__name">Google Cloud</span>
      </li>
      <li class="integration-chip">
        <img src="/icons/integrations/azure.svg" alt="" aria-hidden="true" width="32" height="32" />
        <span class="integration-chip__name">Azure</span>
      </li>
      <!-- Continue for all integrations (recommend 16 visible + "view all" CTA) -->
    </ul>

    <div class="integrations__cta">
      <a class="btn btn--outline" href="/integrations">View all 80+ integrations</a>
    </div>
  </div>
</section>
```

### 9.3 CSS Approach

- **Background:** `--color-white`
- **Grid:** 3 columns on mobile → 5 columns at 768px → 8 columns at 1024px, `gap: var(--space-2)`

```css
.integrations {
  background: var(--color-white);
  padding-block: var(--space-10);
}

@media (min-width: 1024px) {
  .integrations {
    padding-block: var(--space-12);
  }
}

.integrations__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}

@media (min-width: 768px) {
  .integrations__grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (min-width: 1024px) {
  .integrations__grid {
    grid-template-columns: repeat(8, 1fr);
  }
}

.integrations__cta {
  text-align: center;
  margin-top: var(--space-6);
}
```

### 9.4 Color Application

| Element                 | Color                                |
| ----------------------- | ------------------------------------ |
| Section background      | `--color-white`                      |
| Chip background         | `--color-neutral-100`                |
| Chip border             | `1px solid var(--color-neutral-300)` |
| Chip border (hover)     | `--color-primary`                    |
| Chip background (hover) | `rgba(37, 99, 235, 0.05)`            |
| Chip label text         | `--color-neutral-700`                |

### 9.5 Spacing

| Element                  | Value                                 |
| ------------------------ | ------------------------------------- |
| Section vertical padding | `var(--space-10)` / `var(--space-12)` |
| Grid gap                 | `var(--space-2)` (16px)               |
| Chip padding             | `var(--space-2)` (16px)               |
| Chip icon size           | `32px × 32px`                         |
| Gap: icon → label        | `var(--space-1)` (8px)                |
| CTA top margin           | `var(--space-6)` (48px)               |

### 9.6 Typography

| Element    | Size        | Weight | Notes                |
| ---------- | ----------- | ------ | -------------------- |
| Chip label | `--text-xs` | `500`  | `text-align: center` |

### 9.7 Interactive States

```css
.integration-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--color-neutral-100);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-lg);
  transition:
    border-color var(--transition-base),
    background var(--transition-base),
    box-shadow var(--transition-base);
}
.integration-chip:hover {
  border-color: var(--color-primary);
  background: rgba(37, 99, 235, 0.05);
  box-shadow: var(--shadow-sm);
}
```

---

## 10. FAQ Section

### 10.1 Visual Hierarchy

1. Eyebrow + H2
2. Accordion list (question rows that expand to reveal answers)
3. Support CTA below accordion

### 10.2 HTML Structure

```html
<section id="faq" class="faq" aria-labelledby="faq-heading">
  <div class="container faq__wrap">
    <header class="section-header">
      <span class="section-eyebrow">FAQ</span>
      <h2 id="faq-heading" class="section-heading">Frequently asked questions</h2>
    </header>

    <dl class="faq__list">
      <div class="faq__item">
        <dt class="faq__term">
          <button
            class="faq__question"
            aria-expanded="false"
            aria-controls="faq-answer-1"
            id="faq-btn-1"
          >
            <span>How does the 14-day free trial work?</span>
            <svg class="faq__icon" aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </dt>
        <dd class="faq__answer" id="faq-answer-1" role="region" aria-labelledby="faq-btn-1" hidden>
          <div class="faq__answer-inner">
            <p>
              Start your trial with no credit card required. You get full access to all Pro features
              for 14 days. At the end of the trial you can choose to subscribe, or your account
              automatically moves to a read-only state.
            </p>
          </div>
        </dd>
      </div>

      <!-- Repeat for 6–8 additional question/answer pairs -->
    </dl>

    <div class="faq__support">
      <p class="faq__support-text">Still have questions?</p>
      <a class="btn btn--outline" href="/contact">Talk to support</a>
    </div>
  </div>
</section>
```

### 10.3 CSS Approach

- **Background:** `--color-neutral-050`
- **Content max-width:** The `.faq__wrap .faq__list` is constrained to `760px` and centered for comfortable long-form reading
- **Accordion mechanism:** Each `<dd>` starts with `hidden` attribute. JavaScript removes `hidden` and sets `aria-expanded="true"` on the button. The chevron icon rotates `180deg` on open.
- **Animation:** Rather than toggling `display`, use `max-height` transition: closed = `max-height: 0; overflow: hidden`, open = `max-height: 800px` (generous upper bound)

```css
.faq {
  background: var(--color-neutral-050);
  padding-block: var(--space-10);
}

@media (min-width: 1024px) {
  .faq {
    padding-block: var(--space-12);
  }
}

.faq__list {
  max-width: 760px;
  margin-inline: auto;
  margin-top: 0;
}

.faq__item {
  border-bottom: 1px solid var(--color-neutral-300);
}
.faq__item:first-child {
  border-top: 1px solid var(--color-neutral-300);
}

.faq__answer {
  max-height: 0;
  overflow: hidden;
  transition: max-height var(--transition-menu);
}
.faq__answer:not([hidden]) {
  max-height: 800px;
}
/* Note: [hidden] suppresses rendering entirely for no-JS fallback.
   JS removes the attribute and adds the transition-friendly open class. */
```

### 10.4 Color Application

| Element                   | Color                      |
| ------------------------- | -------------------------- |
| Section background        | `--color-neutral-050`      |
| Item border               | `var(--color-neutral-300)` |
| Question text             | `--color-neutral-900`      |
| Question hover text       | `--color-primary`          |
| Question hover background | `rgba(37, 99, 235, 0.04)`  |
| Chevron icon              | `--color-primary`          |
| Answer text               | `--color-neutral-700`      |
| Answer background         | `--color-white`            |

### 10.5 Spacing

| Element                      | Value                                         |
| ---------------------------- | --------------------------------------------- |
| Section vertical padding     | `var(--space-10)` / `var(--space-12)`         |
| Section header bottom margin | `var(--space-6)` (48px)                       |
| Question button padding      | `var(--space-3) 0` (24px top/bottom, 0 sides) |
| Answer inner padding         | `0 0 var(--space-3) 0`                        |
| Support block top margin     | `var(--space-8)` (64px)                       |
| FAQ list max-width           | `760px`                                       |

### 10.6 Typography

| Element       | Size          | Weight | Notes              |
| ------------- | ------------- | ------ | ------------------ |
| Question text | `--text-lg`   | `600`  | `line-height: 1.5` |
| Answer text   | `--text-base` | `400`  | `line-height: 1.7` |
| Support text  | `--text-base` | `400`  | Centered           |

### 10.7 Interactive States

```css
.faq__question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: var(--space-3) 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--color-neutral-900);
  font-size: var(--text-lg);
  font-weight: 600;
  font-family: var(--font-sans);
  border-radius: var(--radius-sm);
  transition:
    color var(--transition-base),
    background var(--transition-base);
}
.faq__question:hover {
  color: var(--color-primary);
  background: rgba(37, 99, 235, 0.04);
  padding-inline: var(--space-2);
  margin-inline: calc(-1 * var(--space-2));
  width: calc(100% + var(--space-4));
}
.faq__question:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
.faq__icon {
  flex-shrink: 0;
  color: var(--color-primary);
  transition: transform var(--transition-slow);
}
.faq__question[aria-expanded='true'] .faq__icon {
  transform: rotate(180deg);
}
```

---

## 11. Footer

### 11.1 Visual Hierarchy

1. Brand column: logo + tagline + social icons
2. Four link columns: Product, Company, Resources, Legal
3. Bottom bar: copyright line + secondary tagline

### 11.2 HTML Structure

```html
<footer class="footer" role="contentinfo">
  <div class="container">
    <div class="footer__main">
      <div class="footer__brand">
        <a class="footer__logo-link" href="/" aria-label="CloudPulse home">
          <img
            src="/images/logo-white.svg"
            alt="CloudPulse"
            width="120"
            height="28"
            loading="lazy"
          />
        </a>
        <p class="footer__tagline">Real-time cloud visibility for modern engineering teams.</p>
        <nav class="footer__social" aria-label="CloudPulse social media">
          <a
            href="https://twitter.com/cloudpulse"
            aria-label="CloudPulse on Twitter"
            rel="noopener noreferrer"
          >
            <!-- Twitter SVG icon, 20x20 -->
          </a>
          <a
            href="https://github.com/cloudpulse"
            aria-label="CloudPulse on GitHub"
            rel="noopener noreferrer"
          >
            <!-- GitHub SVG icon, 20x20 -->
          </a>
          <a
            href="https://linkedin.com/company/cloudpulse"
            aria-label="CloudPulse on LinkedIn"
            rel="noopener noreferrer"
          >
            <!-- LinkedIn SVG icon, 20x20 -->
          </a>
        </nav>
      </div>

      <nav class="footer__nav" aria-label="Footer navigation">
        <div class="footer__col">
          <h3 class="footer__col-heading">Product</h3>
          <ul role="list">
            <li><a href="/features">Features</a></li>
            <li><a href="/pricing">Pricing</a></li>
            <li><a href="/integrations">Integrations</a></li>
            <li><a href="/changelog">Changelog</a></li>
            <li><a href="/status">Status</a></li>
          </ul>
        </div>
        <div class="footer__col">
          <h3 class="footer__col-heading">Company</h3>
          <ul role="list">
            <li><a href="/about">About</a></li>
            <li><a href="/blog">Blog</a></li>
            <li><a href="/careers">Careers</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div class="footer__col">
          <h3 class="footer__col-heading">Resources</h3>
          <ul role="list">
            <li><a href="/docs">Documentation</a></li>
            <li><a href="/api">API reference</a></li>
            <li><a href="/community">Community</a></li>
            <li><a href="/security">Security</a></li>
          </ul>
        </div>
        <div class="footer__col">
          <h3 class="footer__col-heading">Legal</h3>
          <ul role="list">
            <li><a href="/privacy">Privacy policy</a></li>
            <li><a href="/terms">Terms of service</a></li>
            <li><a href="/cookies">Cookie policy</a></li>
          </ul>
        </div>
      </nav>
    </div>

    <div class="footer__bottom">
      <p class="footer__copy">
        &copy; <span id="footer-year">2026</span> CloudPulse, Inc. All rights reserved.
      </p>
      <p class="footer__legal-note">Made with care for engineers everywhere.</p>
    </div>
  </div>
</footer>
```

### 11.3 CSS Approach

- **Background:** `--color-neutral-900`
- **Main layout:** Mobile single column; `display: grid; grid-template-columns: 1fr 2fr; gap: var(--space-8)` at 1024px
- **Footer nav columns:** `display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-5)` on mobile; `repeat(4, 1fr)` at 768px
- **Bottom bar:** `display: flex; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2); border-top: 1px solid rgba(255,255,255,0.10); padding-top: var(--space-4)`

```css
.footer {
  background: var(--color-neutral-900);
  padding-top: var(--space-10);
  padding-bottom: var(--space-6);
}

.footer__main {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-8);
  margin-bottom: var(--space-8);
}

@media (min-width: 1024px) {
  .footer__main {
    grid-template-columns: 1fr 2fr;
  }
}

.footer__nav {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-5);
}

@media (min-width: 768px) {
  .footer__nav {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### 11.4 Color Application

| Element                  | Color                             |
| ------------------------ | --------------------------------- |
| Footer background        | `--color-neutral-900` (`#0F172A`) |
| Tagline text             | `rgba(255, 255, 255, 0.60)`       |
| Social icons             | `rgba(255, 255, 255, 0.55)`       |
| Social icons (hover)     | `--color-primary`                 |
| Column headings          | `--color-white`                   |
| Nav links                | `rgba(255, 255, 255, 0.60)`       |
| Nav links (hover)        | `--color-white`                   |
| Top border of bottom bar | `rgba(255, 255, 255, 0.10)`       |
| Copyright text           | `rgba(255, 255, 255, 0.40)`       |
| Legal note text          | `rgba(255, 255, 255, 0.30)`       |

### 11.5 Spacing

| Element                             | Value                    |
| ----------------------------------- | ------------------------ |
| Footer top padding                  | `var(--space-10)` (80px) |
| Footer bottom padding               | `var(--space-6)` (48px)  |
| Brand column bottom margin (mobile) | `var(--space-6)` (48px)  |
| Logo bottom margin                  | `var(--space-2)` (16px)  |
| Tagline bottom margin               | `var(--space-3)` (24px)  |
| Social icons gap                    | `var(--space-2)` (16px)  |
| Social icon size                    | `20px × 20px`            |
| Column heading bottom margin        | `var(--space-2)` (16px)  |
| Nav link gap                        | `var(--space-1)` (8px)   |
| Bottom bar top padding              | `var(--space-4)` (32px)  |

### 11.6 Typography

| Element         | Size        | Weight | Notes                               |
| --------------- | ----------- | ------ | ----------------------------------- |
| Column headings | `--text-sm` | `700`  | Uppercase, `letter-spacing: 0.08em` |
| Tagline         | `--text-sm` | `400`  | max-width `260px`                   |
| Nav links       | `--text-sm` | `400`  |                                     |
| Copyright       | `--text-xs` | `400`  |                                     |
| Legal note      | `--text-xs` | `400`  |                                     |

### 11.7 Interactive States

```css
.footer__nav a {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  font-size: var(--text-sm);
  transition: color var(--transition-base);
  display: inline-block;
}
.footer__nav a:hover {
  color: var(--color-white);
}
.footer__nav a:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  border-radius: var(--radius-sm);
}
.footer__social a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.55);
  transition: color var(--transition-base);
}
.footer__social a:hover {
  color: var(--color-primary);
}
.footer__social a:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  border-radius: var(--radius-sm);
}
```

---

## 12. Responsive Strategy

### 12.1 Approach: Mobile-First

All base styles target the smallest viewport (320px+). `@media (min-width: ...)` queries progressively enhance layout and typography for larger screens.

**Breakpoints:**

| Breakpoint name | Value    | Target context                     |
| --------------- | -------- | ---------------------------------- |
| Base            | 0px+     | Mobile phones, portrait            |
| Tablet          | `768px`  | Tablets, large phones in landscape |
| Desktop         | `1024px` | Laptops, desktop monitors          |
| Wide (optional) | `1280px` | Large monitors, minor refinements  |

### 12.2 Typography Scaling

Font sizes increase at the `1024px` breakpoint for section headings and the hero headline. Body copy and card text remain constant (1rem base) for readability across all sizes.

```css
/* Mobile base */
.section-heading {
  font-size: var(--text-2xl);
}
.hero__heading {
  font-size: var(--text-4xl);
}

/* Desktop */
@media (min-width: 1024px) {
  .section-heading {
    font-size: var(--text-3xl);
  }
  .hero__heading {
    font-size: var(--text-5xl);
  }
}
```

### 12.3 Layout Progression Pattern

Every multi-column grid on the page follows this base pattern:

```css
/* Mobile: single column */
.some__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

/* Tablet: two columns */
@media (min-width: 768px) {
  .some__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop: final column count */
@media (min-width: 1024px) {
  .some__grid {
    grid-template-columns: repeat(N, 1fr);
  }
}
```

### 12.4 Touch Target Minimums

All interactive elements (buttons, links, hamburger toggle, accordion triggers, toggle switch) must meet a minimum touch target size of `44px × 44px` on mobile. Use `padding` to achieve this without altering visual size.

### 12.5 Image Handling

- Hero screenshot: `width: 100%; height: auto` — scales down on mobile, constrained by grid column on desktop.
- Integration logos: `max-height: 32px; width: auto` — uniform strip height.
- Avatar images: fixed `48px × 48px` with `object-fit: cover; border-radius: var(--radius-full)`.

### 12.6 Pricing Card Featured Scale

The `transform: scale(1.03)` on the featured pricing card is applied only at `>= 768px` to prevent the card from overflowing its container on narrow screens:

```css
@media (min-width: 768px) {
  .pricing-card--featured {
    transform: scale(1.03);
  }
}
```

---

## 13. Mobile Menu

### 13.1 Behavior Summary

- Below `768px`, the nav link list and action buttons are hidden.
- A hamburger `<button>` is shown at the right of the nav bar.
- Clicking the hamburger applies `.nav--open` to `<header>` which:
  - Reveals the nav menu as a full-width panel below the header
  - Animates three bars into an X shape
  - Sets `aria-expanded="true"` on the toggle button
  - Locks page scroll with `document.body.style.overflow = 'hidden'`
- Clicking a nav link, pressing Escape, or clicking outside the menu closes it and returns focus to the toggle button.
- At `768px+`, the hamburger is hidden (`display: none`) and the nav menu is always visible in row layout.

### 13.2 Toggle Button Structure

```html
<button
  class="nav__toggle"
  aria-label="Toggle navigation menu"
  aria-expanded="false"
  aria-controls="nav-menu"
>
  <span class="nav__toggle-bar"></span>
  <span class="nav__toggle-bar"></span>
  <span class="nav__toggle-bar"></span>
</button>
```

### 13.3 CSS

```css
/* ── Hamburger button ── */
.nav__toggle {
  display: none; /* shown via media query below */
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 44px;
  height: 44px;
  padding: var(--space-1);
  background: none;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background var(--transition-base);
}
.nav__toggle:hover {
  background: var(--color-neutral-100);
}
.nav__toggle:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
.nav__toggle-bar {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--color-neutral-900);
  border-radius: var(--radius-full);
  transition:
    transform var(--transition-slow),
    opacity var(--transition-base),
    background var(--transition-base);
}

/* X animation when open */
.nav--open .nav__toggle-bar:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}
.nav--open .nav__toggle-bar:nth-child(2) {
  opacity: 0;
  transform: scaleX(0);
}
.nav--open .nav__toggle-bar:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* ── Mobile menu panel ── */
.nav__menu {
  display: none;
}

@media (max-width: 767px) {
  .nav__toggle {
    display: flex;
  }
  .nav__menu {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    position: absolute;
    top: 64px; /* height of nav bar */
    left: 0;
    right: 0;
    background: var(--color-white);
    border-top: 1px solid var(--color-neutral-300);
    border-bottom: 1px solid var(--color-neutral-300);
    padding: var(--space-3) var(--space-2);
    /* Hidden state */
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transition:
      max-height var(--transition-menu),
      opacity var(--transition-menu);
  }
  .nav--open .nav__menu {
    max-height: 520px;
    opacity: 1;
    pointer-events: auto;
  }
  .nav__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .nav__link {
    display: block;
    padding: 12px var(--space-2);
    font-size: var(--text-base);
  }
  .nav__actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-neutral-300);
  }
  .nav__actions .btn {
    width: 100%;
    justify-content: center;
  }
}

/* ── Desktop: always visible, inline ── */
@media (min-width: 768px) {
  .nav__toggle {
    display: none;
  }
  .nav__menu {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
    position: static;
    max-height: none;
    overflow: visible;
    opacity: 1;
    pointer-events: auto;
    background: transparent;
    border: none;
    padding: 0;
  }
  .nav__list {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--space-1);
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .nav__actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--space-1);
  }
}
```

### 13.4 JavaScript

```js
(function () {
  const header = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  const navLinks = document.querySelectorAll('.nav__link');

  if (!header || !toggle) return;

  function openMenu() {
    header.classList.add('nav--open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    header.classList.remove('nav--open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function isOpen() {
    return header.classList.contains('nav--open');
  }

  // Toggle on hamburger click
  toggle.addEventListener('click', () => {
    isOpen() ? closeMenu() : openMenu();
  });

  // Close on nav link click (smooth scroll target)
  navLinks.forEach((link) => link.addEventListener('click', closeMenu));

  // Close on click outside the nav
  document.addEventListener('click', (e) => {
    if (isOpen() && !header.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on Escape key, return focus to toggle
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      closeMenu();
      toggle.focus();
    }
  });

  // Scroll-state class for nav styling
  window.addEventListener(
    'scroll',
    () => {
      header.classList.toggle('nav--scrolled', window.scrollY > 10);
    },
    { passive: true },
  );

  // Dynamic footer year
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
```

---

_Document version 2.0 — CloudPulse Marketing Website Component Design_
_Last updated: 2026-04-15_
