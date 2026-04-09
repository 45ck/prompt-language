# Open Questions

These are the decisions worth settling before coding.

## 1. Should `start` allow multiple roles?

Recommendation: yes.
Reason: concise and easy to lower.

## 2. Should `await all` await only started roles or all declared roles?

Recommendation: only started roles.
Reason: declared roles are templates, not live children.

## 3. What happens if a role never calls `return`?

Recommendation:

- `returned` = empty string
- `result` = empty string
- status remains based on execution outcome
  This avoids deadlocking the parent on missing returns.

## 4. Should `return` end role execution immediately?

Recommendation: yes.
Treat it like an early return to keep semantics unsurprising.

## 5. Should a role be allowed to call `approve`?

Recommendation: probably no in v1, or strongly discourage it.
Keep human checkpoint authority with the parent unless there is a strong use case.

## 6. Should `role` bodies allow `spawn` directly?

Recommendation: no in v1.
Avoid indirect nested orchestration.

## 7. Should a swarm have local variables shared across roles?

Recommendation: no mutable shared swarm scope in v1.
Copy-in via `with vars`, copy-out via `return`.

## 8. Should there be `merge` / `reduce` syntax in v1?

Recommendation: no.
The parent can already do synthesis after awaits.
Add reducer helpers later if the pattern repeats often.

## 9. Should role results be addressable before `await`?

Recommendation: no.
Prevent races and half-baked reads.

## 10. Should `swarm` itself allow `done when:`?

Recommendation: no in v1.
Keep completion truth centralized at the outer flow level.

## 11. Should role options include timeouts/budgets now?

Recommendation: maybe parser support later, but do not block v1 on it.

## 12. Should `start reviewer` be allowed before worker awaits?

Recommendation: yes.
Coordination order should stay flexible if the lowering remains straightforward.
