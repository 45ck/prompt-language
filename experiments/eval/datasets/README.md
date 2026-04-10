# Eval Datasets

Each non-empty line in a dataset file must be one JSON object with:

- `id`
- `fixture`
- `input_type`
- `input_file`
- `verify`

Optional:

- `gates`
- lightweight metadata such as `experiment`, `category`, `stability`, or `expected_signal`

Paths are resolved relative to the dataset file, so fixture directories can stay in `scripts/eval/fixtures/` while the suite bank stays easy to browse under `experiments/eval/`.

`gates` entries are raw `done when:` lines, not just builtin predicate names. That means a dataset can use:

- builtin predicates such as `tests_pass`
- custom gate lines such as `gate fixture_tests: node test.js`

The seeded E1 bank uses fixture-local custom gates because those legacy JS fixtures do not ship `package.json` files for `npm test`.
