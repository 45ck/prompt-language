# CloudPulse Brand Guidelines

> Real-time cloud infrastructure visibility for modern engineering teams.

---

## Table of Contents

1. [Mission & Brand Foundation](#1-mission--brand-foundation)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Tone of Voice](#4-tone-of-voice)
5. [Logo Usage](#5-logo-usage)
6. [Spacing & Layout](#6-spacing--layout)
7. [Component & UI Principles](#7-component--ui-principles)

---

## 1. Mission & Brand Foundation

### Mission Statement

CloudPulse provides **real-time cloud infrastructure visibility** — empowering engineering and operations teams to monitor, understand, and act on their cloud environments with confidence and speed.

### Brand Pillars

| Pillar          | Description                                                             |
| --------------- | ----------------------------------------------------------------------- |
| **Clarity**     | Complex infrastructure data presented simply and intuitively            |
| **Reliability** | A product that teams trust when systems are under pressure              |
| **Speed**       | Real-time signals that arrive before problems escalate                  |
| **Credibility** | Built by engineers, for engineers — technically precise in every detail |

### Brand Personality

CloudPulse is **precise, calm, and dependable**. In moments of infrastructure stress, the product and its communication remain steady — never alarming, always actionable. The brand feels like a senior SRE standing beside you: knowledgeable, clear-headed, and direct.

---

## 2. Color Palette

### Primary Colors

These colors form the visual core of the CloudPulse identity. Use them consistently across UI surfaces, marketing materials, and communications.

#### Electric Blue — Primary Brand Color

```
Hex:   #2563EB
RGB:   37, 99, 235
HSL:   221°, 83%, 53%
Usage: Primary CTAs, active states, interactive elements, links, key data highlights
```

#### Deep Blue — Secondary Brand Color

```
Hex:   #1E40AF
RGB:   30, 64, 175
HSL:   224°, 71%, 40%
Usage: Hover states on primary elements, gradient endpoints, dark UI headers, section backgrounds
```

### Accent Color

#### Emerald Green — Success & Healthy States

```
Hex:   #10B981
RGB:   16, 185, 129
HSL:   160°, 84%, 39%
Usage: Success states, healthy service indicators, uptime badges, positive trend indicators, confirmation messages
```

> The emerald accent should be reserved exclusively for **positive/success states**. Avoid using it decoratively or as a general accent — its semantic meaning (healthy, OK, success) must remain unambiguous.

### Semantic Colors

Beyond the core palette, use these semantic assignments consistently across the product:

| State              | Color         | Hex       | Usage                              |
| ------------------ | ------------- | --------- | ---------------------------------- |
| Success / Healthy  | Emerald Green | `#10B981` | Services up, deployments succeeded |
| Warning / Degraded | Amber         | `#F59E0B` | Elevated latency, partial failures |
| Error / Critical   | Red           | `#EF4444` | Service down, threshold breached   |
| Info / Neutral     | Electric Blue | `#2563EB` | Informational banners, tooltips    |

### Neutral Palette — Slate Grays

The neutral palette provides the structural backbone of all UI surfaces and typography. All eight steps are derived from the Slate scale.

| Token Name    | Hex       | RGB           | Typical Usage                                           |
| ------------- | --------- | ------------- | ------------------------------------------------------- |
| `neutral-950` | `#0F172A` | 15, 23, 42    | Darkest backgrounds, dark mode base surface             |
| `neutral-900` | `#1E293B` | 30, 41, 59    | Dark sidebars, nav bars, card headers in dark mode      |
| `neutral-700` | `#334155` | 51, 65, 85    | Secondary text in dark mode, dividers on dark surfaces  |
| `neutral-500` | `#64748B` | 100, 116, 139 | Placeholder text, disabled states, meta labels          |
| `neutral-400` | `#94A3B8` | 148, 163, 184 | Subtle borders, secondary icons, timestamps             |
| `neutral-300` | `#CBD5E1` | 203, 213, 225 | Borders, dividers, input strokes in light mode          |
| `neutral-100` | `#F1F5F9` | 241, 245, 249 | Page backgrounds, zebra-stripe alternates, hover states |
| `neutral-50`  | `#F8FAFC` | 248, 250, 252 | Card surfaces, modal backgrounds, lightest surface      |

### Color Usage Rules

- Never use Electric Blue (`#2563EB`) as a background for large surface areas — it is an action and emphasis color only.
- Maintain a minimum contrast ratio of **4.5:1** for all body text (WCAG AA). Aim for **7:1** (WCAG AAA) wherever feasible.
- Do not combine Electric Blue text on Deep Blue backgrounds — insufficient contrast.
- The neutral palette must account for at least **60%** of any given screen's visual weight (60/30/10 rule: 60% neutral, 30% primary blues, 10% accent/semantic).

---

## 3. Typography

### Typeface

**Primary Typeface: Inter**

Inter is the preferred typeface for all CloudPulse interfaces and marketing materials. It is a variable font optimized for screen legibility at small sizes — ideal for dense dashboard environments.

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

If Inter is unavailable (e.g., embedded environments, email clients), fall through to the system font stack above.

**Monospace Typeface: JetBrains Mono / System Mono**

Used exclusively for code snippets, metric values, log output, CLI references, and config examples.

```css
font-family: 'JetBrains Mono', ui-monospace, 'Cascadia Code', 'Fira Code', 'Courier New', monospace;
```

### Type Scale

Based on a **1.25 modular scale (Major Third)** with a 16px base.

| Token       | Size            | Line Height  | Weight | Usage                                 |
| ----------- | --------------- | ------------ | ------ | ------------------------------------- |
| `text-xs`   | 12px / 0.75rem  | 1.5 (18px)   | 400    | Labels, badges, footnotes, timestamps |
| `text-sm`   | 14px / 0.875rem | 1.5 (21px)   | 400    | Secondary body, table rows, captions  |
| `text-base` | 16px / 1rem     | 1.6 (25.6px) | 400    | Primary body copy, descriptions       |
| `text-lg`   | 18px / 1.125rem | 1.5 (27px)   | 500    | Lead paragraphs, card descriptions    |
| `text-xl`   | 20px / 1.25rem  | 1.4 (28px)   | 500    | Section subheadings, widget titles    |
| `text-2xl`  | 24px / 1.5rem   | 1.3 (31px)   | 600    | Panel headings, modal titles          |
| `text-3xl`  | 30px / 1.875rem | 1.25 (38px)  | 600    | Page headings (h2)                    |
| `text-4xl`  | 36px / 2.25rem  | 1.2 (43px)   | 700    | Hero headings, marketing H1           |
| `text-5xl`  | 48px / 3rem     | 1.15 (55px)  | 700    | Landing page hero statements          |

### Font Weight Reference

| Weight   | Value | Usage                                      |
| -------- | ----- | ------------------------------------------ |
| Regular  | 400   | Body copy, descriptions, table data        |
| Medium   | 500   | UI labels, nav items, subtle emphasis      |
| Semibold | 600   | Headings H3–H4, card titles, CTAs          |
| Bold     | 700   | Headings H1–H2, hero copy, critical alerts |

### Typography Rules

- **Never** use more than two font weights on a single screen to avoid visual noise.
- Body copy maximum line length: **65–75 characters** (approx. 680px at 16px base).
- Letter spacing: apply `tracking-tight` (-0.025em) to headings 2xl and above. Body copy uses default tracking (0).
- Do not use italic for UI labels or data — reserve italics for inline quotes or editorial callouts only.
- Metric values (CPU %, latency ms, request counts) must always use the monospace typeface.

---

## 4. Tone of Voice

### Core Voice Attributes

| Attribute                | What It Means                                       | What to Avoid                                         |
| ------------------------ | --------------------------------------------------- | ----------------------------------------------------- |
| **Professional**         | Precise, structured, free of fluff                  | Jargon-heavy, overly formal or stiff                  |
| **Approachable**         | Human, direct, never condescending                  | Overly casual, slang, exclamation overuse             |
| **Technically Credible** | Specific, accurate, respects the reader's expertise | Vague hand-waving, oversimplifying complex concepts   |
| **Calm Under Pressure**  | Even-toned in error states, clear in alerts         | Alarming language, all-caps panic, ambiguous warnings |
| **Action-Oriented**      | Leads the user to the next clear step               | Passive voice, unresolved ambiguity                   |

### Voice in Practice

**UI Microcopy**

Write UI labels and messages as if briefing a capable engineer. Be specific about what is happening and what to do next.

- Do: `Deployment pipeline failed at the build stage. Review logs to identify the failing step.`
- Avoid: `Something went wrong. Please try again.`

**Error Messages**

State the problem, the likely cause, and the remediation path. One sentence each where possible.

- Do: `Connection to us-east-1 timed out after 30s. Check your VPC security group rules or verify the CloudPulse agent is running.`
- Avoid: `Error: timeout. Contact support.`

**Empty States**

Frame empty states as an opportunity, not a dead end.

- Do: `No alerts configured yet. Set up your first threshold to start receiving notifications.`
- Avoid: `No data found.`

**Marketing Copy**

Lead with outcomes, not features. Speak to the engineering audience — they are skeptical of overstatement and respond to specificity.

- Do: `Know within seconds when p99 latency spikes across any region.`
- Avoid: `The world's most powerful cloud monitoring solution!`

**Punctuation & Formatting**

- Use sentence case for all UI labels, headings, and CTAs (not Title Case for body elements).
- Avoid exclamation marks in product UI. Reserve them sparingly for onboarding celebrations only (e.g., first successful integration).
- Oxford comma always.
- Em dashes (—) for parenthetical clauses in marketing copy. En dashes (–) for ranges in data (e.g., `10ms – 250ms`).

---

## 5. Logo Usage

### Logo Variants

CloudPulse maintains four approved logo variants. Use the appropriate variant based on background context.

| Variant              | Description                                      | When to Use                                                       |
| -------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| **Primary**          | Full wordmark + icon, Electric Blue on white     | Default for light backgrounds, documents, print                   |
| **Reversed**         | Full wordmark + icon, white on Deep Blue or dark | Dark backgrounds, dark mode headers, dark slide decks             |
| **Monochrome Dark**  | Full wordmark + icon, `#0F172A` on white         | Single-color print, legal documents, embroidery                   |
| **Monochrome Light** | Full wordmark + icon, white on transparent       | Watermarks, overlays on photography                               |
| **Icon Only**        | Pulse icon mark without wordmark                 | Favicon, app icon, social avatar, small formats below 120px width |

### Clear Space

Always maintain a minimum clear space around the logo equal to the height of the capital "C" in the "CloudPulse" wordmark. No other graphic elements, text, or page edges may enter this zone.

```
Minimum clear space = height of capital "C" in wordmark
Applied to: all four sides of the logo bounding box
```

### Minimum Sizes

| Format                  | Minimum Width |
| ----------------------- | ------------- |
| Full wordmark (digital) | 120px         |
| Full wordmark (print)   | 32mm          |
| Icon only (digital)     | 24px          |
| Icon only (print)       | 8mm           |

### Logo Misuse — Prohibited

The following modifications are never permitted:

- Do not recolor the logo outside of the four approved variants.
- Do not stretch, compress, skew, or rotate the logo.
- Do not apply drop shadows, glows, gradients, or other effects.
- Do not place the primary logo on a busy photographic background without a solid color block or sufficient contrast surface.
- Do not rearrange or alter the spatial relationship between the icon mark and the wordmark.
- Do not use outdated logo versions — always source from the approved asset library.
- Do not recreate the logo in a different typeface.

### Logo on Color

- On Electric Blue (`#2563EB`) backgrounds: use the reversed (white) variant.
- On Emerald Green (`#10B981`) backgrounds: use the reversed (white) variant. Minimize this usage — the emerald is a semantic color, not a brand background.
- On photography: ensure a minimum 4.5:1 contrast ratio between the logo and the underlying image. Use a translucent dark scrim if necessary.

---

## 6. Spacing & Layout

### Base Unit: 8px Grid

All spacing, sizing, and layout decisions in CloudPulse interfaces are derived from an **8px base unit**. This creates visual rhythm and predictable, scalable layouts.

```
Base unit: 8px
Scale:     4, 8, 12, 16, 24, 32, 48, 64, 96, 128px
```

Half-unit (4px) is permitted for fine-grained internal component spacing only (e.g., icon-to-label gaps, badge padding). Avoid sub-4px values.

### Spacing Scale Tokens

| Token      | Value | Common Usage                                   |
| ---------- | ----- | ---------------------------------------------- |
| `space-1`  | 4px   | Icon-label gap, internal badge padding         |
| `space-2`  | 8px   | Input padding (vertical), tight list gaps      |
| `space-3`  | 12px  | Inline element gaps, compact card padding      |
| `space-4`  | 16px  | Standard component padding, form field gaps    |
| `space-6`  | 24px  | Card padding, section internal spacing         |
| `space-8`  | 32px  | Between cards, widget margins                  |
| `space-12` | 48px  | Section separators, major layout gaps          |
| `space-16` | 64px  | Top-of-page hero padding, large section breaks |
| `space-24` | 96px  | Marketing page section rhythm                  |
| `space-32` | 128px | Maximum-width marketing hero spacing           |

### Layout Grid

**Product UI (Dashboard/App)**

- Layout type: Fixed sidebar + fluid main content area
- Sidebar width: 240px (collapsed: 64px)
- Content area max-width: 1440px
- Content horizontal padding: 32px (desktop), 16px (mobile)
- Column grid: 12-column, 24px gutters, 32px outer margins

**Marketing / Docs Pages**

- Max content width: 1280px
- Centered with auto horizontal margins
- Readable prose max-width: 720px
- Section vertical padding: 96px (desktop), 64px (tablet), 48px (mobile)

### Breakpoints

| Name  | Min Width | Target                       |
| ----- | --------- | ---------------------------- |
| `sm`  | 640px     | Large phones, landscape      |
| `md`  | 768px     | Tablets                      |
| `lg`  | 1024px    | Small laptops                |
| `xl`  | 1280px    | Standard desktop             |
| `2xl` | 1536px    | Wide desktop, large monitors |

### Border Radius

Consistent border radius reinforces the clean, precise aesthetic.

| Token         | Value  | Usage                                  |
| ------------- | ------ | -------------------------------------- |
| `radius-sm`   | 4px    | Badges, tags, small chips              |
| `radius-md`   | 6px    | Buttons, inputs, small cards           |
| `radius-lg`   | 8px    | Cards, panels, modals                  |
| `radius-xl`   | 12px   | Large cards, drawers                   |
| `radius-full` | 9999px | Pills, toggle switches, avatar circles |

### Elevation & Shadow

Shadows establish depth hierarchy. Use sparingly — the CloudPulse aesthetic favors flat surfaces with border definition over heavy shadow use.

| Level       | CSS Value                         | Usage                                       |
| ----------- | --------------------------------- | ------------------------------------------- |
| `shadow-sm` | `0 1px 2px rgba(15,23,42,0.06)`   | Subtle card lift, hover on flat elements    |
| `shadow-md` | `0 4px 8px rgba(15,23,42,0.08)`   | Cards, dropdowns, popovers                  |
| `shadow-lg` | `0 8px 24px rgba(15,23,42,0.10)`  | Modals, command palette, floating panels    |
| `shadow-xl` | `0 16px 48px rgba(15,23,42,0.14)` | Full-screen overlays, onboarding spotlights |

---

## 7. Component & UI Principles

### Density

CloudPulse serves power users monitoring complex infrastructure. Default to **medium density** in the product UI. Provide a compact view option for users managing large fleets.

- Default row height: 48px
- Compact row height: 36px
- Table cell padding: 12px vertical, 16px horizontal

### Iconography

- Use a single icon library consistently — Heroicons (outline style) is the default.
- Icon sizes: 16px (inline/small), 20px (standard UI), 24px (feature icons), 32px+ (empty state illustrations).
- Icons must always be accompanied by a text label or tooltip — never rely on icon-only affordance for primary actions.

### Motion & Animation

Motion should communicate state, not decorate.

- Default transition duration: 150ms (micro-interactions), 250ms (panel transitions), 350ms (modal entrance)
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out) for all standard transitions
- Avoid animations that block user interaction or loop without user intent
- Respect `prefers-reduced-motion` — all animations must degrade gracefully to instant transitions

### Accessibility

- All interactive elements must have a visible focus ring using Electric Blue (`#2563EB`) at 2px offset with 2px width.
- All color-coded states (error, warning, success) must also use shape or text to convey meaning — never color alone.
- Minimum touch target size: 44x44px on mobile surfaces.
- All images and icons that convey meaning must have descriptive `alt` text or `aria-label`.

---

_CloudPulse Brand Guidelines — Version 1.0_
_Last updated: April 2026_
_For questions or asset requests, contact the Design Systems team._
