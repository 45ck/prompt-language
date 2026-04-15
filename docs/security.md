# Security Model

prompt-language uses defense-in-depth with multiple independent safeguards. The trust model protects against accidents, credential leaks, and resource exhaustion -- not against a malicious Claude, DSL author, or compromised environment.

## Safeguards

| Threat            | Mitigation                                                                               | Implementation                                     |
| ----------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Shell injection   | `shellInterpolate()` wraps substituted values in single quotes                           | `src/domain/interpolate.ts`                        |
| Gate injection    | Whitelist of built-in predicates + safe regex for `file_exists` paths                    | `src/application/evaluate-completion.ts`           |
| Path traversal    | Regex rejects absolute paths and `..` segments                                           | `src/application/evaluate-completion.ts`           |
| State corruption  | SHA-256 checksums, two-generation backups, atomic write-then-rename                      | `src/infrastructure/adapters/file-state-store.ts`  |
| Credential leak   | `filterSpawnVariables()` excludes vars matching `_key`, `_token`, `_secret`, `_password` | `src/application/advance-flow.ts`                  |
| Capture injection | Per-session UUID4 nonce + tag validation                                                 | `src/domain/capture-prompt.ts`                     |
| Output DoS        | Truncation limits (2000 chars for variables, 500 chars for audit)                        | Various                                            |
| Command timeout   | 60s default, configurable via `PL_GATE_TIMEOUT` env var                                  | `src/application/evaluate-completion.ts`           |
| Loop exhaustion   | All loops require `max` parameter; 150 await polls; 100 auto-advance limit               | Various                                            |
| Audit trail       | Append-only JSONL log of all executed commands                                           | `src/infrastructure/adapters/file-audit-logger.ts` |

## Detailed documentation

- [Provenance attestation design](security/provenance-attestation.md) -- bundle attestation and signer model
- [Witness chain attacks](security/witness-chain-attacks.md) -- threat analysis for trace verification
- [Security audit](security/audit-2026-04-15.md) -- latest security audit findings

## Environment variables

| Variable            | Purpose                                                | Default |
| ------------------- | ------------------------------------------------------ | ------- |
| `PL_TRACE`          | Enable trace logging to `.prompt-language/trace.jsonl` | Off     |
| `PL_GATE_TIMEOUT`   | Gate command timeout in milliseconds                   | 60000   |
| `PL_COMPACT_RENDER` | Use compact rendering mode (reduces token usage)       | Off     |

## State file

Runtime state lives in `.prompt-language/session-state.json`. The file is protected by SHA-256 checksums and two-generation backups. Never hard-code paths; use the infrastructure adapter.
