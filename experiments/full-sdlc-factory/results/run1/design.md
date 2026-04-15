# CloudPulse Marketing Website — Component Design Document

**Version:** 1.0
**Date:** 2026-04-15
**Designer:** UI Design System

---

## Brand Token Reference

```
--color-primary:       #2563EB  /* Electric Blue */
--color-primary-dark:  #1E40AF  /* Deep Blue */
--color-accent:        #10B981  /* Emerald Green */
--color-neutral-900:   #0f172a
--color-neutral-800:   #1e293b
--color-neutral-700:   #334155
--color-neutral-500:   #64748b
--color-neutral-400:   #94a3b8
--color-neutral-200:   #e2e8f0
--color-neutral-50:    #f8fafc
--color-white:         #ffffff

--font-family:         'Inter', system-ui, -apple-system, sans-serif

--space-1:  8px
--space-2:  16px
--space-3:  24px
--space-4:  32px
--space-5:  40px
--space-6:  48px
--space-8:  64px
--space-10: 80px
--space-12: 96px
--space-16: 128px

--radius-sm:  4px
--radius-md:  8px
--radius-lg:  12px
--radius-xl:  16px
--radius-full: 9999px

--shadow-sm:  0 1px 2px rgba(0,0,0,0.05)
--shadow-md:  0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)
--shadow-lg:  0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)
--shadow-xl:  0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)
--shadow-blue: 0 4px 14px rgba(37,99,235,0.35)
```

---

## Overall Page Structure

### Max-Width Container

```
.container {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: var(--space-2);   /* 16px mobile */
}

@media (min-width: 768px) {
  .container {
    padding-inline: var(--space-3); /* 24px tablet */
  }
}

@media (min-width: 1024px) {
  .container {
    padding-inline: var(--space-4); /* 32px desktop */
  }
}
```

### Document Skeleton

```html
<!DOCTYPE html>
<html lang="en">
  <head>...</head>
  <body>
    <header role="banner">           <!-- Nav -->
    <main>
      <section id="hero">            <!-- Hero -->
      <section id="features">        <!-- Features -->
      <section id="pricing">         <!-- Pricing -->
      <section id="testimonials">    <!-- Testimonials -->
      <section id="integrations">    <!-- Integrations -->
      <section id="faq">             <!-- FAQ -->
    </main>
    <footer role="contentinfo">      <!-- Footer -->
  </body>
</html>
```

### Section Spacing Scale

| Section Pair             | Top Padding                  | Bottom Padding |
| ------------------------ | ---------------------------- | -------------- |
| Section (mobile)         | 64px (--space-8)             | 64px           |
| Section (tablet 768px)   | 80px (--space-10)            | 80px           |
| Section (desktop 1024px) | 96px (--space-12)            | 96px           |
| Section heading → body   | margin-top: 48px (--space-6) | —              |
| Card gap (grid)          | 24px (--space-3)             | —              |

### Background Alternation Pattern

```
body            → #f8fafc (--color-neutral-50)
#hero           → #0f172a (dark, full-bleed)
#features       → #f8fafc
#pricing        → #0f172a (dark, full-bleed)
#testimonials   → #ffffff
#integrations   → #f8fafc
#faq            → #ffffff
footer          → #0f172a (dark, full-bleed)
```

---

## 1. Navigation (Header)

### Purpose

Persistent top navigation with brand identity, primary links, and conversion CTA.

### HTML Structure

```html
<header class="nav" role="banner">
  <div class="container">
    <nav class="nav__inner" aria-label="Main navigation">
      <!-- Brand -->
      <a href="/" class="nav__logo" aria-label="CloudPulse home">
        <img src="/logo.svg" alt="CloudPulse" width="140" height="32" />
      </a>

      <!-- Desktop links -->
      <ul class="nav__links" role="list">
        <li><a href="#features" class="nav__link">Features</a></li>
        <li><a href="#pricing" class="nav__link">Pricing</a></li>
        <li>
          <a href="#integrations" class="nav__link">Integrations</a>
        </li>
        <li><a href="/docs" class="nav__link">Docs</a></li>
      </ul>

      <!-- CTA group -->
      <div class="nav__actions">
        <a href="/login" class="btn btn--ghost">Sign in</a>
        <a href="/signup" class="btn btn--primary">Start free trial</a>
      </div>

      <!-- Mobile hamburger -->
      <button
        class="nav__hamburger"
        aria-controls="mobile-menu"
        aria-expanded="false"
        aria-label="Open menu"
      >
        <span class="hamburger__bar"></span>
        <span class="hamburger__bar"></span>
        <span class="hamburger__bar"></span>
      </button>
    </nav>
  </div>

  <!-- Mobile drawer -->
  <div
    id="mobile-menu"
    class="nav__mobile"
    aria-hidden="true"
    role="dialog"
    aria-modal="true"
    aria-label="Mobile navigation"
  >
    <ul class="nav__mobile-links" role="list">
      <li><a href="#features">Features</a></li>
      <li><a href="#pricing">Pricing</a></li>
      <li><a href="#integrations">Integrations</a></li>
      <li><a href="/docs">Docs</a></li>
    </ul>
    <div class="nav__mobile-actions">
      <a href="/login" class="btn btn--ghost btn--full">Sign in</a>
      <a href="/signup" class="btn btn--primary btn--full">Start free trial</a>
    </div>
  </div>
</header>
```

### CSS Approach

```css
/* Fixed bar — always visible */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(15, 23, 42, 0.92); /* --color-neutral-900 @ 92% */
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s ease;
}

.nav--scrolled {
  background: rgba(15, 23, 42, 0.98);
  box-shadow: var(--shadow-lg);
}

.nav__inner {
  display: flex;
  align-items: center;
  height: 64px; /* fixed height */
  gap: var(--space-2); /* 16px */
}

/* Logo pushes links to center via flex grow */
.nav__logo {
  flex-shrink: 0;
}

.nav__links {
  display: none; /* hidden on mobile */
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav__actions {
  display: none; /* hidden on mobile */
  gap: var(--space-1); /* 8px */
  margin-left: auto;
}

/* Tablet+ (768px) — show desktop nav */
@media (min-width: 768px) {
  .nav__links {
    display: flex;
    align-items: center;
    gap: var(--space-1); /* 8px between items */
    margin-left: auto;
  }
  .nav__actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .nav__hamburger {
    display: none;
  }
  .nav__mobile {
    display: none !important;
  }
}

/* Desktop (1024px) — wider link spacing */
@media (min-width: 1024px) {
  .nav__links {
    gap: var(--space-2);
  } /* 16px */
  .nav__inner {
    height: 72px;
  }
}
```

### Mobile Menu Approach

The mobile menu uses a **full-width slide-down drawer** pattern:

```css
.nav__mobile {
  position: fixed;
  inset: 64px 0 0 0;
  background: #0f172a;
  padding: var(--space-3) var(--space-2);
  transform: translateY(-100%);
  opacity: 0;
  visibility: hidden;
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.28s ease,
    visibility 0s linear 0.28s;
  overflow-y: auto;
  z-index: 99;
}

.nav__mobile.is-open {
  transform: translateY(0);
  opacity: 1;
  visibility: visible;
  transition-delay: 0s;
}

.nav__mobile-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav__mobile-links a {
  display: block;
  padding: var(--space-2) var(--space-1); /* 16px 8px */
  font-size: 1.125rem;
  color: #e2e8f0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.nav__mobile-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.btn--full {
  width: 100%;
  justify-content: center;
}
```

JavaScript toggles `is-open` on the drawer and updates `aria-expanded` on the trigger button.

### Color Application

| Element              | Color                      | Purpose            |
| -------------------- | -------------------------- | ------------------ |
| Nav background       | #0f172a @ 92% opacity      | Dark authority bar |
| Logo text / SVG      | #ffffff                    | Maximum contrast   |
| Nav links (default)  | #94a3b8 (neutral-400)      | Subdued, readable  |
| Nav links (hover)    | #ffffff                    | Active feedback    |
| Nav link (active)    | #2563EB (primary)          | Current page       |
| Ghost button         | transparent / #94a3b8 text | Low-priority CTA   |
| Ghost button hover   | rgba(255,255,255,0.06) bg  | Subtle hover       |
| Primary button       | #2563EB bg / white text    | Main CTA           |
| Primary button hover | #1E40AF bg                 | Darken on hover    |

### Typography

| Element        | Size             | Weight | Line Height |
| -------------- | ---------------- | ------ | ----------- |
| Nav link       | 0.9375rem (15px) | 500    | 1.25        |
| Ghost button   | 0.9375rem        | 500    | 1.25        |
| Primary button | 0.9375rem        | 600    | 1.25        |
| Mobile links   | 1.125rem (18px)  | 500    | 1.4         |

### Interactive States

```css
.nav__link {
  color: var(--color-neutral-400);
  text-decoration: none;
  padding: var(--space-1) 10px;
  border-radius: var(--radius-sm);
  transition:
    color 0.15s ease,
    background 0.15s ease;
}
.nav__link:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.06);
}
.nav__link:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.btn--primary {
  background: #2563eb;
  color: #ffffff;
  padding: 10px var(--space-2);
  border-radius: var(--radius-md);
  font-weight: 600;
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
}
.btn--primary:hover {
  background: #1e40af;
  box-shadow: var(--shadow-blue);
}
.btn--primary:active {
  transform: scale(0.97);
}
```

---

## 2. Hero Section

### Purpose

Full-viewport-height opening statement. Dark background with gradient, bold headline, supporting copy, dual CTAs, and a product screenshot/mockup.

### HTML Structure

```html
<section id="hero" class="hero" aria-labelledby="hero-heading">
  <div class="container">
    <div class="hero__inner">
      <!-- Text column -->
      <div class="hero__content">
        <div class="hero__eyebrow" aria-hidden="true">
          <span class="badge badge--accent">New — Real-time dashboards</span>
        </div>

        <h1 id="hero-heading" class="hero__heading">
          Cloud infrastructure<br />
          <span class="hero__heading--highlight">without the guesswork</span>
        </h1>

        <p class="hero__subheading">
          CloudPulse monitors every corner of your stack — from uptime and latency to cost anomalies
          — and surfaces what matters before your users notice.
        </p>

        <div class="hero__cta-group" role="group" aria-label="Get started">
          <a href="/signup" class="btn btn--primary btn--lg">
            Start free trial
            <svg class="btn__icon" aria-hidden="true"><!-- arrow-right --></svg>
          </a>
          <a href="#demo" class="btn btn--outline btn--lg">
            Watch demo
            <svg class="btn__icon" aria-hidden="true"><!-- play --></svg>
          </a>
        </div>

        <p class="hero__trust">
          No credit card required &nbsp;·&nbsp; 14-day free trial &nbsp;·&nbsp; SOC 2 certified
        </p>
      </div>

      <!-- Visual column -->
      <div class="hero__visual" aria-hidden="true">
        <div class="hero__screenshot-wrapper">
          <img
            src="/images/dashboard-preview.webp"
            alt="CloudPulse dashboard showing real-time metrics"
            class="hero__screenshot"
            width="640"
            height="420"
            loading="eager"
          />
          <!-- Floating stat pills -->
          <div class="hero__pill hero__pill--1">
            <span class="pill__icon">&#9650;</span>
            <span>99.98% uptime</span>
          </div>
          <div class="hero__pill hero__pill--2">
            <span class="pill__icon">&#9660;</span>
            <span>Latency down 40%</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Background decoration -->
  <div class="hero__bg-glow" aria-hidden="true"></div>
  <div class="hero__bg-grid" aria-hidden="true"></div>
</section>
```

### CSS Approach

```css
.hero {
  position: relative;
  background: #0f172a;
  overflow: hidden;
  padding-block: var(--space-16) var(--space-12); /* 128px 96px */
  min-height: 100svh;
  display: flex;
  align-items: center;
}

/* Background glow radial */
.hero__bg-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 60% 0%, rgba(37, 99, 235, 0.18) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 10% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 60%);
  pointer-events: none;
}

/* Subtle dot-grid overlay */
.hero__bg-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}

/* Single-column mobile */
.hero__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-8); /* 64px */
  align-items: center;
  text-align: center;
}

/* Two-column at 1024px */
@media (min-width: 1024px) {
  .hero__inner {
    flex-direction: row;
    text-align: left;
    align-items: center;
    gap: var(--space-8);
  }
  .hero__content {
    flex: 1;
  }
  .hero__visual {
    flex: 1;
  }
}

/* Screenshot card */
.hero__screenshot-wrapper {
  position: relative;
  border-radius: var(--radius-xl);
  overflow: visible;
  box-shadow:
    0 32px 64px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.08);
}
.hero__screenshot {
  width: 100%;
  height: auto;
  border-radius: var(--radius-xl);
  display: block;
}

/* Floating pills */
.hero__pill {
  position: absolute;
  background: rgba(30, 41, 59, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #f8fafc;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-lg);
  animation: float 4s ease-in-out infinite;
}
.hero__pill--1 {
  top: -16px;
  right: 24px;
  animation-delay: 0s;
}
.hero__pill--2 {
  bottom: -16px;
  left: 24px;
  animation-delay: 2s;
}

.hero__pill .pill__icon {
  color: #10b981;
  font-size: 0.75rem;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
```

### Color Application

| Element            | Color                                   |
| ------------------ | --------------------------------------- |
| Section background | #0f172a                                 |
| Heading text       | #f8fafc                                 |
| Highlight span     | #2563EB (primary)                       |
| Subheading text    | #94a3b8 (neutral-400)                   |
| Eyebrow badge bg   | rgba(16,185,129,0.12)                   |
| Eyebrow badge text | #10B981 (accent)                        |
| Badge border       | rgba(16,185,129,0.25)                   |
| Primary CTA        | #2563EB bg / white text                 |
| Outline CTA        | transparent / white border / white text |
| Trust line text    | #64748b (neutral-500)                   |
| Screenshot border  | rgba(255,255,255,0.08)                  |
| Floating pill bg   | rgba(30,41,59,0.95)                     |

### Typography

| Element       | Size                      | Weight | Line Height |
| ------------- | ------------------------- | ------ | ----------- |
| Eyebrow badge | 0.8125rem (13px)          | 600    | 1.25        |
| H1 heading    | clamp(2rem, 5vw, 3.5rem)  | 800    | 1.1         |
| H1 highlight  | inherits h1 + gradient    | 800    | 1.1         |
| Subheading    | clamp(1rem, 2vw, 1.25rem) | 400    | 1.7         |
| CTA button lg | 1rem (16px)               | 600    | 1.25        |
| Trust line    | 0.875rem (14px)           | 400    | 1.5         |

```css
.hero__heading {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #f8fafc;
  margin: 0 0 var(--space-3);
}
.hero__heading--highlight {
  background: linear-gradient(135deg, #2563eb 0%, #10b981 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Spacing

```
.hero__content: gap between elements = var(--space-3) (24px) via flex column
.hero__cta-group: gap = var(--space-2) (16px), flex-wrap on mobile
.hero__trust: margin-top = var(--space-3) (24px)
```

### Interactive States

```css
/* Large buttons inherit .btn--primary states plus: */
.btn--lg {
  padding: 14px 28px;
  font-size: 1rem;
  border-radius: var(--radius-md);
  gap: 8px;
}
.btn--outline {
  background: transparent;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  color: #f8fafc;
}
.btn--outline:hover {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.06);
}
```

---

## 3. Features Section

### Purpose

Three to six feature highlights in a card grid. Light background, icon + heading + copy per card. Optional sticky left-rail layout at desktop.

### HTML Structure

```html
<section id="features" class="features" aria-labelledby="features-heading">
  <div class="container">
    <header class="section-header">
      <p class="section-eyebrow">Why CloudPulse</p>
      <h2 id="features-heading" class="section-heading">Everything you need to own your uptime</h2>
      <p class="section-subheading">
        Built for platform engineers who care about observability at scale — without drowning in
        dashboards.
      </p>
    </header>

    <ul class="features__grid" role="list">
      <li class="feature-card">
        <div class="feature-card__icon" aria-hidden="true">
          <svg><!-- icon: activity --></svg>
        </div>
        <h3 class="feature-card__title">Real-time monitoring</h3>
        <p class="feature-card__body">
          Sub-second metric ingestion across cloud providers with no sampling or aggregation lag.
        </p>
        <a href="/features/monitoring" class="feature-card__link">
          Learn more
          <svg aria-hidden="true"><!-- arrow-right --></svg>
        </a>
      </li>

      <li class="feature-card">
        <div class="feature-card__icon" aria-hidden="true">
          <svg><!-- icon: bell --></svg>
        </div>
        <h3 class="feature-card__title">Intelligent alerting</h3>
        <p class="feature-card__body">
          ML-powered anomaly detection that learns your baselines and only fires when it matters.
        </p>
        <a href="/features/alerting" class="feature-card__link">
          Learn more
          <svg aria-hidden="true"><!-- arrow-right --></svg>
        </a>
      </li>

      <li class="feature-card feature-card--accent">
        <div class="feature-card__icon" aria-hidden="true">
          <svg><!-- icon: dollar-sign --></svg>
        </div>
        <h3 class="feature-card__title">Cost intelligence</h3>
        <p class="feature-card__body">
          Automatically surface waste and right-sizing opportunities across your entire cloud bill.
        </p>
        <a href="/features/costs" class="feature-card__link">
          Learn more
          <svg aria-hidden="true"><!-- arrow-right --></svg>
        </a>
      </li>

      <!-- Repeat for remaining features -->
    </ul>
  </div>
</section>
```

### CSS Approach

```css
.features {
  background: #f8fafc;
  padding-block: var(--space-8); /* 64px mobile */
}

@media (min-width: 768px) {
  .features {
    padding-block: var(--space-10);
  }
}
@media (min-width: 1024px) {
  .features {
    padding-block: var(--space-12);
  }
}

/* Grid */
.features__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr; /* 1-col mobile */
  gap: var(--space-3); /* 24px */
  margin-top: var(--space-6); /* 48px from header */
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

/* Card */
.feature-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-xl);
  padding: var(--space-4); /* 32px */
  display: flex;
  flex-direction: column;
  gap: var(--space-2); /* 16px */
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.feature-card:hover {
  border-color: rgba(37, 99, 235, 0.35);
  box-shadow: var(--shadow-xl);
  transform: translateY(-4px);
}

/* Accent variant — first featured card */
.feature-card--accent {
  background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
  border-color: rgba(37, 99, 235, 0.3);
}
.feature-card--accent .feature-card__title,
.feature-card--accent .feature-card__body {
  color: #f8fafc;
}
.feature-card--accent .feature-card__body {
  color: #94a3b8;
}
.feature-card--accent .feature-card__link {
  color: #10b981;
}

/* Icon container */
.feature-card__icon {
  width: 48px;
  height: 48px;
  background: rgba(37, 99, 235, 0.1);
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  color: #2563eb;
  flex-shrink: 0;
}

/* Link */
.feature-card__link {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
  transition:
    gap 0.15s ease,
    color 0.15s ease;
}
.feature-card__link:hover {
  gap: 10px;
  color: #1e40af;
}
```

### Color Application

| Element                   | Color                      |
| ------------------------- | -------------------------- |
| Section background        | #f8fafc                    |
| Card background (default) | #ffffff                    |
| Card border (default)     | #e2e8f0                    |
| Card border (hover)       | rgba(37,99,235,0.35)       |
| Icon container bg         | rgba(37,99,235,0.10)       |
| Icon SVG                  | #2563EB                    |
| Feature title             | #0f172a                    |
| Feature body              | #334155                    |
| Feature link              | #2563EB                    |
| Accent card bg            | #1e293b → #0f172a gradient |

### Typography

| Element         | Size                        | Weight | Line Height |
| --------------- | --------------------------- | ------ | ----------- |
| Section eyebrow | 0.8125rem                   | 700    | 1.25        |
| Section heading | clamp(1.75rem, 3vw, 2.5rem) | 700    | 1.2         |
| Section sub     | 1.0625rem (17px)            | 400    | 1.7         |
| Card title      | 1.125rem (18px)             | 600    | 1.35        |
| Card body       | 0.9375rem (15px)            | 400    | 1.6         |
| Card link       | 0.875rem (14px)             | 600    | 1.25        |

### Section Header (Reusable)

```css
.section-header {
  max-width: 640px;
  margin-inline: auto;
  text-align: center;
}
.section-eyebrow {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2563eb;
  margin-bottom: var(--space-2);
}
.section-heading {
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.015em;
  color: #0f172a;
  margin-bottom: var(--space-2);
}
.section-subheading {
  font-size: 1.0625rem;
  line-height: 1.7;
  color: #64748b;
}

/* Inverted (dark sections) */
.section-header--inverted .section-heading {
  color: #f8fafc;
}
.section-header--inverted .section-subheading {
  color: #94a3b8;
}
```

---

## 4. Pricing Section

### Purpose

Dark-background section with three pricing tiers. Middle tier is highlighted as the recommended plan.

### HTML Structure

```html
<section id="pricing" class="pricing" aria-labelledby="pricing-heading">
  <div class="container">
    <header class="section-header section-header--inverted">
      <p class="section-eyebrow">Simple pricing</p>
      <h2 id="pricing-heading" class="section-heading">Plans that grow with your stack</h2>
      <p class="section-subheading">All plans include a 14-day trial. No credit card required.</p>
    </header>

    <!-- Toggle: Monthly / Annual -->
    <div class="pricing__toggle" role="group" aria-label="Billing period">
      <button class="toggle__btn toggle__btn--active" data-period="monthly" aria-pressed="true">
        Monthly
      </button>
      <button class="toggle__btn" data-period="annual" aria-pressed="false">
        Annual
        <span class="toggle__badge">Save 20%</span>
      </button>
    </div>

    <div class="pricing__grid">
      <!-- Starter -->
      <article class="pricing-card" aria-label="Starter plan">
        <header class="pricing-card__header">
          <h3 class="pricing-card__name">Starter</h3>
          <p class="pricing-card__tagline">Perfect for small teams shipping fast</p>
        </header>
        <div class="pricing-card__price">
          <span class="price__amount">$29</span>
          <span class="price__period">/ mo</span>
        </div>
        <a href="/signup?plan=starter" class="btn btn--outline-blue btn--full">
          Start free trial
        </a>
        <ul class="pricing-card__features" role="list">
          <li class="feature-item">
            <svg class="feature-item__check" aria-hidden="true"><!-- check --></svg>
            Up to 10 hosts
          </li>
          <li class="feature-item">
            <svg class="feature-item__check" aria-hidden="true"><!-- check --></svg>
            30-day metric retention
          </li>
          <li class="feature-item">
            <svg class="feature-item__check" aria-hidden="true"><!-- check --></svg>
            5 alert channels
          </li>
          <li class="feature-item feature-item--muted">
            <svg class="feature-item__x" aria-hidden="true"><!-- x --></svg>
            Cost intelligence
          </li>
          <li class="feature-item feature-item--muted">
            <svg class="feature-item__x" aria-hidden="true"><!-- x --></svg>
            SSO / SAML
          </li>
        </ul>
      </article>

      <!-- Pro — featured -->
      <article class="pricing-card pricing-card--featured" aria-label="Pro plan (recommended)">
        <div class="pricing-card__badge">Most popular</div>
        <header class="pricing-card__header">
          <h3 class="pricing-card__name">Pro</h3>
          <p class="pricing-card__tagline">For growing engineering teams</p>
        </header>
        <div class="pricing-card__price">
          <span class="price__amount">$99</span>
          <span class="price__period">/ mo</span>
        </div>
        <a href="/signup?plan=pro" class="btn btn--primary btn--full"> Start free trial </a>
        <ul class="pricing-card__features" role="list">
          <li class="feature-item">Up to 100 hosts</li>
          <li class="feature-item">13-month metric retention</li>
          <li class="feature-item">Unlimited alert channels</li>
          <li class="feature-item">Cost intelligence</li>
          <li class="feature-item feature-item--muted">SSO / SAML</li>
        </ul>
      </article>

      <!-- Enterprise -->
      <article class="pricing-card" aria-label="Enterprise plan">
        <header class="pricing-card__header">
          <h3 class="pricing-card__name">Enterprise</h3>
          <p class="pricing-card__tagline">Custom scale, compliance and support</p>
        </header>
        <div class="pricing-card__price">
          <span class="price__amount">Custom</span>
        </div>
        <a href="/contact" class="btn btn--outline-blue btn--full"> Contact sales </a>
        <ul class="pricing-card__features" role="list">
          <li class="feature-item">Unlimited hosts</li>
          <li class="feature-item">Unlimited retention</li>
          <li class="feature-item">SLA guarantees</li>
          <li class="feature-item">SSO / SAML</li>
          <li class="feature-item">Dedicated CSM</li>
        </ul>
      </article>
    </div>
  </div>
</section>
```

### CSS Approach

```css
.pricing {
  background: #0f172a;
  padding-block: var(--space-8);
}
@media (min-width: 768px) {
  .pricing {
    padding-block: var(--space-10);
  }
}
@media (min-width: 1024px) {
  .pricing {
    padding-block: var(--space-12);
  }
}

/* Toggle */
.pricing__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-full);
  padding: 4px;
  width: fit-content;
  margin: var(--space-5) auto var(--space-6); /* 40px 48px */
}
.toggle__btn {
  padding: 8px 20px;
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 600;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition:
    background 0.2s,
    color 0.2s;
}
.toggle__btn--active {
  background: #2563eb;
  color: #ffffff;
}
.toggle__badge {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
}

/* Grid */
.pricing__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}
@media (min-width: 768px) {
  .pricing__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .pricing__grid {
    grid-template-columns: repeat(3, 1fr);
    align-items: start;
  }
}

/* Card */
.pricing-card {
  position: relative;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  backdrop-filter: blur(4px);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.pricing-card:hover {
  border-color: rgba(37, 99, 235, 0.4);
  box-shadow:
    0 0 0 1px rgba(37, 99, 235, 0.15),
    var(--shadow-xl);
}

/* Featured card */
.pricing-card--featured {
  background: linear-gradient(145deg, rgba(37, 99, 235, 0.2) 0%, rgba(30, 64, 175, 0.15) 100%);
  border-color: rgba(37, 99, 235, 0.5);
  box-shadow:
    0 0 0 1px rgba(37, 99, 235, 0.25),
    0 24px 48px rgba(37, 99, 235, 0.15);
}
@media (min-width: 1024px) {
  .pricing-card--featured {
    transform: scale(1.03);
    z-index: 1;
  }
}

.pricing-card__badge {
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #2563eb, #1e40af);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 16px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  letter-spacing: 0.04em;
}

/* Price */
.price__amount {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  line-height: 1;
  color: #f8fafc;
}
.price__period {
  font-size: 1rem;
  color: #64748b;
}

/* Feature list */
.pricing-card__features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: var(--space-3);
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9375rem;
  color: #94a3b8;
}
.feature-item__check {
  color: #10b981;
  flex-shrink: 0;
}
.feature-item--muted {
  opacity: 0.4;
}
```

### Color Application

| Element                  | Color                                   |
| ------------------------ | --------------------------------------- |
| Section background       | #0f172a                                 |
| Default card background  | rgba(30,41,59,0.60)                     |
| Featured card background | rgba(37,99,235,0.20) gradient           |
| Featured card border     | rgba(37,99,235,0.50)                    |
| "Most popular" badge     | #2563EB → #1E40AF gradient              |
| Price amount             | #f8fafc                                 |
| Price period             | #64748b                                 |
| Feature check icon       | #10B981 (accent)                        |
| Active toggle button     | #2563EB                                 |
| Save badge               | rgba(16,185,129,0.20) bg / #10B981 text |

---

## 5. Testimonials Section

### Purpose

Social proof grid with headshots, quotes, name, title, and company. Light background. Auto-scrolling carousel on mobile, grid on desktop.

### HTML Structure

```html
<section id="testimonials" class="testimonials" aria-labelledby="testimonials-heading">
  <div class="container">
    <header class="section-header">
      <p class="section-eyebrow">Customer stories</p>
      <h2 id="testimonials-heading" class="section-heading">
        Trusted by engineering teams at scale
      </h2>
    </header>

    <!-- Logo bar -->
    <div class="testimonials__logos" aria-label="Featured companies" role="list">
      <img src="/logos/acme.svg" alt="Acme Corp" class="logo-item" />
      <img src="/logos/orbit.svg" alt="Orbit" class="logo-item" />
      <img src="/logos/stackr.svg" alt="Stackr" class="logo-item" />
      <img src="/logos/meridian.svg" alt="Meridian" class="logo-item" />
      <img src="/logos/prism.svg" alt="Prism" class="logo-item" />
    </div>

    <!-- Quote grid -->
    <ul class="testimonials__grid" role="list">
      <li>
        <blockquote class="testimonial-card">
          <div class="testimonial-card__stars" aria-label="5 out of 5 stars">
            <!-- 5× star SVGs -->
          </div>
          <p class="testimonial-card__quote">
            "CloudPulse caught a memory leak in our Kubernetes cluster before our on-call did.
            That's the dream."
          </p>
          <footer class="testimonial-card__author">
            <img
              src="/avatars/sarah.webp"
              alt="Sarah K."
              class="author__avatar"
              width="40"
              height="40"
            />
            <div class="author__meta">
              <cite class="author__name">Sarah K.</cite>
              <span class="author__role">Staff SRE, Acme Corp</span>
            </div>
          </footer>
        </blockquote>
      </li>

      <!-- Repeat for 5 more testimonials -->
    </ul>
  </div>
</section>
```

### CSS Approach

```css
.testimonials {
  background: #ffffff;
  padding-block: var(--space-8);
}
@media (min-width: 768px) {
  .testimonials {
    padding-block: var(--space-10);
  }
}
@media (min-width: 1024px) {
  .testimonials {
    padding-block: var(--space-12);
  }
}

/* Logo strip */
.testimonials__logos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-4) var(--space-5);
  margin: var(--space-6) 0;
  padding: var(--space-4) 0;
  border-block: 1px solid #e2e8f0;
}
.logo-item {
  height: 28px;
  width: auto;
  filter: grayscale(1) opacity(0.45);
  transition: filter 0.2s;
}
.logo-item:hover {
  filter: grayscale(0) opacity(1);
}

/* Masonry-ish grid */
.testimonials__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
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

/* Card */
.testimonial-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}
.testimonial-card:hover {
  border-color: rgba(37, 99, 235, 0.25);
  box-shadow: var(--shadow-lg);
  transform: translateY(-3px);
}

/* Stars */
.testimonial-card__stars {
  display: flex;
  gap: 3px;
  color: #f59e0b; /* amber — external brand standard for ratings */
}

/* Quote */
.testimonial-card__quote {
  font-size: 0.9375rem;
  line-height: 1.65;
  color: #334155;
  margin: 0;
  flex: 1;
}

/* Author */
.testimonial-card__author {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid #e2e8f0;
}
.author__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.author__name {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  font-style: normal;
  color: #0f172a;
}
.author__role {
  display: block;
  font-size: 0.8125rem;
  color: #64748b;
}
```

### Color Application

| Element            | Color           |
| ------------------ | --------------- |
| Section background | #ffffff         |
| Card background    | #f8fafc         |
| Card border        | #e2e8f0         |
| Star icons         | #F59E0B (amber) |
| Quote text         | #334155         |
| Author name        | #0f172a         |
| Author role        | #64748b         |
| Logo strip tint    | grayscale 45%   |

---

## 6. Integrations Section

### Purpose

Logo cloud / grid showcasing ecosystem integrations. Light grey background. Simple, clean, icon-led.

### HTML Structure

```html
<section id="integrations" class="integrations" aria-labelledby="integrations-heading">
  <div class="container">
    <header class="section-header">
      <p class="section-eyebrow">Integrations</p>
      <h2 id="integrations-heading" class="section-heading">Plugs into your existing workflow</h2>
      <p class="section-subheading">
        Connect in minutes — not days. CloudPulse supports 120+ integrations out of the box.
      </p>
    </header>

    <!-- Category filter tabs -->
    <div class="integrations__filters" role="tablist" aria-label="Integration categories">
      <button role="tab" aria-selected="true" class="filter-tab filter-tab--active">All</button>
      <button role="tab" aria-selected="false" class="filter-tab">Cloud</button>
      <button role="tab" aria-selected="false" class="filter-tab">Data</button>
      <button role="tab" aria-selected="false" class="filter-tab">CI/CD</button>
      <button role="tab" aria-selected="false" class="filter-tab">Alerting</button>
    </div>

    <ul class="integrations__grid" role="list" aria-label="Available integrations">
      <li>
        <a href="/integrations/aws" class="integration-card" aria-label="AWS integration">
          <img
            src="/logos/aws.svg"
            alt="Amazon Web Services"
            class="integration-card__logo"
            width="48"
            height="48"
          />
          <span class="integration-card__name">AWS</span>
        </a>
      </li>
      <!-- Repeat for GCP, Azure, Datadog, PagerDuty, Slack, GitHub,
           Terraform, Kubernetes, Prometheus, Grafana, etc. -->
    </ul>

    <div class="integrations__cta">
      <a href="/integrations" class="btn btn--ghost-dark">
        See all 120+ integrations
        <svg aria-hidden="true"><!-- arrow-right --></svg>
      </a>
    </div>
  </div>
</section>
```

### CSS Approach

```css
.integrations {
  background: #f8fafc;
  padding-block: var(--space-8);
}
@media (min-width: 768px) {
  .integrations {
    padding-block: var(--space-10);
  }
}
@media (min-width: 1024px) {
  .integrations {
    padding-block: var(--space-12);
  }
}

/* Filter tabs */
.integrations__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  justify-content: center;
  margin: var(--space-5) 0 var(--space-4);
}
.filter-tab {
  padding: 8px 20px;
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 500;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}
.filter-tab:hover {
  border-color: #94a3b8;
  color: #0f172a;
}
.filter-tab--active {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
  font-weight: 600;
}

/* Grid */
.integrations__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
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

/* Integration card */
.integration-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #334155;
  font-size: 0.8125rem;
  font-weight: 500;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    transform 0.15s;
  aspect-ratio: 1;
  justify-content: center;
}
.integration-card:hover {
  border-color: rgba(37, 99, 235, 0.35);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.integration-card__logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

/* CTA */
.integrations__cta {
  text-align: center;
  margin-top: var(--space-5);
}
.btn--ghost-dark {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.9375rem;
  color: #2563eb;
  background: transparent;
  border: 1.5px solid #e2e8f0;
  text-decoration: none;
  transition:
    border-color 0.15s,
    background 0.15s,
    gap 0.15s;
}
.btn--ghost-dark:hover {
  border-color: #2563eb;
  background: rgba(37, 99, 235, 0.05);
  gap: 12px;
}
```

### Color Application

| Element            | Color                     |
| ------------------ | ------------------------- |
| Section background | #f8fafc                   |
| Card background    | #ffffff                   |
| Card border        | #e2e8f0                   |
| Active filter      | #2563EB bg / white text   |
| Default filter     | #ffffff bg / #64748b text |
| Card hover border  | rgba(37,99,235,0.35)      |
| Card name text     | #334155                   |
| CTA link color     | #2563EB                   |

---

## 7. FAQ Section

### Purpose

Accordion-based FAQ for objection handling and pre-sales support. White background. Clean, readable.

### HTML Structure

```html
<section id="faq" class="faq" aria-labelledby="faq-heading">
  <div class="container">
    <div class="faq__inner">
      <header class="faq__header">
        <p class="section-eyebrow">FAQ</p>
        <h2 id="faq-heading" class="section-heading">Common questions</h2>
        <p class="section-subheading">
          Still have questions?
          <a href="/contact" class="faq__contact-link">Chat with our team.</a>
        </p>
      </header>

      <dl class="faq__list">
        <div class="faq__item">
          <dt>
            <button
              class="faq__question"
              aria-expanded="false"
              aria-controls="faq-1-answer"
              id="faq-1-trigger"
            >
              How does the 14-day trial work?
              <svg class="faq__chevron" aria-hidden="true"><!-- chevron-down --></svg>
            </button>
          </dt>
          <dd
            class="faq__answer"
            id="faq-1-answer"
            role="region"
            aria-labelledby="faq-1-trigger"
            hidden
          >
            <div class="faq__answer-inner">
              <p>
                Sign up with your work email — no credit card required. You get full Pro feature
                access for 14 days. After your trial you can downgrade to Starter or choose a paid
                plan.
              </p>
            </div>
          </dd>
        </div>

        <!-- Repeat for remaining FAQ items -->
      </dl>
    </div>
  </div>
</section>
```

### CSS Approach

```css
.faq {
  background: #ffffff;
  padding-block: var(--space-8);
}
@media (min-width: 768px) {
  .faq {
    padding-block: var(--space-10);
  }
}
@media (min-width: 1024px) {
  .faq {
    padding-block: var(--space-12);
  }
}

/* Two-column layout at desktop */
.faq__inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
@media (min-width: 1024px) {
  .faq__inner {
    flex-direction: row;
    gap: var(--space-12);
    align-items: flex-start;
  }
  .faq__header {
    flex: 0 0 320px;
    position: sticky;
    top: 96px; /* sticks below nav */
    text-align: left;
  }
  .faq__list {
    flex: 1;
  }
}

/* List */
.faq__list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid #e2e8f0;
}

/* Item */
.faq__item {
  border-bottom: 1px solid #e2e8f0;
}

/* Question button */
.faq__question {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) 0; /* 24px top/bottom */
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: #0f172a;
  text-align: left;
  transition: color 0.15s;
}
.faq__question:hover {
  color: #2563eb;
}

.faq__chevron {
  flex-shrink: 0;
  color: #94a3b8;
  transition:
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s;
}
.faq__item--open .faq__chevron {
  transform: rotate(180deg);
  color: #2563eb;
}

/* Answer — animated with CSS grid trick */
.faq__answer {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.faq__answer:not([hidden]) {
  display: grid;
  grid-template-rows: 1fr;
}
.faq__answer[hidden] {
  display: grid;
}

.faq__answer-inner {
  overflow: hidden;
  padding-bottom: var(--space-3);
}
.faq__answer-inner p {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: #64748b;
  margin: 0;
}

/* Contact link */
.faq__contact-link {
  color: #2563eb;
  font-weight: 600;
  text-decoration: none;
}
.faq__contact-link:hover {
  text-decoration: underline;
}
```

### Color Application

| Element            | Color   |
| ------------------ | ------- |
| Section background | #ffffff |
| Divider lines      | #e2e8f0 |
| Question text      | #0f172a |
| Question hover     | #2563EB |
| Chevron default    | #94a3b8 |
| Chevron open       | #2563EB |
| Answer text        | #64748b |
| Contact link       | #2563EB |

### Typography

| Element     | Size        | Weight | Line Height |
| ----------- | ----------- | ------ | ----------- |
| Question    | 1rem (16px) | 600    | 1.4         |
| Answer body | 0.9375rem   | 400    | 1.7         |

---

## 8. Footer

### Purpose

Site-wide footer with navigation, legal links, social icons, and brand statement. Dark background.

### HTML Structure

```html
<footer class="footer" role="contentinfo">
  <div class="container">
    <!-- Upper footer: brand + columns -->
    <div class="footer__upper">
      <!-- Brand column -->
      <div class="footer__brand">
        <a href="/" class="footer__logo" aria-label="CloudPulse home">
          <img src="/logo-white.svg" alt="CloudPulse" width="140" height="32" />
        </a>
        <p class="footer__tagline">Real-time observability for modern cloud infrastructure.</p>
        <div class="footer__social" aria-label="Social media links">
          <a
            href="https://twitter.com/cloudpulse"
            aria-label="Twitter"
            class="social-link"
            rel="noopener noreferrer"
          >
            <svg aria-hidden="true"><!-- twitter --></svg>
          </a>
          <a
            href="https://linkedin.com/company/cloudpulse"
            aria-label="LinkedIn"
            class="social-link"
            rel="noopener noreferrer"
          >
            <svg aria-hidden="true"><!-- linkedin --></svg>
          </a>
          <a
            href="https://github.com/cloudpulse"
            aria-label="GitHub"
            class="social-link"
            rel="noopener noreferrer"
          >
            <svg aria-hidden="true"><!-- github --></svg>
          </a>
        </div>
      </div>

      <!-- Navigation columns -->
      <nav class="footer__nav" aria-label="Footer navigation">
        <div class="footer__col">
          <h3 class="footer__col-heading">Product</h3>
          <ul role="list">
            <li><a href="/features">Features</a></li>
            <li><a href="/pricing">Pricing</a></li>
            <li><a href="/integrations">Integrations</a></li>
            <li><a href="/changelog">Changelog</a></li>
            <li><a href="/roadmap">Roadmap</a></li>
          </ul>
        </div>

        <div class="footer__col">
          <h3 class="footer__col-heading">Developers</h3>
          <ul role="list">
            <li><a href="/docs">Documentation</a></li>
            <li><a href="/api">API reference</a></li>
            <li><a href="/status">Status page</a></li>
            <li><a href="https://github.com/cloudpulse">GitHub</a></li>
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
      </nav>
    </div>

    <!-- Lower footer: legal -->
    <div class="footer__lower">
      <p class="footer__copyright">&copy; 2026 CloudPulse, Inc. All rights reserved.</p>
      <ul class="footer__legal" role="list">
        <li><a href="/privacy">Privacy policy</a></li>
        <li><a href="/terms">Terms of service</a></li>
        <li><a href="/security">Security</a></li>
        <li><a href="/cookies">Cookie preferences</a></li>
      </ul>
    </div>
  </div>
</footer>
```

### CSS Approach

```css
.footer {
  background: #0f172a;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-block-start: var(--space-10);
  padding-block-end: var(--space-6);
}

/* Upper footer */
.footer__upper {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
@media (min-width: 768px) {
  .footer__upper {
    flex-direction: row;
    gap: var(--space-8);
  }
  .footer__brand {
    flex: 0 0 240px;
  }
  .footer__nav {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }
}

/* Brand column */
.footer__tagline {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: #64748b;
  margin: var(--space-2) 0;
  max-width: 240px;
}

/* Social icons */
.footer__social {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-2);
}
.social-link {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  color: #64748b;
  text-decoration: none;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}
.social-link:hover {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

/* Nav columns */
.footer__col-heading {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #f8fafc;
  margin-bottom: var(--space-2);
}
.footer__col ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.footer__col a {
  font-size: 0.9375rem;
  color: #64748b;
  text-decoration: none;
  transition: color 0.15s;
}
.footer__col a:hover {
  color: #f8fafc;
}

/* Lower footer */
.footer__lower {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-4);
  align-items: flex-start;
}
@media (min-width: 768px) {
  .footer__lower {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.footer__copyright {
  font-size: 0.875rem;
  color: #64748b;
}

.footer__legal {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.footer__legal a {
  font-size: 0.875rem;
  color: #64748b;
  text-decoration: none;
  transition: color 0.15s;
}
.footer__legal a:hover {
  color: #f8fafc;
}
```

### Color Application

| Element              | Color                  |
| -------------------- | ---------------------- |
| Footer background    | #0f172a                |
| Top border           | rgba(255,255,255,0.06) |
| Logo                 | white SVG              |
| Tagline text         | #64748b                |
| Social icon bg       | rgba(255,255,255,0.06) |
| Social icon hover bg | #2563EB                |
| Column heading       | #f8fafc                |
| Column link          | #64748b                |
| Column link hover    | #f8fafc                |
| Copyright text       | #64748b                |
| Legal link           | #64748b                |

---

## Reusable Button System

```css
/* Base */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px var(--space-2);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.25;
  text-decoration: none;
  cursor: pointer;
  border: none;
  white-space: nowrap;
  transition:
    background 0.15s,
    box-shadow 0.15s,
    transform 0.1s,
    border-color 0.15s,
    color 0.15s;
}
.btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 3px;
}
.btn:active {
  transform: scale(0.97);
}

/* Variants */
.btn--primary {
  background: #2563eb;
  color: #ffffff;
}
.btn--primary:hover {
  background: #1e40af;
  box-shadow: var(--shadow-blue);
}

.btn--secondary {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}
.btn--secondary:hover {
  background: rgba(37, 99, 235, 0.18);
}

.btn--ghost {
  background: transparent;
  color: #94a3b8;
  border: 1.5px solid transparent;
}
.btn--ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.btn--outline {
  background: transparent;
  color: #f8fafc;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
}
.btn--outline:hover {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.06);
}

.btn--outline-blue {
  background: transparent;
  color: #60a5fa;
  border: 1.5px solid rgba(96, 165, 250, 0.35);
}
.btn--outline-blue:hover {
  border-color: #2563eb;
  color: #93c5fd;
  background: rgba(37, 99, 235, 0.08);
}

/* Sizes */
.btn--sm {
  padding: 7px 14px;
  font-size: 0.875rem;
}
.btn--lg {
  padding: 14px 28px;
  font-size: 1rem;
}
.btn--xl {
  padding: 18px 36px;
  font-size: 1.0625rem;
}
.btn--full {
  width: 100%;
}

/* Icon utility */
.btn__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.btn--lg .btn__icon {
  width: 18px;
  height: 18px;
}
```

---

## Accessibility Requirements

1. **Focus management** — All interactive elements must have a visible `:focus-visible` ring using `outline: 2px solid #2563EB; outline-offset: 2px`.
2. **Skip link** — `<a href="#main-content" class="skip-link">Skip to main content</a>` as first child of `<body>`, visually hidden until focused.
3. **Motion** — All animations and transitions wrapped in `@media (prefers-reduced-motion: no-preference)` or disabled with `@media (prefers-reduced-motion: reduce)`.
4. **Color contrast** — All body text meets WCAG AA (4.5:1); all large text meets 3:1. #94a3b8 on #0f172a passes at 5.9:1.
5. **ARIA** — Mobile menu uses `aria-expanded`, `aria-controls`, `aria-hidden`, and `role="dialog"`. FAQ accordion uses `aria-expanded` and `hidden` attribute.
6. **Images** — All `<img>` elements include meaningful `alt` text; decorative images use `alt=""` and `aria-hidden="true"`.

---

## Responsive Breakpoint Summary

| Breakpoint | Width   | Layout changes                                                       |
| ---------- | ------- | -------------------------------------------------------------------- |
| Mobile     | < 768px | 1-column layout, hamburger menu, stacked sections                    |
| Tablet     | 768px+  | 2-column grids, desktop nav visible, wider section padding           |
| Desktop    | 1024px+ | 3-column grids, hero 2-col, FAQ sticky sidebar, max-width 1200px cap |

---

## 8px Spacing Grid Reference

| Token        | Value | Common Uses                                   |
| ------------ | ----- | --------------------------------------------- |
| `--space-1`  | 8px   | Icon gap, small padding, tight button padding |
| `--space-2`  | 16px  | Button padding, card gap (small), form fields |
| `--space-3`  | 24px  | Card padding (mobile), section sub-elements   |
| `--space-4`  | 32px  | Card padding (desktop), column gap            |
| `--space-5`  | 40px  | Between section header and content            |
| `--space-6`  | 48px  | Section header margin-bottom, footer padding  |
| `--space-8`  | 64px  | Section padding (mobile), hero gap            |
| `--space-10` | 80px  | Section padding (tablet)                      |
| `--space-12` | 96px  | Section padding (desktop)                     |
| `--space-16` | 128px | Hero top padding                              |
