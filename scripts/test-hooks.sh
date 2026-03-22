#!/bin/sh
# test-hooks.sh — Validate noslop hook logic by simulating scenarios in a temp git repo.
#
# Usage: bash scripts/test-hooks.sh
#
# Creates a disposable git repo, copies in the hooks, and runs test cases
# that verify the hooks block/allow the correct changes.
set -e

PASS=0
FAIL=0
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

# --- Setup temp repo ---
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cd "$TMPDIR"
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git config core.hooksPath .githooks

mkdir -p .githooks .github/workflows .claude/hooks
cp "$REPO_ROOT/.githooks/pre-commit" .githooks/pre-commit
cp "$REPO_ROOT/.githooks/commit-msg" .githooks/commit-msg
chmod +x .githooks/pre-commit .githooks/commit-msg

# Stub npm commands so the hook's final `npm run format:check && npm run lint && npm run spell` succeeds
mkdir -p node_modules/.bin
cat > package.json << 'PKG'
{
  "scripts": {
    "format:check": "echo ok",
    "lint": "echo ok",
    "spell": "echo ok"
  }
}
PKG

# Initial commit so git diff --cached works
git add -A
git commit -q -m "chore: initial commit" --no-verify

# --- Test helpers ---
expect_block() {
  TEST_NAME="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "FAIL: $TEST_NAME (expected BLOCK, got PASS)"
    FAIL=$((FAIL + 1))
  else
    echo "PASS: $TEST_NAME (correctly blocked)"
    PASS=$((PASS + 1))
  fi
}

expect_pass() {
  TEST_NAME="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS: $TEST_NAME (correctly passed)"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $TEST_NAME (expected PASS, got BLOCK)"
    FAIL=$((FAIL + 1))
  fi
}

reset_staging() {
  git reset -q HEAD 2>/dev/null || true
  git checkout -q -- . 2>/dev/null || true
  git clean -fdq 2>/dev/null || true
  # Recreate directories that git clean may have removed
  mkdir -p .github/workflows .claude/hooks .githooks
}

# =============================================================================
# PRE-COMMIT TESTS
# =============================================================================

# --- Test 1: Adding a new CI job to a workflow should PASS ---
reset_staging
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'EOF'
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm run ci
EOF
git add .github/workflows/ci.yml
git commit -q -m "chore: add ci workflow" --no-verify
# Now add a new job (additive change)
cat >> .github/workflows/ci.yml << 'EOF'

  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint
EOF
git add .github/workflows/ci.yml
expect_pass "T1: Adding new CI job to workflow" git commit -m "chore: add lint job"

# --- Test 2: Removing npm run ci from a workflow should BLOCK ---
reset_staging
cat > .github/workflows/ci.yml << 'EOF'
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "no quality"
EOF
git add .github/workflows/ci.yml
expect_block "T2: Removing npm run ci from workflow" git commit -m "chore: remove ci"

# --- Test 3: Adding continue-on-error: true to a workflow should BLOCK ---
reset_staging
cat > .github/workflows/ci.yml << 'EOF'
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    continue-on-error: true
    steps:
      - run: npm run ci
EOF
git add .github/workflows/ci.yml
expect_block "T3: Adding continue-on-error: true to workflow" git commit -m "chore: add continue-on-error"

# --- Test 4: Adding [skip ci] to a workflow should BLOCK ---
reset_staging
cat > .github/workflows/ci.yml << 'EOF'
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm run ci
      - run: echo "[skip ci]"
EOF
git add .github/workflows/ci.yml
expect_block "T4: Adding [skip ci] to workflow" git commit -m "chore: add skip ci"

# --- Test 5: Net removing exit 1 from a hook should BLOCK ---
reset_staging
cat > .githooks/test-hook.sh << 'EOF'
#!/bin/sh
set -e
echo "checking"
exit 1
EOF
git add .githooks/test-hook.sh
git commit -q -m "chore: add test hook" --no-verify
# Now remove the exit 1
cat > .githooks/test-hook.sh << 'EOF'
#!/bin/sh
set -e
echo "checking"
echo "done"
EOF
git add .githooks/test-hook.sh
expect_block "T5: Net removing exit 1 from hook" git commit -m "chore: remove exit 1"

# --- Test 6: Adding exit 1 to a hook should PASS ---
reset_staging
cat > .githooks/test-hook.sh << 'EOF'
#!/bin/sh
set -e
echo "checking"
echo "done"
exit 1
exit 1
EOF
git add .githooks/test-hook.sh
expect_pass "T6: Adding exit 1 to hook" git commit -m "chore: add exit 1"

# --- Test 7: Removing set -e from a hook should BLOCK ---
reset_staging
cat > .githooks/test-hook.sh << 'EOF'
#!/bin/sh
echo "checking"
echo "done"
exit 1
exit 1
EOF
git add .githooks/test-hook.sh
expect_block "T7: Removing set -e from hook" git commit -m "chore: remove set -e"

# =============================================================================
# COMMIT-MSG TESTS
# =============================================================================

# --- Test 8: Commit subject with [skip ci] should BLOCK ---
reset_staging
echo "test8" > testfile8.txt
git add testfile8.txt
expect_block "T8: Commit subject with [skip ci]" git commit -m "chore: do stuff [skip ci]"

# --- Test 9: Commit body with --no-verify should PASS ---
# (commit-msg hook only checks subject line, body is allowed to mention bypass keywords)
reset_staging
echo "test9" > testfile9.txt
git add testfile9.txt
MSG_FILE=$(mktemp)
cat > "$MSG_FILE" << 'EOF'
chore: document hook bypass patterns

The --no-verify flag is blocked by the pre-commit hook.
EOF
expect_pass "T9: Commit body with --no-verify (allowed)" git commit -F "$MSG_FILE"
rm -f "$MSG_FILE"

# --- Test 10: Commit subject with skip-checks should BLOCK ---
reset_staging
echo "test10" > testfile10.txt
git add testfile10.txt
expect_block "T10: Commit subject with skip-checks" git commit -m "ci: skip-checks for speed"

# --- Test 11: Non-conventional commit message should BLOCK ---
reset_staging
echo "test11" > testfile11.txt
git add testfile11.txt
expect_block "T11: Non-conventional commit message" git commit -m "added some stuff"

# --- Test 12: Valid conventional commit should PASS ---
reset_staging
echo "test12" > testfile12.txt
git add testfile12.txt
expect_pass "T12: Valid conventional commit" git commit -m "feat(hooks): add new validation"

# =============================================================================
# D1 TESTS: Direct tool invocation detection
# =============================================================================

# --- Test 13: Removing npx vitest from workflow should BLOCK ---
reset_staging
cat > .github/workflows/ci.yml << 'EOF'
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npx vitest
EOF
git add .github/workflows/ci.yml
git commit -q -m "chore: add vitest workflow" --no-verify
cat > .github/workflows/ci.yml << 'EOF'
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "no tests"
EOF
git add .github/workflows/ci.yml
expect_block "T13: Removing npx vitest from workflow" git commit -m "chore: remove vitest"

# --- Test 14: Removing npx eslint from enforcement file should BLOCK ---
reset_staging
cat > .claude/hooks/test.sh << 'EOF'
#!/bin/sh
npx eslint .
exit 1
EOF
git add .claude/hooks/test.sh
git commit -q -m "chore: add eslint hook" --no-verify
cat > .claude/hooks/test.sh << 'EOF'
#!/bin/sh
echo "no lint"
exit 1
EOF
git add .claude/hooks/test.sh
expect_block "T14: Removing npx eslint from enforcement file" git commit -m "chore: remove eslint"

# =============================================================================
# D2 TESTS: --no-verify in CI/config
# =============================================================================

# --- Test 15: Adding --no-verify to workflow should BLOCK ---
reset_staging
cat > .github/workflows/ci.yml << 'EOF'
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npx vitest
      - run: git commit --no-verify -m "auto"
EOF
git add .github/workflows/ci.yml
expect_block "T15: Adding --no-verify to workflow" git commit -m "chore: add no-verify"

# =============================================================================
# TIER 1 TESTS: Protected config files
# =============================================================================

# --- Test 16: Modifying eslint.config.mjs should BLOCK ---
reset_staging
echo "// modified" > eslint.config.mjs
git add eslint.config.mjs
expect_block "T16: Modifying eslint.config.mjs (protected config)" git commit -m "chore: tweak eslint"

# =============================================================================
# RESULTS
# =============================================================================

echo ""
echo "========================================="
echo "Results: $PASS passed, $FAIL failed out of $((PASS + FAIL)) tests"
echo "========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
