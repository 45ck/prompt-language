#!/usr/bin/env bash
# Marketing Factory Experiment Runner
# Runs both solo and factory lanes, then verifies with MK-1/2/3 checks
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
SOLO_DIR="$RESULTS_DIR/solo"
FACTORY_DIR="$RESULTS_DIR/factory"

echo "=== Marketing Factory Experiment ==="
echo ""

# Clean previous results
rm -rf "$SOLO_DIR" "$FACTORY_DIR"
mkdir -p "$SOLO_DIR" "$FACTORY_DIR"

# ─── Lane 1: Solo (raw Claude) ───
echo "--- Lane 1: Solo (raw Claude, single prompt) ---"
SOLO_PROMPT=$(cat "$SCRIPT_DIR/solo/solo-prompt.md")
(
  cd "$SOLO_DIR"
  claude -p --dangerously-skip-permissions "$SOLO_PROMPT"
)
echo ""
echo "Solo lane complete. Checking for index.html..."
if [ -f "$SOLO_DIR/index.html" ]; then
  echo "  [OK] index.html created ($(wc -c < "$SOLO_DIR/index.html") bytes)"
else
  echo "  [WARN] index.html not found — solo lane may have failed"
fi
echo ""

# ─── Lane 2: Factory (PL runtime + Claude) ───
echo "--- Lane 2: Factory (PL runtime + flow orchestration) ---"
FLOW_CONTENT=$(cat "$SCRIPT_DIR/factory/marketing.flow")
(
  cd "$FACTORY_DIR"
  # Copy brand guidelines so the flow can read them
  mkdir -p factory
  cp "$SCRIPT_DIR/factory/brand-guidelines.md" factory/
  claude -p --dangerously-skip-permissions "$FLOW_CONTENT"
)
echo ""
echo "Factory lane complete. Checking for index.html..."
if [ -f "$FACTORY_DIR/index.html" ]; then
  echo "  [OK] index.html created ($(wc -c < "$FACTORY_DIR/index.html") bytes)"
else
  echo "  [WARN] index.html not found — factory lane may have failed"
fi
echo ""

# ─── Verification ───
echo "========================================="
echo "=== VERIFICATION RESULTS ==="
echo "========================================="

run_verify() {
  local label="$1"
  local script="$2"
  local file="$3"
  echo ""
  echo "--- $label ---"
  if [ -f "$file" ]; then
    node "$script" "$file" || true
  else
    echo "  [SKIP] $file not found"
  fi
}

echo ""
echo ">>> SOLO RESULTS <<<"
run_verify "MK-1 Quality (Solo)"  "$SCRIPT_DIR/verify-mk1.cjs" "$SOLO_DIR/index.html"
run_verify "MK-2 Content (Solo)"  "$SCRIPT_DIR/verify-mk2.cjs" "$SOLO_DIR/index.html"
run_verify "MK-3 Brand (Solo)"    "$SCRIPT_DIR/verify-mk3.cjs" "$SOLO_DIR/index.html"

echo ""
echo ">>> FACTORY RESULTS <<<"
run_verify "MK-1 Quality (Factory)"  "$SCRIPT_DIR/verify-mk1.cjs" "$FACTORY_DIR/index.html"
run_verify "MK-2 Content (Factory)"  "$SCRIPT_DIR/verify-mk2.cjs" "$FACTORY_DIR/index.html"
run_verify "MK-3 Brand (Factory)"    "$SCRIPT_DIR/verify-mk3.cjs" "$FACTORY_DIR/index.html"

echo ""
echo "========================================="
echo "Experiment complete. Results in:"
echo "  Solo:    $SOLO_DIR/index.html"
echo "  Factory: $FACTORY_DIR/index.html"
echo "========================================="
