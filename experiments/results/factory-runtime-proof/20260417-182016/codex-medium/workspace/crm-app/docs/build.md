# Build-Ready Plan (Documentation-Only Proof)

## Target stack

- Next.js + TypeScript
- PostgreSQL
- Prisma
- Package manager: npm

## Repo expectations (when scaffolded)

### App structure

- Next.js app with `src/` layout
- API layer (Next.js Route Handlers) for CRUD on core entities
- Prisma schema for the core entities and relations

### Environment

- `.env` for `DATABASE_URL`
- Local PostgreSQL via Docker Compose or a local service

### npm scripts (expected)

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run ci`

## Implementation notes (future scaffold)

- Use Prisma migrations for schema evolution
- Prefer server-side validation in API routes
- Provide seed data for local dev (minimal, deterministic)

