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
