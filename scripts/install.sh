#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "prompt-language installer"
echo "========================"

fail() {
  echo -e "${RED}Error: $1${NC}"
  shift || true
  for message in "$@"; do
    echo "$message"
  done
  exit 1
}

# Check Node.js
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed." "Install Node.js 22+ from https://nodejs.org"
fi

NODE_VERSION=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt 22 ]; then
  fail "Node.js 22+ required (found v${NODE_VERSION})." "Update from https://nodejs.org"
fi

# Check Claude CLI
if ! command -v claude &>/dev/null; then
  echo -e "${RED}Warning: Claude CLI not found.${NC}"
  echo "Install from https://docs.anthropic.com/en/docs/claude-code"
fi

# Install via npx
if command -v npx &>/dev/null; then
  echo "Installing via npx..."
  if ! npx --yes @45ck/prompt-language install; then
    fail \
      "npx install failed." \
      "Try these steps:" \
      "  1. Re-run with a clean npm cache: npm cache verify" \
      "  2. Install directly: npm install -g @45ck/prompt-language" \
      "  3. Verify the result: npx @45ck/prompt-language status"
  fi
  echo -e "${GREEN}Done!${NC}"
  exit 0
fi

# Fallback: git clone + manual install
echo "npx not found, falling back to git clone..."
if ! command -v git &>/dev/null; then
  fail "Neither npx nor git is available." "Install npm/npx or git, then rerun this installer."
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
if ! git clone https://github.com/45ck/prompt-language.git "$TMPDIR"; then
  fail \
    "git clone failed." \
    "Check network access to https://github.com/45ck/prompt-language and retry."
fi
cd "$TMPDIR"
if [ -f package-lock.json ]; then
  npm ci || fail "npm ci failed." "Check npm registry access, then retry."
else
  npm install || fail "npm install failed." "Check npm registry access, then retry."
fi

npm run build || fail "npm run build failed." "Fix the build error output, then rerun the installer."
node bin/cli.mjs install || fail \
  "Local install failed." \
  "Run \"node bin/cli.mjs status\" in the cloned checkout for more details."
echo -e "${GREEN}Done!${NC}"
