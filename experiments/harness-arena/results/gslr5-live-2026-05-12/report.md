# GSLR-5 Live Raw-Payload Adversarial Result: 2026-05-12

Status: live model evidence, positive frontier baseline, negative local diagnostic  
Tracking bead: `prompt-language-gslr16`  
Companion Portarium bead: `bead-1241`

## Runs

Durable run roots:

- Mistaken timeout preflight:
  `/tmp/prompt-language-gslr5-live/gslr5-raw-payload-adversarial-live-2026-05-12-01-frontier-only`
- Frontier-only baseline:
  `/tmp/prompt-language-gslr5-live/gslr5-raw-payload-adversarial-live-2026-05-12-02-frontier-only`
- Local-only diagnostic:
  `/tmp/prompt-language-gslr5-live/gslr5-raw-payload-adversarial-live-2026-05-12-03-local-only-diagnostic`
- Local repair diagnostics:
  `/tmp/prompt-language-gslr5-live/gslr5-raw-payload-adversarial-live-2026-05-12-04-local-repair`
  and
  `/tmp/prompt-language-gslr5-live/gslr5-raw-payload-adversarial-live-2026-05-12-05-local-repair-v2`

The first run used the runner default 1000 ms step timeout and is classified as
operator invocation noise, not model-quality evidence. The corrected live runs
used explicit step and oracle timeouts.

## Result

| Arm               | Final verdict | Private oracle | Failure boundary                                             | Frontier tokens | Provider USD | Step wall time |
| ----------------- | ------------- | -------------- | ------------------------------------------------------------ | --------------- | ------------ | -------------- |
| `frontier-only`   | pass          | pass           | none                                                         | 53,668          | 5            | 457.843s       |
| `local-only`      | fail          | fail           | Safe card failed because valid relative artifact refs failed | 0               | 0            | 90.822s        |
| `local-repair-v2` | pass          | pass           | none                                                         | 0               | 0            | 60.540s        |

The local diagnostic recorded three runtime samples during `local-bulk`.

## Interpretation

GSLR-5 establishes that the raw-payload adversarial sanitizer is solvable by the
frontier baseline. It does not promote local ownership.

The local-only diagnostic failed before reaching the hidden adversarial traps:

```text
safe card: expected ok=true
```

Manual artifact inspection shows the local sanitizer rejected normal relative
artifact refs such as `private/oracle/stdout.txt`, so the safe static card did
not pass. That is a correctness failure in ordinary evidence-card handling, not
a narrowly hidden-oracle-only miss.

A follow-up local repair diagnostic then passed after the lane prompt made
artifact-ref and `blockingReviewDefects` semantics explicit. That is positive
prompt-repair evidence, but not enough for route promotion by itself.

## Decision

Keep `gslr5-raw-payload-adversarial` on `frontier-baseline`.

Do not promote local-screen or advisor-only for privacy-sensitive raw-payload
sanitization yet. The repaired local lane is now a candidate for repeat testing,
not a selected product route.

## Product Boundary

Portarium runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

MacquarieCollege connector/raw school-data movement remains blocked. GSLR-5 is
R&D evidence for a static sanitizer boundary only.
