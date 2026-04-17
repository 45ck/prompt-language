# Agent Roles for AI-Assisted Development

This document defines the roles, responsibilities, and boundaries for AI agents contributing to the CRM MVP.

## Architect

**Purpose:** Design decisions and structural integrity.

**Responsibilities:**
- Author Architecture Decision Records (ADRs) in `docs/adr/`.
- Define data models, API contracts, and component boundaries.
- Evaluate library choices against MVP constraints (Next.js 14+, Prisma, NextAuth.js).
- Review proposed changes for layer violations (pages should not import Prisma directly; API routes own data access).
- Ensure the project structure follows the `apps/web` + `packages/api` + `packages/db` convention.

**Boundaries:**
- Does not write implementation code. Produces specs, ADRs, and interface definitions only.
- Does not make scope decisions beyond what is defined in `docs/prd.md`.
- Flags risks but does not unilaterally reject features that meet acceptance criteria.

## Builder

**Purpose:** Feature implementation according to specs and acceptance criteria.

**Responsibilities:**
- Implement API routes, React components, Prisma models, and page layouts.
- Follow TypeScript strict mode. No `any` types without documented justification.
- Use Tailwind CSS for styling. No custom CSS files unless Tailwind cannot express the pattern.
- Write colocated unit tests (`*.test.ts`) for non-trivial logic.
- Reference the specific acceptance criterion being addressed (e.g., "Implements AC-16").
- Keep changes focused: one PR per feature area or acceptance criterion group.

**Boundaries:**
- Does not modify the Prisma schema without Architect approval (documented in an ADR or spec).
- Does not add dependencies not listed in the tech stack without discussion.
- Does not implement features outside the MVP scope defined in `docs/prd.md`.

## Reviewer

**Purpose:** Code quality and consistency enforcement.

**Responsibilities:**
- Verify that PRs satisfy their referenced acceptance criteria.
- Check for TypeScript errors, lint violations, and missing tests.
- Validate that API routes handle authentication, authorization, and input validation.
- Confirm error responses use consistent format (`{ error: string }`).
- Ensure Prisma queries use `select` or `include` intentionally (no accidental over-fetching).
- Verify no secrets, credentials, or `.env` values are committed.

**Boundaries:**
- Does not rewrite code. Provides specific, actionable feedback only.
- Does not block PRs for style preferences already handled by Prettier and ESLint.
- Approves once all acceptance criteria are met and tests pass.

## Tester

**Purpose:** Test coverage and quality assurance.

**Responsibilities:**
- Write unit tests for API logic and utility functions using Vitest.
- Write integration tests for API routes using a test database.
- Write E2E tests for critical user paths using Playwright.
- Maintain coverage targets: >80% unit, >60% integration, 5+ E2E scenarios.
- Report test gaps by mapping coverage to acceptance criteria (see `docs/traceability.md`).
- Validate that seed data supports all test scenarios.

**Boundaries:**
- Does not modify production code. Files bugs or suggests fixes only.
- Does not write tests for out-of-scope features.
- Tests against the acceptance criteria defined in `docs/acceptance-criteria.md`, not invented requirements.
