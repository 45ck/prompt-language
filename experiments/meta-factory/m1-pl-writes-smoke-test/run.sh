#!/usr/bin/env bash
# M1 orchestrator per META-4 section 7.
#
# Usage:
#   run.sh --dry-run    Print what would happen; do not invoke claude.
#   run.sh --print      Alias for --dry-run.
#   run.sh              Live run (requires META-5 bootstrap envelope).
#
# Environment (optional):
#   PL_RUN_ID           Override the generated run id.
#   CLAUDE_BIN          Override 'claude' binary path.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
FLOW_FILE="$SCRIPT_DIR/m1.flow"
SYNONYMS_FILE="$SCRIPT_DIR/synonyms.json"

MODE="live"
for arg in "$@"; do
  case "$arg" in
    --dry-run|--print) MODE="dry" ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

: "${PL_RUN_ID:=m1-$(date +%s)}"
WORKSPACE="$REPO_ROOT/experiments/meta-factory/workspaces/$PL_RUN_ID"
EVIDENCE="$WORKSPACE/evidence"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

echo "== M1 run plan =="
echo "repo:        $REPO_ROOT"
echo "run id:      $PL_RUN_ID"
echo "workspace:   $WORKSPACE"
echo "evidence:    $EVIDENCE"
echo "flow:        $FLOW_FILE"
echo "synonyms:    $SYNONYMS_FILE"
echo "mode:        $MODE"
echo

plan_steps() {
  cat <<EOF
Steps that would execute:
  1. Verify META-5 bootstrap envelope (8 items).
  2. git stash push -u (record stash ref).
  3. export PL_RUN_ID=$PL_RUN_ID PL_TRACE=1 PL_TRACE_STRICT=1
  4. node bin/cli.mjs install
  5. mkdir -p $EVIDENCE
  6. git diff > $EVIDENCE/diff.pre.patch
  7. $CLAUDE_BIN -p --dangerously-skip-permissions "\$(cat $FLOW_FILE)"
  8. git diff > $EVIDENCE/diff.post.patch
  9. Run O1..O5 oracles in order.
 10. On failure: git stash pop (restore); mark evidence/oracles.json failed.
 11. On success: archive trace, logs, manifest.
EOF
}

if [[ "$MODE" == "dry" ]]; then
  plan_steps
  echo
  echo "(dry run - nothing executed)"
  exit 0
fi

cd "$REPO_ROOT"

# --- live path ---
STASH_REF=""
restore_stash() {
  if [[ -n "$STASH_REF" ]]; then
    echo "restoring stash $STASH_REF"
    git stash pop "$STASH_REF" || echo "stash pop failed; inspect manually"
  fi
}
trap restore_stash EXIT

echo "-- stashing working tree --"
STASH_MSG="meta-factory-m1-$PL_RUN_ID"
if git status --porcelain | grep -q .; then
  git stash push -u -m "$STASH_MSG" >/dev/null
  STASH_REF="$(git stash list | grep "$STASH_MSG" | head -1 | cut -d: -f1)"
  echo "stashed as: $STASH_REF"
else
  echo "working tree clean; no stash created"
fi

mkdir -p "$EVIDENCE"
git diff > "$EVIDENCE/diff.pre.patch" || true

export PL_RUN_ID PL_TRACE=1 PL_TRACE_STRICT=1

echo "-- installing plugin --"
node bin/cli.mjs install

echo "-- invoking claude --"
"$CLAUDE_BIN" -p --dangerously-skip-permissions "$(cat "$FLOW_FILE")" \
  | tee "$EVIDENCE/claude.log"

git diff > "$EVIDENCE/diff.post.patch" || true

echo "-- running oracles --"
O1=1; O2=1; O3=1; O4=1; O5=1
# Oracle stubs - real evaluation requires verify-trace + grep pre/post snapshots.
# The orchestrator writes oracles.json with placeholder values that a follow-up
# task will flesh out once verify-trace is wired in.
cat > "$EVIDENCE/oracles.json" <<JSON
{
  "o1_parse": $O1,
  "o2_novelty": $O2,
  "o3_runnable": $O3,
  "o4_traced": $O4,
  "o5_catalog": $O5,
  "run_id": "$PL_RUN_ID",
  "note": "oracle evaluation logic pending; see protocol.md"
}
JSON

echo "-- done --"
# Stash restore only on failure; clear the trap for success path.
STASH_REF=""
trap - EXIT
echo "evidence bundle: $EVIDENCE"
