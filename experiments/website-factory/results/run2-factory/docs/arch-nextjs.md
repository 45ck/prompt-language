# Architecture Proposal: Next.js

## Framework

Next.js 14 (App Router)

## CSS Approach

Tailwind CSS v3 with custom design tokens via `tailwind.config.ts`

## Component Library Strategy

No external component library. Custom components using Tailwind utility classes with design tokens. This keeps bundle size minimal and gives full visual control needed for a premium brand.

## Build Tooling

- Next.js built-in (Turbopack in dev, webpack in prod)
- TypeScript strict mode
- ESLint with Next.js recommended config
- Prettier for formatting

## Hosting Recommendation

Vercel (zero-config for Next.js, automatic preview deployments, global CDN)

## Folder Structure

```
site/
  app/
    layout.tsx          # Root layout with metadata
    page.tsx            # Main landing page assembling all sections
    globals.css         # Tailwind base imports
  components/
    ui/                 # Base design system components (Button, Card, Badge, etc.)
    sections/           # Page section components (HeroSection, FeaturesSection, etc.)
    layout/             # Layout primitives (Container, Grid, Stack, NavBar, Footer)
  lib/
    utils.ts            # Shared utility functions
  public/
    images/             # Static assets
  tailwind.config.ts    # Design tokens and theme extensions
  next.config.js        # Next.js configuration
  tsconfig.json         # TypeScript config
```

## Rationale

- App Router enables React Server Components for zero-JS static sections
- Next.js static export (`output: 'export'`) produces a pure HTML/CSS/JS dist suitable for any host
- Tailwind eliminates CSS file management overhead
- TypeScript catches prop errors at build time, not runtime
