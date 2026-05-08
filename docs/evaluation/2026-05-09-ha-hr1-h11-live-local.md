# 2026-05-09 HA-HR1 H11 Live Local Evidence

## Scope

This record covers the Harness Arena H11 local screen for the
Contact-to-Client multi-file refactor.

The tested hypothesis was narrow:

- `qwen3-coder:30b` can own a cross-file rename locally when Prompt Language
  exposes public tests, structural rename gates, app smoke checks, and a final
  worker-summary artifact.
- H11 should remain a screen candidate until a clean live manifest passes the
  private oracle without frontier input.

## Run 001

Run: `HA-HR1-H11-multi-file-refactor-qwen-coder-001`

Route:
`node experiments/harness-arena/runner.mjs --live --h11-qwen-coder-task multi-file-refactor ...`

Result:

- Repo commit: `c6b9d82`
- Runner: `ollama`
- Model: `qwen3-coder:30b`
- Transport: `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell`
- Endpoint label: `ollama-powershell-stdin`
- Step exit: `3`
- Wall time: `608.639s`
- Model calls: `27`
- Tokens: `69,498`
- Resource samples: `258`
- Frontier calls: `0`
- Private oracle: `FAIL`, `2/4`

Private oracle failures:

- old `src/contact.js` and `src/contact-store.js` files remained
- hidden route checks failed because `listClients` did not preserve the expected
  route behavior

Public path behavior:

- public tests stayed green at `8/8`
- app smoke eventually passed with Client wording
- the structural gate repeatedly failed on leftover old filenames
- `local-worker-summary.md` was never created
- the final Prompt Language status was `failed` with `gateFailureCount: 4`

The final runner failure was:

```text
Completion gates failed: file_exists local-worker-summary.md, structural_rename.
```

The final runtime diagnostic was `PLR-007`: the Ollama PowerShell bridge failed
while parsing a model response containing a bad control character. That happened
after the run had already produced repeated structural failures, so this is not a
clean harness pass or a promotion candidate.

## Decision

Do not promote H11 for local-only ownership under `qwen3-coder:30b`.

This is still useful positive/negative evidence:

- positive: the model created the new `client.js` and `client-store.js` files,
  restored app smoke after an intermediate break, and kept public tests passing;
- negative: it treated the rename as additive instead of deleting obsolete files,
  missed the hidden route behavior contract, and failed to emit the required
  summary artifact.

Next route revision should make obsolete-file deletion and summary creation
explicitly deterministic. A good follow-up screen is either a smaller
delete-old-files repair lane or a revised H11 flow with a public gate whose error
message names the exact obsolete filenames and requires `local-worker-summary.md`
before app smoke is considered complete.

## Run 002

Run: `HA-HR1-H11-multi-file-refactor-qwen-coder-002`

Route:
`node experiments/harness-arena/runner.mjs --live --h11-qwen-coder-task multi-file-refactor ...`

Result:

- Repo commit: `cef33bf`
- Runner: `ollama`
- Model: `qwen3-coder:30b`
- Transport: `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell`
- Endpoint label: `ollama-powershell-stdin`
- Step exit: `0`
- Wall time: `284.329s`
- Model calls: `15`
- Tokens: `41,880`
- Resource samples: `120`
- Frontier calls: `0`
- Private oracle: `FAIL`, `2/4`

Private oracle failures:

- `Client#toJSON()` was missing
- hidden route checks failed

Public path behavior:

- public tests passed at `9/9`
- app smoke passed
- stale `src/contact.js` and `src/contact-store.js` were removed
- `local-worker-summary.md` was created
- final Prompt Language status was `completed` with `gateFailureCount: 0`

Decision: this is a route-hardening success but not a model promotion. The
explicit `rm -f` instruction fixed the stale-file and summary-artifact failures.
The next route revision must add public behavior-preservation gates for the
original API shape: `Client#toJSON()`, `Client#getDisplayName()`, `ClientStore`
method names, route `body` responses, duplicate create handling, and `204/null`
delete behavior.

## Run 003

Run: `HA-HR1-H11-multi-file-refactor-qwen-coder-003`

Route:
`node experiments/harness-arena/runner.mjs --live --h11-qwen-coder-task multi-file-refactor ...`

Result:

- Repo commit: `064b56c`
- Runner: `ollama`
- Model: `qwen3-coder:30b`
- Transport: `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell`
- Endpoint label: `ollama-powershell-stdin`
- Step exit: `0`
- Wall time: `449.546s`
- Model calls: `17`
- Tokens: `48,459`
- Resource samples: `193`
- Frontier calls: `0`
- Private oracle: `PASS`, `4/4`

Private oracle result:

```text
PASS: rename structure is complete
PASS: public tests and app smoke pass
PASS: hidden Client API checks pass
PASS: hidden Client route checks pass

Results: 4/4 passed
```

Public path behavior:

- public tests passed at `9/9`
- structural rename gate passed after stale-file deletion feedback
- behavior-preservation gate passed
- app smoke passed
- `local-worker-summary.md` was created
- final Prompt Language status was `completed` with `gateFailureCount: 0`

Decision: count this as the first clean H11 local-screen pass for
`qwen3-coder:30b`. Do not promote the route to local ownership yet; the policy
requires three clean passes. The useful lesson is concrete: explicit deletion
instructions plus a public behavior-preservation gate converted the H11 route
from two oracle failures into a clean local-only pass without frontier calls.

## Run 004

Run: `HA-HR1-H11-multi-file-refactor-qwen-coder-004`

Route:
`node experiments/harness-arena/runner.mjs --live --h11-qwen-coder-task multi-file-refactor ...`

Result:

- Repo commit: `0be436d`
- Runner: `ollama`
- Model: `qwen3-coder:30b`
- Transport: `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell`
- Endpoint label: `ollama-powershell-stdin`
- Step exit: `0`
- Wall time: `670.669s`
- Model calls: `20`
- Tokens: `55,167`
- Resource samples: `286`
- Frontier calls: `0`
- Private oracle: `PASS`, `4/4`

Private oracle result:

```text
PASS: rename structure is complete
PASS: public tests and app smoke pass
PASS: hidden Client API checks pass
PASS: hidden Client route checks pass

Results: 4/4 passed
```

Public path behavior:

- public tests passed
- structural rename gate passed after stale-file deletion feedback
- behavior-preservation gate passed
- app smoke passed
- `local-worker-summary.md` was created
- final Prompt Language status was `completed` with `gateFailureCount: 0`

Decision: count this as the second clean H11 local-screen pass for
`qwen3-coder:30b`. Do not promote the route yet; the policy requires three clean
passes. The useful lesson is that run 003 was repeatable, but the model still
needed one public structural repair prompt to delete stale files, so promotion
should wait for one more clean private-oracle pass.

## Run 005

Run: `HA-HR1-H11-multi-file-refactor-qwen-coder-005`

Route:
`node experiments/harness-arena/runner.mjs --live --h11-qwen-coder-task multi-file-refactor ...`

Result:

- Repo commit: `4734930`
- Runner: `ollama`
- Model: `qwen3-coder:30b`
- Transport: `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell`
- Endpoint label: `ollama-powershell-stdin`
- Step exit: `0`
- Wall time: `488.865s`
- Model calls: `20`
- Tokens: `55,156`
- Resource samples: `201`
- Frontier calls: `0`
- Private oracle: `PASS`, `4/4`

Private oracle result:

```text
PASS: rename structure is complete
PASS: public tests and app smoke pass
PASS: hidden Client API checks pass
PASS: hidden Client route checks pass

Results: 4/4 passed
```

Public path behavior:

- public tests passed
- structural rename gate passed after stale-file deletion feedback
- behavior-preservation gate passed
- app smoke passed
- `local-worker-summary.md` was created
- final Prompt Language status was `completed` with `gateFailureCount: 0`

Decision: promote this specific H11 route to local ownership for
`qwen3-coder:30b`. The route now has three consecutive clean private-oracle
passes after the public deletion, behavior-preservation, app-smoke, and summary
gates were hardened. This does not generalize to all multi-file refactors; it
means this exact H11 contract is safe to run as a promoted local route until new
evidence contradicts it.
