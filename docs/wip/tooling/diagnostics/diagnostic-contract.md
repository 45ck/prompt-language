# Diagnostic Contract

## Report shape

```ts
type Report = {
  status: 'success' | 'blocked' | 'unsuccessful' | 'failed';
  diagnostics: Diagnostic[];
  outcomes: Outcome[];
};
```

## Diagnostic

```ts
type DiagnosticKind = 'parse' | 'profile' | 'runtime' | 'internal';
type DiagnosticPhase = 'parse' | 'preflight' | 'session-init' | 'advance' | 'gate-eval' | 'render';

type Severity = 'info' | 'warn' | 'error' | 'fatal';

type Diagnostic = {
  code: string;
  kind: DiagnosticKind;
  phase: DiagnosticPhase;
  severity: Severity;
  blocksExecution: boolean;
  retryable: boolean;
  summary: string;
  detail?: string;
  action?: string;
  nodeId?: string;
  feature?: string;
  profile?: string;
  cause?: string;
};
```

## Outcome

```ts
type OutcomeKind =
  | 'gate-failed'
  | 'budget-exhausted'
  | 'approval-denied'
  | 'review-rejected'
  | 'completed';

type Outcome = {
  code: string;
  kind: OutcomeKind;
  terminal: boolean;
  summary: string;
  detail?: string;
  nodeId?: string;
};
```

## Status derivation

- `success` if there are no blocking diagnostics and the terminal outcome is successful or absent
- `blocked` if there is any blocking parse/profile diagnostic
- `unsuccessful` if execution completed but the terminal outcome is negative
- `failed` if there is a runtime/internal failure

## Why this contract

The proposed contract is intentionally small enough to wire into the current engine without forcing a full harness rewrite first.

It also makes one crucial distinction explicit:

- diagnostics explain why execution was blocked or failed
- outcomes explain what happened when execution was otherwise valid
