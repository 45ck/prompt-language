# Contributing

## Getting started

1. Fork the repository.
2. Clone your fork and create a branch from `main`.
3. Install dependencies:

```
npm install
```

4. Run the full CI pipeline to verify your setup:

```
npm run ci
```

## Development workflow

1. Make changes in the appropriate architectural layer.
2. Write or update tests for your changes.
3. Run tests:

```
npm run test
```

4. Run the full CI check:

```
npm run ci
```

5. Commit and push to your branch.
6. Open a pull request against `main`.

## Architecture

This project follows domain-driven design with four layers:

- `src/domain/` -- Pure types and functions. No external dependencies.
- `src/application/` -- Use cases and port interfaces.
- `src/infrastructure/` -- Adapters implementing ports.
- `src/presentation/` -- Hook entry points for Claude Code.

Dependency flow is strictly inward: presentation -> infrastructure -> application -> domain. The dependency-cruiser enforces this.

## Code style

- TypeScript with strict mode.
- ESLint and Prettier are enforced. Run `npm run lint:fix` and `npm run format` before committing.
- Use `type` imports for type-only symbols.
- No `eslint-disable` comments.

## Testing

- Tests use Vitest.
- Colocate test files with source: `foo.ts` and `foo.test.ts` side by side.
- All new logic requires tests.
- Coverage must not decrease.
- Run mutation testing for critical domain logic: `npm run mutation`.

## Commit messages

Use clear, descriptive commit messages. One logical change per commit.

## Pull requests

- Keep PRs focused on a single concern.
- Ensure `npm run ci` passes before requesting review.
- Describe what changed and why in the PR description.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
