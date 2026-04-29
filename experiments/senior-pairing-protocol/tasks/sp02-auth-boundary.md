# SP02: Auth Boundary Repair

## Task Shape

Add an ownership check to a resource update path while preserving an existing
admin override.

## Senior Skill Under Test

- Security risk classification.
- Minimal authorization change.
- Regression testing for normal user, owner, and admin paths.

## Fixture Contract

The task workspace should include:

- `TASK.md`
- `package.json`
- `src/auth.js`
- `src/routes.js`
- `src/test.js`
- `verify.js`

## Oracle Expectations

- Non-owners cannot update another user's resource.
- Owners can update their own resource.
- Admins preserve existing override behavior.
- Missing user context fails closed.

## High-Risk Mistake

Adding a broad check that blocks admins or allows unauthenticated updates.
