#!/usr/bin/env bash
# Marketing Factory Experiment V2 Runner
# Runs both solo-v2 and factory-v2 lanes, then verifies with MK-1/2/3 v2 checks
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOLO_DIR="$SCRIPT_DIR/results/run2/solo"
FACTORY_DIR="$SCRIPT_DIR/results/run2/factory"

echo "=== Marketing Factory Experiment V2 ==="
echo ""

# Clean previous run2 results
rm -rf "$SOLO_DIR" "$FACTORY_DIR"
mkdir -p "$SOLO_DIR" "$FACTORY_DIR"

# Unset CLAUDECODE to allow nested sessions
unset CLAUDECODE 2>/dev/null || true

# ─── Lane 1: Solo V2 (Claude + CLAUDE.md + skills) ───
echo "--- Lane 1: Solo V2 (CLAUDE.md + 4 skills + detailed prompt) ---"
(
  cd "$SOLO_DIR"
  # Copy project template
  cp "$SCRIPT_DIR/solo-v2/CLAUDE.md" .
  mkdir -p .claude/skills/landing-page .claude/skills/seo-pass .claude/skills/brand-check .claude/skills/conversion-audit
  cp "$SCRIPT_DIR/solo-v2/.claude/skills/landing-page/SKILL.md" .claude/skills/landing-page/
  cp "$SCRIPT_DIR/solo-v2/.claude/skills/seo-pass/SKILL.md" .claude/skills/seo-pass/
  cp "$SCRIPT_DIR/solo-v2/.claude/skills/brand-check/SKILL.md" .claude/skills/brand-check/
  cp "$SCRIPT_DIR/solo-v2/.claude/skills/conversion-audit/SKILL.md" .claude/skills/conversion-audit/

  SOLO_PROMPT=$(cat "$SCRIPT_DIR/solo-v2/prompt.md")
  claude -p --dangerously-skip-permissions "$SOLO_PROMPT"
)
echo ""
if [ -f "$SOLO_DIR/index.html" ]; then
  echo "  [OK] Solo index.html created ($(wc -c < "$SOLO_DIR/index.html") bytes)"
else
  echo "  [WARN] Solo index.html not found"
fi
echo ""

# ─── Lane 2: Factory V2 (PL runtime + multi-phase flow) ───
echo "--- Lane 2: Factory V2 (PL flow + 4 phases + 4 libraries) ---"
(
  cd "$FACTORY_DIR"
  FLOW_CONTENT=$(cat "$SCRIPT_DIR/factory-v2/project.flow")
  claude -p --dangerously-skip-permissions "$FLOW_CONTENT"
)
echo ""
if [ -f "$FACTORY_DIR/index.html" ]; then
  echo "  [OK] Factory index.html created ($(wc -c < "$FACTORY_DIR/index.html") bytes)"
else
  echo "  [WARN] Factory index.html not found"
fi
echo ""

# ─── Verification ───
echo "========================================="
echo "=== VERIFICATION RESULTS (V2 — 30 checks each) ==="
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
echo ">>> SOLO V2 RESULTS <<<"
run_verify "MK-1v2 Quality+A11y (Solo)"  "$SCRIPT_DIR/verify-mk1-v2.cjs" "$SOLO_DIR/index.html"
run_verify "MK-2v2 Content+SEO (Solo)"   "$SCRIPT_DIR/verify-mk2-v2.cjs" "$SOLO_DIR/index.html"
run_verify "MK-3v2 Brand+Design (Solo)"  "$SCRIPT_DIR/verify-mk3-v2.cjs" "$SOLO_DIR/index.html"

echo ""
echo ">>> FACTORY V2 RESULTS <<<"
run_verify "MK-1v2 Quality+A11y (Factory)"  "$SCRIPT_DIR/verify-mk1-v2.cjs" "$FACTORY_DIR/index.html"
run_verify "MK-2v2 Content+SEO (Factory)"   "$SCRIPT_DIR/verify-mk2-v2.cjs" "$FACTORY_DIR/index.html"
run_verify "MK-3v2 Brand+Design (Factory)"  "$SCRIPT_DIR/verify-mk3-v2.cjs" "$FACTORY_DIR/index.html"

echo ""
echo "========================================="
echo "Experiment V2 complete. Results in:"
echo "  Solo:    $SOLO_DIR/index.html"
echo "  Factory: $FACTORY_DIR/index.html"
echo "========================================="
