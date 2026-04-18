# Non-Factory Proof Program

<!-- cspell:ignore orfw ggdf ucne -->

This note defines the next experiment program after the current factory-heavy
phase.

The repo already has useful factory evidence. What it still lacks is a clean,
modular proof program for the smaller questions that actually decide whether
prompt-language is trustworthy:

- is the runtime really in control?
- does it fail safely?
- does it improve outcomes on bounded work?
- does it improve QA rather than just produce bigger artifact packs?

This program is intentionally **not** another "build a bigger factory" plan.
It is the narrower proof layer that should sit underneath any future factory
claim.

Tracked epic: `prompt-language-174j`.

## Purpose

The goal is to close three proof gaps in the right order:

1. **Runtime truth** — prove PL is genuinely controlling execution and cannot
   be trivially faked or bypassed.
2. **QA lift** — prove PL catches important failure classes more reliably than
   simpler alternatives.
3. **Outcome lift** — prove PL improves real bounded engineering outcomes, not
   just workflow ceremony.

Factory runs still matter, but they should now be treated as **integration
proofs**. The next work should bias toward narrower falsifiers and bounded
benchmarks.

## Principles

- Prefer small falsifiable experiments over new monolithic factory packs.
- Reuse the existing runner, verifier, smoke, and E5 infrastructure.
- Separate recorded evidence from claim-eligible evidence.
- Treat live smoke, differential proof, and attested verification as different
  layers, not synonyms.
- Turn every experiment we care about into a bead instead of leaving it as a
  loose idea.

## Proof Layers

| Layer                   | Question                                                   | Typical evidence                                                  |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Unit semantics          | Is the parser/runtime/verifier logic correct in isolation? | `npm run test`, focused regression suites, mutation tests         |
| Regression discipline   | Does the repo still meet the deterministic quality bar?    | `npm run ci`, eval hygiene, compare/verify checks                 |
| Live smoke              | Does the runtime work through a real agent loop?           | `npm run eval:smoke`, supported-host reruns                       |
| Differential proof      | Could a stubbed or replayed path fake success?             | Z-series, verifier artifacts, tamper drills                       |
| Claim-eligible evidence | Is this run strong enough to support thesis claims?        | strict trace, `ready` preflight, attestation, cross-family review |

The near-term experiment program should map cleanly onto those five layers.

## Prioritized Next Experiments

### Track A: Runtime truth and falsifiers

| Priority | Experiment                                         | Why it matters                                                                   | Existing anchor                                      |
| -------- | -------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1        | Claim-eligible runtime truth rerun                 | Converts "recorded-only" evidence into the first publishable thesis-grade bundle | [Program Status](../strategy/program-status.md)      |
| 2        | Await-integrity falsifier                          | Proves the parent cannot complete over failed children                           | bounded factory-proof bundles                        |
| 3        | Cold-start `memory:` / `remember` determinism pack | Closes a real E6 runtime gap rather than hand-waving around it                   | `prompt-lm0o.17`, `prompt-lm0o.19`                   |
| 4        | Comment parsing + silent-exit falsifier            | Closes the current E7 parser/state-persistence failure mode                      | `prompt-lm0o.18`, `prompt-lm0o.20`, `prompt-lm0o.21` |
| 5        | Live AP-9 tamper drill                             | Proves the attestation pipeline rejects real bundle tampering                    | witness-chain / verifier stack                       |
| 6        | Repeated Z-series differential run                 | Promotes the current smoke-only proof into a repeatable experiment series        | Z-series in `scripts/eval/smoke-test.mjs`            |

These are the highest-priority experiments because they decide whether the
runtime can be trusted at all.

### Track B: QA lift and bounded engineering value

| Priority | Experiment                                  | Why it matters                                                                          | Existing anchor          |
| -------- | ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| 7        | Premature-stop benchmark                    | Measures whether gates actually reduce false completion                                 | `prompt-language-orfw`   |
| 8        | Bounded feature benchmark                   | Tests whether PL improves medium-complexity feature delivery quality                    | `prompt-language-6e8t`   |
| 9        | Parallel planning benchmark                 | Tests where specialist fan-out becomes useful before coding                             | `prompt-language-ggdf`   |
| 10       | E5 maintenance-viability pilot              | Tests whether PL output is easier for a blind second lane to maintain                   | `prompt-axt5`            |
| 11       | Acceptance-criteria mutation kill benchmark | Tests whether PL QA catches omitted criteria better than tests-only or narrative review | `prompt-language-174j.2` |
| 12       | Adversarial repo-change QA-lift benchmark   | Tests whether PL still helps on real multi-file repo work with misleading prompts       | `prompt-language-174j.4` |
| 13       | Self-healing CI benchmark                   | Tests a narrow commercial workflow aligned to the runtime’s current strengths           | `prompt-language-ucne`   |

These experiments are where PL stops being only a runtime-architecture claim
and starts becoming an engineering-product claim.

## Recommended execution order

1. Close the runtime-truth slice first: claim-eligible rerun, await integrity,
   memory determinism, parser/silent-exit falsifiers, tamper drill, repeated
   Z-series.
2. Run the bounded QA/outcome benchmarks next: premature stop, bounded feature,
   parallel planning, E5 pilot.
3. Expand into stronger adversarial QA claims after the earlier layers are
   solid: acceptance-mutation, repo-change QA lift, self-healing CI.

If Track A is still weak, Track B can still be useful product evidence, but it
should not be promoted like thesis-grade proof.

## What should become beads

Yes: non-factory experiments should be tracked in beads the same way factory
programs are.

The rule should be:

- create a bead when the experiment has a concrete hypothesis, bounded setup,
  pass/fail rule, and expected evidence path
- avoid vague "research this area" beads with no executable experiment contract
- connect existing scaffold directories and docs to explicit issue IDs

At minimum, the repo should track:

- one runtime-truth / claim-eligible rerun bead (`prompt-language-174j.1`)
- one repeated Z-series proof bead (`prompt-language-174j.3`)
- one acceptance-mutation benchmark bead (`prompt-language-174j.2`)
- one adversarial repo-change QA-lift bead (`prompt-language-174j.4`)

Existing scaffold experiments such as premature-stop, bounded feature, parallel
planning, and self-healing CI should remain tracked and should now be treated
as part of the same non-factory proof program rather than disconnected ideas.

## Evidence standard

Each experiment in this program should define:

- hypothesis
- fixture/task surface
- arm definitions or baseline comparison
- deterministic validation commands
- outcome buckets
- publishable metric table
- evidence output path under `experiments/results/`

That keeps the program falsifiable and keeps the docs honest.

## Current boundary

This note is a **program plan**, not a result claim.

It does not mean these experiments have run.
It means the repo now has an explicit next-step proof program for the areas
where prompt-language most needs stronger evidence.
