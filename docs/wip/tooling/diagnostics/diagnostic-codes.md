# Diagnostic And Outcome Codes

## Ranges

- `PLP-*` — parse / shape
- `PLC-*` — compatibility, preflight, profile
- `PLR-*` — runtime
- `PLI-*` — internal
- `PLO-*` — outcomes

## Initial codes

| Code      | Kind     | Blocking | Retryable | Meaning                                           |
| --------- | -------- | -------- | --------- | ------------------------------------------------- |
| `PLP-001` | parse    | yes      | no        | invalid indentation or malformed block            |
| `PLP-002` | parse    | yes      | no        | unknown syntax token or unsupported grammar form  |
| `PLP-003` | parse    | yes      | no        | malformed interpolation or variable expression    |
| `PLP-004` | parse    | yes      | no        | malformed `done when:` section                    |
| `PLC-001` | profile  | yes      | no        | missing runner binary                             |
| `PLC-002` | profile  | yes      | no        | missing auth / unavailable harness session        |
| `PLC-003` | profile  | yes      | no        | unsupported host / execution mode                 |
| `PLC-004` | profile  | yes      | no        | `approve` unsupported in non-interactive profile  |
| `PLC-005` | profile  | yes      | no        | required gate evaluator unavailable               |
| `PLC-006` | profile  | yes      | no        | required parallel semantics unavailable           |
| `PLC-007` | profile  | no       | no        | UX-only feature unavailable                       |
| `PLC-008` | profile  | yes      | no        | required capture semantics unavailable            |
| `PLR-001` | runtime  | no       | yes       | subprocess launch failed                          |
| `PLR-002` | runtime  | no       | yes       | transient IPC / harness communication failure     |
| `PLR-003` | runtime  | yes      | maybe     | session-state read/write failure                  |
| `PLR-004` | runtime  | yes      | no        | resume-state corruption                           |
| `PLR-005` | runtime  | no       | yes       | capture retry exhausted with empty-value fallback |
| `PLR-006` | runtime  | yes      | maybe     | gate evaluation crashed                           |
| `PLI-001` | internal | yes      | no        | invariant failed                                  |
| `PLI-002` | internal | yes      | no        | impossible report state                           |
| `PLO-001` | outcome  | no       | no        | gate evaluated false                              |
| `PLO-002` | outcome  | no       | no        | review rejected                                   |
| `PLO-003` | outcome  | no       | no        | approval denied                                   |
| `PLO-004` | outcome  | no       | no        | budget exhausted                                  |
| `PLO-005` | outcome  | no       | no        | completed                                         |

## Intent

The pack argues for stable public code ranges early, even if individual codes expand later, so CLI callers and future CI integrations have something durable to key on.
