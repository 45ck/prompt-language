# Defaults and Limits

These are the main user-visible defaults in the language.

## Defaults

| Setting                          | Default   |
| -------------------------------- | --------- |
| `while` / `until` max iterations | 5         |
| `retry` max attempts             | 3         |
| `foreach` max iterations         | 50        |
| Summary body target              | 12 lines  |
| Summary body hard cap            | 900 chars |

## Notes

- `max N` overrides the loop default.
- `run:` has no special default timeout unless you provide `[timeout N]`.
- `ask` counts against the same loop limits as the loop it belongs to.
- Summary-surface limits are documented in full at [Summary and Rendering Policy](summary-and-rendering-policy.md).

## Related

- [while](while.md)
- [until](until.md)
- [retry](retry.md)
- [foreach](foreach.md)
- [Summary and Rendering Policy](summary-and-rendering-policy.md)
