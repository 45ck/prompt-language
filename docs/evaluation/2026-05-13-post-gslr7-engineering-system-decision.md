# Post-GSLR-7 Engineering-System Decision: 2026-05-13

Status: research decision after GSLR-7 negative generalization result  
Primary bead: `prompt-language-gslr22`  
Companion Portarium bead: `bead-1247`

## Question

After GSLR-6 passed and GSLR-7 failed, what should we build next?

## Conclusion

Build the engineering system around deterministic scaffolds, not around bigger
local prompts.

GSLR-6 proved that fixed helper boundaries can make one local sanitizer task
repeatable. GSLR-7 proved that this does not automatically generalize when the
local model still owns policy tables and output envelopes.

The defensible next architecture is:

```text
Codex/frontier plans or advises.
Prompt Language generates the scaffold, policy tables, output envelope, gates,
and hidden-oracle contract.
The local model fills only bounded predicates.
The first failure escalates; blind local retry is not evidence.
```

## What We Learned

GSLR-7 had a deterministic scaffold proof, so the harness and oracle were sound.
The local lane still failed twice:

- v1 omitted `selectedRoute.arm`;
- v2 accepted `oracle command` because the model normalized the input key but
  left the forbidden key constants unnormalized.

The second failure repeats the GSLR-5R class. The model can write a normalizer
and still misuse it.

This narrows the thesis:

```text
Local models reduce cost only after PL removes whole classes of invariant work
from the model's responsibility.
```

## What To Build Next

The next primitive is a reusable local-screen scaffold template:

- deterministic normalized policy sets;
- deterministic output envelope construction;
- local-filled predicate slots only;
- public gate plus hidden oracle;
- Codex/frontier advisor on first failure;
- route-policy update only after N=3 clean repeats.

The checked-in template is:

```text
experiments/harness-arena/LOCAL-SCREEN-SCAFFOLD-TEMPLATE.md
```

## Product Boundary

Do not build Portarium runtime ingestion from this result.

Do not build live Cockpit cards from prompt-language manifests yet.

Do not move MacquarieCollege connector payloads, raw school data, or source
system observations through this pipeline.

## Sources

- GSLR-6 local repeat result:
  `experiments/harness-arena/results/gslr6-local-repeat-2026-05-13/report.md`
- GSLR-7 fake-live result:
  `experiments/harness-arena/results/gslr7-fake-live-2026-05-13/report.md`
- GSLR-7 local result:
  `experiments/harness-arena/results/gslr7-local-repeat-2026-05-13/report.md`
- Local-screen scaffold template:
  `experiments/harness-arena/LOCAL-SCREEN-SCAFFOLD-TEMPLATE.md`

## Execution Record

2026-05-13:

- Added GSLR-7 scaffolded route-record fixture, public gate, private oracle,
  deterministic lane, local lane, runner coverage, and result docs.
- Ran deterministic fake-live successfully.
- Ran local v1/v2 attempts; both failed with zero frontier tokens.
- Kept GSLR-7 on `frontier-baseline`.
- Defined the next engineering-system primitive as deterministic scaffold
  ownership of policy tables and output envelopes.
