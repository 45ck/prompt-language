# GSLR-5R Local Repair Repeat Result: 2026-05-12

Status: live repeat evidence, negative local-promotion result  
Tracking bead: `prompt-language-gslr18`  
Companion Portarium bead: `bead-1243`

## Question

Does the repaired GSLR-5 local lane repeat cleanly three times with the same
fixture, same private oracle, zero frontier tokens, and resource snapshots?

## Runs

Durable run roots:

- Repeat 1:
  `/tmp/prompt-language-gslr5r-live/gslr5r-raw-payload-adversarial-live-2026-05-12-01-local-repair-repeat`
- Repeat 2:
  `/tmp/prompt-language-gslr5r-live/gslr5r-raw-payload-adversarial-live-2026-05-12-02-local-repair-repeat`
- Repeat 3:
  `/tmp/prompt-language-gslr5r-live/gslr5r-raw-payload-adversarial-live-2026-05-12-03-local-repair-repeat`

## Result

| Repeat | Final verdict | Private oracle | Failure boundary                               | Frontier tokens | Provider USD | Step wall time |
| ------ | ------------- | -------------- | ---------------------------------------------- | --------------- | ------------ | -------------- |
| 1      | fail          | fail           | Accepted source payload raw key                | 0               | 0            | 60.563s        |
| 2      | fail          | fail           | Accepted unsafe `../private/raw-dump.json` ref | 0               | 0            | 60.526s        |
| 3      | fail          | fail           | Accepted source payload raw key                | 0               | 0            | 60.524s        |

Each repeat recorded two local runtime samples during `local-bulk`.

## Interpretation

The one clean GSLR-5 local repair pass did not repeat.

The failure pattern is useful:

- repeats 1 and 3 generated a forbidden-key check that compared normalized input
  keys against unnormalized forbidden-key constants, so the source payload key
  slipped through;
- repeat 2 preserved safe refs but failed to reject an unsafe raw-dump path with
  parent traversal.

That means the prompt-level repair improved the lane but did not make it stable.
The local model can produce a passing sanitizer once, but the current natural
language lane contract is not reliable enough for privacy-sensitive routing.

## Decision

Keep `gslr5-raw-payload-adversarial` on `frontier-baseline`.

Do not promote `local-screen`, `advisor-only`, or `local-repair-candidate` for
this task shape yet.

## Next Move

The next research step should not be another free-form local prompt. It should
test a stronger PL contract or scaffolded skeleton:

- provide fixed helper names for key normalization, recursive string scanning,
  and artifact-ref validation;
- require the model to fill small policy tables or isolated predicates instead
  of writing the whole sanitizer from scratch;
- keep the same private oracle unchanged;
- rerun the same three-repeat bar only after that scaffold exists.

## Product Boundary

Portarium runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

MacquarieCollege connector/raw school-data movement remains blocked.
