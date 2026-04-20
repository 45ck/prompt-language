#!/usr/bin/env bash
# Solo arm: aider directly, no PL. One prompt, no retry.
# Usage: solo-arm.sh <model> <runlabel>
set -e
MODEL=${1:?model required, e.g. ollama_chat/qwen3:8b}
LABEL=${2:?label required, e.g. qwen3-8b-solo}
ROOT=$(cd "$(dirname "$0")" && pwd)
RUNDIR="$ROOT/runs/r1/$LABEL"
rm -rf "$RUNDIR"
mkdir -p "$RUNDIR"
cp "$ROOT/fixtures/e-small/verify.cjs" "$RUNDIR/"
cp "$ROOT/fixtures/e-small/test-input.csv" "$RUNDIR/"
cd "$RUNDIR"

PROMPT='Produce csv2json.js, a Node CLI. Read the CSV path from process.argv[2]. If argv length is less than 3 or the file does not exist or the file is empty, print an error to stderr and exit NON-ZERO. Parse CSV with quoted-comma handling: fields wrapped in double quotes allow literal commas inside. The first row is headers. For each data row produce an object mapping header to value. Trailing missing fields must appear as JSON null, not undefined. Empty field values also become JSON null. Emit JSON.stringify(arr, null, 2) and exit 0. The oracle lives in verify.cjs; read it before coding.'

echo "--- START $(date) ---" | tee run.log
aider --model "$MODEL" --no-auto-commits --no-git --yes --read verify.cjs --message "$PROMPT" csv2json.js 2>&1 | tee -a run.log
echo "--- VERIFY $(date) ---" | tee -a run.log
node verify.cjs 2>&1 | tee -a run.log || true
echo "--- END $(date) ---" | tee -a run.log
