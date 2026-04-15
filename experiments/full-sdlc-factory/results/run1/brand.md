# CloudPulse Brand Guidelines

**Version 1.0 — April 2026**

---

## Table of Contents

1. [Brand Foundation](#1-brand-foundation)
2. [Logo Usage](#2-logo-usage)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Tone of Voice](#5-tone-of-voice)
6. [Spacing and Layout Principles](#6-spacing-and-layout-principles)
7. [Imagery and Iconography](#7-imagery-and-iconography)
8. [Do's and Don'ts](#8-dos-and-donts)

---

## 1. Brand Foundation

### Mission Statement

> CloudPulse delivers real-time visibility into cloud infrastructure, empowering engineering teams to detect anomalies, optimize performance, and maintain uptime with confidence.

### Vision

To be the most trusted observability platform for teams operating at cloud scale — where complexity becomes clarity.

### Core Values

| Value           | Description                                               |
| --------------- | --------------------------------------------------------- |
| **Clarity**     | We turn noisy infrastructure data into actionable signal. |
| **Reliability** | Our platform is the source of truth teams depend on 24/7. |
| **Velocity**    | We help teams move fast without losing visibility.        |
| **Trust**       | We earn confidence through transparency and accuracy.     |

### Brand Personality

CloudPulse sits at the intersection of technical rigor and human-centered design. The brand feels:

- **Precise** — Every element communicates accuracy and data fidelity.
- **Calm under pressure** — The visual language reassures engineers during incidents.
- **Intelligent** — The brand signals depth without being inaccessible.
- **Modern** — Clean, forward-looking, devoid of legacy enterprise heaviness.

---

## 2. Logo Usage

### Logo Concept

The CloudPulse logo combines a stylized pulse waveform integrated with an abstract cloud silhouette, rendered in the primary electric blue. The wordmark uses Inter Bold with tracked uppercase lettering for "CLOUD" and regular weight for "Pulse" to create visual hierarchy within the name itself.

### Clear Space

Always maintain a minimum clear space around the logo equal to the height of the capital "C" in the wordmark (referred to as **1x**). No other graphic elements, text, or imagery may intrude within this zone.

```
        1x
    ┌────────────────────────┐
 1x │                        │ 1x
    │   [CloudPulse Logo]    │
    │                        │
    └────────────────────────┘
        1x
```

### Minimum Size

| Medium             | Minimum Width           |
| ------------------ | ----------------------- |
| Digital / Screen   | 120px                   |
| Print              | 32mm                    |
| Favicon / App Icon | 16px (symbol mark only) |

### Approved Color Variants

| Variant                                         | Usage Context                                          |
| ----------------------------------------------- | ------------------------------------------------------ |
| **Full color** (`#2563EB` mark + dark wordmark) | Primary use on white or light backgrounds              |
| **Reversed white** (all white)                  | Use on `#2563EB`, `#1E40AF`, or dark/photo backgrounds |
| **Single color dark** (`#0F172A`)               | Single-color print, embroidery, or engraving           |
| **Single color blue** (`#2563EB`)               | Branded merchandise, limited-color contexts            |

### Logo Don'ts

- Do not stretch, skew, or distort the logo in any dimension.
- Do not apply drop shadows, gradients, or outer glows to the logo.
- Do not recolor the logo outside of the approved variants above.
- Do not place the full-color logo on a busy photographic background.
- Do not recreate the logo in an alternate typeface.
- Do not use the wordmark without the symbol mark except in space-constrained inline text contexts (e.g., a breadcrumb trail in a UI).
- Do not rotate the logo.
- Do not lock up the logo with slogans or taglines without explicit brand approval.

### Symbol Mark (Icon Only)

The pulse-cloud symbol may be used independently as an app icon, favicon, or avatar. It must never appear at a size smaller than 16px and should always use an approved color variant.

---

## 3. Color System

### Primary Palette

| Role             | Name          | Hex       | RGB            | Usage                                              |
| ---------------- | ------------- | --------- | -------------- | -------------------------------------------------- |
| **Primary**      | Electric Blue | `#2563EB` | `37, 99, 235`  | CTAs, links, key UI elements, logo                 |
| **Primary Dark** | Deep Blue     | `#1E40AF` | `30, 64, 175`  | Hover states, sidebar backgrounds, section headers |
| **Accent**       | Emerald Green | `#10B981` | `16, 185, 129` | Success states, healthy status, positive deltas    |

### Neutral Palette (Slate)

| Role             | Name      | Hex       | Usage                                        |
| ---------------- | --------- | --------- | -------------------------------------------- |
| **Background**   | Slate 50  | `#F8FAFC` | Page and panel backgrounds                   |
| **Surface**      | Slate 100 | `#F1F5F9` | Card backgrounds, input fields               |
| **Border**       | Slate 200 | `#E2E8F0` | Dividers, borders, subtle separators         |
| **Muted Text**   | Slate 400 | `#94A3B8` | Placeholder text, secondary labels           |
| **Body Text**    | Slate 600 | `#475569` | Body copy, secondary headings                |
| **Heading Text** | Slate 800 | `#1E293B` | H1–H3 headings, primary labels               |
| **Near Black**   | Slate 950 | `#0F172A` | Maximum contrast text, dark mode backgrounds |

### Semantic / Status Colors

| State                  | Color         | Hex       | Notes                                                 |
| ---------------------- | ------------- | --------- | ----------------------------------------------------- |
| **Success / Healthy**  | Emerald Green | `#10B981` | Use accent color; pair with `#D1FAE5` background tint |
| **Warning / Degraded** | Amber         | `#F59E0B` | Infrastructure warnings, elevated latency             |
| **Error / Critical**   | Red           | `#EF4444` | Outages, threshold breaches, destructive actions      |
| **Info / In Progress** | Sky Blue      | `#0EA5E9` | Informational banners, loading states                 |

### Dark Mode Guidance

For dark mode surfaces, invert the neutral scale and shift primary usage as follows:

- Page background: `#0F172A` (Slate 950)
- Card/panel surface: `#1E293B` (Slate 800)
- Borders: `#334155` (Slate 700)
- Primary actions: `#3B82F6` (Blue 500 — slightly lighter for contrast compliance)
- All status/semantic colors remain consistent across light and dark modes.

### Accessibility

All text-on-background color pairings must meet **WCAG 2.1 AA** contrast requirements (4.5:1 for normal text, 3:1 for large text). The following pairings are pre-validated:

| Text                   | Background | Contrast Ratio | Pass            |
| ---------------------- | ---------- | -------------- | --------------- |
| `#1E293B` on `#F8FAFC` | Light      | 13.5:1         | AA / AAA        |
| `#FFFFFF` on `#2563EB` | Primary    | 4.6:1          | AA              |
| `#FFFFFF` on `#1E40AF` | Dark Blue  | 7.2:1          | AA / AAA        |
| `#FFFFFF` on `#10B981` | Emerald    | 2.9:1          | Large text only |

Note: White text on Emerald Green (`#10B981`) does not meet AA for body copy. Use `#065F46` (dark green) for text labels within success states.

---

## 4. Typography

### Type Scale and Font Stack

**Primary Typeface: Inter**

Inter is the default typeface across all digital surfaces. It is a variable font designed specifically for screen legibility, with a wide range of weights that support both data-dense dashboard interfaces and marketing copy.

```css
font-family:
  'Inter',
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  'Helvetica Neue',
  Arial,
  sans-serif;
```

**Monospace Typeface: JetBrains Mono**

Used exclusively for code snippets, CLI output, metric values in data tables, timestamps, and log lines.

```css
font-family:
  'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, 'SFMono-Regular', Menlo, Consolas,
  'Liberation Mono', monospace;
```

### Type Scale

| Token        | Size             | Line Height | Weight         | Usage                                     |
| ------------ | ---------------- | ----------- | -------------- | ----------------------------------------- |
| `display-xl` | 60px / 3.75rem   | 1.1         | 700 (Bold)     | Hero headlines, landing page H1           |
| `display-lg` | 48px / 3rem      | 1.15        | 700 (Bold)     | Section heroes, feature headers           |
| `heading-xl` | 36px / 2.25rem   | 1.2         | 600 (SemiBold) | Page titles (H1 in app)                   |
| `heading-lg` | 30px / 1.875rem  | 1.25        | 600 (SemiBold) | Card headers, modal titles (H2)           |
| `heading-md` | 24px / 1.5rem    | 1.3         | 600 (SemiBold) | Sub-section headers (H3)                  |
| `heading-sm` | 20px / 1.25rem   | 1.4         | 500 (Medium)   | Widget titles, panel headers (H4)         |
| `body-lg`    | 18px / 1.125rem  | 1.6         | 400 (Regular)  | Feature descriptions, lead paragraphs     |
| `body-md`    | 16px / 1rem      | 1.6         | 400 (Regular)  | Default body copy, form labels            |
| `body-sm`    | 14px / 0.875rem  | 1.5         | 400 (Regular)  | Secondary copy, UI labels, table cells    |
| `caption`    | 12px / 0.75rem   | 1.4         | 400 (Regular)  | Timestamps, helper text, footnotes        |
| `overline`   | 11px / 0.6875rem | 1.4         | 600 (SemiBold) | ALL CAPS category labels, section markers |
| `code`       | 14px / 0.875rem  | 1.6         | 400 (Regular)  | Inline code, mono data values             |

### Typography Rules

- **Hierarchy is non-negotiable.** Never use more than three type sizes on a single screen without a clear visual reason.
- **Weight communicates importance.** Reserve Bold (700) for display sizes and critical callouts only. Overuse of bold flattens hierarchy.
- **Line length matters.** Constrain body text columns to 60–80 characters (approximately 640px at 16px body) for optimal readability.
- **All-caps use is restricted** to `overline` tokens and button labels. Never set body copy or headings in all-caps.
- **Metric values** in dashboards (CPU %, latency ms, error rates) must always use the monospace stack to ensure digit alignment in tables and charts.
- **Avoid italic** for anything other than quotations, citations, or technical terms being introduced for the first time.

---

## 5. Tone of Voice

### Overview

CloudPulse speaks like a senior engineer who also cares about communication — technically credible, precise, and direct, but never cold, arrogant, or buried in jargon. The voice adapts to context: more conversational in onboarding and marketing, more precise and economical in product UI.

### Voice Attributes

#### Technically Credible

We know infrastructure. Our language reflects deep domain expertise without requiring the reader to prove theirs first. We use the correct terminology (p99 latency, ingestion pipeline, cardinality) but we define it when context demands.

- **Do:** "Your p99 latency spiked to 840ms at 14:32 UTC — likely correlated with the deployment on `api-gateway-v2`."
- **Don't:** "Something went wrong with your app's speed around 2pm."

#### Clear and Direct

We respect the reader's time. Sentences are tight. We prefer active voice. We don't bury the lead.

- **Do:** "Latency is elevated in us-east-1. Three services are affected."
- **Don't:** "It appears that there may be some elevated latency being experienced in certain services located in the us-east-1 region."

#### Professional but Approachable

We are not a faceless enterprise vendor. We are a tool built by engineers for engineers. Warmth is appropriate; excessive formality is not.

- **Do:** "Nice work — your error rate is down 40% this week."
- **Don't:** "We are pleased to inform you that your error rate metrics reflect a 40% improvement over the prior week period."

#### Honest About Uncertainty

When we don't know something, we say so. We distinguish between confirmed findings and probable causes.

- **Do:** "We detected an anomaly at 09:14 UTC. Root cause is unconfirmed — check the correlated events below."
- **Don't:** "Your database is causing the problem."

#### Empowering, Not Alarming

Incidents are stressful. CloudPulse's language during error states should orient, not panic. Present facts, surface context, suggest next steps.

- **Do:** "Critical alert: Pod `payments-worker-3` has been OOMKilled 4 times in 10 minutes. Suggested action: review memory limits in the deployment spec."
- **Don't:** "CRITICAL FAILURE DETECTED. IMMEDIATE ACTION REQUIRED."

### Writing by Context

| Context                       | Tone Guidance                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| **Marketing / Website**       | Confident, forward-looking, benefit-focused. Lead with outcomes, not features.       |
| **Onboarding / Empty States** | Warm and encouraging. Explain value quickly. Reduce cognitive load.                  |
| **Dashboard UI Labels**       | Economical, precise. Every word earns its place. Prefer nouns over sentences.        |
| **Alert Notifications**       | Factual, fast, actionable. Severity first, then context, then next step.             |
| **Error Messages**            | Honest, specific, non-blaming. Tell the user what happened and what to do.           |
| **Documentation**             | Instructional, structured, example-rich. Use second person ("you").                  |
| **Email Communications**      | Professional warmth. Subject lines state the fact; body provides context and action. |

### Words We Avoid

| Avoid                | Use Instead                           |
| -------------------- | ------------------------------------- |
| "Leverage"           | "Use"                                 |
| "Synergy"            | (Eliminate entirely)                  |
| "Robust"             | Be specific: "handles 10k events/sec" |
| "Seamless"           | Describe the actual experience        |
| "World-class"        | Substantiate the claim or cut it      |
| "Simple" / "Easy"    | Show, don't tell — let the UX speak   |
| "Empower" (overused) | Use sparingly; prefer action verbs    |

---

## 6. Spacing and Layout Principles

### Base Unit

CloudPulse uses an **8px base grid**. All spacing values — padding, margin, gap, and sizing — are multiples of 8.

| Token      | Value | Common Use                                         |
| ---------- | ----- | -------------------------------------------------- |
| `space-1`  | 4px   | Tight inline gaps, icon-to-label spacing           |
| `space-2`  | 8px   | Compact padding, list item gaps                    |
| `space-3`  | 12px  | Tag/chip padding, small component internal spacing |
| `space-4`  | 16px  | Default component padding, form field gaps         |
| `space-6`  | 24px  | Card internal padding, section element gaps        |
| `space-8`  | 32px  | Card-to-card gaps, panel internal whitespace       |
| `space-10` | 40px  | Major section separators in UI                     |
| `space-12` | 48px  | Section padding on marketing pages                 |
| `space-16` | 64px  | Hero padding, large section breaks                 |
| `space-24` | 96px  | Landing page section rhythm                        |
| `space-32` | 128px | Maximum section separation on desktop              |

### Layout Grid

**Dashboard / Application UI**

- 12-column grid
- Gutter: 24px
- Column margin (outer): 24px on tablet, 32px on desktop
- Maximum content width: 1440px (with auto side margins beyond this)

**Marketing / Website**

- 12-column grid
- Gutter: 32px
- Column margin (outer): 24px (mobile), 48px (tablet), auto (desktop)
- Maximum content width: 1280px for text, 1440px for full-bleed sections

### Breakpoints

| Name  | Min Width | Description                      |
| ----- | --------- | -------------------------------- |
| `xs`  | 0px       | Mobile portrait                  |
| `sm`  | 640px     | Mobile landscape / large mobile  |
| `md`  | 768px     | Tablet portrait                  |
| `lg`  | 1024px    | Tablet landscape / small desktop |
| `xl`  | 1280px    | Desktop                          |
| `2xl` | 1536px    | Wide desktop                     |

### Elevation and Depth

CloudPulse uses a three-level shadow system to communicate layering. Shadows are always cast downward and never colored.

| Level       | CSS Shadow                                                 | Usage                             |
| ----------- | ---------------------------------------------------------- | --------------------------------- |
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)`                               | Default card resting state        |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)`   | Hovered cards, dropdowns          |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05)` | Modals, popovers, command palette |

### Border Radius

| Token         | Value  | Usage                                  |
| ------------- | ------ | -------------------------------------- |
| `radius-sm`   | 4px    | Badges, tags, small chips              |
| `radius-md`   | 8px    | Buttons, input fields, small cards     |
| `radius-lg`   | 12px   | Standard cards, panels                 |
| `radius-xl`   | 16px   | Feature cards, marketing tiles         |
| `radius-full` | 9999px | Pills, avatar circles, toggle switches |

### Whitespace Philosophy

Whitespace is a first-class design element, not wasted space. In a monitoring platform where density is tempting, intentional whitespace:

- Reduces cognitive load during high-stress incidents.
- Creates clear visual groupings that guide attention.
- Signals confidence in the product — clutter communicates insecurity.

**Rules:**

- Never sacrifice readability for data density. If a widget feels crowded, the solution is better information architecture, not smaller text.
- Group related elements with proximity (tight spacing). Separate unrelated elements with generous whitespace.
- Consistent padding within a component category (all cards use the same internal padding) builds a sense of system coherence.

---

## 7. Imagery and Iconography

### Photography Style

When photography is used (primarily in marketing contexts):

- **Prefer:** Real engineering environments — terminal windows, multi-monitor setups, whiteboard architecture diagrams, candid team collaboration.
- **Avoid:** Generic stock photography of people smiling at laptops, handshake photos, abstract business imagery.
- **Color treatment:** Prefer cool-toned photography that complements the blue palette. Avoid warm-dominant or heavily saturated images.
- **Composition:** Photography used in hero sections should have sufficient visual "breathing room" to accept text overlays without requiring dark overlays above 40% opacity.

### Data Visualization

Charts, graphs, and monitoring visuals follow these conventions:

- **Primary data series:** `#2563EB` (Electric Blue)
- **Secondary data series:** `#10B981` (Emerald Green)
- **Tertiary data series:** `#8B5CF6` (Violet — for multi-series charts)
- **Quaternary data series:** `#F59E0B` (Amber)
- **Grid lines:** `#E2E8F0` (Slate 200) at 1px
- **Axis labels:** `body-sm` type token, `#94A3B8` (Slate 400)
- **Tooltip backgrounds:** `#1E293B` (Slate 800) with white text

### Iconography

- Use a single icon library consistently — **Lucide** is the recommended library for its clean, consistent 24px grid geometry and open license.
- Default icon stroke width: 1.5px.
- Icons must always be accompanied by a text label in UI contexts unless they are universally understood (close/X, search magnifier, settings gear) and space is genuinely constrained.
- Icon color should inherit from the surrounding text color; do not independently recolor icons unless conveying semantic meaning (a red warning icon).
- Do not mix icon libraries within a single product surface.

---

## 8. Do's and Don'ts

### Brand Do's

- Do lead with outcomes and user value, not feature lists.
- Do use real data and specific numbers in marketing where possible ("Monitor up to 10,000 metrics per second").
- Do maintain consistent spacing and type scale across all touchpoints.
- Do test every color pairing against WCAG 2.1 AA contrast standards before shipping.
- Do use the Emerald Green accent color exclusively for genuinely positive/successful states.
- Do give the logo adequate clear space in all applications.
- Do maintain Inter as the primary typeface — if it cannot be loaded, ensure the fallback stack is defined.

### Brand Don'ts

- Don't use the primary blue for error states — red is reserved for this and users have strong mental models.
- Don't use more than two typeface families in any single design.
- Don't apply gradients to the logo or primary UI chrome — flat color is preferred.
- Don't use centered text alignment for body copy — left-aligned text is more scannable and professional.
- Don't use the full color palette on a single screen. Restraint in color application increases the impact of semantic colors when they appear.
- Don't use decorative fonts or script typefaces in any context.
- Don't place the logo on a background color that creates less than 3:1 contrast with the logo mark.

---

## Appendix: Quick Reference Card

| Asset                    | Value                                   |
| ------------------------ | --------------------------------------- |
| Primary Color            | `#2563EB`                               |
| Primary Dark             | `#1E40AF`                               |
| Accent / Success         | `#10B981`                               |
| Warning                  | `#F59E0B`                               |
| Error                    | `#EF4444`                               |
| Background               | `#F8FAFC`                               |
| Heading Text             | `#1E293B`                               |
| Body Text                | `#475569`                               |
| Primary Font             | Inter (fallback: system-ui)             |
| Mono Font                | JetBrains Mono (fallback: ui-monospace) |
| Base Grid Unit           | 8px                                     |
| Default Border Radius    | 8px (radius-md)                         |
| Logo Clear Space         | 1x (cap-height of "C")                  |
| Min Logo Width (digital) | 120px                                   |

---

_CloudPulse Brand Guidelines — Maintained by the CloudPulse Design Team. For questions or approvals, contact the brand team before deviating from these standards._
