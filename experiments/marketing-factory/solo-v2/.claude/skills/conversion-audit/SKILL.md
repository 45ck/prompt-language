# Skill: Conversion Optimization Audit

## Trigger

After generating a landing page, or when asked to audit conversion elements.

## Process

### 1. CTA Placement

Verify CTAs appear in these locations:

- [ ] **Above the fold**: A primary CTA button in the hero section, visible without scrolling on a 768px viewport.
- [ ] **After features**: A CTA or transition sentence following the features section that guides the reader toward pricing or signup.
- [ ] **After pricing**: Each pricing tier has its own CTA button.
- [ ] **Final section**: A dedicated CTA section near the bottom with a compelling headline and button.
- [ ] **Navigation**: A CTA button in the sticky header/nav for persistent access.

Check that the primary CTA is visually distinct (uses `--color-primary`, larger padding, prominent placement).

### 2. Social Proof Requirements

Verify the page includes credible social proof:

- [ ] At least 3 testimonials from distinct people.
- [ ] Each testimonial includes: quote text, person's full name, job title, and company name.
- [ ] Testimonials use `<blockquote>` with `<cite>` for semantic correctness.
- [ ] Stats bar with concrete numbers (e.g., "10,000+ teams", "99.9% uptime", "50M+ events/day").
- [ ] Numbers are specific and credible, not round or inflated-sounding.

### 3. Trust Signals

Verify the page communicates trust:

- [ ] Quantified metrics (uptime percentage, response time, customer count).
- [ ] Free tier or trial mentioned to reduce risk perception.
- [ ] No credit card required messaging near signup CTAs (if applicable).
- [ ] Security or compliance mentions if relevant to the product category.
- [ ] Professional design quality signals trust (consistent spacing, alignment, typography).

### 4. Pricing Presentation

If a pricing section exists, verify:

- [ ] 2-3 tiers maximum. More than 3 creates decision paralysis.
- [ ] One tier is visually highlighted as "recommended" or "most popular".
- [ ] Prices are clearly displayed with billing period (e.g., "/month").
- [ ] Feature lists use checkmarks for included items.
- [ ] Each tier has a clear, differentiated name.
- [ ] Free or lowest tier is listed first to anchor the pricing.
- [ ] Enterprise/custom tier exists for high-value leads.

### 5. Value Proposition Clarity

Verify the hero section communicates value within 5 seconds:

- [ ] The h1 answers "what does this product do for me" in under 12 words.
- [ ] The subheading provides one concrete benefit or outcome.
- [ ] The hero CTA tells the user exactly what happens next ("Start Free Trial", "Deploy in 60 Seconds").
- [ ] No jargon or undefined acronyms in the first visible screen.

### 6. Friction Reduction

Check for unnecessary friction:

- [ ] Primary CTA does not say "Sign up" (implies commitment). Prefer "Start Free" or "Try CloudPulse".
- [ ] No required form fields visible in the hero (defer to a signup page).
- [ ] Pricing shows value before asking for commitment.
- [ ] Navigation is simple: 4-6 links maximum.
- [ ] Page loads without external dependencies (no blocking resources).

### 7. Scannability

Verify the page is scannable:

- [ ] Each section has a clear heading (h2).
- [ ] Feature descriptions are under 30 words each.
- [ ] Bullet points or cards are used instead of dense paragraphs.
- [ ] Visual hierarchy guides the eye: large heading, supporting text, CTA.
- [ ] Adequate whitespace between sections (at least 4rem padding).

## Output

Report each item as pass/fail. Fix all failing items before delivering the final page.
