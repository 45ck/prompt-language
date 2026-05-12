# GSLR-6 Scaffolded Sanitizer Runbook

Status: live local repeats complete; exact local-screen route promoted
Tracking bead: `prompt-language-gslr21`
Companion Portarium bead: `bead-1246`

## Purpose

GSLR-6 tests whether Prompt Language can turn the failed GSLR-5 local sanitizer
task into a smaller, scaffolded contract that a local model can repeat reliably.

This is not product integration. After the 2026-05-13 v3 repeat set, it is an
exact route promotion for the scaffolded static sanitizer shape only.

## Hypothesis

The failed GSLR-5R repeats show that a free-form local prompt is not reliable
for privacy-sensitive evidence-card sanitization.

GSLR-6 tests a narrower hypothesis:

```text
If PL supplies fixed helper boundaries for normalization, artifact-ref safety,
raw text scanning, and action-boundary derivation, a local model may be able to
complete the remaining sanitizer logic repeatably with zero frontier tokens.
```

## Scaffold Shape

The fixture should expose these helper boundaries:

- `normalizeEvidenceKey(value)`
- `isForbiddenRawKey(key)`
- `containsRawPayloadText(value)`
- `isSafeArtifactRef(ref)`
- `deriveActionBoundary(gates)`
- `sanitizeEvidenceCardInput(input)`

The model should fill isolated predicates or small policy tables. It should not
own the whole sanitizer design in one free-form turn.

## Controls

Keep the GSLR-5 private oracle unchanged where possible.

If the oracle changes, it may only become stricter and the report must say so.

Use the same adversarial classes:

- separator-insensitive raw and secret keys;
- safe relative refs that must remain accepted;
- parent traversal, query, fragment, absolute, and raw-dump refs that must fail;
- recursive raw payload text and school/person data strings;
- stale caller-provided action-boundary values.

## Success Bar

Promotion evidence required:

- three local repeats;
- zero frontier tokens;
- public gate pass;
- private oracle pass;
- `finalVerdict.status == "pass"`;
- local resource samples;
- no oracle leakage;
- no product ingestion.

The v3 lane met this bar. Adjacent free-form or product-ingestion
privacy-sensitive work still stays on `frontier-baseline`.

## Product Boundary

Portarium runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

MacquarieCollege connector observation, raw school-data movement, and
source-system reads or writes remain blocked.

## Deterministic Proof

The deterministic fake-live scaffold now passes:

```text
experiments/harness-arena/results/gslr6-fake-live-2026-05-13/report.md
```

That proves fixture, public gate, private oracle, token parsing, review-defect
parsing, and final-verdict wiring only. It is not model-performance evidence.

## Live Local Repeat Result

The v1 and v2 local lanes failed before the clean repeat set:

- v1 implemented helpers but did not export them;
- v2 exported helpers but copied the public-gate import into the target file,
  creating a self-import and duplicate declarations.

The v3 local lane made those model-visible boundaries explicit and then passed
all three repeats:

```text
experiments/harness-arena/results/gslr6-local-repeat-2026-05-13/report.md
```

| Repeat | Final verdict | Private oracle | Frontier tokens | Step wall time |
| ------ | ------------- | -------------- | --------------- | -------------- |
| 1      | pass          | pass           | 0               | 75.301s        |
| 2      | pass          | pass           | 0               | 51.215s        |
| 3      | pass          | pass           | 0               | 52.569s        |

Decision: promote `gslr6-scaffolded-sanitizer` to exact `local-screen` in the
GSLR route policy. Do not generalize that to the broader GSLR-5 free-form
sanitizer or to Portarium runtime ingestion.

## Execution Record

2026-05-12:

- Recorded GSLR-6 as the next experiment after GSLR-5R rejected local route
  promotion.
- Defined the scaffolded helper contract and repeat bar.
- Kept the work in R&D only.

2026-05-13:

- Added the GSLR-6 scaffolded sanitizer fixture, public gate, private oracle,
  deterministic lane, runner coverage, and deterministic fake-live result.
- Ran v1/v2 lane hardening attempts, then ran the v3 local lane three times.
  All three v3 repeats passed public gate, private oracle, and final verdict
  with zero frontier tokens.
