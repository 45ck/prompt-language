# GSLR-6 Scaffolded Sanitizer Runbook

Status: planned next experiment after GSLR-5R repeat failure  
Tracking bead: `prompt-language-gslr19`  
Companion Portarium bead: `bead-1244`

## Purpose

GSLR-6 tests whether Prompt Language can turn the failed GSLR-5 local sanitizer
task into a smaller, scaffolded contract that a local model can repeat reliably.

This is not product integration and not a route promotion.

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

Promotion evidence requires:

- three local repeats;
- zero frontier tokens;
- public gate pass;
- private oracle pass;
- `finalVerdict.status == "pass"`;
- local resource samples;
- no oracle leakage;
- no product ingestion.

Failure keeps the adjacent privacy-sensitive route on `frontier-baseline`.

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

## Execution Record

2026-05-12:

- Recorded GSLR-6 as the next experiment after GSLR-5R rejected local route
  promotion.
- Defined the scaffolded helper contract and repeat bar.
- Kept the work in R&D only.

2026-05-13:

- Added the GSLR-6 scaffolded sanitizer fixture, public gate, private oracle,
  deterministic lane, runner coverage, and deterministic fake-live result.
- Kept live local repeats pending.
