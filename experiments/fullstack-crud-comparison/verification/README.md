# Verification Contract

This directory defines the expected verification shape for future FSCRUD runs.

The verifier should be committed before live runs and must remain unchanged during a
claim batch.

## Required Checks

The verification script should check:

- package metadata exists
- README declares install, test, and run commands
- customer, asset, and work order implementation files exist
- tests exist and execute through the package test script
- seed data exists
- validation rejects unknown customer references
- validation rejects unknown asset references
- validation rejects asset/customer mismatch on work orders
- completed work orders require `completedAt`
- non-completed work orders reject `completedAt`
- UI files expose list/create/edit/detail/delete flows for each entity family
- run manifest and verification report exist

## Non-Goals

The verifier should not require a specific framework. A Next.js app, Express plus
static UI, or another small full-stack TypeScript shape is acceptable if the product
surface and gates are satisfied.

The verifier should not inspect prompt-language trace internals for the solo arm.
Trace/audit scoring belongs in the research rubric, not the product verifier.
