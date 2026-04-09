# Recommended Adoption Order

## Phase 1 — disciplined explicitness

Ship first:

- `knowledge:`
- `section`
- scoped `remember`
- strict/optional memory reads
- `checkpoint`

Reason:
These align best with Prompt Language's current explicit runtime model.

## Phase 2 — controlled retrieval

Ship next:

- abstract `retrieve`
- filtered recall
- exact/keyword/hybrid mode as abstraction
- visibility into retrieval results

Reason:
Useful, but should remain secondary to deterministic control.

## Phase 3 — maintenance and consolidation

Then:

- summarization
- compaction
- handoff summaries
- background consolidation
- versioned memory backends

Reason:
Operationally important, but better treated as runtime/project concerns than first-run syntax.

## Phase 4 — eval alignment

Then integrate:

- rubrics
- judges
- eval suites
- baselines
- replay
- artifact inspection

Reason:
This is where quality measurement belongs, not inside ordinary completion semantics.

## Final rule

If a feature makes Prompt Language more like an explicit engineering medium, keep it.
If it mainly leaks storage or retrieval backend internals into ordinary flows, push it down a layer.
