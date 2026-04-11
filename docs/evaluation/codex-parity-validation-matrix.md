# Codex CLI Parity Validation Matrix

This note is the companion contract for [Codex Parity Matrix](eval-parity-matrix.md).

Use [eval-parity-matrix.md](eval-parity-matrix.md) as the authoritative current
matrix for `prompt-language-5pej.1`. It is the file that carries the latest
repo-local evidence rows, required-versus-advisory split, host support status,
and closure reading.

This companion note now exists for two narrower purposes:

- preserve the general validation-contract language for Codex parity claims
- point reviewers at the current matrix instead of leaving an older green snapshot
  in circulation

## Current source of truth

The current factual matrix is:

- [Codex Parity Matrix](eval-parity-matrix.md)

The current supporting evidence set is:

- [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)
- [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md)
- [2026-04-11 Codex Parity Execution Evidence](2026-04-11-codex-parity-execution-evidence.md)
- [Live Validation Evidence](eval-live-validation-evidence.md)

## What this means for `prompt-language-5pej.1`

`prompt-language-5pej.1` is the matrix-definition bead.

That slice is satisfied when:

- the repo has an explicit parity matrix
- required versus advisory checks are separated clearly
- host support and blocked-host handling are explicit
- every row points to checked-in evidence or names the current evidence gap honestly

The current matrix already does that in [eval-parity-matrix.md](eval-parity-matrix.md).

## Validation-contract summary

Any Codex parity claim in this repo must still distinguish between:

- repo-local parity, where deterministic repo commands pass
- supported-host live parity, where the real agent loop passes on a supported host
- broader eval parity, where compare and verify reruns are also green

Blocked is never equivalent to passed.

Native Windows live smoke is not treated as supported-host closure proof.

Quick smoke is strong fast evidence, but it does not replace supported-host live smoke.

## Reviewer instruction

If this file and [eval-parity-matrix.md](eval-parity-matrix.md) ever diverge, treat
[eval-parity-matrix.md](eval-parity-matrix.md) as authoritative and update this
companion note rather than carrying forward stale status here.
