# Post-GSLR-4 Research Decision: 2026-05-12

Status: live-result synthesis  
Tracking bead: `prompt-language-gslr15`  
Companion Portarium bead: `bead-1240`

## Decision

The GSLR route policy should stay task-shape specific.

GSLR-4 does not recover a broad local or advisor route. The two-file static
evidence-card validator now routes to `frontier-baseline` under the current
lanes because:

- `local-only` failed the private oracle by throwing on `null`;
- `advisor-only` passed, but used 32,862 frontier tokens;
- `frontier-only` passed with 20,579 frontier tokens.

Advisor-only is useful as a diagnostic and repair pattern, but the current
advisor prompt is not cost-effective for this fixture.

## Research Context

The external literature still supports model routing and cascades, not generic
local-first claims:

- FrugalGPT supports cascading only when lower-cost calls preserve quality for a
  known workload.
- RouteLLM-style routing supports learned or measured routers between weaker
  and stronger models.
- OpenAI Symphony and coding-agent boards such as Vibe Kanban support the need
  for orchestration, workspaces, and review surfaces around agent work.

The internal evidence now gives the sharper boundary:

- GSLR-2: local-screen works for the exact tiny one-file policy/schema validator.
- GSLR-3: evidence-card transformation routes to frontier-baseline.
- GSLR-4: two-file evidence-card validation also routes to frontier-baseline
  under current prompts, even though advisor-only can pass.

## What We Learned

The interesting signal is not "local models reduce cost." The real signal is:

```text
Local models are useful only when the task shape has a passing, measured route.
```

For Prompt Language, that means the route policy must stay close to fixtures,
private oracles, and live manifests.

For Portarium, that means static evidence-card contracts are valuable, but live
Cockpit ingestion remains premature.

For MC, that means no connector observation or raw school payload movement is
justified by the GSLR evidence so far.

## Next Step

Build GSLR-5 before product ingestion:

```text
gslr5-raw-payload-adversarial
```

Why: GSLR-5 tests the privacy boundary directly. If raw-payload ambiguity
defeats local or advisor routes, the route policy should state that
privacy-sensitive evidence-card work bypasses local screening and goes straight
to frontier-baseline or governance-required review.

## Sources

- GSLR-4 live result:
  `experiments/harness-arena/results/gslr4-live-2026-05-12/report.md`
- GSLR route policy:
  `experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json`
- FrugalGPT: <https://arxiv.org/abs/2305.05176>
- RouteLLM: <https://arxiv.org/abs/2406.18665>
- OpenAI Symphony:
  <https://openai.com/es-419/index/open-source-codex-orchestration-symphony/>
- OpenAI Codex harness:
  <https://openai.com/index/unlocking-the-codex-harness/>
- Vibe Kanban: <https://github.com/BloopAI/vibe-kanban>
