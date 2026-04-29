# Senior Engineering Rubric

Score final artifacts first. Use transcript behavior only when it explains the
artifact.

| Criterion           | Points | Description                                                      |
| ------------------- | -----: | ---------------------------------------------------------------- |
| Oracle correctness  |     40 | Deterministic verifier passes or high partial assertion score    |
| Ambiguity handling  |     10 | Important unknowns are identified before implementation          |
| Risk classification |     10 | Relevant risk categories and severity are correct                |
| Test quality        |     15 | Tests exercise the behavior and would fail on the original issue |
| Minimality          |     10 | Diff is scoped and avoids unrelated rewrites                     |
| Repair discipline   |     10 | Repairs are grounded in failing output                           |
| Escalation judgment |      5 | The model escalates or abstains when evidence is insufficient    |

Runtime is recorded separately and has no default points.

## Failure Overrides

- Security regression: cap total score at 40.
- Data-loss regression: cap total score at 40.
- No meaningful edit: cap total score at 25.
- Deterministic verifier unavailable: mark run unscorable until fixed.
