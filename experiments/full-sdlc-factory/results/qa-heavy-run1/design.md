# CloudPulse Marketing Website - Design Specification

## Design System Reference

Based on CloudPulse Brand Guidelines, this design uses:

- **Primary:** Electric Blue (#2563EB)
- **Secondary:** Deep Blue (#1E40AF)
- **Accent:** Emerald Green (#10B981)
- **Neutrals:** Slate gray palette (#F8FAFC to #0F172A)
- **Typography:** Inter or system sans-serif
- **Grid:** 8px base spacing

## Page Structure

### 1. Header/Navigation

**Location:** Fixed at top
**Height:** 64px
**Background:** White with subtle shadow
**Components:**

- Logo (left)
- Navigation menu (center) - Home, Features, Pricing, Blog, Contact
- CTA Button (right) - "Start Free Trial"
- Mobile hamburger menu

**Styling:**

- Border-bottom: 1px solid #E2E8F0
- Box-shadow: 0 4px 6px rgba(0,0,0,0.07)

### 2. Hero Section

**Height:** 100vh (full viewport)
**Background:** Linear gradient from #F8FAFC to #F1F5F9
**Content Layout:**

- Vertical centering
- Max-width: 1000px
- Padding: 64px 32px

**Typography:**

- Headline: H1, 48px, Bold, #0F172A
- Subheading: 20px, Regular, #475569
- Spacing: 16px between headline and subheading

**CTA Buttons:**

- Primary: "Start Free Trial" - #2563EB bg, white text, 16px
- Secondary: "View Demo" - border only, #2563EB, white bg

**Visual Elements:**

- Subtle grid pattern or gradient background
- Code snippet or monitoring dashboard mockup (right side on desktop)

### 3. Features Section

**Background:** White
**Padding:** 96px 32px
**Layout:** Grid 3 columns (desktop), 1 column (mobile)
**Card Styling:**

- Border: 1px solid #E2E8F0
- Border-radius: 8px
- Padding: 32px
- Box-shadow: 0 4px 6px rgba(0,0,0,0.07)
- Hover effect: Border color to #2563EB

**Feature Cards (6 total):**

1. Real-time Monitoring - Icon: pulse/radar
2. Multi-cloud Support - Icon: cloud
3. Intelligent Alerts - Icon: bell
4. Performance Insights - Icon: chart
5. Easy Integration - Icon: plug
6. 99.9% Uptime SLA - Icon: shield

**Card Structure per feature:**

- Icon (32x32, #2563EB)
- Heading: H3, 20px, Bold, #0F172A
- Description: 14px, Regular, #475569
- "Learn More" link in #2563EB

### 4. How It Works Section

**Background:** #F8FAFC
**Padding:** 96px 32px
**Layout:** 3-step timeline visualization

**Steps:**

1. Deploy Agent - Install CloudPulse agent on your infrastructure
2. Monitor Real-time - Get instant visibility into all your cloud resources
3. Optimize Performance - Use insights to improve your cloud operations

**Step Card Styling:**

- Number circle: 48px, #2563EB bg, white text
- Title: H3, 24px, Bold
- Description: 16px, Regular, #475569
- Arrow between steps on desktop

### 5. Benefits/Value Section

**Background:** Linear gradient #2563EB to #1E40AF
**Padding:** 96px 32px
**Text Color:** White
**Layout:** 2 columns (desktop), 1 column (mobile)

**Content:**

- Headline: H2, 40px, Bold, white
- 4 benefit statements with check icons (#10B981)
- CTA: "Start Monitoring Today"

### 6. Testimonials Section

**Background:** White
**Padding:** 96px 32px
**Layout:** 3 columns (desktop), 1 column (mobile)

**Testimonial Card:**

- Border-left: 4px solid #2563EB
- Padding: 32px
- Box-shadow: 0 4px 6px rgba(0,0,0,0.07)
- Border-radius: 8px

**Card Content:**

- 5-star rating (use emoji or SVG)
- Quote: 14px, italic, #0F172A
- Name: 12px, Bold, #0F172A
- Title: 12px, Regular, #475569
- Company: 12px, Regular, #94A3B8

**Testimonials:**

1. "CloudPulse gave us complete visibility into our multi-cloud infrastructure. Game-changer."
2. "The alerting system caught an issue before our customers even noticed. Worth every penny."
3. "Integration was seamless. Within 24 hours, we had comprehensive monitoring across all regions."

### 7. Trust Indicators Section

**Background:** #F8FAFC
**Padding:** 48px 32px
**Layout:** Horizontal row of badges

**Badges:**

- "SOC 2 Compliant" - Icon + text
- "99.9% Uptime SLA" - Icon + text
- "Monitor 10,000+ Instances" - Icon + text
- "24/7 Support" - Icon + text

### 8. Pricing Section

**Background:** White
**Padding:** 96px 32px

**Layout:** 3 pricing tiers (Starter, Professional, Enterprise)

**Tier Card Styling:**

- Border: 1px solid #E2E8F0
- Padding: 48px 32px
- Border-radius: 12px
- Popular tier: Border color #2563EB, shadow elevation 3
- Popular tier: "Most Popular" badge in top-right

**Card Content per Tier:**

- Plan name: H3, 24px, Bold
- Price: Large number in #2563EB
- Billing period: 14px, #475569
- Feature list (5-7 items) with checkmarks in #10B981
- CTA: "Start Free Trial" button

**Tiers:**

1. Starter - $99/month
   - Up to 1,000 resources
   - Email alerts
   - 7-day retention
   - Basic support

2. Professional (Most Popular) - $299/month
   - Up to 10,000 resources
   - Multi-channel alerts
   - 30-day retention
   - Priority support
   - Custom dashboards

3. Enterprise - Custom Pricing
   - Unlimited resources
   - Advanced alerting
   - Unlimited retention
   - Dedicated support
   - SLA guarantee

### 9. CTA Section

**Background:** Linear gradient #2563EB to #1E40AF
**Padding:** 80px 32px
**Text Color:** White
**Layout:** Centered content

**Content:**

- Headline: "Ready to gain real-time visibility?"
- Subheading: "Join thousands of teams already monitoring their cloud infrastructure with CloudPulse."
- CTA Button: "Start Your Free Trial" (prominent, white bg, #2563EB text)
- Secondary CTA: "Schedule a Demo"

### 10. Footer

**Background:** #0F172A (dark slate)
**Padding:** 64px 32px
**Text Color:** White
**Layout:** 4 columns (desktop), 1 column (mobile)

**Columns:**

1. Company
   - CloudPulse logo
   - Brief description
   - Social links (LinkedIn, Twitter, GitHub)

2. Product
   - Features
   - Pricing
   - Integrations
   - API Docs

3. Company
   - About
   - Blog
   - Careers
   - Press

4. Legal
   - Privacy Policy
   - Terms of Service
   - Security
   - Contact

**Bottom Bar:**

- Copyright text
- "Made with care for cloud engineers"

## Responsive Breakpoints

### Desktop (1200px+)

- Full layouts
- Multi-column grids
- Sidebar navigation

### Tablet (768px-1199px)

- 2-column grids
- Adjusted spacing (24px margins)
- Vertical mobile menu

### Mobile (<768px)

- Single column
- Reduced spacing (16px margins)
- Hamburger menu
- Touch-friendly buttons (min 44px height)

## Color Application Guide

### Text Colors

- Headings: #0F172A (Slate-900)
- Body text: #475569 (Slate-600)
- Secondary text: #94A3B8 (Slate-400)
- Links: #2563EB (Primary)
- Links (hover): #1E40AF (Secondary)

### Background Colors

- Primary: #FFFFFF
- Secondary: #F8FAFC (Slate-50)
- Tertiary: #F1F5F9 (Slate-100)
- Dark: #0F172A (Slate-900)

### Interactive States

- Button hover: #1E40AF
- Button active: #1E3A8A
- Focus ring: #2563EB (2px, 2px offset)
- Disabled: 50% opacity

### Status Colors

- Success: #10B981 (Emerald)
- Warning: #F59E0B (Amber)
- Error: #EF4444 (Red)
- Info: #0EA5E9 (Sky Blue)

## Typography Usage

### Font Sizes

- H1 (Hero): 48px, Bold, line-height 1.2
- H2 (Section): 40px, Bold, line-height 1.2
- H3 (Card): 24px, Semibold, line-height 1.3
- H4 (Subsection): 20px, Semibold, line-height 1.3
- Body: 16px, Regular, line-height 1.5
- Small: 14px, Regular, line-height 1.5
- Caption: 12px, Regular, line-height 1.4

## Spacing & Whitespace

### Section Padding

- Large sections: 96px vertical
- Medium sections: 64px vertical
- Compact sections: 48px vertical
- Content padding: 32px horizontal (desktop), 24px (tablet), 16px (mobile)

### Component Spacing

- Between elements in card: 12px
- Between rows: 24px
- Between sections: 32px (desktop), 24px (mobile)

### Grid Alignment

- Base unit: 8px
- All spacing multiples of 8px
- Ensure proper vertical rhythm

## Interactive Elements

### Buttons

**Primary Button:**

- Background: #2563EB
- Text: white, 16px bold
- Padding: 12px 32px
- Border-radius: 8px
- Hover: #1E40AF
- Active: #1E3A8A
- Transition: 200ms ease

**Secondary Button:**

- Background: transparent
- Border: 2px #2563EB
- Text: #2563EB
- Padding: 12px 32px
- Border-radius: 8px
- Hover: background #F1F5F9
- Active: background #E2E8F0

**Ghost Button:**

- Background: transparent
- Text: #2563EB
- Hover: background #F8FAFC
- Underline on hover

### Forms

- Input padding: 12px 16px
- Border: 1px solid #E2E8F0
- Border-radius: 6px
- Focus: border-color #2563EB, outline none
- Label: 14px bold, #0F172A
- Helper text: 12px, #94A3B8

## Accessibility

### Color Contrast

- Text on white: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- All interactive elements: clearly distinguishable

### Focus Indicators

- Visible focus ring: 2px solid #2563EB
- 2px offset from element
- Works on all interactive elements

### Typography

- Line height: 1.4+ for body text
- Letter spacing: -0.02em for headings, 0 for body
- Max line length: 75-100 characters for readability

---

**Design Version:** 1.0
**Last Updated:** April 15, 2026
**Status:** Ready for Implementation
