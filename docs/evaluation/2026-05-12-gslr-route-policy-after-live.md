# GSLR Route Policy After Live Schema Evidence: 2026-05-12

Status: route-policy decision record  
Tracking bead: `prompt-language-gslr8`  
Companion Portarium bead: `bead-1233`

## What Changed

GSLR-2 live did not just produce another result. It changed the routing policy.

The previous question was whether a hybrid local/frontier route could beat a
frontier-only control. The hardened live answer was:

```text
Not for this tiny schema task. Local-only was enough. Hybrid passed, but it was
more expensive than frontier-only.
```

## Evidence

Hardened GSLR-2 live result:

| Arm             | Result | Frontier tokens |
| --------------- | ------ | --------------- |
| `local-only`    | pass   | 0               |
| `frontier-only` | pass   | 45,713          |
| `advisor-only`  | pass   | 15,301          |
| `hybrid-router` | pass   | 91,279          |

The durable report is:

```text
experiments/harness-arena/results/gslr2-live-2026-05-12/report.md
```

## Policy Decision

Add a GSLR policy-schema route policy:

```text
experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json
```

Current route:

```text
gslr2-policy-schema -> local-screen
```

This is not `local-promoted` yet. One clean fixture is enough to justify a local
screening route for this exact task shape, but not enough to generalize across
policy/schema work.

## Route Rules

- Use `local-screen` for one-file schema tasks with explicit rules, public gate,
  private oracle, and no production side effects.
- Use `advisor-only` after one local failure if the task remains low ambiguity.
- Use `frontier-baseline` for high ambiguity, weak gates, privacy/security
  sensitivity, or multi-file API contracts.
- Use `hybrid-required` only when independent governance requires final review;
  do not assume hybrid is cost-saving.

## What We Learned

The exciting part is not "hybrid won". It did not.

The exciting part is that Prompt Language can make local-model capability
measurable enough to avoid unnecessary frontier work. The practical wedge is
evidence-based routing:

```text
cheap local lane when gates are strong;
advisor when local needs guidance;
frontier when risk or ambiguity is high;
hybrid when review is required, not by default.
```

## Next Step

Build the GSLR policy-schema fixture family:

- `gslr3-policy-manifest-transform`;
- `gslr4-two-file-validator`;
- `gslr5-raw-payload-adversarial`.

Only after that family gives a stable routing pattern should Portarium build a
product evidence card or runtime ingestion path.
