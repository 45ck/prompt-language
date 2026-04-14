# H17: Dependency Upgrade — Migrate Config Library from v1 to v2

## Task

The application uses a custom config library (`src/config-v1.js`) with a callback-based API. The library has been upgraded to v2 (`src/config-v2.js`) which uses a promise-based API with different method signatures.

Migrate all application code from the v1 API to the v2 API.

## Breaking Changes (v1 -> v2)

1. `config.get(key, callback)` -> `config.get(key)` returns value directly (sync)
2. `config.load(path, callback)` -> `await config.load(path)` returns promise
3. `config.set(key, value, callback)` -> `config.set(key, value)` returns void (sync)
4. `config.save(path, callback)` -> `await config.save(path)` returns promise
5. `config.getAll()` is now `config.entries()` and returns `[key, value]` pairs
6. Error handling: callbacks `(err, result)` -> try/catch with thrown errors

## Acceptance Criteria

1. All files use `config-v2` instead of `config-v1`
2. No callback patterns remain (no `(err, result) =>` in config calls)
3. Async functions use `await` for load/save operations
4. The application runs successfully with the v2 library
5. All tests pass
