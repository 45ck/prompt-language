#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "prompt-language installer"
echo "========================"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo -e "${RED}Error: Node.js is not installed.${NC}"
  echo "Install Node.js 22+ from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt 22 ]; then
  echo -e "${RED}Error: Node.js 22+ required (found v${NODE_VERSION}).${NC}"
  echo "Update from https://nodejs.org"
  exit 1
fi

# Check Claude CLI
if ! command -v claude &>/dev/null; then
  echo -e "${RED}Warning: Claude CLI not found.${NC}"
  echo "Install from https://docs.anthropic.com/en/docs/claude-code"
fi

# Install via npx
if command -v npx &>/dev/null; then
  echo "Installing via npx..."
  npx @45ck/prompt-language
  echo -e "${GREEN}Done!${NC}"
  exit 0
fi

# Fallback: git clone + manual install
echo "npx not found, falling back to git clone..."
if ! command -v git &>/dev/null; then
  echo -e "${RED}Error: Neither npx nor git is available.${NC}"
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
git clone https://github.com/45ck/prompt-language.git "$TMPDIR"
cd "$TMPDIR"
npm install && npm run build
node bin/cli.mjs
echo -e "${GREEN}Done!${NC}"
