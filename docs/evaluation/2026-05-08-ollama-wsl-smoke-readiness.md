# Ollama WSL Smoke Readiness Evidence

Date: 2026-05-08

## Summary

The native Ollama runner can pass the smallest smoke slice from WSL when Windows
Ollama is exposed on a WSL-reachable endpoint. The default Windows Ollama
`127.0.0.1:11434` endpoint is reachable from PowerShell but not from WSL `curl`
or the Node-based Prompt Language runner.

This is local-runner connectivity evidence, not HA-HR1 model-routing evidence.

## Commands And Results

```sh
ollama --version
```

Result: pass, `ollama version is 0.20.5`.

```sh
ollama ps
```

Result: pass, no resident model.

```sh
curl -sS --max-time 3 http://127.0.0.1:11434/api/version
```

Result from WSL: fail, connection refused.

```powershell
Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://127.0.0.1:11434/api/version
```

Result from Windows PowerShell: pass, `{"version":"0.20.5"}`.

Temporary workaround:

```powershell
$env:OLLAMA_HOST = "0.0.0.0:11435"
Start-Process -FilePath "ollama.exe" -ArgumentList "serve"
```

WSL probe:

```sh
HOST=$(ip route | awk '/default/ {print $3}')
curl -sS --max-time 5 "http://$HOST:11435/api/version"
```

Result: pass, `{"version":"0.20.5"}`.

Smoke command:

```sh
HOST=$(ip route | awk '/default/ {print $3}')
PROMPT_LANGUAGE_OLLAMA_BASE_URL="http://$HOST:11435" \
  EVAL_MODEL=ollama/qwen3:8b \
  node scripts/eval/smoke-test.mjs --harness ollama --quick --only E
```

Result: pass, `1/1` smoke case passed.

Smoke output artifact:

```text
scripts/eval/results/smoke-2026-05-07T21-30-35-420Z.json
```

That path is ignored by git under the existing eval-results policy.

HA-HR1 local-only live lane:

```sh
HOST=$(ip route | awk '/default/ {print $3; exit})
ENDPOINT="http://$HOST:11435"
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --live-local-command "bash -lc 'cd $(pwd) && PROMPT_LANGUAGE_OLLAMA_BASE_URL=$ENDPOINT EVAL_MODEL=ollama/qwen3:8b node scripts/eval/smoke-test.mjs --harness ollama --quick --only E && printf live-local-smoke-passed > <workspace>/live-local-smoke.txt'" \
  --oracle-command "node -e \"const fs=require('node:fs'); const path=require('node:path'); const workspace=process.argv[1]; const marker=path.join(workspace,'live-local-smoke.txt'); if (!fs.existsSync(marker)) { console.error('missing live marker'); process.exit(1); } console.log('live oracle pass');\" <workspace>" \
  --local-model qwen3:8b \
  --local-endpoint "$ENDPOINT" \
  --step-timeout-ms 600000 \
  --oracle-timeout-ms 10000 \
  --run-id HA-HR1-live-local-ollama-002 \
  --output-root .tmp/harness-arena
```

Result: pass. The manifest at
`.tmp/harness-arena/HA-HR1-live-local-ollama-002/01-local-only/hybrid-routing-manifest.json`
records `claimStatus: live-model-evidence`, `runner: ollama`, `providerClass:
local`, `requestedModel: qwen3:8b`, step exit code `0`, step wall time `7.316s`,
and `oracle.passed: true`.

HA-HR1 local-only live lane with resource snapshots:

```sh
HOST=$(ip route | awk '/default/ {print $3; exit})
ENDPOINT="http://$HOST:11435"
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --live-local-command "bash -lc 'cd $(pwd) && PROMPT_LANGUAGE_OLLAMA_BASE_URL=$ENDPOINT EVAL_MODEL=ollama/qwen3:8b node scripts/eval/smoke-test.mjs --harness ollama --quick --only E && printf live-local-snapshot-smoke-passed > <workspace>/live-local-snapshot-smoke.txt'" \
  --local-resource-snapshot-command "bash -lc 'ollama ps'" \
  --oracle-command "node -e \"const fs=require('node:fs'); const path=require('node:path'); const workspace=process.argv[1]; const marker=path.join(workspace,'live-local-snapshot-smoke.txt'); if (!fs.existsSync(marker)) { console.error('missing live marker'); process.exit(1); } console.log('live snapshot oracle pass');\" <workspace>" \
  --local-model qwen3:8b \
  --local-endpoint "$ENDPOINT" \
  --step-timeout-ms 600000 \
  --oracle-timeout-ms 10000 \
  --run-id HA-HR1-live-local-ollama-snapshot-001 \
  --output-root .tmp/harness-arena
```

Result: pass. The manifest at
`.tmp/harness-arena/HA-HR1-live-local-ollama-snapshot-001/01-local-only/hybrid-routing-manifest.json`
records `claimStatus: live-model-evidence`, step exit code `0`, step wall time
`41.361s`, `oracle.passed: true`, and six
`resourceSnapshotArtifactRefs` for before/after stdout, stderr, and metadata.
The `ollama ps` snapshots were empty before and after the step, so this run proves
snapshot artifact attachment, not sustained model residency.

HA-HR1 local-only live lane with sampled resource snapshots:

```sh
HOST=$(ip route | awk '/default/ {print $3; exit})
ENDPOINT="http://$HOST:11435"
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --live-local-command "bash -lc 'cd $(pwd) && PROMPT_LANGUAGE_OLLAMA_BASE_URL=$ENDPOINT EVAL_MODEL=ollama/qwen3:8b node scripts/eval/smoke-test.mjs --harness ollama --quick --only E && printf live-local-sampled-smoke-passed > <workspace>/live-local-sampled-smoke.txt'" \
  --local-resource-snapshot-command "bash -lc 'OLLAMA_HOST=<localEndpoint> ollama ps'" \
  --local-resource-snapshot-interval-ms 500 \
  --oracle-command "node -e \"const fs=require('node:fs'); const path=require('node:path'); const workspace=process.argv[1]; const marker=path.join(workspace,'live-local-sampled-smoke.txt'); if (!fs.existsSync(marker)) { console.error('missing live marker'); process.exit(1); } console.log('live sampled snapshot oracle pass');\" <workspace>" \
  --local-model qwen3:8b \
  --local-endpoint "$ENDPOINT" \
  --step-timeout-ms 600000 \
  --oracle-timeout-ms 10000 \
  --run-id HA-HR1-live-local-ollama-sampled-001 \
  --output-root .tmp/harness-arena
```

Result: pass. The manifest at
`.tmp/harness-arena/HA-HR1-live-local-ollama-sampled-001/01-local-only/hybrid-routing-manifest.json`
records `claimStatus: live-model-evidence`, step exit code `0`, step wall time
`44.024s`, `oracle.passed: true`, and `150` resource snapshot artifact refs.
Those refs include before/after snapshots plus 48 sampled ticks, each with stdout,
stderr, and metadata. The sampled `ollama ps` stdout files still did not contain
a resident model row, so this run proves during-step sample artifact capture, not
model residency.

HA-HR1 local-only live lane with `qwen3-coder:30b` and sampled `/api/ps`
snapshots:

Before this run, stale Windows `ollama.exe runner` processes were terminated.
Windows free memory rose to about 30.6 GiB, `ollama ps` was empty, and a temporary
WSL-reachable listener was started on `0.0.0.0:11435` with:

- `OLLAMA_NUM_PARALLEL=1`
- `OLLAMA_CONTEXT_LENGTH=8192`
- `OLLAMA_FLASH_ATTENTION=1`

```sh
HOST=$(ip route | awk '/default/ {print $3; exit})
ENDPOINT="http://$HOST:11435"
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --live-local-command "bash -lc 'cd $(pwd) && PROMPT_LANGUAGE_OLLAMA_BASE_URL=$ENDPOINT EVAL_MODEL=ollama/qwen3-coder:30b EVAL_TIMEOUT_MS=1800000 node scripts/eval/smoke-test.mjs --harness ollama --quick --only E && printf qwen3-coder-30b-readiness-passed > <workspace>/qwen3-coder-30b-readiness.txt'" \
  --local-resource-snapshot-command "bash -lc 'curl -sS --max-time 2 <localEndpoint>/api/ps'" \
  --local-resource-snapshot-interval-ms 1000 \
  --oracle-command "node -e \"const fs=require('node:fs'); const path=require('node:path'); const workspace=process.argv[1]; const marker=path.join(workspace,'qwen3-coder-30b-readiness.txt'); if (!fs.existsSync(marker)) { console.error('missing qwen3-coder readiness marker'); process.exit(1); } console.log('qwen3-coder readiness oracle pass');\" <workspace>" \
  --local-model qwen3-coder:30b \
  --local-endpoint "$ENDPOINT" \
  --step-timeout-ms 1800000 \
  --oracle-timeout-ms 10000 \
  --run-id HA-HR1-live-local-qwen3-coder-30b-readiness-001 \
  --output-root .tmp/harness-arena
```

Result: pass. The manifest at
`.tmp/harness-arena/HA-HR1-live-local-qwen3-coder-30b-readiness-001/01-local-only/hybrid-routing-manifest.json`
records `claimStatus: live-model-evidence`, step exit code `0`, step wall time
`9.257s`, and `oracle.passed: true`. `resourceSnapshotSummary` records 9 sampled
ticks, zero probe failures, and 33 total resource artifact refs.

Samples 5 through 9 contained the resident model row from `/api/ps`:

```json
{
  "name": "qwen3-coder:30b",
  "model": "qwen3-coder:30b",
  "size": 19215513600,
  "digest": "06c1097efce0431c2045fe7b2e5108366e43bee1b4603a7aded8f21689e90bca",
  "details": {
    "family": "qwen3moe",
    "parameter_size": "30.5B",
    "quantization_level": "Q4_K_M"
  },
  "size_vram": 15585304576,
  "context_length": 8192
}
```

This is the first readiness run in this sequence that proves both Prompt
Language smoke success and sampled local model residency for `qwen3-coder:30b`.

HA-HR1 local-only live lane with `devstral-small-2:24b` and sampled `/api/ps`
snapshots:

The same temporary WSL-reachable listener setup was reused for the next installed
candidate:

- `OLLAMA_NUM_PARALLEL=1`
- `OLLAMA_CONTEXT_LENGTH=8192`
- `OLLAMA_FLASH_ATTENTION=1`

```sh
HOST=$(ip route | awk '/default/ {print $3; exit})
ENDPOINT="http://$HOST:11435"
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --live-local-command "bash -lc 'cd $(pwd) && PROMPT_LANGUAGE_OLLAMA_BASE_URL=$ENDPOINT EVAL_MODEL=ollama/devstral-small-2:24b EVAL_TIMEOUT_MS=1800000 node scripts/eval/smoke-test.mjs --harness ollama --quick --only E && printf devstral-small-2-24b-readiness-passed > <workspace>/devstral-small-2-24b-readiness.txt'" \
  --local-resource-snapshot-command "bash -lc 'curl -sS --max-time 2 <localEndpoint>/api/ps'" \
  --local-resource-snapshot-interval-ms 1000 \
  --oracle-command "node -e \"const fs=require('node:fs'); const path=require('node:path'); const workspace=process.argv[1]; const marker=path.join(workspace,'devstral-small-2-24b-readiness.txt'); if (!fs.existsSync(marker)) { console.error('missing devstral readiness marker'); process.exit(1); } console.log('devstral readiness oracle pass');\" <workspace>" \
  --local-model devstral-small-2:24b \
  --local-endpoint "$ENDPOINT" \
  --step-timeout-ms 1800000 \
  --oracle-timeout-ms 10000 \
  --run-id HA-HR1-live-local-devstral-small-2-24b-readiness-001 \
  --output-root .tmp/harness-arena
```

Result: pass. The manifest at
`.tmp/harness-arena/HA-HR1-live-local-devstral-small-2-24b-readiness-001/01-local-only/hybrid-routing-manifest.json`
records `claimStatus: live-model-evidence`, step exit code `0`, step wall time
`10.122s`, and `oracle.passed: true`. `resourceSnapshotSummary` records 10
sampled ticks, zero probe failures, and 36 total resource artifact refs.

Six of ten sampled `/api/ps` stdout artifacts contained the resident model row:

```json
{
  "name": "devstral-small-2:24b",
  "model": "devstral-small-2:24b",
  "size": 16696905744,
  "digest": "24277f07f62db8f9cb68e9dfc679ea1818a7fbac47a50eff0a701d3f645b63c8",
  "details": {
    "family": "mistral3",
    "parameter_size": "24.0B",
    "quantization_level": "Q4_K_M"
  },
  "size_vram": 14912782352,
  "context_length": 8192
}
```

This proves Prompt Language smoke success and sampled local model residency for
`devstral-small-2:24b`.

## Interpretation

The local model stack is usable for bounded smoke testing on this host if the
Ollama API is explicitly exposed to WSL and `PROMPT_LANGUAGE_OLLAMA_BASE_URL`
points at the WSL gateway endpoint.

The HA-HR1 runner can now execute a local-only live lane through that endpoint and
preserve oracle isolation. This is still connectivity-level local model evidence:
it proves the harness can call a real local model lane and record artifacts, not
that hybrid routing beats the baselines.

The default setup remains a no-go for live HA-HR1 because:

- `127.0.0.1:11434` is Windows-local and not reachable from WSL;
- HA-HR1 `--live` requires explicit lane command templates and a private oracle
  command;
- one `--only E` smoke proves runner connectivity, not hybrid routing quality.

## Follow-Up

- Add a documented local preflight for Windows-hosted Ollama from WSL.
- Run the first local-only HA-HR1 live lane through the WSL-reachable endpoint.
- Use `qwen3:8b` for cheap smoke and reserve larger local models for fixture runs
  after endpoint readiness is stable.
