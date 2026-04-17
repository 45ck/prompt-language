# Build

This repo is a bounded prompt-language factory proof focused on discovery + build-ready documentation.

## Prerequisites

- Node.js (LTS) and npm
- PostgreSQL (local or via Docker)

## Suggested Scaffolding Path (When Moving Beyond This Proof)

1. Initialize Next.js + TypeScript
2. Add Prisma + PostgreSQL connection
3. Add basic schema + migrations
4. Add quality gates (format/lint/spell/typecheck/test/ci)

## Environment Variables (Typical)

- `DATABASE_URL=postgresql://...`

## Scripts

`package.json` should define these scripts (placeholders are acceptable for this proof; implement as the project is scaffolded):

- `format:check`
- `lint`
- `spell`
- `typecheck`
- `test`
- `ci`
- `eval:smoke`
