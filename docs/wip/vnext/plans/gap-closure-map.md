# Gap closure map

## Gap → feature mapping

| Gap                        | Why it matters                            | Primary fix                  | Secondary fix            |
| -------------------------- | ----------------------------------------- | ---------------------------- | ------------------------ |
| Fail-open runtime behavior | Hidden errors turn into later cleanup     | Strict mode                  | Checkpoints/replay       |
| Scope babysitting          | Human diff review is expensive            | Contracts                    | Contract lint/tests      |
| Opaque side effects        | Retries/resume are risky                  | Effect system                | Capabilities + policy    |
| Weak replayability         | Debugging and evals are weak              | Event log                    | Reports + artifacts      |
| Loose state model          | Hard to reason about downstream values    | Schemas/artifacts            | Static analysis          |
| Unsafe parallelism         | Multi-agent coordination causes conflicts | Worktrees/locks              | Ownership + merge policy |
| Provider specificity       | Long-term portability risk                | Flow IR                      | Provider adapters        |
| Ad hoc learning            | Repeated failure elimination is manual    | Evals + regression promotion | Memory governance        |

## Most leverage per implementation effort

### Very high leverage / moderate effort

- `review strict`
- approval timeout reject
- contract v1
- event log JSONL
- replay/report CLI

### High leverage / higher effort

- effect system
- Flow IR
- worktree spawn
- eval runner

### Medium leverage / important foundation

- typed adapters
- memory governance
- flow tests and simulator
