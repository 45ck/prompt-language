# NightOwl Security Review

**Reviewer:** Security reviewer agent
**Date:** April 2026
**Scope:** site/app/ components, package dependencies, build output

---

## Summary

No security vulnerabilities found. The NightOwl marketing website is a static site with no user-generated content, no forms on the marketing page, and no server-side code. The attack surface is minimal.

---

## Findings

### 1. XSS Vulnerabilities in Dynamic Content

**Status: PASS**

Two instances of `dangerouslySetInnerHTML` were found:

- `FeaturesSection.tsx` — feature title strings containing HTML entities (`&apos;`, `&lsquo;`). These are **static strings defined in the component file**, not user input or external data. No XSS risk.
- `TestimonialsSection.tsx` — testimonial quote rendered via `dangerouslySetInnerHTML`. Content is **static strings in the component file**. No XSS risk.

No dynamic content from user input, URL parameters, or external APIs is injected into the DOM.

### 2. Dependency Audit

**Status: PASS — 0 vulnerabilities**

```
npm audit: found 0 vulnerabilities
```

All dependencies are at current versions. No known CVEs in the dependency tree.

Key dependencies audited:

- `next@16.2.3` — no known vulnerabilities
- `react@19.2.4` — no known vulnerabilities
- `tailwindcss@^4` — no known vulnerabilities
- `eslint@^9` — no known vulnerabilities

### 3. CSP Headers

**Status: N/A for static export**

The marketing site is delivered as static HTML/CSS/JS. CSP headers would be configured at the CDN/hosting layer (Vercel, Cloudflare, or Nginx), not in the Next.js application. Recommended CSP for production:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' fonts.googleapis.com;
  font-src 'self' fonts.gstatic.com;
  img-src 'self' data:;
  connect-src 'self';
```

Note: `'unsafe-inline'` for scripts and styles is required by Next.js static export for inline React hydration scripts. This is an accepted limitation of Next.js static output.

### 4. Exposed Secrets or API Keys

**Status: PASS**

Search of all source files found:

- No hardcoded API keys
- No environment variables referenced in client-side code
- No `.env` files committed
- No authentication tokens in source

`grep -r "API_KEY\|SECRET\|TOKEN\|PASSWORD" site/app/` — no results.

### 5. Safe External Resource Loading

**Status: PASS**

External resources loaded:

- Google Fonts (Inter) — loaded via Next.js `next/font/google` which proxies through Next.js at build time for production; no runtime Google Fonts call in static export.
- No external JavaScript CDN scripts included.
- No tracking pixels or third-party embeds.
- All SVG icons are inline — no external SVG loading.

### 6. Open Redirect Risks

**Status: PASS**

All external links in the codebase (`href="https://..."`) are hardcoded to known domains. No user-controlled redirect targets exist.

### 7. Static Site Security Posture

**Overall Assessment: Low risk**

A static marketing site with no server-side processing, no user accounts, no form submissions, and no external API calls represents a minimal attack surface. The primary risk vector (supply chain attacks via npm) shows 0 vulnerabilities in audit.

**Recommended production hardening (at CDN layer):**

- Set `X-Frame-Options: DENY`
- Set `X-Content-Type-Options: nosniff`
- Set `Referrer-Policy: strict-origin-when-cross-origin`
- Enable HSTS with `includeSubDomains` and `preload`
- Configure CSP as specified above

---

## Verdict: SHIP

No blocking security issues. Production hardening recommendations are infrastructure-level and do not require code changes.
