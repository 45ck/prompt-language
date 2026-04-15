# Architecture Proposal: Astro

## Framework

Astro 4.x (Islands Architecture)

## CSS Approach

Tailwind CSS v3 via @astrojs/tailwind integration

## Component Strategy

Astro components (.astro files) for static sections. React islands only for interactive components (FAQ accordion, pricing toggle, mobile nav). This minimizes JavaScript shipped to the browser.

## Build Tooling

- Astro built-in Vite bundler
- TypeScript support
- ESLint with astro plugin
- Astro check for type safety

## Hosting Recommendation

Vercel or Netlify (both support Astro static output natively)

## Folder Structure

```
site/
  src/
    pages/
      index.astro       # Main landing page
    components/
      ui/               # Base components
      sections/         # Page sections as .astro files
      layout/           # Layout primitives
    layouts/
      Layout.astro      # Root HTML layout
    styles/
      global.css        # Tailwind imports
  public/               # Static assets
  astro.config.mjs      # Astro configuration
  tailwind.config.ts    # Design tokens
  tsconfig.json
```

## Rationale

- Zero JavaScript by default — marketing sites do not need React for static content
- Islands architecture gives selective hydration exactly where needed
- Smaller bundle sizes than Next.js for primarily static content
- Built-in image optimization
