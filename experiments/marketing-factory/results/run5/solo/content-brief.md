# CloudPulse Website — Content Brief

## Site Structure

Single-page marketing site with 8 sections, anchor-navigable.

### 1. Navigation (sticky)

- Logo: "CloudPulse" text with a pulse-line SVG icon
- Links: Features, Pricing, Testimonials, FAQ
- CTA button: "Start Free Trial"

### 2. Hero Section

**Headline:** "Monitor smarter, respond faster."
**Subheadline:** "CloudPulse gives your engineering team real-time visibility into every service, metric, and alert — so you fix issues before users notice."
**Primary CTA:** "Start Your Free 14-Day Trial" (button, primary gradient)
**Secondary CTA:** "See How It Works" (text link, scrolls to features)
**Social proof strip:** "Trusted by 2,000+ engineering teams worldwide"
**Metrics row (3 items):**

- 99.9% uptime SLA
- <2s alert latency
- 500M+ metrics processed daily

### 3. Features Section

**Section title:** "Everything you need to stay ahead of incidents"
**6 feature cards (2×3 grid on desktop, stacked on mobile):**

1. **Real-Time Dashboards** — "Visualize every metric across all your services in one unified dashboard. Custom layouts, live data, zero lag."
2. **Intelligent Alerting** — "ML-powered anomaly detection cuts through noise. Get alerted on what matters, silence what doesn't."
3. **Incident Timeline** — "Trace every incident from first signal to resolution. Automatic root-cause correlation saves hours of debugging."
4. **Infrastructure Mapping** — "Auto-discover your topology. See dependencies, traffic flow, and bottlenecks at a glance."
5. **Log Aggregation** — "Search, filter, and correlate logs across every service. Full-text search returns results in milliseconds."
6. **Team Collaboration** — "Shared runbooks, on-call rotations, and Slack/Teams integration keep your whole team in sync."

### 4. How It Works Section

**Section title:** "Up and running in 5 minutes"
**3 steps (horizontal on desktop, vertical on mobile):**

1. **Install the Agent** — "One command deploys our lightweight agent. Supports AWS, GCP, Azure, Kubernetes, and bare metal."
2. **Connect Your Stack** — "200+ integrations out of the box. Datadog, PagerDuty, Terraform, GitHub Actions — we play nice with your tools."
3. **Start Monitoring** — "Dashboards auto-populate. Alerts configure themselves based on your baseline. You're live."

### 5. Pricing Section

**Section title:** "Simple pricing that scales with you"
**3 tiers (cards, center tier highlighted):**

#### Starter — Free

- Up to 5 hosts
- 1-day data retention
- 3 dashboards
- Community support
- CTA: "Get Started Free"

#### Pro — $29/host/month

- Unlimited hosts
- 30-day data retention
- Unlimited dashboards
- Anomaly detection
- Slack & Teams integration
- Priority email support
- CTA: "Start Free Trial" (highlighted, gradient background)

#### Enterprise — Custom

- Everything in Pro
- 365-day data retention
- SSO & SAML
- Dedicated account manager
- Custom SLA (99.99%)
- On-premises deployment option
- CTA: "Contact Sales"

### 6. Testimonials Section

**Section title:** "Trusted by teams who ship fast"
**3 testimonial cards:**

1. **Sarah Chen, VP Engineering at Shipfast** — "CloudPulse cut our MTTR by 68%. The anomaly detection alone paid for itself in the first month."
2. **Marcus Rivera, SRE Lead at Stackline** — "We migrated from three different monitoring tools to CloudPulse. Simpler, faster, and half the cost."
3. **Priya Sharma, CTO at Launchpad** — "The incident timeline feature is a game-changer. We went from 45-minute war rooms to 10-minute fixes."

### 7. FAQ Section

**Section title:** "Frequently asked questions"
**5 questions (accordion-style, expand/collapse):**

1. **How long is the free trial?** — "14 days, full Pro features, no credit card required."
2. **What integrations do you support?** — "200+ out of the box, including AWS, GCP, Azure, Kubernetes, Datadog, PagerDuty, Slack, Teams, GitHub Actions, Terraform, and more. See our integrations page for the full list."
3. **Is my data secure?** — "Yes. SOC 2 Type II certified, TLS 1.3 in transit, AES-256 at rest. Your data never leaves your chosen region."
4. **Can I self-host CloudPulse?** — "Enterprise plans include an on-premises deployment option. Contact sales for details."
5. **How does anomaly detection work?** — "Our ML models learn your baseline metrics over 7 days, then flag statistically significant deviations. No manual threshold setting required."

### 8. Footer

- Logo + tagline
- Column 1 — Product: Features, Pricing, Integrations, Changelog
- Column 2 — Company: About, Careers, Blog, Press
- Column 3 — Resources: Documentation, API Reference, Status Page, Community
- Column 4 — Legal: Privacy Policy, Terms of Service, Security, GDPR
- Social links: GitHub, Twitter/X, LinkedIn, Discord
- Copyright: "© 2026 CloudPulse, Inc. All rights reserved."

## SEO Requirements

- Title: "CloudPulse — Cloud Monitoring for Modern Engineering Teams"
- Meta description: "Real-time cloud monitoring with intelligent alerting, incident timelines, and 200+ integrations. Start your free 14-day trial."
- Open Graph: title, description, type=website, url, site_name
- JSON-LD: Organization schema with name, url, description, logo placeholder
- Canonical URL: https://cloudpulse.io
- favicon: inline SVG data URI (pulse icon in brand blue)

## Accessibility Requirements

- `lang="en"` on html
- Skip-to-content link
- Proper heading hierarchy (single h1, sequential h2s per section)
- ARIA labels on interactive elements (nav, buttons, accordion)
- Focus-visible styles on all interactive elements
- Color contrast ratio minimum 4.5:1 for all text
- Reduced-motion media query for animations
