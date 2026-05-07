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

## Interpretation

The local model stack is usable for bounded smoke testing on this host if the
Ollama API is explicitly exposed to WSL and `PROMPT_LANGUAGE_OLLAMA_BASE_URL`
points at the WSL gateway endpoint.

The default setup remains a no-go for live HA-HR1 because:

- `127.0.0.1:11434` is Windows-local and not reachable from WSL;
- HA-HR1 `--live` is still intentionally unimplemented;
- one `--only E` smoke proves runner connectivity, not hybrid routing quality.

## Follow-Up

- Add a documented local preflight for Windows-hosted Ollama from WSL.
- Keep HA-HR1 live blocked until the runner can invoke local/frontier lanes and
  write claim-grade manifests.
- Use `qwen3:8b` for cheap smoke and reserve larger local models for fixture runs
  after endpoint readiness is stable.
