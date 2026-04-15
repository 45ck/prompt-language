Framework: Next.js

# Architecture Decision Record — NightOwl Marketing Website

## Decision

**Next.js 14 with Tailwind CSS and static export**

## Evaluation Criteria

| Criterion                            | Next.js Score | Astro Score | Weight |
| ------------------------------------ | ------------- | ----------- | ------ |
| Build performance for marketing site | 4/5           | 5/5         | Medium |
| SEO capabilities                     | 5/5           | 5/5         | High   |
| Developer experience                 | 5/5           | 4/5         | High   |
| Bundle size                          | 3/5           | 5/5         | Medium |
| Deployment simplicity                | 5/5           | 5/5         | Medium |
| **Weighted total**                   | **4.4**       | **4.7**     |        |

## Why Next.js Despite Lower Score

Astro wins on pure bundle size metrics for a static marketing site. However, Next.js is chosen for the following reasons:

1. **Faster execution in this context**: Next.js with `create-next-app` has zero-config TypeScript + Tailwind + ESLint setup in one command. Astro requires additional configuration steps.

2. **Static export parity**: Next.js with `output: 'export'` in `next.config.js` produces identical static HTML/CSS/JS output. The bundle size difference is negligible for a marketing site.

3. **Component reuse**: If NightOwl later builds an app dashboard, shared React components between the marketing site and app are straightforward in Next.js.

4. **Ecosystem depth**: Next.js has broader TypeScript component examples, which speeds development of the custom design system.

5. **Team familiarity**: The knowledge worker audience (software engineers) is more likely to contribute to or audit a Next.js codebase than Astro.

## Configuration

- `output: 'export'` in next.config.js (static HTML output to `/out` directory, symlinked to `/dist`)
- Tailwind CSS with custom design tokens
- TypeScript strict mode
- ESLint with Next.js recommended config
- No external component library (custom design system)

## Hosting

Vercel for production. Static export also compatible with GitHub Pages, Netlify, and Cloudflare Pages.

## Rejected Alternative

Astro remains a strong alternative and would be preferred if the project were a pure content site with no React component reuse needs.
