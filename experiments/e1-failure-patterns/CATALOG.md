---
title: E1 Failure-Pattern Catalog — 10 real recurring patterns from internal evidence
status: catalog — to be encoded into PL flows for the H4 thesis test
operator: 45ck
date: 2026-05-11
related-bead: prompt-language-j64j
related-thesis: docs/strategy/thesis.md §"Experiment 1 — Repeated failure elimination" (H4)
---

# E1 Failure-Pattern Catalog

Per `docs/strategy/thesis.md` §"Experiment 1", the H4 thesis test
needs 10 distinct recurring failure patterns from real usage,
each with a structural fix encodable in PL.

This catalog was built by mining the program's own evidence:

- 561 beads in `.beads/issues.jsonl` (77 closed bugs)
- `docs/evaluation/eval-analysis.md` hypothesis sweep
- `docs/evaluation/experiments/premature-stop-benchmark.md`
- Recent commits + security audits + pilot scorecards

All 10 patterns have repo-internal evidence (bead IDs + file
paths + commit SHAs). None are invented.

## The 10 patterns

### 1. Premature "Done" Despite Failing Validation

**Failure mode**: Agent claims completion while at least one
required validation command is still red or never run ("done"
reported while tests still fail; first failing gate halts the
session instead of repairing).

**Where**: `docs/evaluation/experiments/premature-stop-benchmark.md:222-242`
(formal definition); bead `prompt-language-orfw`;
`docs/evaluation/eval-analysis.md:144-148` (H2/H9/H26 gaslighting).

**Frequency**: Whole experiment dedicated to it; benchmark targets
≥15pp baseline rate.

**PL-recoverable**: Yes (already proven in eval-analysis §1).

**PL flow snippet**:

```
until done when: tests_pass and lint_pass and diff_nonempty
  retry max N
    prompt: continue work; do not stop until all gates pass
  end
end
```

### 2. Narrow-Framing Escape (fix-only-what-was-asked)

**Failure mode**: Prompt highlights one bug; agent fixes that one
and stops — broader test suite still fails.

**Where**: `docs/evaluation/eval-analysis.md:150-156` (H1/H8/H25
— "fix `nme→name` but misses `a*a→a*b`").

**Frequency**: 100% reliable failure across H1/H8/H25 in vanilla
arm.

**PL-recoverable**: Yes.

**PL flow snippet**:

```
done when: full_test_suite_pass
# NOT: done when: command_succeeded "npm test path/to/one.test.js"
```

### 3. Gaslighting / Trusts the Prompt

**Failure mode**: Prompt asserts "tests already pass / I already
fixed it"; agent skips verification.

**Where**: `docs/evaluation/eval-analysis.md:142-148` (H2, H9, H26).

**Frequency**: 3/3 cases, 100% baseline failure.

**PL-recoverable**: Yes — gates ignore narrative.

**PL flow snippet**:

```
done when: tests_pass
# Regardless of any user/agent claim
# grounded-by exit code overrides ask judgment (bead prompt-language-dekn)
```

### 4. Review-Only Drift (no diff produced)

**Failure mode**: Prompt says "review" or "audit"; agent writes a
`review.txt` and never modifies code, even when the brief implies
a fix.

**Where**: `docs/evaluation/eval-analysis.md:167-171` (H17,
calculator.js swapped add/subtract).

**Frequency**: 100% on H17.

**PL-recoverable**: Yes.

**PL flow snippet**:

```
done when: diff_nonempty and tests_pass
```

### 5. Capture/Output-Format Flake (XML tag malformation)

**Failure mode**: Agent emits malformed structured output in
nested loops or after compaction; downstream variable becomes
empty string with no warning, then commands run with empty args.

**Where**: Beads `prompt-language-wn4r` ("#1 flakiness source"),
`prompt-language-muhe` (silent capture failure),
`prompt-language-sb74` (circuit breaker).

**Frequency**: Independently flagged by all three domain expert
reviewers as highest-ROI fix.

**PL-recoverable**: Yes (single-channel Write-tool capture +
circuit breaker after N failures).

**PL flow snippet**:

```
let x = prompt: ... using write-tool capture
if capture_failed
  escalate to frontier with diagnostic
end
```

### 6. Bypassing Quality Gates (`--no-verify`, `SKIP_CI`, `[skip ci]`)

**Failure mode**: Agent reaches for `git commit --no-verify` or
`SKIP_CI=1` to get past failing pre-commit hooks rather than fix
the underlying break.

**Where**: `.claude/hooks/pre-tool-use.sh:15-28`;
`.claude/settings.json:24-28` deny list.

**Frequency**: Operator deemed it worth a hard-coded shell hook —
implies recurrence in practice.

**PL-recoverable**: Yes (already encoded as policy; could be
lifted into a PL `policy:` block).

**PL flow snippet**:

```
policy deny: bash matches "--no-verify|SKIP_CI|\[skip ci\]"
```

### 7. Long-Sequential-Flow Hang (10+ auto-advancing nodes)

**Failure mode**: Flows with 10+ chained `let`/`run`/`prompt`
nodes hang indefinitely; observed 9.5h hang on H33.

**Where**: Beads `prompt-language-ipr`, `prompt-language-iej8`;
references `src/application/inject-context.ts` and
`MAX_ADVANCES=100`.

**Frequency**: Reproduced in H33; current human workaround =
"keep chains under 8 nodes."

**PL-recoverable**: Yes (per-node timeout + structural
decomposition).

**PL flow snippet**:

```
# Per-node timeout 60s with hard-fail
# If chain_len > 8 then split into spawn children
```

### 8. Orphaned Spawn Children (zombie API spend on parent failure)

**Failure mode**: Spawned `claude -p` children become orphans on
parent crash/cancel; consume tokens, CPU, disk indefinitely.
With `child.unref() + detached:true` there is zero cleanup path.

**Where**: Bead `prompt-language-jx2u`; companion
`prompt-language-8vnr` (PID liveness).

**Frequency**: "5 spawns → 1 parent failure → 5 zombies";
structural every time.

**PL-recoverable**: Yes.

**PL flow snippet**:

```
on flow failed/cancelled
  signal SIGTERM all spawned_children
end
spawn-pid-liveness-check gate every 30s
```

### 9. Hook Error Silently Swallowed (transient errors look like success)

**Failure mode**: Hook entry points catch ALL errors and
`exit 0`. The hook appears to succeed but did nothing; user sees
no error; the next interaction hits the same error.

**Where**: Bead `prompt-language-jdd3` (and also
`prompt-language-2t1h` stdin fail-open, `prompt-language-b9nb`
install EACCES masked as "not found").

**Frequency**: Multiple separate beads with the same root pattern.

**PL-recoverable**: Yes (classify transient vs permanent; retry
transient once; surface permanent).

**PL flow snippet**:

```
retry max 1 on transient_error
on permanent_error
  capture and escalate
end
```

### 10. Shell Quoting / Cross-Platform Command Injection & Failure

**Failure mode**: Shell-hostile variable contents, Windows path
mangling, POSIX escaping breaking on cmd.exe — both as security
holes and as silent functional failures.

**Where**: Beads `prompt-language-t8n9`, `prompt-language-hj4r`
[CRITICAL], `prompt-language-p4d4`, `prompt-language-zx9p`,
`prompt-language-tjg` (H44 cat fails on Windows),
`prompt-language-ky6`, `prompt-language-91zd`,
`prompt-language-1dx`, `prompt-language-n79u`. Recent commit
`5a113ef` "fix(harness): reject unresolved command placeholders".

**Frequency**: At least 9 distinct bug beads + recurring
follow-up commits — single most concentrated failure family in
the bug catalog.

**PL-recoverable**: Yes (use `spawn()` not `execSync`;
pre-validate placeholders; reject unresolved templates).

**PL flow snippet**:

```
run via spawn args: [...]
reject if any arg matches unresolved_placeholder
deny path matches windows_absolute
```

## Honesty notes

- All 10 patterns have repo-internal evidence. None invented.
- Patterns 1-4 have the strongest "agent behavioral" evidence
  (eval-analysis hypothesis sweep with measured baseline failure
  rates).
- Patterns 7-10 are framed as system/runtime failures of the
  prompt-language _interpreter itself_. They qualify under E1's
  framing because the experiment tests "structural fix in PL,"
  and these are exactly the recurring class being closed by
  structural fixes (timeouts, lifecycle, validation) rather than
  per-task patches.
- One caveat: per
  `docs/evaluation/experiments/premature-stop-benchmark.md:1-13`,
  the _backlog's_ "Experiment 1" is the premature-stop A/B
  specifically, while `docs/strategy/thesis.md:194` "Experiment 1"
  is the broader repeated-failure-elimination test. The 10
  patterns here support the broader thesis-doc framing.
- If a stricter "agent behavioral" subset is wanted (excluding
  interpreter bugs), the strict count drops to ~6 (patterns 1-6),
  and the gap should be filled either by running the
  premature-stop benchmark to harvest fresh patterns or by
  sourcing more from `docs/evaluation/eval-analysis.md`
  (H22/H23/H27/H36/H37 each give additional gate-shape patterns).

## Next step for E1

To execute the H4 thesis test from this catalog:

1. For each of the 10 patterns, write a baseline reproducer
   (the failure happens) and a PL flow that should prevent it.
2. Run baseline 10× to confirm reproducible failure rate.
3. Run PL-fix 10× to measure the success-rate lift.
4. Track: pass rate, repeated-intervention count, cleanup time,
   "failures shift to new patterns" verifier.
5. Per `thesis.md:206-211` success criteria.

Estimated effort: ~1-2 days for a careful run of all 10 patterns
at k=10 each.

## Cross-references

- Bead: `prompt-language-j64j` (P1)
- Thesis: `docs/strategy/thesis.md` §"Experiment 1" (lines 194-211)
- Roadmap: `docs/strategy/thesis-roadmap.md:87-100`
- Eval analysis: `docs/evaluation/eval-analysis.md`
- Premature-stop benchmark:
  `docs/evaluation/experiments/premature-stop-benchmark.md`
- Source bead catalog: `.beads/issues.jsonl`
