#!/usr/bin/env bash
set -euo pipefail

WORKDIR="/tmp/h7-test"
SRC="$WORKDIR/src/utils.ts"
RESULTS_FILE="$WORKDIR/results.txt"

SEED='export function greet(name: string): string {
  return "Hello, " + name;
}

export function sum(numbers: number[]): number {
  let total = 0;
  for (const n of numbers) {
    total += n;
  }
  return total;
}

export function isEven(n: number): boolean {
  return n % 2 === 0;
}'

AIDER_BASE="PYTHONUTF8=1 OLLAMA_API_BASE=http://127.0.0.1:11434 python -m aider --model ollama_chat/qwen3-opencode:30b --no-auto-commits --no-stream --yes --no-show-model-warnings --map-tokens 0 --edit-format whole"

EDITS=(
  "Add a farewell(name: string) function that returns 'Goodbye, {name}!'"
  "Change greet to use template literals instead of string concatenation"
  "Add JSDoc comments to all three functions"
  "Add an average(numbers: number[]) function that uses sum internally"
  "Make isEven handle negative numbers by using Math.abs"
)

reset_file() {
  echo "$SEED" > "$SRC"
}

mkdir -p "$WORKDIR/src"
echo "" > "$RESULTS_FILE"

# Create a minimal tsconfig for tsc checks
cat > "$WORKDIR/tsconfig.json" << 'TSCONF'
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node"
  },
  "include": ["src/**/*.ts"]
}
TSCONF

echo "========================================" | tee -a "$RESULTS_FILE"
echo "H7 Experiment: Solo aider vs PL overhead" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Arrays to store times
declare -a SOLO_TIMES
declare -a PL_TIMES
declare -a VERIFY_CAUGHT

# ---- ARM A: Solo aider ----
echo "--- ARM A: Solo aider ---" | tee -a "$RESULTS_FILE"
for i in 0 1 2 3 4; do
  edit="${EDITS[$i]}"
  echo "" | tee -a "$RESULTS_FILE"
  echo "Edit $((i+1)): $edit" | tee -a "$RESULTS_FILE"
  reset_file

  START=$(date +%s)
  cd "$WORKDIR"
  eval $AIDER_BASE --message "\"$edit\"" --file src/utils.ts > /tmp/h7-aider-a-$i.log 2>&1 || true
  END=$(date +%s)
  ELAPSED=$((END - START))
  SOLO_TIMES[$i]=$ELAPSED
  echo "  Solo time: ${ELAPSED}s" | tee -a "$RESULTS_FILE"
done

# ---- ARM B: PL overhead (aider + tsc verify) ----
echo "" | tee -a "$RESULTS_FILE"
echo "--- ARM B: PL overhead (aider + tsc verify) ---" | tee -a "$RESULTS_FILE"
for i in 0 1 2 3 4; do
  edit="${EDITS[$i]}"
  echo "" | tee -a "$RESULTS_FILE"
  echo "Edit $((i+1)): $edit" | tee -a "$RESULTS_FILE"
  reset_file

  START=$(date +%s)

  # Step 1: aider edit
  cd "$WORKDIR"
  eval $AIDER_BASE --message "\"$edit\"" --file src/utils.ts > /tmp/h7-aider-b-$i.log 2>&1 || true

  # Step 2: tsc verify
  CAUGHT="N"
  cd "$WORKDIR"
  if ! npx tsc --noEmit 2>/tmp/h7-tsc-$i.log; then
    CAUGHT="Y"
    echo "  tsc failed, running fix..." | tee -a "$RESULTS_FILE"
    # Step 3: fix via aider
    eval $AIDER_BASE --message "\"Fix the TypeScript compilation errors in src/utils.ts\"" --file src/utils.ts > /tmp/h7-aider-b-fix-$i.log 2>&1 || true
  fi

  END=$(date +%s)
  ELAPSED=$((END - START))
  PL_TIMES[$i]=$ELAPSED
  VERIFY_CAUGHT[$i]=$CAUGHT
  echo "  PL time: ${ELAPSED}s (verify caught error: $CAUGHT)" | tee -a "$RESULTS_FILE"
done

# ---- Summary ----
echo "" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"
echo "SUMMARY" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"

TOTAL_SOLO=0
TOTAL_PL=0
ERRORS_CAUGHT=0
for i in 0 1 2 3 4; do
  s=${SOLO_TIMES[$i]}
  p=${PL_TIMES[$i]}
  c=${VERIFY_CAUGHT[$i]}
  TOTAL_SOLO=$((TOTAL_SOLO + s))
  TOTAL_PL=$((TOTAL_PL + p))
  if [ "$c" = "Y" ]; then
    ERRORS_CAUGHT=$((ERRORS_CAUGHT + 1))
  fi
  echo "Edit $((i+1)): Solo ${s}s vs PL ${p}s (caught: $c)" | tee -a "$RESULTS_FILE"
done

AVG_SOLO=$((TOTAL_SOLO / 5))
AVG_PL=$((TOTAL_PL / 5))

if [ $TOTAL_SOLO -gt 0 ]; then
  OVERHEAD=$(( (TOTAL_PL - TOTAL_SOLO) * 100 / TOTAL_SOLO ))
else
  OVERHEAD=0
fi

echo "" | tee -a "$RESULTS_FILE"
echo "Average: Solo ${AVG_SOLO}s vs PL ${AVG_PL}s" | tee -a "$RESULTS_FILE"
echo "Total: Solo ${TOTAL_SOLO}s vs PL ${TOTAL_PL}s" | tee -a "$RESULTS_FILE"
echo "PL overhead: ${OVERHEAD}% slower" | tee -a "$RESULTS_FILE"
echo "Verification caught errors: ${ERRORS_CAUGHT}/5" | tee -a "$RESULTS_FILE"
