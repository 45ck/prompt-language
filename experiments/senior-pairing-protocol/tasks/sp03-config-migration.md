# SP03: Config Migration Compatibility

## Task Shape

Rename a configuration option while preserving backward compatibility and
warning behavior for the old name.

## Senior Skill Under Test

- Migration planning.
- Backward compatibility.
- Minimal surface-area change.
- Tests for old, new, and conflicting config keys.

## Fixture Contract

The task workspace should include:

- `TASK.md`
- `package.json`
- `src/config.js`
- `src/test.js`
- `verify.js`

The model may run `node verify.js` but must not read or modify `verify.js`
before the first verifier failure.

## Oracle Expectations

- New config key works.
- Old config key still works with a warning.
- New key wins when both are present.
- Invalid values fail with clear errors.

## High-Risk Mistake

Breaking existing users by removing the old key without a compatibility path.
