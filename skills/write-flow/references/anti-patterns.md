# Write-Flow Anti-Patterns

Use this as a deeper companion to `SKILL.md` when a proposed flow feels heavy.

## 1) Sequential Prompt Chains

If the steps are just "understand, plan, execute", keep it in one prompt and gate the result. Multiple `prompt:` nodes usually add latency without adding enforcement.

## 2) Gate-on-File for Trivial Creation

Avoid `file_exists` for files the model can create directly from a plain instruction. Reserve `file_exists` for generated artifacts or side effects that prove a pipeline executed.

## 3) Short-Distance Variables

Avoid `let` for values consumed immediately in the next line. Use `let` when values cross multiple nodes or drive loops.

## 4) Control Flow Used as Visual Organization

`if`/`while`/`try` are for real execution constraints, not section headers. If control flow exists only to organize thoughts, collapse to a single prompt.

## 5) Multi-Phase Lint/Test Orchestration by Default

Prefer one bounded retry loop that runs the real checks and asks for fixes on failure. Split phases only when the phases have different owners, tools, or rollback policy.

## 6) Unbounded Loops Without Risk Controls

Prefer `retry max N` to open-ended loops. Use `while`/`until` only when truly necessary and pair with explicit limits.
